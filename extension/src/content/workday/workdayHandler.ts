/**
 * Workday Handler - Main Orchestrator
 * Coordinates: Scan → Deduplicate → Map (Canonical/Learned/Fuzzy/AI) → Fill
 * ZERO changes to Greenhouse logic - Workday-specific implementation
 */

import { scanWorkdayApplication, clearScannerState, getDiscoveredFields } from './workdayScanner';
import { fillMappedAnswers } from './workdayFiller';
import { QuestionMapper, MappedAnswer, ScannedQuestion } from '../mapping/questionMapper';

const LOG_PREFIX = '[WorkdayHandler]';

// Session-based question cache (tracks what we've already mapped)
interface QuestionCache {
    normalized: string;
    answer: MappedAnswer;
}

const SESSION_STATE = {
    mappedQuestions: new Map<string, MappedAnswer>(),
    isProcessing: false
};

/**
 * Normalize question text for deduplication
 */
function normalizeQuestionText(text: string): string {
    return text.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Main entry point: Handle Workday application autofill
 */
export async function handleWorkdayApplication(payload?: any): Promise<void> {
    console.log(`${LOG_PREFIX} 🚀 Starting Workday autofill process...`);

    if (SESSION_STATE.isProcessing) {
        console.warn(`${LOG_PREFIX} ⚠️ Already processing, please wait...`);
        return;
    }

    SESSION_STATE.isProcessing = true;

    try {
        // ==================== PHASE 1: INITIAL SCAN & FILL ====================
        console.log(`\n${LOG_PREFIX} ═════════════════════════════════════════`);
        console.log(`${LOG_PREFIX} PHASE 1: INITIAL SCAN (Skipping Add Buttons)`);
        console.log(`${LOG_PREFIX} ═════════════════════════════════════════\n`);

        // Pass 1: Scan WITHOUT clicking Add buttons
        await processWorkdayPass(false);

        // ==================== PHASE 2: DELTA SCAN & FILL ====================
        console.log(`\n${LOG_PREFIX} ═════════════════════════════════════════`);
        console.log(`${LOG_PREFIX} PHASE 2: DELTA SCAN (Clicking Add Buttons)`);
        console.log(`${LOG_PREFIX} ═════════════════════════════════════════\n`);

        // Pass 2: Scan WITH clicking Add buttons
        // Ideally we would only process NEW fields, but our deduplication logic handles this naturally
        // because we cache answers by question text.
        // However, we want to ensure we don't try to fill fields that are already filled/stable.
        // The filler already checks `STATE.filledFields` to skip filled ones!
        // The Deduplication logic checks `SESSION_STATE.mappedQuestions` to skip mapping known ones.

        await processWorkdayPass(true);

        console.log(`${LOG_PREFIX} ═════════════════════════════════════════`);
        console.log(`${LOG_PREFIX} ✅ WORKDAY AUTOFILL COMPLETE (Both Passes)`);
        // We can't easily aggregate stats from the helper without returning them, 
        // but the individual pass logs are sufficient.
        console.log(`${LOG_PREFIX} ═════════════════════════════════════════\n`);

    } catch (error) {
        console.error(`${LOG_PREFIX} ❌ Error during Workday autofill:`, error);
    } finally {
        SESSION_STATE.isProcessing = false;

        // Collect all successfully mapped question names for the UI to count
        const successfulFields = Array.from(SESSION_STATE.mappedQuestions.values())
            .map(ans => ans.questionText);

        // Signal completion to UI components (OverlayPanel)
        window.dispatchEvent(new CustomEvent('AUTOFILL_COMPLETE_EVENT', {
            detail: {
                successes: successfulFields.length,
                failures: 0,
                successfulFields: successfulFields
            }
        }));
    }
}

/**
 * Helper to run a single scan-map-fill pass
 */
async function processWorkdayPass(clickAddButtons: boolean): Promise<void> {
    const scannedQuestions = await scanWorkdayApplication(clickAddButtons);
    console.log(`${LOG_PREFIX} ✅ Scan complete: ${scannedQuestions.length} questions found\n`);

    // ==================== DEDUPLICATION ====================

    // Separate questions into cached vs new
    const newQuestions: ScannedQuestion[] = [];
    const cachedAnswers: MappedAnswer[] = [];

    for (const question of scannedQuestions) {
        const normalizedText = normalizeQuestionText(question.questionText);
        const cached = SESSION_STATE.mappedQuestions.get(normalizedText);

        if (cached) {
            // Already mapped in this session (or previous pass)
            // console.log(`${LOG_PREFIX}   💾 Using cached answer: "${question.questionText}"`); // Too verbose for pass 2
            cachedAnswers.push(cached);
        } else {
            // New question - needs mapping
            newQuestions.push(question);
        }
    }

    console.log(`${LOG_PREFIX} 📊 Deduplication results:`);
    console.log(`${LOG_PREFIX}    Cached: ${cachedAnswers.length}`);
    console.log(`${LOG_PREFIX}    New: ${newQuestions.length}\n`);

    // ==================== MAPPING ====================
    let newAnswers: MappedAnswer[] = [];

    if (newQuestions.length > 0) {
        console.log(`${LOG_PREFIX} 🤖 Mapping ${newQuestions.length} new questions...`);

        // Use questionMapper to map new questions
        const mapper = new QuestionMapper();
        newAnswers = await mapper.processQuestions(newQuestions);

        // ---------------------------------------------------------
        // POST-MAPPING OVERRIDES & INJECTIONS
        // ---------------------------------------------------------

        // 1. INJECT SKILLS from localStorage
        // The user specifically asked to use skills from local storage
        try {
            const storedSkills = localStorage.getItem('user_skills'); // Assuming this key
            // Or try to get it from the payload if available, but user said "local storage"
            // Let's look for a "Skills" question in our newAnswers
            if (storedSkills) {
                const skillsField = newAnswers.find(a =>
                    normalizeQuestionText(a.questionText).includes('skills')
                );

                if (skillsField) {
                    console.log(`${LOG_PREFIX} 💉 Injecting stored SKILLS into: "${skillsField.questionText}"`);
                    skillsField.answer = storedSkills;
                    skillsField.source = 'injected_skills';
                }
            }
        } catch (e) {
            console.warn(`${LOG_PREFIX} ⚠️ Failed to inject skills:`, e);
        }

        // 2. FORCE "LINKEDIN" for "How did you hear about us"
        // The user specifically asked for this override
        for (const ans of newAnswers) {
            const text = normalizeQuestionText(ans.questionText);
            if (text.includes('how did you hear') || text.includes('source')) {
                console.log(`${LOG_PREFIX} 💉 Forcing "LinkedIn" for source question: "${ans.questionText}"`);
                ans.answer = 'LinkedIn';
                ans.source = 'hardcoded_override';
            }
        }

        console.log(`${LOG_PREFIX} ✅ Mapping complete: ${newAnswers.length}/${newQuestions.length} answered\n`);

        // Store newly mapped answers in session cache
        for (const answer of newAnswers) {
            const normalizedText = normalizeQuestionText(answer.questionText);
            SESSION_STATE.mappedQuestions.set(normalizedText, answer);
        }
    } else {
        console.log(`${LOG_PREFIX} ℹ️ No new questions to map\n`);
    }

    // ==================== FILLING ====================
    console.log(`${LOG_PREFIX} 📝 Filling fields...`);

    const allAnswers = [...cachedAnswers, ...newAnswers];
    // Fill mapped answers using static import
    const discoveredFields = getDiscoveredFields();

    // FILL ONLY if we have answers? Or always try? 
    // Always try because even cached answers need to be filled in the new fields (e.g. new "Job Title" field)
    await fillMappedAnswers(allAnswers, discoveredFields);
}

/**
 * Reset session cache (for testing or when starting fresh)
 */
export function resetWorkdaySession(): void {
    console.log(`${LOG_PREFIX} 🔄 Resetting session cache...`);
    SESSION_STATE.mappedQuestions.clear();
    clearScannerState();
}

/**
 * Get session statistics (for debugging)
 */
export function getWorkdaySessionStats(): {
    cachedQuestions: number;
    isProcessing: boolean;
} {
    return {
        cachedQuestions: SESSION_STATE.mappedQuestions.size,
        isProcessing: SESSION_STATE.isProcessing
    };
}

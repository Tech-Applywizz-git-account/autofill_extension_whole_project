// extension/src/content/autofillRunner.ts
/**
 * Main autofill orchestrator - receives answers from Selenium scan and fills current tab
 * Production architecture: Selenium READ-ONLY → Extension fills EVERYTHING
 */

import { fillField } from './actions/fieldFiller';
import { DetectedField, FieldType, QuestionSection } from '../types/fieldDetection';
import { detectFieldsInCurrentDOM, bestMatchField, Detected } from './fieldMatching';
import { isWorkdayApplication } from './workday/workdayDetector';
import { handleWorkdayApplication } from './workday/workdayHandler';
import { patternStorage } from '../core/storage/patternStorage';
import { loadProfile } from '../core/storage/profileStorage';
import { isNewToHardcodedEngine } from './mapping/hardcodedAnswerEngine';
import { getValueByIntent } from './mapping/questionPatternDatabase';
import { AnalyticsTracker } from '../core/analytics/AnalyticsTracker';
import { detectPlatform } from './utils/platformDetection';

const LOG_PREFIX = "[AutofillRunner]";

export type ResolvedField = {
    questionId?: string;
    questionText: string;
    canonicalKey?: string;
    fieldType: "TEXT" | "TEXTAREA" | "EMAIL" | "PHONE" | "NUMBER" | "DATE" | "RADIO" | "CHECKBOX" | "SELECT_NATIVE" | "DROPDOWN_CUSTOM" | "FILE";
    value: any;
    confidence?: number;
    selector?: string;
    options?: string[];
    fileName?: string; // For file uploads
    required?: boolean;
};

export type FillPayload = {
    url: string;
    fields: ResolvedField[];
    jobId?: string;
    runId: string;
};

declare global {
    interface WindowEventMap {
        'START_AUTOFILL_EVENT': CustomEvent<FillPayload>;
    }
}

/**
 * Initialize autofill runner - listens for START_AUTOFILL messages
 */
export function initAutofillRunner() {
    window.addEventListener('START_AUTOFILL_EVENT', (event: CustomEvent<FillPayload>) => {
        (async () => {
            await runAutofill(event.detail);
        })();
    });

    console.log(`${LOG_PREFIX} ✅ Initialized and listening for START_AUTOFILL_EVENT`);
}

/**
 * Main autofill execution
 */
async function runAutofill(payload: FillPayload) {
    console.log(`\n╔════════════════════════════════════════════════════════════════════╗`);
    console.log(`║                🚀 STARTING AUTOFILL PROCESS                       ║`);
    console.log(`╚════════════════════════════════════════════════════════════════════╝`);
    console.log(`\n📋 Payload Details:`);
    console.log(`   URL: ${payload.url}`);
    console.log(`   Run ID: ${payload.runId}`);
    console.log(`   Fields to fill: ${payload.fields.length}\n`);

    const tracker = AnalyticsTracker.getInstance();
    tracker.startFilling();

    // ========== WORKDAY DETECTION ==========
    // If this is a Workday application, delegate to Workday handler
    if (isWorkdayApplication()) {
        console.log(`${LOG_PREFIX} 🏢 WORKDAY APPLICATION DETECTED - Using Workday handler\n`);
        await handleWorkdayApplication(payload);
        tracker.endFilling();
        return;
    }

    // ========== PLATFORM DETECTION & LOGGING ==========
    const platform = detectPlatform();
    const platformName = platform.toUpperCase();
    console.log(`${LOG_PREFIX} 🏢 ${platformName} APPLICATION - Using standard flow\n`);

    // Step 1: Detect fields in current DOM
    console.log(`🔍 Step 1: Detecting fields in current DOM...`);
    const detected = detectFieldsInCurrentDOM();
    console.log(`   ✓ Detected ${detected.length} fields in current tab\n`);

    // Pre-flight check: Do we have ANY matches in this frame?
    // If not, this is likely an iframe (ads, tracking) that shouldn't participate
    const potentialMatches = payload.fields.filter(rf => bestMatchField(detected, rf.questionText, rf.canonicalKey));

    if (potentialMatches.length === 0) {
        console.log(`${LOG_PREFIX} ⏭️ No matching fields in this frame. Skipping autofill & analytics.`);
        tracker.endFilling();
        return;
    }

    const results: any[] = [];
    let successes = 0;
    let failures = 0;

    console.log(`╔════════════════════════════════════════════════════════════════════╗`);
    console.log(`║              📝 Step 2: FILLING FIELDS (${payload.fields.length} total)${' '.repeat(Math.max(0, 22 - payload.fields.length.toString().length))}║`);
    console.log(`╚════════════════════════════════════════════════════════════════════╝\n`);

    // --- SEQUENTIAL FILLING LOGIC ---
    // Group fields by filling priority (case-insensitive)
    const getPriority = (f: { fieldType: string }) => {
        const type = f.fieldType.toUpperCase();
        if (["TEXT", "TEXTAREA", "EMAIL", "PHONE", "TEL", "NUMBER", "DATE"].includes(type)) return 1;
        if (["SELECT", "SELECT_NATIVE", "DROPDOWN_CUSTOM"].includes(type)) return 2;
        if (["RADIO", "CHECKBOX"].includes(type)) return 3;
        if (["FILE"].includes(type)) return 4;
        return 5; // Unknown / Other
    };

    const priorityGroups = {
        inputs: payload.fields.filter(f => getPriority(f) === 1),
        dropdowns: payload.fields.filter(f => getPriority(f) === 2),
        selections: payload.fields.filter(f => getPriority(f) === 3),
        files: payload.fields.filter(f => getPriority(f) === 4),
        others: payload.fields.filter(f => getPriority(f) === 5)
    };

    const sortedFields = [
        ...priorityGroups.inputs,
        ...priorityGroups.dropdowns,
        ...priorityGroups.selections,
        ...priorityGroups.files,
        ...priorityGroups.others
    ];

    console.log(`${LOG_PREFIX} 📋 Sequential Filling Order:`);
    console.log(`   1. Inputs: ${priorityGroups.inputs.length}`);
    console.log(`   2. Dropdowns: ${priorityGroups.dropdowns.length}`);
    console.log(`   3. Selections: ${priorityGroups.selections.length}`);
    console.log(`   4. Files: ${priorityGroups.files.length}`);
    if (priorityGroups.others.length > 0) console.log(`   5. Others: ${priorityGroups.others.length}`);
    console.log(`\n`);

    // Step 2: Match and fill each resolved field in priority order
    let currentGroupType = "";

    for (let i = 0; i < sortedFields.length; i++) {
        const rf = sortedFields[i];
        const fieldNum = i + 1;

        // Add a longer delay when switching between groups to ensure DOM settles
        if (currentGroupType && currentGroupType !== rf.fieldType) {
            console.log(`${LOG_PREFIX} 🕒 Group changed, waiting for DOM to settle...`);
            await sleep(300);
        }
        currentGroupType = rf.fieldType;

        console.log(`\n┌─ Field ${fieldNum}/${sortedFields.length} [${rf.fieldType}] ${'─'.repeat(45 - fieldNum.toString().length - sortedFields.length.toString().length - rf.fieldType.length)}`);
        console.log(`│ 📝 Question: "${rf.questionText}"`);
        console.log(`│ 💬 Answer: "${rf.value}"`);

        // Find matching DOM element
        console.log(`│ 🔍 Searching for DOM match...`);
        const match = bestMatchField(detected, rf.questionText, rf.canonicalKey);

        if (!match) {
            console.log(`│ ❌ No DOM match found`);
            console.log(`└${'─'.repeat(66)}`);
            results.push({ questionText: rf.questionText, ok: false, reason: "No DOM match" });
            await reportFieldFailed(payload, rf, "NO_DOM_MATCH");
            failures++;
            continue;
        }

        // Fill and Verify
        const ok = await fillMatchedField(match, rf);
        results.push({ questionText: rf.questionText, ok });
        tracker.trackFillResult(rf.questionText, ok);

        // Dispatch incremental progress event
        const progressEvent = new CustomEvent('FIELD_FILL_PROGRESS', {
            detail: { questionText: rf.questionText, ok }
        });
        window.dispatchEvent(progressEvent);

        if (ok) {
            console.log(`│ ✅ SUCCESS - Field filled and verified`);
            console.log(`└${'─'.repeat(66)}`);
            successes++;

            // LEARN from this interaction (only if it's NEW)
            try {
                if (rf.canonicalKey) {
                    const profile = await loadProfile();
                    let isProfileEmpty = true;
                    if (profile) {
                        const val = getValueByIntent(profile, rf.canonicalKey);
                        if (val !== undefined && val !== null && val !== '') {
                            isProfileEmpty = false;
                        }
                    }

                    const { isNewQuestion, isNewAnswer } = isNewToHardcodedEngine(rf.questionText, rf.canonicalKey, String(rf.value));

                    if (isNewQuestion || isNewAnswer || isProfileEmpty) {
                        let canonicalValue = String(rf.value);
                        if (profile && !isProfileEmpty) {
                            const current = getValueByIntent(profile, rf.canonicalKey);
                            if (typeof current === 'boolean') {
                                canonicalValue = current ? 'Yes' : 'No';
                            } else {
                                canonicalValue = String(current);
                            }
                        }

                        if (isProfileEmpty && profile) {
                            const { updateProfileField } = await import("../core/storage/profileStorage");
                            await updateProfileField(rf.canonicalKey, rf.value);
                        }

                        if (isNewQuestion || isNewAnswer) {
                            await patternStorage.addPattern({
                                questionPattern: rf.questionText,
                                intent: rf.canonicalKey,
                                canonicalKey: rf.canonicalKey,
                                fieldType: rf.fieldType.toLowerCase(),
                                confidence: rf.confidence || 1.0,
                                source: 'manual',
                                answerMappings: [{
                                    canonicalValue: canonicalValue,
                                    variants: [String(rf.value)],
                                    contextOptions: rf.options || []
                                }]
                            });
                        }
                    }
                }
            }
            catch (e) {
                console.warn(`${LOG_PREFIX} 🎓 Learning check/store failed:`, e);
            }
        } else {
            console.log(`│ ❌ FAILED - Could not fill or verify field`);
            console.log(`└${'─'.repeat(66)}`);
            failures++;
        }

        // Small delay between fields
        await sleep(150);
    }

    console.log(`\n\n╔════════════════════════════════════════════════════════════════════╗`);
    console.log(`║                  ✅ AUTOFILL COMPLETE                             ║`);
    console.log(`╚════════════════════════════════════════════════════════════════════╝`);
    console.log(`\n📊 Final Results:`);
    console.log(`   ✅ Success: ${successes} field(s)`);
    console.log(`   ❌ Failed: ${failures} field(s)`);
    if (failures > 0) {
        console.log(`   ⚠️ Failed Fields:`);
        results.filter(r => !r.ok).forEach(r => console.log(`      - ${r.questionText} (${r.reason || 'Unknown error'})`));
    }
    const successfulFieldNames = results.filter(r => r.ok).map(r => r.questionText);

    tracker.endFilling();

    // Dispatch completion event for UI timer (local frame)
    window.dispatchEvent(new CustomEvent('AUTOFILL_COMPLETE_EVENT', {
        detail: {
            successes,
            failures,
            successfulFields: successfulFieldNames
        }
    }));

    // Report to background for cross-frame aggregation
    try {
        const successfulFieldNames = results.filter(r => r.ok).map(r => r.questionText);

        // Get frame ID (0 for top frame, or use chrome.runtime's implicit frame tracking)
        // In the content script, we can't easily get our own frameId without help from background,
        // but background knows who sent the message! 
        // We'll let background attach the frameId to the relay.

        await chrome.runtime.sendMessage({
            action: 'REPORT_AUTOFILL_COMPLETE',
            payload: {
                successes,
                failures,
                runId: payload.runId,
                successfulFields: successfulFieldNames
            }
        });
    } catch (e) {
        console.warn(`${LOG_PREFIX} Failed to report completion to background:`, e);
    }
}

/**
 * Fill a matched field using appropriate strategy
 */
async function fillMatchedField(match: Detected, rf: ResolvedField): Promise<boolean> {
    try {
        // Create DetectedField compatible with existing fillField
        // IMPORTANT: Use the fieldType from Selenium (in rf) instead of detected kind
        // because Selenium has accurate type detection for complex dropdowns
        const field: DetectedField = {
            element: match.element as any,
            questionText: match.questionText,
            selector: rf.selector || "",
            fieldType: mapSeleniumTypeToFieldType(rf.fieldType), // Use Selenium's type!
            isRequired: !!rf.required,
            options: rf.options,
            section: QuestionSection.PERSONAL,
            canonicalKey: rf.canonicalKey || '',
            confidence: rf.confidence || 1.0,
            filled: false,
            failed: false,
            filledValue: String(rf.value),
            fileName: rf.fileName,
            skipped: false
        };

        // Use existing fillField from fieldFiller.ts
        // Pass fileName if it's a file upload
        const result = await fillField(field, String(rf.value), rf.fileName);
        return result.success;
    } catch (e) {
        console.error(`${LOG_PREFIX} ❌ Fill error:`, e);
        return false;
    }
}

/**
 * Map Selenium field type string to FieldType enum
 * Selenium provides accurate type detection for complex dropdowns
 */
function mapSeleniumTypeToFieldType(seleniumType: string): FieldType {
    const type = String(seleniumType).toLowerCase();

    // IMPORTANT: Check specific types BEFORE generic patterns
    // Order matters here to avoid false matches!

    // Check for select_native first (before generic 'select' check)
    if (type === 'select_native') return FieldType.SELECT_NATIVE;

    // Native HTML <select> element (should use selectNativeOption)
    if (type === 'select') return FieldType.SELECT_NATIVE;

    // Custom dropdowns (React-Select, Greenhouse custom, etc.)
    if (type.includes('dropdown') || type === 'dropdown_custom') {
        return FieldType.DROPDOWN_CUSTOM;
    }

    // Other field types
    if (type === 'textarea') return FieldType.TEXTAREA;
    if (type === 'email') return FieldType.EMAIL;
    if (type === 'phone') return FieldType.PHONE;
    if (type === 'number') return FieldType.NUMBER;
    if (type === 'radio' || type === 'radio_group') return FieldType.RADIO_GROUP;
    if (type === 'checkbox') return FieldType.CHECKBOX;
    if (type === 'date') return FieldType.DATE;
    if (type === 'file' || type === 'file_upload') return FieldType.FILE_UPLOAD;
    if (type === 'multiselect') return FieldType.MULTISELECT;

    // Default to text
    return FieldType.TEXT;
}

/**
 * Map detected field kind to FieldType enum (kept for reference, now unused)
 */
function mapFieldType(kind: string): FieldType {
    switch (kind) {
        case "TEXT": return FieldType.TEXT;
        case "TEXTAREA": return FieldType.TEXTAREA;
        case "SELECT_NATIVE": return FieldType.SELECT_NATIVE;
        case "DROPDOWN_CUSTOM": return FieldType.DROPDOWN_CUSTOM;
        case "RADIO": return FieldType.RADIO_GROUP;
        case "BUTTON_GROUP": return FieldType.RADIO_GROUP; // Ashby Yes/No buttons
        case "CHECKBOX": return FieldType.CHECKBOX;
        case "DATE": return FieldType.DATE;
        case "FILE": return FieldType.FILE_UPLOAD;
        default: return FieldType.TEXT;
    }
}

/**
 * Report field fill failure to background for Selenium fallback
 */
async function reportFieldFailed(payload: FillPayload, rf: ResolvedField, code: string) {
    try {
        await chrome.runtime.sendMessage({
            type: "FIELD_FILL_FAILED",
            payload: {
                runId: payload.runId,
                url: payload.url,
                jobId: payload.jobId,
                code,
                field: rf
            }
        });
    } catch (e) {
        console.warn(`${LOG_PREFIX} Failed to report field failure:`, e);
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

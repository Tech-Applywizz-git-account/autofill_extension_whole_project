/**
 * Pattern Storage Service - PRODUCTION EDITION
 * 
 * Features:
 * - Keyword-anchored question matching
 * - Progressive dropdown learning
 * - Intent validation (canonical whitelist)
 * - Forbidden answer filtering
 * - 70-85% reduction in AI calls
 * - Client-side caching for global patterns (5 min TTL) — prevents self-DDoS
 */

import { PatternMatcher } from './patternMatcher';
import { loadProfile } from './profileStorage';
import { CONFIG } from '../../config';

const AI_SERVICE_URL = CONFIG.API.AI_SERVICE; // Or your production URL

// -------------------------------------------------------------------
// CLIENT-SIDE CACHE — prevents /api/patterns/sync from being hit
// on every question lookup (was causing 1800+ req/min with 150 users)
// -------------------------------------------------------------------
const GLOBAL_PATTERNS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let globalPatternsCache: { patterns: LearnedPattern[], fetchedAt: number } | null = null;

export interface LearnedPattern {
    id: string;
    questionPattern: string;
    intent: string;
    canonicalKey: string;
    answerMappings?: AnswerMapping[];
    fieldType: string;
    confidence: number;
    usageCount: number;
    lastUsed: string;
    createdAt: string;
    source: 'AI' | 'manual';
    synced?: boolean;
}

export interface AnswerMapping {
    canonicalValue: string | string[];
    variants: (string | string[])[];
    contextOptions?: string[];
}
// ==========================================
// 1) Universal shareable intents (Global learning OK)
// These share Question + Answer variants.
const UNIVERSAL_SHAREABLE_INTENTS = [
    'eeo.gender', 'eeo.race', 'eeo.hispanic', 'eeo.veteran', 'eeo.disability', 'eeo.lgbtq', 'eeo.transgender', 'eeo.preferNotToAnswer',
    'workAuthorization.authorizedUS', 'workAuthorization.authorizedCountry', 'workAuthorization.needsSponsorship',
    'workAuthorization.needsSponsorshipNow', 'workAuthorization.needsSponsorshipFuture', 'workAuthorization.citizenshipStatus',
    'workAuthorization.visaType', 'workAuthorization.workPermitType', 'workAuthorization.workPermitValidUntil',
    'workAuthorization.driverLicense', 'workAuthorization.securityClearance', 'workAuthorization.securityClearanceLevel',
    'workAuthorization.exportControlEligible',
    'application.workArrangement', 'application.workType', 'application.shiftAvailability', 'application.weekendAvailability',
    'application.nightShiftAvailability', 'application.overtimeWillingness', 'application.willingToRelocate',
    'application.willingToTravel', 'application.travelPercentage',
    'application.startDateAvailability', 'application.noticePeriod',
    'application.agreeToTerms', 'application.privacyPolicyConsent', 'application.dataProcessingConsent',
    'application.backgroundCheckConsent', 'application.drugTestConsent', 'application.rightToWorkConfirmation',
    'application.equalOpportunityAcknowledgement',
    'application.howDidYouHear', 'application.wasReferred', 'application.previouslyApplied',
    'application.previouslyInterviewed', 'application.previouslyEmployed', 'application.hasRelatives',
    'location.country', 'location.state', 'location.city', 'location.postalCode',
    'application.allowSmsMessages', 'application.allowEmailUpdates', 'application.marketingConsent',
    'application.talentCommunityOptIn',
    'experience.yearsTotal', 'experience.managementExperience', 'experience.peopleManagement',
    'education.level', 'education.degreeType', 'education.graduationStatus'
];

// 2) Pattern-only intents (Global patterns YES, answers NO)
// Only stores Question + Intent. Values are private.
const PATTERN_ONLY_INTENTS = [
    'personal.firstName', 'personal.middleName', 'personal.lastName', 'personal.fullName',
    'personal.preferredName', 'personal.email', 'personal.phone', 'personal.linkedin',
    'personal.github', 'personal.portfolio', 'personal.website',
    'personal.addressLine1', 'personal.addressLine2', 'personal.city', 'personal.state',
    'personal.postalCode', 'personal.country',
    'documents.resume', 'documents.coverLetter', 'documents.transcript', 'documents.workAuthorizationDocument',
    'education.school', 'education.major', 'education.gpa', 'education.startDate', 'education.endDate',
    'experience.company', 'experience.title', 'experience.startDate', 'experience.endDate', 'experience.currentlyWorking'
];

// 3) Free-text screening intents (Pattern-only + User Templates)
// Shared patterns, but answers are unique/templated per user.
const SCREENING_TEXT_INTENTS = [
    'screening.whyCompany', 'screening.whyRole', 'screening.whyYou', 'screening.whyChange', 'screening.whyNow',
    'screening.aboutYourself', 'screening.professionalSummary', 'screening.careerGoals',
    'screening.strengths', 'screening.weaknesses', 'screening.biggestAchievement',
    'screening.leadershipExample', 'screening.teamworkExample', 'screening.conflictExample', 'screening.problemSolved',
    'screening.projectHighlights', 'screening.recentProject', 'screening.projectChallenge',
    'screening.additionalInfo', 'screening.coverLetterLike'
];

/**
 * Helper to perform fetch via background script to bypass CORS
 */
async function proxyFetch(url: string, options: any = {}): Promise<any> {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: 'proxyFetch', url, options }, (response) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else if (response && response.success) {
                resolve(response.data);
            } else {
                reject(new Error(response?.error || 'Unknown proxyFetch error'));
            }
        });
    });
}


export class PatternStorage {

    /**
     * Get all local patterns
     */
    async getLocalPatterns(): Promise<LearnedPattern[]> {
        try {
            const result = await chrome.storage.local.get('learnedPatterns');
            const patterns = (result.learnedPatterns || []) as LearnedPattern[];

            // Cleanup: Filter out any corrupt patterns that are missing critical fields
            const validPatterns = patterns.filter(p => p && p.questionPattern && p.intent);

            if (validPatterns.length !== patterns.length) {
                console.warn(`[PatternStorage] 🧹 Cleaned up ${patterns.length - validPatterns.length} corrupt local patterns`);
                // Silently save back the cleaned list
                this.saveLocalPatterns(validPatterns).catch(() => { });
            }

            return validPatterns;
        } catch (error) {
            console.error('[PatternStorage] Error getting local patterns:', error);
            return [];
        }
    }


    /**
     * Get all patterns (Local + Global)
     */
    async getAllPatterns(): Promise<LearnedPattern[]> {
        const local = await this.getLocalPatterns();
        const global = await this.fetchGlobalPatterns();

        // Merge them, prioritizing local ones for same question phrasing
        const combined = [...local];
        const localPhrases = new Set(local.map(p => p.questionPattern?.toLowerCase().trim()));

        for (const gp of global) {
            const normalizedGP = gp.questionPattern?.toLowerCase().trim();
            if (!localPhrases.has(normalizedGP)) {
                combined.push(gp);
            }
        }

        return combined;
    }

    /**
     * Save patterns locally
     */
    async saveLocalPatterns(patterns: LearnedPattern[]): Promise<void> {
        try {
            await chrome.storage.local.set({ learnedPatterns: patterns });
        } catch (error) {
            console.error('[PatternStorage] Error saving local patterns:', error);
        }
    }

    /**
     * Replace all local patterns (used for restore)
     */
    async replaceLocalPatterns(patterns: LearnedPattern[]): Promise<void> {
        await this.saveLocalPatterns(patterns);
    }

    /**
     * Add a new pattern
     */
    async addPattern(pattern: Omit<LearnedPattern, 'id' | 'createdAt' | 'usageCount' | 'lastUsed'>): Promise<void> {
        // Validation: Don't save corrupt patterns
        if (!pattern.questionPattern || !pattern.intent) {
            console.error('[PatternStorage] ❌ Attempted to save corrupt pattern:', pattern);
            return;
        }

        const patterns = await this.getLocalPatterns();

        // Check if pattern already exists
        const existing = patterns.find(p =>
            p.intent === pattern.intent &&
            p.questionPattern &&
            pattern.questionPattern &&
            p.questionPattern.toLowerCase() === pattern.questionPattern.toLowerCase()
        );

        if (existing) {
            // Merge answer mappings
            if (pattern.answerMappings && existing.answerMappings) {
                pattern.answerMappings.forEach(newMapping => {
                    const existingMapping = existing.answerMappings!.find(
                        m => JSON.stringify(m.canonicalValue) === JSON.stringify(newMapping.canonicalValue)
                    );
                    if (existingMapping) {
                        newMapping.variants.forEach(v => {
                            const vStr = JSON.stringify(v);
                            const exists = existingMapping.variants.some(ev => JSON.stringify(ev) === vStr);
                            if (!exists) {
                                existingMapping.variants.push(v);
                            }
                        });
                    } else {
                        existing.answerMappings!.push(newMapping);
                    }
                });
            }
            await this.saveLocalPatterns(patterns);
        } else {
            // Add new pattern
            const newPattern: LearnedPattern = {
                ...pattern,
                id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                usageCount: 0,
                createdAt: new Date().toISOString(),
                lastUsed: new Date().toISOString(),
                synced: false
            };
            patterns.push(newPattern);
            console.log(`[PatternStorage] 🎓 Learned new pattern: "${pattern.questionPattern}" → ${pattern.intent}`);

            await this.saveLocalPatterns(patterns);
        }
    }

    /**
     * Explicitly update an existing pattern
     */
    async updatePattern(patternId: string, updates: Partial<LearnedPattern>): Promise<void> {
        const patterns = await this.getLocalPatterns();
        const index = patterns.findIndex(p => p.id === patternId);

        if (index !== -1) {
            patterns[index] = { ...patterns[index], ...updates, synced: false };
            await this.saveLocalPatterns(patterns);
            console.log(`[PatternStorage] 📝 Updated pattern: ${patternId}`);
        }
    }

    /**
     * Increment usage count
     */
    async incrementUsage(patternId: string): Promise<void> {
        const patterns = await this.getLocalPatterns();
        const pattern = patterns.find(p => p.id === patternId);

        if (pattern) {
            pattern.usageCount++;
            pattern.lastUsed = new Date().toISOString();
            await this.saveLocalPatterns(patterns);
        }
    }

    /**
     * Fetch global patterns from AI Service.
     * 
     * ✅ Client-side cached for 5 minutes — prevents per-question network calls
     * which were previously causing a DDoS-like effect on the backend.
     */
    async fetchGlobalPatterns(): Promise<LearnedPattern[]> {
        // Return from cache if still fresh
        const now = Date.now();
        if (globalPatternsCache && (now - globalPatternsCache.fetchedAt) < GLOBAL_PATTERNS_CACHE_TTL_MS) {
            console.log(`[PatternStorage] ⚡ Using cached global patterns (${globalPatternsCache.patterns.length} patterns, age=${Math.round((now - globalPatternsCache.fetchedAt) / 1000)}s)`);
            return globalPatternsCache.patterns;
        }

        try {
            console.log('[PatternStorage] 🌐 Fetching fresh global patterns from AI Service...');
            const data = await proxyFetch(`${AI_SERVICE_URL}/api/patterns/sync`);
            const patterns = data.patterns || [];

            const mapped: LearnedPattern[] = patterns.map((p: any) => ({
                id: `global_${p.id}`,
                questionPattern: p.question_pattern || p.questionPattern,
                intent: p.intent,
                canonicalKey: p.canonical_key || p.canonicalKey,
                fieldType: p.field_type || p.fieldType,
                answerMappings: p.answer_mappings || p.answerMappings,
                confidence: 0.9,
                usageCount: p.popularity || p.usageCount || 1,
                lastUsed: new Date().toISOString(),
                createdAt: p.created_at || p.createdAt || new Date().toISOString(),
                source: 'AI' as const,
                synced: true
            }));

            // Update cache
            globalPatternsCache = { patterns: mapped, fetchedAt: now };
            console.log(`[PatternStorage] ✅ Cached ${mapped.length} global patterns for 5 minutes`);
            return mapped;
        } catch (error) {
            console.error('[PatternStorage] Error fetching global patterns:', error);
            // Return stale cache if available rather than empty
            return globalPatternsCache?.patterns ?? [];
        }
    }

    // ========================================
    // PRODUCTION-READY PATTERN FINDING
    // ========================================

    /**
     * Find pattern with production-safe matching
     */
    async findPattern(questionText: string, fieldType?: string, options?: string[]): Promise<LearnedPattern | null> {
        const localPatterns = await this.getLocalPatterns();
        const questionKeywords = PatternMatcher.extractKeywords(questionText);

        // 1. Try local patterns first
        let match = this.searchPatternsProduction(
            localPatterns,
            questionText,
            questionKeywords,
            fieldType,
            options
        );

        if (match) {
            console.log(`[PatternStorage] ✅ REUSING stored pattern for "${questionText}"`);
            await this.incrementUsage(match.id);
            return match;
        }

        // 2. Try global patterns if no local match
        const globalPatterns = await this.fetchGlobalPatterns();
        match = this.searchPatternsProduction(
            globalPatterns,
            questionText,
            questionKeywords,
            fieldType,
            options
        );

        if (match) {
            console.log(`[PatternStorage] 🌐 REUSING GLOBAL pattern for "${questionText}"`);
            // We don't increment usage for global patterns locally yet
            return match;
        }

        console.log(`[PatternStorage] 🔍 No usable pattern found, will call AI`);
        return null;
    }

    /**
     * Production-safe pattern search with all validations
     */
    private searchPatternsProduction(
        patterns: LearnedPattern[],
        questionText: string,
        questionKeywords: string[],
        fieldType?: string,
        incomingOptions?: string[]
    ): LearnedPattern | null {
        const qNormalized = PatternMatcher.normalizeQuestion(questionText);
        const isDropdown = fieldType && ['dropdown', 'select', 'dropdown_custom', 'radio'].includes(fieldType);

        let bestMatch: { pattern: LearnedPattern, score: number } | null = null;

        for (const pattern of patterns) {
            // ✅ VALIDATION 1: Intent must be canonical
            if (!PatternMatcher.isIntentValid(pattern.intent)) {
                console.log(`[PatternStorage] ⚠️ Skipping invalid intent: "${pattern.intent}"`);
                continue;
            }

            // ✅ VALIDATION 2: FieldType compatibility
            if (fieldType && !PatternMatcher.areFieldTypesCompatible(pattern.fieldType, fieldType)) {
                continue;
            }

            // ✅ VALIDATION 3: Question matching
            if (!pattern.questionPattern) {
                console.warn(`[PatternStorage] ⚠️ Pattern missing questionPattern: ${pattern.id}`);
                continue;
            }
            const pNormalized = PatternMatcher.normalizeQuestion(pattern.questionPattern);
            const patternKeywords = PatternMatcher.extractKeywords(pattern.questionPattern);

            let matchScore = 0;

            // Exact normalized match gets highest score
            if (pNormalized === qNormalized) {
                matchScore = 1.0;
            }
            // Keyword overlap (0-1.0)
            else {
                const keywordOverlap = PatternMatcher.calculateKeywordOverlap(questionKeywords, patternKeywords);
                if (keywordOverlap >= 0.7) {
                    matchScore = keywordOverlap;
                }
            }

            // Also check intent-specific keywords
            if (matchScore < 0.7 && PatternMatcher.matchesIntentKeywords(questionKeywords, pattern.intent)) {
                matchScore = 0.75;  // Boost score if intent keywords match
            }

            if (matchScore < 0.7) continue;  // Not a good enough match

            // ✅ VALIDATION 4: Answer usability
            let usableAnswer: string | string[] | null = null;

            if (isDropdown && incomingOptions) {
                // DROPDOWN: Check if ANY stored answer exists in incoming options
                usableAnswer = this.findDropdownAnswer(pattern, incomingOptions);
            } else {
                // TEXT: Get first usable answer
                usableAnswer = this.extractUsableAnswer(pattern);
            }

            if (!usableAnswer) {
                console.log(`[PatternStorage] ⚠️ Pattern matches but answer unusable`);
                continue;
            }

            // Track best match (highest score, then usage count, then most recent)
            if (!bestMatch || matchScore > bestMatch.score) {
                bestMatch = { pattern, score: matchScore };
            } else if (matchScore === bestMatch.score) {
                // Tie-breaker: usage count
                if (pattern.usageCount > bestMatch.pattern.usageCount) {
                    bestMatch = { pattern, score: matchScore };
                }
            }
        }

        return bestMatch ? bestMatch.pattern : null;
    }

    /**
     * Find dropdown answer from stored patterns (progressive learning)
     */
    private findDropdownAnswer(pattern: LearnedPattern, incomingOptions: string[]): string | string[] | null {
        if (!pattern.answerMappings || pattern.answerMappings.length === 0) {
            return null;
        }

        // Collect all stored answers (variants from all mappings)
        const storedAnswers: (string | string[])[] = [];

        for (const mapping of pattern.answerMappings) {
            if (mapping.variants) {
                storedAnswers.push(...mapping.variants);
            }
            if (mapping.canonicalValue) {
                storedAnswers.push(mapping.canonicalValue);
            }
        }

        // Find match in incoming options
        return PatternMatcher.findBestDropdownMatch(storedAnswers, incomingOptions);
    }

    /**
     * Extract usable text answer with forbidden pattern filtering
     */
    private extractUsableAnswer(pattern: LearnedPattern): string | string[] | null {
        if (!pattern.answerMappings || pattern.answerMappings.length === 0) {
            return null;
        }

        for (const mapping of pattern.answerMappings) {
            // Try variants first
            if (mapping.variants) {
                for (const variant of mapping.variants) {
                    if (PatternMatcher.isAnswerUsable(variant)) {
                        return variant;
                    }
                }
            }

            // Try canonical value
            if (mapping.canonicalValue && PatternMatcher.isAnswerUsable(mapping.canonicalValue)) {
                return mapping.canonicalValue;
            }
        }

        return null;
    }

    /**
     * Add new answer variant to existing pattern (for progressive dropdown learning)
     */
    async addAnswerVariant(patternId: string, newAnswer: string | string[]): Promise<void> {
        const patterns = await this.getLocalPatterns();
        const pattern = patterns.find(p => p.id === patternId);

        if (!pattern || !pattern.answerMappings || pattern.answerMappings.length === 0) {
            return;
        }

        const mapping = pattern.answerMappings[0];

        // Add to variants if not already there
        if (!mapping.variants) {
            mapping.variants = [];
        }

        const normalized = PatternMatcher.normalizeOption(newAnswer);
        const exists = mapping.variants.some(v => {
            if (Array.isArray(v) && Array.isArray(newAnswer)) {
                return v.length === newAnswer.length && v.every((val, i) => val === newAnswer[i]);
            }
            return v === newAnswer;
        });

        if (!exists) {
            mapping.variants.push(newAnswer);
            pattern.lastUsed = new Date().toISOString();
            await this.saveLocalPatterns(patterns);

            console.log(`[PatternStorage] 📚 Learned new variant: "${newAnswer}" for ${pattern.intent}`);
        }
    }

    /**
     * Delete a specific pattern
     */
    async deletePattern(patternId: string): Promise<void> {
        const patterns = await this.getLocalPatterns();
        const updated = patterns.filter(p => p.id !== patternId);

        if (updated.length !== patterns.length) {
            await this.saveLocalPatterns(updated);
            console.log(`[PatternStorage] 🗑️ Deleted pattern: ${patternId}`);
        }
    }

    /**
     * Delete all local patterns
     */
    async deleteAllLocalPatterns(): Promise<void> {
        await this.saveLocalPatterns([]);
        console.log('[PatternStorage] ☢️ All local patterns wiped');
    }

    /**
     * Get storage statistics
     */
    async getStats(): Promise<{
        totalPatterns: number;
        syncedPatterns: number;
        unsyncedPatterns: number;
        totalUsage: number;
        intentBreakdown: Record<string, number>;
    }> {
        const patterns = await this.getLocalPatterns();

        const intentBreakdown: Record<string, number> = {};
        patterns.forEach(p => {
            intentBreakdown[p.intent] = (intentBreakdown[p.intent] || 0) + 1;
        });

        return {
            totalPatterns: patterns.length,
            syncedPatterns: patterns.filter(p => p.synced).length,
            unsyncedPatterns: patterns.filter(p => !p.synced).length,
            totalUsage: patterns.reduce((sum, p) => sum + p.usageCount, 0),
            intentBreakdown
        };
    }

    /**
     * Restore patterns from Supabase via AI Service
     */
    async restorePatterns(email: string): Promise<boolean> {
        try {
            console.log(`[PatternStorage] 🔄 Restoring patterns for ${email}...`);
            const result = await proxyFetch(`${AI_SERVICE_URL}/api/patterns/user/${encodeURIComponent(email)}`);

            if (result.success && result.patterns) {
                const dbPatterns = result.patterns;
                console.log(`[PatternStorage] 📥 Received ${dbPatterns.length} patterns from server`);

                const learnedPatterns: LearnedPattern[] = dbPatterns.map((p: any) => ({
                    id: p.id,
                    questionPattern: p.question_pattern || p.questionPattern,
                    intent: p.intent,
                    canonicalKey: p.canonical_key || p.canonicalKey,
                    fieldType: p.field_type || p.fieldType,
                    answerMappings: p.answer_mappings || p.answerMappings,
                    confidence: p.confidence || 1.0,
                    usageCount: p.usage_count || p.usageCount || 0,
                    lastUsed: p.last_used || p.lastUsed,
                    createdAt: p.created_at || p.createdAt,
                    source: p.source || 'AI',
                    synced: true
                }));

                await this.saveLocalPatterns(learnedPatterns);
                console.log(`[PatternStorage] ✅ Restored ${learnedPatterns.length} patterns to local storage`);
                return true;
            }
            return false;
        } catch (error) {
            console.error("[PatternStorage] Restore error:", error);
            return false;
        }
    }

    /**
     * Sync all unsynced patterns to Supabase in a single batch
     */
    async syncUnsyncedPatterns(): Promise<void> {
        try {
            const patterns = await this.getLocalPatterns();
            const unsynced = patterns.filter(p => !p.synced);

            if (unsynced.length === 0) {
                console.log("[PatternStorage] ✨ No new patterns to sync");
                return;
            }

            const profile = await loadProfile();
            if (!profile?.personal.email) {
                console.warn("[PatternStorage] No email found in profile, cannot sync batch");
                return;
            }

            console.log(`[PatternStorage] 🔄 Batch syncing ${unsynced.length} patterns to AI Service...`);

            // 🔒 PRIVACY STRIPPING
            const syncPayloads = unsynced.map(pattern => {
                const isUniversal = UNIVERSAL_SHAREABLE_INTENTS.includes(pattern.intent);
                return {
                    ...pattern,
                    answerMappings: isUniversal ? pattern.answerMappings : []
                };
            });

            const response = await proxyFetch(`${AI_SERVICE_URL}/api/patterns/upload-batch?email=${encodeURIComponent(profile.personal.email)}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ patterns: syncPayloads }),
            });

            if (response && response.success) {
                console.log(`[PatternStorage] ✅ Batch sync successful: ${unsynced.length} patterns`);

                // Update local synced status
                const updatedPatterns = patterns.map(p => {
                    if (!p.synced) {
                        return { ...p, synced: true };
                    }
                    return p;
                });
                await this.saveLocalPatterns(updatedPatterns);
            } else {
                console.error("[PatternStorage] ❌ Batch sync failed:", response?.error || 'Unknown error');
            }
        } catch (error) {
            console.warn("[PatternStorage] Batch sync error:", error);
        }
    }

    /**
     * Sync a single pattern to Supabase via AI Service
     */
    async syncPatternToSupabase(pattern: LearnedPattern): Promise<void> {
        try {
            const profile = await loadProfile();
            if (!profile?.personal.email) {
                console.warn("[PatternStorage] No email found in profile, cannot sync pattern");
                return;
            }

            console.log(`[PatternStorage] 🔄 Syncing pattern to AI Service: ${pattern.intent}`);

            // 🔒 PRIVACY STRIPPING: If NOT a universal shareable intent, remove the answer mappings.
            // This ensures for personal/screening items, we only share the "Question -> Intent" link, not the private answer.
            const isUniversal = UNIVERSAL_SHAREABLE_INTENTS.includes(pattern.intent);
            const syncPayload = {
                ...pattern,
                answerMappings: isUniversal ? pattern.answerMappings : []
            };

            if (!isUniversal) {
                console.log(`[PatternStorage] 🔒 Stripped private answer mappings for non-universal intent: ${pattern.intent}`);
            }

            const response = await proxyFetch(`${AI_SERVICE_URL}/api/patterns/upload?email=${encodeURIComponent(profile.personal.email)}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ pattern: syncPayload }),
            });

            if (response && (response.success || response.message?.includes('successfully'))) {
                console.log("[PatternStorage] ✅ Pattern synced to AI Service");
                pattern.synced = true;

                // Save updated synced status back to local storage
                const patterns = await this.getLocalPatterns();
                const idx = patterns.findIndex(p => p.id === pattern.id);
                if (idx !== -1) {
                    patterns[idx].synced = true;
                    await this.saveLocalPatterns(patterns);
                }

                // Notify UI that a pattern was stored
                window.dispatchEvent(new CustomEvent('PATTERN_SYNCED', {
                    detail: {
                        intent: pattern.intent,
                        question: pattern.questionPattern
                    }
                }));
            } else {
                console.error("[PatternStorage] ❌ Pattern sync failed:", response?.error || 'Unknown error');
            }
        } catch (error) {
            console.warn("[PatternStorage] Pattern sync error:", error);
        }
    }
}

// Singleton instance
export const patternStorage = new PatternStorage();

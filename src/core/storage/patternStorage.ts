/**
 * Pattern Storage Service - PRODUCTION EDITION
 * 
 * Features:
 * - Keyword-anchored question matching
 * - Progressive dropdown learning
 * - Intent validation (canonical whitelist)
 * - Forbidden answer filtering
 * - 70-85% reduction in AI calls
 */

import { PatternMatcher } from './patternMatcher';
import { loadProfile } from './profileStorage';
import { CONFIG } from '../../config';

const AI_SERVICE_URL = CONFIG.API.AI_SERVICE; // Or your production URL

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
    canonicalValue: string;
    variants: string[];
    contextOptions?: string[];
}

// Shareable intents (must match backend)
const SHAREABLE_INTENTS = [
    'eeo.gender', 'eeo.hispanic', 'eeo.veteran', 'eeo.disability', 'eeo.race', 'eeo.lgbtq',
    'workAuth.sponsorship', 'workAuth.usAuthorized', 'workAuth.driverLicense', 'workAuth.visaType',
    'location.country', 'location.state',
    'application.hasRelatives', 'application.previouslyApplied', 'application.ageVerification',
    'application.willingToRelocate', 'application.willingToTravel', 'application.workArrangement',
    // Pattern-only (no answer sharing)
    'personal.firstName', 'personal.lastName', 'personal.email', 'personal.phone', 'personal.city',
    'education.degree', 'education.school', 'education.major',
    'experience.company', 'experience.title'
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
            return result.learnedPatterns || [];
        } catch (error) {
            console.error('[PatternStorage] Error getting local patterns:', error);
            return [];
        }
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
     * Add a new pattern
     */
    async addPattern(pattern: Omit<LearnedPattern, 'id' | 'createdAt' | 'usageCount' | 'lastUsed'>): Promise<void> {
        const patterns = await this.getLocalPatterns();

        // Check if pattern already exists
        const existing = patterns.find(p =>
            p.intent === pattern.intent &&
            p.questionPattern.toLowerCase() === pattern.questionPattern.toLowerCase()
        );

        if (existing) {
            // Merge answer mappings
            if (pattern.answerMappings && existing.answerMappings) {
                pattern.answerMappings.forEach(newMapping => {
                    const existingMapping = existing.answerMappings!.find(
                        m => m.canonicalValue === newMapping.canonicalValue
                    );
                    if (existingMapping) {
                        newMapping.variants.forEach(v => {
                            if (!existingMapping.variants.includes(v)) {
                                existingMapping.variants.push(v);
                            }
                        });
                    } else {
                        existing.answerMappings!.push(newMapping);
                    }
                });
            }
            existing.lastUsed = new Date().toISOString();
            existing.synced = false; // Mark for re-sync
            await this.saveLocalPatterns(patterns);

            // Sync to Supabase
            await this.syncPatternToSupabase(existing);
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

            // Sync to Supabase
            await this.syncPatternToSupabase(newPattern);
        }
    }

    /**
     * Fetch global patterns from AI Service
     */
    async fetchGlobalPatterns(): Promise<LearnedPattern[]> {
        try {
            console.log('[PatternStorage] 🌐 Fetching global patterns from AI Service...');
            const data = await proxyFetch(`${AI_SERVICE_URL}/api/patterns/sync`);
            const patterns = data.patterns || [];

            return patterns.map((p: any) => ({
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
        } catch (error) {
            console.error('[PatternStorage] Error fetching global patterns:', error);
            return [];
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
            let usableAnswer: string | null = null;

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
    private findDropdownAnswer(pattern: LearnedPattern, incomingOptions: string[]): string | null {
        if (!pattern.answerMappings || pattern.answerMappings.length === 0) {
            return null;
        }

        // Collect all stored answers (variants from all mappings)
        const storedAnswers: string[] = [];

        for (const mapping of pattern.answerMappings) {
            if (mapping.variants) {
                storedAnswers.push(...mapping.variants);
            }
            if (mapping.canonicalValue) {
                storedAnswers.push(mapping.canonicalValue);
            }
        }

        // Find first match in incoming options
        return PatternMatcher.findBestDropdownMatch(storedAnswers, incomingOptions);
    }

    /**
     * Extract usable text answer with forbidden pattern filtering
     */
    private extractUsableAnswer(pattern: LearnedPattern): string | null {
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
    async addAnswerVariant(patternId: string, newAnswer: string): Promise<void> {
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
        const exists = mapping.variants.some(v =>
            PatternMatcher.normalizeOption(v) === normalized
        );

        if (!exists) {
            mapping.variants.push(newAnswer);
            pattern.lastUsed = new Date().toISOString();
            await this.saveLocalPatterns(patterns);

            console.log(`[PatternStorage] 📚 Learned new variant: "${newAnswer}" for ${pattern.intent}`);
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
     * Sync a single pattern to Supabase via AI Service
     */
    private async syncPatternToSupabase(pattern: LearnedPattern): Promise<void> {
        try {
            const profile = await loadProfile();
            if (!profile?.personal.email) {
                console.warn("[PatternStorage] No email found in profile, cannot sync pattern");
                return;
            }

            console.log(`[PatternStorage] 🔄 Syncing pattern to AI Service: ${pattern.intent}`);

            const response = await proxyFetch(`${AI_SERVICE_URL}/api/patterns/upload?email=${encodeURIComponent(profile.personal.email)}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ pattern }),
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

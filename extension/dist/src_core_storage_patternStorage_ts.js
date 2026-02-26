"use strict";
(self["webpackChunkautofill_extension"] = self["webpackChunkautofill_extension"] || []).push([["src_core_storage_patternStorage_ts"],{

/***/ "./src/core/storage/patternMatcher.ts"
/*!********************************************!*\
  !*** ./src/core/storage/patternMatcher.ts ***!
  \********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   PatternMatcher: () => (/* binding */ PatternMatcher)
/* harmony export */ });
/**
 * PRODUCTION-GRADE PATTERN MATCHING SYSTEM
 *
 * Implements:
 * 1. Question normalization
 * 2. Intent validation (canonical whitelist)
 * 3. FieldType compatibility
 * 4. Forbidden answer filtering
 * 5. Keyword-anchored matching
 * 6. Progressive dropdown learning
 */
class PatternMatcher {
    /**
     * Normalize question for exact matching
     */
    static normalizeQuestion(question) {
        if (!question)
            return '';
        return question
            .toLowerCase()
            .trim()
            .replace(/[?!.,*]/g, '') // Remove punctuation
            .replace(/\s+/g, ' ') // Collapse spaces
            .trim();
    }
    /**
     * Extract meaningful keywords from question
     */
    static extractKeywords(question) {
        const normalized = this.normalizeQuestion(question);
        const words = normalized.split(/\s+/);
        return words.filter(word => word.length >= 3 && // At least 3 chars
            !this.STOP_WORDS.has(word) && // Not a stop word
            /[a-z]/.test(word) // Contains letters
        );
    }
    /**
     * Calculate keyword overlap between two questions
     */
    static calculateKeywordOverlap(keywords1, keywords2) {
        if (keywords1.length === 0 || keywords2.length === 0)
            return 0;
        const set1 = new Set(keywords1);
        const set2 = new Set(keywords2);
        const intersection = [...set1].filter(k => set2.has(k));
        const union = new Set([...keywords1, ...keywords2]);
        return intersection.length / union.size;
    }
    /**
     * Check if intent matches based on keywords
     */
    static matchesIntentKeywords(questionKeywords, intent) {
        const intentKeywords = this.INTENT_KEYWORDS[intent];
        if (!intentKeywords)
            return false;
        // Check if ANY intent keyword appears in question keywords
        for (const intentKW of intentKeywords) {
            if (questionKeywords.includes(intentKW)) {
                return true;
            }
        }
        return false;
    }
    /**
     * Validate intent (canonical whitelist)
     */
    static isIntentValid(intent) {
        return this.ALLOWED_INTENTS.has(intent);
    }
    /**
     * Check fieldType compatibility
     */
    static areFieldTypesCompatible(stored, incoming) {
        if (stored === incoming)
            return true;
        const compatibilityGroups = [
            ['text', 'textarea'],
            ['dropdown_custom', 'select', 'dropdown', 'radio'],
        ];
        for (const group of compatibilityGroups) {
            if (group.includes(stored) && group.includes(incoming)) {
                return true;
            }
        }
        return false;
    }
    /**
     * Check if answer is usable (not forbidden)
     */
    static isAnswerUsable(answer) {
        if (!answer || answer.trim() === '')
            return false;
        const normalized = answer.toLowerCase().trim();
        for (const pattern of this.FORBIDDEN_ANSWERS) {
            if (pattern.test(normalized)) {
                return false;
            }
        }
        return true;
    }
    /**
     * Normalize dropdown option for comparison
     */
    static normalizeOption(option) {
        return option
            .toLowerCase()
            .trim()
            .replace(/[.,;:'"]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }
    /**
     * Check if stored answer exists in incoming dropdown options
     * Returns the exact option string if found
     */
    static findMatchingOption(storedAnswer, incomingOptions) {
        const normalizedAnswer = this.normalizeOption(storedAnswer);
        for (const option of incomingOptions) {
            const normalizedOption = this.normalizeOption(option);
            // Exact match after normalization
            if (normalizedAnswer === normalizedOption) {
                return option; // Return exact option string
            }
            // Partial match (if one contains the other)
            if (normalizedAnswer.includes(normalizedOption) || normalizedOption.includes(normalizedAnswer)) {
                return option;
            }
        }
        return null;
    }
    /**
     * Find best matching answer from stored answer array for dropdown
     * Returns exact option string from incoming options
     */
    static findBestDropdownMatch(storedAnswers, incomingOptions) {
        for (const storedAnswer of storedAnswers) {
            const match = this.findMatchingOption(storedAnswer, incomingOptions);
            if (match) {
                return match; // Return first matching option
            }
        }
        return null;
    }
}
// ========================================
// CANONICAL INTENT WHITELIST
// ========================================
PatternMatcher.ALLOWED_INTENTS = new Set([
    'personal.firstName',
    'personal.lastName',
    'personal.email',
    'personal.phone',
    'personal.linkedin',
    'personal.city',
    'personal.state',
    'personal.country',
    'personal.desiredSalary',
    'personal.additionalInfo',
    'experience.whyFit',
    'experience.summary',
    'workAuthorization.authorizedUS',
    'workAuthorization.needsSponsorship',
    'eeo.gender',
    'eeo.race',
    'eeo.veteran',
    'eeo.disability',
]);
// ========================================
// INTENT KEYWORDS (for semantic matching)
// ========================================
PatternMatcher.INTENT_KEYWORDS = {
    'personal.desiredSalary': ['salary', 'compensation', 'pay', 'ctc', 'package', 'expected', 'desired'],
    'personal.additionalInfo': ['additional', 'anything', 'else', 'know', 'tell', 'share'],
    'experience.whyFit': ['why', 'fit', 'strong', 'good', 'qualified', 'suitable', 'right'],
    'experience.summary': ['experience', 'background', 'summary', 'describe', 'yourself'],
    'personal.linkedin': ['linkedin', 'profile', 'url', 'link'],
    'workAuthorization.needsSponsorship': ['sponsorship', 'visa', 'sponsor', 'require'],
    'workAuthorization.authorizedUS': ['authorized', 'legally', 'work', 'us', 'united states'],
};
// ========================================
// FORBIDDEN ANSWER PATTERNS
// ========================================
PatternMatcher.FORBIDDEN_ANSWERS = [
    /\bfree text input\b/i,
    /\bnot provided\b/i,
    /\bi don'?t know\b/i,
    /\bdo not know\b/i,
    /\bn\/?a\b/i,
    /\bno additional information at this time\b/i,
    /\bnothing to add\b/i,
    /\bnot sure\b/i,
    /\[object object\]/i,
    /\bnone\b/i,
];
// ========================================
// STOP WORDS (for keyword extraction)
// ========================================
PatternMatcher.STOP_WORDS = new Set([
    'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should',
    'could', 'may', 'might', 'must', 'can', 'of', 'at', 'by', 'for', 'with',
    'about', 'to', 'from', 'in', 'out', 'on', 'off', 'over', 'under',
    'you', 'your', 'we', 'our', 'this', 'that', 'these', 'those', 'what',
    'which', 'who', 'when', 'where', 'why', 'how', 'or', 'and', 'if', 'but',
]);


/***/ },

/***/ "./src/core/storage/patternStorage.ts"
/*!********************************************!*\
  !*** ./src/core/storage/patternStorage.ts ***!
  \********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   PatternStorage: () => (/* binding */ PatternStorage),
/* harmony export */   patternStorage: () => (/* binding */ patternStorage)
/* harmony export */ });
/* harmony import */ var _patternMatcher__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./patternMatcher */ "./src/core/storage/patternMatcher.ts");
/* harmony import */ var _profileStorage__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./profileStorage */ "./src/core/storage/profileStorage.ts");
/* harmony import */ var _config__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../../config */ "./src/config/index.ts");
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



const AI_SERVICE_URL = _config__WEBPACK_IMPORTED_MODULE_2__.CONFIG.API.AI_SERVICE; // Or your production URL
// -------------------------------------------------------------------
// CLIENT-SIDE CACHE — prevents /api/patterns/sync from being hit
// on every question lookup (was causing 1800+ req/min with 150 users)
// -------------------------------------------------------------------
const GLOBAL_PATTERNS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let globalPatternsCache = null;
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
async function proxyFetch(url, options = {}) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: 'proxyFetch', url, options }, (response) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            }
            else if (response && response.success) {
                resolve(response.data);
            }
            else {
                reject(new Error(response?.error || 'Unknown proxyFetch error'));
            }
        });
    });
}
class PatternStorage {
    /**
     * Get all local patterns
     */
    async getLocalPatterns() {
        try {
            const result = await chrome.storage.local.get('learnedPatterns');
            const patterns = (result.learnedPatterns || []);
            // Cleanup: Filter out any corrupt patterns that are missing critical fields
            const validPatterns = patterns.filter(p => p && p.questionPattern && p.intent);
            if (validPatterns.length !== patterns.length) {
                console.warn(`[PatternStorage] 🧹 Cleaned up ${patterns.length - validPatterns.length} corrupt local patterns`);
                // Silently save back the cleaned list
                this.saveLocalPatterns(validPatterns).catch(() => { });
            }
            return validPatterns;
        }
        catch (error) {
            console.error('[PatternStorage] Error getting local patterns:', error);
            return [];
        }
    }
    /**
     * Save patterns locally
     */
    async saveLocalPatterns(patterns) {
        try {
            await chrome.storage.local.set({ learnedPatterns: patterns });
        }
        catch (error) {
            console.error('[PatternStorage] Error saving local patterns:', error);
        }
    }
    /**
     * Replace all local patterns (used for restore)
     */
    async replaceLocalPatterns(patterns) {
        await this.saveLocalPatterns(patterns);
    }
    /**
     * Add a new pattern
     */
    async addPattern(pattern) {
        // Validation: Don't save corrupt patterns
        if (!pattern.questionPattern || !pattern.intent) {
            console.error('[PatternStorage] ❌ Attempted to save corrupt pattern:', pattern);
            return;
        }
        const patterns = await this.getLocalPatterns();
        // Check if pattern already exists
        const existing = patterns.find(p => p.intent === pattern.intent &&
            p.questionPattern &&
            pattern.questionPattern &&
            p.questionPattern.toLowerCase() === pattern.questionPattern.toLowerCase());
        if (existing) {
            // Merge answer mappings
            if (pattern.answerMappings && existing.answerMappings) {
                pattern.answerMappings.forEach(newMapping => {
                    const existingMapping = existing.answerMappings.find(m => m.canonicalValue === newMapping.canonicalValue);
                    if (existingMapping) {
                        newMapping.variants.forEach(v => {
                            if (!existingMapping.variants.includes(v)) {
                                existingMapping.variants.push(v);
                            }
                        });
                    }
                    else {
                        existing.answerMappings.push(newMapping);
                    }
                });
            }
            existing.lastUsed = new Date().toISOString();
            existing.synced = false; // Mark for re-sync
            await this.saveLocalPatterns(patterns);
            // Sync to Supabase
            await this.syncPatternToSupabase(existing);
        }
        else {
            // Add new pattern
            const newPattern = {
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
     * Fetch global patterns from AI Service.
     *
     * ✅ Client-side cached for 5 minutes — prevents per-question network calls
     * which were previously causing a DDoS-like effect on the backend.
     */
    async fetchGlobalPatterns() {
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
            const mapped = patterns.map((p) => ({
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
                source: 'AI',
                synced: true
            }));
            // Update cache
            globalPatternsCache = { patterns: mapped, fetchedAt: now };
            console.log(`[PatternStorage] ✅ Cached ${mapped.length} global patterns for 5 minutes`);
            return mapped;
        }
        catch (error) {
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
    async findPattern(questionText, fieldType, options) {
        const localPatterns = await this.getLocalPatterns();
        const questionKeywords = _patternMatcher__WEBPACK_IMPORTED_MODULE_0__.PatternMatcher.extractKeywords(questionText);
        // 1. Try local patterns first
        let match = this.searchPatternsProduction(localPatterns, questionText, questionKeywords, fieldType, options);
        if (match) {
            console.log(`[PatternStorage] ✅ REUSING stored pattern for "${questionText}"`);
            await this.incrementUsage(match.id);
            return match;
        }
        // 2. Try global patterns if no local match
        const globalPatterns = await this.fetchGlobalPatterns();
        match = this.searchPatternsProduction(globalPatterns, questionText, questionKeywords, fieldType, options);
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
    searchPatternsProduction(patterns, questionText, questionKeywords, fieldType, incomingOptions) {
        const qNormalized = _patternMatcher__WEBPACK_IMPORTED_MODULE_0__.PatternMatcher.normalizeQuestion(questionText);
        const isDropdown = fieldType && ['dropdown', 'select', 'dropdown_custom', 'radio'].includes(fieldType);
        let bestMatch = null;
        for (const pattern of patterns) {
            // ✅ VALIDATION 1: Intent must be canonical
            if (!_patternMatcher__WEBPACK_IMPORTED_MODULE_0__.PatternMatcher.isIntentValid(pattern.intent)) {
                console.log(`[PatternStorage] ⚠️ Skipping invalid intent: "${pattern.intent}"`);
                continue;
            }
            // ✅ VALIDATION 2: FieldType compatibility
            if (fieldType && !_patternMatcher__WEBPACK_IMPORTED_MODULE_0__.PatternMatcher.areFieldTypesCompatible(pattern.fieldType, fieldType)) {
                continue;
            }
            // ✅ VALIDATION 3: Question matching
            if (!pattern.questionPattern) {
                console.warn(`[PatternStorage] ⚠️ Pattern missing questionPattern: ${pattern.id}`);
                continue;
            }
            const pNormalized = _patternMatcher__WEBPACK_IMPORTED_MODULE_0__.PatternMatcher.normalizeQuestion(pattern.questionPattern);
            const patternKeywords = _patternMatcher__WEBPACK_IMPORTED_MODULE_0__.PatternMatcher.extractKeywords(pattern.questionPattern);
            let matchScore = 0;
            // Exact normalized match gets highest score
            if (pNormalized === qNormalized) {
                matchScore = 1.0;
            }
            // Keyword overlap (0-1.0)
            else {
                const keywordOverlap = _patternMatcher__WEBPACK_IMPORTED_MODULE_0__.PatternMatcher.calculateKeywordOverlap(questionKeywords, patternKeywords);
                if (keywordOverlap >= 0.7) {
                    matchScore = keywordOverlap;
                }
            }
            // Also check intent-specific keywords
            if (matchScore < 0.7 && _patternMatcher__WEBPACK_IMPORTED_MODULE_0__.PatternMatcher.matchesIntentKeywords(questionKeywords, pattern.intent)) {
                matchScore = 0.75; // Boost score if intent keywords match
            }
            if (matchScore < 0.7)
                continue; // Not a good enough match
            // ✅ VALIDATION 4: Answer usability
            let usableAnswer = null;
            if (isDropdown && incomingOptions) {
                // DROPDOWN: Check if ANY stored answer exists in incoming options
                usableAnswer = this.findDropdownAnswer(pattern, incomingOptions);
            }
            else {
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
            }
            else if (matchScore === bestMatch.score) {
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
    findDropdownAnswer(pattern, incomingOptions) {
        if (!pattern.answerMappings || pattern.answerMappings.length === 0) {
            return null;
        }
        // Collect all stored answers (variants from all mappings)
        const storedAnswers = [];
        for (const mapping of pattern.answerMappings) {
            if (mapping.variants) {
                storedAnswers.push(...mapping.variants);
            }
            if (mapping.canonicalValue) {
                storedAnswers.push(mapping.canonicalValue);
            }
        }
        // Find first match in incoming options
        return _patternMatcher__WEBPACK_IMPORTED_MODULE_0__.PatternMatcher.findBestDropdownMatch(storedAnswers, incomingOptions);
    }
    /**
     * Extract usable text answer with forbidden pattern filtering
     */
    extractUsableAnswer(pattern) {
        if (!pattern.answerMappings || pattern.answerMappings.length === 0) {
            return null;
        }
        for (const mapping of pattern.answerMappings) {
            // Try variants first
            if (mapping.variants) {
                for (const variant of mapping.variants) {
                    if (_patternMatcher__WEBPACK_IMPORTED_MODULE_0__.PatternMatcher.isAnswerUsable(variant)) {
                        return variant;
                    }
                }
            }
            // Try canonical value
            if (mapping.canonicalValue && _patternMatcher__WEBPACK_IMPORTED_MODULE_0__.PatternMatcher.isAnswerUsable(mapping.canonicalValue)) {
                return mapping.canonicalValue;
            }
        }
        return null;
    }
    /**
     * Add new answer variant to existing pattern (for progressive dropdown learning)
     */
    async addAnswerVariant(patternId, newAnswer) {
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
        const normalized = _patternMatcher__WEBPACK_IMPORTED_MODULE_0__.PatternMatcher.normalizeOption(newAnswer);
        const exists = mapping.variants.some(v => _patternMatcher__WEBPACK_IMPORTED_MODULE_0__.PatternMatcher.normalizeOption(v) === normalized);
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
    async incrementUsage(patternId) {
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
    async getStats() {
        const patterns = await this.getLocalPatterns();
        const intentBreakdown = {};
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
    async restorePatterns(email) {
        try {
            console.log(`[PatternStorage] 🔄 Restoring patterns for ${email}...`);
            const result = await proxyFetch(`${AI_SERVICE_URL}/api/patterns/user/${encodeURIComponent(email)}`);
            if (result.success && result.patterns) {
                const dbPatterns = result.patterns;
                console.log(`[PatternStorage] 📥 Received ${dbPatterns.length} patterns from server`);
                const learnedPatterns = dbPatterns.map((p) => ({
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
        }
        catch (error) {
            console.error("[PatternStorage] Restore error:", error);
            return false;
        }
    }
    /**
     * Sync a single pattern to Supabase via AI Service
     */
    async syncPatternToSupabase(pattern) {
        try {
            const profile = await (0,_profileStorage__WEBPACK_IMPORTED_MODULE_1__.loadProfile)();
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
            }
            else {
                console.error("[PatternStorage] ❌ Pattern sync failed:", response?.error || 'Unknown error');
            }
        }
        catch (error) {
            console.warn("[PatternStorage] Pattern sync error:", error);
        }
    }
}
// Singleton instance
const patternStorage = new PatternStorage();


/***/ }

}]);
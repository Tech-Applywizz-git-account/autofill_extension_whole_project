"use strict";
(self["webpackChunkautofill_extension"] = self["webpackChunkautofill_extension"] || []).push([["src_core_storage_patternStorage_ts"],{

/***/ "./src/content/utils/stringUtils.ts"
/*!******************************************!*\
  !*** ./src/content/utils/stringUtils.ts ***!
  \******************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   containsAnyWord: () => (/* binding */ containsAnyWord),
/* harmony export */   normalize: () => (/* binding */ normalize),
/* harmony export */   safeMatch: () => (/* binding */ safeMatch)
/* harmony export */ });
/**
 * Robust string matching utility for autofill
 */
/**
 * Normalizes a string for comparison by lowercasing, trimming,
 * and collapsing whitespace.
 */
function normalize(text) {
    if (text === null || text === undefined)
        return '';
    // Convert to string safely
    let str;
    if (Array.isArray(text)) {
        str = text.join(', ');
    }
    else if (typeof text === 'string') {
        str = text;
    }
    else {
        str = String(text);
    }
    return str
        .toLowerCase()
        .trim()
        .replace(/[?!.,*]/g, '') // Remove common punctuation
        .replace(/\s+/g, ' ') // Collapse multiple spaces
        .trim();
}
/**
 * Performs a "safe" match between a target value (from profile/logic)
 * and a candidate option (from a dropdown/radio).
 */
function safeMatch(target, option) {
    const t = normalize(target);
    const o = normalize(option);
    if (!t || !o)
        return false;
    // 1. Exact match (highest priority)
    if (t === o)
        return true;
    // 2. Negation Check: Prevent matching e.g. "veteran" and "not a veteran"
    const negationWords = ['not', 'no', 'non', 'never', 'none', 'i am not', 'i do not'];
    const targetHasNegation = negationWords.some(w => t.includes(w));
    const optionHasNegation = negationWords.some(w => o.includes(w));
    // If one is negative and the other isn't, they don't match (for EEO/YesNo questions)
    // We only apply this if the strings are relatively short or contains standard EEO keywords
    const isEEOType = (t.includes('veteran') || t.includes('disability') || t.includes('gender') || t.includes('hispanic') || t.includes('race') || t.includes('ethnic') ||
        o.includes('veteran') || o.includes('disability') || o.includes('gender') || o.includes('hispanic') || o.includes('race') || o.includes('ethnic'));
    if (isEEOType && targetHasNegation !== optionHasNegation) {
        return false;
    }
    // 3. Word boundary match
    // This prevents "male" matching "female" 
    try {
        const escapedTarget = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escapedTarget}\\b`, 'i');
        if (regex.test(o)) {
            // Small word protection: "no" should not match "not a veteran" unless strictly matching "no"
            if (t.length <= 2 && o.length > 5) {
                // In EEO context, "No" should match "No I do not have a disability"
                if (isEEOType)
                    return true;
                // Otherwise require exact match or a comma separator (semantic)
                return t === o || o.includes(t + ' ') || o.includes(' ' + t);
            }
            return true;
        }
        // 4. Reverse check for "semantic containment"
        // e.g. target="no disability" and option="no" -> match
        // but only if the option is a clear synonym
        const escapedOption = o.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const reverseRegex = new RegExp(`\\b${escapedOption}\\b`, 'i');
        if (reverseRegex.test(t)) {
            // If option is just "no", and target is "no disability", that's a match
            if (o === 'no' || o === 'yes' || o === 'none')
                return true;
        }
    }
    catch (e) {
        return o.includes(t);
    }
    return false;
}
/**
 * Checks if a string contains any of the provided keywords as whole words.
 */
function containsAnyWord(text, keywords) {
    const normalizedText = normalize(text);
    return keywords.some(kw => {
        const nKw = normalize(kw);
        const regex = new RegExp(`\\b${nKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        return regex.test(normalizedText);
    });
}


/***/ },

/***/ "./src/core/storage/patternMatcher.ts"
/*!********************************************!*\
  !*** ./src/core/storage/patternMatcher.ts ***!
  \********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   PatternMatcher: () => (/* binding */ PatternMatcher)
/* harmony export */ });
/* harmony import */ var _content_utils_stringUtils__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../content/utils/stringUtils */ "./src/content/utils/stringUtils.ts");
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
        if (!answer)
            return false;
        const text = Array.isArray(answer) ? answer.join(', ') : answer;
        if (!text || text.trim() === '')
            return false;
        const normalized = text.toLowerCase().trim();
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
        if (!option)
            return '';
        const text = Array.isArray(option) ? option.join(', ') : option;
        return text
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
        if (Array.isArray(storedAnswer)) {
            // For multi-select, we want to find all options that match any of the stored answers
            const matches = [];
            for (const val of storedAnswer) {
                const match = this.findMatchingOption(val, incomingOptions);
                if (match) {
                    if (Array.isArray(match)) {
                        matches.push(...match);
                    }
                    else {
                        matches.push(match);
                    }
                }
            }
            return matches.length > 0 ? matches : null;
        }
        for (const option of incomingOptions) {
            if ((0,_content_utils_stringUtils__WEBPACK_IMPORTED_MODULE_0__.safeMatch)(storedAnswer, option)) {
                return option; // Return exact or safe word-boundary match
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
                return match; // Return first matching option group
            }
        }
        return null;
    }
}
// ========================================
// CANONICAL INTENT WHITELIST
// ========================================
PatternMatcher.ALLOWED_INTENTS = new Set([
    // 1) Universal
    "eeo.gender", "eeo.race", "eeo.hispanic", "eeo.veteran", "eeo.disability", "eeo.lgbtq", "eeo.transgender", "eeo.preferNotToAnswer",
    "workAuthorization.authorizedUS", "workAuthorization.authorizedCountry", "workAuthorization.needsSponsorship",
    "workAuthorization.needsSponsorshipNow", "workAuthorization.needsSponsorshipFuture", "workAuthorization.citizenshipStatus",
    "workAuthorization.visaType", "workAuthorization.workPermitType", "workAuthorization.workPermitValidUntil",
    "workAuthorization.driverLicense", "workAuthorization.securityClearance", "workAuthorization.securityClearanceLevel",
    "workAuthorization.exportControlEligible",
    "application.workArrangement", "application.workType", "application.shiftAvailability", "application.weekendAvailability",
    "application.nightShiftAvailability", "application.overtimeWillingness", "application.willingToRelocate",
    "application.willingToTravel", "application.travelPercentage",
    "application.startDateAvailability", "application.noticePeriod",
    "application.agreeToTerms", "application.privacyPolicyConsent", "application.dataProcessingConsent",
    "application.backgroundCheckConsent", "application.drugTestConsent", "application.rightToWorkConfirmation",
    "application.equalOpportunityAcknowledgement",
    "application.howDidYouHear", "application.wasReferred", "application.previouslyApplied",
    "application.previouslyInterviewed", "application.previouslyEmployed", "application.hasRelatives",
    "location.country", "location.state", "location.city", "location.postalCode",
    "application.allowSmsMessages", "application.allowEmailUpdates", "application.marketingConsent",
    "application.talentCommunityOptIn",
    "experience.yearsTotal", "experience.managementExperience", "experience.peopleManagement",
    "education.level", "education.degreeType", "education.graduationStatus",
    // 2) Pattern-only
    "personal.firstName", "personal.middleName", "personal.lastName", "personal.fullName",
    "personal.preferredName", "personal.email", "personal.phone", "personal.linkedin",
    "personal.github", "personal.portfolio", "personal.website",
    "personal.addressLine1", "personal.addressLine2", "personal.city", "personal.state",
    "personal.postalCode", "personal.country",
    "documents.resume", "documents.coverLetter", "documents.transcript", "documents.workAuthorizationDocument",
    "education.school", "education.major", "education.gpa", "education.startDate", "education.endDate",
    "experience.company", "experience.title", "experience.startDate", "experience.endDate", "experience.currentlyWorking",
    // 3) Screening
    "screening.whyCompany", "screening.whyRole", "screening.whyYou", "screening.whyChange", "screening.whyNow",
    "screening.aboutYourself", "screening.professionalSummary", "screening.careerGoals",
    "screening.strengths", "screening.weaknesses", "screening.biggestAchievement",
    "screening.leadershipExample", "screening.teamworkExample", "screening.conflictExample", "screening.problemSolved",
    "screening.projectHighlights", "screening.recentProject", "screening.projectChallenge",
    "screening.additionalInfo", "screening.coverLetterLike",
    "preferences.desiredSalary",
    // Fallback
    "unknown",
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
     * Get all patterns (Local + Global)
     */
    async getAllPatterns() {
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
                    const existingMapping = existing.answerMappings.find(m => JSON.stringify(m.canonicalValue) === JSON.stringify(newMapping.canonicalValue));
                    if (existingMapping) {
                        newMapping.variants.forEach(v => {
                            const vStr = JSON.stringify(v);
                            const exists = existingMapping.variants.some(ev => JSON.stringify(ev) === vStr);
                            if (!exists) {
                                existingMapping.variants.push(v);
                            }
                        });
                    }
                    else {
                        existing.answerMappings.push(newMapping);
                    }
                });
            }
            await this.saveLocalPatterns(patterns);
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
        }
    }
    /**
     * Explicitly update an existing pattern
     */
    async updatePattern(patternId, updates) {
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
        // Find match in incoming options
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
    async deletePattern(patternId) {
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
    async deleteAllLocalPatterns() {
        await this.saveLocalPatterns([]);
        console.log('[PatternStorage] ☢️ All local patterns wiped');
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
     * Sync all unsynced patterns to Supabase in a single batch
     */
    async syncUnsyncedPatterns() {
        try {
            const patterns = await this.getLocalPatterns();
            const unsynced = patterns.filter(p => !p.synced);
            if (unsynced.length === 0) {
                console.log("[PatternStorage] ✨ No new patterns to sync");
                return;
            }
            const profile = await (0,_profileStorage__WEBPACK_IMPORTED_MODULE_1__.loadProfile)();
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
            }
            else {
                console.error("[PatternStorage] ❌ Batch sync failed:", response?.error || 'Unknown error');
            }
        }
        catch (error) {
            console.warn("[PatternStorage] Batch sync error:", error);
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
"use strict";
(self["webpackChunkautofill_extension"] = self["webpackChunkautofill_extension"] || []).push([["src_core_storage_aiResponseCache_ts"],{

/***/ "./src/core/storage/aiResponseCache.ts"
/*!*********************************************!*\
  !*** ./src/core/storage/aiResponseCache.ts ***!
  \*********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   clearAllCache: () => (/* binding */ clearAllCache),
/* harmony export */   clearExpiredCache: () => (/* binding */ clearExpiredCache),
/* harmony export */   getAllCached: () => (/* binding */ getAllCached),
/* harmony export */   getCacheStats: () => (/* binding */ getCacheStats),
/* harmony export */   getCachedResponse: () => (/* binding */ getCachedResponse),
/* harmony export */   replaceCache: () => (/* binding */ replaceCache),
/* harmony export */   setCacheExpirationDays: () => (/* binding */ setCacheExpirationDays),
/* harmony export */   setCachedResponse: () => (/* binding */ setCachedResponse)
/* harmony export */ });
/**
 * AI Response Cache
 * Stores AI responses to prevent redundant API calls
 * Uses chrome.storage.local for persistence
 */
// Default: 30 days (will be overridden by user settings)
const DEFAULT_CACHE_EXPIRATION_DAYS = 30;
const CACHE_STORAGE_KEY = 'ai_response_cache';
const CACHE_SETTINGS_KEY = 'ai_cache_settings';
/**
 * Get cache expiration duration from settings
 */
async function getCacheExpirationMs() {
    try {
        const result = await chrome.storage.local.get(CACHE_SETTINGS_KEY);
        const settings = result[CACHE_SETTINGS_KEY] || {};
        const days = settings.cacheExpirationDays || DEFAULT_CACHE_EXPIRATION_DAYS;
        return days * 24 * 60 * 60 * 1000;
    }
    catch (error) {
        console.error('[AICache] Error reading settings, using default:', error);
        return DEFAULT_CACHE_EXPIRATION_DAYS * 24 * 60 * 60 * 1000;
    }
}
/**
 * Update cache expiration setting
 */
async function setCacheExpirationDays(days) {
    try {
        await chrome.storage.local.set({
            [CACHE_SETTINGS_KEY]: { cacheExpirationDays: days }
        });
        console.log(`[AICache] ⚙️ Cache expiration set to ${days} days`);
    }
    catch (error) {
        console.error('[AICache] Error saving settings:', error);
    }
}
/**
 * Generate hash from options array
 * Sorts options before hashing to ensure consistency
 */
function hashOptions(options) {
    if (!options || options.length === 0)
        return undefined;
    // Sort options to ensure consistent hash
    const sorted = [...options].sort((a, b) => a.localeCompare(b));
    // Simple hash function (djb2)
    let hash = 5381;
    const str = sorted.join('|');
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i);
    }
    return hash.toString(36);
}
/**
 * Normalize question text for consistent cache keys
 */
function normalizeQuestion(questionText) {
    return questionText
        .toLowerCase()
        .trim()
        .replace(/[*:?!]/g, '') // Remove special chars
        .replace(/\s+/g, ' '); // Normalize whitespace
}
/**
 * Generate unique cache key
 */
function generateCacheKey(question, fieldType, options) {
    const normalized = normalizeQuestion(question);
    const optHash = hashOptions(options);
    // Create unique key
    return `${normalized}|${fieldType}|${optHash || 'none'}`;
}
/**
 * Get cached response for a question
 * Returns null if not found or expired
 */
async function getCachedResponse(questionText, fieldType, options) {
    try {
        const cacheKey = generateCacheKey(questionText, fieldType, options);
        // Retrieve cache from storage
        const result = await chrome.storage.local.get(CACHE_STORAGE_KEY);
        const cache = result[CACHE_STORAGE_KEY] || {};
        const cached = cache[cacheKey];
        if (!cached) {
            console.log(`[AICache] ❌ Cache miss for "${questionText}"`);
            return null;
        }
        // Get expiration time from settings
        const expirationMs = await getCacheExpirationMs();
        // Check if expired
        const age = Date.now() - cached.timestamp;
        if (age > expirationMs) {
            console.log(`[AICache] ⏰ Cache expired for "${questionText}" (${Math.round(age / (24 * 60 * 60 * 1000))} days old)`);
            // Remove expired entry
            delete cache[cacheKey];
            await chrome.storage.local.set({ [CACHE_STORAGE_KEY]: cache });
            return null;
        }
        console.log(`[AICache] ✅ Cache hit for "${questionText}" (${Math.round(age / (60 * 1000))} minutes old)`);
        return cached;
    }
    catch (error) {
        console.error('[AICache] Error retrieving from cache:', error);
        return null;
    }
}
/**
 * Store AI response in cache
 */
async function setCachedResponse(questionText, fieldType, options, response) {
    try {
        const cacheKey = generateCacheKey(questionText, fieldType, options);
        // Retrieve current cache
        const result = await chrome.storage.local.get(CACHE_STORAGE_KEY);
        const cache = result[CACHE_STORAGE_KEY] || {};
        // Store response
        cache[cacheKey] = {
            answer: response.answer,
            confidence: response.confidence,
            intent: response.intent,
            timestamp: Date.now()
        };
        // Save back to storage
        await chrome.storage.local.set({ [CACHE_STORAGE_KEY]: cache });
        console.log(`[AICache] 💾 Cached response for "${questionText}"`);
    }
    catch (error) {
        console.error('[AICache] Error saving to cache:', error);
    }
}
/**
 * Clear all expired cache entries
 * Call periodically to keep storage clean
 */
async function clearExpiredCache() {
    try {
        const result = await chrome.storage.local.get(CACHE_STORAGE_KEY);
        const cache = result[CACHE_STORAGE_KEY] || {};
        // Get expiration time from settings
        const expirationMs = await getCacheExpirationMs();
        let removedCount = 0;
        const now = Date.now();
        for (const key in cache) {
            const age = now - cache[key].timestamp;
            if (age > expirationMs) {
                delete cache[key];
                removedCount++;
            }
        }
        if (removedCount > 0) {
            await chrome.storage.local.set({ [CACHE_STORAGE_KEY]: cache });
            console.log(`[AICache] 🧹 Removed ${removedCount} expired entries`);
        }
        return removedCount;
    }
    catch (error) {
        console.error('[AICache] Error clearing expired cache:', error);
        return 0;
    }
}
/**
 * Get cache statistics
 */
async function getCacheStats() {
    try {
        const result = await chrome.storage.local.get(CACHE_STORAGE_KEY);
        const cache = result[CACHE_STORAGE_KEY] || {};
        const entries = Object.values(cache);
        const timestamps = entries.map(e => e.timestamp);
        return {
            totalEntries: entries.length,
            oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : 0,
            newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : 0
        };
    }
    catch (error) {
        console.error('[AICache] Error getting cache stats:', error);
        return { totalEntries: 0, oldestEntry: 0, newestEntry: 0 };
    }
}
/**
 * Get all cached responses for backup
 */
async function getAllCached() {
    try {
        const result = await chrome.storage.local.get(CACHE_STORAGE_KEY);
        return result[CACHE_STORAGE_KEY] || {};
    }
    catch (error) {
        console.error('[AICache] Error getting all cached labels:', error);
        return {};
    }
}
/**
 * Replace entire cache (used for restore)
 */
async function replaceCache(cacheData) {
    try {
        await chrome.storage.local.set({ [CACHE_STORAGE_KEY]: cacheData });
        console.log(`[AICache] 📥 Restored ${Object.keys(cacheData).length} cache entries`);
    }
    catch (error) {
        console.error('[AICache] Error replacing cache:', error);
    }
}
/**
 * Clear entire cache (for testing or reset)
 */
async function clearAllCache() {
    try {
        await chrome.storage.local.remove(CACHE_STORAGE_KEY);
        console.log('[AICache] 🗑️ Cleared all cache');
    }
    catch (error) {
        console.error('[AICache] Error clearing cache:', error);
    }
}


/***/ }

}]);
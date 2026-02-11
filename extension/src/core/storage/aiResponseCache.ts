/**
 * AI Response Cache
 * Stores AI responses to prevent redundant API calls
 * Uses chrome.storage.local for persistence
 */

interface CachedResponse {
    answer: string;
    confidence: number;
    intent?: string;
    timestamp: number;
}

interface CacheKey {
    questionNormalized: string;
    fieldType: string;
    optionsHash?: string;
}

// Default: 30 days (will be overridden by user settings)
const DEFAULT_CACHE_EXPIRATION_DAYS = 30;
const CACHE_STORAGE_KEY = 'ai_response_cache';
const CACHE_SETTINGS_KEY = 'ai_cache_settings';

/**
 * Get cache expiration duration from settings
 */
async function getCacheExpirationMs(): Promise<number> {
    try {
        const result = await chrome.storage.local.get(CACHE_SETTINGS_KEY);
        const settings = result[CACHE_SETTINGS_KEY] || {};
        const days = settings.cacheExpirationDays || DEFAULT_CACHE_EXPIRATION_DAYS;
        return days * 24 * 60 * 60 * 1000;
    } catch (error) {
        console.error('[AICache] Error reading settings, using default:', error);
        return DEFAULT_CACHE_EXPIRATION_DAYS * 24 * 60 * 60 * 1000;
    }
}

/**
 * Update cache expiration setting
 */
export async function setCacheExpirationDays(days: number): Promise<void> {
    try {
        await chrome.storage.local.set({
            [CACHE_SETTINGS_KEY]: { cacheExpirationDays: days }
        });
        console.log(`[AICache] ⚙️ Cache expiration set to ${days} days`);
    } catch (error) {
        console.error('[AICache] Error saving settings:', error);
    }
}

/**
 * Generate hash from options array
 * Sorts options before hashing to ensure consistency
 */
function hashOptions(options?: string[]): string | undefined {
    if (!options || options.length === 0) return undefined;

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
function normalizeQuestion(questionText: string): string {
    return questionText
        .toLowerCase()
        .trim()
        .replace(/[*:?!]/g, '') // Remove special chars
        .replace(/\s+/g, ' '); // Normalize whitespace
}

/**
 * Generate unique cache key
 */
function generateCacheKey(question: string, fieldType: string, options?: string[]): string {
    const normalized = normalizeQuestion(question);
    const optHash = hashOptions(options);

    // Create unique key
    return `${normalized}|${fieldType}|${optHash || 'none'}`;
}

/**
 * Get cached response for a question
 * Returns null if not found or expired
 */
export async function getCachedResponse(
    questionText: string,
    fieldType: string,
    options?: string[]
): Promise<CachedResponse | null> {
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

    } catch (error) {
        console.error('[AICache] Error retrieving from cache:', error);
        return null;
    }
}

/**
 * Store AI response in cache
 */
export async function setCachedResponse(
    questionText: string,
    fieldType: string,
    options: string[] | undefined,
    response: { answer: string; confidence: number; intent?: string }
): Promise<void> {
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

    } catch (error) {
        console.error('[AICache] Error saving to cache:', error);
    }
}

/**
 * Clear all expired cache entries
 * Call periodically to keep storage clean
 */
export async function clearExpiredCache(): Promise<number> {
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

    } catch (error) {
        console.error('[AICache] Error clearing expired cache:', error);
        return 0;
    }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{ totalEntries: number; oldestEntry: number; newestEntry: number }> {
    try {
        const result = await chrome.storage.local.get(CACHE_STORAGE_KEY);
        const cache = result[CACHE_STORAGE_KEY] || {};

        const entries = Object.values(cache) as CachedResponse[];
        const timestamps = entries.map(e => e.timestamp);

        return {
            totalEntries: entries.length,
            oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : 0,
            newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : 0
        };

    } catch (error) {
        console.error('[AICache] Error getting cache stats:', error);
        return { totalEntries: 0, oldestEntry: 0, newestEntry: 0 };
    }
}

/**
 * Clear entire cache (for testing or reset)
 */
export async function clearAllCache(): Promise<void> {
    try {
        await chrome.storage.local.remove(CACHE_STORAGE_KEY);
        console.log('[AICache] 🗑️ Cleared all cache');
    } catch (error) {
        console.error('[AICache] Error clearing cache:', error);
    }
}

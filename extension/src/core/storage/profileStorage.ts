import { CanonicalProfile, EMPTY_PROFILE } from "../../types/canonicalProfile";
import { CONFIG } from "../../config";
import { getAllCached } from "./aiResponseCache";

const STORAGE_KEY = "autofill_canonical_profile";
const VERSION_KEY = "autofill_profile_version";
const LEARNED_PATTERNS_KEY = "learnedPatterns";
const CURRENT_VERSION = "1.0.0";
const AI_SERVICE_URL = CONFIG.API.AI_SERVICE; // Or your production URL

/**
 * Helper to perform fetch via background script to bypass CORS and add auth headers
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

/**
 * Sync profile to Supabase via AI Service
 */
async function syncToSupabase(profile: CanonicalProfile): Promise<void> {
    try {
        // Only sync if user has email
        if (!profile.personal.email) {
            console.log("[ProfileStorage] Skipping sync - no email");
            return;
        }

        console.log("[ProfileStorage] 🔄 Syncing profile to AI Service...");

        const aiCache = await getAllCached();

        const response = await proxyFetch(`${AI_SERVICE_URL}/api/user-data/save`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: {
                email: profile.personal.email,
                profile_data: profile,
                ai_cache: aiCache
            },
        });

        console.log("[ProfileStorage] ✅ Profile synced to AI Service");
    } catch (error) {
        console.warn("[ProfileStorage] Sync error (non-fatal):", error);
    }
}

/**
 * Save canonical profile to chrome.storage.local
 */
export async function saveProfile(profile: CanonicalProfile): Promise<void> {
    try {
        console.log("[ProfileStorage] 💾 Saving profile to local storage:", profile.personal.email);
        await chrome.storage.local.set({
            [STORAGE_KEY]: profile,
            [VERSION_KEY]: CURRENT_VERSION,
        });
        console.log("[ProfileStorage] ✅ Profile saved to local storage");

        // Sync to Supabase (await it so we know it finished)
        await syncToSupabase(profile);
    } catch (error) {
        console.error("Failed to save profile:", error);
        throw error;
    }
}

/**
 * Load canonical profile from chrome.storage.local
 */
export async function loadProfile(): Promise<CanonicalProfile | null> {
    try {
        const result = await chrome.storage.local.get([STORAGE_KEY, VERSION_KEY]);

        if (!result[STORAGE_KEY]) {
            return null;
        }

        // Version migration logic can go here in future
        const storedVersion = result[VERSION_KEY] || "1.0.0";

        return result[STORAGE_KEY] as CanonicalProfile;
    } catch (error) {
        console.error("Failed to load profile:", error);
        return null;
    }
}

/**
 * Check if profile exists and is complete
 */
export async function hasCompleteProfile(): Promise<boolean> {
    const profile = await loadProfile();

    if (!profile) return false;

    // Check required fields
    return !!(
        profile.personal.firstName &&
        profile.personal.lastName &&
        profile.personal.email &&
        profile.consent.agreedToAutofill
    );
}

/**
 * Clear profile (for testing or reset)
 */
export async function clearProfile(): Promise<void> {
    await chrome.storage.local.remove([STORAGE_KEY, VERSION_KEY]);
}

/**
 * Export profile as JSON string
 */
export async function exportProfile(): Promise<string> {
    const profile = await loadProfile();
    if (!profile) {
        throw new Error("No profile to export");
    }

    return JSON.stringify(profile, null, 2);
}

/**
 * Import profile from JSON string
 */
export async function importProfile(jsonString: string): Promise<void> {
    try {
        const profile = JSON.parse(jsonString) as CanonicalProfile;

        // Basic validation
        if (!profile.personal || !profile.eeo || !profile.workAuthorization) {
            throw new Error("Invalid profile structure");
        }

        await saveProfile(profile);
    } catch (error) {
        console.error("Failed to import profile:", error);
        throw new Error("Invalid profile JSON");
    }
}

/**
 * Update specific profile field
 */
export async function updateProfileField(
    path: string,
    value: any
): Promise<void> {
    const profile = await loadProfile();
    if (!profile) {
        throw new Error("No profile exists");
    }

    // Navigate to field and update
    const parts = path.split(".");
    let current: any = profile;

    for (let i = 0; i < parts.length - 1; i++) {
        current = current[parts[i]];
    }

    current[parts[parts.length - 1]] = value;

    await saveProfile(profile);
}

/**
 * Restore profile from Supabase via AI Service
 */
export async function restoreProfile(email: string): Promise<CanonicalProfile | null> {
    try {
        console.log(`[ProfileStorage] 🔄 Restoring profile for ${email}...`);
        const result = await proxyFetch(`${AI_SERVICE_URL}/api/user-data/${encodeURIComponent(email)}`);

        if (result && result.profile) {
            let profile = result.profile as any;
            console.log("[ProfileStorage] 📥 Received profile from server:", profile.personal?.email || 'unknown');

            // ROBUST UNWRAPPING: Handle double-wrapping from any previous bugs
            if (profile.profile_data && (profile.email === email || profile.profile_data.personal?.email === email)) {
                console.log("[ProfileStorage] 🛠️ Unwrapping nested profile data");
                profile = profile.profile_data;
            }

            // Save locally
            await chrome.storage.local.set({
                [STORAGE_KEY]: profile,
                [VERSION_KEY]: CURRENT_VERSION,
            });
            console.log("[ProfileStorage] ✅ Profile restored successfully:", profile.personal.email);
            return profile as CanonicalProfile;
        }
        return null;
    } catch (error) {
        console.error("[ProfileStorage] Restore error:", error);
        return null;
    }
}
/**
 * Restore ALL master data from Supabase (Unified)
 */
export async function restoreMasterData(email: string): Promise<{
    profile: CanonicalProfile;
    patterns: any[];
    aiCache: any;
} | null> {
    try {
        console.log(`[ProfileStorage] 🔄 Master restoring all data for ${email}...`);
        const result = await proxyFetch(`${AI_SERVICE_URL}/api/user-data/restore/${encodeURIComponent(email)}`);

        if (result && result.profileData) {
            let profile = result.profileData as any;
            const patterns = (result.patterns || []) as any[];
            const aiCache = result.aiCache || {};

            console.log(`[ProfileStorage] 📥 Master data received: ${patterns.length} patterns, ${Object.keys(aiCache).length} cache entries`);

            // ROBUST UNWRAPPING: Handle double-wrapping from any previous bugs
            if (profile.profile_data && (profile.email === email || profile.profile_data.personal?.email === email)) {
                console.log("[ProfileStorage] 🛠️ Unwrapping nested profile data");
                profile = profile.profile_data;
            }

            // 1. Save Profile
            await chrome.storage.local.set({
                [STORAGE_KEY]: profile,
                [VERSION_KEY]: CURRENT_VERSION,
            });

            // 2. Map and Save Patterns
            // Convert snake_case from DB to camelCase for local storage
            const mappedPatterns = patterns.map(p => ({
                id: p.id,
                questionPattern: p.question_pattern || p.questionPattern,
                intent: p.intent,
                canonicalKey: p.canonical_key || p.canonicalKey || "",
                answerMappings: p.answer_mappings || p.answerMappings || [],
                fieldType: p.field_type || p.fieldType || "text",
                confidence: p.confidence || 1.0,
                usageCount: p.usage_count || p.usageCount || 0,
                lastUsed: p.last_used || p.lastUsed || new Date().toISOString(),
                createdAt: p.created_at || p.createdAt || new Date().toISOString(),
                source: p.source || 'AI',
                synced: true
            }));

            const { patternStorage } = await import("./patternStorage");
            await patternStorage.replaceLocalPatterns(mappedPatterns);

            // 3. Save AI Cache
            const { replaceCache } = await import("./aiResponseCache");
            await replaceCache(aiCache);

            console.log("[ProfileStorage] ✅ Master restore complete for:", email);
            return { profile: profile as CanonicalProfile, patterns: mappedPatterns, aiCache };
        }
        return null;
    } catch (error) {
        console.error("[ProfileStorage] Master restore error:", error);
        return null;
    }
}

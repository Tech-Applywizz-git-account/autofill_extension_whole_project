/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/config/index.ts"
/*!*****************************!*\
  !*** ./src/config/index.ts ***!
  \*****************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   CONFIG: () => (/* binding */ CONFIG)
/* harmony export */ });
/**
 * Centralized Configuration for Extension
 * All configurable values loaded from environment variables
 */
const CONFIG = {
    // API Endpoints
    API: {
        AI_SERVICE: {"REACT_APP_AI_API_KEY":"K3jR9zP2m7B5vW8xL1qN4hT6uS9aZ0cNdiokuhyikl","REACT_APP_AI_RETRIES":"1","REACT_APP_AI_TIMEOUT":"30000","REACT_APP_AI_URL":"https://autofill-extension-backend.onrender.com","REACT_APP_BACKEND_URL":"http://localhost:3000","REACT_APP_DROPDOWN_RETRIES":"2","REACT_APP_DROPDOWN_TIMEOUT":"3000","REACT_APP_FUZZY_THRESHOLD":"0.7","REACT_APP_MIN_CONFIDENCE":"0.6","REACT_APP_PATTERN_MEMORY_CONFIDENCE":"0.95","REACT_APP_PATTERN_SYNC_TIMEOUT":"5000","REACT_APP_PATTERN_URL":"https://autofill-extension-backend.onrender.com/api/patterns","REACT_APP_USER_DATA_URL":"https://autofill-extension-backend.onrender.com/api/user-data","REACT_APP_VERCEL_CRM_URL":"https://ticketingtoolapplywizz.vercel.app/api/get-client-details"}.REACT_APP_AI_URL || 'https://autofill-extension-backend.onrender.com',
        PATTERN_API: {"REACT_APP_AI_API_KEY":"K3jR9zP2m7B5vW8xL1qN4hT6uS9aZ0cNdiokuhyikl","REACT_APP_AI_RETRIES":"1","REACT_APP_AI_TIMEOUT":"30000","REACT_APP_AI_URL":"https://autofill-extension-backend.onrender.com","REACT_APP_BACKEND_URL":"http://localhost:3000","REACT_APP_DROPDOWN_RETRIES":"2","REACT_APP_DROPDOWN_TIMEOUT":"3000","REACT_APP_FUZZY_THRESHOLD":"0.7","REACT_APP_MIN_CONFIDENCE":"0.6","REACT_APP_PATTERN_MEMORY_CONFIDENCE":"0.95","REACT_APP_PATTERN_SYNC_TIMEOUT":"5000","REACT_APP_PATTERN_URL":"https://autofill-extension-backend.onrender.com/api/patterns","REACT_APP_USER_DATA_URL":"https://autofill-extension-backend.onrender.com/api/user-data","REACT_APP_VERCEL_CRM_URL":"https://ticketingtoolapplywizz.vercel.app/api/get-client-details"}.REACT_APP_PATTERN_URL || 'https://autofill-extension-backend.onrender.com/api/patterns',
        USER_DATA: {"REACT_APP_AI_API_KEY":"K3jR9zP2m7B5vW8xL1qN4hT6uS9aZ0cNdiokuhyikl","REACT_APP_AI_RETRIES":"1","REACT_APP_AI_TIMEOUT":"30000","REACT_APP_AI_URL":"https://autofill-extension-backend.onrender.com","REACT_APP_BACKEND_URL":"http://localhost:3000","REACT_APP_DROPDOWN_RETRIES":"2","REACT_APP_DROPDOWN_TIMEOUT":"3000","REACT_APP_FUZZY_THRESHOLD":"0.7","REACT_APP_MIN_CONFIDENCE":"0.6","REACT_APP_PATTERN_MEMORY_CONFIDENCE":"0.95","REACT_APP_PATTERN_SYNC_TIMEOUT":"5000","REACT_APP_PATTERN_URL":"https://autofill-extension-backend.onrender.com/api/patterns","REACT_APP_USER_DATA_URL":"https://autofill-extension-backend.onrender.com/api/user-data","REACT_APP_VERCEL_CRM_URL":"https://ticketingtoolapplywizz.vercel.app/api/get-client-details"}.REACT_APP_USER_DATA_URL || 'https://autofill-extension-backend.onrender.com/api/user-data',
        VERCEL_CRM: {"REACT_APP_AI_API_KEY":"K3jR9zP2m7B5vW8xL1qN4hT6uS9aZ0cNdiokuhyikl","REACT_APP_AI_RETRIES":"1","REACT_APP_AI_TIMEOUT":"30000","REACT_APP_AI_URL":"https://autofill-extension-backend.onrender.com","REACT_APP_BACKEND_URL":"http://localhost:3000","REACT_APP_DROPDOWN_RETRIES":"2","REACT_APP_DROPDOWN_TIMEOUT":"3000","REACT_APP_FUZZY_THRESHOLD":"0.7","REACT_APP_MIN_CONFIDENCE":"0.6","REACT_APP_PATTERN_MEMORY_CONFIDENCE":"0.95","REACT_APP_PATTERN_SYNC_TIMEOUT":"5000","REACT_APP_PATTERN_URL":"https://autofill-extension-backend.onrender.com/api/patterns","REACT_APP_USER_DATA_URL":"https://autofill-extension-backend.onrender.com/api/user-data","REACT_APP_VERCEL_CRM_URL":"https://ticketingtoolapplywizz.vercel.app/api/get-client-details"}.REACT_APP_VERCEL_CRM_URL || 'https://ticketingtoolapplywizz.vercel.app/api/get-client-details',
        BACKEND_URL: {"REACT_APP_AI_API_KEY":"K3jR9zP2m7B5vW8xL1qN4hT6uS9aZ0cNdiokuhyikl","REACT_APP_AI_RETRIES":"1","REACT_APP_AI_TIMEOUT":"30000","REACT_APP_AI_URL":"https://autofill-extension-backend.onrender.com","REACT_APP_BACKEND_URL":"http://localhost:3000","REACT_APP_DROPDOWN_RETRIES":"2","REACT_APP_DROPDOWN_TIMEOUT":"3000","REACT_APP_FUZZY_THRESHOLD":"0.7","REACT_APP_MIN_CONFIDENCE":"0.6","REACT_APP_PATTERN_MEMORY_CONFIDENCE":"0.95","REACT_APP_PATTERN_SYNC_TIMEOUT":"5000","REACT_APP_PATTERN_URL":"https://autofill-extension-backend.onrender.com/api/patterns","REACT_APP_USER_DATA_URL":"https://autofill-extension-backend.onrender.com/api/user-data","REACT_APP_VERCEL_CRM_URL":"https://ticketingtoolapplywizz.vercel.app/api/get-client-details"}.REACT_APP_BACKEND_URL || 'http://localhost:3000',
        STATS_URL: {"REACT_APP_AI_API_KEY":"K3jR9zP2m7B5vW8xL1qN4hT6uS9aZ0cNdiokuhyikl","REACT_APP_AI_RETRIES":"1","REACT_APP_AI_TIMEOUT":"30000","REACT_APP_AI_URL":"https://autofill-extension-backend.onrender.com","REACT_APP_BACKEND_URL":"http://localhost:3000","REACT_APP_DROPDOWN_RETRIES":"2","REACT_APP_DROPDOWN_TIMEOUT":"3000","REACT_APP_FUZZY_THRESHOLD":"0.7","REACT_APP_MIN_CONFIDENCE":"0.6","REACT_APP_PATTERN_MEMORY_CONFIDENCE":"0.95","REACT_APP_PATTERN_SYNC_TIMEOUT":"5000","REACT_APP_PATTERN_URL":"https://autofill-extension-backend.onrender.com/api/patterns","REACT_APP_USER_DATA_URL":"https://autofill-extension-backend.onrender.com/api/user-data","REACT_APP_VERCEL_CRM_URL":"https://ticketingtoolapplywizz.vercel.app/api/get-client-details"}.REACT_APP_AI_URL || 'https://autofill-extension-backend.onrender.com',
        AI_API_KEY: {"REACT_APP_AI_API_KEY":"K3jR9zP2m7B5vW8xL1qN4hT6uS9aZ0cNdiokuhyikl","REACT_APP_AI_RETRIES":"1","REACT_APP_AI_TIMEOUT":"30000","REACT_APP_AI_URL":"https://autofill-extension-backend.onrender.com","REACT_APP_BACKEND_URL":"http://localhost:3000","REACT_APP_DROPDOWN_RETRIES":"2","REACT_APP_DROPDOWN_TIMEOUT":"3000","REACT_APP_FUZZY_THRESHOLD":"0.7","REACT_APP_MIN_CONFIDENCE":"0.6","REACT_APP_PATTERN_MEMORY_CONFIDENCE":"0.95","REACT_APP_PATTERN_SYNC_TIMEOUT":"5000","REACT_APP_PATTERN_URL":"https://autofill-extension-backend.onrender.com/api/patterns","REACT_APP_USER_DATA_URL":"https://autofill-extension-backend.onrender.com/api/user-data","REACT_APP_VERCEL_CRM_URL":"https://ticketingtoolapplywizz.vercel.app/api/get-client-details"}.REACT_APP_AI_API_KEY || '',
    },
    // Timeouts (milliseconds)
    TIMEOUTS: {
        DROPDOWN_SCAN: parseInt({"REACT_APP_AI_API_KEY":"K3jR9zP2m7B5vW8xL1qN4hT6uS9aZ0cNdiokuhyikl","REACT_APP_AI_RETRIES":"1","REACT_APP_AI_TIMEOUT":"30000","REACT_APP_AI_URL":"https://autofill-extension-backend.onrender.com","REACT_APP_BACKEND_URL":"http://localhost:3000","REACT_APP_DROPDOWN_RETRIES":"2","REACT_APP_DROPDOWN_TIMEOUT":"3000","REACT_APP_FUZZY_THRESHOLD":"0.7","REACT_APP_MIN_CONFIDENCE":"0.6","REACT_APP_PATTERN_MEMORY_CONFIDENCE":"0.95","REACT_APP_PATTERN_SYNC_TIMEOUT":"5000","REACT_APP_PATTERN_URL":"https://autofill-extension-backend.onrender.com/api/patterns","REACT_APP_USER_DATA_URL":"https://autofill-extension-backend.onrender.com/api/user-data","REACT_APP_VERCEL_CRM_URL":"https://ticketingtoolapplywizz.vercel.app/api/get-client-details"}.REACT_APP_DROPDOWN_TIMEOUT || '3000', 10),
        AI_REQUEST: parseInt({"REACT_APP_AI_API_KEY":"K3jR9zP2m7B5vW8xL1qN4hT6uS9aZ0cNdiokuhyikl","REACT_APP_AI_RETRIES":"1","REACT_APP_AI_TIMEOUT":"30000","REACT_APP_AI_URL":"https://autofill-extension-backend.onrender.com","REACT_APP_BACKEND_URL":"http://localhost:3000","REACT_APP_DROPDOWN_RETRIES":"2","REACT_APP_DROPDOWN_TIMEOUT":"3000","REACT_APP_FUZZY_THRESHOLD":"0.7","REACT_APP_MIN_CONFIDENCE":"0.6","REACT_APP_PATTERN_MEMORY_CONFIDENCE":"0.95","REACT_APP_PATTERN_SYNC_TIMEOUT":"5000","REACT_APP_PATTERN_URL":"https://autofill-extension-backend.onrender.com/api/patterns","REACT_APP_USER_DATA_URL":"https://autofill-extension-backend.onrender.com/api/user-data","REACT_APP_VERCEL_CRM_URL":"https://ticketingtoolapplywizz.vercel.app/api/get-client-details"}.REACT_APP_AI_TIMEOUT || '30000', 10),
        PATTERN_SYNC: parseInt({"REACT_APP_AI_API_KEY":"K3jR9zP2m7B5vW8xL1qN4hT6uS9aZ0cNdiokuhyikl","REACT_APP_AI_RETRIES":"1","REACT_APP_AI_TIMEOUT":"30000","REACT_APP_AI_URL":"https://autofill-extension-backend.onrender.com","REACT_APP_BACKEND_URL":"http://localhost:3000","REACT_APP_DROPDOWN_RETRIES":"2","REACT_APP_DROPDOWN_TIMEOUT":"3000","REACT_APP_FUZZY_THRESHOLD":"0.7","REACT_APP_MIN_CONFIDENCE":"0.6","REACT_APP_PATTERN_MEMORY_CONFIDENCE":"0.95","REACT_APP_PATTERN_SYNC_TIMEOUT":"5000","REACT_APP_PATTERN_URL":"https://autofill-extension-backend.onrender.com/api/patterns","REACT_APP_USER_DATA_URL":"https://autofill-extension-backend.onrender.com/api/user-data","REACT_APP_VERCEL_CRM_URL":"https://ticketingtoolapplywizz.vercel.app/api/get-client-details"}.REACT_APP_PATTERN_SYNC_TIMEOUT || '5000', 10),
    },
    // Retry Configuration
    RETRIES: {
        DROPDOWN_SCAN: parseInt({"REACT_APP_AI_API_KEY":"K3jR9zP2m7B5vW8xL1qN4hT6uS9aZ0cNdiokuhyikl","REACT_APP_AI_RETRIES":"1","REACT_APP_AI_TIMEOUT":"30000","REACT_APP_AI_URL":"https://autofill-extension-backend.onrender.com","REACT_APP_BACKEND_URL":"http://localhost:3000","REACT_APP_DROPDOWN_RETRIES":"2","REACT_APP_DROPDOWN_TIMEOUT":"3000","REACT_APP_FUZZY_THRESHOLD":"0.7","REACT_APP_MIN_CONFIDENCE":"0.6","REACT_APP_PATTERN_MEMORY_CONFIDENCE":"0.95","REACT_APP_PATTERN_SYNC_TIMEOUT":"5000","REACT_APP_PATTERN_URL":"https://autofill-extension-backend.onrender.com/api/patterns","REACT_APP_USER_DATA_URL":"https://autofill-extension-backend.onrender.com/api/user-data","REACT_APP_VERCEL_CRM_URL":"https://ticketingtoolapplywizz.vercel.app/api/get-client-details"}.REACT_APP_DROPDOWN_RETRIES || '2', 10),
        AI_REQUEST: parseInt({"REACT_APP_AI_API_KEY":"K3jR9zP2m7B5vW8xL1qN4hT6uS9aZ0cNdiokuhyikl","REACT_APP_AI_RETRIES":"1","REACT_APP_AI_TIMEOUT":"30000","REACT_APP_AI_URL":"https://autofill-extension-backend.onrender.com","REACT_APP_BACKEND_URL":"http://localhost:3000","REACT_APP_DROPDOWN_RETRIES":"2","REACT_APP_DROPDOWN_TIMEOUT":"3000","REACT_APP_FUZZY_THRESHOLD":"0.7","REACT_APP_MIN_CONFIDENCE":"0.6","REACT_APP_PATTERN_MEMORY_CONFIDENCE":"0.95","REACT_APP_PATTERN_SYNC_TIMEOUT":"5000","REACT_APP_PATTERN_URL":"https://autofill-extension-backend.onrender.com/api/patterns","REACT_APP_USER_DATA_URL":"https://autofill-extension-backend.onrender.com/api/user-data","REACT_APP_VERCEL_CRM_URL":"https://ticketingtoolapplywizz.vercel.app/api/get-client-details"}.REACT_APP_AI_RETRIES || '1', 10),
    },
    // Confidence Thresholds (0.0 to 1.0)
    THRESHOLDS: {
        MIN_CONFIDENCE: parseFloat({"REACT_APP_AI_API_KEY":"K3jR9zP2m7B5vW8xL1qN4hT6uS9aZ0cNdiokuhyikl","REACT_APP_AI_RETRIES":"1","REACT_APP_AI_TIMEOUT":"30000","REACT_APP_AI_URL":"https://autofill-extension-backend.onrender.com","REACT_APP_BACKEND_URL":"http://localhost:3000","REACT_APP_DROPDOWN_RETRIES":"2","REACT_APP_DROPDOWN_TIMEOUT":"3000","REACT_APP_FUZZY_THRESHOLD":"0.7","REACT_APP_MIN_CONFIDENCE":"0.6","REACT_APP_PATTERN_MEMORY_CONFIDENCE":"0.95","REACT_APP_PATTERN_SYNC_TIMEOUT":"5000","REACT_APP_PATTERN_URL":"https://autofill-extension-backend.onrender.com/api/patterns","REACT_APP_USER_DATA_URL":"https://autofill-extension-backend.onrender.com/api/user-data","REACT_APP_VERCEL_CRM_URL":"https://ticketingtoolapplywizz.vercel.app/api/get-client-details"}.REACT_APP_MIN_CONFIDENCE || '0.6'),
        FUZZY_MATCH: parseFloat({"REACT_APP_AI_API_KEY":"K3jR9zP2m7B5vW8xL1qN4hT6uS9aZ0cNdiokuhyikl","REACT_APP_AI_RETRIES":"1","REACT_APP_AI_TIMEOUT":"30000","REACT_APP_AI_URL":"https://autofill-extension-backend.onrender.com","REACT_APP_BACKEND_URL":"http://localhost:3000","REACT_APP_DROPDOWN_RETRIES":"2","REACT_APP_DROPDOWN_TIMEOUT":"3000","REACT_APP_FUZZY_THRESHOLD":"0.7","REACT_APP_MIN_CONFIDENCE":"0.6","REACT_APP_PATTERN_MEMORY_CONFIDENCE":"0.95","REACT_APP_PATTERN_SYNC_TIMEOUT":"5000","REACT_APP_PATTERN_URL":"https://autofill-extension-backend.onrender.com/api/patterns","REACT_APP_USER_DATA_URL":"https://autofill-extension-backend.onrender.com/api/user-data","REACT_APP_VERCEL_CRM_URL":"https://ticketingtoolapplywizz.vercel.app/api/get-client-details"}.REACT_APP_FUZZY_THRESHOLD || '0.7'),
        PATTERN_MEMORY: parseFloat({"REACT_APP_AI_API_KEY":"K3jR9zP2m7B5vW8xL1qN4hT6uS9aZ0cNdiokuhyikl","REACT_APP_AI_RETRIES":"1","REACT_APP_AI_TIMEOUT":"30000","REACT_APP_AI_URL":"https://autofill-extension-backend.onrender.com","REACT_APP_BACKEND_URL":"http://localhost:3000","REACT_APP_DROPDOWN_RETRIES":"2","REACT_APP_DROPDOWN_TIMEOUT":"3000","REACT_APP_FUZZY_THRESHOLD":"0.7","REACT_APP_MIN_CONFIDENCE":"0.6","REACT_APP_PATTERN_MEMORY_CONFIDENCE":"0.95","REACT_APP_PATTERN_SYNC_TIMEOUT":"5000","REACT_APP_PATTERN_URL":"https://autofill-extension-backend.onrender.com/api/patterns","REACT_APP_USER_DATA_URL":"https://autofill-extension-backend.onrender.com/api/user-data","REACT_APP_VERCEL_CRM_URL":"https://ticketingtoolapplywizz.vercel.app/api/get-client-details"}.REACT_APP_PATTERN_MEMORY_CONFIDENCE || '0.95'),
    },
    // Canonical Field Patterns (for intent detection)
    CANONICAL_PATTERNS: {
        'personal.firstName': ['first name', 'given name', 'fname'],
        'personal.lastName': ['last name', 'surname', 'family name', 'lname'],
        'personal.email': ['email', 'e-mail', 'email address'],
        'personal.phone': ['phone', 'telephone', 'mobile', 'cell'],
        'personal.linkedin': ['linkedin', 'linkedin profile', 'linkedin url'],
        'personal.github': ['github', 'github profile', 'github username'],
        'personal.website': ['website', 'personal website', 'portfolio'],
        'location.city': ['city'],
        'location.state': ['state', 'province'],
        'location.country': ['country'],
        'eeo.gender': ['gender'],
        'eeo.hispanic': ['hispanic', 'latino'],
        'eeo.veteran': ['veteran', 'military'],
        'eeo.disability': ['disability', 'disabled'],
        'eeo.race': ['race', 'ethnicity'],
        'workAuth.sponsorship': ['sponsorship', 'visa sponsorship'],
        'workAuth.usAuthorized': ['authorized', 'legally authorized'],
    },
};


/***/ },

/***/ "./src/core/storage/profileStorage.ts"
/*!********************************************!*\
  !*** ./src/core/storage/profileStorage.ts ***!
  \********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   clearProfile: () => (/* binding */ clearProfile),
/* harmony export */   exportProfile: () => (/* binding */ exportProfile),
/* harmony export */   hasCompleteProfile: () => (/* binding */ hasCompleteProfile),
/* harmony export */   importProfile: () => (/* binding */ importProfile),
/* harmony export */   loadProfile: () => (/* binding */ loadProfile),
/* harmony export */   restoreMasterData: () => (/* binding */ restoreMasterData),
/* harmony export */   restoreProfile: () => (/* binding */ restoreProfile),
/* harmony export */   saveProfile: () => (/* binding */ saveProfile),
/* harmony export */   updateProfileField: () => (/* binding */ updateProfileField)
/* harmony export */ });
/* harmony import */ var _config__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../config */ "./src/config/index.ts");

const STORAGE_KEY = "autofill_canonical_profile";
const VERSION_KEY = "autofill_profile_version";
const LEARNED_PATTERNS_KEY = "learnedPatterns";
const CURRENT_VERSION = "1.0.0";
const AI_SERVICE_URL = _config__WEBPACK_IMPORTED_MODULE_0__.CONFIG.API.AI_SERVICE; // Or your production URL
/**
 * Helper to perform fetch via background script to bypass CORS and add auth headers
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
/**
 * Sync profile to Supabase via AI Service
 */
async function syncToSupabase(profile) {
    try {
        // Only sync if user has email
        if (!profile.personal.email) {
            console.log("[ProfileStorage] Skipping sync - no email");
            return;
        }
        console.log("[ProfileStorage] 🔄 Syncing profile to AI Service...");
        const response = await proxyFetch(`${AI_SERVICE_URL}/api/user-data/save`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: {
                email: profile.personal.email,
                profile_data: profile
            },
        });
        console.log("[ProfileStorage] ✅ Profile synced to AI Service");
    }
    catch (error) {
        console.warn("[ProfileStorage] Sync error (non-fatal):", error);
    }
}
/**
 * Save canonical profile to chrome.storage.local
 */
async function saveProfile(profile) {
    try {
        console.log("[ProfileStorage] 💾 Saving profile to local storage:", profile.personal.email);
        await chrome.storage.local.set({
            [STORAGE_KEY]: profile,
            [VERSION_KEY]: CURRENT_VERSION,
        });
        console.log("[ProfileStorage] ✅ Profile saved to local storage");
        // Sync to Supabase (await it so we know it finished)
        await syncToSupabase(profile);
    }
    catch (error) {
        console.error("Failed to save profile:", error);
        throw error;
    }
}
/**
 * Load canonical profile from chrome.storage.local
 */
async function loadProfile() {
    try {
        const result = await chrome.storage.local.get([STORAGE_KEY, VERSION_KEY]);
        if (!result[STORAGE_KEY]) {
            return null;
        }
        // Version migration logic can go here in future
        const storedVersion = result[VERSION_KEY] || "1.0.0";
        return result[STORAGE_KEY];
    }
    catch (error) {
        console.error("Failed to load profile:", error);
        return null;
    }
}
/**
 * Check if profile exists and is complete
 */
async function hasCompleteProfile() {
    const profile = await loadProfile();
    if (!profile)
        return false;
    // Check required fields
    return !!(profile.personal.firstName &&
        profile.personal.lastName &&
        profile.personal.email &&
        profile.consent.agreedToAutofill);
}
/**
 * Clear profile (for testing or reset)
 */
async function clearProfile() {
    await chrome.storage.local.remove([STORAGE_KEY, VERSION_KEY]);
}
/**
 * Export profile as JSON string
 */
async function exportProfile() {
    const profile = await loadProfile();
    if (!profile) {
        throw new Error("No profile to export");
    }
    return JSON.stringify(profile, null, 2);
}
/**
 * Import profile from JSON string
 */
async function importProfile(jsonString) {
    try {
        const profile = JSON.parse(jsonString);
        // Basic validation
        if (!profile.personal || !profile.eeo || !profile.workAuthorization) {
            throw new Error("Invalid profile structure");
        }
        await saveProfile(profile);
    }
    catch (error) {
        console.error("Failed to import profile:", error);
        throw new Error("Invalid profile JSON");
    }
}
/**
 * Update specific profile field
 */
async function updateProfileField(path, value) {
    const profile = await loadProfile();
    if (!profile) {
        throw new Error("No profile exists");
    }
    // Navigate to field and update
    const parts = path.split(".");
    let current = profile;
    for (let i = 0; i < parts.length - 1; i++) {
        current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = value;
    await saveProfile(profile);
}
/**
 * Restore profile from Supabase via AI Service
 */
async function restoreProfile(email) {
    try {
        console.log(`[ProfileStorage] 🔄 Restoring profile for ${email}...`);
        const result = await proxyFetch(`${AI_SERVICE_URL}/api/user-data/${encodeURIComponent(email)}`);
        if (result && result.profile) {
            let profile = result.profile;
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
            return profile;
        }
        return null;
    }
    catch (error) {
        console.error("[ProfileStorage] Restore error:", error);
        return null;
    }
}
/**
 * Restore ALL master data from Supabase (Unified)
 */
async function restoreMasterData(email) {
    try {
        console.log(`[ProfileStorage] 🔄 Master restoring all data for ${email}...`);
        const result = await proxyFetch(`${AI_SERVICE_URL}/api/user-data/restore/${encodeURIComponent(email)}`);
        if (result && result.profileData) {
            const profile = result.profileData;
            const patterns = result.patterns || [];
            const aiCache = result.aiCache || {};
            console.log(`[ProfileStorage] 📥 Master data received: ${patterns.length} patterns, ${Object.keys(aiCache).length} cache entries`);
            // 1. Save Profile
            await chrome.storage.local.set({
                [STORAGE_KEY]: profile,
                [VERSION_KEY]: CURRENT_VERSION,
            });
            // 2. Save Patterns
            const { patternStorage } = await __webpack_require__.e(/*! import() */ "src_core_storage_patternStorage_ts").then(__webpack_require__.bind(__webpack_require__, /*! ./patternStorage */ "./src/core/storage/patternStorage.ts"));
            await patternStorage.replaceLocalPatterns(patterns);
            // 3. Save AI Cache
            const { replaceCache } = await __webpack_require__.e(/*! import() */ "src_core_storage_aiResponseCache_ts").then(__webpack_require__.bind(__webpack_require__, /*! ./aiResponseCache */ "./src/core/storage/aiResponseCache.ts"));
            await replaceCache(aiCache);
            console.log("[ProfileStorage] ✅ Master restore complete");
            return { profile, patterns, aiCache };
        }
        return null;
    }
    catch (error) {
        console.error("[ProfileStorage] Master restore error:", error);
        return null;
    }
}


/***/ }

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Check if module exists (development only)
/******/ 		if (__webpack_modules__[moduleId] === undefined) {
/******/ 			var e = new Error("Cannot find module '" + moduleId + "'");
/******/ 			e.code = 'MODULE_NOT_FOUND';
/******/ 			throw e;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = __webpack_modules__;
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/ensure chunk */
/******/ 	(() => {
/******/ 		__webpack_require__.f = {};
/******/ 		// This file contains only the entry chunk.
/******/ 		// The chunk loading function for additional chunks
/******/ 		__webpack_require__.e = (chunkId) => {
/******/ 			return Promise.all(Object.keys(__webpack_require__.f).reduce((promises, key) => {
/******/ 				__webpack_require__.f[key](chunkId, promises);
/******/ 				return promises;
/******/ 			}, []));
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/get javascript chunk filename */
/******/ 	(() => {
/******/ 		// This function allow to reference async chunks
/******/ 		__webpack_require__.u = (chunkId) => {
/******/ 			// return url for filenames based on template
/******/ 			return "" + chunkId + ".js";
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/load script */
/******/ 	(() => {
/******/ 		var inProgress = {};
/******/ 		var dataWebpackPrefix = "autofill-extension:";
/******/ 		// loadScript function to load a script via script tag
/******/ 		__webpack_require__.l = (url, done, key, chunkId) => {
/******/ 			if(inProgress[url]) { inProgress[url].push(done); return; }
/******/ 			var script, needAttach;
/******/ 			if(key !== undefined) {
/******/ 				var scripts = document.getElementsByTagName("script");
/******/ 				for(var i = 0; i < scripts.length; i++) {
/******/ 					var s = scripts[i];
/******/ 					if(s.getAttribute("src") == url || s.getAttribute("data-webpack") == dataWebpackPrefix + key) { script = s; break; }
/******/ 				}
/******/ 			}
/******/ 			if(!script) {
/******/ 				needAttach = true;
/******/ 				script = document.createElement('script');
/******/ 		
/******/ 				script.charset = 'utf-8';
/******/ 				if (__webpack_require__.nc) {
/******/ 					script.setAttribute("nonce", __webpack_require__.nc);
/******/ 				}
/******/ 				script.setAttribute("data-webpack", dataWebpackPrefix + key);
/******/ 		
/******/ 				script.src = url;
/******/ 			}
/******/ 			inProgress[url] = [done];
/******/ 			var onScriptComplete = (prev, event) => {
/******/ 				// avoid mem leaks in IE.
/******/ 				script.onerror = script.onload = null;
/******/ 				clearTimeout(timeout);
/******/ 				var doneFns = inProgress[url];
/******/ 				delete inProgress[url];
/******/ 				script.parentNode && script.parentNode.removeChild(script);
/******/ 				doneFns && doneFns.forEach((fn) => (fn(event)));
/******/ 				if(prev) return prev(event);
/******/ 			}
/******/ 			var timeout = setTimeout(onScriptComplete.bind(null, undefined, { type: 'timeout', target: script }), 120000);
/******/ 			script.onerror = onScriptComplete.bind(null, script.onerror);
/******/ 			script.onload = onScriptComplete.bind(null, script.onload);
/******/ 			needAttach && document.head.appendChild(script);
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/publicPath */
/******/ 	(() => {
/******/ 		__webpack_require__.p = "";
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/jsonp chunk loading */
/******/ 	(() => {
/******/ 		// no baseURI
/******/ 		
/******/ 		// object to store loaded and loading chunks
/******/ 		// undefined = chunk not loaded, null = chunk preloaded/prefetched
/******/ 		// [resolve, reject, Promise] = chunk loading, 0 = chunk loaded
/******/ 		var installedChunks = {
/******/ 			"background": 0
/******/ 		};
/******/ 		
/******/ 		__webpack_require__.f.j = (chunkId, promises) => {
/******/ 				// JSONP chunk loading for javascript
/******/ 				var installedChunkData = __webpack_require__.o(installedChunks, chunkId) ? installedChunks[chunkId] : undefined;
/******/ 				if(installedChunkData !== 0) { // 0 means "already installed".
/******/ 		
/******/ 					// a Promise means "currently loading".
/******/ 					if(installedChunkData) {
/******/ 						promises.push(installedChunkData[2]);
/******/ 					} else {
/******/ 						if(true) { // all chunks have JS
/******/ 							// setup Promise in chunk cache
/******/ 							var promise = new Promise((resolve, reject) => (installedChunkData = installedChunks[chunkId] = [resolve, reject]));
/******/ 							promises.push(installedChunkData[2] = promise);
/******/ 		
/******/ 							// start chunk loading
/******/ 							var url = __webpack_require__.p + __webpack_require__.u(chunkId);
/******/ 							// create error before stack unwound to get useful stacktrace later
/******/ 							var error = new Error();
/******/ 							var loadingEnded = (event) => {
/******/ 								if(__webpack_require__.o(installedChunks, chunkId)) {
/******/ 									installedChunkData = installedChunks[chunkId];
/******/ 									if(installedChunkData !== 0) installedChunks[chunkId] = undefined;
/******/ 									if(installedChunkData) {
/******/ 										var errorType = event && (event.type === 'load' ? 'missing' : event.type);
/******/ 										var realSrc = event && event.target && event.target.src;
/******/ 										error.message = 'Loading chunk ' + chunkId + ' failed.\n(' + errorType + ': ' + realSrc + ')';
/******/ 										error.name = 'ChunkLoadError';
/******/ 										error.type = errorType;
/******/ 										error.request = realSrc;
/******/ 										installedChunkData[1](error);
/******/ 									}
/******/ 								}
/******/ 							};
/******/ 							__webpack_require__.l(url, loadingEnded, "chunk-" + chunkId, chunkId);
/******/ 						}
/******/ 					}
/******/ 				}
/******/ 		};
/******/ 		
/******/ 		// no prefetching
/******/ 		
/******/ 		// no preloaded
/******/ 		
/******/ 		// no HMR
/******/ 		
/******/ 		// no HMR manifest
/******/ 		
/******/ 		// no on chunks loaded
/******/ 		
/******/ 		// install a JSONP callback for chunk loading
/******/ 		var webpackJsonpCallback = (parentChunkLoadingFunction, data) => {
/******/ 			var [chunkIds, moreModules, runtime] = data;
/******/ 			// add "moreModules" to the modules object,
/******/ 			// then flag all "chunkIds" as loaded and fire callback
/******/ 			var moduleId, chunkId, i = 0;
/******/ 			if(chunkIds.some((id) => (installedChunks[id] !== 0))) {
/******/ 				for(moduleId in moreModules) {
/******/ 					if(__webpack_require__.o(moreModules, moduleId)) {
/******/ 						__webpack_require__.m[moduleId] = moreModules[moduleId];
/******/ 					}
/******/ 				}
/******/ 				if(runtime) var result = runtime(__webpack_require__);
/******/ 			}
/******/ 			if(parentChunkLoadingFunction) parentChunkLoadingFunction(data);
/******/ 			for(;i < chunkIds.length; i++) {
/******/ 				chunkId = chunkIds[i];
/******/ 				if(__webpack_require__.o(installedChunks, chunkId) && installedChunks[chunkId]) {
/******/ 					installedChunks[chunkId][0]();
/******/ 				}
/******/ 				installedChunks[chunkId] = 0;
/******/ 			}
/******/ 		
/******/ 		}
/******/ 		
/******/ 		var chunkLoadingGlobal = self["webpackChunkautofill_extension"] = self["webpackChunkautofill_extension"] || [];
/******/ 		chunkLoadingGlobal.forEach(webpackJsonpCallback.bind(null, 0));
/******/ 		chunkLoadingGlobal.push = webpackJsonpCallback.bind(null, chunkLoadingGlobal.push.bind(chunkLoadingGlobal));
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
(() => {
/*!*********************************!*\
  !*** ./src/background/index.ts ***!
  \*********************************/
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _core_storage_profileStorage__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../core/storage/profileStorage */ "./src/core/storage/profileStorage.ts");
/* harmony import */ var _config__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../config */ "./src/config/index.ts");
/**
 * Background service worker for Chrome Extension
 * Handles extension lifecycle, messaging, and profile management
 */


// Install/update handler
chrome.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === "install") {
        console.log("[Autofill] Extension installed");
        // Check if profile exists
        const hasProfile = await (0,_core_storage_profileStorage__WEBPACK_IMPORTED_MODULE_0__.hasCompleteProfile)();
        if (!hasProfile) {
            // Open onboarding page
            chrome.tabs.create({
                url: chrome.runtime.getURL("onboarding.html"),
            });
        }
    }
    if (details.reason === "update") {
        console.log("[Autofill] Extension updated");
    }
});
// Handle extension icon click
chrome.action.onClicked.addListener(async (tab) => {
    // Open settings/options page
    chrome.runtime.openOptionsPage();
});
// Handle messages from content scripts or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "checkProfile") {
        (0,_core_storage_profileStorage__WEBPACK_IMPORTED_MODULE_0__.hasCompleteProfile)().then((exists) => {
            sendResponse({ exists });
        });
        return true; // Async response
    }
    if (message.action === "getProfile") {
        (0,_core_storage_profileStorage__WEBPACK_IMPORTED_MODULE_0__.loadProfile)().then((profile) => {
            sendResponse({ profile });
        });
        return true;
    }
    if (message.action === "openOnboarding") {
        chrome.tabs.create({
            url: chrome.runtime.getURL("onboarding.html"),
        });
        sendResponse({ success: true });
        return false;
    }
    if (message.action === "trustedClick") {
        handleTrustedClick(sender.tab?.id, message.x, message.y).then(sendResponse);
        return true;
    }
    if (message.action === "trustedType") {
        handleTrustedType(sender.tab?.id, message.text).then(sendResponse);
        return true;
    }
    if (message.action === "runSelenium") {
        const aiUrl = _config__WEBPACK_IMPORTED_MODULE_1__.CONFIG.API.AI_SERVICE;
        fetch(`${aiUrl}/run`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': _config__WEBPACK_IMPORTED_MODULE_1__.CONFIG.API.AI_API_KEY
            },
            body: JSON.stringify(message.plan)
        })
            .then(async (res) => {
            const text = await res.text();
            console.log('[Background] Selenium response status:', res.status);
            console.log('[Background] Selenium response body:', text);
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${text.substring(0, 200)}`);
            }
            try {
                const data = JSON.parse(text);
                sendResponse({ success: true, data });
            }
            catch (e) {
                throw new Error(`Invalid JSON response: ${text.substring(0, 200)}`);
            }
        })
            .catch(err => {
            console.error('[Background] Selenium error:', err);
            sendResponse({ success: false, error: err.message });
        });
        return true;
    }
    if (message.action === "askAI") {
        handleAIRequest(message.payload).then(sendResponse);
        return true;
    }
    if (message.action === "scanApplication") {
        handleScanApplication(message.url).then(sendResponse);
        return true;
    }
    if (message.action === "mapAnswers") {
        handleMapAnswers(message.questions).then(sendResponse);
        return true;
    }
    if (message.action === "BROADCAST_SCAN") {
        handleBroadcastScan(sender.tab?.id).then(sendResponse);
        return true;
    }
    if (message.action === "BROADCAST_AUTOFILL") {
        handleBroadcastAutofill(sender.tab?.id, message.payload).then(sendResponse);
        return true;
    }
    // Production scan-and-fill architecture
    if (message.action === "START_AUTOFILL") {
        handleStartAutofill(message.payload).then(sendResponse);
        return true;
    }
    if (message.action === "FIELD_FILL_FAILED") {
        handleFieldFillFailed(message.payload).then(sendResponse);
        return true;
    }
    if (message.action === "REPORT_AUTOFILL_COMPLETE") {
        // Relay to the top frame of the same tab
        if (sender.tab?.id) {
            chrome.tabs.sendMessage(sender.tab.id, {
                type: "AUTOFILL_COMPLETE_RELAY",
                payload: {
                    ...message.payload,
                    frameId: sender.frameId // Attach frame ID of the reporter
                }
            }, { frameId: 0 }).catch(err => {
                console.warn("[Background] Failed to relay completion to top frame:", err.message);
            });
        }
        sendResponse({ success: true });
        return false;
    }
    if (message.action === "FIELD_FILL_PROGRESS") {
        // Relay progress back to top frame (0)
        if (sender.tab?.id) {
            chrome.tabs.sendMessage(sender.tab.id, {
                type: "FIELD_FILL_PROGRESS_RELAY",
                payload: {
                    ...message.payload,
                    frameId: sender.frameId
                }
            }, { frameId: 0 }).catch(() => { });
        }
        sendResponse({ success: true });
        return false;
    }
    if (message.action === "proxyFetch") {
        const { url, options } = message;
        // Ensure body is stringified if it's an object
        if (options.body && typeof options.body === 'object') {
            options.body = JSON.stringify(options.body);
        }
        const apiKey = _config__WEBPACK_IMPORTED_MODULE_1__.CONFIG.API.AI_API_KEY || '';
        console.log(`[Background] 🛠️ proxyFetch: ${options.method || 'GET'} ${url}`);
        console.log(`[Background] 🔑 API Key Status: ${apiKey ? `Present (${apiKey.substring(0, 3)}...)` : 'MISSING'}`);
        // Add API Key to headers if not present
        const fetchOptions = {
            ...options,
            headers: {
                ...(options.headers || {}),
                'X-API-Key': apiKey
            }
        };
        fetch(url, fetchOptions)
            .then(async (res) => {
            const contentType = res.headers.get("content-type");
            let data;
            if (contentType && contentType.includes("application/json")) {
                data = await res.json();
            }
            else {
                data = { message: await res.text() };
            }
            console.log(`[Background] 📡 proxyFetch Response: ${res.status}`);
            if (res.ok) {
                sendResponse({ success: true, data, status: res.status });
            }
            else {
                console.error(`[Background] ❌ proxyFetch Failed (${res.status}):`, data);
                sendResponse({
                    success: false,
                    error: data.detail || data.message || `HTTP ${res.status}`,
                    status: res.status
                });
            }
        })
            .catch((err) => {
            console.error("[Background] ❌ proxyFetch Network Error:", err);
            sendResponse({ success: false, error: err.message });
        });
        return true;
    }
    return false;
});
/**
 * Forward resolved answers to active tab content script for filling
 */
async function handleStartAutofill(payload) {
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs[0]?.id) {
            throw new Error('No active tab found');
        }
        console.log('[Background] Forwarding START_AUTOFILL to tab', tabs[0].id);
        const response = await chrome.tabs.sendMessage(tabs[0].id, {
            type: 'START_AUTOFILL',
            payload
        });
        return { success: true, data: response };
    }
    catch (error) {
        console.error("[Background] START_AUTOFILL Error:", error);
        return { success: false, error: error.message };
    }
}
/**
 * Handle field fill failures - optionally trigger Selenium fallback for specific field
 */
async function handleFieldFillFailed(payload) {
    try {
        console.log('[Background] Field fill failed:', payload);
        // Optional: Call Selenium fallback for this specific field
        // For now, just log it
        // Future: POST /fallback-fill with field details
        return { success: true, noted: true };
    }
    catch (error) {
        console.error("[Background] FIELD_FILL_FAILED Error:", error);
        return { success: false, error: error.message };
    }
}
/**
 * Pending AI requests to deduplicate simultaneous calls
 */
const pendingAIRequests = new Map();
/**
 * Handle AI request
 */
async function handleAIRequest(payload) {
    try {
        // Generate a unique key for deduplication
        const cacheKey = `${payload.question}|${payload.fieldType}|${payload.options?.sort().join(',') || 'none'}`;
        // If a request for this question is already in flight, return the existing promise
        if (pendingAIRequests.has(cacheKey)) {
            console.log(`[Background] 🔄 Deduplicating simultaneous AI request for: "${payload.question}"`);
            return pendingAIRequests.get(cacheKey);
        }
        // Create the new request promise
        const requestPromise = (async () => {
            const aiUrl = _config__WEBPACK_IMPORTED_MODULE_1__.CONFIG.API.AI_SERVICE;
            const response = await fetch(`${aiUrl}/predict`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': _config__WEBPACK_IMPORTED_MODULE_1__.CONFIG.API.AI_API_KEY
                },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`AI prediction failed (${response.status}): ${errorText}`);
            }
            const data = await response.json();
            return { success: true, data };
        })();
        // Store in pending map
        pendingAIRequests.set(cacheKey, requestPromise);
        try {
            const result = await requestPromise;
            return result;
        }
        finally {
            // Cleanup when done
            pendingAIRequests.delete(cacheKey);
        }
    }
    catch (error) {
        console.error("[Background] AI Request Error:", error);
        return { success: false, error: error.message };
    }
}
/**
 * Cache for scan results to prevent repeated scans
 */
const scanCache = new Map();
const SCAN_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
/**
 * Handle scan application requests by calling Selenium scanner
 */
async function handleScanApplication(url) {
    try {
        // Check cache first (Issue #4: prevent repeated scans)
        const cached = scanCache.get(url);
        if (cached && (Date.now() - cached.timestamp) < SCAN_CACHE_DURATION) {
            console.log('[Background] ⚡ Using cached scan results for:', url);
            return { success: true, data: cached.data };
        }
        console.log('[Background] Triggering Selenium scan for:', url);
        const aiUrl = _config__WEBPACK_IMPORTED_MODULE_1__.CONFIG.API.AI_SERVICE;
        const response = await fetch(`${aiUrl}/api/selenium/scan`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': _config__WEBPACK_IMPORTED_MODULE_1__.CONFIG.API.AI_API_KEY
            },
            body: JSON.stringify({ url })
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Scan failed (${response.status}): ${errorText}`);
        }
        const data = await response.json();
        console.log('[Background] Scan complete:', data);
        // Cache the scan result
        scanCache.set(url, { data: data.data, timestamp: Date.now() });
        console.log('[Background] ✅ Scan cached for 5 minutes');
        return { success: true, data: data.data };
    }
    catch (error) {
        console.error("[Background] Scan Error:", error);
        return { success: false, error: error.message };
    }
}
/**
 * Handle answer mapping by delegating to content script
 */
async function handleMapAnswers(questions) {
    try {
        console.log('[Background] Processing', questions.length, 'questions through mapper');
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs[0]?.id) {
            throw new Error('No active tab found');
        }
        const response = await chrome.tabs.sendMessage(tabs[0].id, {
            action: 'processQuestions',
            questions
        }, { frameId: 0 });
        return response;
    }
    catch (error) {
        console.error("[Background] Mapping Error:", error);
        return { success: false, error: error.message };
    }
}
/**
 * CDP Trusted Click Implementation
 */
async function handleTrustedClick(tabId, x, y) {
    if (!tabId)
        return { success: false, error: "No tab ID" };
    const target = { tabId };
    try {
        await chrome.debugger.attach(target, "1.3");
        // Mouse Press
        await chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", {
            type: "mousePressed",
            x, y,
            button: "left",
            clickCount: 1
        });
        // Mouse Release
        await chrome.debugger.sendCommand(target, "Input.dispatchMouseEvent", {
            type: "mouseReleased",
            x, y,
            button: "left",
            clickCount: 1
        });
        await chrome.debugger.detach(target);
        return { success: true };
    }
    catch (e) {
        console.error("[Debugger] Click failed", e);
        try {
            await chrome.debugger.detach(target);
        }
        catch { }
        return { success: false, error: e.message };
    }
}
/**
 * CDP Trusted Type Implementation
 */
async function handleTrustedType(tabId, text) {
    if (!tabId)
        return { success: false, error: "No tab ID" };
    const target = { tabId };
    try {
        await chrome.debugger.attach(target, "1.3");
        for (const char of text) {
            await chrome.debugger.sendCommand(target, "Input.dispatchKeyEvent", {
                type: "keyDown",
                text: char,
            });
            await chrome.debugger.sendCommand(target, "Input.dispatchKeyEvent", {
                type: "keyUp",
                text: char,
            });
        }
        await chrome.debugger.detach(target);
        return { success: true };
    }
    catch (e) {
        console.error("[Debugger] Type failed", e);
        try {
            await chrome.debugger.detach(target);
        }
        catch { }
        return { success: false, error: e.message };
    }
}
// Listen for tab updates to inject content script if needed
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete" && tab.url) {
        // Check if this is a job application site
        const isJobSite = await isJobApplicationSite(tab.url);
        if (isJobSite) {
            // Content script is already injected via manifest
            // but we can send a message to trigger rescan
            try {
                await chrome.tabs.sendMessage(tabId, { action: "rescan" });
            }
            catch (error) {
                // Content script might not be ready yet, ignore
            }
        }
    }
});
/**
 * Detect if URL is likely a job application site
 */
async function isJobApplicationSite(url) {
    const jobSitePatterns = [
        /workday\.com/i,
        /greenhouse\.io/i,
        /lever\.co/i,
        /icims\.com/i,
        /smartrecruiters\.com/i,
        /jobvite\.com/i,
        /taleo\.net/i,
        /apply/i,
        /careers/i,
        /jobs/i,
    ];
    return jobSitePatterns.some((pattern) => pattern.test(url));
}
/**
 * Broadcast scan request to all frames in the tab and aggregate results
 */
async function handleBroadcastScan(tabId) {
    if (!tabId)
        return { success: false, error: "No tab ID" };
    try {
        console.log(`[Background] 🔍 Broadcasting scan to all frames in tab ${tabId}`);
        // Get all frames in the tab
        const frames = await chrome.webNavigation.getAllFrames({ tabId });
        if (!frames) {
            console.warn(`[Background] ⚠️ No frames found for tab ${tabId}`);
            return { success: true, questions: [] };
        }
        console.log(`[Background] 🔍 Found ${frames.length} frames`);
        const scanPromises = frames.map(frame => chrome.tabs.sendMessage(tabId, { action: 'PERFORM_SCAN' }, { frameId: frame.frameId })
            .catch(err => {
            console.warn(`[Background] ⚠️ Frame ${frame.frameId} scan failed:`, err.message);
            return null;
        }));
        const results = await Promise.all(scanPromises);
        // Aggregate questions from all successful frame scans
        const allQuestions = results
            .filter(r => r && r.success && Array.isArray(r.questions))
            .flatMap(r => r.questions);
        // Aggregate navigation buttons
        const allNavButtons = results
            .filter(r => r && r.success && Array.isArray(r.navigationButtons))
            .flatMap(r => r.navigationButtons);
        // Determine if multi-page (if any frame is multi-page)
        const isMultiPage = results.some(r => r && r.success && r.pageType === 'multi');
        // Get IDs of frames that actually found fields (active frames)
        const activeFrameIds = results
            .map((r, i) => (r && r.success && Array.isArray(r.questions) && r.questions.length > 0) ? frames[i].frameId : null)
            .filter(id => id !== null);
        console.log(`[Background] ✅ Aggregated ${allQuestions.length} questions. Page type: ${isMultiPage ? 'multi' : 'single'}`);
        return {
            success: true,
            questions: allQuestions,
            activeFrameIds,
            pageType: isMultiPage ? 'multi' : 'single',
            navigationButtons: Array.from(new Set(allNavButtons)) // Deduplicate
        };
    }
    catch (error) {
        console.error("[Background] Broadcast Scan Error:", error);
        return { success: false, error: error.message };
    }
}
/**
 * Broadcast autofill request to all frames in the tab
 */
async function handleBroadcastAutofill(tabId, payload) {
    if (!tabId)
        return { success: false, error: "No tab ID" };
    try {
        console.log(`[Background] 🚀 Broadcasting autofill to all frames in tab ${tabId}`);
        const frames = await chrome.webNavigation.getAllFrames({ tabId });
        if (!frames) {
            console.warn(`[Background] ⚠️ No frames found for tab ${tabId}`);
            return { success: true };
        }
        const fillPromises = frames.map(frame => chrome.tabs.sendMessage(tabId, { action: 'START_AUTOFILL', payload }, { frameId: frame.frameId })
            .catch(err => {
            console.warn(`[Background] ⚠️ Frame ${frame.frameId} fill failed:`, err.message);
            return null;
        }));
        await Promise.all(fillPromises);
        return { success: true };
    }
    catch (error) {
        console.error("[Background] Broadcast Autofill Error:", error);
        return { success: false, error: error.message };
    }
}
console.log("[Autofill] Background service worker loaded");

})();

/******/ })()
;
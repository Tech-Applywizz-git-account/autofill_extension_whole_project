/**
 * Centralized Configuration for Extension
 * All configurable values loaded from environment variables
 */

export const CONFIG = {
    // API Endpoints
    API: {
        AI_SERVICE: process.env.REACT_APP_AI_URL || 'https://only-ai-service-folder-autofill-extesnion.onrender.com',
        PATTERN_API: process.env.REACT_APP_PATTERN_URL || 'https://only-ai-service-folder-autofill-extesnion.onrender.com/api/patterns',
        USER_DATA: process.env.REACT_APP_USER_DATA_URL || 'https://only-ai-service-folder-autofill-extesnion.onrender.com/api/user-data',
        VERCEL_CRM: process.env.REACT_APP_VERCEL_CRM_URL || 'https://ticketingtoolapplywizz.vercel.app/api/get-client-details',
    },

    // Timeouts (milliseconds)
    TIMEOUTS: {
        DROPDOWN_SCAN: parseInt(process.env.REACT_APP_DROPDOWN_TIMEOUT || '3000', 10),
        AI_REQUEST: parseInt(process.env.REACT_APP_AI_TIMEOUT || '30000', 10),
        PATTERN_SYNC: parseInt(process.env.REACT_APP_PATTERN_SYNC_TIMEOUT || '5000', 10),
    },

    // Retry Configuration
    RETRIES: {
        DROPDOWN_SCAN: parseInt(process.env.REACT_APP_DROPDOWN_RETRIES || '2', 10),
        AI_REQUEST: parseInt(process.env.REACT_APP_AI_RETRIES || '1', 10),
    },

    // Confidence Thresholds (0.0 to 1.0)
    THRESHOLDS: {
        MIN_CONFIDENCE: parseFloat(process.env.REACT_APP_MIN_CONFIDENCE || '0.6'),
        FUZZY_MATCH: parseFloat(process.env.REACT_APP_FUZZY_THRESHOLD || '0.7'),
        PATTERN_MEMORY: parseFloat(process.env.REACT_APP_PATTERN_MEMORY_CONFIDENCE || '0.95'),
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
    } as const,
} as const;

// Type exports for TypeScript
export type ApiEndpoint = keyof typeof CONFIG.API;
export type TimeoutType = keyof typeof CONFIG.TIMEOUTS;
export type RetryType = keyof typeof CONFIG.RETRIES;
export type ThresholdType = keyof typeof CONFIG.THRESHOLDS;

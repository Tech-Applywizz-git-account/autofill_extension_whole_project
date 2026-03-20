/**
 * HARDCODED ANSWER ENGINE v1.1
 * ============================
 *
 * Directly resolves 100+ commonly repeated job platform questions
 * from the user profile WITHOUT any AI calls, fuzzy matching, or learned patterns.
 *
 * Philosophy:
 *   If we know the question pattern AND we know where the answer is in the profile,
 *   we should ALWAYS answer it deterministically. No AI needed.
 *
 * Structure:
 *   Each rule has:
 *     - patterns[]      : lowercase substrings that identify this question
 *     - excludes[]      : substrings that DISQUALIFY this match (prevents false positives)
 *     - resolver()      : function that returns the answer from profile + options
 *
 * Usage:
 *   import { resolveHardcoded } from './hardcodedAnswerEngine';
 *   const answer = resolveHardcoded(questionText, fieldType, options, profile);
 *   if (answer !== null) { /* use it directly — no AI needed *\/ }
 */

export interface HardcodedResult {
    answer: string | string[];
    intent: string;
    confidence: number;
}

type Resolver = (profile: any, options?: string[]) => string | string[] | null;

interface HardcodedRule {
    patterns: string[];
    excludes?: string[];
    intent: string;
    resolver: Resolver;
}

import { safeMatch } from '../utils/stringUtils';
import { FieldType } from '../../types/fieldDetection';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// DATA & SYNONYMS
// ─────────────────────────────────────────────────────────────────────────────

export const HARDCODED_SYNONYMS: Record<string, string[]> = {
    'yes': ['y', 'true', 'i do', 'authorized', 'i am', 'i can', 'of course', 'affirm', 'confirm'],
    'no': ['n', 'false', 'i do not', "i don't", 'not authorized', 'i am not', 'i cannot', 'none',
        'i have not', 'i have no', 'i did not', 'i do not have'],
    'male': ['man', 'cisgender male', 'cis male', 'm'],
    'female': ['woman', 'cisgender female', 'cis female', 'f'],
    'non-binary': ['nonbinary', 'genderqueer', 'gender non-conforming', 'gender non-binary'],
    'prefer not to say': ['decline to self-identify', 'decline to state', 'prefer not to answer',
        'prefer not to disclose', 'i prefer not to answer', 'choose not to disclose',
        'rather not say', 'no response'],
    'south asian': ['asian (not hispanic or latino)', 'asian', 'asian indian',
        'asian/pacific islander', 'south asian or east asian'],
    'not a veteran': ['i am not a protected veteran', 'i am not a veteran', 'not a veteran',
        'not applicable', 'none of the above', 'no military service'],
    'no disability': ['i do not have a disability', 'no, i do not have a disability',
        'i don\'t have a disability', 'no disability'],
    'mobile': ['phone', 'cell phone', 'cellular', 'mobile device', 'personal phone'],
    // US State Mappings
    'alabama': ['al'], 'alaska': ['ak'], 'arizona': ['az'], 'arkansas': ['ar'], 'california': ['ca', 'calif'],
    'colorado': ['co'], 'connecticut': ['ct'], 'delaware': ['de'], 'florida': ['fl'], 'georgia': ['ga'],
    'hawaii': ['hi'], 'idaho': ['id'], 'illinois': ['il'], 'indiana': ['in'], 'iowa': ['ia'],
    'kansas': ['ks'], 'kentucky': ['ky'], 'louisiana': ['la'], 'maine': ['me'], 'maryland': ['md'],
    'massachusetts': ['ma'], 'michigan': ['mi'], 'minnesota': ['mn'], 'mississippi': ['ms'], 'missouri': ['mo'],
    'montana': ['mt'], 'nebraska': ['ne'], 'nevada': ['nv'], 'new hampshire': ['nh'], 'new jersey': ['nj'],
    'new mexico': ['nm'], 'new york': ['ny'], 'north carolina': ['nc'], 'north dakota': ['nd'], 'ohio': ['oh'],
    'oklahoma': ['ok'], 'oregon': ['or'], 'pennsylvania': ['pa', 'penn'], 'rhode island': ['ri'], 'south carolina': ['sc'],
    'south dakota': ['sd'], 'tennessee': ['tn'], 'texas': ['tx'], 'utah': ['ut'], 'vermont': ['vt'],
    'virginia': ['va'], 'washington': ['wa'], 'west virginia': ['wv'], 'wisconsin': ['wi'], 'wyoming': ['wy'],
};

function matchOption(value: any, options?: string[]): string | null {
    if (!options || options.length === 0) return value !== null && value !== undefined ? String(value) : null;

    const v = String(value).toLowerCase().trim();

    // Truth-Awareness: Detect if we are dealing with a clear YES/NO intent (supports sentences)
    const isNoIntent = v === 'no' || v === 'false' || value === false ||
        v.startsWith('no,') || v.includes("don't have") || v.includes("do not have") ||
        (v.includes("no") && v.includes("disability") && (v.includes("don't") || v.includes("not")));

    const isYesIntent = v === 'yes' || v === 'true' || value === true || v.startsWith('yes,');

    // 1. Exact match
    const exact = options.find(o => o.toLowerCase().trim() === v);
    if (exact) return exact;

    // 2. Truth-Filtered matching: Ensure No-intents don't match Yes-options
    const filteredOptions = options.filter(o => {
        const ol = o.toLowerCase().trim();
        // Neutral options are always safe
        if (ol.includes('prefer not') || ol.includes('decline') || ol === 'n/a' || ol === 'none') return true;

        if (isNoIntent) {
            // Exclude anything that looks like a "Yes"
            if (ol.startsWith('yes') || ol.includes('i do') || ol === 'y' || ol === 'true' || ol === 'affirm') return false;
        }
        if (isYesIntent) {
            // Exclude anything that looks like a "No"
            if (ol.startsWith('no') || ol.includes("don't") || ol.includes("not") || ol === 'false' || ol === 'n') return false;
        }
        return true;
    });

    // 3. Synonym map (STRICT)
    for (const [key, syns] of Object.entries(HARDCODED_SYNONYMS)) {
        if (v === key || syns.includes(v)) {
            // Find an option that matches the synonym key or any of its synonyms
            const match = filteredOptions.find(o => {
                if (safeMatch(key, o)) return true;
                return syns.some(s => safeMatch(s, o));
            });
            if (match) return match;
        }
    }

    // 4. Safe partial match (word-boundary aware)
    if (v.length >= 3) {
        const partial = filteredOptions.find(o => safeMatch(v, o));
        if (partial) return partial;
    }

    // 5. Word-level SPECIFICITY scoring (excluding generic terms)
    const GENERIC_WORDS = new Set([
        'university', 'college', 'school', 'institute',
        'national', 'international', 'global', 'solutions', 'systems',
        'company', 'corporation', 'inc', 'llc', 'dept', 'department',
        'state', 'the', 'and', 'of', 'in', 'for', 'with', 'a', 'an'
    ]);

    const words = v.split(/[\s,.-]+/).filter(w => w.length >= 3 && !GENERIC_WORDS.has(w));
    if (words.length === 0) return null;

    let bestMatch: string | null = null;
    let maxMatchedWords = 0;

    for (const opt of filteredOptions) {
        const ol = opt.toLowerCase();
        const matchedCount = words.filter(w => {
            if (ol.includes(w)) return true;
            if (w.endsWith('s') && ol.includes(w.slice(0, -1))) return true;
            if (!w.endsWith('s') && ol.includes(w + 's')) return true;
            return false;
        }).length;

        if (matchedCount > maxMatchedWords) {
            maxMatchedWords = matchedCount;
            bestMatch = opt;
        } else if (matchedCount === maxMatchedWords && matchedCount > 0 && bestMatch) {
            if (opt.length < bestMatch.length) {
                bestMatch = opt;
            }
        }
    }

    const matchRatio = maxMatchedWords / words.length;
    if (bestMatch && (matchRatio >= 0.5 || maxMatchedWords >= 2)) {
        console.log(`[HardcodedEngine] 🎯 Specificity match: "${v}" -> "${bestMatch}" (${maxMatchedWords}/${words.length} words matched)`);
        return bestMatch;
    }

    return null;
}

/** Produce Yes or No answer, matching against dropdown options. */
function yesNo(value: boolean, options?: string[], textFieldFallback: string = 'No'): string {
    const raw = value ? 'Yes' : (textFieldFallback || 'No');
    if (!options || options.length === 0) return raw;

    if (value) {
        return options.find(o => {
            const l = o.toLowerCase().trim();
            return (l === 'yes' || l === 'y' || l === 'true' || l === 'i do' || l.startsWith('yes,')) && !l.includes('no');
        }) || 'Yes';
    } else {
        return options.find(o => {
            const l = o.toLowerCase().trim();
            return (l === 'no' || l === 'n' || l === 'false' || l === 'i do not' || l.startsWith('no,')) && !l.includes('yes');
        }) || (textFieldFallback || 'No');
    }
}

/** Parse a date string like "2024-05" → { year: "2024", month: "May" } */
function parseDate(date?: string): { year: string; month: string } | null {
    if (!date) return null;
    const parts = date.split('-');
    if (parts.length < 1) return null;
    const year = parts[0];
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    const month = parts[1] ? months[parseInt(parts[1], 10) - 1] || parts[1] : '';
    return { year, month };
}

// ─────────────────────────────────────────────────────────────────────────────
// RULE DEFINITIONS  (ordered: most specific first)
// ─────────────────────────────────────────────────────────────────────────────

export const HARDCODED_RULES: HardcodedRule[] = [

    // =========================================================================
    // DYNAMIC OVERRIDES (USER REQUESTED)
    // =========================================================================
    {
        patterns: ['country phone code', 'phone country code', 'country code', 'phone prefix', 'calling code'],
        intent: 'personal.countryPhoneCode',
        resolver: (p, opts) => {
            // Priority: Exact match for "United States of America (+1)"
            const target = 'United States of America (+1)';
            return matchOption(target, opts) || target;
        }
    },
    // {
    //     patterns: ['country', 'residence', 'location', 'current location'],
    //     excludes: ['phone', 'code', 'prefix', 'zip', 'postal', 'address', 'city', 'state'],
    //     intent: 'personal.country',
    //     resolver: (p, opts) => {
    //         const target = 'United States';
    //         return matchOption(target, opts) || target;
    //     }
    // },
    {
        patterns: ['password', 'create password', 'set password', 'new password'],
        intent: 'account.password',
        resolver: () => 'Created@123'
    },
    {
        patterns: ['i consent to', 'consent to reddit collecting', 'demographic data surveys', 'privacy policy', 'terms of service', 'i agree', 'consent given', 'acknowledge receipt'],
        intent: 'consent.agreedToAutofill',
        resolver: (p, opts) => {
            return matchOption('Yes', opts) || matchOption('I Agree', opts) || 'true';
        }
    },

    // =========================================================================
    // PHONE / DEVICE TYPE
    // =========================================================================
    {
        patterns: ['phone device type', 'device type', 'phone type'],
        intent: 'personal.phoneType',
        resolver: (p, opts) => {
            const val = p.personal?.phoneType || 'Mobile';
            return matchOption(val, opts) || matchOption('Mobile', opts) || val;
        }
    },
    {
        patterns: ['phone number', 'primary phone', 'mobile number', 'cell phone', 'contact number'],
        excludes: ['type', 'country'],
        intent: 'personal.phone',
        resolver: (p, opts) => {
            const val = p.personal?.phone || p.personal?.phoneNumber;
            if (!val) return null;
            return matchOption(val, opts) || val;
        }
    },

    // =========================================================================
    // WORK AUTHORIZATION — always YES
    // =========================================================================
    {
        patterns: [
            'authorized under u.s. immigration laws to work in the united states',
            'are you legally authorized to work in the united states',
            'are you eligible to work in the us',
            'are you authorized to work in the us',
            'are you authorized to work in the united states',
            'eligible to work in the united states',
            'authorized to work in the us',
            'are you able to work in the united states',
            'legal right to work in the united states',
            'do you have the legal right to work',
            'are you currently authorized to work',
        ],
        excludes: ['sponsorship', 'visa sponsor', 'require sponsor', 'future'],
        intent: 'workAuthorization.authorizedUS',
        resolver: (p, opts) => {
            const val = p.workAuthorization?.authorizedUS;
            return val !== undefined ? yesNo(val, opts) : yesNo(true, opts);
        }
    },

    // =========================================================================
    // SPONSORSHIP — always NO
    // =========================================================================
    {
        patterns: [
            'will you now, or in the future, require sponsorship',
            'will you now or in the future require sponsorship',
            'do you or will you require sponsorship for a us employment visa',
            'will you now or will you in the future require employment visa sponsorship',
            'do you require sponsorship now or at any point in the future',
            'will you require sponsorship to continue to be authorized',
            'require sponsorship',
            'need sponsorship',
            'visa sponsorship',
            'require a visa sponsorship',
            'require employment visa sponsorship',
            'sponsorship for your work visa',
            'would you require our sponsorship',
            'sponsorship to work in',
            'require immigration sponsorship',
            'require any kind visa transfer or sponsorship',
            'sponsoring an immigration case',
            'sponsorship for continued work authorization',
            'require sponsorship for employment status',
            'will you now, or in the future, require sponsorship for employment visa status',
            'do you now, or will you in the future, require immigration sponsorship',
            'will you, now or in the future, require company sponsorship',
        ],
        intent: 'workAuthorization.needsSponsorship',
        resolver: (_p, opts) => yesNo(false, opts),
    },

    // =========================================================================
    // YES QUESTIONS — onsite, schedule, environment, physical, age, etc.
    // =========================================================================
    {
        patterns: [
            'i currently reside in the united states',
            'do you currently reside in the united states',
        ],
        intent: 'personal.country',
        resolver: (p, opts) => {
            const country = (p.personal?.country || '').toLowerCase();
            const isUS = country.includes('united states') || country.includes('america') ||
                country === 'usa' || country === 'us';
            return yesNo(isUS, opts);
        }
    },
    {
        patterns: [
            'this is a full-time, on-site role',
            'are you comfortable working these days',
            'availability is required. are you comfortable',
            'the hours of this shift',
            'does this schedule align with your current availability',
            'are you comfortable with this pay rate',
            'not accessible by public transportation. do you have reliable transportation',
            'do you have reliable transportation',
            'are you able to perform the physical requirements',
            'are you comfortable working under the environmental conditions',
            'are you comfortable working in a project-based role',
            'are you at least 21 years old',
            'are you comfortable working onsite',
            'are you available to work onsite',
            'this position requires working onsite',
            'currently able to meet this requirement',
            'are you comfortable with the requirements',
            'available to work on-site',
            'are you open to working on-site',
            'willing to work in the office',
            'four days per week',
            '4 days per week',
            '3 days per week',
            'three days per week',
            'in-office four days',
            'in-office 4 days',
            'hybrid work model',
            'anchor days',
            'willing to commute',
            'reliably commute',
        ],
        excludes: ['not comfortable', 'not able'],
        intent: 'application.yesPolicy',
        resolver: (_p, opts) => yesNo(true, opts)
    },
    {
        patterns: [
            'willing to relocate',
            'open to relocation',
            'willing to move',
            'relocate to',
            'relocation assistance',
            'requirement to relocate',
        ],
        intent: 'application.willingToRelocate',
        resolver: (_p, opts) => yesNo(true, opts)
    },
    {
        patterns: [
            'background check',
            'background screening',
            'undergo a background',
            'consent to background',
            'drug screen',
            'drug test',
            'pre-employment screening',
            'authorize a background',
        ],
        intent: 'application.backgroundCheckConsent',
        resolver: (_p, opts) => yesNo(true, opts)
    },
    {
        patterns: [
            'do you have a college degree',
            'have you graduated from college',
            'possess a bachelor\'s degree',
            'degree-seeking student',
            'completed a university degree',
            'highest level of education completed',
        ],
        intent: 'education.hasDegree',
        resolver: (_p, opts) => yesNo(true, opts)
    },
    {
        patterns: ['github', 'github link', 'github profile', 'github url'],
        intent: 'personal.github',
        resolver: (p) => p.personal?.github || ' '
    },
    {
        patterns: ['portfolio', 'portfolio link', 'portfolio website', 'portfolio url', 'personal website', 'website url', 'website link'],
        intent: 'personal.portfolio',
        resolver: (p) => p.personal?.portfolio || p.personal?.website || ' '
    },
    {
        patterns: ['twitter', 'twitter link', 'twitter profile', 'twitter url', 'x link', 'x profile'],
        intent: 'personal.twitter',
        resolver: (p) => p.personal?.twitter || ' '
    },
    {
        patterns: ['instagram', 'instagram link', 'instagram profile', 'instagram url'],
        intent: 'personal.instagram',
        resolver: (p) => p.personal?.instagram || ' '
    },
    {
        patterns: ['threads', 'threads link', 'threads profile', 'threads url'],
        intent: 'personal.threads',
        resolver: (p) => p.personal?.threads || ' '
    },
    {
        patterns: ['telegram', 'telegram link', 'telegram profile', 'telegram url'],
        intent: 'personal.telegram',
        resolver: (p) => p.personal?.telegram || ' '
    },
    {
        patterns: ['linkedin', 'linkedin profile', 'linkedin url', 'linkedin link'],
        intent: 'personal.linkedin',
        resolver: (p) => p.personal?.linkedin || ' '
    },

    // =========================================================================
    // NO QUESTIONS — disabilities, transgender, referred, former employee, etc.
    // =========================================================================
    {
        patterns: [
            'do you require any reasonable accommodations to participate in the application process',
            'do you require reasonable accommodations',
            'do you need any accommodations',
            'require reasonable accommodation',
            'require any accommodations',
        ],
        intent: 'application.needsAccommodation',
        resolver: (_p, opts) => yesNo(false, opts)
    },
    {
        patterns: [
            'do you have any current scheduling restrictions',
            'scheduling restrictions we should be aware',
            'any current scheduling restrictions',
        ],
        intent: 'application.schedulingRestrictions',
        resolver: (_p, opts) => yesNo(false, opts)
    },
    {
        patterns: [
            'did an employee refer you to apply',
            'did someone refer you',
            'were you referred by an employee',
        ],
        excludes: ['name of person', 'who referred', 'referral name'],
        intent: 'application.wasReferred',
        resolver: (p, opts) => {
            const howHeard = (p.application?.howDidYouHear || '').toLowerCase();
            const wasReferred = howHeard.includes('referral') || howHeard.includes('referred') ||
                howHeard.includes('employee');
            return yesNo(wasReferred, opts);
        }
    },
    {
        patterns: [
            'are you a current or former',
            'have you ever worked for',
            'have you ever been employed by',
            'are you currently or have you ever worked for',
            'previous employment with',
            'are you a former employee',
            'are you or have you been employed by',
            'history with',
            'previously worked for',
            'previously been employed',
            'employee of or other',
        ],
        intent: 'application.previouslyEmployed',
        resolver: (p, opts) => {
            const val = p.application?.previouslyEmployed;
            return yesNo(val === true, opts);
        }
    },
    {
        patterns: ['rate your', 'experience level', 'proficiency in', 'level of experience', 'years of experience'],
        intent: 'experience.yearsTotal',
        resolver: (p, opts) => {
            const val = p.experience?.[0]?.yearsTotal || '5';
            return matchOption(val, opts) || matchOption('Expert', opts) || val;
        }
    },
    {
        intent: 'legal.hybridWork',
        patterns: ['hybrid work model', 'anchor days', 'in office', '3 days a week', '4 days a week', 'four days a week', 'mondays, tuesdays and thursdays'],
        resolver: () => 'Yes',
    },
    {
        intent: 'consent.privacyAcknowledgement',
        patterns: [
            'applicant privacy policy', "sentry's applicant privacy policy",
            'information i submit will be used', 'read and acknowledge',
            'consent to reddit collecting', 'processing my responses'
        ],
        resolver: (p, opts) => opts?.find(o => o.toLowerCase().includes('acknowledge')) || 'Yes',
    },
    {
        intent: 'personal.pronouns',
        patterns: ['pronouns', 'preferred pronouns', 'identify your preferred pronouns'],
        resolver: (p, opts) => {
            const val = p.personal?.pronouns || 'n/a';
            return matchOption(val, opts) || val;
        }
    },
    {
        intent: 'howDidYouHear',
        patterns: ['how did you hear', 'how did you learn', 'source of application', 'where did you see'],
        resolver: (p, opts) => {
            if (!opts) return 'LinkedIn';
            return opts.find(o => o.toLowerCase().includes('careers page')) ||
                opts.find(o => o.toLowerCase().includes('linkedin')) ||
                opts[0];
        }
    },
    {
        patterns: ['disability', 'handicap', 'health condition', 'physical or mental impairment', 'please check one of the boxes below'],
        excludes: ['veteran', 'gender', 'race', 'hispanic', 'latino', 'orientation'],
        intent: 'eeo.disability',
        resolver: (p, opts) => {
            // Priority: profile data
            const val = p.eeo?.disability || p.eeo?.disabilityStatus || p.customAnswers?.['Do you have a disability?'];
            if (val) return matchOption(val, opts) || val;
            return matchOption('no', opts) || 'No';
        }
    },
    {
        patterns: ['veteran', 'military', 'armed forces', 'please check one of the boxes below', 'veteran status', 'protected veteran'],
        excludes: ['disability', 'gender', 'race', 'hispanic', 'latino', 'orientation'],
        intent: 'eeo.veteran',
        resolver: (p, opts) => {
            const val = p.eeo?.veteran || p.eeo?.veteranStatus || p.customAnswers?.['Are you a veteran?'];
            if (val) return matchOption(val, opts) || val;
            return matchOption('no', opts) || 'No';
        }
    },
    {
        patterns: [
            'do you identify as transgender',
            'do you identify as transgender?',
            'person of transgender experience',
        ],
        intent: 'eeo.transgender',
        resolver: (p, opts) => {
            const val = p.eeo?.transgender || p.customAnswers?.['transgender'];
            if (val) return matchOption(val, opts) || val;
            return matchOption('prefer not to say', opts) || 'Prefer not to say';
        }
    },
    {
        patterns: ['gender', 'gender identity', 'how would you describe your gender identity',
            'how do you identify your gender', 'what is your gender'],
        excludes: ['race', 'ethnicity', 'sexual orientation', 'lgbtq', 'transgender'],
        intent: 'eeo.gender',
        resolver: (p, opts) => {
            const val = p.eeo?.gender || p.customAnswers?.['gender'];
            if (val) return matchOption(val, opts) || val;
            return matchOption('prefer not to say', opts) || 'Prefer not to say';
        }
    },
    {
        patterns: ['sexual orientation', 'how would you describe your sexual orientation', 'lgbtq'],
        excludes: ['lgbtq community', 'do you consider yourself', 'gender', 'race', 'ethnicity'],
        intent: 'eeo.sexualOrientation',
        resolver: (p, opts) => {
            const val = p.eeo?.sexualOrientation || p.customAnswers?.['sexual orientation'];
            if (val) return matchOption(val, opts) || val;
            return matchOption('prefer not to say', opts) || 'Prefer not to say';
        }
    },
    {
        patterns: [
            'are you hispanic', 'are you hispanic/latino', 'are you hispanic or latino',
            'hispanic or latino', 'hispanic/latino', 'hispanic', 'latino'
        ],
        excludes: ['gender', 'sexual orientation', 'veteran', 'disability', 'race'],
        intent: 'eeo.hispanic',
        resolver: (p, opts) => {
            const val = p.eeo?.hispanic || p.eeo?.hispanicLatino || p.customAnswers?.['Are you Hispanic/Latino?'];
            if (val) return matchOption(val, opts) || val;
            return matchOption('no', opts) || 'No';
        }
    },
    // Race/Ethnicity (Consolidated patterns)
    {
        patterns: ['race', 'racial background', 'ethnic background', 'racial/ethnic background',
            'racial or ethnic', 'how would you describe your racial', 'ethnicities',
            'most closely identify with', 'please select up to', 'identify as', 'ethnicity'],
        excludes: ['hispanic', 'latino', 'gender', 'orientation', 'disability', 'veteran'],
        intent: 'eeo.race',
        resolver: (p, opts) => {
            const val = p.eeo?.race || p.customAnswers?.['race'] || p.customAnswers?.['ethnicity'];
            // Support multi-select if the dropdown allows it
            if (Array.isArray(val)) {
                return val.map(v => matchOption(v, opts) || v);
            }
            if (val) return matchOption(val, opts) || val;
            return matchOption('prefer not to say', opts) || 'Prefer not to say';
        }
    },
    {
        patterns: [
            'located in colorado', 'united kingdom', 'switzerland',
            'country in the european economic area', 'located in the uk',
        ],
        intent: 'location.countryConstraint',
        resolver: (p, opts) => {
            // Usually these are Yes/No questions asking if you are in these restricted areas
            // Or "Are you located in X?" -> If I live in Pennsylvania, answer No.
            const country = (p.personal?.country || '').toLowerCase();
            const state = (p.personal?.state || '').toLowerCase();

            const inRestricted = state.includes('colorado') ||
                country.includes('united kingdom') || country === 'uk' ||
                country.includes('switzerland') ||
                ['austria', 'belgium', 'bulgaria', 'croatia', 'cyprus', 'czech', 'denmark', 'estonia', 'finland', 'france', 'germany', 'greece', 'hungary', 'iceland', 'ireland', 'italy', 'latvia', 'liechtenstein', 'lithuania', 'luxembourg', 'malta', 'netherlands', 'norway', 'poland', 'portugal', 'romania', 'slovakia', 'slovenia', 'spain', 'sweden'].some(c => country.includes(c));

            return yesNo(inRestricted, opts);
        }
    },
    {
        patterns: ['onsite', 'working onsite', 'meet this requirement', 'in-person'],
        intent: 'onsite.ableToMeet',
        resolver: (p, opts) => yesNo(true, opts)
    },
    {
        patterns: ['pronouns', 'what are your pronouns', 'preferred pronouns', 'what pronouns'],
        intent: 'personal.pronouns',
        resolver: (p, opts) => {
            const val = p.personal?.pronouns;
            if (val) return matchOption(val, opts) || val;
            return matchOption('prefer not to say', opts) || null;
        }
    },

    // =========================================================================
    // HOW DID YOU HEAR
    // =========================================================================
    {
        patterns: [
            'how did you hear about this opportunity',
            'how did you hear about us',
            'how did you hear about this position',
            'how did you hear about this role',
            'how did you find out about this job',
            'how did you learn about this',
            'where did you hear about',
            'source of application',
            'referral source',
            'how did you find this job',
        ],
        intent: 'application.howDidYouHear',
        resolver: (p, opts) => {
            const val = p.application?.howDidYouHear ||
                p.customAnswers?.['screening.howDidYouHear'] ||
                p.customAnswers?.['howDidYouHear'] ||
                p.customAnswers?.['how did you hear about us'];
            if (val) return matchOption(val, opts) || val;
            return matchOption('linkedin', opts) || matchOption('LinkedIn', opts) || null;
        }
    },

    // =========================================================================
    // REFERRAL / BLANK FIELDS
    // =========================================================================
    {
        patterns: [
            'if yes, please enter the name of the person who referred you',
            'name of the person who referred you',
            'who referred you',
            'referral name',
            'referred by',
            'referrer name',
            'name of employee who referred',
        ],
        intent: 'application.referralName',
        resolver: (p) => {
            return p.application?.referralName || '';
        }
    },
    {
        patterns: ['salary expectations', 'desired salary', 'expected compensation',
            'salary requirement', 'salary range', 'desired pay', 'expected salary',
            'annual salary', 'monthly salary', 'compensation expectations',
            'base salary requirements'
        ],
        intent: 'preferences.desiredSalary',
        resolver: (p, opts) => {
            const val = p.preferences?.desiredSalary || p.application?.desiredSalary || 
                        p.preferences?.salary || p.application?.salaryExpectations || 
                        p.customAnswers?.['desired salary'] || p.customAnswers?.['salary expectations'];
            if (!val) return null;

            const numericVal = parseInt(String(val).replace(/\D/g, ''), 10);

            if (opts && opts.length > 0) {
                for (const opt of opts) {
                    const cleanOpt = opt.toLowerCase().replace(/[\$,k]/g, '').replace(/ /g, '');
                    const parts = cleanOpt.split('-').filter(p => p.length > 0).map(s => parseInt(s, 10));

                    if (parts.length === 2) {
                        let [min, max] = parts;
                        if (min < 1000) min *= 1000;
                        if (max < 1000) max *= 1000;
                        if (numericVal >= min && numericVal <= max) return opt;
                    } else if (cleanOpt.includes('+') || cleanOpt.includes('above') || cleanOpt.includes('more') || cleanOpt.includes('greater')) {
                        let threshold = parseInt(cleanOpt.replace(/\D/g, ''), 10);
                        if (threshold < 1000) threshold *= 1000;
                        if (numericVal >= threshold) return opt;
                    } else if (cleanOpt.includes('under') || cleanOpt.includes('below') || cleanOpt.includes('less')) {
                        let threshold = parseInt(cleanOpt.replace(/\D/g, ''), 10);
                        if (threshold < 1000) threshold *= 1000;
                        if (numericVal <= threshold) return opt;
                    }
                }
                const match = matchOption(val, opts);
                if (match) return match;
                return null;
            }

            return String(val).replace(/\D/g, '').trim();
        }
    },
    {
        patterns: ['current company', 'current employer'],
        excludes: ['company name', 'employer name', 'name of your current'],
        intent: 'experience.company',
        resolver: (p, opts) => {
            const exp = Array.isArray(p.experience) && p.experience.length > 0 ? p.experience[0] : null;
            if (exp?.company) return matchOption(exp.company, opts) || exp.company;
            return '';
        }
    },

    // =========================================================================
    // CONSENT — tick the checkbox
    // =========================================================================
    {
        patterns: [
            'has my consent to contact me about future job opportunities',
            'consent to contact me about future job opportunities',
            'has my consent to contact',
            'i consent to receive communications',
            'agree to receive future communications',
        ],
        intent: 'consent.marketingComms',
        resolver: (_p, opts) => yesNo(true, opts)
    },

    // =========================================================================
    // EDUCATION — school, degree, dates, major, GPA
    // =========================================================================
    {
        patterns: ['school', 'university', 'college', 'institution', 'school name', 'university name', 'college name'],
        excludes: ['high school', 'secondary', 'how long', 'transcript'],
        intent: 'education.school',
        resolver: (p, opts) => {
            const edu = Array.isArray(p.education) && p.education.length > 0 ? p.education[0] : null;
            if (!edu?.school) return null;
            return matchOption(edu.school, opts) || edu.school;
        }
    },
    {
        patterns: ['high school', 'secondary school', 'high school name', 'hs diploma'],
        intent: 'education.highSchool',
        resolver: (p, opts) => {
            const edu = Array.isArray(p.education) && p.education.length > 0
                ? p.education[p.education.length - 1] : null;
            if (!edu?.school) return null;
            return matchOption(edu.school, opts) || edu.school;
        }
    },
    {
        patterns: [
            'please select your highest completed level of education',
            'highest completed level of education',
            'highest level of education',
            'level of education',
            'educational level',
            'degree type',
            'degree earned',
            'education level',
            'highest degree',
            'highest education',
            'education attained',
        ],
        intent: 'education.degree',
        resolver: (p, opts) => {
            const edu = Array.isArray(p.education) && p.education.length > 0 ? p.education[0] : null;
            if (!edu?.degree) return null;
            return matchOption(edu.degree, opts) || edu.degree;
        }
    },
    {
        patterns: ['degree'],
        excludes: ['level of education', 'highest', 'type', 'earned', 'completed', 'bachelor', 'master', 'doctor',
            'sponsorship', 'accounting', 'computer', 'do you have a'],
        intent: 'education.degree',
        resolver: (p, opts) => {
            const edu = Array.isArray(p.education) && p.education.length > 0 ? p.education[0] : null;
            if (!edu?.degree) return null;
            return matchOption(edu.degree, opts) || edu.degree;
        }
    },
    {
        patterns: ['major', 'field of study', 'discipline', 'concentration', 'area of study', 'specialization'],
        intent: 'education.major',
        resolver: (p, opts) => {
            const edu = Array.isArray(p.education) && p.education.length > 0 ? p.education[0] : null;
            if (!edu?.major) return null;
            return matchOption(edu.major, opts) || edu.major;
        }
    },
    {
        patterns: ['gpa', 'grade point average', 'cumulative gpa'],
        intent: 'education.gpa',
        resolver: (p, opts) => {
            const edu = Array.isArray(p.education) && p.education.length > 0 ? p.education[0] : null;
            if (!edu?.gpa) return null;
            return matchOption(edu.gpa, opts) || edu.gpa;
        }
    },

    // Education dates (start)
    {
        patterns: ['start date month', 'start month', 'starting month', 'from month', 'month started', 'month (mm)'],
        excludes: ['end', 'graduation', 'completion', 'to month'],
        intent: 'education.startMonth',
        resolver: (p, opts) => {
            const edu = Array.isArray(p.education) && p.education.length > 0 ? p.education[0] : null;
            const d = parseDate(edu?.startDate);
            if (!d?.month) return null;
            return matchOption(d.month, opts) || d.month;
        }
    },
    {
        patterns: ['start date year', 'start year', 'starting year', 'year started', 'from year', 'year (yyyy)'],
        excludes: ['end', 'graduation', 'completion', 'to year'],
        intent: 'education.startYear',
        resolver: (p, opts) => {
            const edu = Array.isArray(p.education) && p.education.length > 0 ? p.education[0] : null;
            const d = parseDate(edu?.startDate);
            if (!d?.year) return null;
            return matchOption(d.year, opts) || d.year;
        }
    },

    // Education dates (end)
    {
        patterns: ['end date month', 'end month', 'ending month', 'graduation month', 'month completed', 'to month'],
        excludes: ['start', 'enrollment', 'from month'],
        intent: 'education.endMonth',
        resolver: (p, opts) => {
            const edu = Array.isArray(p.education) && p.education.length > 0 ? p.education[0] : null;
            const d = parseDate(edu?.endDate);
            if (!d?.month) return null;
            return matchOption(d.month, opts) || d.month;
        }
    },
    {
        patterns: ['end date year', 'end year', 'ending year', 'graduation year', 'year completed', 'year of graduation', 'to year'],
        excludes: ['start', 'enrollment', 'from year'],
        intent: 'education.endYear',
        resolver: (p, opts) => {
            const edu = Array.isArray(p.education) && p.education.length > 0 ? p.education[0] : null;
            const d = parseDate(edu?.endDate);
            if (!d?.year) return null;
            return matchOption(d.year, opts) || d.year;
        }
    },

    // =========================================================================
    // WORK EXPERIENCE — job titles, dates, etc.
    // =========================================================================
    {
        patterns: ['job title', 'position title', 'your title', 'job role', 'current title', 'most recent title'],
        excludes: ['previous', 'former'],
        intent: 'experience.title',
        resolver: (p, opts) => {
            const exp = Array.isArray(p.experience) && p.experience.length > 0 ? p.experience[0] : null;
            if (!exp?.title) return null;
            return matchOption(exp.title, opts) || exp.title;
        }
    },
    {
        patterns: ['company name', 'employer name', 'organization name', 'name of your current employer'],
        excludes: ['previous', 'former', 'school', 'university'],
        intent: 'experience.company',
        resolver: (p, opts) => {
            const exp = Array.isArray(p.experience) && p.experience.length > 0 ? p.experience[0] : null;
            if (!exp?.company) return null;
            return matchOption(exp.company, opts) || exp.company;
        }
    },

    // Experience dates (start)
    {
        patterns: ['from month', 'start month', 'starting month'],
        excludes: ['education', 'school', 'university', 'to month', 'end month'],
        intent: 'experience.startMonth',
        resolver: (p, opts) => {
            const exp = Array.isArray(p.experience) && p.experience.length > 0 ? p.experience[0] : null;
            const d = parseDate(exp?.startDate);
            if (!d?.month) return null;
            return matchOption(d.month, opts) || d.month;
        }
    },
    {
        patterns: ['from year', 'start year', 'starting year'],
        excludes: ['education', 'school', 'university', 'to year', 'end year', 'graduation'],
        intent: 'experience.startYear',
        resolver: (p, opts) => {
            const exp = Array.isArray(p.experience) && p.experience.length > 0 ? p.experience[0] : null;
            const d = parseDate(exp?.startDate);
            if (!d?.year) return null;
            return matchOption(d.year, opts) || d.year;
        }
    },

    // Experience dates (end)
    {
        patterns: ['to month', 'end month', 'ending month'],
        excludes: ['education', 'school', 'from month', 'start month'],
        intent: 'experience.endMonth',
        resolver: (p, opts) => {
            const exp = Array.isArray(p.experience) && p.experience.length > 0 ? p.experience[0] : null;
            if (exp?.currentlyWorking) return matchOption('Present', opts) || 'Present';
            const d = parseDate(exp?.endDate);
            if (!d?.month) return null;
            return matchOption(d.month, opts) || d.month;
        }
    },
    {
        patterns: ['to year', 'end year', 'ending year'],
        excludes: ['education', 'school', 'from year', 'graduation'],
        intent: 'experience.endYear',
        resolver: (p, opts) => {
            const exp = Array.isArray(p.experience) && p.experience.length > 0 ? p.experience[0] : null;
            if (exp?.currentlyWorking) return matchOption('Present', opts) || 'Present';
            const d = parseDate(exp?.endDate);
            if (!d?.year) return null;
            return matchOption(d.year, opts) || d.year;
        }
    },

    // =========================================================================
    // YEARS OF EXPERIENCE QUESTIONS — numeric experience questions
    // =========================================================================
    {
        patterns: [
            'how many years of professional experience do you have',
            'how many years of experience do you have',
            'how many years of relevant experience',
            'how many years of work experience',
            'total years of experience',
            'years of experience',
        ],
        intent: 'experience.yearsTotal',
        resolver: (p, opts) => {
            const exps = Array.isArray(p.experience) ? p.experience : [];
            if (exps.length === 0) return null;

            let earliestYear = new Date().getFullYear();
            for (const exp of exps) {
                const d = parseDate(exp.startDate);
                if (d?.year) {
                    const yr = parseInt(d.year, 10);
                    if (yr < earliestYear) earliestYear = yr;
                }
            }
            const years = new Date().getFullYear() - earliestYear;
            const val = String(years);

            if (!opts || opts.length === 0) return val;

            const num = years;
            const rangeMatch = opts.find(o => {
                const ol = o.toLowerCase().replace(/\s+/g, '');
                const plusMatch = ol.match(/^(\d+)\+/);
                if (plusMatch && num >= parseInt(plusMatch[1], 10)) return true;
                const rangeMatch2 = ol.match(/^(\d+)-(\d+)/);
                if (rangeMatch2 && num >= parseInt(rangeMatch2[1], 10) && num <= parseInt(rangeMatch2[2], 10)) return true;
                if (ol.includes('lessthan1') && num < 1) return true;
                if (ol === val || ol === `${val}years` || ol === `${val}year`) return true;
                return false;
            });
            return rangeMatch || val;
        }
    },

    // =========================================================================
    // PERSONAL INFO
    // =========================================================================
    {
        patterns: ['first name', 'given name', 'forename', 'name first', 'preferred first name'],
        excludes: ['last', 'middle', 'emergency', 'reference', 'family'],
        intent: 'personal.firstName',
        resolver: (p) => p.personal?.preferredName || p.personal?.firstName || null
    },
    {
        patterns: ['last name', 'surname', 'family name', 'name last', 'preferred last name'],
        excludes: ['first', 'middle', 'emergency', 'reference'],
        intent: 'personal.lastName',
        resolver: (p) => p.personal?.lastName || null
    },
    {
        patterns: ['full name', 'fullname', 'name full', 'name✱', 'your name', 'complete name'],
        excludes: ['first', 'last', 'middle', 'preferred', 'emergency', 'reference'],
        intent: 'personal.fullName',
        resolver: (p) => {
            if (p.personal?.fullName) return p.personal.fullName;
            if (p.personal?.firstName && p.personal?.lastName) {
                return `${p.personal.firstName} ${p.personal.lastName}`;
            }
            return null;
        }
    },
    {
        patterns: ['full name', 'your name', 'legal name'],
        excludes: ['first', 'last', 'reference', 'emergency'],
        intent: 'personal.fullName',
        resolver: (p) => {
            const f = p.personal?.firstName, l = p.personal?.lastName;
            let name = null;
            if (f && l) name = `${f} ${l}`;
            else name = f || l || null;
            if (name && (name.startsWith('http') || name.includes('.com/') || name.includes('linkedin.com'))) {
                return null;
            }
            return name;
        }
    },
    {
        patterns: ['email address', 'email', 'e-mail', 'e mail'],
        excludes: ['emergency', 'reference', 'alternate', 'secondary'],
        intent: 'personal.email',
        resolver: (p) => p.personal?.email || null
    },
    {
        patterns: ['phone number', 'phone', 'mobile number', 'telephone', 'contact number', 'cell phone', 'mobile phone'],
        excludes: ['device type', 'phone type', 'country code', 'emergency', 'reference', 'alternate'],
        intent: 'personal.phone',
        resolver: (p) => {
            const phone = p.personal?.phone;
            if (!phone) return null;
            // Validate: a phone number must contain at least some digits
            // Reject long strings, country names, or boilerplate text
            const hasDigits = /\d/.test(phone);
            const isReasonableLength = phone.length < 20;
            if (hasDigits && isReasonableLength) return phone;
            console.warn('[HardcodedEngine] ⚠️ Phone value looks corrupted, skipping:', phone?.substring(0, 30));
            return null;
        }
    },
    {
        patterns: [
            'linkedin',
            'linkedin profile',
            'linkedin url',
            'linkedin profile url',
            'linkedin profile link',
            'link to linkedin',
            'linkedin (optional)',
            'linkedin profile (optional)',
            'linkedin profile url (optional)',
            'your linkedin',
            'linked in profile',
            'linked in url',
            'linkedin page',
        ],
        excludes: ['github', 'portfolio'],
        intent: 'personal.linkedin',
        resolver: (p) => {
            const val = p.personal?.linkedin || p.social?.linkedin;
            if (!val) return null;
            // Validate: LinkedIn URL must look like a URL or contain 'linkedin'
            if (val.includes('linkedin') || val.startsWith('http') || val.startsWith('www')) return val;
            console.warn('[HardcodedEngine] ⚠️ LinkedIn value looks wrong, skipping:', val?.substring(0, 30));
            return null;
        }
    },
    {
        patterns: ['github', 'github profile', 'github url'],
        intent: 'personal.github',
        resolver: (p) => {
            const val = p.personal?.github || p.social?.github;
            if (!val) return null;
            // Validate: GitHub must look like a URL or username (not a paragraph of text)
            // A GitHub URL/username should be short and contain 'github' or look like a URL
            const isUrl = val.startsWith('http') || val.includes('github.com') || val.startsWith('www');
            const isUsername = val.length < 50 && !val.includes(' ');
            if (isUrl || isUsername) return val;
            console.warn('[HardcodedEngine] ⚠️ GitHub value looks like boilerplate text, skipping:', val?.substring(0, 30));
            return null;
        }
    },
    {
        patterns: ['portfolio', 'personal website', 'website', 'online portfolio', 'portfolio url'],
        excludes: ['linkedin', 'github'],
        intent: 'personal.portfolio',
        resolver: (p) => p.personal?.portfolio || p.social?.website || null
    },
    {
        patterns: ['address', 'address line 1', 'street address', 'mailing address', 'home address'],
        excludes: ['address line 2', 'city', 'state', 'zip', 'country'],
        intent: 'personal.addressLine',
        resolver: (p, opts) => {
            const val = p.personal?.addressLine;
            if (!val) return null;
            return matchOption(val, opts) || val;
        }
    },
    {
        patterns: ['city', 'current city', 'Location', 'location city', 'please list your current city'],
        excludes: ['state', 'country', 'zip', 'postal'],
        intent: 'personal.city',
        resolver: (p, opts) => {
            const val = p.personal?.city;
            if (!val) return null;
            return matchOption(val, opts) || val;
        }
    },
    {
        patterns: ['state', 'province', 'current state', 'state/province', 'region', 'area', 'providence', 'state / providence'],
        excludes: ['city', 'country', 'zip', 'united states'],
        intent: 'personal.state',
        resolver: (p, opts) => {
            const val = p.personal?.state;
            if (!val) return null;
            return matchOption(val, opts) || val;
        }
    },
    {
        patterns: ['zip code', 'postal code', 'zip', 'postcode', 'post code', 'pincode', 'zipcode', 'zip/postal'],
        intent: 'personal.postalCode',
        resolver: (p, opts) => {
            const val = p.personal?.postalCode;
            if (!val) return null;
            return matchOption(val, opts) || val;
        }
    },
    {
        patterns: ['country', 'current country', 'country of residence', 'nation'],
        excludes: ['phone code', 'calling code', 'citizenship'],
        intent: 'personal.country',
        resolver: (p, opts) => {
            const val = p.personal?.country;
            if (!val) return null;
            return matchOption(val, opts) || val;
        }
    },

    // =========================================================================
    // VISA / CITIZENSHIP
    // =========================================================================
    {
        patterns: ['visa type', 'visa status', 'citizenship status', 'work authorization status',
            'what is your visa', 'current visa'],
        intent: 'workAuthorization.citizenshipStatus',
        resolver: (p, opts) => {
            const val = p.workAuthorization?.citizenshipStatus;
            if (!val) return null;
            return matchOption(val, opts) || val;
        }
    },
    {
        patterns: [
            'best describes your right to work',
            'describes your right to work',
            'select which best describes your right to work in the us',
            'which best describes your right to work in the united states',
            'right to work status',
            'describe your right to work',
        ],
        intent: 'workAuthorization.citizenshipStatus',
        resolver: (p, opts) => {
            // This extension is for international students (F-1/OPT/H-1B) — always temporary work authorization
            const temporaryCandidates = [
                'I have temporary work authorization',
                'I have temporary work right',
                'Temporary work authorization',
                'I am authorized to work on a temporary basis',
                'Work visa',
                'Other',
            ];

            if (opts && opts.length > 0) {
                for (const candidate of temporaryCandidates) {
                    const match = matchOption(candidate, opts);
                    if (match) return match;
                }
            }

            // Fallback if no options to match against
            return 'I have temporary work authorization';
        }
    },

    // =========================================================================
    {
        patterns: [
            'what interests you most about working with',
            'what interests you most about',
            'why are you interested in working',
            'why do you want to work at',
            'why this company',
            'what excites you about this role',
            'what attracts you to this company',
        ],
        intent: 'customAnswers.whyInterested',
        resolver: (p) => {
            const custom = p.customAnswers?.['screening.whyRole'] ||
                p.customAnswers?.['whyInterested'] ||
                p.customAnswers?.['what interests you most about working with us'];
            if (custom) return custom;
            return "I'm excited about the opportunity to contribute to a fast-growing, innovative organization " +
                "that is making a meaningful impact in its industry while offering strong opportunities " +
                "for learning and growth.";
        }
    },
    {
        patterns: [
            'why do you want this role',
            'why are you the best candidate',
            'what makes you a good fit',
            'why should we hire you',
            'what can you bring to this',
            'your motivation for this position'
        ],
        intent: 'screening.whyRole',
        resolver: (p) => p.customAnswers?.['screening.whyRole'] || null
    },
    {
        patterns: [
            'relevant experience',
            'describe your experience with',
            'what is your experience in',
            'how many years of experience do you have with'
        ],
        intent: 'screening.relevantExperience',
        resolver: (p) => p.customAnswers?.['screening.relevantExperience'] || null
    },
    {
        patterns: [
            'notice period',
            'how soon can you start',
            'availability to start',
            'earliest start date'
        ],
        intent: 'screening.noticePeriod',
        resolver: (p) => p.customAnswers?.['screening.noticePeriod'] || p.preferences?.startDate || p.preferences?.noticePeriod || null
    },

    // =========================================================================
    // DRIVER'S LICENSE
    // =========================================================================
    {
        patterns: ['driver license', 'drivers license', "driver's license", 'driving license',
            'valid driver', 'valid driving license'],
        intent: 'workAuthorization.driverLicense',
        resolver: (p, opts) => {
            const val = p.workAuthorization?.driverLicense;
            return val !== undefined ? yesNo(val, opts) : yesNo(true, opts);
        }
    },

    // =========================================================================
    // PREVIOUSLY APPLIED / RELATIVES
    // =========================================================================
    {
        patterns: ['previously applied', 'applied before', 'have you applied', 'applied to this company', 'prior application'],
        intent: 'application.previouslyApplied',
        resolver: (p, opts) => yesNo(p.application?.previouslyApplied === true, opts)
    },
    {
        patterns: ['relatives', 'family members', 'know anyone', 'friends or relatives',
            'employee referral', 'know employees', 'do you know any current employees'],
        excludes: ['referred by', 'name of'],
        intent: 'application.hasRelatives',
        resolver: (p, opts) => {
            const val = p.application?.hasRelatives === true;
            return yesNo(val, opts, 'No one');
        }
    },
    {
        patterns: ['government background', 'worked for government', 'federal employment', 'government employee'],
        intent: 'application.governmentBackground',
        resolver: (p, opts) => yesNo(p.application?.governmentBackground === true, opts)
    },

    // =========================================================================
    // CRIMINAL HISTORY — always No
    // =========================================================================
    {
        patterns: [
            'have you ever been convicted',
            'have you ever been convicted in any court',
            'convicted of a felony',
            'convicted of a misdemeanor',
            'convicted of a crime',
            'criminal conviction',
            'criminal history',
            'criminal record',
            'criminal background',
            'been found guilty',
            'pled guilty',
            'plead guilty',
            'pending criminal charges',
            'been charged with a crime',
            'crime of domestic violence',
            'felony or any other crime',
            'violation of the uniform code of military justice',
        ],
        excludes: ['background check consent', 'do you understand', 'authorization'],
        intent: 'legal.criminalHistory',
        resolver: (_p, opts) => yesNo(false, opts),
    },

    // =========================================================================
    // MENTAL INSTITUTION / CONTROLLED SUBSTANCE ADDICTION — always No
    // =========================================================================
    {
        patterns: [
            'adjudicated as a mental defective',
            'committed to a mental institution',
            'mental institution',
            'mental defective',
            'unlawful user of',
            'addicted to marijuana',
            'addicted to any depressant',
            'addicted to any controlled substance',
            'narcotic drug',
        ],
        intent: 'legal.mentalInstitutionOrDrug',
        resolver: (_p, opts) => yesNo(false, opts),
    },

    // =========================================================================
    // FUGITIVE / UNLAWFUL ALIEN STATUS — always No
    // =========================================================================
    {
        patterns: [
            'are you a fugitive from justice',
            'fugitive from justice',
            'alien illegally or unlawfully in the united states',
            'unlawfully in the united states',
            'illegally in the united states',
        ],
        intent: 'legal.fugitiveOrUnlawful',
        resolver: (_p, opts) => yesNo(false, opts),
    },

    // =========================================================================
    // NONIMMIGRANT VISA HOLDER (H-1B, TN, F-1 etc.)
    // Auto-detects from profile citizenshipStatus; defaults No
    // =========================================================================
    {
        patterns: [
            'are you an alien who has been admitted to the united states under a nonimmigrant visa',
            'admitted under a nonimmigrant visa',
            'h-1b, tn, f1',
            'h-1b visa holder',
            'nonimmigrant visa',
        ],
        excludes: ['require sponsorship', 'sponsorship'],
        intent: 'legal.nonimmigrantVisa',
        resolver: (p, opts) => {
            const status = (p.workAuthorization?.citizenshipStatus || '').toLowerCase();
            const onVisa = status.includes('visa') || status.includes('h1b') || status.includes('opt') || status.includes('tn');
            return yesNo(onVisa, opts);
        },
    },

    // =========================================================================
    // DISHONOURABLE DISCHARGE / RENOUNCED CITIZENSHIP — always No
    // =========================================================================
    {
        patterns: [
            'discharged from the armed forces under dishonorable conditions',
            'dishonorable conditions',
            'dishonourable discharge',
            'have you ever renounced your united states citizenship',
            'renounced your citizenship',
        ],
        intent: 'legal.dishonourableOrRenounced',
        resolver: (_p, opts) => yesNo(false, opts),
    },

    // =========================================================================
    // EXPORT CONTROL — restricted country (Cuba, Iran, etc.) — always No
    // =========================================================================
    {
        patterns: [
            'are you a national, citizen, or permanent resident of cuba',
            'national, citizen, or permanent resident of cuba',
            'cuba, iran, north korea',
            'iran, north korea, sudan',
            'north korea, sudan, syria',
            'cuba, iran',
            'iran, north korea',
            'sanctioned country',
            'ofac sanctioned',
        ],
        intent: 'legal.restrictedCountryNational',
        resolver: (_p, opts) => yesNo(false, opts),
    },

    // =========================================================================
    // DEEMED EXPORT — "would you meet the requirements" — Yes (compliant)
    // =========================================================================
    {
        patterns: [
            'would you meet the requirements for a deemed export license',
            'deemed export license',
            'deemed export',
            'ear - controlled technology',
            'ear controlled technology',
            'export control laws',
            'export administration regulations',
        ],
        excludes: ['national, citizen', 'cuba', 'iran'],
        intent: 'legal.deemedExportCompliant',
        resolver: (_p, opts) => yesNo(true, opts),
    },

    // =========================================================================
    // EXPORT CONTROL CONSENT / "I have read and understand" — Yes
    // =========================================================================
    {
        patterns: [
            'i have read and understand the selection criteria',
            'i have read and understand the export',
            'i understand the selection criteria',
        ],
        intent: 'legal.exportControlConsent',
        resolver: (_p, opts) => {
            if (opts && opts.length > 0) {
                const agree = opts.find(o => {
                    const l = o.toLowerCase();
                    return l.includes('read') || l.includes('understand') || l.includes('agree') || l.includes('yes');
                });
                if (agree) return agree;
            }
            return 'I have read and understand the selection criteria.';
        },
    },

    // =========================================================================
    // GOVERNMENT OFFICIAL (self) — always No
    // =========================================================================
    {
        patterns: [
            'are you now, or have you been in the past year, a covered government official',
            'covered government official',
            'decision maker on a visa contract',
            'employed by a government agency or state-owned entity',
            'government agency or state-owned entity',
            'authority or influence over any matters',
            'lobbying or appearing before the government',
            'subject to any restrictions on lobbying',
        ],
        intent: 'legal.isGovernmentOfficial',
        resolver: (_p, opts) => yesNo(false, opts),
    },

    // =========================================================================
    // CLOSE RELATIVE WHO IS GOVERNMENT OFFICIAL — always No
    // =========================================================================
    {
        patterns: [
            'do you have a close relative who is a covered government official',
            'close relative who is a covered government official',
            'close relative who is a government official',
            'relative with authority or influence over matters',
        ],
        intent: 'legal.relativeIsGovernmentOfficial',
        resolver: (_p, opts) => yesNo(false, opts),
    },

    // =========================================================================
    // CLOSE RELATIVE AT ANY NAMED COMPANY (Visa, KPMG, BDO, etc.) — always No
    // =========================================================================
    {
        patterns: [
            'do you have a close relative who is a current employee or partner at kpmg',
            'close relative who is a current employee or partner at kpmg',
            'close relative who is a current employee or partner at bdo',
            'do you have a close relative who is a current employee',
            'close relative who is a current employee',
            'relative who is a current employee or partner',
            'close relative of any visa board director',
            'close relative of any visa board',
            'relative of a current employee or partner',
            'do you share the residential household with any visa board',
            'share the residential household with',
            'relatives currently working for visa',
            'relatives currently working for',
            'do you have any relatives currently working for',
            'close relative of any board director',
            'close relative of any executive officer',
        ],
        intent: 'legal.relativeAtNamedCompany',
        resolver: (_p, opts) => yesNo(false, opts),
    },

    // =========================================================================
    // PREVIOUSLY EMPLOYED AT SPECIFIC NAMED COMPANY — always No
    // =========================================================================
    {
        patterns: [
            'have you ever worked for visa inc',
            'worked for visa inc',
            'ever worked for visa',
            'have you ever been a partner or employee of kpmg',
            'partner or employee of kpmg',
            'partner or employee of bdo',
            'currently or recently been a partner or employee of kpmg',
            'have you ever worked for mastercard',
            'worked for mastercard',
            'provided services as a contingent worker',
            'previously employed at mastercard',
        ],
        intent: 'application.previouslyEmployedAtNamedCompany',
        resolver: (_p, opts) => yesNo(false, opts),
    },

    // =========================================================================
    // CONTRACTUAL RESTRICTIONS / NON-COMPETE — always No
    // =========================================================================
    {
        patterns: [
            'do you have any contractual obligations',
            'contractual obligations',
            'contractual restrictions',
            'non-compete agreement',
            'non-compete',
            'non-solicitation agreement',
            'restrictive covenant',
            'restrictive covenants',
            'impact your ability to join',
            'impact, impede or interfere with your ability',
            'agreements, relationships, or commitments to another',
        ],
        intent: 'legal.contractualRestrictions',
        resolver: (_p, opts) => yesNo(false, opts),
    },

    // =========================================================================
    // COURT ORDER / INDICTMENT / RESTRAINING ORDER — always No
    // =========================================================================
    {
        patterns: [
            'are you subject to a court order',
            'subject to a court order',
            'military protection order',
            'restraining you from harassing',
            'restraining order',
            'under indictment',
            'under indictment or information in any court',
        ],
        intent: 'legal.courtOrderOrIndictment',
        resolver: (_p, opts) => yesNo(false, opts),
    },

    // =========================================================================
    // LGBTQ COMMUNITY MEMBERSHIP — Prefer not to say
    // =========================================================================
    {
        patterns: [
            'do you consider yourself a member of the lesbian, gay, bisexual',
            'do you consider yourself a member of the lgbtq',
            'lesbian, gay, bisexual and/or transgender',
            'lgbtq community',
            'lgbtq+ community',
        ],
        intent: 'eeo.lgbtq',
        resolver: (p, opts) => {
            const val = p.eeo?.lgbtq;
            if (val) return matchOption(val, opts) || val;
            return matchOption('prefer not to say', opts) || 'Prefer not to say';
        },
    },

    // =========================================================================
    // US CITIZEN / GREEN CARD / ASYLEE / REFUGEE — always No
    // (User is not a US citizen/green card holder — adjust if your profile differs)
    // =========================================================================
    {
        patterns: [
            'are you a u.s. citizen, a lawful permanent resident',
            'u.s. citizen, a lawful permanent resident',
            'lawful permanent resident of the united states',
            'green card holder',
            'asylee, a refugee',
            'temporary resident under the 1986 legalization program',
            'u.s. citizen or lawful permanent resident',
        ],
        intent: 'workAuthorization.usCitizenOrEquivalent',
        resolver: (p, opts) => {
            const status = (p.workAuthorization?.citizenshipStatus || '').toLowerCase();
            const isQualified = status.includes('citizen') || status.includes('permanent resident') ||
                status.includes('green card') || status.includes('asylee') || status.includes('refugee');
            // Default: No — override via profile.workAuthorization.citizenshipStatus if needed
            return yesNo(isQualified, opts);
        },
    },

    // =========================================================================
    // PRIVACY / POLICY / ACKNOWLEDGEMENT CONSENTS — Yes / Agree
    // =========================================================================
    {
        patterns: [
            'acknowledge receipt of the candidate privacy notice',
            'i acknowledge',
            'i agree that visa may reach out',
            'you declare that you have read and understand the privacy notice',
            'privacy notice',
            'i agree to allow',
            'privacy policy',
            'i agree not to use ai interview tools',
            'by submitting your application, you are agreeing',
            'acknowledgment of receipt and review',
            'i acknowledge that i received a copy',
            'have read and acknowledge receipt',
            'have read pindrop\'s candidate privacy notice',
            'accept the privacy terms',
            'my answers on this application are correct',
        ],
        excludes: ['criminal', 'felony', 'disability', 'veteran'],
        intent: 'consent.privacyAcknowledgement',
        resolver: (_p, opts) => {
            if (opts && opts.length > 0) {
                const agree = opts.find(o => {
                    const l = o.toLowerCase();
                    return l.includes('agree') || l.includes('yes') || l.includes('acknowledge') ||
                        l.includes('i have read') || l.includes('accept');
                });
                if (agree) return agree;
            }
            return 'I agree';
        },
    },

    // =========================================================================
    // ABLE TO PERFORM ESSENTIAL FUNCTIONS OF THE JOB — Yes
    // =========================================================================
    {
        patterns: [
            'are you able to perform the essential functions of the job',
            'able to perform the essential functions',
            'essential functions of the job for which you are applying',
            'with or without reasonable accommodations',
            'perform the essential functions',
        ],
        intent: 'application.ableToPerformEssentialFunctions',
        resolver: (_p, opts) => yesNo(true, opts),
    },

    // =========================================================================
    // DO YOU UNDERSTAND THESE REQUIREMENTS (background check etc.) — Yes
    // =========================================================================
    {
        patterns: [
            'do you understand these requirements',
            'i understand these requirements',
            'do you understand and agree to these requirements',
            'criminal background check',
            'federal background checks',
            'education verification',
            'do you understand this',
        ],
        excludes: ['criminal history', 'convicted', 'felony'],
        intent: 'consent.understandsRequirements',
        resolver: (_p, opts) => {
            if (opts && opts.length > 0) {
                const yes = opts.find(o => {
                    const l = o.toLowerCase();
                    return l.includes('yes') || l.includes('i understand') || l.includes('understand');
                });
                if (yes) return yes;
            }
            return 'Yes';
        },
    },

    // =========================================================================
    // AUTHORIZED WITHOUT SPONSORSHIP — Yes (Workable / Bamboo / Jenzabar variants)
    // =========================================================================
    {
        patterns: [
            'are you legally authorized to work in the united states without visa sponsorship',
            'authorized to work in the united states without visa sponsorship',
            'are you authorized to work for any employer without sponsorship now and in the future',
            'authorized to work for any employer without sponsorship',
            'does not sponsor applicants for work visas',
            'legally authorized to work in your current country of employment',
            'can you provide verification of both your identity and authorization to work',
            'can you provide verification of your identity upon hire',
        ],
        intent: 'workAuthorization.authorizedWithoutSponsorship',
        resolver: (p, opts) => {
            const needsSponsorship = p.workAuthorization?.needsSponsorship;
            return yesNo(needsSponsorship !== true, opts);
        },
    },

    // =========================================================================
    // CURRENT LOCATION — city + state combined
    // =========================================================================
    {
        patterns: [
            'current location',
            'where are you currently located',
            'please list your current city',
            'location city',
            'where do you currently live',
            'where are you based',
        ],
        excludes: ['work location', 'office location', 'hub location', 'city and state', 'country'],
        intent: 'personal.currentLocation',
        resolver: (p, opts) => {
            const city = p.personal?.city;
            const state = p.personal?.state;
            if (city && state) {
                const combined = matchOption(`${city}, ${state}`, opts);
                if (combined) return combined;
            }
            // Fallback: try individual parts
            return matchOption(city, opts) || matchOption(state, opts) || (city && state ? `${city}, ${state}` : city || null);
        },
    },

    // =========================================================================
    // WORK LOCATION — city, state, country combined
    // =========================================================================
    {
        patterns: [
            'what is your work location',
            'work location',
            'city, state, country',
            'city and state/province',
            'please list the city and state',
            'city and state that you are located in',
        ],
        excludes: ['office', 'hub', 'current location'],
        intent: 'personal.workLocation',
        resolver: (p, opts) => {
            const city = p.personal?.city;
            const state = p.personal?.state;
            const country = p.personal?.country;

            // Try triple combination
            if (city && state && country) {
                const combined = matchOption(`${city}, ${state}, ${country}`, opts);
                if (combined) return combined;
            }

            // Try city/state combination
            if (city && state) {
                const combined = matchOption(`${city}, ${state}`, opts);
                if (combined) return combined;
            }

            // Fallback: try individual parts
            return matchOption(city, opts) || matchOption(state, opts) || matchOption(country, opts) || city || null;
        },
    },

    // =========================================================================
    // TWITTER / FACEBOOK / OTHER WEBSITE LINKS
    // =========================================================================
    {
        patterns: [
            'twitter url',
            'twitter profile',
            'x (fka twitter)',
            'x profile',
        ],
        intent: 'personal.twitter',
        resolver: (p) => p.personal?.twitter || p.social?.twitter || null,
    },
    {
        patterns: [
            'facebook url',
            'facebook profile',
        ],
        intent: 'personal.facebook',
        resolver: (p) => p.personal?.facebook || p.social?.facebook || null,
    },
    {
        patterns: [
            'other website',
            'other url',
            'additional link',
            'links',
        ],
        excludes: ['linkedin', 'github', 'twitter', 'portfolio', 'facebook'],
        intent: 'personal.otherWebsite',
        resolver: (p) => p.personal?.portfolio || p.social?.website || null,
    },

    // =========================================================================
    // PORTFOLIO / WORK SAMPLES LINK FIELD
    // =========================================================================
    {
        patterns: [
            'please share links to any relevant work samples',
            'share links to any relevant work samples',
            'work samples',
            'please provide your portfolio or work samples here',
        ],
        excludes: ['upload', 'drag and drop'],
        intent: 'personal.workSamples',
        resolver: (p) => p.personal?.portfolio || p.social?.website || null,
    },

    // =========================================================================
    // PREFERRED NAME (Lever / Bamboo variant)
    // =========================================================================
    {
        patterns: ['preferred first name'],
        intent: 'personal.preferredFirstName',
        resolver: (p) => p.personal?.preferredName || p.personal?.firstName || null,
    },
    {
        patterns: ['preferred last name'],
        intent: 'personal.preferredLastName',
        resolver: (p) => p.personal?.lastName || null,
    },

    // =========================================================================
    // CITIZENSHIP SELECTION (multi-select)
    // =========================================================================
    {
        patterns: [
            'please select all citizenships',
            'select all citizenships',
            'select each country individually',
            'citizenship country',
        ],
        intent: 'workAuthorization.citizenshipCountry',
        resolver: (p, opts) => {
            const status = (p.workAuthorization?.citizenshipStatus || '').toLowerCase();
            const country = (p.personal?.country || '').toLowerCase();
            if (status.includes('citizen') || country.includes('united states') || country === 'us' || country === 'usa') {
                return matchOption('United States', opts) || 'United States';
            }
            const val = p.workAuthorization?.citizenshipCountry || p.personal?.country;
            return val ? matchOption(val, opts) || val : null;
        },
    },

    // =========================================================================
    // OPEN TO RELOCATE — Yes by default (overridable via profile)
    // =========================================================================
    {
        patterns: [
            'are you open to relocate',
            'open to relocation',
            'willing to relocate',
            'are you open to relocating',
            'currently located or willing to relocate',
            'currently based in sf',
            'are you open to relocating or currently based in sf',
        ],
        intent: 'preferences.openToRelocate',
        resolver: (p, opts) => {
            const val = p.preferences?.openToRelocate;
            return val !== undefined ? yesNo(val, opts) : yesNo(true, opts);
        },
    },

    // =========================================================================
    // WITHIN 50 MILES OF HUB — matches user city against hub options
    // =========================================================================
    {
        patterns: [
            'within 50 miles of one of our hubs',
            'within 50 miles of',
            '50 miles of the hub',
            'reside within 50 miles',
        ],
        intent: 'preferences.withinHubDistance',
        resolver: (p, opts) => {
            const city = (p.personal?.city || '').toLowerCase().trim();
            const state = (p.personal?.state || '').toLowerCase().trim();
            const locationStr = `${city} ${state}`;

            if (opts && opts.length > 0) {
                // 1. Direct city/state word match
                const match = opts.find(o => {
                    const ol = o.toLowerCase();
                    // Use regex for word boundary matching
                    const cityRegex = new RegExp(`\\b${city}\\b`, 'i');
                    const stateRegex = new RegExp(`\\b${state}\\b`, 'i');
                    return (city && cityRegex.test(ol)) || (state && stateRegex.test(ol));
                });
                if (match) return match;

                // 2. Remote / Anywhere fallback
                const remoteMatch = opts.find(o => {
                    const ol = o.toLowerCase();
                    return ol.includes('remote') || ol.includes('anywhere') || ol.includes('home-based') || ol.includes('location neutral');
                });
                if (remoteMatch) return remoteMatch;

                return opts.find(o => o.toLowerCase().includes('able to relocate')) ||
                    opts.find(o => o.toLowerCase().includes('n/a')) ||
                    null;
            }
            return null;
        },
    },

    // =========================================================================
    // EXPERIENCE WITH SPECIFIC TECHNOLOGIES / THRESHOLDS — Yes
    // =========================================================================
    {
        patterns: [
            'do you have 5+ years experience in fullstack',
            'do you have 6+ years of experience in a software engineering role',
            'do you have professional experience designing and building apis',
            'do you have at least 3 years of professional experience with react',
            'do you have experience strategically incorporating ai',
            'do you have previous experience with any renewed vision products',
            'do you have recent hands on experience',
        ],
        intent: 'application.meetsExperienceRequirement',
        resolver: (_p, opts) => yesNo(true, opts),
    },

    // =========================================================================
    // CURRENTLY WORK AND LIVE IN THE UNITED STATES — Yes
    // =========================================================================
    {
        patterns: [
            'do you currently work and live in the united states',
            'currently work and live in the united states',
            'do you live and work in the us',
        ],
        intent: 'personal.workAndLiveInUS',
        resolver: (p, opts) => {
            const country = (p.personal?.country || '').toLowerCase();
            const isUS = country.includes('united states') || country.includes('usa') || country === 'us' || country === '';
            return yesNo(isUS !== false, opts);
        },
    },

    // =========================================================================
    // SMS / MARKETING CONSENT — Yes
    // =========================================================================
    {
        patterns: [
            'i agree that visa may reach out to me via sms',
            'consent to receive sms',
            'i agree to receive sms',
            'reach out to me via sms',
        ],
        intent: 'consent.smsMarketing',
        resolver: (_p, opts) => yesNo(true, opts),
    },

    // =========================================================================
    // MASTERCARD CONTINGENT WORKER — No
    // =========================================================================
    {
        patterns: [
            'have you ever worked for mastercard as an employee or provided services as a contingent worker',
            'contingent worker',
            'contractor, consultant',
        ],
        excludes: ['current employer', 'company name'],
        intent: 'application.contingentWorkerAtNamedCompany',
        resolver: (_p, opts) => yesNo(false, opts),
    },

    // =========================================================================
    // EXPECTED ANNUAL CASH COMPENSATION (text field)
    // =========================================================================
    {
        patterns: [
            'what is your expected annual cash compensation',
            'expected annual cash compensation',
            'expected annual gross salary',
            'annual gross salary',
            'what is your expected annual gross salary',
            'salary expectations',
            'compensation expectations',
            'desired salary',
            'expected salary',
            'target salary',
            'compensation requirements',
        ],
        excludes: ['range', 'select'],
        intent: 'preferences.desiredSalary',
        resolver: (p, opts) => {
            const val = p.preferences?.desiredSalary || p.preferences?.salaryExpectations || "100000";
            if (opts && opts.length > 0) {
                return matchOption(val, opts);
            }
            // For text fields, ensure it's numbers only
            return String(val).replace(/[^\d]/g, '').trim() || "100000";
        },
    },

    // =========================================================================
    // LOCAL CURRENCY — USD for US-based users
    // =========================================================================
    {
        patterns: [
            'what is your local currency',
            'local currency',
            'currency type',
        ],
        intent: 'preferences.currency',
        resolver: (p, opts) => {
            const val = p.preferences?.currency;
            if (val) return matchOption(val, opts) || val;
            const country = (p.personal?.country || '').toLowerCase();
            if (country.includes('united states') || country === 'us' || country === 'usa' || country === '') {
                return matchOption('USD', opts) || matchOption('usd', opts) || 'USD';
            }
            return null;
        },
    },

    // =========================================================================
    // WHEN CAN YOU START / AVAILABILITY TO START — always Immediate
    // =========================================================================
    {
        patterns: [
            'when are you available to start',
            'when can you start',
            'availability to start',
            'what is your availability to start',
            'earliest start date',
            'available to start working',
            'date available',
            'what date are you available to start',
            'how soon can you start',
            'earliest possible start date',
            'what is your intended start date',
        ],
        excludes: ['notice period'],
        intent: 'screening.startDate',
        resolver: (p, opts) => {
            // 1. If dropdown/radio has any "immediate" option → select it
            if (opts && opts.length > 0) {
                const immediateOpt = opts.find(o => o.toLowerCase().includes('immediate'));
                if (immediateOpt) return immediateOpt;
            }

            // 2. Check profile for a custom start date
            const val = p.preferences?.startDate || p.customAnswers?.['screening.startDate'];
            if (val) return matchOption(val, opts) || val;

            // 3. Fallback → type "Immediate" into text field
            return 'Immediate';
        },
    },

    // =========================================================================
    // PROUDEST ACHIEVEMENT / TECHNICAL PROBLEM — custom answers
    // =========================================================================
    {
        patterns: [
            'what is your proudest achievement',
            'proudest achievement',
            'most proud of',
            'greatest professional achievement',
        ],
        intent: 'customAnswers.proudestAchievement',
        resolver: (p) => p.customAnswers?.['proudest achievement'] || p.customAnswers?.['screening.proudestAchievement'] || null,
    },
    {
        patterns: [
            'describe a technical problem and how you solved it',
            'technical problem and how you solved it',
            'describe a technical challenge',
        ],
        intent: 'customAnswers.technicalProblem',
        resolver: (p) => p.customAnswers?.['technical problem'] || p.customAnswers?.['screening.technicalProblem'] || null,
    },

    // =========================================================================
    // SEARCH TIMELINE / DEADLINES
    // =========================================================================
    {
        patterns: [
            'what is your search timeline',
            'search timeline',
            'any deadlines we should be aware of',
            'do you have any deadlines',
        ],
        intent: 'screening.searchTimeline',
        resolver: (p) => p.customAnswers?.['screening.searchTimeline'] || p.preferences?.startDate || null,
    },

    // =========================================================================
    // FOR HIRING PURPOSES — STATE OF RESIDENCE
    // =========================================================================
    {
        patterns: [
            'for hiring purposes, in which state do you currently reside',
            'which state do you currently reside',
            'state of residence for hiring',
            'in which state do you reside',
        ],
        intent: 'personal.stateOfResidence',
        resolver: (p, opts) => {
            const val = p.personal?.state;
            if (!val) return null;
            return matchOption(val, opts) || val;
        },
    },

    // =========================================================================
    // WHY ARE YOU INTERESTED IN THIS ROLE (Lever / Workable variant)
    // =========================================================================
    {
        patterns: [
            'why are you interested in this role',
            'why are you applying',
            'what drew you to this role',
            'why do you want to join',
        ],
        intent: 'customAnswers.whyInterestedInRole',
        resolver: (p) => {
            return p.customAnswers?.['screening.whyRole'] ||
                p.customAnswers?.['why are you interested in this role'] ||
                null;
        },
    },

    // =========================================================================
    // WEBSITE / GITHUB / PORTFOLIO — Space character to satisfy requirements
    // =========================================================================
    {
        patterns: [
            'personal website',
            'portfolio url',
            'portfolio link',
            'website url',
            'blog url',
            'other website',
            'personal link',
            'website (optional)',
            'portfolio (optional)',
            'Website',
            'Website URL',
            'Other website',
            'Website Link',
            'Website Profile',
            'Website (optional)',
            'Website'
        ],
        intent: 'personal.website',
        resolver: (p) => p.personal?.website || p.personal?.portfolio || " ",
    },
    {
        patterns: [
            'github url',
            'github account',
            'github link',
            'github profile',
            'link to github',
            'github (optional)',
            'github',
            'GitHub',
            'GitHub URL',
            'GitHub Link',
            'GitHub Profile',
            'GitHub (optional)',
            'GitHub',
            'GitHub URL'
        ],
        intent: 'personal.github',
        resolver: (p) => p.personal?.github || p.personal?.githubUrl || " ",
    },

    // =========================================================================
    // AGE VERIFICATION — always Yes (18+)
    // =========================================================================
    {
        patterns: [
            'are you at least 18 years old',
            'are you at least 18 years of age',
            'are you at least 18 years of age or older',
            'are you of legal age to work',
            'are you over 18 years of age',
            'are at least 18 years or older',
            'are you at least age 18',
            'are you 18 years of age or older',
            'confirm you are 18 years or older',
            'are you legally old enough to work',
        ],
        intent: 'legal.ageVerification',
        resolver: (_p, opts) => yesNo(true, opts),
    },

    // =========================================================================
    // WORK AUTHORIZATION IDENTITY VERIFICATION — Yes
    // =========================================================================
    {
        patterns: [
            'can you provide verification of both your identity and authorization to work',
            'provide verification of your identity and authorization to work',
            'verification of both your identity and authorization',
            'provide documentation to verify your identity and work authorization',
            'i-9 documentation',
            'identity and work authorization documents',
        ],
        intent: 'workAuthorization.canProvideVerification',
        resolver: (_p, opts) => yesNo(true, opts),
    },

    // =========================================================================
    // DEEMED EXPORT LICENSE — Yes (authorized to access EAR-controlled technology)
    // =========================================================================
    {
        patterns: [
            'deemed export license',
            'ear - controlled technology',
            'ear-controlled technology',
            'export administration regulations',
            'meet the requirements for a deemed export license',
            'access ear - controlled',
        ],
        intent: 'legal.deemedExportLicense',
        resolver: (_p, opts) => yesNo(true, opts),
    },

    // =========================================================================
    // BACKGROUND CHECK CONSENT — Yes / Willing
    // =========================================================================
    {
        patterns: [
            'are you willing to undergo a background check',
            'are you willing to submit to a pre-employment background check',
            'undergo a background check',
            'consent to a background check',
            'subject to a background check',
            'agree to a background check',
            'pre-employment background screening',
        ],
        intent: 'consent.backgroundCheck',
        resolver: (_p, opts) => yesNo(true, opts),
    },

    // =========================================================================
    // RELOCATION — Yes
    // =========================================================================
    {
        patterns: [
            'are you willing to relocate',
            'open to relocation',
            'willing to relocate',
            'would you be willing to relocate',
            'are you open to relocation',
            'able to relocate',
        ],
        intent: 'preferences.willingToRelocate',
        resolver: (p, opts) => {
            const val = p.preferences?.willingToRelocate;
            return val !== undefined ? yesNo(val, opts) : yesNo(true, opts);
        },
    },

    // =========================================================================
    // FUGITIVE FROM JUSTICE — always No
    // =========================================================================
    {
        patterns: [
            'are you a fugitive from justice',
            'fugitive from justice',
            'are you currently a fugitive',
        ],
        intent: 'legal.fugitiveFromJustice',
        resolver: (_p, opts) => yesNo(false, opts),
    },

    // =========================================================================
    // ALIEN ILLEGALLY IN THE US — always No
    // =========================================================================
    {
        patterns: [
            'are you an alien illegally or unlawfully in the united states',
            'alien illegally or unlawfully in the united states',
            'illegally or unlawfully in the united states',
            'unlawfully present in the united states',
        ],
        intent: 'legal.alienIllegally',
        resolver: (_p, opts) => yesNo(false, opts),
    },

    // =========================================================================
    // NONIMMIGRANT VISA (H-1B, TN, F1) — always No
    // =========================================================================
    {
        patterns: [
            'are you an alien who has been admitted to the united states under a nonimmigrant visa',
            'admitted to the united states under a nonimmigrant visa',
            'nonimmigrant visa',
            'h-1b visa',
            'admitted on a nonimmigrant visa',
            'admitted under a nonimmigrant',
        ],
        intent: 'legal.nonimmigrantVisa',
        resolver: (_p, opts) => yesNo(false, opts),
    },

    // =========================================================================
    // DRUG / CONTROLLED SUBSTANCE USE — always No
    // =========================================================================
    {
        patterns: [
            'are you an unlawful user of, or addicted to, marijuana',
            'unlawful user of, or addicted to',
            'addicted to marijuana',
            'unlawful user of marijuana',
            'depressant, stimulant, narcotic drug',
            'controlled substance',
            'addicted to any controlled substance',
            'use of illegal drugs',
            'unlawful use of controlled substances',
        ],
        intent: 'legal.drugUse',
        resolver: (_p, opts) => yesNo(false, opts),
    },

    // =========================================================================
    // COURT ORDER RESTRAINING — always No  
    // =========================================================================
    {
        patterns: [
            'are you subject to a court order, including a military protection order',
            'restraining you from harassing, stalking, or threatening your child',
            'restraining you from harassing, stalking',
            'intimate partner or child of such partner',
            'military protection order issued by a military judge',
        ],
        intent: 'legal.courtRestrainingOrder',
        resolver: (_p, opts) => yesNo(false, opts),
    },

    // =========================================================================
    // INDICTMENT / COURT FELONY CHARGE — always No
    // =========================================================================
    {
        patterns: [
            'are you under indictment or information in any court for a felony',
            'under indictment or information in any court',
            'charged with violation of the uniform code of military justice',
            'charge has been referred to a general court-martial',
            'referred to a general court-martial',
            'crime for which the judge could imprison you for more than one year',
        ],
        intent: 'legal.indictmentOrFelonyCharge',
        resolver: (_p, opts) => yesNo(false, opts),
    },

    // =========================================================================
    // MENTAL HEALTH ADJUDICATION — always No
    // =========================================================================
    {
        patterns: [
            'have you ever been adjudicated as a mental defective',
            'adjudicated as a mental defective',
            'committed to a mental institution',
            'ever been committed to a mental institution',
            'mental health adjudication',
        ],
        intent: 'legal.mentalHealthAdjudication',
        resolver: (_p, opts) => yesNo(false, opts),
    },

    // =========================================================================
    // DOMESTIC VIOLENCE MISDEMEANOR — always No
    // =========================================================================
    {
        patterns: [
            'have you ever been convicted in any court of a misdemeanor crime of domestic violence',
            'misdemeanor crime of domestic violence',
            'convicted of a crime that included, as an element, the use of force against a person',
            'use of force against a person as identified in the instructions',
        ],
        intent: 'legal.domesticViolenceMisdemeanor',
        resolver: (_p, opts) => yesNo(false, opts),
    },

    // =========================================================================
    // FELONY CONVICTION — always No
    // =========================================================================
    {
        patterns: [
            'have you ever been convicted in any court, including a military court, of a felony',
            'convicted in any court of a felony',
            'convicted of a felony',
            'crime for which the judge could have imprisoned you for more than one year',
            'even if you received a shorter sentence including probation',
            'have you ever been convicted of a crime',
            'ever been convicted of a felony',
        ],
        intent: 'legal.felonyConviction',
        resolver: (_p, opts) => yesNo(false, opts),
    },

    // =========================================================================
    // DISHONORABLE DISCHARGE — always No
    // =========================================================================
    {
        patterns: [
            'have you ever been discharged from the armed forces under dishonorable conditions',
            'discharged from the armed forces under dishonorable conditions',
            'dishonorable discharge',
            'dishonorably discharged',
            'discharged under dishonorable conditions',
        ],
        intent: 'legal.dishonorableDischarge',
        resolver: (_p, opts) => yesNo(false, opts),
    },

    // =========================================================================
    // RENOUNCED US CITIZENSHIP — always No
    // =========================================================================
    {
        patterns: [
            'have you ever renounced your united states citizenship',
            'renounced your united states citizenship',
            'renounced your us citizenship',
            'renounce your citizenship',
            'ever renounced citizenship',
        ],
        intent: 'legal.renouncedCitizenship',
        resolver: (_p, opts) => yesNo(false, opts),
    },

    // =========================================================================
    // FEDERAL FIREARMS LICENSEE (FFL) QUESTIONNAIRE — No for all restricted items
    // =========================================================================
    {
        patterns: [
            'federal firearms licensee employee accessor questionnaire',
            'federal firearms licensee',
            'ffl employee accessor',
            'firearms licensee questionnaire',
        ],
        intent: 'legal.fflQuestionnaire',
        resolver: (_p, opts) => {
            // Acknowledge / Agree to such compliance forms
            if (opts && opts.length > 0) {
                const agree = opts.find(o => {
                    const l = o.toLowerCase();
                    return l.includes('agree') || l.includes('acknowledge') || l.includes('yes');
                });
                if (agree) return agree;
            }
            return 'I Agree';
        },
    },

];


// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Attempt to resolve a question directly from the profile without AI.
 *
 * Includes "Static Hardcoding" (HARDCODED_RULES) and "Dynamic Hardcoding" (Learned Patterns).
 *
 * @returns HardcodedResult if resolved, or null if this question needs AI handling.
 */
export function resolveHardcoded(
    questionText: string,
    fieldType: FieldType | string | undefined,
    options: string[] | undefined,
    profile: any,
    learnedPatterns: any[] = []
): HardcodedResult | null {

    // ─────────────────────────────────────────────────────────────────────────
    // PHASE 0: BLACKLIST — Skip placeholder/fake UI text immediately
    // These are not real questions and should never be sent to AI.
    // ─────────────────────────────────────────────────────────────────────────
    const QUESTION_BLACKLIST = [
        'start typing...',
        'start typing',
        'or drag and drop here',
        'drag and drop here',
        'drag and drop',
        'drag & drop',
        'click to upload',
        'browse files',
        'attach files',
        'drop files here',
        'upload file',
        'type here',
        'enter text here',
        'search...',
        '--select--',
        '-- select --',
        'none',
        'n/a',
        'enter here',
        'autofill from resume',
        'upload your resume here to autofill',
        'key application fields',
    ];

    const normalizedRaw = questionText.toLowerCase().trim()
        .replace(/[*?!]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    const isBlacklisted = QUESTION_BLACKLIST.some(b => {
        if (normalizedRaw === b) return true;
        // Only allow suffix starts if it's very specific, or if length is very close
        if (normalizedRaw.startsWith(b) && normalizedRaw.length < b.length + 5) return true;
        return false;
    });
    if (isBlacklisted) {
        console.log(`[HardcodedEngine] 🚫 Blacklisted placeholder question, skipping: "${questionText}"`);
        return { answer: '__SKIP__', intent: 'blacklisted', confidence: 1.0 };
    }

    const normalized = normalizedRaw;
    console.log(`[HardcodedEngine] 🚀 new logic: Searching in "autofill_canonical_profile" like: "${normalized}"`);

    // PHASE 1: CATCH-ALL (Profile-First Discovery)
    if (profile.customAnswers && typeof profile.customAnswers === 'object') {
        for (const [key, value] of Object.entries(profile.customAnswers)) {
            if (key.toLowerCase().trim().replace(/[*?!]/g, '') === normalized) {
                const matchedOption = matchOption(value, options);
                if (matchedOption) {
                    console.log(`[HardcodedEngine] ✅ Found in "local storage": "${matchedOption}" (intent: ${'customAnswers.' + key})`);
                    return {
                        answer: matchedOption,
                        intent: 'customAnswers.' + key,
                        confidence: 1.0
                    };
                }
            }
        }
    }

    if (profile.apiFields && typeof profile.apiFields === 'object') {
        for (const [key, value] of Object.entries(profile.apiFields)) {
            if (key.toLowerCase().trim().replace(/[*?!]/g, '') === normalized) {
                const matchedOption = matchOption(value, options);
                if (matchedOption) {
                    console.log(`[HardcodedEngine] ✅ Found in "local storage": "${matchedOption}" (intent: ${'apiFields.' + key})`);
                    return {
                        answer: matchedOption,
                        intent: 'apiFields.' + key,
                        confidence: 1.0
                    };
                }
            }
        }
    }

    // PHASE 1.5: CANONICAL OBJECT SEARCH (Deep Scan)
    // Here we check if the question refers to standard profile keys
    const canonicalSections: Record<string, any> = {
        'eeo': profile.eeo,
        'personal': profile.personal,
        'workAuthorization': profile.workAuthorization,
        'application': profile.application,
        'preferences': profile.preferences
    };

    for (const [sectionName, sectionData] of Object.entries(canonicalSections)) {
        if (!sectionData || typeof sectionData !== 'object') continue;

        for (const [key, value] of Object.entries(sectionData)) {
            // Normalize key for search: authorizedUS -> authorized u s -> authorized
            const normalizedKey = key.replace(/([A-Z])/g, ' $1').toLowerCase().trim();
            const segments = normalizedKey.split(' ');

            // STRICTER MATCHING: Only match if the whole key is present as a standalone concept
            // or if the key is very long and starts/ends with it.
            const keyMatch = normalized === normalizedKey || 
                            (normalized.length < 50 && normalized.includes(normalizedKey) && segments.every(s => s.length > 2));

            if (keyMatch) {
                // For EEO, be more careful: "gender" shouldn't match "transgender"
                if (sectionName === 'eeo' && normalized.includes('transgender') && key === 'gender') continue;

                const matchedOption = matchOption(value, options);
                if (matchedOption !== null) {
                    console.log(`[HardcodedEngine] ✅ Found in "local storage": "${matchedOption}" (intent: ${sectionName}.${key})`);
                    return {
                        answer: matchedOption,
                        intent: `${sectionName}.${key}`,
                        confidence: 1.0
                    };
                }
            }
        }
    }

    // PHASE 2: STATIC PATTERN RULES
    for (const rule of HARDCODED_RULES) {
        const patternMatch = rule.patterns.some(p => normalized.includes(p));
        if (!patternMatch) continue;

        if (rule.excludes) {
            const excluded = rule.excludes.some(e => normalized.includes(e));
            if (excluded) continue;
        }

        const answer = rule.resolver(profile, options);
        if (answer === null) continue;

        console.log(`[HardcodedEngine] ✅ Found in "generic mapping": "${answer}" (intent: ${rule.intent})`);
        return {
            answer,
            intent: rule.intent,
            confidence: 1.0
        };
    }

    // PHASE 3: DYNAMIC LEARNED PATTERNS
    if (learnedPatterns && learnedPatterns.length > 0) {
        for (const pattern of learnedPatterns) {
            const patternQ = (pattern.questionPattern || '').toLowerCase().trim().replace(/[*?!]/g, '');

            // TIGHTER MATCHING: If normalized is long, it must be an exact match OR a very significant part
            if (normalized === patternQ || (normalized.length < 100 && normalized.includes(patternQ) && patternQ.length > 10)) {
                if (pattern.answerMappings && pattern.answerMappings.length > 0) {
                    const firstMapping = pattern.answerMappings[0];
                    const val = firstMapping.variants?.[0] || firstMapping.canonicalValue;
                    const matchedOption = matchOption(val, options);
                    if (matchedOption) {
                        console.log(`[HardcodedEngine] ✅ Found! "${questionText}: ${matchedOption}" (intent: ${pattern.intent})`);
                        return {
                            answer: matchedOption,
                            intent: pattern.intent,
                            confidence: 1.0
                        };
                    }
                }
            }
        }
    }

    console.log(`[HardcodedEngine] ❌ Not found: "due to no matching static rules or profile data for ${normalized}"`);
    return null;
}

/**
 * Check if a question or an answer variant is new to the hardcoded engine.
 */
export function isNewToHardcodedEngine(questionText: string, intent: string, selectedValue: string): { isNewQuestion: boolean; isNewAnswer: boolean } {
    const normalizedQ = questionText.toLowerCase().trim().replace(/[*?!]/g, '');
    const rule = HARDCODED_RULES.find(r => r.intent === intent);

    let isNewQuestion = true;
    if (rule) {
        isNewQuestion = !rule.patterns.some(p => normalizedQ.includes(p));
    }

    const normalizedA = selectedValue.toLowerCase().trim();
    let isNewAnswer = true;

    for (const [key, syns] of Object.entries(HARDCODED_SYNONYMS)) {
        if (normalizedA === key || syns.includes(normalizedA)) {
            isNewAnswer = false;
            break;
        }
    }

    return { isNewQuestion, isNewAnswer };
}
/**
 * HARDCODED ANSWER ENGINE v1.0
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
    answer: string;
    intent: string;
    confidence: number;
}

type Resolver = (profile: any, options?: string[]) => string | null;

interface HardcodedRule {
    patterns: string[];
    excludes?: string[];
    intent: string;
    resolver: Resolver;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Match a value against dropdown options using exact → synonym → partial → Specificity Scoring.
 * 
 * Truth-Aware: If the profile value implies a specific intent (like NO), 
 * it will skip matching any options that imply the opposite intent (YES).
 */
function matchOption(value: any, options?: string[]): string | null {
    if (!options || options.length === 0) return value !== null && value !== undefined ? String(value) : null;

    const v = String(value).toLowerCase().trim();

    // Truth-Awareness: Detect if we are dealing with a clear YES/NO intent
    const isNoIntent = v === 'no' || v === 'false' || value === false;
    const isYesIntent = v === 'yes' || v === 'true' || value === true;

    // 1. Exact match
    const exact = options.find(o => o.toLowerCase().trim() === v);
    if (exact) return exact;

    // 2. Truth-Filtered matching
    const filteredOptions = options.filter(o => {
        const ol = o.toLowerCase().trim();
        if (isNoIntent) {
            // Skip options that clearly mean YES
            if (ol === 'yes' || ol === 'true' || ol.startsWith('yes,') || ol === 'i do' || ol === 'y') return false;
        }
        if (isYesIntent) {
            // Skip options that clearly mean NO
            if (ol === 'no' || ol === 'false' || ol.startsWith('no,') || ol.includes('none') || ol === 'n') return false;
        }
        return true;
    });

    // 3. Synonym map
    const synonyms: Record<string, string[]> = {
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
        'not a veteran': ['i am not a protected veteran', 'i am not a veteran', 'not a protected veteran',
            'not applicable', 'none of the above', 'no military service'],
        'no disability': ['i do not have a disability', 'no, i do not have a disability',
            'i don\'t have a disability', 'no disability'],
    };

    for (const [key, syns] of Object.entries(synonyms)) {
        if (v === key || syns.includes(v)) {
            const match = filteredOptions.find(o => {
                const ol = o.toLowerCase().trim();
                return ol === key || syns.some(s => ol === s || ol.includes(s));
            });
            if (match) return match;
        }
    }

    // 4. Partial containment (only if not a tiny string)
    if (v.length >= 3) {
        const partial = filteredOptions.find(o => {
            const ol = o.toLowerCase();
            return ol.includes(v) || v.includes(ol);
        });
        if (partial) return partial;
    }

    // 5. Word-level SPECIFICITY scoring (excluding generic terms)
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
        // Check if words match (with basic plural/singular normalization)
        const matchedCount = words.filter(w => {
            if (ol.includes(w)) return true;
            // "States" matches "State"
            if (w.endsWith('s') && ol.includes(w.slice(0, -1))) return true;
            if (!w.endsWith('s') && ol.includes(w + 's')) return true;
            return false;
        }).length;

        if (matchedCount > maxMatchedWords) {
            maxMatchedWords = matchedCount;
            bestMatch = opt;
        } else if (matchedCount === maxMatchedWords && matchedCount > 0 && bestMatch) {
            // TIE-BREAKER: Prefer the shorter string (Precision over Breadth)
            if (opt.length < bestMatch.length) {
                bestMatch = opt;
            }
        }
    }

    // QUALITY CHECK: Ensure robust matching
    const matchRatio = maxMatchedWords / words.length;
    if (bestMatch && (matchRatio >= 0.5 || maxMatchedWords >= 2)) {
        console.log(`[HardcodedEngine] 🎯 Specificity match: "${v}" -> "${bestMatch}" (${maxMatchedWords}/${words.length} words matched)`);
        return bestMatch;
    }

    return null;
}

/** Produce Yes or No answer, matching against dropdown options. */
function yesNo(value: boolean, options?: string[]): string {
    const raw = value ? 'Yes' : 'No';
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
        }) || 'No';
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

const RULES: HardcodedRule[] = [

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
            'are you currently able to meet this requirement',          // onsite yes question
            'are you able to meet this requirement',
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
    // SPONSORSHIP — always NO (derived from profile)
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
        ],
        intent: 'workAuthorization.needsSponsorship',
        resolver: (p, opts) => {
            const val = p.workAuthorization?.needsSponsorship;
            return val !== undefined ? yesNo(val, opts) : yesNo(false, opts);
        }
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
        ],
        excludes: ['not comfortable', 'not able'],
        intent: 'application.yesPolicy',
        resolver: (_p, opts) => yesNo(true, opts)
    },

    // =========================================================================
    // NO QUESTIONS — disabilities, transgender, referred, former employee, etc.
    // =========================================================================
    {
        patterns: [
            'do you identify as transgender',
            'do you identify as transgender?',
        ],
        intent: 'eeo.transgender',
        resolver: (_p, opts) => yesNo(false, opts)
    },
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
        ],
        intent: 'application.previouslyEmployed',
        resolver: (p, opts) => {
            const val = p.application?.previouslyEmployed;
            return yesNo(val === true, opts);
        }
    },
    {
        patterns: [
            'will you now or in the future require sponsorship for employment',
            'would you require our sponsorship for your work visa application',
        ],
        intent: 'workAuthorization.needsSponsorship',
        resolver: (p, opts) => yesNo(p.workAuthorization?.needsSponsorship === true, opts)
    },
    {
        patterns: [
            'do you have a disability or chronic condition',
            'do you have a physical or mental disability',
            'disability or chronic condition',
        ],
        excludes: ['accommodation'],
        intent: 'eeo.disability',
        resolver: (p, opts) => {
            const val = p.eeo?.disability;
            if (val && val !== 'No' && val !== 'Decline') {
                return matchOption(val, opts) || yesNo(false, opts);
            }
            return yesNo(false, opts);
        }
    },

    // =========================================================================
    // EEO — Identity questions
    // =========================================================================
    {
        patterns: ['are you a veteran', 'are you a current or former veteran', 'are you an active member of the united states armed forces'],
        intent: 'eeo.veteran',
        resolver: (p, opts) => {
            const val = p.eeo?.veteran;
            if (val) return matchOption(val, opts) || yesNo(false, opts);
            // Default "I am not a protected veteran"
            return matchOption('not a veteran', opts) || yesNo(false, opts);
        }
    },
    {
        patterns: ['veteran status', 'protected veteran', 'military status', 'served in military', 'military service'],
        excludes: ['are you a'],
        intent: 'eeo.veteran',
        resolver: (p, opts) => {
            const val = p.eeo?.veteran;
            if (val) return matchOption(val, opts) || matchOption('not a veteran', opts) || val;
            return matchOption('not a veteran', opts) || matchOption('i am not a protected veteran', opts) || 'No';
        }
    },
    {
        patterns: ['are you hispanic', 'are you hispanic/latino', 'are you hispanic or latino',
            'hispanic or latino', 'hispanic/latino'],
        intent: 'eeo.hispanic',
        resolver: (p, opts) => {
            const val = p.eeo?.hispanic;
            if (val) return matchOption(val, opts) || val;
            return yesNo(false, opts);
        }
    },
    {
        patterns: ['gender', 'gender identity', 'how would you describe your gender identity',
            'how do you identify your gender', 'what is your gender'],
        excludes: ['race', 'ethnicity', 'sexual orientation', 'lgbtq'],
        intent: 'eeo.gender',
        resolver: (p, opts) => {
            const val = p.eeo?.gender;
            if (val) return matchOption(val, opts) || val;
            return matchOption('prefer not to say', opts) || 'Prefer not to say';
        }
    },
    {
        patterns: ['disability status', 'do you have a disability', 'disability or handicap'],
        excludes: ['accommodation', 'chronic condition'],
        intent: 'eeo.disability',
        resolver: (p, opts) => {
            const val = p.eeo?.disability;
            if (val) return matchOption(val, opts) || val;
            return matchOption('no disability', opts) || matchOption('no, i do not have a disability', opts) || 'No';
        }
    },
    {
        patterns: ['race', 'racial background', 'ethnic background', 'racial/ethnic background',
            'racial or ethnic', 'how would you describe your racial'],
        excludes: ['hispanic', 'latino'],
        intent: 'eeo.race',
        resolver: (p, opts) => {
            const val = p.eeo?.race;
            if (val) return matchOption(val, opts) || val;
            return matchOption('prefer not to say', opts) || 'Prefer not to say';
        }
    },
    {
        patterns: ['are you hispanic', 'are you latino', 'hispanic/latino', 'hispanic or latino'],
        intent: 'eeo.hispanic',
        resolver: (p, opts) => {
            const val = p.eeo?.hispanic || p.customAnswers?.['Are you Hispanic/Latino?'];
            if (val) return matchOption(val, opts) || val;
            return matchOption('no', opts) || 'No';
        }
    },
    {
        patterns: ['onsite', 'working onsite', 'meet this requirement', 'in-person'],
        intent: 'onsite.ableToMeet',
        resolver: (p, opts) => yesNo(true, opts)
    },
    {
        patterns: ['sexual orientation', 'how would you describe your sexual orientation', 'lgbtq'],
        intent: 'eeo.sexualOrientation',
        resolver: (p, opts) => {
            const val = p.eeo?.sexualOrientation;
            if (val) return matchOption(val, opts) || val;
            return matchOption('prefer not to say', opts) || 'Prefer not to say';
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
                p.customAnswers?.['howDidYouHear'] ||
                p.customAnswers?.['how did you hear about us'];
            if (val) return matchOption(val, opts) || val;
            // Default: LinkedIn
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
        resolver: (p, _opts) => {
            return p.application?.referralName || '';
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
            // Use last education entry (oldest = usually high school)
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
            // Calculate from earliest start date to now
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

            // Match against range options like "3-5 years", "5+ years", etc.
            const num = years;
            const rangeMatch = opts.find(o => {
                const ol = o.toLowerCase().replace(/\s+/g, '');
                // "5+" means 5 or more
                const plusMatch = ol.match(/^(\d+)\+/);
                if (plusMatch && num >= parseInt(plusMatch[1], 10)) return true;
                // "3-5" range
                const rangeMatch2 = ol.match(/^(\d+)-(\d+)/);
                if (rangeMatch2 && num >= parseInt(rangeMatch2[1], 10) && num <= parseInt(rangeMatch2[2], 10)) return true;
                // "less than 1", "0-1" etc.
                if (ol.includes('lessthan1') && num < 1) return true;
                // exact number
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
        patterns: ['full name', 'your name', 'legal name'],
        excludes: ['first', 'last', 'reference', 'emergency'],
        intent: 'personal.fullName',
        resolver: (p) => {
            const f = p.personal?.firstName, l = p.personal?.lastName;
            if (f && l) return `${f} ${l}`;
            return f || l || null;
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
        resolver: (p) => p.personal?.phone || null
    },
    {
        patterns: ['linkedin', 'linkedin profile', 'linkedin url', 'linked in profile'],
        excludes: ['github', 'portfolio'],
        intent: 'personal.linkedin',
        resolver: (p) => p.personal?.linkedin || p.social?.linkedin || null
    },
    {
        patterns: ['github', 'github profile', 'github url'],
        intent: 'personal.github',
        resolver: (p) => p.personal?.github || p.social?.github || null
    },
    {
        patterns: ['portfolio', 'personal website', 'website', 'online portfolio', 'portfolio url'],
        excludes: ['linkedin', 'github'],
        intent: 'personal.portfolio',
        resolver: (p) => p.personal?.portfolio || p.social?.website || null
    },
    {
        patterns: ['city', 'current city', 'location city', 'please list your current city'],
        excludes: ['state', 'country', 'zip', 'postal'],
        intent: 'personal.city',
        resolver: (p, opts) => {
            const val = p.personal?.city;
            if (!val) return null;
            return matchOption(val, opts) || val;
        }
    },
    {
        patterns: ['state', 'province', 'current state', 'state/province', 'region'],
        excludes: ['city', 'country', 'zip', 'united states'],
        intent: 'personal.state',
        resolver: (p, opts) => {
            const val = p.personal?.state;
            if (!val) return null;
            return matchOption(val, opts) || val;
        }
    },
    {
        patterns: ['zip code', 'postal code', 'zip', 'postcode', 'post code', 'pincode'],
        intent: 'personal.postalCode',
        resolver: (p) => p.personal?.postalCode || null
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

    // =========================================================================
    // "WHAT INTERESTS YOU" — standard boilerplate answer
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
            // Check customAnswers first
            const custom = p.customAnswers?.['whyInterested'] ||
                p.customAnswers?.['what interests you most about working with us'];
            if (custom) return custom;
            // Standard boilerplate
            return "I'm excited about the opportunity to contribute to a fast-growing, innovative organization " +
                "that is making a meaningful impact in its industry while offering strong opportunities " +
                "for learning and growth.";
        }
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
        resolver: (p, opts) => yesNo(p.application?.hasRelatives === true, opts)
    },
    {
        patterns: ['government background', 'worked for government', 'federal employment', 'government employee'],
        intent: 'application.governmentBackground',
        resolver: (p, opts) => yesNo(p.application?.governmentBackground === true, opts)
    },
];

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Attempt to resolve a question directly from the profile without AI.
 *
 * @returns HardcodedResult if resolved, or null if this question needs learned/fuzzy/AI handling.
 */
export function resolveHardcoded(
    questionText: string,
    _fieldType: string | undefined,
    options: string[] | undefined,
    profile: any
): HardcodedResult | null {

    const normalized = questionText.toLowerCase().trim()
        .replace(/[*?!]/g, '')   // strip common punctuation
        .replace(/\s+/g, ' ')
        .trim();

    // PHASE 1: CATCH-ALL (Profile-First Discovery)
    // If the user has explicitly answered this exact question text before, use it.
    if (profile.customAnswers && typeof profile.customAnswers === 'object') {
        for (const [key, value] of Object.entries(profile.customAnswers)) {
            if (key.toLowerCase().trim().replace(/[*?!]/g, '') === normalized) {
                console.log(`[HardcodedEngine] 🎯 Catch-All match in customAnswers: "${key}"`);
                const matchedOption = matchOption(value, options);
                if (matchedOption) {
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
                console.log(`[HardcodedEngine] 🎯 Catch-All match in apiFields: "${key}"`);
                const matchedOption = matchOption(value, options);
                if (matchedOption) {
                    return {
                        answer: matchedOption,
                        intent: 'apiFields.' + key,
                        confidence: 1.0
                    };
                }
            }
        }
    }

    // PHASE 2: PATTERN-BASED RULES
    for (const rule of RULES) {

        // Check if any pattern matches
        const patternMatch = rule.patterns.some(p => normalized.includes(p));
        if (!patternMatch) continue;

        // Check exclusions — if any exclusion keyword found, skip this rule
        if (rule.excludes) {
            const excluded = rule.excludes.some(e => normalized.includes(e));
            if (excluded) continue;
        }

        // Run resolver
        const answer = rule.resolver(profile, options);

        // null means "can't resolve from profile" (e.g. field is empty) — fall through
        if (answer === null) continue;

        // Empty string is a valid answer (e.g. blank referral name field)
        console.log(`[HardcodedEngine] ⚡ "${questionText}" → intent:${rule.intent} answer:"${answer}"`);

        return {
            answer,
            intent: rule.intent,
            confidence: 1.0
        };
    }

    return null; // Not handled — fall through to learned/fuzzy/AI
}

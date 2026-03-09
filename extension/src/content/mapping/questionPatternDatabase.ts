/**
 * COMPREHENSIVE QUESTION PATTERN DATABASE v2.0
 * ============================================
 * 
 * Features:
 * - 200+ question patterns covering all major ATS systems
 * - Cascading detection for multi-level dropdowns
 * - Context-aware matching using parent sections
 * - Exclusion patterns to avoid false matches
 * - Priority ordering for accurate intent classification
 * 
 * Compatible with: Workday, Greenhouse, Lever, iCIMS, Taleo, SmartRecruiters, BambooHR
 */

export interface QuestionPattern {
    patterns: string[];           // Question text patterns (lowercase)
    intent: string;               // Canonical profile path (e.g., "education.school")
    fieldTypes?: string[];        // Expected field types
    priority?: number;            // Higher = check first (default: 0)
    excludePatterns?: string[];   // Patterns that DISQUALIFY this match
    contextPatterns?: string[];   // Parent section must contain these
    cascadeParent?: string;       // Parent question that triggers this
    cascadeValues?: string[];     // Parent values that trigger this
}

/**
 * COMPREHENSIVE QUESTION PATTERNS
 * Organized by category with priority ordering
 */
export const QUESTION_PATTERNS: QuestionPattern[] = [

    // ========================================================================
    // PERSONAL INFORMATION (Priority: 100-95)
    // ========================================================================

    {
        patterns: ['first name', 'firstname', 'given name', 'forename', 'name first'],
        intent: 'personal.firstName',
        fieldTypes: ['text'],
        priority: 100,
        excludePatterns: ['last', 'middle', 'preferred', 'emergency', 'reference']
    },
    {
        patterns: ['full name', 'fullname', 'name full', 'name✱', 'name *', 'your name', 'complete name'],
        intent: 'personal.fullName',
        fieldTypes: ['text'],
        priority: 100,
        excludePatterns: ['middle', 'preferred', 'emergency', 'reference']
    },
    {
        patterns: ['middle name', 'middle initial'],
        intent: 'personal.middleName',
        fieldTypes: ['text'],
        priority: 100,
        excludePatterns: ['first', 'last']
    },
    {
        patterns: ['last name', 'lastname', 'surname', 'family name', 'name last'],
        intent: 'personal.lastName',
        fieldTypes: ['text'],
        priority: 100,
        excludePatterns: ['first', 'middle', 'preferred', 'emergency', 'reference']
    },
    {
        patterns: ['preferred name', 'nickname', 'how should we call you', 'what should we call'],
        intent: 'personal.preferredName',
        fieldTypes: ['text'],
        priority: 95
    },
    {
        patterns: ['email', 'email address', 'e-mail', 'e mail'],
        intent: 'personal.email',
        fieldTypes: ['email', 'text'],
        priority: 100,
        excludePatterns: ['emergency', 'reference', 'alternate', 'secondary']
    },
    {
        patterns: ['phone number', 'phone', 'mobile number', 'telephone', 'contact number', 'cell phone'],
        intent: 'personal.phone',
        fieldTypes: ['tel', 'text'],
        priority: 100,
        excludePatterns: ['device type', 'phone type', 'country code', 'emergency', 'reference', 'alternate']
    },
    {
        patterns: ['phone device type', 'device type', 'phone type', 'mobile or home'],
        intent: 'personal.phoneDeviceType',
        fieldTypes: ['dropdown', 'radio'],
        priority: 98,
        contextPatterns: ['phone']
    },
    {
        patterns: ['country phone code', 'phone country code', 'country code', 'phone prefix', 'calling code'],
        intent: 'personal.phoneCountryCode',
        fieldTypes: ['dropdown'],
        priority: 98,
        contextPatterns: ['phone']
    },
    {
        patterns: ['address', 'street address', 'address line', 'home address', 'mailing address', 'residential address'],
        intent: 'personal.addressLine',
        fieldTypes: ['text', 'textarea'],
        priority: 95,
        excludePatterns: ['city', 'state', 'zip', 'country']
    },
    {
        patterns: ['city', 'current city', 'location city', 'town'],
        intent: 'personal.city',
        fieldTypes: ['text', 'dropdown'],
        priority: 95,
        excludePatterns: ['state', 'country']
    },
    {
        patterns: ['state', 'province', 'current state', 'state/province', 'region', 'territory'],
        intent: 'personal.state',
        fieldTypes: ['text', 'dropdown'],
        priority: 95,
        excludePatterns: ['city', 'country', 'zip']
    },
    {
        patterns: ['zip code', 'postal code', 'zip', 'postcode', 'post code', 'pincode', 'pin code'],
        intent: 'personal.postalCode',
        fieldTypes: ['text'],
        priority: 95,
        excludePatterns: ['city', 'state']
    },
    {
        patterns: ['country', 'current country', 'country of residence', 'nation'],
        intent: 'personal.country',
        fieldTypes: ['dropdown', 'text'],
        priority: 95,
        excludePatterns: ['phone code', 'calling code']
    },
    {
        patterns: ['date of birth', 'dob', 'birth date', 'birthday', 'birthdate'],
        intent: 'personal.dateOfBirth',
        fieldTypes: ['date', 'text'],
        priority: 90
    },
    {
        patterns: ['social security', 'ssn', 'social security number', 'last 4 ssn', 'last four digits'],
        intent: 'personal.ssn',
        fieldTypes: ['text', 'password'],
        priority: 90
    },
    {
        patterns: ['pronouns', 'preferred pronouns', 'pronoun preference', 'gender pronouns'],
        intent: 'personal.pronouns',
        fieldTypes: ['dropdown', 'text'],
        priority: 85
    },

    // Social Links
    {
        patterns: ['linkedin', 'linkedin profile', 'linkedin url', 'linked in'],
        intent: 'personal.linkedin',
        fieldTypes: ['url', 'text'],
        priority: 90,
        excludePatterns: ['github', 'portfolio']
    },
    {
        patterns: ['github', 'github profile', 'github url', 'github username'],
        intent: 'personal.github',
        fieldTypes: ['url', 'text'],
        priority: 90,
        excludePatterns: ['linkedin', 'portfolio']
    },
    {
        patterns: ['portfolio', 'website', 'personal website', 'online portfolio', 'portfolio url'],
        intent: 'personal.portfolio',
        fieldTypes: ['url', 'text'],
        priority: 90,
        excludePatterns: ['linkedin', 'github']
    },
    {
        patterns: ['twitter', 'twitter handle', '@twitter', 'twitter profile'],
        intent: 'personal.twitter',
        fieldTypes: ['text', 'url'],
        priority: 85
    },
    {
        patterns: ['instagram', 'instagram handle', '@instagram'],
        intent: 'personal.instagram',
        fieldTypes: ['text', 'url'],
        priority: 85
    },

    // ========================================================================
    // EDUCATION (Priority: 80-75)
    // ========================================================================

    {
        patterns: ['start month', 'starting month', 'month started'],
        intent: 'education.startMonth',
        fieldTypes: ['dropdown', 'text'],
        priority: 85,
        contextPatterns: ['education'],
        excludePatterns: ['end', 'completion']
    },
    {
        patterns: ['start year', 'starting year', 'year started', 'started in'],
        intent: 'education.startYear',
        fieldTypes: ['dropdown', 'text'],
        priority: 85,
        contextPatterns: ['education'],
        excludePatterns: ['end', 'completion']
    },
    {
        patterns: ['end month', 'ending month', 'month completed', 'graduation month'],
        intent: 'education.endMonth',
        fieldTypes: ['dropdown', 'text'],
        priority: 85,
        contextPatterns: ['education'],
        excludePatterns: ['start', 'enrollment']
    },
    {
        patterns: ['end year', 'ending year', 'year completed', 'graduation year', 'year of graduation'],
        intent: 'education.endYear',
        fieldTypes: ['dropdown', 'text'],
        priority: 85,
        contextPatterns: ['education'],
        excludePatterns: ['start', 'enrollment']
    },
    {
        patterns: ['school name', 'university name', 'college name', 'school', 'university', 'college', 'institution', 'educational institution'],
        intent: 'education.school',
        fieldTypes: ['text', 'dropdown', 'select', 'combobox'],
        priority: 80,
        contextPatterns: ['education'],
        excludePatterns: ['high school']
    },
    {
        patterns: ['high school', 'secondary school', 'hs diploma', 'high school name'],
        intent: 'education.highSchool',
        fieldTypes: ['text'],
        priority: 80
    },
    {
        patterns: [
            'degree type', 'degree', 'education level', 'highest degree', 'degree earned',
            'highest education obtained', 'highest level count', 'education attained',
            'highest level of education', 'level of education', 'educational level'
        ],
        intent: 'education.degree',
        fieldTypes: ['dropdown', 'text', 'select', 'combobox', 'radio'],
        priority: 80,
        contextPatterns: ['education']
    },
    {
        patterns: ['major', 'field of study', 'discipline', 'concentration', 'specialization', 'area of study'],
        intent: 'education.major',
        fieldTypes: ['text', 'dropdown', 'select', 'combobox'],
        priority: 80,
        contextPatterns: ['education']
    },
    {
        patterns: ['gpa', 'grade point average', 'grades', 'cumulative gpa'],
        intent: 'education.gpa',
        fieldTypes: ['text', 'number'],
        priority: 75,
        contextPatterns: ['education']
    },
    {
        patterns: ['graduation date', 'graduation year', 'completion date', 'graduated', 'degree date'],
        intent: 'education.endDate',
        fieldTypes: ['text', 'date', 'dropdown'],
        priority: 75,
        contextPatterns: ['education']
    },
    {
        patterns: ['start date', 'enrollment date', 'started', 'attended from'],
        intent: 'education.startDate',
        fieldTypes: ['text', 'date', 'dropdown'],
        priority: 75,
        contextPatterns: ['education'],
        excludePatterns: ['graduation', 'completion']
    },
    {
        patterns: ['currently studying', 'currently enrolled', 'still in school', 'currently attending'],
        intent: 'education.currentlyStudying',
        fieldTypes: ['checkbox', 'radio', 'dropdown'],
        priority: 75,
        contextPatterns: ['education']
    },
    {
        patterns: ['activities', 'extracurricular', 'clubs', 'student organizations', 'campus activities'],
        intent: 'education.activities',
        fieldTypes: ['textarea', 'text'],
        priority: 70,
        contextPatterns: ['education']
    },
    {
        patterns: ['honors', 'academic honors', 'dean list', 'awards', 'distinctions', 'achievements'],
        intent: 'education.honors',
        fieldTypes: ['textarea', 'text'],
        priority: 70,
        contextPatterns: ['education']
    },

    // ========================================================================
    // WORK EXPERIENCE (Priority: 70-65)
    // ========================================================================

    {
        patterns: ['company name', 'company', 'employer', 'organization', 'employer name', 'organization name'],
        intent: 'experience.company',
        fieldTypes: ['text'],
        priority: 70,
        contextPatterns: ['experience', 'employment', 'work history'],
        excludePatterns: ['location', 'address']
    },
    {
        patterns: ['job title', 'title', 'position', 'role', 'job role', 'position title', 'your title'],
        intent: 'experience.title',
        fieldTypes: ['text'],
        priority: 70,
        contextPatterns: ['experience', 'employment', 'work history']
    },
    {
        patterns: ['job type', 'employment type', 'position type', 'full time', 'part time'],
        intent: 'experience.jobType',
        fieldTypes: ['dropdown', 'radio'],
        priority: 68,
        contextPatterns: ['experience', 'employment']
    },
    {
        patterns: ['work location', 'job location', 'office location', 'location', 'city state'],
        intent: 'experience.location',
        fieldTypes: ['text'],
        priority: 68,
        contextPatterns: ['experience', 'employment', 'work history']
    },
    {
        patterns: ['supervisor name', 'supervisor', 'manager', 'manager name', 'reporting to', 'reports to'],
        intent: 'experience.supervisorName',
        fieldTypes: ['text'],
        priority: 67,
        contextPatterns: ['experience', 'employment']
    },
    {
        patterns: ['supervisor phone', 'supervisor contact', 'manager phone'],
        intent: 'experience.supervisorPhone',
        fieldTypes: ['tel', 'text'],
        priority: 67,
        contextPatterns: ['experience', 'employment', 'supervisor']
    },
    {
        patterns: ['currently working', 'current position', 'still working here', 'present', 'current job', 'currently employed'],
        intent: 'experience.currentlyWorking',
        fieldTypes: ['checkbox', 'radio', 'dropdown'],
        priority: 70,
        contextPatterns: ['experience', 'employment']
    },

    // Date fields - specific for experience
    {
        patterns: ['from month', 'start month', 'month (mm)', 'starting month'],
        intent: 'experience.startMonth',
        fieldTypes: ['dropdown', 'text'],
        priority: 75,
        contextPatterns: ['experience', 'employment', 'work history'],
        excludePatterns: ['to', 'end', 'graduation']
    },
    {
        patterns: ['from year', 'start year', 'year (yyyy)', 'starting year', 'yyyy'],
        intent: 'experience.startYear',
        fieldTypes: ['dropdown', 'text'],
        priority: 75,
        contextPatterns: ['experience', 'employment', 'work history'],
        excludePatterns: ['to', 'end', 'graduation']
    },
    {
        patterns: ['to month', 'end month', 'ending month'],
        intent: 'experience.endMonth',
        fieldTypes: ['dropdown', 'text'],
        priority: 75,
        contextPatterns: ['experience', 'employment', 'work history'],
        excludePatterns: ['from', 'start']
    },
    {
        patterns: ['to year', 'end year', 'ending year'],
        intent: 'experience.endYear',
        fieldTypes: ['dropdown', 'text'],
        priority: 75,
        contextPatterns: ['experience', 'employment', 'work history'],
        excludePatterns: ['from', 'start']
    },

    {
        patterns: ['responsibilities', 'job description', 'duties', 'achievements', 'role description', 'describe your role', 'what did you do'],
        intent: 'experience.bullets',
        fieldTypes: ['textarea'],
        priority: 65,
        contextPatterns: ['experience', 'employment']
    },
    {
        patterns: ['reason for leaving', 'why did you leave', 'why leaving', 'departure reason'],
        intent: 'experience.reasonForLeaving',
        fieldTypes: ['text', 'dropdown', 'textarea'],
        priority: 65,
        contextPatterns: ['experience', 'employment']
    },
    {
        patterns: ['may we contact', 'contact this employer', 'reference check', 'ok to contact', 'contact employer'],
        intent: 'experience.mayContact',
        fieldTypes: ['radio', 'checkbox'],
        priority: 65,
        contextPatterns: ['experience', 'employment']
    },
    {
        patterns: ['current salary', 'present salary', 'current compensation', 'current pay'],
        intent: 'experience.currentSalary',
        fieldTypes: ['text', 'number'],
        priority: 65
    },

    // ========================================================================
    // WORK AUTHORIZATION (Priority: 90-85)
    // ========================================================================

    {
        patterns: [
            'are you able to work in the united states',
            'legal right to work in the united states',
            'do you have the legal right to work',
            'are you currently authorized to work',
        ],
        intent: 'workAuthorization.authorizedUS',
        fieldTypes: ['radio', 'dropdown'],
        priority: 90,
        excludePatterns: ['sponsorship', 'visa']
    },
    {
        patterns: [
            'sponsorship',
            'visa sponsorship',
            'require sponsorship',
            'need sponsorship',
            'h1b',
            'work visa',
            'visa support'
        ],
        intent: 'workAuthorization.needsSponsorship',
        fieldTypes: ['radio', 'dropdown'],
        priority: 90,
        excludePatterns: ['future']
    },
    {
        patterns: [
            'future sponsorship',
            'sponsorship in the future',
            'will you require sponsorship',
            'sponsorship down the road'
        ],
        intent: 'workAuthorization.needsFutureSponsorship',
        fieldTypes: ['radio', 'dropdown'],
        priority: 90
    },
    {
        patterns: [
            'citizenship',
            'citizenship status',
            'citizen',
            'are you a citizen',
            'us citizen'
        ],
        intent: 'workAuthorization.citizenshipStatus',
        fieldTypes: ['dropdown', 'radio'],
        priority: 88
    },
    {
        patterns: [
            'driver license',
            'drivers license',
            'driving license',
            'valid driver',
            'do you have a driver',
            'valid driving'
        ],
        intent: 'workAuthorization.driverLicense',
        fieldTypes: ['radio', 'dropdown'],
        priority: 85
    },
    {
        patterns: [
            'security clearance',
            'clearance level',
            'government clearance',
            'classified clearance'
        ],
        intent: 'workAuthorization.securityClearance',
        fieldTypes: ['dropdown', 'radio', 'text'],
        priority: 85
    },

    // ========================================================================
    // EEO / DEMOGRAPHIC (Priority: 85-80)
    // ========================================================================

    {
        patterns: ['gender', 'sex', 'gender identity', 'gender preference'],
        intent: 'eeo.gender',
        fieldTypes: ['dropdown', 'radio'],
        priority: 85,
        excludePatterns: ['race', 'ethnicity']
    },
    {
        patterns: ['race', 'ethnicity', 'racial', 'ethnic background', 'ethnic group'],
        intent: 'eeo.race',
        fieldTypes: ['dropdown', 'radio', 'checkbox'],
        priority: 85,
        excludePatterns: ['hispanic', 'latino']
    },
    {
        patterns: ['hispanic', 'latino', 'hispanic or latino', 'are you hispanic', 'latina'],
        intent: 'eeo.hispanic',
        fieldTypes: ['dropdown', 'radio'],
        priority: 85
    },
    {
        patterns: [
            'veteran',
            'military',
            'protected veteran',
            'veteran status',
            'served in military',
            'military service'
        ],
        intent: 'eeo.veteran',
        fieldTypes: ['dropdown', 'radio'],
        priority: 85
    },
    {
        patterns: [
            'disability',
            'disabled',
            'disability status',
            'have a disability',
            'do you have a disability',
            'physical disability',
            'mental disability'
        ],
        intent: 'eeo.disability',
        fieldTypes: ['dropdown', 'radio'],
        priority: 85
    },
    {
        patterns: ['lgbtq', 'sexual orientation', 'orientation', 'lgbt'],
        intent: 'eeo.lgbtq',
        fieldTypes: ['dropdown', 'radio'],
        priority: 80
    },

    // ========================================================================
    // SKILLS, CERTIFICATIONS, LANGUAGES (Priority: 75-70)
    // ========================================================================

    {
        patterns: ['skills', 'technical skills', 'skill set', 'competencies', 'your skills', 'relevant skills'],
        intent: 'skills',
        fieldTypes: ['textarea', 'text', 'dropdown'],
        priority: 75,
        excludePatterns: ['certification', 'language']
    },
    {
        patterns: ['certifications', 'certificates', 'professional certifications', 'licenses', 'credentials'],
        intent: 'certifications',
        fieldTypes: ['textarea', 'text'],
        priority: 75,
        excludePatterns: ['skill', 'language']
    },
    {
        patterns: ['languages', 'language proficiency', 'spoken languages', 'fluent in', 'language skills'],
        intent: 'languages.language',
        fieldTypes: ['textarea', 'text', 'dropdown'],
        priority: 75,
        excludePatterns: ['proficiency level', 'reading', 'writing', 'speaking']
    },
    {
        patterns: ['proficiency', 'proficiency level', 'fluency', 'language level'],
        intent: 'languages.proficiency',
        fieldTypes: ['dropdown', 'radio'],
        priority: 73,
        contextPatterns: ['language']
    },
    {
        patterns: ['reading proficiency', 'reading level', 'reading'],
        intent: 'languages.reading',
        fieldTypes: ['dropdown', 'radio'],
        priority: 73,
        contextPatterns: ['language']
    },
    {
        patterns: ['speaking proficiency', 'speaking level', 'speaking'],
        intent: 'languages.speaking',
        fieldTypes: ['dropdown', 'radio'],
        priority: 73,
        contextPatterns: ['language']
    },
    {
        patterns: ['writing proficiency', 'writing level', 'writing'],
        intent: 'languages.writing',
        fieldTypes: ['dropdown', 'radio'],
        priority: 73,
        contextPatterns: ['language']
    },

    // ========================================================================
    // PROFESSIONAL DEVELOPMENT (Priority: 70-65)
    // ========================================================================

    {
        patterns: ['professional memberships', 'associations', 'organizations', 'member of', 'professional organizations'],
        intent: 'professionalMemberships',
        fieldTypes: ['textarea', 'text'],
        priority: 70
    },
    {
        patterns: ['publications', 'published work', 'research papers', 'academic publications'],
        intent: 'publications',
        fieldTypes: ['textarea', 'text'],
        priority: 70
    },
    {
        patterns: ['patents', 'patent applications', 'intellectual property'],
        intent: 'patents',
        fieldTypes: ['textarea', 'text'],
        priority: 70
    },
    {
        patterns: ['projects', 'key projects', 'notable projects', 'project experience'],
        intent: 'projects',
        fieldTypes: ['textarea', 'text'],
        priority: 70
    },
    {
        patterns: ['volunteer', 'volunteer work', 'community service', 'volunteer experience', 'volunteering'],
        intent: 'volunteer.organization',
        fieldTypes: ['text', 'textarea'],
        priority: 68
    },

    // ========================================================================
    // REFERENCES (Priority: 70-65)
    // ========================================================================

    {
        patterns: ['reference name', 'references', 'professional reference', 'reference full name'],
        intent: 'references.name',
        fieldTypes: ['text'],
        priority: 70,
        contextPatterns: ['reference'],
        excludePatterns: ['phone', 'email', 'relationship']
    },
    {
        patterns: ['reference phone', 'reference contact', 'reference number', 'reference telephone'],
        intent: 'references.phone',
        fieldTypes: ['tel', 'text'],
        priority: 70,
        contextPatterns: ['reference']
    },
    {
        patterns: ['reference email', 'reference e-mail', 'reference email address'],
        intent: 'references.email',
        fieldTypes: ['email', 'text'],
        priority: 70,
        contextPatterns: ['reference']
    },
    {
        patterns: ['reference relationship', 'reference title', 'how do you know', 'relationship to reference'],
        intent: 'references.relationship',
        fieldTypes: ['text', 'dropdown'],
        priority: 68,
        contextPatterns: ['reference']
    },
    {
        patterns: ['reference company', 'reference employer', 'reference organization'],
        intent: 'references.company',
        fieldTypes: ['text'],
        priority: 68,
        contextPatterns: ['reference']
    },

    // ========================================================================
    // EMERGENCY CONTACT (Priority: 70-65)
    // ========================================================================

    {
        patterns: ['emergency contact', 'emergency name', 'in case of emergency', 'emergency contact name'],
        intent: 'emergencyContact.name',
        fieldTypes: ['text'],
        priority: 70,
        contextPatterns: ['emergency'],
        excludePatterns: ['phone', 'relationship']
    },
    {
        patterns: ['emergency phone', 'emergency contact number', 'emergency telephone'],
        intent: 'emergencyContact.phone',
        fieldTypes: ['tel', 'text'],
        priority: 70,
        contextPatterns: ['emergency']
    },
    {
        patterns: ['emergency relationship', 'relationship to you', 'emergency contact relationship'],
        intent: 'emergencyContact.relationship',
        fieldTypes: ['text', 'dropdown'],
        priority: 68,
        contextPatterns: ['emergency']
    },

    // ========================================================================
    // PREFERENCES & AVAILABILITY (Priority: 75-65)
    // ========================================================================

    {
        patterns: ['start date', 'available to start', 'when can you start', 'earliest start date', 'availability date', 'date available'],
        intent: 'preferences.startDate',
        fieldTypes: ['date', 'text', 'dropdown'],
        priority: 75,
        excludePatterns: ['experience', 'employment', 'education']
    },
    {
        patterns: ['notice period', 'how much notice', 'weeks notice', 'notice required'],
        intent: 'preferences.noticePeriod',
        fieldTypes: ['text', 'dropdown'],
        priority: 75
    },
    {
        patterns: [
            'salary expectations', 'desired salary', 'expected compensation',
            'salary requirement', 'salary range', 'desired pay'
        ],
        intent: 'preferences.desiredSalary',
        fieldTypes: ['text', 'number'],
        priority: 73
    },
    {
        patterns: [
            'willing to relocate',
            'relocation',
            'relocate',
            'move to',
            'open to relocation',
            'relocation preference'
        ],
        intent: 'preferences.willingToRelocate',
        fieldTypes: ['radio', 'dropdown'],
        priority: 73
    },
    {
        patterns: [
            'employment type preference',
            'job type preference',
            'full time or part time',
            'work schedule preference'
        ],
        intent: 'preferences.employmentTypes',
        fieldTypes: ['checkbox', 'dropdown', 'radio'],
        priority: 70
    },
    {
        patterns: ['remote work', 'work from home', 'remote preference', 'hybrid', 'remote position'],
        intent: 'preferences.remoteWork',
        fieldTypes: ['radio', 'dropdown'],
        priority: 70
    },
    {
        patterns: ['willing to travel', 'travel requirements', 'travel percentage', 'can you travel', 'travel availability'],
        intent: 'preferences.willingToTravel',
        fieldTypes: ['radio', 'dropdown', 'text'],
        priority: 70
    },
    {
        patterns: ['shift preference', 'day shift', 'night shift', 'rotating shift', 'shift availability'],
        intent: 'preferences.shiftPreference',
        fieldTypes: ['dropdown', 'checkbox', 'radio'],
        priority: 68
    },
    {
        patterns: ['overtime', 'work overtime', 'available for overtime', 'overtime availability'],
        intent: 'preferences.overtime',
        fieldTypes: ['radio', 'dropdown'],
        priority: 68
    },

    // ========================================================================
    // APPLICATION-SPECIFIC QUESTIONS (Priority: 75-70)
    // ========================================================================

    {
        patterns: [
            'previously applied',
            'applied before',
            'have you applied',
            'applied to this company',
            'prior application'
        ],
        intent: 'application.previouslyApplied',
        fieldTypes: ['radio', 'dropdown'],
        priority: 75
    },
    {
        patterns: [
            'previously employed',
            'worked here before',
            'former employee',
            'have you worked for',
            'past employee'
        ],
        intent: 'application.previouslyEmployed',
        fieldTypes: ['radio', 'dropdown'],
        priority: 75
    },
    {
        patterns: [
            'relatives',
            'family members',
            'know anyone',
            'friends or relatives',
            'employee referral',
            'know employees'
        ],
        intent: 'application.hasRelatives',
        fieldTypes: ['radio', 'dropdown', 'text'],
        priority: 73
    },
    {
        patterns: [
            'government',
            'government background',
            'classified',
            'worked for government',
            'federal employment'
        ],
        intent: 'application.governmentBackground',
        fieldTypes: ['radio', 'dropdown'],
        priority: 73
    },

    // ========================================================================
    // CASCADING: "HOW DID YOU HEAR" (Priority: 95-88)
    // ========================================================================

    {
        patterns: [
            'how did you hear',
            'where did you hear',
            'source of application',
            'how did you find',
            'referral source',
            'how did you learn'
        ],
        intent: 'application.howDidYouHear',
        fieldTypes: ['dropdown', 'text', 'select', 'radio'],
        priority: 95
    },

    // CASCADING LEVEL 2: Social Media Platform Details
    {
        patterns: [
            'social media platform',
            'which social media',
            'platform',
            'which platform',
            'which site',
            'specify platform'
        ],
        intent: 'customAnswers.howDidYouHearDetail',
        fieldTypes: ['dropdown', 'text', 'select'],
        priority: 92,
        cascadeParent: 'application.howDidYouHear',
        cascadeValues: ['social media', 'social network', 'social networking']
    },

    // CASCADING LEVEL 2: Job Board Details
    {
        patterns: [
            'which job board',
            'job board name',
            'which website',
            'job site',
            'specify job board'
        ],
        intent: 'customAnswers.jobBoardDetail',
        fieldTypes: ['dropdown', 'text', 'select'],
        priority: 92,
        cascadeParent: 'application.howDidYouHear',
        cascadeValues: ['job board', 'job site', 'online job board']
    },

    // Referral name
    {
        patterns: [
            'referral name',
            'referred by',
            'who referred you',
            'employee name',
            'referrer name',
            'name of person'
        ],
        intent: 'application.referralName',
        fieldTypes: ['text'],
        priority: 90,
        cascadeParent: 'application.howDidYouHear',
        cascadeValues: ['employee referral', 'referred by', 'referral', 'current employee']
    },

    // ========================================================================
    // ESSAY / OPEN-ENDED QUESTIONS (Priority: 75-70)
    // ========================================================================

    {
        patterns: [
            'why do you want',
            'why are you interested',
            'why this position',
            'why this role',
            'why this company',
            'what interests you',
            'motivation for applying'
        ],
        intent: 'customAnswers.whyInterested',
        fieldTypes: ['textarea'],
        priority: 75
    },
    {
        patterns: [
            'why should we hire',
            'why are you a good fit',
            'what makes you qualified',
            'your qualifications',
            'why you',
            'what do you bring'
        ],
        intent: 'customAnswers.whyHire',
        fieldTypes: ['textarea'],
        priority: 75
    },
    {
        patterns: [
            'cover letter',
            'letter of interest',
            'introduce yourself',
            'tell us about yourself'
        ],
        intent: 'customAnswers.coverLetterText',
        fieldTypes: ['textarea'],
        priority: 73
    },
    {
        patterns: [
            'additional information',
            'anything else',
            'additional comments',
            'other information',
            'is there anything'
        ],
        intent: 'customAnswers.additionalInfo',
        fieldTypes: ['textarea'],
        priority: 70
    },

    // ========================================================================
    // LEGAL & BACKGROUND CHECK (Priority: 85-75)
    // ========================================================================

    {
        patterns: [
            'convicted',
            'criminal record',
            'felony',
            'misdemeanor',
            'criminal history',
            'criminal background'
        ],
        intent: 'legal.criminalRecord',
        fieldTypes: ['radio', 'dropdown', 'textarea'],
        priority: 85
    },
    {
        patterns: [
            'background check',
            'authorize background',
            'consent to background',
            'background investigation'
        ],
        intent: 'consent.backgroundCheck',
        fieldTypes: ['checkbox', 'radio'],
        priority: 85
    },
    {
        patterns: [
            'drug test',
            'drug screening',
            'substance test',
            'drug testing'
        ],
        intent: 'consent.drugTest',
        fieldTypes: ['checkbox', 'radio'],
        priority: 85
    },
    {
        patterns: [
            'credit check',
            'authorize credit',
            'credit history',
            'credit background'
        ],
        intent: 'consent.creditCheck',
        fieldTypes: ['checkbox', 'radio'],
        priority: 80
    },

    // ========================================================================
    // CONSENT & AGREEMENTS (Priority: 80-70)
    // ========================================================================

    {
        patterns: [
            'consent',
            'agree to',
            'acknowledgment',
            'terms and conditions',
            'privacy policy',
            'i understand',
            'i acknowledge'
        ],
        intent: 'consent.agreedToAutofill',
        fieldTypes: ['checkbox', 'radio'],
        priority: 80
    },
    {
        patterns: [
            'sms',
            'text message',
            'receive texts',
            'text messages',
            'mobile messaging'
        ],
        intent: 'consent.smsOptIn',
        fieldTypes: ['checkbox', 'radio'],
        priority: 75
    },
    {
        patterns: [
            'email communication',
            'receive emails',
            'email updates',
            'marketing emails'
        ],
        intent: 'consent.emailOptIn',
        fieldTypes: ['checkbox', 'radio'],
        priority: 75
    },

    // ========================================================================
    // FILE UPLOADS (Priority: 95-90)
    // ========================================================================

    {
        patterns: ['resume', 'cv', 'curriculum vitae', 'upload resume', 'attach resume'],
        intent: 'documents.resume',
        fieldTypes: ['file'],
        priority: 95
    },
    {
        patterns: ['cover letter', 'covering letter', 'letter of interest', 'upload cover letter'],
        intent: 'documents.coverLetter',
        fieldTypes: ['file'],
        priority: 95
    },
    {
        patterns: ['transcript', 'transcripts', 'academic transcript', 'upload transcript'],
        intent: 'documents.transcript',
        fieldTypes: ['file'],
        priority: 90
    },
    {
        patterns: ['portfolio', 'work samples', 'portfolio file', 'upload portfolio'],
        intent: 'documents.portfolio',
        fieldTypes: ['file'],
        priority: 90
    },

];

// ============================================================================
// MATCHING FUNCTIONS
// ============================================================================

export interface MatchResult {
    intent: string;
    confidence: number;
    pattern: string;
    cascadeInfo?: {
        parentIntent: string;
        parentValue: string;
    };
}

/**
 * Find matching intent for a question with advanced context awareness
 * 
 * @param questionText - The question text (will be normalized)
 * @param fieldType - Optional field type for better matching
 * @param parentContext - Optional parent section text (e.g., "Work Experience")
 * @param previousAnswers - Optional map of previous answers for cascading
 * @returns Best matching intent or null
 */
export function findQuestionIntent(
    questionText: string,
    fieldType?: string,
    parentContext?: string,
    previousAnswers?: Map<string, string>
): MatchResult | null {

    const normalized = questionText.toLowerCase().trim();
    const contextNormalized = parentContext ? parentContext.toLowerCase().trim() : '';

    // Sort by priority (higher first)
    const sortedPatterns = [...QUESTION_PATTERNS].sort((a, b) =>
        (b.priority || 0) - (a.priority || 0)
    );

    for (const pattern of sortedPatterns) {
        // Check field type match (if specified)
        if (fieldType && pattern.fieldTypes && !pattern.fieldTypes.includes(fieldType)) {
            continue;
        }

        // Check exclusion patterns
        if (pattern.excludePatterns) {
            const hasExclusion = pattern.excludePatterns.some(exclude =>
                normalized.includes(exclude.toLowerCase())
            );
            if (hasExclusion) {
                continue;
            }
        }

        // Check context patterns
        if (pattern.contextPatterns && contextNormalized) {
            const hasContext = pattern.contextPatterns.some(ctx =>
                contextNormalized.includes(ctx.toLowerCase())
            );
            if (!hasContext) {
                continue;
            }
        }

        // Check cascading logic
        if (pattern.cascadeParent && pattern.cascadeValues && previousAnswers) {
            const parentValue = previousAnswers.get(pattern.cascadeParent);
            if (!parentValue) {
                continue; // Parent question not answered yet
            }

            const parentValueNormalized = parentValue.toLowerCase().trim();
            const matchesCascade = pattern.cascadeValues.some(cv =>
                parentValueNormalized.includes(cv.toLowerCase())
            );

            if (!matchesCascade) {
                continue; // Parent answer doesn't match required cascade values
            }
        }

        // Check if any pattern matches
        for (const p of pattern.patterns) {
            if (normalized.includes(p)) {
                const result: MatchResult = {
                    intent: pattern.intent,
                    confidence: (pattern.priority || 50) / 100,
                    pattern: p
                };

                // Add cascade info if applicable
                if (pattern.cascadeParent && previousAnswers) {
                    result.cascadeInfo = {
                        parentIntent: pattern.cascadeParent,
                        parentValue: previousAnswers.get(pattern.cascadeParent) || ''
                    };
                }

                console.log(
                    `[QuestionPatternDB] ✅ Matched "${questionText}" → ${pattern.intent} ` +
                    `(pattern: "${p}", priority: ${pattern.priority || 0})`
                );

                return result;
            }
        }
    }

    console.log(`[QuestionPatternDB] ❌ No match found for "${questionText}"`);
    return null;
}

/**
 * Get value from profile using intent path
 * Handles nested objects and arrays
 * 
 * @param profile - User's canonical profile
 * @param intent - Intent path (e.g., "education.school")
 * @returns Value from profile or null
 */
export function getValueByIntent(profile: any, intent: string): any {
    // 🟢 Priority Fallback: Check customAnswers first (Virtual Profile)
    if (profile?.customAnswers && profile.customAnswers[intent]) {
        return profile.customAnswers[intent];
    }

    const parts = intent.split('.');
    let value = profile;
    let lastPart = parts[parts.length - 1];

    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];

        // Handle array access (e.g., education[0].school)
        if (Array.isArray(value) && value.length > 0) {
            value = value[0]; // Use first entry for now
        }

        if (value && typeof value === 'object' && part in value) {
            value = value[part];
        } else {
            // SPECIAL CASE: Extract components from full date strings
            // If we're looking for .startYear or .startMonth but only have .startDate
            if (i === parts.length - 1 && (part.endsWith('Year') || part.endsWith('Month'))) {
                const baseKey = part.startsWith('start') ? 'startDate' : 'endDate';
                const parentValue = (value && typeof value === 'object') ? value[baseKey] : null;

                if (parentValue && typeof parentValue === 'string') {
                    // Try to parse YYYY-MM-DD or MM/YYYY or YYYY
                    if (part.endsWith('Year')) {
                        const yearMatch = parentValue.match(/\d{4}/);
                        if (yearMatch) return yearMatch[0];
                    } else if (part.endsWith('Month')) {
                        // Extract month (01-12) and convert to name if possible
                        const monthMatch = parentValue.match(/(?:^|-|\/)(\d{1,2})(?:-|\/|$)/);
                        if (monthMatch) {
                            const monthNum = parseInt(monthMatch[1]);
                            const months = [
                                'January', 'February', 'March', 'April', 'May', 'June',
                                'July', 'August', 'September', 'October', 'November', 'December'
                            ];
                            return months[monthNum - 1] || monthMatch[1];
                        }
                    }
                }
            }

            console.log(`[QuestionPatternDB] ⚠️ Intent path "${intent}" not found in profile`);
            return null;
        }
    }

    // SAFETY CHECK: Prevent returning file data objects (containing base64/url) for non-document intents.
    // This prevents text fields (like "Location") from being contaminated with PDF data.
    if (value && typeof value === 'object' && (value.base64 || value.url)) {
        if (!intent.startsWith('documents.')) {
            console.log(`[QuestionPatternDB] 🛡️ Blocked returning file object for non-document intent: ${intent}`);
            return null;
        }
    }

    return value;
}

/**
 * Check if a field should be skipped based on its label
 * (e.g., essay questions, open-ended questions)
 */
export function shouldSkipField(questionText: string): boolean {
    const skipPatterns = [
        // Only skip if they are very generic and we don't have a specific screening intent for them
        /tell us about/i,
        /explain your/i,
        /what makes you/i,
    ];

    const normalized = questionText.toLowerCase();
    return skipPatterns.some(pattern => pattern.test(normalized));
}

/**
 * Extract context from parent elements
 * Useful for determining which section a field belongs to
 */
export function extractSectionContext(element: HTMLElement): string {
    const contextSelectors = [
        '[data-automation-id*="experience"]',
        '[data-automation-id*="education"]',
        '[data-automation-id*="skill"]',
        '[data-automation-id*="language"]',
        '[data-automation-id*="certification"]',
        '[data-automation-id*="reference"]',
        '[data-automation-id*="emergency"]',
        'section',
        'fieldset'
    ];

    for (const selector of contextSelectors) {
        const parent = element.closest(selector);
        if (parent) {
            // Try to find a heading or label
            const heading = parent.querySelector('h1, h2, h3, h4, legend, [data-automation-id="promptLabel"]');
            if (heading && heading.textContent) {
                return heading.textContent.trim();
            }

            // Fallback to automation ID
            const automationId = parent.getAttribute('data-automation-id');
            if (automationId) {
                return automationId;
            }
        }
    }

    return '';
}

/**
 * Batch match multiple questions efficiently
 * Useful for scanning entire forms at once
 */
export function batchMatchQuestions(
    questions: Array<{ text: string; fieldType?: string; context?: string }>,
    previousAnswers?: Map<string, string>
): Map<string, MatchResult> {

    const results = new Map<string, MatchResult>();

    for (const q of questions) {
        const match = findQuestionIntent(q.text, q.fieldType, q.context, previousAnswers);
        if (match) {
            results.set(q.text, match);
        }
    }

    console.log(`[QuestionPatternDB] 📊 Batch matched ${results.size}/${questions.length} questions`);
    return results;
}

// ============================================================================
// USAGE EXAMPLES
// ============================================================================

/*

// Example 1: Simple matching
const result1 = findQuestionIntent("What is your first name?", "text");
// Returns: { intent: "personal.firstName", confidence: 1.0, pattern: "first name" }

// Example 2: Context-aware matching
const result2 = findQuestionIntent(
    "Start Year",
    "dropdown",
    "Work Experience"
);
// Returns: { intent: "experience.startYear", ... }

// Example 3: Cascading dropdowns
const previousAnswers = new Map();
previousAnswers.set("customAnswers.howDidYouHear", "Social Media");

const result3 = findQuestionIntent(
    "Which social media platform?",
    "dropdown",
    undefined,
    previousAnswers
);
// Returns: { intent: "customAnswers.howDidYouHearDetail", cascadeInfo: {...} }

// Example 4: Exclusion patterns
const result4 = findQuestionIntent("Phone Device Type", "dropdown");
// Returns: { intent: "personal.phoneDeviceType", ... }
// NOT "personal.phone" because "device type" is in excludePatterns

// Example 5: Get value from profile
const profile = {
    personal: {
        firstName: "John",
        phone: "1234567890"
    },
    education: [
        { school: "MIT", degree: "BS" }
    ]
};

const firstName = getValueByIntent(profile, "personal.firstName");
// Returns: "John"

const school = getValueByIntent(profile, "education.school");
// Returns: "MIT" (automatically handles array access)

*/
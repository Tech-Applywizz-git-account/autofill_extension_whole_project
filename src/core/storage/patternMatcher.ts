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

export class PatternMatcher {
    // ========================================
    // CANONICAL INTENT WHITELIST
    // ========================================
    private static readonly ALLOWED_INTENTS = new Set([
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
    private static readonly INTENT_KEYWORDS: Record<string, string[]> = {
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
    private static readonly FORBIDDEN_ANSWERS = [
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
    private static readonly STOP_WORDS = new Set([
        'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
        'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should',
        'could', 'may', 'might', 'must', 'can', 'of', 'at', 'by', 'for', 'with',
        'about', 'to', 'from', 'in', 'out', 'on', 'off', 'over', 'under',
        'you', 'your', 'we', 'our', 'this', 'that', 'these', 'those', 'what',
        'which', 'who', 'when', 'where', 'why', 'how', 'or', 'and', 'if', 'but',
    ]);

    /**
     * Normalize question for exact matching
     */
    static normalizeQuestion(question: string): string {
        return question
            .toLowerCase()
            .trim()
            .replace(/[?!.,*]/g, '')  // Remove punctuation
            .replace(/\s+/g, ' ')      // Collapse spaces
            .trim();
    }

    /**
     * Extract meaningful keywords from question
     */
    static extractKeywords(question: string): string[] {
        const normalized = this.normalizeQuestion(question);
        const words = normalized.split(/\s+/);

        return words.filter(word =>
            word.length >= 3 &&                    // At least 3 chars
            !this.STOP_WORDS.has(word) &&          // Not a stop word
            /[a-z]/.test(word)                      // Contains letters
        );
    }

    /**
     * Calculate keyword overlap between two questions
     */
    static calculateKeywordOverlap(keywords1: string[], keywords2: string[]): number {
        if (keywords1.length === 0 || keywords2.length === 0) return 0;

        const set1 = new Set(keywords1);
        const set2 = new Set(keywords2);

        const intersection = [...set1].filter(k => set2.has(k));
        const union = new Set([...keywords1, ...keywords2]);

        return intersection.length / union.size;
    }

    /**
     * Check if intent matches based on keywords
     */
    static matchesIntentKeywords(questionKeywords: string[], intent: string): boolean {
        const intentKeywords = this.INTENT_KEYWORDS[intent];
        if (!intentKeywords) return false;

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
    static isIntentValid(intent: string): boolean {
        return this.ALLOWED_INTENTS.has(intent);
    }

    /**
     * Check fieldType compatibility
     */
    static areFieldTypesCompatible(stored: string, incoming: string): boolean {
        if (stored === incoming) return true;

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
    static isAnswerUsable(answer: string): boolean {
        if (!answer || answer.trim() === '') return false;

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
    static normalizeOption(option: string): string {
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
    static findMatchingOption(storedAnswer: string, incomingOptions: string[]): string | null {
        const normalizedAnswer = this.normalizeOption(storedAnswer);

        for (const option of incomingOptions) {
            const normalizedOption = this.normalizeOption(option);

            // Exact match after normalization
            if (normalizedAnswer === normalizedOption) {
                return option;  // Return exact option string
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
    static findBestDropdownMatch(storedAnswers: string[], incomingOptions: string[]): string | null {
        for (const storedAnswer of storedAnswers) {
            const match = this.findMatchingOption(storedAnswer, incomingOptions);
            if (match) {
                return match;  // Return first matching option
            }
        }

        return null;
    }
}

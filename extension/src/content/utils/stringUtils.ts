/**
 * Robust string matching utility for autofill
 */

/**
 * Normalizes a string for comparison by lowercasing, trimming, 
 * and collapsing whitespace.
 */
export function normalize(text: any): string {
    if (text === null || text === undefined) return '';

    // Convert to string safely
    let str: string;
    if (Array.isArray(text)) {
        str = text.join(', ');
    } else if (typeof text === 'string') {
        str = text;
    } else {
        str = String(text);
    }

    return str
        .toLowerCase()
        .trim()
        .replace(/[?!.,*]/g, '')  // Remove common punctuation
        .replace(/\s+/g, ' ')      // Collapse multiple spaces
        .trim();
}

/**
 * Performs a "safe" match between a target value (from profile/logic) 
 * and a candidate option (from a dropdown/radio).
 */
export function safeMatch(target: string, option: string): boolean {
    const t = normalize(target);
    const o = normalize(option);

    if (!t || !o) return false;

    // 1. Exact match (highest priority)
    if (t === o) return true;

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
                if (isEEOType) return true;
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
            if (o === 'no' || o === 'yes' || o === 'none') return true;
        }

    } catch (e) {
        return o.includes(t);
    }

    return false;
}

/**
 * Checks if a string contains any of the provided keywords as whole words.
 */
export function containsAnyWord(text: string, keywords: string[]): boolean {
    const normalizedText = normalize(text);
    return keywords.some(kw => {
        const nKw = normalize(kw);
        const regex = new RegExp(`\\b${nKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        return regex.test(normalizedText);
    });
}

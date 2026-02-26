// extension/src/content/utils/questionDetection.ts

const LOG_PREFIX = "[QuestionDetection]";

/**
 * Extracts the most descriptive question text for a given form element.
 * For checkboxes and radio buttons, it prioritizes the group question (e.g., in a fieldset legend).
 */
export function getQuestionText(element: HTMLElement): string {
    // 1. Specialized handling for Checkboxes and Radios (Group Questions)
    if (element instanceof HTMLInputElement && (element.type === 'checkbox' || element.type === 'radio')) {
        const groupQuestion = findGroupQuestion(element);
        if (groupQuestion) return groupQuestion;
    }

    // 2. Standard Label Detection
    // 2.1 Check for associated label using for/id
    if (element.id) {
        const label = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
        if (label && label.textContent) {
            const text = cleanLabelText(label.textContent);
            if (text) return text;
        }
    }

    // 2.2 Check parent label (label wrapping input)
    const parentLabel = element.closest('label');
    if (parentLabel && parentLabel.textContent) {
        const text = cleanLabelText(parentLabel.textContent);
        if (text) return text;
    }

    // 2.3 Check aria-label
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel && ariaLabel.trim()) {
        return ariaLabel.trim();
    }

    // 2.4 Check aria-labelledby
    const labelledBy = element.getAttribute('aria-labelledby');
    if (labelledBy) {
        const labelElement = document.getElementById(labelledBy);
        if (labelElement && labelElement.textContent) {
            const text = cleanLabelText(labelElement.textContent);
            if (text) return text;
        }
    }

    // 3. Contextual Fallbacks
    // 3.1 Check closest container with common field wrapper classes
    const container = element.closest('[role="group"], .field, .form-field, .question, .form-group, fieldset');
    if (container && container.textContent) {
        const lines = container.textContent.trim().split('\n');
        if (lines.length > 0 && lines[0].trim()) {
            const text = cleanLabelText(lines[0]);
            if (text && !isGenericLabel(text)) return text;
        }
    }

    // 3.2 Check placeholder
    const placeholder = (element as HTMLInputElement).placeholder;
    if (placeholder?.trim()) return placeholder.trim();

    // 3.3 Check for sibling text nodes (Common for standalone checkboxes/terms)
    let sibling = element.nextSibling;
    while (sibling) {
        if (sibling.nodeType === Node.TEXT_NODE && sibling.textContent?.trim()) {
            const text = cleanLabelText(sibling.textContent);
            if (text.length > 2) return text;
        }
        if (sibling.nodeType === Node.ELEMENT_NODE && (sibling as HTMLElement).textContent?.trim()) {
            const text = cleanLabelText((sibling as HTMLElement).textContent || "");
            if (text.length > 2) return text;
        }
        sibling = sibling.nextSibling;
    }

    // 3.4 Name or ID attribute as last resort
    const name = element.getAttribute('name') || element.id;
    if (name) {
        return name.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim();
    }

    return "";
}

/**
 * Finds the "group question" for a checkbox or radio button.
 * Usually found in a <legend> of a <fieldset> or a leading div in a group container.
 */
function findGroupQuestion(element: HTMLInputElement): string | null {
    // Strategy 1: Check for ARIA-labelledby or labelledby on a parent container
    const container = element.closest('fieldset, [role="group"], .field, .form-field, .question, .form-group, [class*="Question"], [class*="Field"]');
    if (container) {
        const labelledBy = container.getAttribute('aria-labelledby');
        if (labelledBy) {
            const labelEl = document.getElementById(labelledBy);
            if (labelEl && labelEl.textContent) {
                const text = cleanLabelText(labelEl.textContent);
                if (text.length > 3) return text;
            }
        }
    }

    if (!container) return null;

    // Strategy 2: Check for fieldset legend
    const legend = container.querySelector('legend');
    if (legend && legend.textContent) {
        const text = cleanLabelText(legend.textContent);
        if (text.length > 3) return text;
    }

    // Strategy 3: Look for descriptive text in container that looks like a question
    // We search for elements that are LIKELY to be the question text
    const selectors = [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'legend', '.field-label', '.question-label', '.application-label',
        '[data-automation-id="promptLabel"]', '[class*="label"]', '[class*="title"]', '[class*="question"]',
        'p', 'span', 'div'
    ];

    for (const selector of selectors) {
        const headings = container.querySelectorAll(selector);
        for (const heading of Array.from(headings)) {
            // A group question should:
            // 1. Not contain the element itself (usually)
            // 2. Have substantial text
            // 3. Be before the element in the DOM (usually)
            if (heading.textContent && !heading.contains(element)) {
                const text = cleanLabelText(heading.textContent);
                // A group question should:
                // 1. Be reasonably long
                // 2. Not be a generic option (Yes/No)
                // 3. Not be a direct label for an input (e.g. have a 'for' attribute)
                const isDirectLabel = heading.tagName === 'LABEL' && (heading as HTMLLabelElement).htmlFor;

                if (text.length > 5 && !isGenericLabel(text) && !isDirectLabel) {
                    // One more check: make sure it's not actually an option text
                    // (Option texts are usually shorter or have a specific structure)
                    if (text.length > 10 || text.includes('?') || text.includes('Confirm')) {
                        return text;
                    }
                }
            }
        }
    }

    // Strategy 4: Substantial text node before the inputs
    const containerText = container.textContent || '';
    if (containerText.includes('?') || containerText.includes('*')) {
        const questionMatch = containerText.match(/^(.+?[\?\*])/);
        if (questionMatch) {
            const text = cleanLabelText(questionMatch[1]);
            if (text.length > 5) return text;
        }
    }

    return null;
}

/**
 * Clean label text by removing input values and extra whitespace
 * Also filters out dynamic status noise common on ATS sites
 */
export function cleanLabelText(text: string): string {
    if (!text) return "";

    // Remove dynamic status noise (e.g. "Loading", "Success!", "Analyzing resume...")
    // These often appear in the same container as the label
    const noise = [
        /loading/gi, /success!/gi, /analyzing resume/gi, /couldn't auto-read/gi,
        /no location found/gi, /try entering a different/gi, /type your response/gi
    ];

    let cleaned = text.trim();
    noise.forEach(n => {
        cleaned = cleaned.replace(n, '');
    });

    return cleaned
        .split('\n')[0] // Take first line
        .trim()
        .replace(/\s+/g, ' ') // Normalize whitespace
        .replace(/[*✱]/g, '') // Remove mandatory asterisks (regular and special)
        .trim();
}

/**
 * Check if a label is too generic to be useful
 */
export function isGenericLabel(text: string): boolean {
    const lower = text.toLowerCase().trim();
    return [
        'attach', 'upload', 'choose file', 'browse', 'file', 'select file',
        'upload resume', 'upload cv', 'upload cover letter',
        'paste', 'write', 'resume', 'cv', 'yes', 'no', 'n/a', 'select', 'select...'
    ].some(t => lower === t || lower.startsWith(t + ' '));
}

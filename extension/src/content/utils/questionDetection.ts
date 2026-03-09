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
    // Strategy 1: Check for ARIA-labelledby or labelledby on any ancestor
    // This catches Workday and well-structured forms first
    let el: HTMLElement | null = element;
    for (let i = 0; i < 6; i++) {
        if (!el) break;
        const labelledBy = el.getAttribute('aria-labelledby');
        if (labelledBy) {
            const labelEl = document.getElementById(labelledBy);
            if (labelEl && labelEl.textContent) {
                const text = cleanLabelText(labelEl.textContent);
                if (text.length > 3) return text;
            }
        }
        el = el.parentElement;
    }

    // Strategy 2: Try known semantic containers (works for Greenhouse, BambooHR etc.)
    const knownContainer = element.closest('fieldset, [role="group"]');
    if (knownContainer) {
        const legend = knownContainer.querySelector('legend');
        if (legend && legend.textContent) {
            const text = cleanLabelText(legend.textContent);
            if (text.length > 3) return text;
        }
    }

    // Strategy 3: Walk UP the DOM tree and look for text that looks like a question
    // This is the key strategy for Ashby, which uses CSS-module class names
    // We go up level by level, and at each level we look for a sibling/child
    // element that comes BEFORE our element and contains substantial question text
    let current: HTMLElement | null = element.parentElement;
    for (let depth = 0; depth < 6 && current; depth++) {
        // Look at all children of `current` that come BEFORE our element/branch
        const children = Array.from(current.children);
        const elementIndex = children.findIndex(c => c.contains(element) || c === element);

        // Check elements that appear BEFORE the inputs in the DOM
        for (let i = 0; i < (elementIndex === -1 ? children.length : elementIndex); i++) {
            const child = children[i];
            const childText = child.textContent || '';

            // Skip elements that contain the actual radio/checkbox inputs
            if (child.contains(element)) continue;

            const text = cleanLabelText(childText);

            // A valid group question must:
            // 1. Have meaningful length (more than a short option label like "Yes", "1", "PST")
            // 2. Not be a generic label
            if (text.length > 10 && !isGenericLabel(text)) {
                // Extra check: prefer text that ends with ? or * (question marks)
                // or contains question-like words
                const looksLikeQuestion = text.includes('?') || text.includes('scale') ||
                    text.includes('proficiency') || text.includes('timezone') ||
                    text.includes('live') || text.includes('require') ||
                    text.includes('authorized') || text.includes('Confirm');

                if (text.length > 15 || looksLikeQuestion) {
                    return text;
                }
            }
        }

        current = current.parentElement;
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
        /no location found/gi, /try entering a different/gi, /type your response/gi,
        /SVGs? not supported by this browser\.?/gi // Filter out SVG fallback text
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

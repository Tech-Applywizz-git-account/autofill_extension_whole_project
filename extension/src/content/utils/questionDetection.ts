// extension/src/content/utils/questionDetection.ts

const LOG_PREFIX = "[QuestionDetection]";

/**
 * Detects if a text block looks like multiple labels concatenated together (e.g. "FirstNameLastNameEmail")
 * Usually characterized by PascalCase/CamelCase with no spaces or very high capital density.
 */
function isMergedLabel(text: string): boolean {
    const raw = text.replace(/\s/g, '');
    if (raw.length < 15) return false;

    // Check for high density of capital letters in the middle of a word (indicating concatenation)
    const midCaps = (raw.match(/[a-z][A-Z]/g) || []).length;
    if (midCaps >= 3) return true;

    // Reject if it's very long and has very few spaces
    const spaceDensity = (text.match(/\s/g) || []).length / text.length;
    if (text.length > 40 && spaceDensity < 0.05) return true;

    return false;
}

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
    const container = element.closest('[role="group"], .field, .form-field, .question, .form-group, fieldset, [class*="Field"], [class*="Question"]') as HTMLElement;
    if (container) {
        // PRIORITIZE: Find a discrete label or heading inside this container first
        const internalLabel = container.querySelector('label, h3, h4, h5, .label, .field-label, [class*="Label"], [class*="QuestionText"]');
        if (internalLabel && internalLabel.textContent && !isGenericLabel(internalLabel.textContent)) {
            const text = cleanLabelText(internalLabel.textContent);
            if (text.length > 2) return text;
        }

        // FALLBACK: Use container text content but be VERY selective
        if (container.textContent) {
            const rawText = container.textContent.trim();
            // If the text is massive without spaces (concatenated labels), skip it
            if (/^[a-zA-Z]{30,}$/.test(rawText.replace(/\s/g, ''))) {
                console.warn(`${LOG_PREFIX} Skipping concatenated block`);
            } else {
                const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                if (lines.length > 0) {
                    const text = cleanLabelText(lines[0]);
                    // Only accept if it's a reasonable length and doesn't look like a bunch of words merged together
                    if (text && !isGenericLabel(text) && text.length < 120 && !isMergedLabel(text)) {
                        return text;
                    }
                }
            }
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
    for (let depth = 0; depth < 8 && current; depth++) {
        // Look for common label elements at this level
        const siblingLabels = current.querySelectorAll('label, h3, h4, h5, .label, .field-label, [class*="Label"], [class*="QuestionText"]');
        for (const label of Array.from(siblingLabels)) {
            if (label.contains(element)) continue;
            const text = cleanLabelText(label.textContent || "");
            if (text.length > 10 && !isGenericLabel(text) && !isMergedLabel(text)) {
                return text;
            }
        }

        const children = Array.from(current.children);
        const elementIndex = children.findIndex(c => c.contains(element) || c === element);

        for (let i = 0; i < (elementIndex === -1 ? children.length : elementIndex); i++) {
            const child = children[i] as HTMLElement;
            // DANGER: If child is a giant container, textContent grabs everything
            // Check if it's a "simple" text element or a complex container
            if (child.children.length > 5 && child.textContent && child.textContent.length > 200) {
                // Too many children and too much text - probably a container, not a label
                continue;
            }

            const text = cleanLabelText(child.textContent || "");
            if (text.length > 10 && !isGenericLabel(text) && !isMergedLabel(text)) {
                if (text.length > 15 || text.includes('?') || text.includes('*')) {
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
        'paste', 'write', 'resume', 'cv', 'yes', 'no', 'n/a', 'select', 'select...',
        'choose', 'click here', 'expand', 'collapse', 'loading', 'success'
    ].some(t => lower === t || lower.startsWith(t + ' ')) || lower.length < 2;
}

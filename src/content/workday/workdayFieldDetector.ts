// extension/src/content/workday/workdayFieldDetector.ts
/**
 * Workday-specific field detection enhancements
 * Handles Workday's custom dropdowns, radio groups, and special field patterns
 */

const LOG_PREFIX = "[WorkdayFieldDetector]";

export type WorkdayField = {
    element: HTMLElement;
    questionText: string;
    fieldType: 'text' | 'dropdown' | 'radio' | 'checkbox' | 'textarea';
    options?: string[];
    isRequired: boolean;
    dataAutomationId?: string;
    isPriority: boolean; // Country, Location-related fields
};

/**
 * Detect all Workday fields with proper option extraction
 */
export function detectWorkdayFields(): WorkdayField[] {
    const fields: WorkdayField[] = [];

    console.log(`${LOG_PREFIX} 🔍 Scanning Workday application...`);

    // 1. Find all elements with data-automation-id (Workday's standard)
    const automationElements = document.querySelectorAll('[data-automation-id]');
    console.log(`${LOG_PREFIX} Found ${automationElements.length} elements with data-automation-id`);

    for (const el of Array.from(automationElements)) {
        const autoId = el.getAttribute('data-automation-id');
        if (!autoId) continue;

        // Skip non-input elements
        if (!isFormField(el as HTMLElement)) continue;

        const field = analyzeWorkdayField(el as HTMLElement);
        if (field) {
            fields.push(field);
        }
    }

    // 2. Also scan for radio buttons (often not directly marked with automation-id)
    const radioFields = detectWorkdayRadioGroups();
    fields.push(...radioFields);

    console.log(`${LOG_PREFIX} ✅ Detected ${fields.length} Workday fields`);
    console.log(`${LOG_PREFIX} Priority fields: ${fields.filter(f => f.isPriority).length}`);

    return fields;
}

/**
 * Analyze a single Workday field
 */
function analyzeWorkdayField(el: HTMLElement): WorkdayField | null {
    const autoId = el.getAttribute('data-automation-id');
    const tagName = el.tagName.toLowerCase();

    // Get question text
    const questionText = getWorkdayQuestionText(el);
    if (!questionText) return null;

    // Determine if required
    const isRequired = isFieldRequired(el);

    // Determine if priority (country/location fields)
    const isPriority = isPriorityField(questionText, autoId);

    // TEXT INPUTS
    if (tagName === 'input' && (el as HTMLInputElement).type === 'text') {
        return {
            element: el,
            questionText,
            fieldType: 'text',
            isRequired,
            dataAutomationId: autoId || undefined,
            isPriority
        };
    }

    // TEXTAREAS
    if (tagName === 'textarea') {
        return {
            element: el,
            questionText,
            fieldType: 'textarea',
            isRequired,
            dataAutomationId: autoId || undefined,
            isPriority
        };
    }

    // CHECKBOXES
    if (tagName === 'input' && (el as HTMLInputElement).type === 'checkbox') {
        return {
            element: el,
            questionText,
            fieldType: 'checkbox',
            isRequired,
            dataAutomationId: autoId || undefined,
            isPriority: false
        };
    }

    // WORKDAY CUSTOM DROPDOWNS
    // These are typically <input role="combobox"> or <div role="combobox">input</div>
    if (el.getAttribute('role') === 'combobox' || el.querySelector('[role="combobox"]')) {
        const options = extractWorkdayDropdownOptions(el);

        return {
            element: el,
            questionText,
            fieldType: 'dropdown',
            options,
            isRequired,
            dataAutomationId: autoId || undefined,
            isPriority
        };
    }

    return null;
}

/**
 * Extract options from Workday dropdown by opening it temporarily
 */
function extractWorkdayDropdownOptions(dropdownEl: HTMLElement): string[] {
    const options: string[] = [];

    try {
        // Find the input element within the dropdown
        const input = dropdownEl.querySelector('input[role="combobox"]') ||
            (dropdownEl.getAttribute('role') === 'combobox' ? dropdownEl : null);

        if (!input) return options;

        // Check if menu is already open
        const existingMenu = document.querySelector('[data-automation-id*="menu"], [role="listbox"]');
        if (existingMenu) {
            return extractOptionsFromMenu(existingMenu as HTMLElement);
        }

        // Options are usually pre-loaded in the DOM or appear on interaction
        // Look for associated listbox in the DOM
        const automationId = dropdownEl.getAttribute('data-automation-id');
        if (automationId) {
            // Workday often has menu with related automation-id
            const menuId = automationId.replace('input', 'menu').replace('select', 'menu');
            const menu = document.querySelector(`[data-automation-id*="${menuId}"]`);
            if (menu) {
                return extractOptionsFromMenu(menu as HTMLElement);
            }
        }

        // Fallback: Try to find listbox by aria-controls
        const ariaControls = input.getAttribute('aria-controls');
        if (ariaControls) {
            const menu = document.getElementById(ariaControls);
            if (menu) {
                return extractOptionsFromMenu(menu);
            }
        }

    } catch (error) {
        console.warn(`${LOG_PREFIX} Error extracting dropdown options:`, error);
    }

    return options;
}

/**
 * Extract option values from an open menu
 */
function extractOptionsFromMenu(menu: HTMLElement): string[] {
    const options: string[] = [];

    // Workday uses [role="option"] elements
    const optionElements = menu.querySelectorAll('[role="option"]');

    for (const opt of Array.from(optionElements)) {
        const text = opt.textContent?.trim();
        if (text && text.length > 0) {
            options.push(text);
        }
    }

    console.log(`${LOG_PREFIX} Extracted ${options.length} options from menu`);
    return options;
}

/**
 * Detect Workday radio button groups
 */
function detectWorkdayRadioGroups(): WorkdayField[] {
    const fields: WorkdayField[] = [];

    // Find all radio inputs
    const radioInputs = document.querySelectorAll('input[type="radio"]');
    const processedGroups = new Set<string>();

    for (const radio of Array.from(radioInputs)) {
        const name = (radio as HTMLInputElement).name;
        if (!name || processedGroups.has(name)) continue;

        // Mark this group as processed
        processedGroups.add(name);

        // Get all radios in this group
        const groupRadios = document.querySelectorAll(`input[type="radio"][name="${CSS.escape(name)}"]`);
        if (groupRadios.length === 0) continue;

        // Get question text from first radio or parent fieldset
        const firstRadio = groupRadios[0] as HTMLElement;
        const questionText = getWorkdayQuestionText(firstRadio);
        if (!questionText) continue;

        // Extract options
        const options: string[] = [];
        for (const r of Array.from(groupRadios)) {
            const label = getRadioLabel(r as HTMLInputElement);
            if (label) options.push(label);
        }

        fields.push({
            element: firstRadio,
            questionText,
            fieldType: 'radio',
            options,
            isRequired: isFieldRequired(firstRadio),
            isPriority: false
        });
    }

    return fields;
}

/**
 * Get label text for a radio button
 */
function getRadioLabel(radio: HTMLInputElement): string | null {
    // Try associated label
    const id = radio.id;
    if (id) {
        const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
        if (label?.textContent?.trim()) {
            return label.textContent.trim();
        }
    }

    // Try parent label
    const parentLabel = radio.closest('label');
    if (parentLabel?.textContent?.trim()) {
        // Remove the radio's value from the text
        const text = parentLabel.textContent.trim();
        return text;
    }

    // Try next sibling text
    let next = radio.nextSibling;
    while (next) {
        if (next.nodeType === Node.TEXT_NODE && next.textContent?.trim()) {
            return next.textContent.trim();
        }
        if (next.nodeType === Node.ELEMENT_NODE) {
            const text = (next as HTMLElement).textContent?.trim();
            if (text) return text;
        }
        next = next.nextSibling;
    }

    return null;
}

/**
 * Get question text for a Workday field
 */
function getWorkdayQuestionText(el: HTMLElement): string | null {
    // 1. Check label (highest priority)
    const label = getFieldLabel(el);
    if (label) return label;

    // 2. Check aria-label
    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel?.trim()) return ariaLabel.trim();

    // 3. Check Workday's fieldset/legend pattern
    const fieldset = el.closest('fieldset');
    if (fieldset) {
        const legend = fieldset.querySelector('legend');
        if (legend?.textContent?.trim()) {
            return legend.textContent.trim();
        }
    }

    // 4. Check parent with [data-automation-id*="label"]
    const parentWithLabel = el.closest('[data-automation-id]');
    if (parentWithLabel) {
        const labelChild = parentWithLabel.querySelector('[data-automation-id*="label"]');
        if (labelChild?.textContent?.trim()) {
            return labelChild.textContent.trim();
        }
    }

    // 5. Placeholder as last resort
    if (el.tagName.toLowerCase() === 'input') {
        const placeholder = (el as HTMLInputElement).placeholder;
        if (placeholder?.trim()) return placeholder.trim();
    }

    return null;
}

/**
 * Get label for a field element
 */
function getFieldLabel(el: HTMLElement): string | null {
    const id = (el as any).id;
    if (id) {
        const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
        if (label?.textContent?.trim()) {
            return label.textContent.trim();
        }
    }

    const parentLabel = el.closest('label');
    if (parentLabel?.textContent?.trim()) {
        return parentLabel.textContent.trim();
    }

    return null;
}

/**
 * Check if field is required
 */
function isFieldRequired(el: HTMLElement): boolean {
    // 1. aria-required
    if (el.getAttribute('aria-required') === 'true') return true;

    // 2. required attribute
    if ((el as HTMLInputElement).required) return true;

    // 3. Workday often marks required fields with asterisk in label
    const questionText = getWorkdayQuestionText(el);
    if (questionText?.includes('*')) return true;

    // 4. Check for required in data-automation-id
    const autoId = el.getAttribute('data-automation-id');
    if (autoId?.toLowerCase().includes('required')) return true;

    return false;
}

/**
 * Check if this is a priority field (country, location, etc.)
 */
function isPriorityField(questionText: string, autoId: string | null): boolean {
    const text = questionText.toLowerCase();
    const id = (autoId || '').toLowerCase();

    const priorityKeywords = [
        'country',
        'location',
        'region',
        'state',
        'province',
        'territory'
    ];

    return priorityKeywords.some(keyword =>
        text.includes(keyword) || id.includes(keyword)
    );
}

/**
 * Check if element is a form field
 */
function isFormField(el: HTMLElement): boolean {
    const tagName = el.tagName.toLowerCase();

    // Direct form elements
    if (['input', 'textarea', 'select'].includes(tagName)) {
        return true;
    }

    // Workday combobox pattern
    if (el.getAttribute('role') === 'combobox') {
        return true;
    }

    // Contains an input with combobox role
    if (el.querySelector('[role="combobox"]')) {
        return true;
    }

    return false;
}

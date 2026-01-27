// extension/src/content/scanner/formScanner.ts
/**
 * FormScanner - Scans the current page for form fields
 * Replaces Selenium-based scanning with extension-based scanning
 * 
 * Architecture:
 * - Scans current tab directly (no new window needed)
 * - Detects all form fields (text, dropdown, radio, checkbox, etc.)
 * - Extracts dropdown options using DropdownScanner
 * - Returns same data structure as Selenium for compatibility
 */

import { extractDropdownOptions } from './dropdownScanner';

const LOG_PREFIX = "[FormScanner]";

export interface ScannedQuestion {
    questionText: string;
    fieldType: string;
    options?: string[];
    required: boolean;
    selector: string;
}

/**
 * FormScanner class
 */
export class FormScanner {

    /**
     * Main scan function - scans all form fields on current page
     */
    async scan(): Promise<ScannedQuestion[]> {
        console.log(`${LOG_PREFIX} 🔍 Starting scan of current page...`);

        let questions: ScannedQuestion[] = [];
        const seenQuestions = new Set<string>();

        try {
            // Find all form fields
            const fields = this.findAllFormFields();
            console.log(`${LOG_PREFIX} Found ${fields.length} form fields`);

            // Process each field
            for (let i = 0; i < fields.length; i++) {
                const field = fields[i];
                console.log(`${LOG_PREFIX} Processing field ${i + 1}/${fields.length}...`);

                const question = await this.processField(field);
                if (question) {
                    // Check for duplicate immediately
                    const questionKey = question.questionText.toLowerCase().trim();

                    if (seenQuestions.has(questionKey)) {
                        // CRITICAL FIX: "Keep First" strategy for file inputs
                        // If we find a duplicate "Attach" button, we assume the FIRST one is the Resume (primary)
                        // and the subsequent ones are Cover Letters or other docs.
                        // If we failed to distinguish them by label, it's better to fill ONLY Resume
                        // than to fill both with Resume (or overwrite Resume with Cover Letter field).
                        if (question.fieldType === 'file') {
                            console.log(`${LOG_PREFIX} 📎 Ignoring duplicate file input: "${question.questionText}" (Keeping first found)`);
                            // Do NOT add to questions array
                            // Do NOT overwrite existing question
                        } else {
                            console.log(`${LOG_PREFIX} ⚠️ Found duplicate question: "${question.questionText}" - Replacing with newest version`);
                            // Find and replace the existing question
                            const index = questions.findIndex(q => q.questionText.toLowerCase().trim() === questionKey);
                            if (index !== -1) {
                                questions[index] = question;
                            }
                        }
                    } else {
                        seenQuestions.add(questionKey);
                        questions.push(question);
                    }
                }
            }

            console.log(`${LOG_PREFIX} ✅ Scan complete: ${questions.length} unique questions found`);

        } catch (error) {
            console.error(`${LOG_PREFIX} ❌ Scan error:`, error);
        }

        return questions;
    }

    /**
     * Find all form fields in the DOM
     */
    private findAllFormFields(): HTMLElement[] {
        const fields: HTMLElement[] = [];

        // Find all input fields (text, email, tel, file, etc.)
        const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"])');
        inputs.forEach(input => {
            if (this.isVisible(input as HTMLElement)) {
                fields.push(input as HTMLElement);
            }
        });

        // Find all textareas
        const textareas = document.querySelectorAll('textarea');
        textareas.forEach(textarea => {
            if (this.isVisible(textarea as HTMLElement)) {
                fields.push(textarea as HTMLElement);
            }
        });

        // Find all native select elements
        const selects = document.querySelectorAll('select');
        selects.forEach(select => {
            if (this.isVisible(select as HTMLElement)) {
                fields.push(select as HTMLElement);
            }
        });

        // Find custom dropdowns (React-Select, etc.)
        // Look for elements with role="combobox" or common React-Select classes
        const customDropdowns = document.querySelectorAll('[role="combobox"], [aria-haspopup="listbox"]');
        customDropdowns.forEach(dropdown => {
            if (!this.isVisible(dropdown as HTMLElement)) return;

            // Only add if not already added (avoid duplicates with inputs)
            const input = dropdown.querySelector('input');
            if (!input || !fields.includes(input as HTMLElement)) {
                fields.push(dropdown as HTMLElement);
            }
        });

        // Find radio button groups (group by name attribute)
        const radioGroups = new Map<string, HTMLInputElement[]>();
        const radios = document.querySelectorAll('input[type="radio"]');
        radios.forEach(radio => {
            const input = radio as HTMLInputElement;
            if (!this.isVisible(input)) return;

            const name = input.name;
            if (!name) return;

            if (!radioGroups.has(name)) {
                radioGroups.set(name, []);
            }
            radioGroups.get(name)!.push(input);
        });

        // Add one representative radio from each group
        radioGroups.forEach((radios, name) => {
            if (radios.length > 0) {
                fields.push(radios[0]); // Add first radio as representative
            }
        });

        // Find checkboxes and group them by their PARENT CONTAINER
        // This is more reliable than grouping by question text
        // Multi-select checkbox groups share the same parent fieldset/div
        const checkboxContainerGroups = new Map<HTMLElement, HTMLInputElement[]>();
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');

        checkboxes.forEach(checkbox => {
            const input = checkbox as HTMLInputElement;
            if (!this.isVisible(input)) return;

            // Find the parent container that groups this checkbox
            // Try fieldset first (most semantic), then divs with common field classes
            let container: HTMLElement | null = input.closest('fieldset');
            if (!container) {
                container = input.closest('.field, .form-field, .question, .form-group, [role="group"]');
            }
            if (!container) {
                // Fallback: use parent element
                container = input.parentElement;
            }

            if (container) {
                if (!checkboxContainerGroups.has(container)) {
                    checkboxContainerGroups.set(container, []);
                }
                checkboxContainerGroups.get(container)!.push(input);
            }
        });

        console.log(`${LOG_PREFIX} 📋 Found ${checkboxContainerGroups.size} checkbox container(s)`);

        // For each container, determine if it's a group or standalone checkbox
        checkboxContainerGroups.forEach((checkboxes, container) => {
            console.log(`${LOG_PREFIX} 📋 Container has ${checkboxes.length} checkbox(es)`);

            if (checkboxes.length > 1) {
                // Multi-select group - add only the first checkbox as representative
                console.log(`${LOG_PREFIX} ✅ Multi-select checkbox group detected`);
                fields.push(checkboxes[0]);
            } else {
                // Standalone checkbox - add it
                console.log(`${LOG_PREFIX} ✅ Standalone checkbox detected`);
                fields.push(checkboxes[0]);
            }
        });

        return fields;
    }

    /**
     * Process a single field and extract information
     */
    private async processField(field: HTMLElement): Promise<ScannedQuestion | null> {
        try {
            const fieldType = this.detectFieldType(field);
            const questionText = this.getQuestionText(field);
            const required = this.isRequired(field);
            const selector = this.generateSelector(field);

            // Skip if no question text found
            if (!questionText) {
                console.warn(`${LOG_PREFIX} ⚠️ No question text found for field, skipping`);
                return null;
            }

            // Extract options for dropdown fields
            let options: string[] | undefined = undefined;
            if (fieldType === 'dropdown_custom' || fieldType === 'select') {
                console.log(`${LOG_PREFIX} 📋 Extracting options for: "${questionText}"`);
                options = await extractDropdownOptions(field);
                if (options.length === 0) {
                    console.warn(`${LOG_PREFIX} ⚠️ No options extracted for dropdown: "${questionText}"`);
                }
            }

            // Extract options for radio button groups
            if (fieldType === 'radio') {
                console.log(`${LOG_PREFIX} 📋 Extracting radio options for: "${questionText}"`);
                options = this.extractRadioOptions(field as HTMLInputElement);
                console.log(`${LOG_PREFIX} 📋 Found ${options.length} radio options: [${options.join(', ')}]`);
            }

            // Extract options for checkbox groups
            if (fieldType === 'checkbox') {
                console.log(`${LOG_PREFIX} 📋 Extracting checkbox options for: "${questionText}"`);
                options = this.extractCheckboxGroupOptions(field as HTMLInputElement);
                console.log(`${LOG_PREFIX} 📋 Found ${options.length} checkbox options: [${options.join(', ')}]`);
            }

            return {
                questionText,
                fieldType,
                options,
                required,
                selector
            };

        } catch (error) {
            console.error(`${LOG_PREFIX} Error processing field:`, error);
            return null;
        }
    }

    /**
     * Detect the type of form field
     */
    private detectFieldType(element: HTMLElement): string {
        // Custom dropdown detection MUST come first (before HTMLInputElement check)
        // Because Greenhouse dropdowns are <input type="text" role="combobox">
        if (element.getAttribute('role') === 'combobox' ||
            element.getAttribute('aria-haspopup') === 'listbox' ||
            element.closest('[role="combobox"]') ||
            element.querySelector('[role="combobox"]') ||
            element.querySelector('input[role="combobox"]')) {
            return 'dropdown_custom';
        }

        // Native select
        if (element instanceof HTMLSelectElement) {
            return 'select';
        }

        // Check for select in children
        if (element.querySelector('select')) {
            return 'select';
        }

        // Textarea
        if (element instanceof HTMLTextAreaElement) {
            return 'textarea';
        }

        // Input fields (checked AFTER dropdown detection)
        if (element instanceof HTMLInputElement) {
            const type = element.type.toLowerCase();

            switch (type) {
                case 'email':
                    return 'email';
                case 'tel':
                    return 'tel';
                case 'number':
                    return 'number';
                case 'date':
                    return 'date';
                case 'file':
                    return 'file';
                case 'radio':
                    return 'radio';
                case 'checkbox':
                    return 'checkbox';
                default:
                    return 'text';
            }
        }

        // Default to text
        return 'text';
    }

    /**
     * Extract question text from field's label or aria-label
     * Uses multiple fallback strategies for reliability
     */
    private getQuestionText(element: HTMLElement): string {
        // SPECIAL HANDLING FOR CHECKBOXES
        // For checkboxes, prioritize the GROUP question (fieldset/legend) over individual checkbox labels
        // This ensures multi-select checkbox groups are properly detected
        if (element instanceof HTMLInputElement && element.type === 'checkbox') {
            console.log(`${LOG_PREFIX} 🔍 Checkbox detected, looking for group question...`);

            // Find the parent container
            let container: HTMLElement | null = element.closest('fieldset');
            if (!container) {
                container = element.closest('.field, .form-field, .question, .form-group, [role="group"]');
            }
            if (!container) {
                // Fallback: use parent element
                container = element.parentElement;
            }

            if (container) {
                console.log(`${LOG_PREFIX} 📦 Found container: ${container.tagName}.${container.className}`);

                // Strategy 1: Check for fieldset legend
                const fieldset = element.closest('fieldset');
                if (fieldset) {
                    const legend = fieldset.querySelector('legend');
                    if (legend && legend.textContent) {
                        const legendText = this.cleanLabelText(legend.textContent);
                        if (legendText.length > 5) {
                            console.log(`${LOG_PREFIX} ✅ Found group question from legend: "${legendText}"`);
                            return legendText;
                        }
                    }
                }

                // Strategy 2: Look for any text in container that looks like a question
                // A question usually:
                // - Contains a "?"
                // - Is longer than 20 characters
                // - Appears BEFORE the checkboxes
                // - Is in a heading, label, or div

                const containerText = container.textContent || '';
                console.log(`${LOG_PREFIX} 📝 Container text length: ${containerText.length}`);

                // Find all potential question elements in order
                const potentialQuestions: Array<{ element: Element, text: string }> = [];

                // Check headings first
                const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6, legend, .field-label, .question-label, label:not([for])');
                headings.forEach(heading => {
                    if (heading.textContent && !heading.contains(element)) {
                        const text = this.cleanLabelText(heading.textContent);
                        if (text.length > 10) {
                            potentialQuestions.push({ element: heading, text });
                        }
                    }
                });

                // Also check for divs/spans with substantial text before the checkbox
                const allTextElements = container.querySelectorAll('div, span, p');
                allTextElements.forEach(el => {
                    if (el.textContent && !el.contains(element) && el.querySelector('input[type="checkbox"]') === null) {
                        const text = this.cleanLabelText(el.textContent);
                        // Must be substantial text and look like a question
                        if (text.length > 20 && (text.includes('?') || text.endsWith('*'))) {
                            potentialQuestions.push({ element: el, text });
                        }
                    }
                });

                console.log(`${LOG_PREFIX} 📋 Found ${potentialQuestions.length} potential question(s)`);

                // Use the first one that looks like a question
                for (const { text } of potentialQuestions) {
                    // Skip if it's just the checkbox label itself
                    const checkboxLabel = this.getCheckboxLabel(element);
                    if (checkboxLabel && text.includes(checkboxLabel)) {
                        continue;
                    }

                    console.log(`${LOG_PREFIX} ✅ Found group question: "${text}"`);
                    return text;
                }

                // Strategy 3: If container has multiple checkboxes and text contains "?", extract the question part
                const checkboxCount = container.querySelectorAll('input[type="checkbox"]').length;
                if (checkboxCount > 1 && containerText.includes('?')) {
                    // Extract text up to and including the first "?"
                    const questionMatch = containerText.match(/^(.+?\?)/);
                    if (questionMatch) {
                        const questionText = this.cleanLabelText(questionMatch[1]);
                        if (questionText.length > 10) {
                            console.log(`${LOG_PREFIX} ✅ Extracted question from container text: "${questionText}"`);
                            return questionText;
                        }
                    }
                }

                console.log(`${LOG_PREFIX} ⚠️ No group question found in container, using individual label`);
            } else {
                console.log(`${LOG_PREFIX} ⚠️ No container found for checkbox`);
            }

            // Fall through to normal label detection for standalone checkboxes
        }

        // STANDARD LABEL DETECTION (for all other fields and standalone checkboxes)

        // Method 1: Check aria-label
        const ariaLabel = element.getAttribute('aria-label');
        if (ariaLabel && ariaLabel.trim()) {
            return ariaLabel.trim();
        }

        // Method 2: Check associated label using for/id
        if (element.id) {
            const label = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
            if (label && label.textContent) {
                return this.cleanLabelText(label.textContent);
            }
        }

        // Method 3: Check parent label (label wrapping input)
        const parentLabel = element.closest('label');
        if (parentLabel && parentLabel.textContent) {
            return this.cleanLabelText(parentLabel.textContent);
        }

        // Method 4: Check aria-labelledby
        const labelledBy = element.getAttribute('aria-labelledby');
        if (labelledBy) {
            const labelElement = document.getElementById(labelledBy);
            if (labelElement && labelElement.textContent) {
                return this.cleanLabelText(labelElement.textContent);
            }
        }

        // Method 5: Check previous sibling (common pattern: <label>Text</label><input>)
        let prevSibling = element.previousElementSibling;
        while (prevSibling) {
            if (prevSibling.tagName === 'LABEL' && prevSibling.textContent) {
                return this.cleanLabelText(prevSibling.textContent);
            }
            // Also check divs/spans that act as labels
            if ((prevSibling.tagName === 'DIV' || prevSibling.tagName === 'SPAN') &&
                prevSibling.textContent &&
                prevSibling.textContent.trim().length > 0 &&
                prevSibling.textContent.trim().length < 100) {
                return this.cleanLabelText(prevSibling.textContent);
            }
            prevSibling = prevSibling.previousElementSibling;
        }

        // Method 6: Check closest container with common field wrapper classes
        const container = element.closest('[role="group"], .field, .form-field, .question, .form-group, fieldset');
        if (container && container.textContent) {
            // Special handling for file inputs: check for legend in fieldset
            if (element instanceof HTMLInputElement && element.type === 'file') {
                const fieldset = element.closest('fieldset');
                if (fieldset) {
                    const legend = fieldset.querySelector('legend');
                    if (legend && legend.textContent) {
                        return this.cleanLabelText(legend.textContent);
                    }
                }
            }

            // Get first line as question text
            const lines = container.textContent.trim().split('\n');
            if (lines.length > 0 && lines[0].trim()) {
                return this.cleanLabelText(lines[0]);
            }
        }

        // Method 7: Check name or id attribute as last resort
        const name = element.getAttribute('name');
        let finalText = '';

        if (name) {
            // Convert names like "first_name" to "First Name"
            finalText = name.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim();
        }

        // IMPROVEMENT: If the found text is generic (e.g., "Attach"), look harder for context
        if (!finalText || this.isGenericLabel(finalText) || (element.textContent && this.isGenericLabel(element.textContent))) {
            // If we found a generic label earlier (methods 1-6), check if we can find something better
            // If we haven't found anything yet, definitely look for context
            const contextLabel = this.findContextLabel(element);
            if (contextLabel) {
                return contextLabel;
            }
        }

        return finalText;
    }

    /**
     * Check if a label is too generic to be useful
     */
    private isGenericLabel(text: string): boolean {
        const lower = text.toLowerCase().trim();
        return [
            'attach', 'upload', 'choose file', 'browse', 'file', 'select file',
            'upload resume', 'upload cv', 'upload cover letter', // basic actions
            'paste', 'write'
        ].some(t => lower === t);
    }

    /**
     * Find a context label (heading, parent field label) for generic fields
     * Useful for Greenhouse "Attach" buttons
     */
    private findContextLabel(element: HTMLElement): string | null {
        // Look up the tree for a container
        let current = element.parentElement;
        let depth = 0;

        while (current && depth < 5) {
            // Check for descriptive label or heading in this container
            // We want to find "Resume/CV" or "Cover Letter" which usually sits above the "Attach" button

            // 1. Check for label elements that are NOT the generic one we passed
            const labels = current.querySelectorAll('label');
            for (const label of Array.from(labels)) {
                if (label.textContent && !this.isGenericLabel(label.textContent) && this.isVisible(label)) {
                    // Check if this label is "legit" (has some length, looks like a question)
                    const text = this.cleanLabelText(label.textContent);
                    if (text.length > 2 && text.length < 100) {
                        return text;
                    }
                }
            }

            // 2. Check for headings (h3, h4, h5, etc) AND legends
            const headings = current.querySelectorAll('h3, h4, h5, .field-label, .label, legend, strong, b');
            for (const heading of Array.from(headings)) {
                if (heading.textContent && !this.isGenericLabel(heading.textContent) && this.isVisible(heading as HTMLElement)) {
                    const text = this.cleanLabelText(heading.textContent);
                    if (text.length > 2 && text.length < 100) {
                        return text;
                    }
                }
            }

            // 3. Greenhouse specific structure check
            if (current.className.includes('field') || current.id.includes('field')) {
                // Often the label is a sibling text node or a label element
                let label = current.querySelector('label');
                if (label && label.textContent) {
                    return this.cleanLabelText(label.textContent);
                }

                // Also check previous sibling of the field container (very common in some forms)
                let prev = current.previousElementSibling;
                if (prev && (prev.tagName === 'LABEL' || prev.className.includes('label'))) {
                    if (prev.textContent) return this.cleanLabelText(prev.textContent);
                }
            }

            current = current.parentElement;
            depth++;
        }

        // Final fallback: Check if the element itself is inside a container that has a 'data-label' attribute?
        // Or if the element has a 'title' attribute?
        if (element.title && !this.isGenericLabel(element.title)) {
            return this.cleanLabelText(element.title);
        }

        return null;
    }

    /**
     * Clean label text by removing input values and extra whitespace
     */
    private cleanLabelText(text: string): string {
        return text.trim()
            .split('\n')[0] // Take first line
            .trim()
            .replace(/\s+/g, ' '); // Normalize whitespace
    }

    /**
     * Check if field is required
     */
    private isRequired(element: HTMLElement): boolean {
        // Check required attribute
        if (element.hasAttribute('required')) {
            return true;
        }

        // Check aria-required
        if (element.getAttribute('aria-required') === 'true') {
            return true;
        }

        // Check for asterisk (*) in label
        const questionText = this.getQuestionText(element);
        if (questionText.includes('*')) {
            return true;
        }

        return false;
    }

    /**
     * Check if element is visible
     */
    private isVisible(element: HTMLElement): boolean {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);

        return (
            rect.width > 0 &&
            rect.height > 0 &&
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            style.opacity !== '0'
        );
    }

    /**
     * Generate unique CSS selector for field
     */
    private generateSelector(element: HTMLElement): string {
        // Prefer ID
        if (element.id) {
            return `#${element.id}`;
        }

        // Use name attribute
        const name = element.getAttribute('name');
        if (name) {
            const tagName = element.tagName.toLowerCase();
            return `${tagName}[name="${name}"]`;
        }

        // Generate path-based selector
        const path: string[] = [];
        let current: Element | null = element;

        while (current && current !== document.body) {
            let selector = current.tagName.toLowerCase();

            // Add class if available
            if (current.className && typeof current.className === 'string') {
                const classes = current.className.split(' ')
                    .filter(c => c && !c.startsWith('css-')) // Exclude dynamic CSS-in-JS classes
                    .slice(0, 2) // Take max 2 classes
                    .join('.');

                if (classes) {
                    selector += `.${classes}`;
                }
            }

            path.unshift(selector);
            current = current.parentElement;

            // Stop if we have a unique enough path
            if (path.length >= 3) {
                break;
            }
        }

        return path.join(' > ');
    }

    /**
     * Extract all options from a radio button group
     */
    private extractRadioOptions(radioInput: HTMLInputElement): string[] {
        const name = radioInput.name;
        if (!name) return [];

        // Find all radios with the same name
        const radios = document.querySelectorAll(`input[type="radio"][name="${name}"]`);
        const options: string[] = [];

        radios.forEach(radio => {
            const label = this.getRadioLabel(radio as HTMLInputElement);
            if (label) {
                options.push(label);
            }
        });

        return options;
    }

    /**
     * Get label text for a radio button
     */
    private getRadioLabel(radio: HTMLInputElement): string | null {
        // Method 1: Check for associated label using for/id
        if (radio.id) {
            const label = document.querySelector(`label[for="${CSS.escape(radio.id)}"]`);
            if (label && label.textContent) {
                return this.cleanLabelText(label.textContent);
            }
        }

        // Method 2: Check parent label (label wrapping input)
        const parentLabel = radio.closest('label');
        if (parentLabel && parentLabel.textContent) {
            return this.cleanLabelText(parentLabel.textContent);
        }

        // Method 3: Check aria-label
        const ariaLabel = radio.getAttribute('aria-label');
        if (ariaLabel && ariaLabel.trim()) {
            return ariaLabel.trim();
        }

        // Method 4: Check next sibling text
        let nextSibling = radio.nextSibling;
        while (nextSibling) {
            if (nextSibling.nodeType === Node.TEXT_NODE && nextSibling.textContent?.trim()) {
                return nextSibling.textContent.trim();
            }
            if (nextSibling.nodeType === Node.ELEMENT_NODE) {
                const element = nextSibling as Element;
                if (element.textContent?.trim()) {
                    return this.cleanLabelText(element.textContent);
                }
            }
            nextSibling = nextSibling.nextSibling;
        }

        return null;
    }

    /**
     * Extract all options from a checkbox group
     * Finds all checkboxes in the same parent container
     */
    private extractCheckboxGroupOptions(checkboxInput: HTMLInputElement): string[] {
        const options: string[] = [];

        // Find the parent container for this checkbox
        let container: HTMLElement | null = checkboxInput.closest('fieldset');
        if (!container) {
            container = checkboxInput.closest('.field, .form-field, .question, .form-group, [role="group"]');
        }
        if (!container) {
            container = checkboxInput.parentElement;
        }

        if (!container) {
            console.warn(`${LOG_PREFIX} ⚠️ Could not find container for checkbox`);
            return [];
        }

        console.log(`${LOG_PREFIX} 📋 Finding all checkboxes in container...`);

        // Find all checkboxes within this container
        const allCheckboxes = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');

        console.log(`${LOG_PREFIX} 📋 Found ${allCheckboxes.length} checkbox(es) in container`);

        allCheckboxes.forEach(checkbox => {
            if (!this.isVisible(checkbox)) return;

            // Get the specific label for THIS checkbox (not the group question)
            const label = this.getCheckboxLabel(checkbox);
            if (label) {
                options.push(label);
                console.log(`${LOG_PREFIX} 📋 Checkbox option: "${label}"`);
            }
        });

        return options;
    }

    /**
     * Get the specific label text for a checkbox option
     * This is different from the group question text
     */
    private getCheckboxLabel(checkbox: HTMLInputElement): string | null {
        // Method 1: Check for associated label using for/id
        if (checkbox.id) {
            const label = document.querySelector(`label[for="${CSS.escape(checkbox.id)}"]`);
            if (label && label.textContent) {
                // For checkbox groups, the label might contain just the option text
                // or it might contain the full question. We want just the option text.
                const labelText = this.cleanLabelText(label.textContent);

                // If label is very short (< 5 chars), it's likely just the option name
                // If it's long and contains the question text, we need to extract just the option
                return labelText;
            }
        }

        // Method 2: Check parent label (label wrapping checkbox)
        const parentLabel = checkbox.closest('label');
        if (parentLabel && parentLabel.textContent) {
            const labelText = this.cleanLabelText(parentLabel.textContent);
            return labelText;
        }

        // Method 3: Check aria-label
        const ariaLabel = checkbox.getAttribute('aria-label');
        if (ariaLabel && ariaLabel.trim()) {
            return ariaLabel.trim();
        }

        // Method 4: Check next sibling text (common pattern for checkboxes)
        let nextSibling = checkbox.nextSibling;
        while (nextSibling) {
            if (nextSibling.nodeType === Node.TEXT_NODE && nextSibling.textContent?.trim()) {
                return nextSibling.textContent.trim();
            }
            if (nextSibling.nodeType === Node.ELEMENT_NODE) {
                const element = nextSibling as Element;
                if (element.textContent?.trim()) {
                    // Get text but exclude nested elements if they're large
                    const text = this.cleanLabelText(element.textContent);
                    if (text.length > 0 && text.length < 100) {
                        return text;
                    }
                }
            }
            nextSibling = nextSibling.nextSibling;
        }

        // Method 5: Check value attribute as last resort
        if (checkbox.value && checkbox.value !== 'on') {
            return checkbox.value;
        }

        return null;
    }
}

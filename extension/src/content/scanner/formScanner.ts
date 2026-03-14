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
import { getQuestionText } from '../utils/questionDetection';
import { FieldType } from '../../types/fieldDetection';

const LOG_PREFIX = "[FormScanner]";

export interface ScannedQuestion {
    questionText: string;
    fieldType: FieldType;
    options?: string[];
    required: boolean;
    selector: string;
    isNavigation?: boolean; // New flag for navigation buttons
}

export interface ScanResult {
    questions: ScannedQuestion[];
    pageType: 'single' | 'multi';
    navigationButtons: string[];
}

/**
 * FormScanner class
 */
export class FormScanner {

    /**
     * Main scan function - scans all form fields on current page
     */
    async scan(): Promise<ScanResult> {
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
                    // RELAXED DEDUPLICATION:
                    // Only treat as a duplicate if the LABEL and the FIELD TYPE are identical.
                    // This allows "Phone" (dropdown, country code) and "Phone" (input, number) to co-exist.
                    const questionKey = `${question.questionText.toLowerCase().trim()}|${question.fieldType}`;

                    if (seenQuestions.has(questionKey)) {
                        // For identical type duplicates, we still apply "Keep First" for files
                        // but for others we usually want the latest/most visible one.
                        if (question.fieldType === FieldType.FILE_UPLOAD) {
                            console.log(`${LOG_PREFIX} 📎 Ignoring duplicate file input: "${question.questionText}"`);
                        } else {
                            console.log(`${LOG_PREFIX} ⚠️ Found identical duplicate: "${question.questionText}" (${question.fieldType}) - Replacing with newest`);
                            const index = questions.findIndex(q => {
                                const k = `${q.questionText.toLowerCase().trim()}|${q.fieldType}`;
                                return k === questionKey;
                            });
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

            console.log(`${LOG_PREFIX} ✅ Scan complete: ${questions.length} fields found`);

        } catch (error) {
            console.error(`${LOG_PREFIX} ❌ Scan error:`, error);
        }

        // Determine page type and navigation buttons
        const navigationButtons = questions
            .filter(q => q.isNavigation)
            .map(q => q.questionText);

        // ── Log all detected navigation buttons ──
        console.log(`\n${LOG_PREFIX} ══════════════════════════════════════════════`);
        console.log(`${LOG_PREFIX} 🔘 NAVIGATION BUTTONS (${navigationButtons.length} found):`);
        if (navigationButtons.length === 0) {
            console.log(`${LOG_PREFIX}    (none detected)`);
        }
        // Also check via Workday data-automation-id on the raw questions list
        const WORKDAY_MULTI_PAGE_AIDS_CLASSIFY = [
            'bottomNavigationNext', 'bottomNavigationSaveAndContinue', 'nextButton',
            'saveAndContinue', 'continueButton', 'navigationNext', 'pageFooterNextButton', 'pageFooterSaveButton'
        ];

        // Keyword groups
        const multiPageKeywords = [
            'next', 'continue', 'save & continue', 'save and continue',
            'save & next', 'save and next', 'proceed', 'go to next step',
            'next step', 'go forward', 'move forward', 'next page', 'submit profile'
        ];

        const singlePageKeywords = [
            'apply', 'submit application', 'submit', 'complete application',
            'complete', 'finish', 'send', 'register', 'create account',
            'post application', 'confirm application', 'finish application',
            'apply now', 'send application'
        ];

        const hasNext = navigationButtons.some(b => {
            const normalized = b.toLowerCase().replace(/\s+/g, ' ').trim();
            const matchedKw = multiPageKeywords.find(kw => normalized === kw || normalized.includes(kw));
            if (matchedKw) {
                console.log(`${LOG_PREFIX}    🔄 MULTI-PAGE button: "${b}" (matched: "${matchedKw}")`);
                return true;
            }
            console.log(`${LOG_PREFIX}    ✅ SINGLE-PAGE button: "${b}"`);
            return false;
        });

        // Also check if any navigation-button questions had a Workday automation-id match
        // (via the selector field which stores fingerprints, OR by re-scanning the DOM)
        const workdayMultiPageEl = document.querySelector(
            WORKDAY_MULTI_PAGE_AIDS_CLASSIFY.map(a => `[data-automation-id="${a}"]`).join(', ')
        );
        const hasWorkdayMultiPageBtn = workdayMultiPageEl !== null && (workdayMultiPageEl as HTMLElement).offsetParent !== null;
        if (hasWorkdayMultiPageBtn) {
            console.log(`${LOG_PREFIX}    🔄 Workday automation-id MULTI-PAGE button detected: [data-automation-id="${workdayMultiPageEl!.getAttribute('data-automation-id')}"]`);
        }

        // Also check for explicit single-page keywords
        const hasSubmit = !hasNext && navigationButtons.some(b => {
            const normalized = b.toLowerCase().replace(/\s+/g, ' ').trim();
            return singlePageKeywords.some(kw => normalized === kw || normalized.includes(kw));
        });

        // Additional check: Look for step indicators in text content if no buttons are obvious
        const hasStepIndicators = questions.some(q =>
            /step \d+ of \d+/i.test(q.questionText) || /page \d+ of \d+/i.test(q.questionText)
        );
        if (hasStepIndicators) {
            console.log(`${LOG_PREFIX}    📑 Step indicator pattern detected in question text`);
        }

        // Classification Priority:
        // 1. Workday automation-id multi-page button → Multi-Page (most reliable signal)
        // 2. Next/Step Indicators → Multi-Page
        // 3. Submit/Apply → Single-Page
        // 4. Default → Single-Page
        let pageType: 'single' | 'multi' = 'single';
        if (hasWorkdayMultiPageBtn || hasNext || hasStepIndicators) {
            pageType = 'multi';
        } else if (hasSubmit) {
            pageType = 'single';
        }

        console.log(`${LOG_PREFIX} 📋 ═══ PAGE TYPE: ${pageType.toUpperCase()} ═══`);
        if (hasWorkdayMultiPageBtn) console.log(`${LOG_PREFIX}    → Reason: Workday data-automation-id multi-page button found`);
        else if (hasNext) console.log(`${LOG_PREFIX}    → Reason: Multi-page navigation button text detected`);
        else if (hasStepIndicators) console.log(`${LOG_PREFIX}    → Reason: Step indicator in page content`);
        else if (hasSubmit) console.log(`${LOG_PREFIX}    → Reason: Submit/apply button detected`);
        else console.log(`${LOG_PREFIX}    → Reason: No navigation buttons found (default: single)`);
        console.log(`${LOG_PREFIX} ══════════════════════════════════════════════\n`);

        return {
            questions,
            pageType,
            navigationButtons
        };
    }

    /**
     * Find all form fields in the current document
     */
    private findAllFormFields(): HTMLElement[] {
        const fields: HTMLElement[] = [];
        const doc = document;

        console.log(`${LOG_PREFIX} 🔍 Scanning document...`);

        // Find all input fields (text, email, tel, file, etc.)
        // EXCLUDE radio and checkbox here - we group them specifically later
        const inputs = doc.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="radio"]):not([type="checkbox"])');
        inputs.forEach(input => {
            const htmlInput = input as HTMLInputElement;
            const isFile = htmlInput.type === 'file';

            if (this.isVisible(htmlInput)) {
                fields.push(htmlInput);
            } else if (isFile) {
                const style = getComputedStyle(htmlInput);
                if (style.display !== 'none' && style.visibility !== 'hidden') {
                    console.log(`${LOG_PREFIX} 📎 Found hidden file input (relaxing visibility): ${htmlInput.id || htmlInput.name}`);
                    fields.push(htmlInput);
                }
            }
        });

        // Find all textareas
        const textareas = doc.querySelectorAll('textarea');
        textareas.forEach(textarea => {
            if (this.isVisible(textarea as HTMLElement)) {
                fields.push(textarea as HTMLElement);
            }
        });

        // Find all native select elements
        const selects = doc.querySelectorAll('select');
        selects.forEach(select => {
            if (this.isVisible(select as HTMLElement)) {
                fields.push(select as HTMLElement);
            }
        });

        // Find custom dropdowns (React-Select, Greenhouse, etc.)
        // Look for elements with role="combobox", aria-haspopup="listbox", role="listbox" or common framework-specific class names
        const customDropdowns = doc.querySelectorAll('[role="combobox"], [aria-haspopup="listbox"], [role="listbox"], [aria-autocomplete], .select2-container, .css-container, [class*="-select-container"], [data-automation-id*="select"], [data-testid*="select"]');
        customDropdowns.forEach(dropdown => {
            if (!this.isVisible(dropdown as HTMLElement)) return;

            // If the dropdown container has an internal input that we already found,
            // we should replace that input with the dropdown container in our fields list.
            const input = dropdown.querySelector('input');
            if (input) {
                const inputIdx = fields.indexOf(input as HTMLElement);
                if (inputIdx !== -1) {
                    console.log(`${LOG_PREFIX} 🔄 Merging custom dropdown container with its internal input`);
                    fields[inputIdx] = dropdown as HTMLElement;
                    return;
                }
            }

            // If not already merged, add if unique
            if (!fields.includes(dropdown as HTMLElement)) {
                fields.push(dropdown as HTMLElement);
            }
        });

        // Find radio button groups (group by name attribute, or by parent container if nameless)
        const radioGroups = new Map<string, HTMLInputElement[]>();
        const radios = doc.querySelectorAll('input[type="radio"]');
        radios.forEach(radio => {
            const input = radio as HTMLInputElement;
            if (!this.isVisible(input)) return;

            // Group key: prefer name attribute, fallback to parent container path for Ashby-style radios
            const name = input.name;
            const groupKey = name
                ? `name_${name}`
                : `container_${this.getContainerKey(input)}`;

            if (!radioGroups.has(groupKey)) {
                radioGroups.set(groupKey, []);
            }
            radioGroups.get(groupKey)!.push(input);
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
        const checkboxGroups = new Map<HTMLElement | string, HTMLInputElement[]>();
        const checkboxes = doc.querySelectorAll('input[type="checkbox"]');

        checkboxes.forEach(checkbox => {
            const input = checkbox as HTMLInputElement;
            if (!this.isVisible(input)) return;

            // 1. Group by Name
            if (input.name) {
                const sameNameCheckboxes = doc.querySelectorAll(`input[type="checkbox"][name="${CSS.escape(input.name)}"]`);
                if (sameNameCheckboxes.length > 1) {
                    const groupKey = `name_${input.name}`;
                    if (!checkboxGroups.has(groupKey)) checkboxGroups.set(groupKey, []);
                    checkboxGroups.get(groupKey)!.push(input);
                    return;
                }
            }

            // 2. Group by Semantic Container
            let container: HTMLElement | null = input.closest('fieldset');
            if (!container) {
                container = input.closest(
                    '[role="group"], .field, .form-field, .question, .form-group, ' +
                    '[class*="Question"], [class*="Field"], [data-testid*="question"], ' +
                    '[class*="_question"], [class*="application-question"], [class*="checkbox-group"], ' +
                    '[class*="surveys-section"], [class*="form-row"]'
                );
            }

            if (container) {
                if (!checkboxGroups.has(container)) checkboxGroups.set(container, []);
                checkboxGroups.get(container)!.push(input);
                return;
            }

            // 3. Fallback: Group by Question Text
            const qText = this.getQuestionText(input);
            if (qText) {
                const groupKey = `qtext_${qText}`;
                if (!checkboxGroups.has(groupKey)) checkboxGroups.set(groupKey, []);
                checkboxGroups.get(groupKey)!.push(input);
            } else {
                checkboxGroups.set(`iso_${Math.random()}`, [input]);
            }
        });

        // Add one representative checkbox from each group
        checkboxGroups.forEach((groupCheckboxes) => {
            if (groupCheckboxes.length > 0) {
                fields.push(groupCheckboxes[0]); 
            }
        });

        // Find custom upload buttons that might not be inputs (click-to-find-input types)
        // IMPORTANT: Skip generic UI buttons that are not real upload controls
        const genericUITexts = [
            'or drag and drop here',
            'drag and drop',
            'drag & drop',
            'click to upload',
            'browse files',
        ];
        const uploadButtons = doc.querySelectorAll('button, [role="button"], .upload-btn, .attach-btn');
        uploadButtons.forEach(btn => {
            if (!this.isVisible(btn as HTMLElement)) return;
            const text = btn.textContent?.toLowerCase().trim() || '';
            // Skip generic UI text that is not a real field
            if (genericUITexts.some(g => text === g || text.startsWith(g))) return;
            if (text.includes('upload') || text.includes('attach') || text.includes('resume')) {
                // If this is a button-only uploader (common in ASK Consulting), add it if no direct file input found
                const hasFileInput = btn.querySelector('input[type="file"]') || btn.parentElement?.querySelector('input[type="file"]');
                if (!hasFileInput) {
                    console.log(`${LOG_PREFIX} 📎 Found potential custom upload trigger: "${text.trim()}"`);
                    fields.push(btn as HTMLElement);
                }
            }
        });

        // ================================================================
        // Find Navigation/Submit Buttons - TWO-PASS DETECTION
        // ================================================================

        // === Workday data-automation-id values for navigation (most reliable) ===
        const WORKDAY_MULTI_PAGE_AIDS = [
            'bottomNavigationNext', 'bottomNavigationSaveAndContinue',
            'nextButton', 'saveAndContinue', 'continueButton',
            'navigationNext', 'pageFooterNextButton', 'pageFooterSaveButton',
        ];
        const WORKDAY_SINGLE_PAGE_AIDS = [
            'bottomNavigationSubmit', 'submitButton', 'applyButton', 'pageFooterSubmitButton',
        ];

        // === Text keywords as fallback ===
        const MULTI_PAGE_TEXT_KWS = [
            'next', 'continue', 'save & continue', 'save and continue',
            'save & next', 'save and next', 'proceed', 'next step',
            'go to next step', 'go forward', 'move forward', 'next page'
        ];
        const SINGLE_PAGE_TEXT_KWS = [
            'submit', 'apply', 'apply now', 'submit application', 'complete application',
            'finish', 'send', 'register', 'create account', 'send application',
            'confirm application', 'finish application'
        ];

        const seenButtons = new Set<Element>();

        console.log(`${LOG_PREFIX} 🔍 PASS 1: Scanning for Workday data-automation-id buttons...`);
        const allAutomationEls = Array.from(doc.querySelectorAll('[data-automation-id]'));
        let pass1Count = 0;
        allAutomationEls.forEach(el => {
            const aid = (el.getAttribute('data-automation-id') || '').toLowerCase();
            const tag = el.tagName.toLowerCase();
            const role = el.getAttribute('role') || '';
            const isButtonLike = tag === 'button' || tag === 'a' || tag === 'input' || role === 'button' || role === 'link';
            if (!isButtonLike) return;
            if (!this.isVisible(el as HTMLElement)) return;
            if (seenButtons.has(el)) return;

            const isMulti = WORKDAY_MULTI_PAGE_AIDS.some(a => aid === a.toLowerCase() || aid.includes(a.toLowerCase()));
            const isSingle = WORKDAY_SINGLE_PAGE_AIDS.some(a => aid === a.toLowerCase() || aid.includes(a.toLowerCase()));

            if (isMulti || isSingle) {
                const displayText = (el.textContent || (el as HTMLInputElement).value || '').replace(/\s+/g, ' ').trim();
                console.log(`${LOG_PREFIX} 🎯 [data-automation-id="${el.getAttribute('data-automation-id')}"] "${displayText || '[no text]'}" → ${isMulti ? '🔄 MULTI-PAGE' : '✅ SINGLE-PAGE'}`);
                if (!fields.includes(el as HTMLElement)) {
                    fields.push(el as HTMLElement);
                }
                seenButtons.add(el);
                pass1Count++;
            }
        });
        console.log(`${LOG_PREFIX} 🔍 PASS 1 done: ${pass1Count} Workday automation-id button(s) found`);

        console.log(`${LOG_PREFIX} 🔍 PASS 2: Scanning buttons by text keywords...`);
        let pass2Count = 0;
        const allButtons = doc.querySelectorAll('button, input[type="submit"], input[type="button"], [role="button"]');
        allButtons.forEach(btn => {
            if (!this.isVisible(btn as HTMLElement)) return;
            if (seenButtons.has(btn)) return; // Already caught by Pass 1

            // Normalize text (handles icon text, whitespace, newlines inside buttons)
            const raw = (btn.textContent || (btn as HTMLInputElement).value || '');
            const text = raw.toLowerCase().replace(/\s+/g, ' ').trim();
            if (!text) return;

            const isMulti = MULTI_PAGE_TEXT_KWS.some(kw => text === kw || text.includes(kw));
            const isSingle = SINGLE_PAGE_TEXT_KWS.some(kw => text === kw || text.includes(kw));

            if (isMulti || isSingle) {
                const aid = btn.getAttribute('data-automation-id') || 'none';
                const displayText = raw.replace(/\s+/g, ' ').trim();
                console.log(`${LOG_PREFIX} 🎯 [text match] "${displayText}" (aid: ${aid}) → ${isMulti ? '🔄 MULTI-PAGE' : '✅ SINGLE-PAGE'}`);
                if (!fields.includes(btn as HTMLElement)) {
                    fields.push(btn as HTMLElement);
                }
                seenButtons.add(btn);
                pass2Count++;
            }
        });
        console.log(`${LOG_PREFIX} 🔍 PASS 2 done: ${pass2Count} text-matched button(s) found`);
        console.log(`${LOG_PREFIX} 🔍 Total navigation buttons detected: ${pass1Count + pass2Count}`);

        return fields;
    }

    /**
     * Get a stable key for a container element (used for grouping nameless radios)
     */
    private getContainerKey(element: HTMLElement): string {
        // Walk up the DOM to find a meaningful container
        let container = element.closest(
            'fieldset, [role="group"], [class*="Question"], [class*="Field"], [class*="_field"], [class*="application-question"]'
        ) || element.parentElement?.parentElement || element.parentElement;

        if (!container) return Math.random().toString(36);

        // Use class + DOM position as the key
        const className = typeof container.className === 'string' ? container.className : '';
        const classKey = className.split(' ').filter(c => c && !c.startsWith('css-')).slice(0, 3).join('.');
        const siblings = Array.from(container.parentElement?.children || []);
        const idx = siblings.indexOf(container as Element);
        return `${classKey}_${idx}`;
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
            if (fieldType === FieldType.DROPDOWN_CUSTOM || fieldType === FieldType.SELECT_NATIVE) {
                console.log(`${LOG_PREFIX} 📋 Extracting options for: "${questionText}"`);
                options = await extractDropdownOptions(field);
                if (options.length === 0) {
                    console.warn(`${LOG_PREFIX} ⚠️ No options extracted for dropdown: "${questionText}"`);
                }
            }

            // Extract options for radio button groups
            if (fieldType === FieldType.RADIO_GROUP) {
                console.log(`${LOG_PREFIX} 📋 Extracting radio options for: "${questionText}"`);
                options = this.extractRadioOptions(field as HTMLInputElement);
                console.log(`${LOG_PREFIX} 📋 Found ${options.length} radio options: [${options.join(', ')}]`);
            }

            // Extract options for checkbox groups
            if (fieldType === FieldType.CHECKBOX) {
                console.log(`${LOG_PREFIX} 📋 Extracting checkbox options for: "${questionText}"`);
                options = this.extractCheckboxGroupOptions(field as HTMLInputElement);
                console.log(`${LOG_PREFIX} 📋 Found ${options.length} checkbox options: [${options.join(', ')}]`);
            }

            return {
                questionText,
                fieldType,
                options,
                required,
                selector,
                isNavigation: fieldType === FieldType.NAVIGATION_BUTTON
            };

        } catch (error) {
            console.error(`${LOG_PREFIX} Error processing field:`, error);
            return null;
        }
    }

    /**
     * Detect the type of form field
     */
    private detectFieldType(element: HTMLElement): FieldType {
        // Custom dropdown detection MUST come first (before HTMLInputElement check)
        // Because Greenhouse dropdowns are <input type="text" role="combobox">
        if (element.getAttribute('role') === 'combobox' ||
            element.getAttribute('aria-haspopup') === 'listbox' ||
            element.closest('[role="combobox"]') ||
            element.querySelector('[role="combobox"]') ||
            element.querySelector('input[role="combobox"]')) {
            return FieldType.DROPDOWN_CUSTOM;
        }

        // Native select
        if (element instanceof HTMLSelectElement) {
            return FieldType.SELECT_NATIVE;
        }

        // Check for select in children
        if (element.querySelector('select')) {
            return FieldType.SELECT_NATIVE;
        }

        // Textarea
        if (element instanceof HTMLTextAreaElement) {
            return FieldType.TEXTAREA;
        }

        // Input fields (checked AFTER dropdown detection)
        if (element instanceof HTMLInputElement) {
            const type = element.type.toLowerCase();

            switch (type) {
                case 'email':
                    return FieldType.EMAIL;
                case 'tel':
                    return FieldType.PHONE;
                case 'number':
                    return FieldType.NUMBER;
                case 'date':
                    return FieldType.DATE;
                case 'file':
                    return FieldType.FILE_UPLOAD;
                case 'radio':
                    return FieldType.RADIO_GROUP;
                case 'checkbox':
                    return FieldType.CHECKBOX;
                default:
                    return FieldType.TEXT;
            }
        }

        // Check for Workday data-automation-id button patterns FIRST (most reliable)
        const aid = (element.getAttribute('data-automation-id') || '').toLowerCase();
        const WORKDAY_NAV_AIDS = [
            'bottomNavigationNext', 'bottomNavigationSaveAndContinue', 'nextButton',
            'saveAndContinue', 'continueButton', 'navigationNext', 'pageFooterNextButton',
            'pageFooterSaveButton', 'bottomNavigationSubmit', 'submitButton', 'applyButton',
            'pageFooterSubmitButton'
        ];
        if (aid && WORKDAY_NAV_AIDS.some(a => aid === a.toLowerCase() || aid.includes(a.toLowerCase()))) {
            return FieldType.NAVIGATION_BUTTON;
        }

        // Text-based button keyword detection (fallback for non-Workday platforms)
        const text = (element.textContent || (element as HTMLInputElement).value || '')
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim();
        const navKeywords = [
            // Multi-page navigation
            'next', 'continue', 'save & continue', 'save and continue', 'save & next', 'save and next',
            'proceed', 'go to next step', 'next step', 'go forward', 'move forward', 'next page',
            // Single-page submission
            'submit', 'apply', 'apply now', 'complete', 'finish', 'send', 'register', 'create account',
            'submit application', 'complete application', 'send application',
            'confirm application', 'finish application'
        ];
        if (navKeywords.some(kw => text === kw || text.includes(kw))) {
            return FieldType.NAVIGATION_BUTTON;
        }

        // Default to text
        return FieldType.TEXT;
    }

    /**
     * Extract question text from field's label or aria-label
     * Uses multiple fallback strategies for reliability
     */
    private getQuestionText(element: HTMLElement): string {
        return getQuestionText(element);
    }

    /**
     * Check if a label is too generic to be useful
     * @deprecated Use version from questionDetection.ts if possible, kept here for internal context utils
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

        // Ashby and many other platforms hide native inputs with opacity: 0
        // while their custom wrappers are visible. We must allow these.
        const isHiddenInput = element instanceof HTMLInputElement &&
            (element.type === 'radio' || element.type === 'checkbox' || element.type === 'file');

        return (
            rect.width > 0 &&
            rect.height > 0 &&
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            (style.opacity !== '0' || isHiddenInput)
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
        const options: string[] = [];
        let allRadios: HTMLInputElement[] = [];

        if (radioInput.name) {
            allRadios = Array.from(document.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${CSS.escape(radioInput.name)}"]`));
        } else {
            const targetQText = this.getQuestionText(radioInput);
            if (targetQText) {
                allRadios = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="radio"]'))
                    .filter(r => this.isVisible(r) && this.getQuestionText(r) === targetQText);
            }
        }

        if (allRadios.length === 0) allRadios = [radioInput];

        allRadios.forEach(radio => {
            if (!this.isVisible(radio)) return;
            const label = this.getRadioLabel(radio);
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
        let text: string | null = null;
        if (radio.id) {
            const label = document.querySelector(`label[for="${CSS.escape(radio.id)}"]`);
            if (label && label.textContent) {
                text = this.cleanLabelText(label.textContent);
            }
        }

        // Method 2: Check parent label (label wrapping input)
        if (!text) {
            const parentLabel = radio.closest('label');
            if (parentLabel && parentLabel.textContent) {
                text = this.cleanLabelText(parentLabel.textContent);
            }
        }

        // Method 3: Check aria-label
        if (!text) {
            const ariaLabel = radio.getAttribute('aria-label');
            if (ariaLabel && ariaLabel.trim()) {
                text = ariaLabel.trim();
            }
        }

        // Method 4: Check next sibling text
        if (!text) {
            let nextSibling = radio.nextSibling;
            while (nextSibling) {
                if (nextSibling.nodeType === Node.TEXT_NODE && nextSibling.textContent?.trim()) {
                    text = nextSibling.textContent.trim();
                    break;
                }
                if (nextSibling.nodeType === Node.ELEMENT_NODE) {
                    const element = nextSibling as Element;
                    if (element.textContent?.trim()) {
                        text = this.cleanLabelText(element.textContent);
                        break;
                    }
                }
                nextSibling = nextSibling.nextSibling;
            }
        }

        if (!text) return null;


        return text;
    }

    /**
     * Extract all options from a checkbox group
     * Finds all checkboxes in the same parent container
     */
    private extractCheckboxGroupOptions(checkboxInput: HTMLInputElement): string[] {
        const options: string[] = [];

        // 1. Try Name grouping first
        if (checkboxInput.name) {
            const sameNameCheckboxes = Array.from(document.querySelectorAll<HTMLInputElement>(`input[type="checkbox"][name="${CSS.escape(checkboxInput.name)}"]`));
            if (sameNameCheckboxes.length > 1) {
                sameNameCheckboxes.forEach(cb => {
                    if (!this.isVisible(cb)) return;
                    const label = this.getCheckboxLabel(cb);
                    if (label) options.push(label);
                });
                return options;
            }
        }

        // 2. Try Semantic Container
        let container: HTMLElement | null = checkboxInput.closest('fieldset');
        if (!container) {
            container = checkboxInput.closest(
                '[role="group"], .field, .form-field, .question, .form-group, ' +
                '[class*="Question"], [class*="Field"], [data-testid*="question"], ' +
                '[class*="_question"], [class*="application-question"], [class*="checkbox-group"], ' +
                '[class*="surveys-section"], [class*="form-row"]'
            );
        }

        if (container) {
            const allCheckboxes = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
            allCheckboxes.forEach(checkbox => {
                if (!this.isVisible(checkbox)) return;
                const label = this.getCheckboxLabel(checkbox);
                if (label) options.push(label);
            });
            return options;
        }

        // 3. Fallback: Group by Question Text
        const targetQText = this.getQuestionText(checkboxInput);
        if (targetQText) {
            const allCheckboxes = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
            allCheckboxes.forEach(checkbox => {
                if (!this.isVisible(checkbox)) return;
                if (this.getQuestionText(checkbox) === targetQText) {
                    const label = this.getCheckboxLabel(checkbox);
                    if (label) options.push(label);
                }
            });
            if (options.length > 0) return options;
        }

        // 4. Absolute fallback: Just return the label for this single checkbox
        const label = this.getCheckboxLabel(checkboxInput);
        if (label) options.push(label);
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

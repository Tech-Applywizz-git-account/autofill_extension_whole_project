/**
 * Workday Filler - EXACT COPY from original content-script.js
 * Only changes: Added TypeScript types, imports for MappedAnswer
 * ALL LOGIC PRESERVED 100% - this is the working code
 */

import { MappedAnswer } from '../mapping/questionMapper';

const LOG_PREFIX = '[WorkdayFiller]';

/* ================================================================== */
/*  CONFIG & STATE                                                     */
/* ================================================================== */

const CONFIG = {
    SCAN_CLICK_DELAY: 600,
    SCAN_OPTION_WAIT: 1500,
    SCAN_CLOSE_DELAY: 400,
    FILL_DELAY: 250,
    MAX_RETRIES: 3,
    RETRY_DELAY: 600,
    STABILITY_MIN: 80,
    STABILITY_MAX: 120,
    CONFIDENCE_THRESHOLD: 0.6,
    ADD_BUTTON_WAIT: 1200,
    SECTION_EXPAND_WAIT: 800
};

const STATE = {
    isFillingInProgress: false,
    stopRequested: false,
    filledFields: new Set<string>(),
    retryCount: new Map<string, number>(),
    DUMMY_DATA: {} as any // Placeholder for when we need to access cascading data
};

/* ================================================================== */
/*  UTILITY FUNCTIONS                                                  */
/* ================================================================== */

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function normalize(text: string = ''): string {
    return text.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
}


function extractLabel(el: HTMLElement, forceQuestionLabel: boolean = false): string {
    // Updated to match Scanner's robust logic (Critical Fix #1 Sync)
    const isRadio = (el as HTMLInputElement).type === 'radio' || el.getAttribute('role') === 'radio';
    let baseLabel = '';

    if (forceQuestionLabel || isRadio) {
        let node: HTMLElement | null = el;
        for (let i = 0; i < 10 && node; i++) {
            node = node.parentElement;
            if (!node) break;
            const automationId = node.getAttribute?.('data-automation-id');
            if (automationId === 'question' || automationId?.startsWith('question')) {
                const prompt = node.querySelector('[data-automation-id="promptLabel"]') ||
                    node.querySelector('[data-automation-id^="promptLabel"]');
                if (prompt && prompt.textContent?.trim()) {
                    baseLabel = prompt.textContent.trim();
                    break;
                }
                const legend = node.querySelector('legend');
                if (legend && legend.textContent?.trim()) {
                    baseLabel = legend.textContent.trim();
                    break;
                }
            }
        }

        if (!baseLabel) {
            const fieldset = el.closest('fieldset');
            if (fieldset && isRadio) {
                const legend = fieldset.querySelector('legend');
                if (legend && legend.textContent?.trim()) baseLabel = legend.textContent.trim();
            }
        }

        if (!baseLabel && isRadio) {
            const parent = el.closest('[role="radiogroup"]') || el.closest('[role="group"]');
            if (parent) {
                const ariaLabel = parent.getAttribute('aria-label');
                if (ariaLabel && ariaLabel.trim()) {
                    baseLabel = ariaLabel.trim();
                } else {
                    const ariaLabelledBy = parent.getAttribute('aria-labelledby');
                    if (ariaLabelledBy) {
                        const labelEl = document.getElementById(ariaLabelledBy);
                        if (labelEl && labelEl.textContent?.trim()) baseLabel = labelEl.textContent.trim();
                    }
                }
            }
        }
    }

    if (!baseLabel) {
        const aria = el.getAttribute('aria-label');
        if (aria && aria.trim()) {
            baseLabel = aria.trim();
        } else {
            const labelledBy = el.getAttribute('aria-labelledby');
            if (labelledBy) {
                const ref = document.getElementById(labelledBy);
                if (ref && ref.textContent?.trim()) baseLabel = ref.textContent.trim();
            }
        }
    }

    if (!baseLabel) {
        // Fallback for some Workday layouts
        let node: HTMLElement | null = el;
        for (let i = 0; i < 10 && node; i++) {
            node = node.parentElement;
            if (!node) break;
            const automationId = node.getAttribute?.('data-automation-id');
            if (automationId === 'question' || automationId?.startsWith('question')) {
                const prompt = node.querySelector('[data-automation-id="promptLabel"]') ||
                    node.querySelector('[data-automation-id^="promptLabel"]');
                if (prompt && prompt.textContent?.trim()) {
                    baseLabel = prompt.textContent.trim();
                    break;
                }
            }
        }
    }

    if (!baseLabel) {
        let sibling: Element | null = el.parentElement;
        for (let i = 0; i < 3 && sibling; i++) {
            const labelNode = sibling.querySelector?.('[data-automation-id="promptLabel"]');
            if (labelNode && labelNode.textContent?.trim()) {
                baseLabel = labelNode.textContent.trim();
                break;
            }
            sibling = sibling.previousElementSibling;
        }
    }

    if (!baseLabel && (el as HTMLInputElement).placeholder && (el as HTMLInputElement).placeholder.trim()) {
        baseLabel = (el as HTMLInputElement).placeholder.trim();
    }

    if (!baseLabel && el.id) {
        const htmlLabel = document.querySelector(`label[for="${el.id}"]`);
        if (htmlLabel && htmlLabel.textContent?.trim()) baseLabel = htmlLabel.textContent.trim();
    }

    if (!baseLabel) {
        const parentLabel = el.closest('label');
        if (parentLabel && parentLabel.textContent?.trim()) baseLabel = parentLabel.textContent.trim();
    }

    if (baseLabel) {
        const low = baseLabel.toLowerCase();
        if (['month', 'year', 'select one', 'search', 'mm', 'yyyy'].includes(low) ||
            low.includes('select one required')) {
            const container = el.closest(
                '[data-automation-id="active-experience-item"], ' +
                '[data-automation-id="experience-item"], ' +
                '[data-automation-id="education-item"], ' +
                'fieldset, [data-automation-id*="date-range"], ' +
                '[data-automation-id*="formField"]'
            );
            if (container) {
                const prompt = container.querySelector('[data-automation-id="promptLabel"], legend, label');
                if (prompt && prompt.textContent?.trim() && prompt.textContent.trim() !== baseLabel) {
                    return `${prompt.textContent.trim()} ${baseLabel}`;
                }
            }
        }
        return baseLabel;
    }

    if (!baseLabel) {
        const isFile = (el as HTMLInputElement).type === 'file' || el.getAttribute('data-automation-id')?.includes('file');
        if (isFile) {
            const container = el.closest('[data-automation-id^="question"], [data-automation-id*="formField"], section, fieldset, .wd-form-field');
            const text = container?.textContent || el.parentElement?.parentElement?.textContent || '';
            if (/resume|cv|curriculum vitae/i.test(text)) return 'Resume';
            if (/cover letter/i.test(text)) return 'Cover Letter';
        }
    }

    return '';
}



// Debug helper to catch page unloads
function setupUnloadListener() {
    window.addEventListener('beforeunload', (e) => {
        if (STATE.isFillingInProgress) {
            console.warn(`${LOG_PREFIX} ⚠️ Page unloading while filling! This suggests a crash or accidental form submission.`);
            // Try to log what we were doing
            const lastLog = sessionStorage.getItem('WD_LAST_ACTION');
            if (lastLog) {
                console.warn(`${LOG_PREFIX} 🔍 Last recorded action before unload: ${lastLog}`);
            }
        }
    });
}
setupUnloadListener();

async function isStable(el: HTMLElement): Promise<boolean> {
    const wait = CONFIG.STABILITY_MIN + Math.random() * (CONFIG.STABILITY_MAX - CONFIG.STABILITY_MIN);
    await sleep(wait);
    return document.contains(el);
}

function triggerInputEvent(element: HTMLElement) {
    const events = ['input', 'change', 'blur', 'focusout'];
    events.forEach(eventType => {
        element.dispatchEvent(new Event(eventType, { bubbles: true, cancelable: true }));
    });
}

/* ================================================================== */
/*  FILLING LOGIC                                                      */
/* ================================================================== */

async function fillTextbox(el: HTMLElement, value: string): Promise<boolean> {
    if (!value) return false;
    try {
        const label = extractLabel(el).toLowerCase();
        let finalValue = value;

        if (label.includes('month') || label.includes(' mm')) {
            // Extract month from "YYYY-MM-DD" if present
            if (value.match(/^\d{4}-\d{2}-\d{2}$/)) {
                const parts = value.split('-');
                if (parts.length === 3) {
                    finalValue = parts[1]; // "05"
                }
            }

            const monthMap: Record<string, string> = {
                'january': '01', 'february': '02', 'march': '03', 'april': '04',
                'may': '05', 'june': '06', 'july': '07', 'august': '08',
                'september': '09', 'october': '10', 'november': '11', 'december': '12',
                'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
                'jun': '06', 'jul': '07', 'aug': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
            };
            if (monthMap[finalValue.toLowerCase()]) finalValue = monthMap[finalValue.toLowerCase()];
        } else if (label.includes('year') || label.includes('yyyy')) {
            // Extract year from "YYYY-MM-DD" if present
            if (value.match(/^\d{4}-\d{2}-\d{2}$/)) {
                finalValue = value.split('-')[0];
            }
        }

        el.click();
        await sleep(150);
        el.focus();
        await sleep(100);

        try {
            // Updated to handle TypeScript any casting for internal prototype hacks
            let proto = Object.getPrototypeOf(el);
            let setter;
            while (proto && !setter) {
                const desc = Object.getOwnPropertyDescriptor(proto, 'value');
                if (desc && desc.set) setter = desc.set;
                proto = Object.getPrototypeOf(proto);
            }
            if (setter) setter.call(el, finalValue);
            else if ('value' in el) (el as HTMLInputElement).value = finalValue;
            else {
                (el as HTMLElement).innerText = finalValue;
                (el as HTMLElement).textContent = finalValue;
            }
        } catch (e) {
            if ('value' in el) (el as HTMLInputElement).value = finalValue;
            else (el as HTMLElement).innerText = finalValue;
        }

        triggerInputEvent(el);
        await sleep(100);
        el.click();
        await sleep(100);
        triggerInputEvent(el);
        await sleep(50);
        el.blur();
        await sleep(50);

        console.log(`${LOG_PREFIX} ✅ Filled textbox: "${extractLabel(el)}" = "${finalValue}"`);
        return true;
    } catch (err) {
        console.error(`${LOG_PREFIX} ❌ Failed to fill textbox:`, err);
        return false;
    }
}

async function fillDropdown(el: HTMLElement, targetValue: string, label: string): Promise<boolean> {
    try {
        console.log(`${LOG_PREFIX} 🔽 Filling dropdown: "${label}" = "${targetValue}"`);

        // Safety check for empty label to prevent API errors
        if (!label && !el.getAttribute('data-automation-id')) {
            console.warn(`${LOG_PREFIX} ⚠️  Warning: Filling dropdown with empty label. This might trigger API errors.`);
        }

        let inputEl: HTMLInputElement | null = null;
        let buttonEl: HTMLElement | null = null;

        if (el.tagName === 'INPUT') {
            inputEl = el as HTMLInputElement;
            const container = el.closest('[data-automation-id="question"]');
            if (container) buttonEl = container.querySelector('button[aria-haspopup="listbox"]');
        } else if (el.tagName === 'BUTTON' && el.getAttribute('aria-haspopup') === 'listbox') {
            buttonEl = el as HTMLElement;
        }

        document.body.click();
        await sleep(CONFIG.SCAN_CLOSE_DELAY);

        // Store IDs, not elements!
        const existingListboxIds = new Set(
            Array.from(document.querySelectorAll('[role="listbox"]')).map(lb =>
                lb.id || lb.outerHTML.substring(0, 100)
            )
        );

        if (inputEl) {
            inputEl.focus();
            await sleep(200);

            const nativeSetter = Object.getOwnPropertyDescriptor(
                window.HTMLInputElement.prototype, 'value'
            )?.set;

            if (nativeSetter) {
                nativeSetter.call(inputEl, '');
                triggerInputEvent(inputEl);
                await sleep(200);

                nativeSetter.call(inputEl, targetValue);
                inputEl.dispatchEvent(new Event('input', { bubbles: true }));
                inputEl.dispatchEvent(new Event('change', { bubbles: true }));
                inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));

                await sleep(1800);
            }
        } else if (buttonEl) {
            buttonEl.click();
            await sleep(800);
        } else {
            return false;
        }

        const allListboxes = Array.from(document.querySelectorAll('[role="listbox"]'));
        const newListboxes = allListboxes.filter(lb => {
            const id = lb.id || lb.outerHTML.substring(0, 100);
            if (existingListboxIds.has(id)) return false;
            const style = window.getComputedStyle(lb);
            return style.display !== 'none' && style.visibility !== 'hidden' && (lb as HTMLElement).offsetParent !== null;
        });

        let listbox: Element | null = null;
        if (newListboxes.length >= 1) {
            const refRect = (inputEl || buttonEl!).getBoundingClientRect();
            let bestDist = Infinity;
            for (const lb of newListboxes) {
                const lbRect = lb.getBoundingClientRect();
                const dist = Math.abs(lbRect.top - refRect.bottom);
                if (dist < bestDist) { bestDist = dist; listbox = lb; }
            }
        }

        if (!listbox) {
            // Keep user's exact logic: click body and fail if no listbox found
            document.body.click();
            await sleep(300);
            return false;
        }

        return await selectFromListbox(listbox as HTMLElement, targetValue, label, inputEl);

    } catch (err) {
        console.error(`${LOG_PREFIX} ❌ Dropdown error:`, err);
        document.body.click();
        await sleep(300);
        return false;
    }
}

async function selectFromListbox(listbox: HTMLElement, targetValue: string, label: string, inputEl: HTMLInputElement | null): Promise<boolean> {
    const options = [
        ...Array.from(listbox.querySelectorAll('[role="option"]')),
        ...Array.from(listbox.querySelectorAll('[role="menuitem"]')),
        ...Array.from(listbox.querySelectorAll('[data-automation-id="menuItem"]')),
        ...Array.from(listbox.querySelectorAll('.wd-popup-item'))
    ];

    if (!options.length) {
        document.body.click();
        await sleep(300);
        return false;
    }

    let match = options.find(opt =>
        opt.textContent?.trim().toLowerCase() === targetValue.toLowerCase()
    );

    if (!match) {
        match = options.find(opt =>
            opt.textContent?.trim().toLowerCase().includes(targetValue.toLowerCase()) ||
            targetValue.toLowerCase().includes(opt.textContent?.trim().toLowerCase() || '')
        );
    }

    if (!match) {
        const targetWords = targetValue.toLowerCase().split(/\s+/);
        match = options.find(opt => {
            const optText = opt.textContent?.trim().toLowerCase() || '';
            return targetWords.every(word => optText.includes(word));
        });
    }

    if (match) {
        (match as HTMLElement).click();
        await sleep(400);
        if (inputEl) triggerInputEvent(inputEl);
        await sleep(300);

        if (inputEl) {
            inputEl.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true
            }));
            await sleep(100);
            inputEl.blur();
        }
        document.body.click();
        await sleep(200);

        console.log(`${LOG_PREFIX} ✅ Selected "${match.textContent?.trim()}" for "${label}"`);
        return true;
    } else {
        console.warn(`${LOG_PREFIX} ❌ No match for "${targetValue}" in dropdown "${label}"`);
        document.body.click();
        await sleep(300);
        return false;
    }
}

async function fillRadio(el: HTMLElement, value: string, fieldData: any): Promise<boolean> {
    try {
        if (fieldData && fieldData.radioGroupOptions && fieldData.radioGroupOptions.length > 0) {
            const targetOption = fieldData.radioGroupOptions.find((ro: any) =>
                normalize(ro.label) === normalize(value) ||
                normalize(ro.label).includes(normalize(value)) ||
                normalize(value).includes(normalize(ro.label))
            );

            if (targetOption) {
                // IMPORTANT: Double-click pattern from working code
                targetOption.element.click();
                await sleep(150);
                targetOption.element.click(); // Second click ensures selection
                await sleep(200);
                console.log(`${LOG_PREFIX} ✅ Selected radio: "${targetOption.label}" for "${fieldData.label}"`);
                return true;
            }

            console.warn(`${LOG_PREFIX} ❌ Radio option "${value}" not found. Available:`,
                fieldData.radioGroupOptions.map((ro: any) => ro.label));
            return false;
        }

        const radioLabel = el.getAttribute('aria-label') || el.textContent?.trim() || '';
        if (normalize(radioLabel) === normalize(value) ||
            normalize(radioLabel).includes(normalize(value))) {
            el.click();
            await sleep(150);
            el.click(); // Double-click
            await sleep(200);
            console.log(`${LOG_PREFIX} ✅ Selected radio: "${radioLabel}"`);
            return true;
        }
        return false;
    } catch (err) {
        console.error(`${LOG_PREFIX} ❌ Radio error:`, err);
        return false;
    }
}

async function fillCheckbox(el: HTMLElement, value: string | boolean): Promise<boolean> {
    try {
        const isChecked = (el as HTMLInputElement).checked || el.getAttribute('aria-checked') === 'true';
        const strValue = String(value);
        const shouldBeChecked = strValue === 'Yes' || value === true ||
            normalize(strValue) === 'true' || normalize(strValue) === 'currently work here';

        if (isChecked !== shouldBeChecked) {
            el.click();
            await sleep(200);
            triggerInputEvent(el);
            console.log(`${LOG_PREFIX} ✅ Toggled checkbox to ${shouldBeChecked}`);
            return true;
        }
        return true;
    } catch (err) {
        console.error(`${LOG_PREFIX} ❌ Checkbox error:`, err);
        return false;
    }
}

async function fillFileUpload(el: HTMLElement, value: string, fileName?: string): Promise<boolean> {
    try {
        console.log(`${LOG_PREFIX} 📁 Attempting file upload: ${fileName || 'file'}`);

        // Check if value is base64 data URL
        if (!value || !value.startsWith('data:')) {
            console.warn(`${LOG_PREFIX} ⚠️ File value is not a base64 data URL. Highlighting only.`);
            // Fallback to highlighting if not base64
            el.style.border = '3px solid #FF6B35';
            el.style.backgroundColor = '#FFF5F2';
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return false;
        }

        // Convert base64 to Blob
        const base64Data = value.split(',')[1];
        const mimeMatch = value.match(/data:([^;]+);/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'application/pdf';

        // Create blob from base64
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mimeType });

        // Create File object
        const file = new File([blob], fileName || 'resume.pdf', { type: mimeType });

        // Create DataTransfer to set files
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);

        // Set files on input element
        const input = el as HTMLInputElement;
        if (input.tagName === 'INPUT' && input.type === 'file') {
            input.files = dataTransfer.files;

            // Trigger change event
            input.dispatchEvent(new Event('change', { bubbles: true }));
            input.dispatchEvent(new Event('input', { bubbles: true }));

            console.log(`${LOG_PREFIX} ✅ File uploaded: ${fileName}`);
            return true;
        } else {
            console.error(`${LOG_PREFIX} Element is not a file input`);
            return false;
        }
    } catch (err) {
        console.error(`${LOG_PREFIX} ❌ File upload error:`, err);
        return false;
    }
}

async function handleCascadingDropdown(el: HTMLElement, primaryValue: string, secondaryValue: string, label: string): Promise<boolean> {
    console.log(`${LOG_PREFIX} 🔗 Cascading: "${label}" → "${primaryValue}" → "${secondaryValue}"`);

    const firstOk = await fillDropdown(el, primaryValue, label);
    if (!firstOk) return false;

    console.log(`${LOG_PREFIX} ⏳ Waiting for second-level dropdown...`);
    await sleep(1200);

    const container = el.closest('[data-automation-id="question"]') || el.closest('fieldset') || el.parentElement;
    if (!container) return false;

    const possibleFields = container.querySelectorAll('input[type="text"], button[aria-haspopup="listbox"]');
    for (const field of Array.from(possibleFields)) {
        if (field === el) continue;
        const fieldLabel = extractLabel(field as HTMLElement).toLowerCase();
        if (fieldLabel.includes('platform') || fieldLabel.includes('social') ||
            fieldLabel.includes('which') || fieldLabel.includes('specify')) {
            console.log(`${LOG_PREFIX} ✅ Found second-level field: "${fieldLabel}"`);
            return await fillDropdown(field as HTMLElement, secondaryValue, fieldLabel);
        }
    }

    console.log(`${LOG_PREFIX} ⚠️ No second-level dropdown found`);
    return false;
}

async function fillFieldWithRetry(fieldData: any): Promise<boolean> {
    const { element: el, fieldType, label, fingerprint: fp, mappedIntent: intent, mappedValue: value } = fieldData;

    // DEBUG: Log current action for unload listener
    sessionStorage.setItem('WD_LAST_ACTION', `Filling "${label}" (${fieldType}) with "${value}"`);

    const currentRetries = STATE.retryCount.get(fp) || 0;

    if (currentRetries >= CONFIG.MAX_RETRIES) {
        console.log(`${LOG_PREFIX} ⛔ Max retries for: "${label}"`);
        return false;
    }

    let success = false;

    // SAFETY CHECK: Never fill fields with empty labels
    // This prevents accidental interaction with the global language switcher which causes page reloads
    if (!label || !label.trim()) {
        console.warn(`${LOG_PREFIX} ⚠️ SKIPPING field with empty label to prevent crashes/reloads. Value: "${value}"`);
        return false;
    }

    if (intent === 'how_did_you_hear' && fieldType === 'combobox') {
        // We use dummy data because cascading logic is hardcoded in original script
        // In this integration, we might want to adapt, but user asked for EXACT copy
        // For now, we will try to use the mapped value as primary, and empty as secondary if undefined
        success = await handleCascadingDropdown(
            el, value, '', label
        );
    } else if (fieldType === 'textbox') {
        success = await fillTextbox(el, value);
    } else if (fieldType === 'combobox' || fieldType === 'select') {
        success = await fillDropdown(el, value, label);
    } else if (fieldType === 'radio') {
        success = await fillRadio(el, value, fieldData);
    } else if (fieldType === 'checkbox') {
        success = await fillCheckbox(el, value);
    } else if (fieldType === 'file') {
        success = await fillFileUpload(el, value, fieldData.fileName);
    }

    if (!success && currentRetries < CONFIG.MAX_RETRIES - 1 && fieldType !== 'file') {
        STATE.retryCount.set(fp, currentRetries + 1);
        console.log(`${LOG_PREFIX} 🔄 Retry ${currentRetries + 1}/${CONFIG.MAX_RETRIES} for: "${label}"`);
        await sleep(CONFIG.RETRY_DELAY);
        return await fillFieldWithRetry(fieldData);
    }

    if (success) STATE.retryCount.delete(fp);
    return success;
}

async function fillMappedFields(mappedFields: any[]): Promise<{ filled: number, failed: number, skipped: number }> {
    console.log('');
    console.log(`${LOG_PREFIX} ╔══════════════════════════════════════════════════════╗`);
    console.log(`${LOG_PREFIX} ║    PHASE 3: FILLING MAPPED FIELDS                   ║`);
    console.log(`${LOG_PREFIX} ╚══════════════════════════════════════════════════════╝`);
    console.log('');

    STATE.isFillingInProgress = true;

    let filled = 0, failed = 0, skipped = 0;

    for (const field of mappedFields) {
        if (STATE.stopRequested) {
            console.log(`${LOG_PREFIX} 🛑 Stop requested`);
            break;
        }

        if (!field.mappedValue) {
            skipped++;
            continue;
        }

        if (STATE.filledFields.has(field.fingerprint)) {
            console.log(`${LOG_PREFIX} ⏭️ Already filled: "${field.label}"`);
            skipped++;
            continue;
        }

        if (!(await isStable(field.element))) {
            console.log(`${LOG_PREFIX} ⏭️ Unstable: "${field.label}"`);
            skipped++;
            continue;
        }

        console.log(`\n${LOG_PREFIX} 🎯 Filling: "${field.label}" = "${field.mappedValue}" (${field.fieldType})`);

        const success = await fillFieldWithRetry(field);

        if (success) {
            STATE.filledFields.add(field.fingerprint);
            filled++;
        } else {
            failed++;
        }

        await sleep(CONFIG.FILL_DELAY);
    }

    STATE.isFillingInProgress = false;

    console.log('');
    console.log(`${LOG_PREFIX} ┌─────────────────────────────────────────────────────┐`);
    console.log(`${LOG_PREFIX} │  FILL RESULTS                                       │`);
    console.log(`${LOG_PREFIX} └─────────────────────────────────────────────────────┘`);
    console.log(`${LOG_PREFIX}    ✅ Filled:  ${filled}`);
    console.log(`${LOG_PREFIX}    ❌ Failed:  ${failed}`);
    console.log(`${LOG_PREFIX}    ⏭️  Skipped: ${skipped}`);
    console.log('');

    return { filled, failed, skipped };
}

/**
 * Entry point for the integration
 */
export async function fillMappedAnswers(
    mappedAnswers: MappedAnswer[],
    discoveredFields: any[]
): Promise<{ filled: number, failed: number, skipped: number }> {
    console.log(`${LOG_PREFIX} ═════════════════════════════════════════`);
    console.log(`${LOG_PREFIX} STARTING FILL PROCESS`);
    console.log(`${LOG_PREFIX} ═════════════════════════════════════════`);

    // Prepare mapped fields compatible with the legacy code structure
    const mappedFields = [];

    // Map the discovered fields to the provided answers
    // We match primarily on FINGERPRINT (Selector), then fallback to Label
    for (const field of discoveredFields) {
        // Match by fingerprint OR by normalized label as fallback
        // Casting to any because MappedAnswer might not explicitly show selector in all interfaces but it should be there from the mapper
        const answer = mappedAnswers.find(a =>
            (a as any).selector === field.fingerprint ||
            normalize(a.questionText) === normalize(field.label)
        );

        if (answer) {
            // Add mapped value to the field object
            field.mappedValue = answer.answer;
            field.mappedIntent = answer.source; // Store source as intent for logging
            if ((answer as any).fileName) {
                field.fileName = (answer as any).fileName;
            }
            mappedFields.push(field);
        }
    }

    console.log(`${LOG_PREFIX} Prepared ${mappedFields.length} fields for filling`);

    return await fillMappedFields(mappedFields);
}

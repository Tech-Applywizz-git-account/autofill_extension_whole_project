// extension/src/content/actions/autofillActions.ts
/**
 * Form interaction utilities for autofilling fields
 * Simulates human-like interactions with proper event dispatching
 */

import { jobrightSelectDropdown } from "./dropdownInteractions";
import { isGreenhousePage, isBambooHRPage } from "../utils/platformDetection";
import { getQuestionText } from "../utils/questionDetection";

/**
 * Type text into an input field character-by-character
 */
export async function typeLikeHuman(
    element: HTMLInputElement | HTMLTextAreaElement,
    value: string
): Promise<boolean> {
    try {
        element.focus();
        element.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true }));

        // Clear existing value
        element.value = "";
        element.dispatchEvent(new Event("input", { bubbles: true }));

        // Type character by character
        try {
            const response = await chrome.runtime.sendMessage({
                action: "trustedType",
                text: value
            });
            if (response?.success) {
                element.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, cancelable: true }));
                element.dispatchEvent(new Event("change", { bubbles: true }));
                element.blur();
                return verifyInputValue(element, value);
            }
        } catch (e) {
            console.warn("[Autofill] Trusted typing failed, falling back to DOM simulation", e);
        }

        // Fallback: Type character by character simulation
        for (const char of value) {
            element.value += char;
            element.dispatchEvent(new Event("input", { bubbles: true }));
            element.dispatchEvent(new KeyboardEvent("keypress", { key: char, bubbles: true }));
            await sleep(2); // Ultra-fast
        }

        // Dispatch final events
        element.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, cancelable: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
        element.blur();

        return verifyInputValue(element, value);
    } catch (error) {
        console.error("Failed to type into field:", error);
        return false;
    }
}

/**
 * Fill input field instantly (faster alternative)
 */
export async function fillInput(
    element: HTMLInputElement | HTMLTextAreaElement,
    value: string
): Promise<boolean> {
    try {
        // 1. Focus and initial state
        element.focus();
        element.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true }));

        // 2. Multi-method value setting (React/Vue/Vanilla)
        const prototype = element instanceof HTMLTextAreaElement
            ? window.HTMLTextAreaElement.prototype
            : window.HTMLInputElement.prototype;

        const nativeSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;

        if (nativeSetter) {
            nativeSetter.call(element, value);
        } else {
            element.value = value;
        }

        // 3. Comprehensive Event Sequence
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, cancelable: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));

        // 4. Final blur triggers many validation frameworks
        element.blur();

        return verifyInputValue(element, value);
    } catch (error) {
        console.error("Failed to fill input:", error);
        return false;
    }
}

/**
 * Select a radio button by label text with improved matching
 */
export async function selectRadioByLabel(
    name: string,
    labelText: string
): Promise<boolean> {
    try {
        console.log(`[selectRadioByLabel] 🎯 Attempting to select radio: name="${name}", label="${labelText}"`);

        const radios = Array.from(document.querySelectorAll<HTMLInputElement>(
            `input[type="radio"][name="${name}"]`
        ));

        console.log(`[selectRadioByLabel] 📋 Found ${radios.length} radio buttons in group`);

        if (radios.length === 0) {
            console.warn(`[selectRadioByLabel] ❌ No radio buttons found with name="${name}"`);
            return false;
        }

        // Strategy 1: Exact match (case-insensitive)
        for (const radio of radios) {
            const labelContent = getRadioLabel(radio);
            if (labelContent && normalizeText(labelContent) === normalizeText(labelText)) {
                console.log(`[selectRadioByLabel] ✅ Exact match found: "${labelContent}"`);
                return await clickRadio(radio, labelContent);
            }
        }

        // Strategy 2: Partial/Meaning match
        const target = normalizeText(labelText);
        if (target === 'yes' || target === 'no') {
            // BE CAREFUL: Don't let 'no' match 'no - but relocating'
            // Only match if the label is EXACTLY yes/no or starts with it followed by punctuation
            for (const radio of radios) {
                const label = normalizeText(getRadioLabel(radio) || "");
                if (label === target || label.startsWith(target + " ") || label.startsWith(target + ",") || label.startsWith(target + ".")) {
                    console.log(`[selectRadioByLabel] ✅ Strict boolean match found: "${label}"`);
                    return await clickRadio(radio, label);
                }
            }
        } else {
            // Longer descriptive labels
            for (const radio of radios) {
                const label = normalizeText(getRadioLabel(radio) || "");
                if (label.includes(target) || target.includes(label)) {
                    console.log(`[selectRadioByLabel] ✅ Partial match found: "${label}"`);
                    return await clickRadio(radio, label);
                }
            }
        }

        // Strategy 3: Value match
        for (const radio of radios) {
            if (radio.value && normalizeText(radio.value) === target) {
                return await clickRadio(radio, radio.value);
            }
        }

        console.warn(`[selectRadioByLabel] ❌ No matching radio button found for: "${labelText}"`);
        console.log(`[selectRadioByLabel] Available options:`, radios.map(r => getRadioLabel(r) || r.value));
        return false;
    } catch (error) {
        console.error("[selectRadioByLabel] ❌ Error selecting radio:", error);
        return false;
    }
}

/**
 * Helper to click a radio button with proper event handling
 */
async function clickRadio(radio: HTMLInputElement, labelText: string): Promise<boolean> {
    try {
        const labelElement = getLabelElement(radio);

        // Build a prioritized list of click targets
        // Try from most specific (label) to the raw input
        const targets: HTMLElement[] = [];

        // 1. The label is the most reliable click target
        if (labelElement) targets.push(labelElement);

        // 2. Ashby wraps radio in a span/div inside the label
        //    e.g. <label><span class="...Radio_box"><input .../></span>YES</label>
        const ashbyWrapper = radio.closest('[class*="Radio_container"], [class*="Radio_box"], [class*="Radio_pill"], [class*="radio-item"]') as HTMLElement | null;
        if (ashbyWrapper && !targets.includes(ashbyWrapper)) targets.push(ashbyWrapper);

        // 3. Greenhouse radio wrappers
        const greenhouseWrapper = radio.closest('.radio_button, .radio-button-container') as HTMLElement | null;
        if (greenhouseWrapper && !targets.includes(greenhouseWrapper)) targets.push(greenhouseWrapper);

        // 4. Lever/generic wrapper
        const leverWrapper = radio.closest('.application-question, .application-field') as HTMLElement | null;
        if (leverWrapper && !targets.includes(leverWrapper)) targets.push(leverWrapper);

        // 5. Parent element as a generic fallback
        if (radio.parentElement && !targets.includes(radio.parentElement)) targets.push(radio.parentElement);

        // 6. The input itself as the last resort
        if (!targets.includes(radio)) targets.push(radio);

        console.log(`[clickRadio] 🖱️ Clicking radio for: "${labelText}"`, {
            checkedBefore: radio.checked,
            targetsCount: targets.length
        });

        // Try each target in order until the radio is checked
        for (const target of targets) {
            const events = [
                new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'mouse' }),
                new MouseEvent('mousedown', { bubbles: true, cancelable: true }),
                new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerType: 'mouse' }),
                new MouseEvent('mouseup', { bubbles: true, cancelable: true }),
                new MouseEvent('click', { bubbles: true, cancelable: true })
            ];

            events.forEach(evt => target.dispatchEvent(evt));

            // Give React/Vue time to update state (Ashby needs ~300ms)
            // Verification: check either radio.checked OR Ashby's _active_ class on the target
            const success = await waitForCommit(() => {
                const isChecked = radio.checked;
                const isActiveClass = Array.from(target.classList).some(c => c.includes('_active'));
                return isChecked || isActiveClass;
            }, 500);
            if (success) {
                console.log(`[clickRadio] ✅ Radio selected via target: ${target.tagName}.${target.className.split(' ').slice(0, 2).join('.')}`);
                return true;
            }
        }

        // Final fallback: force React event dispatch on the input directly
        if (!radio.checked) {
            radio.checked = true;
            radio.dispatchEvent(new Event('change', { bubbles: true }));
            radio.dispatchEvent(new Event('input', { bubbles: true }));
            await waitForCommit(() => radio.checked, 200);
        }

        if (radio.checked) {
            console.log(`[clickRadio] ✅ Radio selected (forced React dispatch): ${labelText}`);
            return true;
        }

        console.warn(`[clickRadio] ⚠️ Radio NOT selected after all attempts: ${labelText}`);
        return false;
    } catch (error) {
        console.error('[clickRadio] ❌ Error:', error);
        return false;
    }
}

// Helper to wait for state commit (used in radio selection)
async function waitForCommit(
    condition: () => boolean,
    timeout = 500
): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        if (condition()) return true;
        await sleep(30);
    }
    return false;
}

/**
 * Set checkbox state
 */
export async function setCheckbox(
    element: HTMLInputElement,
    checked: boolean
): Promise<boolean> {
    try {
        const currentState = element.checked;

        if (currentState !== checked) {
            console.log(`[setCheckbox] 🔘 Toggling checkbox to ${checked}`);

            const label = getLabelElement(element);

            // Build ordered list of targets to try
            const targets: HTMLElement[] = [];
            if (label) targets.push(label);

            // Ashby wrappers
            const ashbyWrapper = element.closest('[class*="Checkbox_container"], [class*="Checkbox_box"], [class*="Checkbox_pill"], [class*="checkbox-item"]') as HTMLElement | null;
            if (ashbyWrapper) targets.push(ashbyWrapper);

            // Greenhouse/BambooHR wrappers
            const greenhouseWrapper = element.closest('.checkbox, .checkbox-container') as HTMLElement | null;
            if (greenhouseWrapper && !targets.includes(greenhouseWrapper)) targets.push(greenhouseWrapper);

            // Lever/generic wrapper
            const leverWrapper = element.closest('.application-question, .application-field') as HTMLElement | null;
            if (leverWrapper && !targets.includes(leverWrapper)) targets.push(leverWrapper);

            // Parent element as a generic fallback  
            if (element.parentElement && !targets.includes(element.parentElement)) targets.push(element.parentElement);

            // The input itself as last resort
            if (!targets.includes(element)) targets.push(element);

            console.log(`[setCheckbox] 🖱️ Trying ${targets.length} targets for checkbox`);

            for (const target of targets) {
                target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                target.click();

                const committed = await waitForCommit(() => element.checked === checked, 400);
                if (committed) {
                    console.log(`[setCheckbox] ✅ Checked via target: ${target.tagName}.${target.className?.split?.(' ')?.slice(0, 2)?.join('.')}`);
                    break;
                }
            }

            // Final forced fallback
            if (element.checked !== checked) {
                element.checked = checked;
                element.dispatchEvent(new Event('change', { bubbles: true }));
                element.dispatchEvent(new Event('input', { bubbles: true }));
                await waitForCommit(() => element.checked === checked, 200);
            }
        }

        const success = element.checked === checked;
        console.log(`[setCheckbox] ${success ? '✅' : '❌'} Result: ${element.checked}`);
        return success;
    } catch (error) {
        console.error('Failed to set checkbox:', error);
        return false;
    }
}

/**
 * Select multiple checkboxes in a checkbox group
 * Used for multi-select questions like "Which frameworks have you worked with?"
 */
export async function selectMultiCheckbox(
    questionText: string,
    selectedOptions: string[],
    availableOptions: string[]
): Promise<boolean> {
    try {
        console.log(`[selectMultiCheckbox] 🎯 Question: "${questionText}"`);
        console.log(`[selectMultiCheckbox] 📋 Selected options:`, selectedOptions);
        console.log(`[selectMultiCheckbox] 📋 Available options:`, availableOptions);

        let successCount = 0;
        const normalizedQuestion = questionText.toLowerCase().trim();

        // Find all checkboxes on the page
        const allCheckboxes = document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');

        // For each checkbox, check if it belongs to this question group
        for (const checkbox of Array.from(allCheckboxes)) {
            // Get the question text for this checkbox
            const checkboxQuestion = getCheckboxQuestionText(checkbox);
            if (!checkboxQuestion || checkboxQuestion.toLowerCase().trim() !== normalizedQuestion) {
                continue; // Not part of this question group
            }

            // Get the specific label for this checkbox option
            const checkboxLabel = getCheckboxOptionLabel(checkbox);
            if (!checkboxLabel) {
                console.warn(`[selectMultiCheckbox] ⚠️ Could not find label for checkbox`);
                continue;
            }

            console.log(`[selectMultiCheckbox] 🔍 Found checkbox option: "${checkboxLabel}"`);

            // Check if this option should be selected
            const shouldBeChecked = selectedOptions.some(selected =>
                normalizeText(selected) === normalizeText(checkboxLabel) ||
                normalizeText(checkboxLabel).includes(normalizeText(selected)) ||
                normalizeText(selected).includes(normalizeText(checkboxLabel))
            );

            console.log(`[selectMultiCheckbox] ${shouldBeChecked ? '✅' : '⬜'} "${checkboxLabel}" should be ${shouldBeChecked ? 'checked' : 'unchecked'}`);

            // Set checkbox state if needed
            if (checkbox.checked !== shouldBeChecked) {
                const label = getLabelElement(checkbox);
                if (label) {
                    label.click();
                } else {
                    checkbox.click();
                }
                await sleep(100);

                if (checkbox.checked === shouldBeChecked) {
                    successCount++;
                    console.log(`[selectMultiCheckbox] ✓ Successfully ${shouldBeChecked ? 'checked' : 'unchecked'}: "${checkboxLabel}"`);
                } else {
                    console.warn(`[selectMultiCheckbox] ⚠️ Failed to set checkbox: "${checkboxLabel}"`);
                }
            } else {
                console.log(`[selectMultiCheckbox] ✓ Already in correct state: "${checkboxLabel}"`);
                successCount++;
            }
        }

        console.log(`[selectMultiCheckbox] ✅ Successfully processed ${successCount} checkboxes`);
        return successCount > 0;
    } catch (error) {
        console.error("Failed to select multi-checkbox:", error);
        return false;
    }
}

function getCheckboxQuestionText(checkbox: HTMLInputElement): string | null {
    const text = getQuestionText(checkbox);
    return text || null;
}

// Helper function to get the specific option label for a checkbox
function getCheckboxOptionLabel(checkbox: HTMLInputElement): string | null {
    // Check for associated label
    if (checkbox.id) {
        const label = document.querySelector(`label[for="${CSS.escape(checkbox.id)}"]`);
        if (label && label.textContent) {
            return label.textContent.trim();
        }
    }

    // Check parent label
    const parentLabel = checkbox.closest('label');
    if (parentLabel && parentLabel.textContent) {
        return parentLabel.textContent.trim();
    }

    // Check aria-label
    const ariaLabel = checkbox.getAttribute('aria-label');
    if (ariaLabel && ariaLabel.trim()) {
        return ariaLabel.trim();
    }

    // Check next sibling
    let nextSibling = checkbox.nextSibling;
    while (nextSibling) {
        if (nextSibling.nodeType === Node.TEXT_NODE && nextSibling.textContent?.trim()) {
            return nextSibling.textContent.trim();
        }
        if (nextSibling.nodeType === Node.ELEMENT_NODE) {
            const element = nextSibling as Element;
            if (element.textContent?.trim()) {
                return element.textContent.trim();
            }
        }
        nextSibling = nextSibling.nextSibling;
    }

    return checkbox.value && checkbox.value !== 'on' ? checkbox.value : null;
}

/**
 * Select option from native <select> element
 */
export async function selectNativeOption(
    element: HTMLSelectElement,
    optionText: string
): Promise<boolean> {
    try {
        console.log(`[selectNativeOption] 🎯 Attempting to select: "${optionText}"`);
        console.log(`[selectNativeOption] Available options:`, Array.from(element.options).map(opt => opt.text));

        element.focus();

        // Find matching option
        for (let i = 0; i < element.options.length; i++) {
            const option = element.options[i];
            const normalized = normalizeText(option.text);
            const targetNormalized = normalizeText(optionText);

            console.log(`[selectNativeOption] Comparing: "${normalized}" vs "${targetNormalized}"`);

            if (normalized === targetNormalized) {
                console.log(`[selectNativeOption] ✅ Match found at index ${i}: "${option.text}"`);
                element.selectedIndex = i;
                element.dispatchEvent(new Event("change", { bubbles: true }));
                element.dispatchEvent(new Event("input", { bubbles: true })); // Add input event
                element.blur();

                const success = element.selectedIndex === i;
                console.log(`[selectNativeOption] Selection ${success ? 'verified ✅' : 'failed ❌'}, selectedIndex: ${element.selectedIndex}`);
                return success;
            }
        }

        console.warn(`[selectNativeOption] ❌ No match found for: "${optionText}"`);
        return false;
    } catch (error) {
        console.error("[selectNativeOption] ❌ Error:", error);
        return false;
    }
}

/**
 * Select option from custom dropdown (ARIA combobox/listbox)
 */
export async function selectCustomDropdown(
    element: HTMLElement,
    optionText: string
): Promise<boolean> {
    console.log(`[Autofill] Delegating to Jobright-style interaction for: ${optionText}`);
    return await jobrightSelectDropdown(element, optionText);
}

/**
 * Fill date field
 */
export async function fillDate(
    element: HTMLInputElement,
    dateString: string
): Promise<boolean> {
    try {
        element.focus();
        element.value = dateString; // Expects YYYY-MM-DD format
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
        element.blur();

        return verifyInputValue(element, dateString);
    } catch (error) {
        console.error("Failed to fill date:", error);
        return false;
    }
}

/**
 * Upload file from base64 data
 * Handles both standard inputs and Greenhouse's custom "Attach/Dropbox" UI
 */
export async function triggerFileUpload(
    element: HTMLElement, // Changed from HTMLInputElement to allow button triggers
    base64Data?: string,
    fileName?: string
): Promise<boolean> {
    try {
        console.log(`[Autofill] 📎 Triggering file upload for:`, element);

        if (!element) {
            console.warn(`[Autofill] ⚠️ triggerFileUpload called with null element, searching globally`);
            const globalFallback = document.querySelector('input[type="file"]') as HTMLInputElement;
            if (globalFallback) {
                console.log(`[Autofill] ✅ Found global fallback file input`);
                return await executeFileUpload(globalFallback, base64Data, fileName);
            }
            return false;
        }

        // If the element is NOT an input[type="file"], it might be a button uploader
        let fileInput: HTMLInputElement | null = null;
        if (element instanceof HTMLInputElement && element.type === 'file') {
            fileInput = element;
        } else {
            // It's a button or custom trigger (e.g., ASK Consulting)
            console.log(`[Autofill] 🖱️ Element is custom uploader, searching for internal/nearby file input`);
            fileInput = element.querySelector?.('input[type="file"]') ||
                element.parentElement?.querySelector('input[type="file"]') ||
                document.querySelector('input[type="file"]'); // Global fallback for one-off forms

            if (!fileInput) {
                console.log(`[Autofill] 🚫 No file input found, clicking button to trigger platform picker`);
                element.click();
                return true;
            }
            console.log(`[Autofill] ✅ Found file input via custom uploader search`);
        }

        // PLATFORM SPECIAL HANDLING (Greenhouse, BambooHR)
        // These platforms often hide the real file input and show a styled button
        const isGreenhouse = isGreenhousePage();
        const isBambooHR = isBambooHRPage();

        if (isGreenhouse || isBambooHR) {
            console.log(`[Autofill] 🏢 ${isGreenhouse ? 'Greenhouse' : 'BambooHR'} file upload detected`);

            if (element instanceof HTMLInputElement && element.type === 'file' && document.body.contains(element)) {
                console.log(`[Autofill] 📎 File input already present, skipping button-click logic`);
            } else {
                let triggerButton: HTMLElement | null = null;
                const container = element.closest('.attach-or-paste') ||
                    element.closest('.field') ||
                    element.closest('fieldset') ||
                    element.closest('.form-group') ||
                    element.parentElement;

                if (container) {
                    // Greenhouse specific
                    if (isGreenhouse) {
                        triggerButton = container.querySelector('button[data-source="attach"]') as HTMLElement;
                    }

                    // Fallback: Search by text content
                    if (!triggerButton) {
                        const targets = container.querySelectorAll('a, button, [role="button"]');
                        for (const target of Array.from(targets)) {
                            const text = target.textContent?.trim().toLowerCase() || "";
                            if (text === 'attach' || text === 'choose file' || text === 'upload') {
                                triggerButton = target as HTMLElement;
                                break;
                            }
                        }
                    }
                }

                if (triggerButton) {
                    console.log(`[Autofill] 🖱️ Clicking trigger button: "${triggerButton.textContent?.trim()}"`);
                    triggerButton.click();
                    await sleep(500);

                    const fileInputs = document.querySelectorAll('input[type="file"]');
                    if (fileInputs.length > 0) {
                        // Use the most likely one (first for resume, or nearest to trigger)
                        fileInput = fileInputs[0] as HTMLInputElement;
                    }
                }
            }
        }

        return await executeFileUpload(fileInput, base64Data, fileName);

    } catch (error) {
        console.error("Failed to trigger file upload:", error);
        return false;
    }
}

/**
 * Core logic to actually set bytes on a file input
 */
async function executeFileUpload(
    fileInput: HTMLInputElement,
    base64Data?: string,
    fileName?: string
): Promise<boolean> {
    try {
        // If we have base64 data, convert it to a File object
        if (base64Data && base64Data.startsWith('data:')) {
            console.log(`[Autofill] 📎 Uploading file from base64 data: ${fileName || 'resume.pdf'}`);

            // Extract MIME type and base64 content
            const matches = base64Data.match(/^data:([^;]+);base64,(.+)$/);
            if (!matches) {
                console.error(`[Autofill] Invalid base64 data format`);
                return false;
            }

            const mimeType = matches[1];
            const base64Content = matches[2];

            // Convert base64 to binary
            const binaryString = atob(base64Content);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            // Create File object
            const blob = new Blob([bytes], { type: mimeType });
            const file = new File([blob], fileName || 'resume.pdf', { type: mimeType });

            // Create DataTransfer to set files
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);

            // Set files on input element
            fileInput.files = dataTransfer.files;

            // Trigger events
            fileInput.dispatchEvent(new Event('input', { bubbles: true }));
            fileInput.dispatchEvent(new Event('change', { bubbles: true }));

            await sleep(300); // Wait for UI to update

            console.log(`[Autofill] ✅ File uploaded successfully: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);
            return true;

        } else {
            // Fallback: Open file picker (manual selection)
            console.log(`[Autofill] ⚠️ No base64 data, opening file picker for: ${fileInput.name || fileInput.id}`);
            fileInput.focus();
            fileInput.click();
            return true;
        }
    } catch (err) {
        console.error("[Autofill] Error in executeFileUpload:", err);
        return false;
    }
}

// Helper functions

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeText(text: string): string {
    return text.toLowerCase().trim().replace(/\s+/g, " ");
}

function getRadioLabel(radio: HTMLInputElement): string | null {
    const label = getLabelElement(radio);
    let text: string | null = null;

    if (label) {
        text = label.textContent?.trim() || null;
    } else {
        const ariaLabel = radio.getAttribute("aria-label");
        if (ariaLabel) text = ariaLabel.trim();
    }

    if (!text) return null;

    return text;
}

export function getLabelElement(element: HTMLElement): HTMLLabelElement | null {
    const id = element.id;
    if (id) {
        return document.querySelector<HTMLLabelElement>(`label[for="${id}"]`);
    }

    return element.closest("label");
}

function verifyInputValue(
    element: HTMLInputElement | HTMLTextAreaElement,
    expectedValue: string
): boolean {
    const actualValue = element.value;

    // 1. Strict equality first
    if (actualValue === expectedValue) return true;

    // 2. Fuzzy verification for phone numbers and numeric fields
    // This handles cases where user provides "2134567809" but field formats to "(213) 456-7809"
    const isNumericType = element.type === 'tel' || element.type === 'number' ||
        element.id.toLowerCase().includes('phone') ||
        element.name.toLowerCase().includes('phone');

    if (isNumericType) {
        const normActual = actualValue.replace(/\D/g, "");
        const normExpected = expectedValue.replace(/\D/g, "");
        if (normActual.length > 0 && normActual === normExpected) {
            console.log(`[verifyInputValue] ✅ Fuzzy match for phone/number: "${actualValue}" matches "${expectedValue}"`);
            return true;
        }
    }

    return false;
}

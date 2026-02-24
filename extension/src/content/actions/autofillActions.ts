// extension/src/content/actions/autofillActions.ts
/**
 * Form interaction utilities for autofilling fields
 * Simulates human-like interactions with proper event dispatching
 */

import { jobrightSelectDropdown } from "./dropdownInteractions";
import { isGreenhousePage, isBambooHRPage } from "../utils/platformDetection";

/**
 * Type text into an input field character-by-character
 */
export async function typeLikeHuman(
    element: HTMLInputElement | HTMLTextAreaElement,
    value: string
): Promise<boolean> {
    try {
        element.focus();

        // Clear existing value
        element.value = "";
        element.dispatchEvent(new Event("input", { bubbles: true }));

        // Type character by character
        try {
            const response = await chrome.runtime.sendMessage({
                action: "trustedType",
                text: value
            });
            if (response?.success) return verifyInputValue(element, value);
        } catch (e) {
            console.warn("[Autofill] Trusted typing failed, falling back to DOM simulation", e);
        }

        // Fallback: Type character by character simulation
        for (const char of value) {
            element.value += char;
            element.dispatchEvent(new Event("input", { bubbles: true }));
            await sleep(10); // Balanced: 3x faster than original 30ms, safe for all sites
        }

        // Dispatch change event
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
        element.focus();

        // Set value using multiple methods to ensure it works
        element.value = value;

        // Trigger React/Vue/Angular change detection
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            "value"
        )?.set;

        if (nativeInputValueSetter) {
            nativeInputValueSetter.call(element, value);
        }

        // Dispatch events
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
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

        // Strategy: Greenhouse/Workday often hide the real input. 
        // We should click the LABEL or the visible container.
        const greenhouseWrapper = radio.closest('.radio_button, .radio-button-container, [class*="radio"]');
        const target = greenhouseWrapper || labelElement || radio;

        console.log(`[clickRadio] 🖱️ Clicking radio for: "${labelText}"`, {
            checkedBefore: radio.checked,
            targetTag: target.tagName,
            targetClass: target.className
        });

        // Event sequence for React-Select/Custom components
        target.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
        target.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
        (target as HTMLElement).click();

        // Fallback: Click the label and input directly if they are different from target
        if (!radio.checked) {
            if (labelElement && labelElement !== target) labelElement.click();
            if (radio !== target) radio.click();
        }

        // Wait for selection to commit
        const success = await waitForCommit(() => radio.checked, 800);

        if (success) {
            console.log(`[selectRadioByLabel] ✅ Radio selected: ${labelText}`);
            return true;
        } else {
            console.warn(`[selectRadioByLabel] ⚠️ Radio NOT selected after click: ${labelText}`);
            // Last resort: force checked (though this won't trigger React state usually)
            // radio.checked = true;
            // radio.dispatchEvent(new Event('change', { bubbles: true }));
            return radio.checked;
        }
    } catch (error) {
        console.error("[clickRadio] ❌ Error:", error);
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

            // For Greenhouse/Workday styled checkboxes, click the label or parent container
            const label = getLabelElement(element);
            const greenhouseWrapper = element.closest('.checkbox, .checkbox-container, [class*="checkbox"]');

            const target = greenhouseWrapper || label || element;

            target.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
            target.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
            (target as HTMLElement).click();

            // Verification with wait
            await waitForCommit(() => element.checked === checked, 500);
        }

        const success = element.checked === checked;
        console.log(`[setCheckbox] ${success ? '✅' : '❌'} Result: ${element.checked}`);
        return success;
    } catch (error) {
        console.error("Failed to set checkbox:", error);
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

// Helper function to get question text for a checkbox (group question)
function getCheckboxQuestionText(checkbox: HTMLInputElement): string | null {
    // This is the same logic as formScanner.getQuestionText()
    // Check aria-label
    const ariaLabel = checkbox.getAttribute('aria-label');
    if (ariaLabel && ariaLabel.trim()) {
        return ariaLabel.trim();
    }

    // Check associated label
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

    // Check for fieldset legend (common for checkbox groups)
    const fieldset = checkbox.closest('fieldset');
    if (fieldset) {
        const legend = fieldset.querySelector('legend');
        if (legend && legend.textContent) {
            return legend.textContent.trim();
        }
    }

    // Check parent container with role="group"
    const group = checkbox.closest('[role="group"]');
    if (group) {
        const label = group.querySelector('label, legend, .label, [class*="label"]');
        if (label && label.textContent) {
            return label.textContent.trim();
        }
    }

    return null;
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
    element: HTMLInputElement,
    base64Data?: string,
    fileName?: string
): Promise<boolean> {
    try {
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
                        element = fileInputs[0] as HTMLInputElement;
                    }
                }
            }
        }

        // STANDARD FILE UPLOAD PROCESS
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
            element.files = dataTransfer.files;

            // Trigger events
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));

            await sleep(300); // Wait for UI to update

            console.log(`[Autofill] ✅ File uploaded successfully: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);
            return true;

        } else {
            // Fallback: Open file picker (manual selection)
            console.log(`[Autofill] ⚠️ No base64 data, opening file picker for: ${element.name || element.id}`);
            element.focus();
            element.click();
            return true;
        }
    } catch (error) {
        console.error("Failed to trigger file upload:", error);
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
    return actualValue === expectedValue;
}

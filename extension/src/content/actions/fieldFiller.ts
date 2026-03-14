import { DetectedField, FieldType } from "../../types/fieldDetection";
import {
    fillInput,
    typeLikeHuman,
    selectRadioByLabel,
    setCheckbox,
    selectNativeOption,
    selectCustomDropdown,
    fillDate,
    triggerFileUpload,
} from "./autofillActions";
// STATIC IMPORT - avoids CSP chunk loading error
import { selectDropdownKeyboardFirst } from './productionDropdown';

export interface FillResult {
    success: boolean;
    filled: boolean;
    skipped: boolean;
    reason?: string;
    value?: string;
}

/**
 * Orchestrate filling a single field based on its type and value
 */
export async function fillField(
    field: DetectedField,
    value: any,
    fileName?: string // Optional filename for file uploads
): Promise<FillResult> {
    console.log(`\n[Autofill] 🔄 Attempting to fill field:`, {
        question: field.questionText,
        type: field.fieldType,
        value: value,
        canonicalKey: field.canonicalKey,
        fileName: fileName
    });

    if (!field.element && field.selector) {
        console.log(`[Autofill] 🔍 Element reference missing, re-finding via selector: ${field.selector}`);
        const found = document.querySelector(field.selector) as HTMLElement;
        if (found) {
            field.element = found;
        } else {
            console.warn(`[Autofill] ❌ Could not re-find element for: ${field.questionText}`);
        }
    }

    if (!field.element) {
        return {
            success: false,
            filled: false,
            skipped: true,
            reason: "Target element not found in DOM",
        };
    }

    if (!value || value === "") {
        console.log(`[Autofill] ⚠️ No value to fill for: ${field.questionText}`);
        return {
            success: false,
            filled: false,
            skipped: true,
            reason: "No value to fill",
        };
    }

    try {
        let success = false;

        switch (field.fieldType) {
            case FieldType.TEXT:
            case FieldType.EMAIL:
            case FieldType.PHONE:
            case FieldType.NUMBER:
            case FieldType.TEXTAREA:
                console.log(`[Autofill] 📝 Filling input field: ${field.questionText}`);
                success = await fillInput(
                    field.element as HTMLInputElement | HTMLTextAreaElement,
                    String(value)
                );

                // RELIABILITY FALLBACK:
                // If initial fast-fill fails verification, OR if the field is required and we want to be extra safe,
                // try character-by-character typing. This bypasses many complex framework validations.
                if (!success || (field.isRequired && !success)) {
                    console.log(`[Autofill] ⚠️ Fast-fill failed or required field: Retrying with typeLikeHuman for "${field.questionText}"`);
                    success = await typeLikeHuman(
                        field.element as HTMLInputElement | HTMLTextAreaElement,
                        String(value)
                    );
                }
                break;

            case FieldType.SELECT_NATIVE:
                console.log(`[Autofill] 📋 Selecting from native dropdown: ${field.questionText}`);
                success = await selectNativeOption(
                    field.element as HTMLSelectElement,
                    String(value)
                );
                break;

            case FieldType.DROPDOWN_CUSTOM:
                console.log(`[Autofill] 🎯 Selecting from custom dropdown: ${field.questionText} → ${value}`);
                // Supports multi-select (array) or single string
                const dropdownResult = await selectDropdownKeyboardFirst(
                    field.element,
                    value,
                    field.options
                );
                if (dropdownResult) {
                    console.log(`[Autofill] ✅ Custom dropdown result: ${dropdownResult}`);
                    return { success: true, filled: true, skipped: false };
                } else {
                    // console.warn(`[Autofill] ❌ Custom dropdown failed for: ${field.questionText}`);
                    return { success: false, filled: false, skipped: false };
                }

            case FieldType.RADIO_GROUP:
                const radioInput = field.element as HTMLInputElement;
                const radioName = radioInput.name;
                if (radioName) {
                    console.log(`[Autofill] 🔘 Selecting radio: ${field.questionText} → ${value}`);
                    success = await selectRadioByLabel(radioName, String(value));
                }
                break;

            case FieldType.CHECKBOX:
                // Check if this is a multi-select checkbox group (has options) or standalone checkbox
                if (field.options && field.options.length > 1) {
                    // Multi-select checkbox group - value is comma-separated list of options to select
                    console.log(`[Autofill] ☑️ Filling multi-select checkbox group: ${field.questionText} → ${value}`);

                    // Parse value - can be string (comma-separated), array, or single value
                    let selectedOptions: string[] = [];
                    if (typeof value === 'string') {
                        // Handle comma-separated string like "GDPR, CCPA / CPRA"
                        selectedOptions = value.split(',').map(v => v.trim()).filter(v => v.length > 0);
                    } else if (Array.isArray(value)) {
                        selectedOptions = value.map(v => String(v).trim());
                    } else {
                        selectedOptions = [String(value).trim()];
                    }

                    console.log(`[Autofill] ☑️ Selected options:`, selectedOptions);
                    console.log(`[Autofill] ☑️ Available options:`, field.options);

                    // Import and use the multi-select checkbox function
                    const { selectMultiCheckbox } = await import('./autofillActions');
                    success = await selectMultiCheckbox(
                        field.questionText,
                        selectedOptions,
                        field.options
                    );
                } else {
                    // Standalone checkbox - value is boolean
                    let checkboxValue = value === true || value === "true" || value === "yes" || value === "Yes" || value === "on";
                    
                    // If the value matches the single option's label, it also means "checked"
                    if (!checkboxValue && field.options && field.options.length === 1 && typeof value === 'string') {
                        const valLower = value.toLowerCase().trim();
                        const optLower = field.options[0].toLowerCase().trim();
                        if (valLower === optLower || valLower.includes(optLower) || optLower.includes(valLower)) {
                            checkboxValue = true;
                        }
                    }

                    console.log(`[Autofill] ☑️ Setting standalone checkbox: ${field.questionText} → ${checkboxValue} (Raw value: "${value}")`);
                    success = await setCheckbox(
                        field.element as HTMLInputElement,
                        checkboxValue
                    );
                }
                break;

            case FieldType.DATE:
                console.log(`[Autofill] 📅 Filling date: ${field.questionText} → ${value}`);
                success = await fillDate(field.element as HTMLInputElement, String(value));
                break;

            case FieldType.FILE_UPLOAD:
                console.log(`[Autofill] 📎 Triggering file upload: ${field.questionText}`);
                
                // DATA PRIORITY:
                // 1. If 'value' is already base64, use it
                // 2. If 'field.base64' is available, use it
                // 3. Fallback to just opening the picker (last resort)
                let uploadData = String(value);
                if (!uploadData.startsWith('data:') && field.base64) {
                    uploadData = field.base64;
                }

                // Upload file from base64 data if available, with fallback to file picker
                success = await triggerFileUpload(
                    field.element as HTMLInputElement,
                    uploadData, 
                    fileName || field.fileName || 'resume.pdf'
                );
                if (success) {
                    return {
                        success: true,
                        filled: true,
                        skipped: false,
                        reason: "Resume uploaded successfully",
                    };
                } else {
                    return {
                        success: false,
                        filled: false,
                        skipped: false,
                        reason: "File upload failed",
                    };
                }

            default:
                console.warn(`[Autofill] ❓ Unsupported field type: ${field.fieldType} for ${field.questionText}`);
                return {
                    success: false,
                    filled: false,
                    skipped: true,
                    reason: `Unsupported field type: ${field.fieldType}`,
                };
        }

        if (success) {
            console.log(`[Autofill] ✅ Successfully filled: ${field.questionText}`);
            return {
                success: true,
                filled: true,
                skipped: false,
                value: String(value),
            };
        } else {
            console.warn(`[Autofill] ⚠️ Failed to fill: ${field.questionText}`);
            return {
                success: false,
                filled: false,
                skipped: true,
                reason: "Fill action failed verification",
            };
        }
    } catch (error) {
        console.error(`[Autofill] ❌ Error filling field "${field.questionText}":`, error);
        return {
            success: false,
            filled: false,
            skipped: true,
            reason: `Error: ${error}`,
        };
    }
}

/**
 * Fill all provided fields with their resolved values
 */
export async function fillAllFields(
    fields: DetectedField[]
): Promise<Map<DetectedField, FillResult>> {
    const results = new Map<DetectedField, FillResult>();

    for (const field of fields) {
        if (field.filled || field.skipped) {
            // Already processed
            continue;
        }

        // Only fill if we have a canonical key and high confidence
        if (!field.canonicalKey || field.confidence < 0.8) {
            results.set(field, {
                success: false,
                filled: false,
                skipped: true,
                reason: field.canonicalKey
                    ? `Low confidence (${field.confidence.toFixed(2)})`
                    : "No canonical mapping found",
            });
            continue;
        }

        // Fill the field
        const result = await fillField(field, field.filledValue);
        results.set(field, result);

        // Tiny delay between fields to keep events orderly but fast
        await sleep(10);
    }

    return results;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

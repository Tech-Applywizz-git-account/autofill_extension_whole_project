// extension/src/content/workday/workdayHandler.ts
/**
 * WORKDAY-SPECIFIC AUTOFILL HANDLER
 * 
 * Workday Applications are unique:
 * 1. Heavy use of data-automation-id attributes
 * 2. Dynamic field loading based on country selection
 * 3. Progressive disclosure (forms appear in stages)
 * 4. Strict validation on blur events
 * 5. React-based with synthetic events
 * 
 * Strategy:
 * - Priority 1: Fill Country/Location fields FIRST
 * - Wait for network requests to complete (not fixed delays)
 * - Re-scan DOM after critical selections
 * - Use data-automation-id for reliable field matching
 * - Trigger proper React events
 */

import { fillField } from '../actions/fieldFiller';
import { DetectedField, FieldType, QuestionSection } from '../../types/fieldDetection';
import { detectFieldsInCurrentDOM, bestMatchField, Detected } from '../fieldMatching';
import { ResolvedField, FillPayload } from '../autofillRunner';
import { detectWorkdayFields, WorkdayField } from './workdayFieldDetector';

const LOG_PREFIX = "[WorkdayHandler]";

// Priority fields that trigger form changes
// These MUST be filled FIRST before other fields load
const PRIORITY_FIELDS = [
    'country',      // HIGHEST PRIORITY - always triggers form reload
    'location',
    'region',
    'state',
    'province',
    'territory',
    'nationality',
    'citizen'       // Some forms ask for citizenship instead of country
];

// CRITICAL: These keywords in questionText mean "fill this first!"
const CRITICAL_FIRST_KEYWORDS = ['country', 'nation'];

export function isWorkdayApplication(): boolean {
    return window.location.href.includes('myworkdayjobs.com') ||
        window.location.href.includes('myworkday.com') ||
        document.querySelector('[data-automation-id]') !== null;
}

/**
 * Main handler for Workday applications
 */
export async function handleWorkdayApplication(payload: FillPayload): Promise<void> {
    console.log(`${LOG_PREFIX} 🏢 WORKDAY APPLICATION DETECTED`);
    console.log(`${LOG_PREFIX} Using specialized Workday filling strategy\n`);

    // Step 1: Enhanced Workday-specific field detection
    console.log(`${LOG_PREFIX} 📡 Using Workday-specific field detector...`);
    const workdayFields = detectWorkdayFields();
    console.log(`${LOG_PREFIX} Workday fields detected: ${workdayFields.length}`);
    console.log(`${LOG_PREFIX} Priority fields found: ${workdayFields.filter(f => f.isPriority).length}`);

    // Also get standard detection for fallback matching
    let detected = detectFieldsInCurrentDOM();
    console.log(`${LOG_PREFIX} Standard detection: ${detected.length} fields\n`);

    // Step 2: CRITICAL - Separate fields with COUNTRY always FIRST
    const { priorityFields, regularFields } = separateFieldsByPriority(payload.fields);

    // FORCE Country to be absolute first if it exists
    const countryField = priorityFields.find(f =>
        CRITICAL_FIRST_KEYWORDS.some(keyword => f.questionText.toLowerCase().includes(keyword))
    );

    if (countryField) {
        // Move country to front
        const otherPriority = priorityFields.filter(f => f !== countryField);
        priorityFields.length = 0;
        priorityFields.push(countryField, ...otherPriority);
        console.log(`${LOG_PREFIX} ⭐ COUNTRY field will be filled FIRST: "${countryField.questionText}"`);
    }

    console.log(`${LOG_PREFIX} Priority fields (country/location): ${priorityFields.length}`);
    console.log(`${LOG_PREFIX} Regular fields: ${regularFields.length}\n`);

    let priorityFilled = 0;

    // Step 3: Fill priority fields FIRST (with network waiting)
    if (priorityFields.length > 0) {
        console.log(`${LOG_PREFIX} 📍 PHASE 1: Filling PRIORITY fields (triggers form changes)...`);

        for (const field of priorityFields) {
            const success = await fillWorkdayField(detected, field, workdayFields);
            if (success) {
                priorityFilled++;
                // Extra delay after country to ensure it's committed
                if (CRITICAL_FIRST_KEYWORDS.some(k => field.questionText.toLowerCase().includes(k))) {
                    console.log(`${LOG_PREFIX} ⏳ Extra delay after country field...`);
                    await sleep(500);
                }
            }
        }

        // Step 4: CRITICAL - Wait for Workday to load country-specific questions
        if (priorityFilled > 0) {
            console.log(`${LOG_PREFIX} ⏳ Waiting for Workday to load country-specific questions...`);
            await waitForWorkdayFormUpdate();

            // Step 5: RE-SCAN the DOM for new fields
            console.log(`${LOG_PREFIX} 🔄 Re-scanning DOM after priority field selection...`);
            const previousCount = detected.length;

            // Re-detect with both methods
            const newWorkdayFields = detectWorkdayFields();
            detected = detectFieldsInCurrentDOM();

            const newFieldsCount = detected.length - previousCount;
            console.log(`${LOG_PREFIX} Second scan: ${detected.length} fields (${newFieldsCount} new fields loaded)`);
            console.log(`${LOG_PREFIX} Enhanced scan: ${newWorkdayFields.length} Workday fields\n`);
        }
    }

    // Step 6: Fill remaining fields
    console.log(`${LOG_PREFIX} 📝 PHASE 2: Filling remaining fields...`);
    let regularFilled = 0;
    for (const field of regularFields) {
        const success = await fillWorkdayField(detected, field, workdayFields);
        if (success) regularFilled++;
        await sleep(200); // Small delay between fields for validation
    }

    console.log(`${LOG_PREFIX} ✅ Workday application fill complete`);
    console.log(`${LOG_PREFIX} Priority filled: ${priorityFilled}/${priorityFields.length}`);
    console.log(`${LOG_PREFIX} Regular filled: ${regularFilled}/${regularFields.length}`);
}

/**
 * Separate fields into priority and regular based on field type
 */
function separateFieldsByPriority(fields: ResolvedField[]): {
    priorityFields: ResolvedField[];
    regularFields: ResolvedField[];
} {
    const priorityFields: ResolvedField[] = [];
    const regularFields: ResolvedField[] = [];

    for (const field of fields) {
        const questionLower = field.questionText.toLowerCase();
        const isPriority = PRIORITY_FIELDS.some(keyword => questionLower.includes(keyword));

        if (isPriority) {
            priorityFields.push(field);
        } else {
            regularFields.push(field);
        }
    }

    return { priorityFields, regularFields };
}

/**
 * Fill a single Workday field with proper event handling
 */
async function fillWorkdayField(
    detected: Detected[],
    field: ResolvedField,
    workdayFields?: WorkdayField[]
): Promise<boolean> {
    console.log(`${LOG_PREFIX}   Filling: "${field.questionText}"`);

    // Try data-automation-id match first (Workday's preferred method)
    let match = findByAutomationId(detected, field);

    // Fallback to standard matching
    if (!match) {
        match = bestMatchField(detected, field.questionText, field.canonicalKey);
    }

    if (!match) {
        console.warn(`${LOG_PREFIX}   ❌ No match found for: ${field.questionText}`);
        return false;
    }

    // Create DetectedField for fillField
    const detectedField: DetectedField = {
        element: match.element as any,
        questionText: match.questionText,
        fieldType: mapSeleniumTypeToFieldType(field.fieldType),
        isRequired: false,
        options: field.options,
        section: QuestionSection.PERSONAL,
        canonicalKey: field.canonicalKey || '',
        confidence: field.confidence || 1.0,
        filled: false,
        filledValue: String(field.value),
        skipped: false
    };

    const result = await fillField(detectedField, String(field.value), field.fileName);

    if (result.success) {
        // Trigger blur event for Workday validation
        (match.element as HTMLElement).blur();
        await sleep(100);
        console.log(`${LOG_PREFIX}   ✅ Filled successfully`);
    } else {
        console.warn(`${LOG_PREFIX}   ❌ Fill failed`);
    }

    return result.success;
}

/**
 * Find field by Workday's data-automation-id attribute
 */
function findByAutomationId(detected: Detected[], field: ResolvedField): Detected | null {
    // Workday uses predictable automation IDs
    const automationPatterns = [
        field.canonicalKey,
        field.questionText.toLowerCase().replace(/\s+/g, '-'),
        field.questionText.toLowerCase().replace(/\s+/g, '_')
    ];

    for (const pattern of automationPatterns) {
        if (!pattern) continue;

        const found = detected.find(d => {
            const el = d.element as HTMLElement;
            const autoId = el.getAttribute('data-automation-id') ||
                el.closest('[data-automation-id]')?.getAttribute('data-automation-id');

            return autoId && (
                autoId.includes(pattern) ||
                pattern.includes(autoId)
            );
        });

        if (found) {
            console.log(`${LOG_PREFIX}   ✓ Matched via data-automation-id: ${pattern}`);
            return found;
        }
    }

    return null;
}

/**
 * Wait for Workday to finish loading new form fields
 * This is MUCH better than fixed 5-second delays!
 */
async function waitForWorkdayFormUpdate(): Promise<void> {
    // Track network activity
    const networkMonitor = new WorkdayNetworkMonitor();
    networkMonitor.start();

    return new Promise((resolve) => {
        // MutationObserver for DOM changes
        const observer = new MutationObserver((mutations) => {
            const hasNewWorkdayFields = mutations.some(m =>
                Array.from(m.addedNodes).some(node => {
                    if (node.nodeType !== Node.ELEMENT_NODE) return false;
                    const el = node as Element;

                    // Check for Workday-specific attributes
                    return el.hasAttribute('data-automation-id') ||
                        el.querySelector('[data-automation-id]') !== null ||
                        el.querySelector('input, select, textarea') !== null;
                })
            );

            if (hasNewWorkdayFields && networkMonitor.isQuiet()) {
                console.log(`${LOG_PREFIX}   ✓ New fields loaded and network quiet`);
                observer.disconnect();
                networkMonitor.stop();
                resolve();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Fallback timeout (max wait)
        setTimeout(() => {
            observer.disconnect();
            networkMonitor.stop();
            console.log(`${LOG_PREFIX}   ⏱️ Max wait time reached`);
            resolve();
        }, 8000); // Maximum 8 seconds

        // Minimum wait (Workday usually takes 2-4 seconds)
        setTimeout(() => {
            if (networkMonitor.isQuiet()) {
                observer.disconnect();
                networkMonitor.stop();
                console.log(`${LOG_PREFIX}   ✓ Network quiet after minimum wait`);
                resolve();
            }
        }, 2000); // Minimum 2 seconds
    });
}

/**
 * Monitor network activity to detect when Workday has finished loading
 */
class WorkdayNetworkMonitor {
    private pendingRequests = 0;
    private lastActivity = Date.now();
    private originalFetch!: typeof fetch;
    private originalXHR!: typeof XMLHttpRequest;

    start() {
        // Intercept fetch
        this.originalFetch = window.fetch;
        window.fetch = async (...args) => {
            this.pendingRequests++;
            this.lastActivity = Date.now();

            try {
                const response = await this.originalFetch.apply(window, args);
                this.pendingRequests--;
                this.lastActivity = Date.now();
                return response;
            } catch (error) {
                this.pendingRequests--;
                this.lastActivity = Date.now();
                throw error;
            }
        };

        // Intercept XMLHttpRequest
        const monitor = this;
        this.originalXHR = window.XMLHttpRequest;

        // Create a wrapper class that extends the original XMLHttpRequest
        const OriginalXHR = this.originalXHR;
        window.XMLHttpRequest = class extends OriginalXHR {
            constructor() {
                super();

                this.addEventListener('loadstart', () => {
                    monitor.pendingRequests++;
                    monitor.lastActivity = Date.now();
                });

                this.addEventListener('loadend', () => {
                    monitor.pendingRequests--;
                    monitor.lastActivity = Date.now();
                });
            }
        } as any;
    }

    stop() {
        if (this.originalFetch) {
            window.fetch = this.originalFetch;
        }
        if (this.originalXHR) {
            window.XMLHttpRequest = this.originalXHR;
        }
    }

    isQuiet(): boolean {
        // Network is quiet if:
        // 1. No pending requests
        // 2. Last activity was at least 500ms ago
        return this.pendingRequests === 0 &&
            (Date.now() - this.lastActivity) > 500;
    }
}

/**
 * Map Selenium field type to FieldType enum
 */
function mapSeleniumTypeToFieldType(seleniumType: string): FieldType {
    const type = String(seleniumType).toLowerCase();

    if (type === 'select_native') return FieldType.SELECT_NATIVE;
    if (type === 'select') return FieldType.SELECT_NATIVE;
    if (type.includes('dropdown') || type === 'dropdown_custom') return FieldType.DROPDOWN_CUSTOM;
    if (type === 'textarea') return FieldType.TEXTAREA;
    if (type === 'email') return FieldType.EMAIL;
    if (type === 'phone') return FieldType.PHONE;
    if (type === 'number') return FieldType.NUMBER;
    if (type === 'radio' || type === 'radio_group') return FieldType.RADIO_GROUP;
    if (type === 'checkbox') return FieldType.CHECKBOX;
    if (type === 'date') return FieldType.DATE;
    if (type === 'file' || type === 'file_upload') return FieldType.FILE_UPLOAD;
    if (type === 'multiselect') return FieldType.MULTISELECT;

    return FieldType.TEXT;
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

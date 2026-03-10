/**
 * Workday Scanner - EXACT COPY from original content-script.js
 * Only changes: Added TypeScript types, imports for questionMapper
 * ALL LOGIC PRESERVED 100% - this is the working code
 */

import { ScannedQuestion } from '../mapping/questionMapper';

const LOG_PREFIX = '[WorkdayScanner]';

// Result type that includes multipage classification
export interface WorkdayScanResult {
    questions: ScannedQuestion[];
    pageType: 'single' | 'multi';
    navigationButtons: WorkdayButtonInfo[];
}

export interface WorkdayButtonInfo {
    text: string;
    automationId: string;
    element: HTMLElement;
    isMultiPage: boolean; // true = 'next/continue', false = 'submit/apply'
}

// Configuration matching original
const CONFIG = {
    SCAN_CLICK_DELAY: 600,
    SCAN_OPTION_WAIT: 1500,
    SCAN_CLOSE_DELAY: 400,
    ADD_BUTTON_WAIT: 1200,
    SECTION_EXPAND_WAIT: 800
};

// State management - EXACT copy from original
interface ScannerState {
    isScanningInProgress: boolean;
    discoveredFields: any[];
    fieldMap: Map<string, any>;
    seenFingerprints: Set<string>;
    clickedAddButtons: Set<string>;
    scanTimestamp: number;
}

const STATE: ScannerState = {
    isScanningInProgress: false,
    discoveredFields: [],
    fieldMap: new Map(),
    seenFingerprints: new Set(),
    clickedAddButtons: new Set(),
    scanTimestamp: 0
};

/* ================================================================== */
/*  UTILITY FUNCTIONS - EXACT COPY                                    */
/* ================================================================== */

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function normalize(text: string = ''): string {
    return text.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function getFieldType(el: HTMLElement): string {
    if (el.tagName === 'SELECT') return 'select';
    if ((el as HTMLInputElement).type === 'checkbox' || el.getAttribute('role') === 'checkbox') return 'checkbox';
    if ((el as HTMLInputElement).type === 'radio' || el.getAttribute('role') === 'radio') return 'radio';
    if ((el as HTMLInputElement).type === 'file') return 'file';
    if (el.getAttribute('role') === 'combobox') return 'combobox';
    if (el.tagName === 'BUTTON' && el.getAttribute('aria-haspopup') === 'listbox') return 'combobox';

    const automationId = el.getAttribute('data-automation-id');
    if (automationId) {
        if (automationId.includes('dropdown') ||
            automationId.includes('selectInput') ||
            automationId.includes('combobox')) {
            return 'combobox';
        }
        if (automationId.includes('fileThumbnail')) return 'file';
    }

    if (el.tagName === 'INPUT' && ((el as HTMLInputElement).type === 'text' || !(el as HTMLInputElement).type)) {
        const label = extractLabel(el).toLowerCase();
        const aid = el.getAttribute('data-automation-id') || '';
        const parent = el.parentElement;

        const dropdownKeywords = [
            'search', 'select', 'degree', 'school', 'university', 'field of study',
            'major', 'proficiency', 'fluency', 'state', 'country', 'province',
            'language', 'skill', 'topic'
        ];

        if (dropdownKeywords.some(kw => label.includes(kw)) ||
            aid.toLowerCase().includes('search') ||
            aid.toLowerCase().includes('dropdown')) {
            return 'combobox';
        }

        if (parent) {
            const hasDropdownButton = parent.querySelector('[aria-haspopup="listbox"]') ||
                parent.querySelector('[data-automation-id*="dropdown"]') ||
                parent.querySelector('.wd-icon-search');
            if (hasDropdownButton) return 'combobox';
        }
    }

    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' ||
        el.getAttribute('role') === 'textbox') return 'textbox';

    return 'unknown';
}

function extractLabel(el: HTMLElement, forceQuestionLabel: boolean = false): string {
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

function fingerprint(el: HTMLElement, label: string): string {
    const r = el.getBoundingClientRect();
    return `${normalize(label)}:${el.tagName}:${Math.round(r.top)}:${Math.round(r.left)}`;
}

async function isStable(el: HTMLElement): Promise<boolean> {
    await sleep(100);
    return document.contains(el);
}

/* ================================================================== */
/*  ADD BUTTON DETECTION & CLICKING - EXACT COPY                     */
/* ================================================================== */

interface AddButtonInfo {
    button: HTMLElement;
    section: string;
    automationId: string;
    text: string;
}


function findAddButtons(): AddButtonInfo[] {
    const addButtons: AddButtonInfo[] = [];
    // Expanded query to catch non-standard buttons (divs, inputs, anchors)
    const allCandidates = Array.from(document.querySelectorAll('button, div[role="button"], input[type="button"], a[role="button"]'));

    for (const el of allCandidates) {
        // Skip hidden elements early
        if ((el as HTMLElement).offsetParent === null) continue;

        const text = el.textContent?.trim().toLowerCase() || '';
        const value = (el as HTMLInputElement).value?.toLowerCase() || ''; // For input[type="button"]
        const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
        const automationId = el.getAttribute('data-automation-id') || '';

        const effectiveText = text || value;

        // More robust "Add" detection
        const isAddButton = (
            effectiveText === 'add' ||
            effectiveText.startsWith('add ') ||
            effectiveText.includes('add another') || // Explicitly capture "Add Another" variants
            ariaLabel.includes('add') ||
            automationId.includes('add')
        );

        // Exclude unlikely candidates
        if (effectiveText.includes('address') || effectiveText.includes('padding')) continue;

        const container = el.closest('section, div[data-automation-id*="section"], fieldset, [role="group"]');
        const containerText = container ? container.textContent || '' : '';

        // Broader section relevance check
        const isRelevantSection = (
            containerText.includes('Work Experience') ||
            containerText.includes('Education') ||
            containerText.includes('Certifications') ||
            containerText.includes('Languages') ||
            containerText.includes('Skills') ||
            containerText.includes('Projects') ||
            containerText.includes('Volunteer') ||
            containerText.includes('Websites') ||
            containerText.includes('Publications') ||
            containerText.includes('References') ||
            // Fallback: If automation ID indicates a repeatable section
            automationId.toLowerCase().includes('add') ||
            (container && container.getAttribute('data-automation-id')?.includes('section'))
        );

        if (isAddButton && isRelevantSection) {
            let sectionName = 'Unknown';
            const heading = container?.querySelector('h2, h3, h4, legend, [data-automation-id="sectionHeader"]');
            if (heading) {
                sectionName = heading.textContent?.trim() || 'Unknown';
            } else if (container) {
                // Fallback to aria-label of container
                sectionName = container.getAttribute('aria-label') || 'Unknown';
            }

            addButtons.push({
                button: el as HTMLElement,
                section: sectionName,
                automationId: automationId,
                text: effectiveText || ariaLabel
            });
        }
    }

    return addButtons;
}

async function clickAllAddButtons(): Promise<number> {
    console.log(`${LOG_PREFIX} ╔══════════════════════════════════════════════════════╗`);
    console.log(`${LOG_PREFIX} ║    CLICKING "ADD" BUTTONS (ITERATIVE)               ║`);
    console.log(`${LOG_PREFIX} ╚══════════════════════════════════════════════════════╝`);

    let totalClicked = 0;
    const MAX_PASSES = 3; // Try up to 3 times to catch "Add Another" buttons

    for (let pass = 1; pass <= MAX_PASSES; pass++) {
        console.log(`${LOG_PREFIX} 🔄 Add Button Pass ${pass}/${MAX_PASSES}`);

        const addButtons = findAddButtons();

        if (addButtons.length === 0) {
            console.log(`${LOG_PREFIX} ℹ️  No "Add" buttons found this pass`);
            if (pass === 1) return 0; // If none found on first pass, just return
            break; // Stop if no buttons found
        }

        console.log(`${LOG_PREFIX} Found ${addButtons.length} potential "Add" button(s)`);

        let clickedInThisPass = 0;

        for (const btnInfo of addButtons) {
            // Unique ID for tracking clicked buttons
            const buttonId = btnInfo.automationId || (btnInfo.text + btnInfo.section + btnInfo.button.className);

            if (STATE.clickedAddButtons.has(buttonId)) {
                // Already clicked this specific button instance
                continue;
            }

            try {
                // Visual check: is the button visible?
                if (btnInfo.button.offsetParent === null) {
                    console.log(`${LOG_PREFIX}   ⏭️ Skipping hidden button: ${btnInfo.section}`);
                    continue;
                }

                console.log(`${LOG_PREFIX}   🖱️ Clicking: "${btnInfo.section}" (${btnInfo.text})`);

                btnInfo.button.scrollIntoView({ behavior: 'smooth', block: 'center' });
                await sleep(300);

                btnInfo.button.click();
                clickedInThisPass++;
                totalClicked++;
                STATE.clickedAddButtons.add(buttonId);

                // Wait for expansion - crucial for "Add Another" to appear
                await sleep(CONFIG.ADD_BUTTON_WAIT);
                await sleep(CONFIG.SECTION_EXPAND_WAIT); // Match v10's robust 2-step wait

            } catch (err) {
                console.error(`${LOG_PREFIX} ❌ Error clicking "${btnInfo.section}":`, err);
            }
        }

        if (clickedInThisPass > 0) {
            console.log(`${LOG_PREFIX} ⏳ Waiting ${CONFIG.SECTION_EXPAND_WAIT}ms for page to stabilize after clicks...`);
            await sleep(CONFIG.SECTION_EXPAND_WAIT);
        } else {
            console.log(`${LOG_PREFIX} ℹ️  No new buttons clicked this pass. Stopping loop.`);
            break;
        }
    }

    console.log(`${LOG_PREFIX} ✅ Total "Add" actions performed: ${totalClicked}\n`);
    return totalClicked;
}


/* ================================================================== */
/*  OPTION SCANNERS - EXACT COPY from original                        */
/* ================================================================== */

async function scanDropdownOptions(el: HTMLElement, label: string, fieldType: string): Promise<string[]> {
    const options: string[] = [];

    try {
        if (fieldType === 'select' && el.tagName === 'SELECT') {
            console.log(`${LOG_PREFIX} 📋 Native <select>, reading options directly`);
            for (const opt of Array.from((el as HTMLSelectElement).options)) {
                if (opt.value && opt.textContent?.trim()) {
                    options.push(opt.textContent.trim());
                }
            }
            return options;
        }

        console.log(`${LOG_PREFIX} 🖱️  Clicking to open dropdown: "${label}"`);

        // Close any existing dropdowns
        document.body.click();
        await sleep(CONFIG.SCAN_CLOSE_DELAY);

        // IMPORTANT: Track existing listboxes BEFORE clicking
        const existingListboxIds = new Set(
            Array.from(document.querySelectorAll('[role="listbox"]')).map(lb => lb.id || lb.outerHTML.substring(0, 100))
        );

        let clickTarget: HTMLElement = el;
        let inputEl: HTMLInputElement | null = null;

        if (el.tagName === 'INPUT') {
            inputEl = el as HTMLInputElement;
            const container = el.closest('[data-automation-id="question"]') ||
                el.closest('.css-1wc0u1v') || el.parentElement;
            const btn = container?.querySelector('button[aria-haspopup="listbox"]');
            if (btn) clickTarget = btn as HTMLElement;
        }

        clickTarget.click();
        if (inputEl) {
            inputEl.focus();
            await sleep(200);
            inputEl.dispatchEvent(new Event('focus', { bubbles: true }));
            inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        }

        console.log(`${LOG_PREFIX} ⏳ Waiting ${CONFIG.SCAN_OPTION_WAIT}ms for options...`);
        await sleep(CONFIG.SCAN_OPTION_WAIT);

        // Find NEW listboxes only (this is the key fix!)
        const allListboxes = Array.from(document.querySelectorAll('[role="listbox"]'));
        const newListboxes = allListboxes.filter(lb => {
            const id = lb.id || lb.outerHTML.substring(0, 100);
            if (existingListboxIds.has(id)) return false;
            const style = window.getComputedStyle(lb);
            return style.display !== 'none' && style.visibility !== 'hidden' && (lb as HTMLElement).offsetParent !== null;
        });

        let listbox: Element | null = null;

        // Find closest listbox to the clicked element
        if (newListboxes.length >= 1) {
            const refRect = el.getBoundingClientRect();
            let bestDist = Infinity;
            for (const lb of newListboxes) {
                const lbRect = lb.getBoundingClientRect();
                const dist = Math.abs(lbRect.top - refRect.bottom) + Math.abs(lbRect.left - refRect.left);
                if (dist < bestDist) {
                    bestDist = dist;
                    listbox = lb;
                }
            }
        }

        if (!listbox) {
            listbox = document.querySelector(
                '[role="listbox"]:not([style*="display: none"]), ' +
                '[role="menu"]:not([style*="display: none"]), ' +
                '.wd-popup:not([style*="display: none"]), ' +
                '.wd-popup-content:not([style*="display: none"])'
            );
        }

        if (listbox) {
            const optionEls = [
                ...Array.from(listbox.querySelectorAll('[role="option"]')),
                ...Array.from(listbox.querySelectorAll('[role="menuitem"]')),
                ...Array.from(listbox.querySelectorAll('[data-automation-id="menuItem"]')),
                ...Array.from(listbox.querySelectorAll('.wd-popup-item'))
            ];

            const seen = new Set<string>();
            for (const optEl of optionEls) {
                const text = optEl.textContent?.trim() || '';
                if (text && !seen.has(text)) {
                    seen.add(text);
                    options.push(text);
                }
            }

            console.log(`${LOG_PREFIX} ✅ Found ${options.length} options`);

            // Handle scrollable listboxes
            if (listbox.scrollHeight > listbox.clientHeight) {
                console.log(`${LOG_PREFIX} 📜 Scrolling to load more options...`);
                listbox.scrollTop = listbox.scrollHeight;
                await sleep(800);

                const moreOptions = Array.from(listbox.querySelectorAll('[role="option"], [role="menuitem"]'));
                for (const optEl of moreOptions) {
                    const text = optEl.textContent?.trim() || '';
                    if (text && !seen.has(text)) {
                        seen.add(text);
                        options.push(text);
                    }
                }
                console.log(`${LOG_PREFIX} After scroll: ${options.length} total options`);
            }
        } else {
            console.log(`${LOG_PREFIX} ⚠️  No listbox found for: "${label}"`);
        }

        // Close dropdown
        if (inputEl) {
            inputEl.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true
            }));
            await sleep(100);
            inputEl.blur();
        }
        document.body.click();
        await sleep(CONFIG.SCAN_CLOSE_DELAY);

    } catch (err) {
        console.error(`${LOG_PREFIX} ❌ Error scanning dropdown "${label}":`, err);
        document.body.click();
        await sleep(300);
    }

    return options;
}

interface RadioOption {
    element: HTMLElement;
    label: string;
    isSelected: boolean;
    value: string;
}

async function scanRadioGroupOptions(radioElements: HTMLElement[], questionLabel: string): Promise<RadioOption[]> {
    const radioOptions: RadioOption[] = [];

    for (const radioEl of radioElements) {
        const optionLabel = radioEl.getAttribute('aria-label') ||
            radioEl.textContent?.trim() ||
            radioEl.closest('label')?.textContent?.trim() ||
            '';

        const isSelected = (radioEl as HTMLInputElement).checked ||
            radioEl.getAttribute('aria-checked') === 'true';

        radioOptions.push({
            element: radioEl,
            label: optionLabel,
            isSelected: isSelected,
            value: (radioEl as HTMLInputElement).value || optionLabel
        });
    }

    return radioOptions;
}

function scanCheckboxOptions(el: HTMLElement) {
    const isChecked = (el as HTMLInputElement).checked || el.getAttribute('aria-checked') === 'true';
    const label = extractLabel(el);

    return {
        options: ['Checked', 'Unchecked'],
        currentState: isChecked ? 'Checked' : 'Unchecked',
        label: label
    };
}

/* ================================================================== */
/*  NAVIGATION BUTTON DETECTION - WORKDAY SPECIFIC                    */
/* ================================================================== */

/**
 * Detects navigation and submit buttons on Workday forms.
 * Uses data-automation-id first (most reliable for Workday), then text fallback.
 */
function detectNavigationButtons(): WorkdayButtonInfo[] {
    const found: WorkdayButtonInfo[] = [];

    // Workday-specific data-automation-id values for navigation buttons
    // These are the most reliable - Workday uses these consistently across companies
    const WORKDAY_MULTI_PAGE_AIDS = [
        'bottomNavigationNext',
        'bottomNavigationSaveAndContinue',
        'nextButton',
        'saveAndContinue',
        'continueButton',
        'navigationNext',
        'pageFooterNextButton',
        'pageFooterSaveButton',
    ];

    const WORKDAY_SINGLE_PAGE_AIDS = [
        'bottomNavigationSubmit',
        'submitButton',
        'applyButton',
        'pageFooterSubmitButton',
    ];

    // Text-based keywords as fallback
    const MULTI_PAGE_TEXT_KWS = [
        'next', 'continue', 'save & continue', 'save and continue',
        'save & next', 'save and next', 'proceed', 'next step',
        'go forward', 'move forward', 'next page'
    ];

    const SINGLE_PAGE_TEXT_KWS = [
        'submit', 'apply', 'apply now', 'submit application',
        'complete application', 'finish', 'send application', 'confirm'
    ];

    const seen = new Set<HTMLElement>();

    // --- Pass 1: Scan by data-automation-id (Workday-specific, most reliable) ---
    const allAutomationEls = Array.from(
        document.querySelectorAll('[data-automation-id]')
    ) as HTMLElement[];

    console.log(`${LOG_PREFIX} 🔍 Scanning ${allAutomationEls.length} data-automation-id elements for buttons...`);

    for (const el of allAutomationEls) {
        const aid = (el.getAttribute('data-automation-id') || '').toLowerCase();
        const tag = el.tagName.toLowerCase();
        const role = el.getAttribute('role') || '';

        // Only process button-like elements
        const isButtonLike = tag === 'button' || tag === 'a' ||
            tag === 'input' || role === 'button' || role === 'link';
        if (!isButtonLike) continue;
        if (el.offsetParent === null) continue; // skip hidden
        if (seen.has(el)) continue;

        const isMultiPageAid = WORKDAY_MULTI_PAGE_AIDS.some(a => aid === a.toLowerCase() || aid.includes(a.toLowerCase()));
        const isSinglePageAid = WORKDAY_SINGLE_PAGE_AIDS.some(a => aid === a.toLowerCase() || aid.includes(a.toLowerCase()));

        if (isMultiPageAid || isSinglePageAid) {
            const text = (el.textContent || (el as HTMLInputElement).value || '').trim().replace(/\s+/g, ' ');
            console.log(`${LOG_PREFIX} 🎯 BUTTON FOUND via data-automation-id="${el.getAttribute('data-automation-id')}": "${text || '[no text]'}"`
                + ` → ${isMultiPageAid ? '🔄 MULTI-PAGE (next/continue)' : '✅ SINGLE-PAGE (submit/apply)'}`);
            found.push({
                text: text || aid,
                automationId: el.getAttribute('data-automation-id') || '',
                element: el,
                isMultiPage: isMultiPageAid
            });
            seen.add(el);
        }
    }

    // --- Pass 2: Text-based scan as fallback (catches generic/non-Workday-standard buttons) ---
    const allButtons = Array.from(
        document.querySelectorAll('button, input[type="submit"], input[type="button"], [role="button"]')
    ) as HTMLElement[];

    console.log(`${LOG_PREFIX} 🔍 Scanning ${allButtons.length} button elements for navigation keywords...`);

    for (const btn of allButtons) {
        if (btn.offsetParent === null) continue;
        if (seen.has(btn)) continue;

        const text = (btn.textContent || (btn as HTMLInputElement).value || '')
            .toLowerCase().replace(/\s+/g, ' ').trim();
        if (!text) continue;

        const isMultiPage = MULTI_PAGE_TEXT_KWS.some(kw => text === kw || text.includes(kw));
        const isSinglePage = SINGLE_PAGE_TEXT_KWS.some(kw => text === kw || text.includes(kw));

        if (isMultiPage || isSinglePage) {
            const aid = btn.getAttribute('data-automation-id') || '';
            const displayText = (btn.textContent || '').trim().replace(/\s+/g, ' ');
            console.log(`${LOG_PREFIX} 🎯 BUTTON FOUND via text: "${displayText}" (aid: ${aid || 'none'})`
                + ` → ${isMultiPage ? '🔄 MULTI-PAGE (next/continue)' : '✅ SINGLE-PAGE (submit/apply)'}`);
            found.push({
                text: displayText,
                automationId: aid,
                element: btn,
                isMultiPage
            });
            seen.add(btn);
        }
    }

    console.log(`${LOG_PREFIX} 📊 Button detection summary: ${found.length} total button(s) found`);
    console.log(`${LOG_PREFIX}    🔄 Multi-page buttons: ${found.filter(b => b.isMultiPage).length}`);
    console.log(`${LOG_PREFIX}    ✅ Single-page buttons: ${found.filter(b => !b.isMultiPage).length}`);

    return found;
}

/* ================================================================== */
/*  MAIN SCANNER - EXACT COPY from original (extended with pageType)  */
/* ================================================================== */


export async function scanWorkdayApplication(shouldClickAddButtons: boolean = true): Promise<WorkdayScanResult> {
    if (STATE.isScanningInProgress) {
        console.log(`${LOG_PREFIX} ⚠️  Scan already in progress`);
        return { questions: [], pageType: 'single', navigationButtons: [] };
    }

    STATE.isScanningInProgress = true;
    STATE.discoveredFields = [];
    STATE.fieldMap.clear();

    console.log(`${LOG_PREFIX} 🚀 Starting Workday application scan...`);

    // Click all "Add" buttons first (Optional)
    if (shouldClickAddButtons) {
        await clickAllAddButtons();
    } else {
        console.log(`${LOG_PREFIX} ⏭️ Skipping "Add" buttons for this pass`);
    }

    // Gather all interactive elements
    const elements = Array.from(document.querySelectorAll(`
        input,
        textarea,
        select,
        button[aria-haspopup="listbox"],
        div[role="textbox"],
        div[role="combobox"],
        div[role="radio"],
        div[role="checkbox"]
    `));

    console.log(`${LOG_PREFIX} Found ${elements.length} total elements`);

    const radioGroups = new Map<string, HTMLElement[]>();
    const nonRadioElements: HTMLElement[] = [];

    for (const el of elements) {
        const fieldType = getFieldType(el as HTMLElement);

        if (fieldType === 'radio') {
            const questionLabel = extractLabel(el as HTMLElement, true);
            if (!radioGroups.has(questionLabel)) {
                radioGroups.set(questionLabel, []);
            }
            radioGroups.get(questionLabel)!.push(el as HTMLElement);
        } else {
            nonRadioElements.push(el as HTMLElement);
        }
    }

    // Scan non-radio fields
    for (const el of nonRadioElements) {
        if (!(await isStable(el))) continue;

        const fieldType = getFieldType(el);
        let label = extractLabel(el); // Changed to let to allow reassignment

        // FIX: Force contextual label for dropdowns to avoid empty labels
        if (fieldType === 'combobox' || fieldType === 'select') {
            const contextLabel = extractLabel(el, true);
            if (contextLabel && contextLabel !== 'Search' && contextLabel !== 'Select One') {
                label = contextLabel;
            }
        }

        const fp = fingerprint(el, label);

        if (STATE.fieldMap.has(fp)) continue;

        console.log(`${LOG_PREFIX}   ✅ Discovered: "${label}" (${fieldType})`);

        let options: string[] = [];

        if (fieldType === 'combobox' || fieldType === 'select') {
            options = await scanDropdownOptions(el, label, fieldType);
            console.log(`${LOG_PREFIX}     Found ${options.length} options`);
        } else if (fieldType === 'checkbox') {
            const checkboxInfo = scanCheckboxOptions(el);
            options = checkboxInfo.options;
        }

        STATE.discoveredFields.push({
            element: el,
            fingerprint: fp,
            label: label,
            fieldType: fieldType,
            options: options
        });
        STATE.fieldMap.set(fp, { label, fieldType, options });
    }

    // Scan radio button groups
    for (const [questionLabel, radioElements] of radioGroups) {
        const radioOptions = await scanRadioGroupOptions(radioElements, questionLabel);

        const firstEl = radioElements[0];
        const fp = fingerprint(firstEl, questionLabel);

        if (STATE.fieldMap.has(fp)) continue;

        console.log(`${LOG_PREFIX}   ✅ Discovered: "${questionLabel}" (radio)`);
        console.log(`${LOG_PREFIX}     ${radioOptions.length} options`);

        STATE.discoveredFields.push({
            element: firstEl,
            fingerprint: fp,
            label: questionLabel,
            fieldType: 'radio',
            options: radioOptions.map(ro => ro.label),
            radioGroupOptions: radioOptions
        });
        STATE.fieldMap.set(fp, { label: questionLabel, fieldType: 'radio', options: radioOptions.map(ro => ro.label) });
    }

    console.log(`${LOG_PREFIX} ✅ Scan complete: Found ${STATE.discoveredFields.length} questions\n`);

    // Convert to ScannedQuestion format for questionMapper
    const scannedQuestions: ScannedQuestion[] = STATE.discoveredFields.map(field => ({
        questionText: field.label,
        fieldType: field.fieldType,
        options: field.options.length > 0 ? field.options : undefined,
        required: false,
        selector: field.fingerprint
    }));

    STATE.isScanningInProgress = false;

    // ==================== NAVIGATION BUTTON & PAGE TYPE DETECTION ====================
    console.log(`\n${LOG_PREFIX} ═══════════════════════════════════════════════════`);
    console.log(`${LOG_PREFIX} 🔍 DETECTING NAVIGATION BUTTONS & PAGE TYPE...`);
    console.log(`${LOG_PREFIX} ═══════════════════════════════════════════════════`);

    const navigationButtons = detectNavigationButtons();

    const hasMultiPageButton = navigationButtons.some(b => b.isMultiPage);
    const hasSinglePageButton = navigationButtons.some(b => !b.isMultiPage);

    // Also check for step indicators in the page content
    const pageText = document.body.textContent || '';
    const hasStepIndicator = /step \d+ of \d+/i.test(pageText) ||
        /page \d+ of \d+/i.test(pageText) ||
        document.querySelector('[data-automation-id*="progressBar"], [data-automation-id*="stepIndicator"], [aria-label*="step"]') !== null;

    // Classification: multi-page wins if ANY multi-page signal is detected
    let pageType: 'single' | 'multi' = 'single';
    if (hasMultiPageButton || hasStepIndicator) {
        pageType = 'multi';
    } else if (hasSinglePageButton || navigationButtons.length === 0) {
        pageType = 'single';
    }

    console.log(`${LOG_PREFIX} 📋 PAGE TYPE RESULT: ${pageType.toUpperCase()}`);
    if (hasStepIndicator && !hasMultiPageButton) {
        console.log(`${LOG_PREFIX}    → Reason: Step indicator detected in page content`);
    }
    console.log(`${LOG_PREFIX} ═══════════════════════════════════════════════════\n`);

    return {
        questions: scannedQuestions,
        pageType,
        navigationButtons
    };
}

export function clearScannerState(): void {
    STATE.discoveredFields = [];
    STATE.fieldMap.clear();
    STATE.seenFingerprints.clear();
    STATE.clickedAddButtons.clear();
    console.log(`${LOG_PREFIX} 🔄 Scanner state cleared`);
}

// Export discovered fields for filler to access DOM elements
export function getDiscoveredFields(): any[] {
    return STATE.discoveredFields;
}
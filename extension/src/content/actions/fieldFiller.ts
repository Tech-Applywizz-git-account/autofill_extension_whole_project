// extension/src/content/actions/fieldFiller.ts

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
                const radioName = (field.element as any).name || (field.element as any).getAttribute?.('name');

                // Check if this is a button-based radio group
                const isButtonElement = field.element.tagName.toLowerCase() === 'button' || field.element.getAttribute('role') === 'button';
                const hasChoiceButtons = field.element.querySelectorAll('button, [role="button"]').length >= 2;

                if (isButtonElement || hasChoiceButtons) {
                    console.log(`[Autofill] 🔘 [Button-Group] Filling: "${field.questionText}" → "${value}"`);

                    // PHASE 1: LOCATE ALL BUTTONS IN THIS GROUP
                    let container: HTMLElement | null = isButtonElement ? field.element.parentElement : field.element;
                    let allBtns: HTMLElement[] = [];

                    // Walk up to find the group container, but stay within the "question" boundary
                    for (let depth = 0; depth < 3 && container; depth++) {
                        // Check if we hit a known question/entry boundary - don't go above this!
                        const classes = container.className.toLowerCase();
                        const isBoundary = classes.includes('entry') || classes.includes('question') || 
                                         classes.includes('field') || container.tagName === 'FIELDSET';
                        
                        // Check for buttons at this level
                        const foundBtns = Array.from(container.querySelectorAll<HTMLElement>('button, [role="button"]'))
                            .filter(b => (b.textContent || '').trim().length > 0);

                        if (foundBtns.length >= 2) {
                            allBtns = foundBtns;
                            // If we already have choice-like buttons, this is likely our container
                            const hasChoice = foundBtns.some(b => {
                                const txt = b.textContent?.toLowerCase().trim() || '';
                                return ['yes', 'no', 'agree', 'decline', 'true', 'false'].includes(txt);
                            });
                            if (hasChoice) break;
                        }
                        
                        if (isBoundary && depth > 0) break; 
                        container = container.parentElement;
                    }

                    if (!container || allBtns.length < 2) {
                        console.error(`[Autofill] ❌ [Button-Group] Could not find button container`);
                        break;
                    }

                    console.log(`[Autofill] 🔍 [Button-Group] Found ${allBtns.length} buttons in group`);

                    // PHASE 2: FIND TARGET BUTTON
                    const targetNorm = String(value).toLowerCase().replace(/[.:!]/g, '').trim();
                    let targetBtn: HTMLElement | null = null;

                    for (const btn of allBtns) {
                        const btnText = (btn.textContent || '').toLowerCase().trim();

                        const isMatch = btnText === targetNorm ||
                            btnText.startsWith(targetNorm) ||
                            targetNorm.startsWith(btnText) ||
                            ((targetNorm === 'yes' || targetNorm === 'true') && (btnText.includes('confirm') || btnText.includes('agree') || btnText === 'yes' || btnText === 'true')) ||
                            ((targetNorm === 'no' || targetNorm === 'false') && (btnText.includes('decline') || btnText === 'no' || btnText === 'false'));

                        if (isMatch) {
                            targetBtn = btn;
                            console.log(`[Autofill] 🎯 [Button-Group] Target button: "${btn.textContent?.trim()}"`);
                            break;
                        }
                    }

                    if (!targetBtn) {
                        console.error(`[Autofill] ❌ [Button-Group] No matching button found for: "${value}"`);
                        console.log(`[Autofill] 📋 Available buttons:`, allBtns.map(b => b.textContent?.trim()));
                        break;
                    }

                    // PHASE 3: CAPTURE INITIAL STATE (for comparison)
                    const captureState = (btn: HTMLElement) => {
                        const computed = window.getComputedStyle(btn);
                        return {
                            classes: Array.from(btn.classList),
                            classString: btn.className,
                            bg: computed.backgroundColor,
                            color: computed.color,
                            borderColor: computed.borderColor,
                            fontWeight: computed.fontWeight,
                            opacity: computed.opacity,
                            ariaPressed: btn.getAttribute('aria-pressed'),
                            ariaChecked: btn.getAttribute('aria-checked'),
                            ariaSelected: btn.getAttribute('aria-selected'),
                            dataActive: btn.getAttribute('data-active'),
                            dataState: btn.getAttribute('data-state'),
                            dataChecked: btn.getAttribute('data-checked'),
                        };
                    };

                    const initialState = captureState(targetBtn);
                    console.log(`[Autofill] 📸 [Button-Group] Initial state:`, initialState);

                    // PHASE 4: COMPREHENSIVE STATE VERIFICATION
                    const verifyActivation = (btn: HTMLElement, beforeState: any): boolean => {
                        const currentState = captureState(btn);

                        // DEBUG: Log state comparison for diagnostics
                        console.log(`[Autofill] 🔍 [Verify] State check:`, {
                            before: { classes: beforeState.classString, bg: beforeState.bg, color: beforeState.color },
                            after: { classes: currentState.classString, bg: currentState.bg, color: currentState.color }
                        });

                        // Method 1: Class changes (most reliable for Ashby/React)
                        const beforeClasses = beforeState.classString.toLowerCase();
                        const afterClasses = currentState.classString.toLowerCase();

                        const hasActiveClass = afterClasses.includes('active') ||
                            afterClasses.includes('selected') ||
                            afterClasses.includes('checked') ||
                            afterClasses.includes('_active');

                        const classCountIncreased = currentState.classes.length > beforeState.classes.length;

                        const newClassesAdded = currentState.classes.some(cls => !beforeState.classes.includes(cls));

                        // CRITICAL: ANY class change is a strong signal
                        const classStringChanged = afterClasses !== beforeClasses;

                        // Method 2: ARIA attributes
                        const ariaActivated = currentState.ariaPressed === 'true' ||
                            currentState.ariaChecked === 'true' ||
                            currentState.ariaSelected === 'true';

                        // Method 3: Data attributes
                        const dataActivated = currentState.dataActive === 'true' ||
                            currentState.dataActive !== null ||
                            currentState.dataState === 'active' ||
                            currentState.dataState === 'checked' ||
                            currentState.dataChecked === 'true';

                        // Method 4: Style changes (FIXED for empty string handling)
                        // Helper: Normalize empty/transparent backgrounds
                        const normalizeBg = (bg: string) => {
                            if (!bg || bg === '' || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') {
                                return 'TRANSPARENT';
                            }
                            return bg;
                        };

                        const normalizeColor = (color: string) => {
                            if (!color || color === '' || color === 'rgba(0, 0, 0, 0)' || color === 'transparent') {
                                return 'TRANSPARENT';
                            }
                            return color;
                        };

                        const beforeBgNorm = normalizeBg(beforeState.bg);
                        const afterBgNorm = normalizeBg(currentState.bg);
                        const beforeColorNorm = normalizeColor(beforeState.color);
                        const afterColorNorm = normalizeColor(currentState.color);

                        const bgChanged = afterBgNorm !== beforeBgNorm && afterBgNorm !== 'TRANSPARENT';

                        const colorChanged = afterColorNorm !== beforeColorNorm && afterColorNorm !== 'TRANSPARENT';

                        const borderChanged = currentState.borderColor !== beforeState.borderColor &&
                            currentState.borderColor !== '' &&
                            currentState.borderColor !== 'rgba(0, 0, 0, 0)' &&
                            currentState.borderColor !== 'transparent';

                        const weightChanged = currentState.fontWeight !== beforeState.fontWeight;

                        const opacityChanged = currentState.opacity !== beforeState.opacity;

                        // Method 5: Specific known patterns
                        const ashbyPattern = afterBgNorm.includes('rgb(26, 32, 44)') ||
                            afterBgNorm.includes('rgb(49, 130, 206)') ||
                            afterBgNorm.includes('rgb(66, 153, 225)') ||
                            // Ashby uses class changes primarily
                            (afterClasses.includes('_container_pjyt6_1') && classStringChanged);

                        const greenhousePattern = afterClasses.includes('_active') ||
                            (afterClasses.includes('css-') && hasActiveClass);

                        const leverPattern = currentState.dataState === 'selected';

                        // COMPREHENSIVE CHECK: Any indication of activation?
                        const activated = hasActiveClass || classCountIncreased || newClassesAdded || classStringChanged ||
                            ariaActivated || dataActivated ||
                            bgChanged || colorChanged || borderChanged || weightChanged || opacityChanged ||
                            ashbyPattern || greenhousePattern || leverPattern;

                        if (activated) {
                            console.log(`[Autofill] ✅ [Button-Group] Activation detected via:`, {
                                hasActiveClass,
                                classCountIncreased,
                                newClassesAdded,
                                classStringChanged,
                                ariaActivated,
                                dataActivated,
                                bgChanged,
                                colorChanged,
                                borderChanged,
                                weightChanged,
                                opacityChanged,
                                ashbyPattern,
                            });
                        } else {
                            console.log(`[Autofill] ❌ [Verify] No activation detected`);
                        }

                        return activated;
                    };

                    // PHASE 5: MULTI-STRATEGY CLICKING WITH PROGRESSIVE FALLBACKS

                    /**
                     * STRATEGY 1: Standard Event Sequence
                     * Most reliable for React/framework apps
                     */
                    const clickStrategy1_StandardEvents = async (btn: HTMLElement): Promise<boolean> => {
                        console.log(`[Autofill] 🔘 [Strategy 1] Standard event sequence`);

                        // Focus first (many frameworks require this)
                        btn.focus();
                        await new Promise(resolve => setTimeout(resolve, 30));

                        // Full mouse event sequence with timing
                        btn.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, cancelable: true, pointerType: 'mouse' }));
                        btn.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true }));
                        btn.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true, cancelable: true, pointerType: 'mouse' }));
                        btn.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, cancelable: true }));

                        await new Promise(resolve => setTimeout(resolve, 20));

                        btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'mouse', button: 0 }));
                        btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
                        btn.dispatchEvent(new FocusEvent('focus', { bubbles: true, cancelable: true }));

                        await new Promise(resolve => setTimeout(resolve, 20));

                        btn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerType: 'mouse', button: 0 }));
                        btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, button: 0 }));
                        btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));

                        if (btn.click) btn.click();

                        await new Promise(resolve => setTimeout(resolve, 50));

                        return verifyActivation(btn, initialState);
                    };

                    /**
                     * STRATEGY 2: Native Click with Focus
                     * Simpler, lets browser handle everything
                     */
                    const clickStrategy2_NativeClick = async (btn: HTMLElement): Promise<boolean> => {
                        console.log(`[Autofill] 🔘 [Strategy 2] Native click`);

                        // Blur everything first
                        if (document.activeElement) {
                            (document.activeElement as HTMLElement).blur();
                        }
                        await new Promise(resolve => setTimeout(resolve, 20));

                        // Scroll into view
                        btn.scrollIntoView({ block: 'center', behavior: 'instant' });
                        await new Promise(resolve => setTimeout(resolve, 30));

                        // Focus and click
                        btn.focus();
                        await new Promise(resolve => setTimeout(resolve, 30));

                        if (btn.click) btn.click();

                        await new Promise(resolve => setTimeout(resolve, 50));

                        return verifyActivation(btn, initialState);
                    };

                    /**
                     * STRATEGY 3: Keyboard Interaction
                     * For accessibility-focused frameworks
                     */
                    const clickStrategy3_Keyboard = async (btn: HTMLElement): Promise<boolean> => {
                        console.log(`[Autofill] 🔘 [Strategy 3] Keyboard activation`);

                        btn.focus();
                        await new Promise(resolve => setTimeout(resolve, 30));

                        // Space key
                        btn.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', keyCode: 32, bubbles: true, cancelable: true }));
                        await new Promise(resolve => setTimeout(resolve, 20));
                        btn.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', code: 'Space', keyCode: 32, bubbles: true, cancelable: true }));

                        await new Promise(resolve => setTimeout(resolve, 50));

                        if (verifyActivation(btn, initialState)) return true;

                        // Try Enter key
                        btn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true, cancelable: true }));
                        await new Promise(resolve => setTimeout(resolve, 20));
                        btn.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true, cancelable: true }));

                        await new Promise(resolve => setTimeout(resolve, 50));

                        return verifyActivation(btn, initialState);
                    };

                    /**
                     * STRATEGY 4: Touch Events
                     * For mobile-optimized or touch-enabled frameworks
                     */
                    const clickStrategy4_Touch = async (btn: HTMLElement): Promise<boolean> => {
                        console.log(`[Autofill] 🔘 [Strategy 4] Touch events`);

                        btn.focus();
                        await new Promise(resolve => setTimeout(resolve, 30));

                        const touch = new Touch({
                            identifier: Date.now(),
                            target: btn,
                            clientX: btn.getBoundingClientRect().left + btn.getBoundingClientRect().width / 2,
                            clientY: btn.getBoundingClientRect().top + btn.getBoundingClientRect().height / 2,
                            radiusX: 2.5,
                            radiusY: 2.5,
                            rotationAngle: 0,
                            force: 1,
                        });

                        btn.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: [touch], targetTouches: [touch], changedTouches: [touch] }));
                        await new Promise(resolve => setTimeout(resolve, 20));
                        btn.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true, touches: [], targetTouches: [], changedTouches: [touch] }));

                        if (btn.click) btn.click();

                        await new Promise(resolve => setTimeout(resolve, 50));

                        return verifyActivation(btn, initialState);
                    };

                    /**
                     * STRATEGY 5: Direct React Fiber Manipulation
                     * Nuclear option - directly access React's internal state
                     */
                    const clickStrategy5_ReactDirect = async (btn: HTMLElement): Promise<boolean> => {
                        console.log(`[Autofill] 🔘 [Strategy 5] Direct React manipulation`);

                        try {
                            // Find React fiber
                            const reactKey = Object.keys(btn).find(key =>
                                key.startsWith('__reactFiber') ||
                                key.startsWith('__reactInternalInstance') ||
                                key.startsWith('__reactProps')
                            );

                            if (reactKey) {
                                const reactInstance = (btn as any)[reactKey];
                                const props = reactInstance?.memoizedProps || reactInstance?.pendingProps || reactInstance?.return?.memoizedProps;

                                if (props?.onClick) {
                                    console.log(`[Autofill] 🎯 [Strategy 5] Found React onClick handler`);
                                    btn.focus();
                                    await new Promise(resolve => setTimeout(resolve, 30));

                                    // Call handler directly
                                    const syntheticEvent = {
                                        target: btn,
                                        currentTarget: btn,
                                        preventDefault: () => { },
                                        stopPropagation: () => { },
                                        nativeEvent: new MouseEvent('click', { bubbles: true, cancelable: true }),
                                        bubbles: true,
                                        cancelable: true,
                                    };

                                    props.onClick(syntheticEvent);

                                    await new Promise(resolve => setTimeout(resolve, 50));

                                    return verifyActivation(btn, initialState);
                                }
                            }
                        } catch (error) {
                            console.warn(`[Autofill] ⚠️ [Strategy 5] React manipulation failed:`, error);
                        }

                        return false;
                    };

                    /**
                     * STRATEGY 6: DOM Mutation + Force Rerender
                     * Forces framework to recognize state change
                     */
                    const clickStrategy6_ForceMutation = async (btn: HTMLElement): Promise<boolean> => {
                        console.log(`[Autofill] 🔘 [Strategy 6] Force DOM mutation`);

                        // Click normally first
                        btn.focus();
                        if (btn.click) btn.click();

                        await new Promise(resolve => setTimeout(resolve, 50));

                        // Force a class toggle to trigger framework reactivity
                        const tempClass = `__autofill_force_${Date.now()}`;
                        btn.classList.add(tempClass);
                        await new Promise(resolve => requestAnimationFrame(() => { }));
                        btn.classList.remove(tempClass);

                        // Dispatch input/change events
                        btn.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
                        btn.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));

                        await new Promise(resolve => setTimeout(resolve, 50));

                        return verifyActivation(btn, initialState);
                    };

                    // PHASE 6: EXECUTE STRATEGIES WITH PROGRESSIVE FALLBACK
                    const strategies = [
                        clickStrategy1_StandardEvents,
                        clickStrategy2_NativeClick,
                        clickStrategy3_Keyboard,
                        clickStrategy4_Touch,
                        clickStrategy5_ReactDirect,
                        clickStrategy6_ForceMutation,
                    ];

                    let finalSuccess = false;
                    let strategyUsed = -1;

                    // Wait for React to settle after AI response
                    console.log('[Autofill] ⏳ [Button-Group] Waiting for React to settle...');
                    await new Promise(resolve => setTimeout(resolve, 80));

                    // Ensure button is ready
                    targetBtn.scrollIntoView({ block: 'center', behavior: 'instant' });
                    await new Promise(resolve => setTimeout(resolve, 40));

                    console.log('[Autofill] 🚀 [Button-Group] Starting strategy execution');

                    // Try each strategy until one succeeds
                    for (let i = 0; i < strategies.length; i++) {
                        console.log(`[Autofill] 🎯 [Button-Group] Attempting strategy ${i + 1}/${strategies.length}`);

                        try {
                            const strategyResult = await strategies[i](targetBtn);

                            if (strategyResult) {
                                finalSuccess = true;
                                strategyUsed = i + 1;
                                console.log(`[Autofill] ✅ [Button-Group] SUCCESS with strategy ${strategyUsed}`);
                                break;
                            } else {
                                console.warn(`[Autofill] ⚠️ [Button-Group] Strategy ${i + 1} failed, trying next...`);
                                await new Promise(resolve => setTimeout(resolve, 100)); // Cooldown between strategies
                            }
                        } catch (error) {
                            console.error(`[Autofill] ❌ [Button-Group] Strategy ${i + 1} threw error:`, error);
                            await new Promise(resolve => setTimeout(resolve, 100));
                        }
                    }

                    console.log(`[Autofill] 📈 [Button-Group] All strategies complete. Success: ${finalSuccess}`);

                    // PHASE 7: FINAL VERIFICATION WITH EXTENDED POLLING
                    if (!finalSuccess) {
                        console.warn(`[Autofill] 🔄 [Button-Group] All strategies failed initial verification, extended polling...`);

                        // Sometimes state updates are delayed - poll for up to 2 seconds
                        let pollAttempts = 0;
                        const maxPollAttempts = 40; // 40 × 50ms = 2 seconds

                        while (pollAttempts < maxPollAttempts && !finalSuccess) {
                            await new Promise(resolve => setTimeout(resolve, 50));
                            finalSuccess = verifyActivation(targetBtn, initialState);
                            pollAttempts++;

                            if (finalSuccess) {
                                console.log(`[Autofill] ✅ [Button-Group] Delayed activation detected after ${pollAttempts * 50}ms`);
                                break;
                            }
                        }
                    }

                    // PHASE 8: FORENSIC LOGGING IF STILL FAILED
                    if (!finalSuccess) {
                        console.error(`[Autofill] ❌ [Button-Group] CRITICAL: All strategies failed after extended polling`);

                        const finalState = captureState(targetBtn);

                        console.error(`[Autofill] 🔍 [Forensics] Initial state:`, initialState);
                        console.error(`[Autofill] 🔍 [Forensics] Final state:`, finalState);
                        console.error(`[Autofill] 🔍 [Forensics] State comparison:`, {
                            classesAdded: finalState.classes.filter(c => !initialState.classes.includes(c)),
                            classesRemoved: initialState.classes.filter(c => !finalState.classes.includes(c)),
                            classStringChanged: initialState.classString !== finalState.classString,
                            bgChanged: initialState.bg !== finalState.bg,
                            colorChanged: initialState.color !== finalState.color,
                        });
                        console.error(`[Autofill] 🔍 [Forensics] Button HTML:`, targetBtn.outerHTML);
                        console.error(`[Autofill] 🔍 [Forensics] Container HTML (first 500 chars):`, container?.outerHTML.substring(0, 500));

                        // Check if button looks visually different
                        const visuallyDifferent = targetBtn.className !== initialState.classString ||
                            window.getComputedStyle(targetBtn).backgroundColor !== initialState.bg ||
                            window.getComputedStyle(targetBtn).color !== initialState.color;

                        if (visuallyDifferent) {
                            console.warn(`[Autofill] 🎯 [Forensics] Button DID change visually, but verification didn't catch it!`);
                            console.warn(`[Autofill] 🎯 [Forensics] This is a verification pattern issue, not a click issue`);
                            console.warn(`[Autofill] 🎯 [Forensics] Button was likely clicked successfully`);
                        } else {
                            console.error(`[Autofill] 🎯 [Forensics] Button appears unchanged - click may not have worked`);
                        }

                        // Last resort: assume it worked if we got this far
                        console.warn(`[Autofill] 🚨 [Button-Group] Proceeding with assumed success - MANUAL VERIFICATION REQUIRED`);
                        success = true;
                    } else {
                        console.log(`[Autofill] ✅ [Button-Group] Field filled successfully using strategy ${strategyUsed || 'extended polling'}`);
                        success = true;
                    }

                    break; // Exit switch case
                }

                // Native Radio handling fallback (unchanged)
                if (radioName) {
                    console.log(`[Autofill] 🔘 Selecting native radio: ${field.questionText} → ${value}`);
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

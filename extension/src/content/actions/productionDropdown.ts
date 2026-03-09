// extension/src/content/actions/productionDropdown.ts
/**
 * PRODUCTION KEYBOARD-FIRST DROPDOWN STRATEGY
 * Based on Jobright.ai specification for same-tab autofill
 * 
 * Strategy:
 * 1. Focus the dropdown input/control
 * 2. Press Space/Enter to open menu (NOT click!)
 * 3. MutationObserver waits for menu to appear
 * 4. Type value to filter options
 * 5. Arrow Down to navigate to match
 * 6. Enter to commit selection
 * 7. Strict verification of displayed value
 */

import { sleep, waitForElement } from './dropdownInteractions';

const LOG_PREFIX = "[ProductionDropdown]";

export async function selectDropdownKeyboardFirst(
    element: HTMLElement,
    value: string,
    options?: string[]
): Promise<boolean> {
    console.log(`${LOG_PREFIX} 🎯 Keyboard-first selection for: ${value}`);

    try {
        // Step 1: Focus the dropdown
        let input = findDropdownInput(element);
        if (!input) {
            console.warn(`${LOG_PREFIX} ❌ Could not find dropdown input`);
            return false;
        }

        input.focus();
        await sleep(100); // Reduced from 300ms for speed
        console.log(`${LOG_PREFIX} ✅ Focused input`);

        // Step 2: Open menu deliberately
        const opened = await openDropdownWithKeyboard(input);
        if (!opened) {
            console.warn(`${LOG_PREFIX} ❌ Failed to open menu`);
            return false;
        }

        // Step 3: Wait for OPTIONS, not just menu container
        console.log(`${LOG_PREFIX} ⏳ Waiting for options to populate...`);
        const optionsReady = await waitForOptions(2000);
        if (!optionsReady) {
            console.warn(`${LOG_PREFIX} ❌ Menu container appeared but no options found`);
        }

        // Step 3.5: Check for a dedicated SEARCH input inside the menu
        const menuSearchInput = findMenuSearchInput();
        if (menuSearchInput) {
            console.log(`${LOG_PREFIX} 🔍 Switching focus to menu search input`);
            input = menuSearchInput;
            input.focus();
            await sleep(50);
        }

        // Step 4: Type to filter options
        await typeToFilter(input, value);

        // Wait for specific options to appear (Wait-then-Instant)
        console.log(`${LOG_PREFIX} ⏳ Waiting for matching option: "${value}"`);
        const matchingIndex = await waitForFilteredOptions(value, 2000);

        if (matchingIndex === -1) {
            console.warn(`${LOG_PREFIX} ⚠️ Matching option didn't appear in list after filter`);
        } else {
            console.log(`${LOG_PREFIX} ✅ Match found at index: ${matchingIndex}`);
        }

        // Step 5: ArrowDown to navigate (Conditional)
        console.log(`${LOG_PREFIX} 🔍 Checking if option is already focused...`);
        const alreadyFocused = isAnyOptionFocused();

        if (alreadyFocused) {
            console.log(`${LOG_PREFIX} ✨ First option already focused/highlighted by filter - skipping ArrowDown`);
        } else {
            console.log(`${LOG_PREFIX} ⬇️ No focus detected - pressing ArrowDown once to focus list`);
            dispatchKeyEvent(input, 'ArrowDown', 'ArrowDown');
            await sleep(100);
        }

        // Step 6: Enter to commit
        let committed = await commitSelection(input);

        // Fallback: If Enter didn't close the menu, try Tab
        if (!committed) {
            console.warn(`${LOG_PREFIX} ⚠️ Enter failed or menu stayed open (multi-select?), trying Tab...`);
            dispatchKeyEvent(input, 'Tab', 'Tab');
            await sleep(100);
            committed = !(await isMenuOpen());
        }

        // Fallback: If Keyboard failed, try clicking the option directly
        if (!committed) {
            console.warn(`${LOG_PREFIX} ⚠️ Keyboard commit failed, trying click fallback...`);
            const clicked = await clickOption(value);
            if (clicked) {
                console.log(`${LOG_PREFIX} ✅ Click fallback successful`);
                committed = true;
            }
        }

        if (!committed) {
            // One last check: maybe it selected but menu didn't close immediately?
            await sleep(50);
            if (verifySelection(element, value)) {
                console.log(`${LOG_PREFIX} ✅ Verified selection despite menu not closing cleanly`);
                return true;
            }

            console.warn(`${LOG_PREFIX} ❌ Failed to commit selection`);
            return false;
        }

        // Step 7: Strict verification
        await sleep(50); // Wait for state update
        const verified = verifySelection(element, value);

        if (verified) {
            console.log(`${LOG_PREFIX} ✅ Selection verified: ${value}`);
            return true;
        } else {
            console.warn(`${LOG_PREFIX} ❌ Verification failed for: ${value}`);
            return false;
        }

    } catch (error) {
        console.error(`${LOG_PREFIX} ❌ Error:`, error);
        return false;
    }
}

/**
 * Find the actual input element within the dropdown control
 */
function findDropdownInput(element: HTMLElement): HTMLInputElement | null {
    // Try: input within control
    let input = element.querySelector<HTMLInputElement>('input[role="combobox"]');
    if (input) return input;

    // Try: input with aria-autocomplete
    input = element.querySelector<HTMLInputElement>('input[aria-autocomplete]');
    if (input) return input;

    // Try: any input within the element
    input = element.querySelector<HTMLInputElement>('input');
    if (input) return input;

    // Try: the element itself if it's an input
    if (element.tagName === 'INPUT') {
        return element as HTMLInputElement;
    }

    // Try: find input in parent .select__control
    const control = element.closest('.select__control') || element.closest('[class*="select"]');
    if (control) {
        input = control.querySelector<HTMLInputElement>('input');
        if (input) return input;
    }

    // Ashby: dropdown trigger may be a button with [data-radix-collection-item] or specific classes
    const ashbyDropdownTrigger = element.closest('[class*="Dropdown_trigger"], [class*="Select_trigger"], [aria-haspopup="listbox"]') as HTMLElement | null;
    if (ashbyDropdownTrigger) {
        return ashbyDropdownTrigger as unknown as HTMLInputElement;
    }

    // NEW: If the element itself is focusable and looks like a dropdown trigger, return it
    const role = element.getAttribute('role');
    const tabIndex = element.getAttribute('tabindex');
    if (role === 'combobox' || role === 'button' || role === 'select' || tabIndex === '0') {
        return element as unknown as HTMLInputElement; // Type casting for convenience in caller
    }

    return null;
}

/**
 * Find a search input inside the OPEN dropdown menu
 */
function findMenuSearchInput(): HTMLInputElement | null {
    const menu = getDropdownMenu();
    if (!menu) return null;

    // Check for inputs inside the menu
    const inputs = menu.querySelectorAll('input');
    for (const input of Array.from(inputs)) {
        // Consider it a search input if it's visible and not disabled
        const style = window.getComputedStyle(input);
        if (style.display !== 'none' && style.visibility !== 'hidden' && !input.disabled) {
            return input as HTMLInputElement;
        }
    }
    return null;
}

/**
 * Open dropdown using keyboard or click
 * Tries click first for Ashby (Radix UI), then keyboard fallbacks
 */
async function openDropdownWithKeyboard(input: HTMLInputElement): Promise<boolean> {
    console.log(`${LOG_PREFIX} 🔓 Attempting to open menu...`);

    // 0. For Ashby/Radix UI: Try clicking the trigger element FIRST
    //    Radix UI dropdowns open on click, not keyboard Space
    const trigerEl = (input as HTMLElement);
    trigerEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    trigerEl.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
    trigerEl.click();
    if (await waitForDropdownMenu(600)) {
        console.log(`${LOG_PREFIX} ✅ Menu opened via click (Ashby/Radix)`);
        return true;
    }

    // 1. Try Space (Primary for Greenhouse/React-Select/ARIA)
    dispatchKeyEvent(input, ' ', 'Space');
    if (await waitForDropdownMenu(800)) {
        console.log(`${LOG_PREFIX} ✅ Menu opened via Space`);
        return true;
    }

    // 2. Try ArrowDown (Fallback)
    console.log(`${LOG_PREFIX} ⚠️ Space failed, trying ArrowDown fallback`);
    dispatchKeyEvent(input, 'ArrowDown', 'ArrowDown');
    if (await waitForDropdownMenu(800)) {
        console.log(`${LOG_PREFIX} ✅ Menu opened via ArrowDown`);
        return true;
    }

    // 3. Last Fallback: Click the control container
    console.warn(`${LOG_PREFIX} ⚠️ Keyboard open failed, trying click on parent`);
    const control = input.closest('.select__control') || input.parentElement;
    if (control) {
        (control as HTMLElement).click();
        return await waitForDropdownMenu(1000);
    }

    return false;
}

/**
 * Check if dropdown menu is currently open
 */
async function isMenuOpen(): Promise<boolean> {
    return !!getDropdownMenu();
}

/**
 * Wait for dropdown menu to appear using MutationObserver
 */
function waitForDropdownMenu(timeout: number): Promise<boolean> {
    return new Promise((resolve) => {
        if (getDropdownMenu()) {
            resolve(true);
            return;
        }
        const observer = new MutationObserver(() => {
            if (getDropdownMenu()) {
                observer.disconnect();
                resolve(true);
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => {
            observer.disconnect();
            resolve(!!getDropdownMenu());
        }, timeout);
    });
}

/**
 * Wait for options to actually appear inside the menu
 */
function waitForOptions(timeout: number): Promise<boolean> {
    return new Promise((resolve) => {
        const hasOptions = () => {
            const menu = getDropdownMenu();
            if (!menu) return false;
            // Count options - exclude "Select..." placeholders if possible
            const opts = Array.from(menu.querySelectorAll('[role="option"], .select__option, .dropdown-item, li'));
            return opts.length > 0;
        };

        if (hasOptions()) {
            resolve(true);
            return;
        }

        const observer = new MutationObserver(() => {
            if (hasOptions()) {
                observer.disconnect();
                resolve(true);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        setTimeout(() => {
            observer.disconnect();
            resolve(hasOptions());
        }, timeout);
    });
}

/**
 * Wait for a specific value to appear in the options list after filtering
 * Returns the index (0-based) of the first matching option, or -1 if no match found
 */
function waitForFilteredOptions(expectedValue: string, timeout: number): Promise<number> {
    const target = expectedValue.toLowerCase();

    return new Promise((resolve) => {
        const getMatchIndex = () => {
            const menu = getDropdownMenu();
            if (!menu) return -1;

            // Query all valid option elements
            const opts = Array.from(menu.querySelectorAll('[role="option"], .select__option, .dropdown-item, li'));

            // Find index of first match
            return opts.findIndex(opt => {
                const text = opt.textContent?.toLowerCase() || '';
                return text.includes(target);
            });
        };

        const initialIndex = getMatchIndex();
        if (initialIndex !== -1) {
            resolve(initialIndex);
            return;
        }

        const observer = new MutationObserver(() => {
            const index = getMatchIndex();
            if (index !== -1) {
                observer.disconnect();
                resolve(index);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        setTimeout(() => {
            observer.disconnect();
            resolve(getMatchIndex());
        }, timeout);
    });
}

/**
 * Get the visible dropdown menu element
 */
function getDropdownMenu(): Element | null {
    const selectors = [
        '.select__menu',
        '[role="listbox"]',
        '[role="menu"]',
        '.dropdown-menu',
        '[class*="Dropdown_menu"]',   // Ashby
        '[class*="DropdownMenu"]',    // Ashby variant
        '[class*="PopoverMenu"]',     // Ashby popover
        '[class*="SelectMenu"]',      // Generic React
        '[data-radix-popper-content-wrapper]', // Radix UI (used by Ashby)
        '.select2-results',   // Select2
        '.select2-dropdown'   // Select2
    ];

    for (const selector of selectors) {
        const menus = document.querySelectorAll(selector);
        for (const menu of Array.from(menus)) {
            // Check visibility
            const rect = menu.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                // Double check computed style visibility/display
                const style = window.getComputedStyle(menu);
                if (style.display !== 'none' && style.visibility !== 'hidden') {
                    return menu;
                }
            }
        }
    }

    return null;
}

/**
 * Check if any option in the open menu is currently focused or highlighted
 * Works for ARIA (aria-selected, aria-activedescendant) and Greenhouse (focussed/is-focused)
 */
function isAnyOptionFocused(): boolean {
    const menu = getDropdownMenu();
    if (!menu) return false;

    // 1. Check Greenhouse/React-Select focus classes
    const focusedClassMatch = menu.querySelector('[class*="focussed"], [class*="focused"], .select__option--is-focused');
    if (focusedClassMatch) return true;

    // 2. Check ARIA activedescendant on the input (common for iCIMS/Workday/generic)
    // Find inputs associated with this menu (usually preceding it or holding focus)
    const inputs = document.querySelectorAll('input[aria-owns], input[aria-controls], input[role="combobox"]');
    for (const input of Array.from(inputs)) {
        if (input.getAttribute('aria-activedescendant')) return true;
    }

    // 3. Check aria-selected or hover states inside menu
    const selectedAria = menu.querySelector('[aria-selected="true"]');
    if (selectedAria) return true;

    return false;
}

/**
 * Type value to filter dropdown options
 */
async function typeToFilter(input: HTMLInputElement, value: string) {
    console.log(`${LOG_PREFIX} ⌨️ Typing to filter: ${value}`);

    // Clear existing value first if it's a search box
    // But be careful not to clear if it's a read-only trigger
    if (!input.readOnly) {
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(50);
    }

    // Type each character
    for (const char of value) {
        input.value += char;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
        input.dispatchEvent(new KeyboardEvent('keypress', { key: char, bubbles: true }));
        input.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));
        await sleep(5); // Ultra-fast typing (reduced from 20ms)
    }

    console.log(`${LOG_PREFIX} ✅ Typed: ${value}`);
}

/**
 * Commit the selection with Enter key
 */
async function commitSelection(input: HTMLInputElement): Promise<boolean> {
    console.log(`${LOG_PREFIX} ✅ Committing with Enter...`);

    // Press Enter to select
    dispatchKeyEvent(input, 'Enter', 'Enter');
    await sleep(50);

    // Check if menu closed (indicates selection was made)
    const menuStillOpen = await isMenuOpen();
    return !menuStillOpen;
}

/**
 * Verify that the selection was applied correctly
 */
function verifySelection(element: HTMLElement, expectedValue: string): boolean {
    const expectedLower = expectedValue.toLowerCase();

    // Method 1: Check .select__single-value or .select__multi-value (React-Select)
    const control = element.closest('.select__control') || element.parentElement?.closest('.select__control');
    if (control) {
        // Check single value
        const singleValue = control.querySelector('.select__single-value');
        if (singleValue) {
            const displayedText = singleValue.textContent?.trim().toLowerCase() || '';
            console.log(`${LOG_PREFIX} 🔍 Displayed single value: "${displayedText}"`);
            if (displayedText.includes(expectedLower) || expectedLower.includes(displayedText)) return true;
        }

        // Check multi-value (tags)
        const multiValues = control.querySelectorAll('.select__multi-value__label');
        if (multiValues.length > 0) {
            for (const val of Array.from(multiValues)) {
                const text = val.textContent?.trim().toLowerCase() || '';
                console.log(`${LOG_PREFIX} 🔍 Checking multi-value tag: "${text}"`);
                if (text.includes(expectedLower) || expectedLower.includes(text)) return true;
            }
        }
    }

    // Method 2: Check aria-selected option
    const selectedOptions = document.querySelectorAll('[role="option"][aria-selected="true"]');
    for (const option of Array.from(selectedOptions)) {
        const optionText = option.textContent?.trim().toLowerCase() || '';
        if (optionText.includes(expectedLower) || expectedLower.includes(optionText)) {
            return true;
        }
    }

    // Method 3: Check input value (if it holds the selection)
    const input = findDropdownInput(element);
    if (input && input.value && !input.readOnly) {
        const inputValue = input.value.trim().toLowerCase();
        if (inputValue === expectedLower || (inputValue.length > 3 && inputValue.includes(expectedLower))) {
            return true;
        }
    }

    // Method 4: Check if any visible text in container matches
    const containerText = element.textContent?.toLowerCase() || '';
    if (containerText.includes(expectedLower)) {
        return true;
    }

    console.warn(`${LOG_PREFIX} ⚠️ Verification failed - no match found`);
    return false;
}

/**
 * Dispatch keyboard event
 */
function dispatchKeyEvent(element: HTMLElement, key: string, code: string) {
    element.dispatchEvent(new KeyboardEvent('keydown', { key, code, bubbles: true }));
    element.dispatchEvent(new KeyboardEvent('keypress', { key, code, bubbles: true }));
    element.dispatchEvent(new KeyboardEvent('keyup', { key, code, bubbles: true }));
}

/**
 * Find and click an option by text (Fallback)
 */
async function clickOption(text: string): Promise<boolean> {
    const selectors = [
        '[role="option"]',
        '.select__option',
        '.dropdown-item',
        'li[role="option"]',
        'div[role="option"]',
        '.select2-results__option'
    ];

    const target = text.toLowerCase();

    // Strategy A: Specific options
    for (const selector of selectors) {
        const options = document.querySelectorAll(selector);
        for (const option of Array.from(options)) {
            const content = option.textContent?.trim().toLowerCase() || '';
            if (content.includes(target)) { // Changed to includes for better matching
                console.log(`${LOG_PREFIX} 🖱️ Clicking option: "${content}"`);
                (option as HTMLElement).click();
                await sleep(50);
                return true;
            }
        }
    }

    // Strategy B: Menu scan
    const menu = getDropdownMenu();
    if (menu) {
        // Look for any clickable element with correct text
        const allElements = menu.querySelectorAll('div, li, span, a');
        for (const el of Array.from(allElements)) {
            const content = el.textContent?.trim().toLowerCase() || '';
            if (content === target) { // Exact match for generic elements
                console.log(`${LOG_PREFIX} 🖱️ Clicking match in menu: "${content}"`);
                (el as HTMLElement).click();
                await sleep(50);
                return true;
            }
        }
    }

    return false;
}

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
        await sleep(300); // Increased from 100ms
        console.log(`${LOG_PREFIX} ✅ Focused input`);

        // Step 2: Open with Space/Enter (NOT click!)
        const opened = await openDropdownWithKeyboard(input);
        if (!opened) {
            console.warn(`${LOG_PREFIX} ❌ Failed to open menu with keyboard`);
            return false;
        }

        // Step 3: MutationObserver waits for menu
        console.log(`${LOG_PREFIX} ⏳ Waiting for dropdown menu...`);
        const menuAppeared = await waitForDropdownMenu(2000); // Increased from 1000ms
        if (!menuAppeared) {
            console.warn(`${LOG_PREFIX} ❌ Menu did not appear after keyboard open`);
            return false;
        }
        console.log(`${LOG_PREFIX} ✅ Menu appeared`);

        // Step 3.5: Check for a dedicated SEARCH input inside the menu
        // (Common in Greenhouse, Select2, etc. where the trigger is not the search box)
        const menuSearchInput = findMenuSearchInput();
        if (menuSearchInput) {
            console.log(`${LOG_PREFIX} 🔍 Found search input in menu! Switching focus.`);
            input = menuSearchInput;
            input.focus();
            await sleep(200); // Increased from 50ms
        }

        // Step 4: Type to filter options
        await typeToFilter(input, value);
        await sleep(1200); // Increased to 1.2s - Wait for options to load after fast typing

        // Step 5: ArrowDown to navigate (Crucial for React-Select)
        console.log(`${LOG_PREFIX} ⬇️ Pressing ArrowDown to highlight option`);
        dispatchKeyEvent(input, 'ArrowDown', 'ArrowDown');
        await sleep(300); // Wait for highlight

        // Step 6: Enter to commit
        let committed = await commitSelection(input);

        // Fallback: If Enter didn't close the menu, try Tab
        if (!committed) {
            console.warn(`${LOG_PREFIX} ⚠️ Enter failed, trying Tab...`);
            dispatchKeyEvent(input, 'Tab', 'Tab');
            await sleep(300);
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
            await sleep(100);
            if (verifySelection(element, value)) {
                console.log(`${LOG_PREFIX} ✅ Verified selection despite menu not closing cleanly`);
                return true;
            }

            console.warn(`${LOG_PREFIX} ❌ Failed to commit selection`);
            return false;
        }

        // Step 7: Strict verification
        await sleep(75); // Wait for state update
        const verified = verifySelection(element, value);

        if (verified) {
            console.log(`${LOG_PREFIX} ✅ Selection verified: ${value}`);
            // Force a bit more time for UI to settle and runner to not race ahead
            await sleep(500);
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
    const control = element.closest('.select__control');
    if (control) {
        input = control.querySelector<HTMLInputElement>('input');
        if (input) return input;
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
 * Open dropdown using keyboard (Space or Enter)
 * This is more reliable than clicking for React dropdowns
 */
async function openDropdownWithKeyboard(input: HTMLInputElement): Promise<boolean> {
    console.log(`${LOG_PREFIX} 🔓 Opening with keyboard...`);

    // Try Space key first (works for most dropdowns)
    dispatchKeyEvent(input, ' ', 'Space');
    await sleep(40);

    if (await isMenuOpen()) {
        console.log(`${LOG_PREFIX} ✅ Opened with Space`);
        return true;
    }

    // Try Enter key
    dispatchKeyEvent(input, 'Enter', 'Enter');
    await sleep(40);

    if (await isMenuOpen()) {
        console.log(`${LOG_PREFIX} ✅ Opened with Enter`);
        return true;
    }

    // Try ArrowDown (some dropdowns open on arrow)
    dispatchKeyEvent(input, 'ArrowDown', 'ArrowDown');
    await sleep(40);

    if (await isMenuOpen()) {
        console.log(`${LOG_PREFIX} ✅ Opened with ArrowDown`);
        return true;
    }

    console.warn(`${LOG_PREFIX} ⚠️ Keyboard open failed, trying click fallback`);
    // Fallback: click the control
    const control = input.closest('.select__control') || input.parentElement;
    if (control) {
        (control as HTMLElement).click();
        await sleep(40);
        return isMenuOpen();
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
        // Check if menu already exists
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

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        setTimeout(() => {
            observer.disconnect();
            resolve(!!getDropdownMenu());
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
        await sleep(20); // Fast typing
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

    // Method 1: Check .select__single-value (React-Select)
    const control = element.closest('.select__control');
    if (control) {
        const singleValue = control.querySelector('.select__single-value');
        if (singleValue) {
            const displayedText = singleValue.textContent?.trim().toLowerCase() || '';
            console.log(`${LOG_PREFIX} 🔍 Displayed value: "${displayedText}"`);

            if (displayedText.includes(expectedLower) || expectedLower.includes(displayedText)) {
                return true;
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

    // Method 3: Check input value
    const input = findDropdownInput(element);
    if (input && input.value) {
        const inputValue = input.value.trim().toLowerCase();
        if (inputValue.includes(expectedLower) || expectedLower.includes(inputValue)) {
            return true;
        }
    }

    // Method 4: Check if any visible text in container matches
    if (element.textContent?.toLowerCase().includes(expectedLower)) {
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

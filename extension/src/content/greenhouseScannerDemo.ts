/**
 * Greenhouse Scanning Demo
 * ========================
 * 
 * This script demonstrates that scanning Greenhouse applications via DOM is possible.
 * It identifies questions, field types, and options, then logs them to the console.
 */

export function scanGreenhouseApp() {
    const startTime = new Date();
    console.log(`%c [GreenhouseScanner] 🔍 Starting Greenhouse DOM Scan Demo at ${startTime.toLocaleTimeString()}...`, "color: #2e7d32; font-weight: bold;");

    const fields = document.querySelectorAll('.field, .form-field');

    if (fields.length === 0) {
        console.warn("[GreenhouseScanner] ⚠️ No elements with class '.field' or '.form-field' found. Are you on a Greenhouse application page?");
        return;
    }

    console.log(`[GreenhouseScanner] Found ${fields.length} potential question fields.`);

    fields.forEach((field, index) => {
        const labelEl = field.querySelector('label');
        if (!labelEl) return;

        // Clean label text (remove required * etc)
        const rawText = labelEl.textContent || "";
        const questionText = rawText.replace(/\s+/g, ' ').trim();

        // Find input/select/textarea
        const input = field.querySelector('input, select, textarea');
        if (!input) return;

        const fieldType = input.tagName.toLowerCase() === 'input'
            ? (input as HTMLInputElement).type
            : input.tagName.toLowerCase();

        const isRequired = input.hasAttribute('required') || rawText.includes('*');

        // Get options for selects
        let options: string[] = [];
        if (input.tagName.toLowerCase() === 'select') {
            options = Array.from((input as HTMLSelectElement).options)
                .map(opt => opt.text)
                .filter(text => text.trim() !== "");
        }

        // Log the field data
        console.group(`[GreenhouseScanner] Field #${index + 1}: ${questionText}`);
        console.log(`| Type: ${fieldType}`);
        console.log(`| Required: ${isRequired ? "YES" : "NO"}`);
        if (options.length > 0) {
            console.log(`| Options: [${options.join(', ')}]`);
        }
        console.log(`| Selector: ${generateBasicSelector(input as HTMLElement)}`);
        console.groupEnd();
    });

    const endTime = new Date();
    const durationMs = endTime.getTime() - startTime.getTime();
    console.log(`%c [GreenhouseScanner] ✅ Scan demo complete at ${endTime.toLocaleTimeString()} (Duration: ${durationMs}ms)`, "color: #2e7d32; font-weight: bold;");
}

function generateBasicSelector(el: HTMLElement): string {
    if (el.id) return `#${el.id}`;
    if (el.getAttribute('name')) return `${el.tagName.toLowerCase()}[name="${el.getAttribute('name')}"]`;
    return el.tagName.toLowerCase();
}

// Auto-run when the module is loaded (if on a greenhouse page)
if (window.location.hostname.includes("greenhouse.io")) {
    scanGreenhouseApp();
}

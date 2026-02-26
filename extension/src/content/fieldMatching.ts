// extension/src/content/fieldMatching.ts
/**
 * Field detection and matching by questionText similarity
 */

import { getQuestionText } from './utils/questionDetection';

const LOG_PREFIX = "[FieldMatching]";

export type Detected = {
    questionText: string;
    element: HTMLElement;
    kind: "TEXT" | "TEXTAREA" | "SELECT_NATIVE" | "DROPDOWN_CUSTOM" | "RADIO" | "CHECKBOX" | "DATE" | "FILE";
    name?: string;
    id?: string;
};

/**
 * Detect all fillable fields in current DOM
 */
export function detectFieldsInCurrentDOM(): Detected[] {
    const out: Detected[] = [];
    const handledGroups = new Set<string>(); // Track names or container hashes for grouped inputs

    // 1) Native inputs/textareas/selects
    const inputs = Array.from(document.querySelectorAll<HTMLElement>('input, textarea, select'));

    for (const el of inputs) {
        const tag = el.tagName.toLowerCase();
        const inputEl = el as HTMLInputElement;
        const type = inputEl.type?.toLowerCase?.() ?? "";

        // Skip hidden/invisible elements (except files)
        if (tag !== "input" || type !== "file") {
            if (!isVisible(el)) continue;
        }

        // --- GROUPING LOGIC FOR RADIOS/CHECKBOXES ---
        if (tag === "input" && (type === "radio" || type === "checkbox")) {
            const name = inputEl.name;
            const groupKey = name
                ? `${type}_name_${name}`
                : `${type}_container_${getContainerHash(el)}`;

            if (handledGroups.has(groupKey)) {
                // Already added this group via a previous sibling/anchor
                continue;
            }
            handledGroups.add(groupKey);

            out.push({
                questionText: getQuestionTextFor(el) ?? "",
                element: el,
                kind: type === "radio" ? "RADIO" : "CHECKBOX",
                id: el.id,
                name: name
            });
            continue;
        }

        // --- STANDARD FIELDS ---

        // File
        if (tag === "input" && type === "file") {
            out.push({
                questionText: getQuestionTextFor(el) ?? "",
                element: el,
                kind: "FILE",
                id: el.id,
                name: inputEl.name
            });
            continue;
        }

        // Date
        if (tag === "input" && type === "date") {
            out.push({
                questionText: getQuestionTextFor(el) ?? "",
                element: el,
                kind: "DATE",
                id: inputEl.id,
                name: inputEl.name
            });
            continue;
        }

        // Select native
        if (tag === "select") {
            out.push({
                questionText: getQuestionTextFor(el) ?? "",
                element: el,
                kind: "SELECT_NATIVE",
                id: (el as HTMLSelectElement).id,
                name: (el as HTMLSelectElement).name
            });
            continue;
        }

        // Textarea
        if (tag === "textarea") {
            out.push({
                questionText: getQuestionTextFor(el) ?? "",
                element: el,
                kind: "TEXTAREA",
                id: (el as HTMLTextAreaElement).id,
                name: (el as HTMLTextAreaElement).name
            });
            continue;
        }

        // Text-like input
        if (tag === "input") {
            out.push({
                questionText: getQuestionTextFor(el) ?? "",
                element: el,
                kind: "TEXT",
                id: inputEl.id,
                name: inputEl.name
            });
            continue;
        }
    }

    // 2) ARIA combobox/listbox (custom dropdowns)
    const comboCandidates = Array.from(document.querySelectorAll<HTMLElement>(
        '[role="combobox"], [aria-haspopup="listbox"], input[role="combobox"]'
    ));

    for (const el of comboCandidates) {
        if (!isVisible(el)) continue;
        // Avoid duplicating native inputs already captured
        const alreadyAdded = out.some(d => d.element === el);
        if (alreadyAdded) continue;

        out.push({
            questionText: getQuestionTextFor(el) ?? "",
            element: el,
            kind: "DROPDOWN_CUSTOM",
            id: (el as any).id,
            name: (el as any).name
        });
    }

    // Filter: keep only entries with question text
    const filtered = out.filter(x => (x.questionText ?? "").trim().length > 0);

    console.log(`${LOG_PREFIX} Detected ${filtered.length} fields:`, filtered.map(f => ({ text: f.questionText.substring(0, 30), kind: f.kind })));

    return filtered;
}

/**
 * Helper to get a semi-stable identifier for a container to group anonymous controls
 */
function getContainerHash(el: HTMLElement): string {
    const container = el.closest('fieldset, [role="group"], .field, .form-group') || el.parentElement;
    if (!container) return Math.random().toString(); // Fallback

    // Use a combination of class and index if possible
    const className = container.className || 'no-class';
    const index = Array.from(document.querySelectorAll(`.${className.split(' ')[0]}`)).indexOf(container);
    return `${className}_${index}`;
}

/**
 * Find best matching field by questionText similarity
 */
export function bestMatchField(fields: Detected[], qText: string, canonicalKey?: string): Detected | null {
    const qn = normalize(qText);

    let best: { f: Detected; score: number } | null = null;

    for (const f of fields) {
        const ft = normalize(f.questionText);
        const score = similarity(qn, ft);

        // Boost score if canonicalKey matches (future enhancement)
        // const keyBoost = canonicalKey && f.canonicalKey === canonicalKey ? 0.2 : 0;

        if (!best || score > best.score) {
            best = { f, score };
        }
    }

    // Threshold for match
    if (!best || best.score < 0.55) {
        console.warn(`${LOG_PREFIX} No match above threshold for: ${qText} (best score: ${best?.score})`);
        return null;
    }

    console.log(`${LOG_PREFIX} Matched "${qText}" → "${best.f.questionText}" (score: ${best.score.toFixed(2)})`);
    return best.f;
}

/**
 * Get question text for an element
 */
function getQuestionTextFor(el: HTMLElement): string | null {
    const text = getQuestionText(el);
    return text || null;
}

function getLabelFor(el: HTMLElement): HTMLLabelElement | null {
    const id = (el as any).id;
    if (id) {
        const l = document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(id)}"]`);
        if (l) return l;
    }
    return el.closest("label");
}

function isVisible(el: HTMLElement): boolean {
    const r = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return r.width > 0 && r.height > 0 && style.visibility !== "hidden" && style.display !== "none";
}

/**
 * Normalize text for comparison
 */
function normalize(s: string): string {
    return (s || "").toLowerCase().trim().replace(/\s+/g, " ").replace(/[*:?]/g, "");
}

/**
 * Calculate similarity between two strings
 * Uses Jaccard similarity on tokens + substring boost
 */
function similarity(a: string, b: string): number {
    if (!a || !b) return 0;
    if (a === b) return 1;
    if (a.includes(b) || b.includes(a)) return 0.9;

    const A = new Set(a.split(" ").filter(Boolean));
    const B = new Set(b.split(" ").filter(Boolean));
    const inter = new Set([...A].filter(x => B.has(x)));
    const union = new Set([...A, ...B]);

    return union.size ? inter.size / union.size : 0;
}

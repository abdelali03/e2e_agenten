"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractAomSnapshot = extractAomSnapshot;
exports.aomToPromptString = aomToPromptString;
const Logger_1 = require("./Logger");
const logger = new Logger_1.Logger("AomExtractor");
function countNodes(nodes) {
    return nodes.reduce((acc, n) => acc + 1 + countNodes(n.children ?? []), 0);
}
async function extractAomSnapshot(page) {
    const url = page.url();
    const title = await page.title();
    const nodes = await page.evaluate(() => {
        function cleanText(value) {
            if (value === null || value === undefined)
                return "";
            if (typeof value === "string") {
                return value.replace(/\s+/g, " ").trim();
            }
            if (typeof value === "number" || typeof value === "boolean") {
                return String(value).replace(/\s+/g, " ").trim();
            }
            return "";
        }
        function isVisible(el) {
            const htmlEl = el;
            const style = window.getComputedStyle(htmlEl);
            const rect = htmlEl.getBoundingClientRect();
            return (style.display !== "none" &&
                style.visibility !== "hidden" &&
                style.opacity !== "0" &&
                rect.width > 0 &&
                rect.height > 0);
        }
        function getLabelByFor(el) {
            const input = el;
            if (!input.id)
                return "";
            const label = document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
            return cleanText(label?.textContent);
        }
        function getParentLabel(el) {
            const label = el.closest("label");
            return cleanText(label?.textContent);
        }
        function getAriaLabelledBy(el) {
            const labelledBy = el.getAttribute("aria-labelledby");
            if (!labelledBy)
                return "";
            return labelledBy
                .split(/\s+/)
                .map((id) => cleanText(document.getElementById(id)?.textContent))
                .filter(Boolean)
                .join(" ");
        }
        function getMuiLikeLabel(el) {
            const parent = el.closest(".MuiFormControl-root") ||
                el.closest(".MuiTextField-root") ||
                el.closest(".MuiInputBase-root")?.parentElement ||
                el.parentElement;
            if (!parent)
                return "";
            const label = parent.querySelector("label") ||
                parent.querySelector(".MuiFormLabel-root") ||
                parent.querySelector(".MuiInputLabel-root");
            return cleanText(label?.textContent);
        }
        function getNearbyText(el) {
            const parent = el.parentElement;
            if (!parent)
                return "";
            const clone = parent.cloneNode(true);
            clone.querySelectorAll("input, textarea, select, button, a, svg").forEach((n) => n.remove());
            return cleanText(clone.textContent).slice(0, 120);
        }
        function getRole(el) {
            const explicitRole = el.getAttribute("role");
            if (explicitRole)
                return explicitRole;
            const tagName = el.tagName.toLowerCase();
            if (tagName === "a")
                return "link";
            if (tagName === "button")
                return "button";
            if (tagName === "textarea")
                return "textbox";
            if (tagName === "select")
                return "combobox";
            if (tagName === "input") {
                const input = el;
                const type = (input.type || "text").toLowerCase();
                if (type === "checkbox")
                    return "checkbox";
                if (type === "radio")
                    return "radio";
                if (type === "range")
                    return "slider";
                if (type === "number")
                    return "spinbutton";
                if (type === "search")
                    return "searchbox";
                if (type === "submit" || type === "button" || type === "reset") {
                    return "button";
                }
                return "textbox";
            }
            return tagName;
        }
        function getBestName(el) {
            const htmlEl = el;
            const inputEl = el;
            const ariaLabel = cleanText(el.getAttribute("aria-label"));
            const ariaLabelledBy = getAriaLabelledBy(el);
            const labelByFor = getLabelByFor(el);
            const parentLabel = getParentLabel(el);
            const muiLabel = getMuiLikeLabel(el);
            const placeholder = cleanText(el.getAttribute("placeholder"));
            const title = cleanText(el.getAttribute("title"));
            const text = cleanText(htmlEl.innerText || el.textContent);
            const nameAttr = cleanText(el.getAttribute("name"));
            const id = cleanText(el.getAttribute("id"));
            const value = cleanText("value" in inputEl ? inputEl.value : "");
            const label = ariaLabel ||
                ariaLabelledBy ||
                labelByFor ||
                parentLabel ||
                muiLabel ||
                placeholder ||
                title ||
                text ||
                nameAttr ||
                id ||
                value;
            return {
                name: label,
                label: label || undefined,
                placeholder: placeholder || undefined,
                text: text || undefined,
            };
        }
        function getDescription(el) {
            const describedBy = el.getAttribute("aria-describedby");
            if (!describedBy)
                return undefined;
            const description = describedBy
                .split(/\s+/)
                .map((id) => cleanText(document.getElementById(id)?.textContent))
                .filter(Boolean)
                .join(" ");
            return description || undefined;
        }
        const selector = [
            "button",
            "a[href]",
            "input:not([type='hidden'])",
            "textarea",
            "select",
            "[role]",
            "[aria-label]",
            "[aria-labelledby]",
            "[placeholder]",
            "[contenteditable='true']",
        ].join(",");
        const elements = Array.from(document.querySelectorAll(selector)).filter((el) => {
            const tagName = el.tagName.toLowerCase();
            if (tagName === "input") {
                const type = (el.type || "").toLowerCase();
                if (type === "hidden")
                    return false;
            }
            return isVisible(el);
        });
        return elements.map((el, index) => {
            const htmlEl = el;
            const inputEl = el;
            const tagName = el.tagName.toLowerCase();
            const inputType = tagName === "input" ? (inputEl.type || "text").toLowerCase() : undefined;
            const uid = `ai_el_${String(index + 1).padStart(4, "0")}`;
            htmlEl.setAttribute("data-ai-uid", uid);
            const bestName = getBestName(el);
            const role = getRole(el);
            const disabled = "disabled" in inputEl
                ? Boolean(inputEl.disabled)
                : el.getAttribute("aria-disabled") === "true";
            const required = "required" in inputEl
                ? Boolean(inputEl.required)
                : el.getAttribute("aria-required") === "true";
            const checked = "checked" in inputEl
                ? Boolean(inputEl.checked)
                : undefined;
            const expanded = el.getAttribute("aria-expanded") !== null
                ? el.getAttribute("aria-expanded") === "true"
                : undefined;
            return {
                uid,
                selector: `[data-ai-uid="${uid}"]`,
                domIndex: index,
                tagName,
                inputType,
                role,
                name: bestName.name,
                label: bestName.label,
                value: "value" in inputEl ? inputEl.value : undefined,
                placeholder: bestName.placeholder,
                description: getDescription(el),
                disabled,
                checked,
                expanded,
                required,
                visible: true,
                text: bestName.text,
                id: el.getAttribute("id") || undefined,
                className: typeof htmlEl.className === "string" && htmlEl.className
                    ? htmlEl.className
                    : undefined,
                nameAttr: el.getAttribute("name") || undefined,
                children: [],
            };
        });
    });
    const filteredCount = countNodes(nodes);
    logger.debug(`DOM snapshot: ${nodes.length} executable elements -> ${filteredCount} nodes`, {
        url,
    });
    return {
        url,
        title,
        timestamp: new Date().toISOString(),
        nodes: nodes,
        rawNodeCount: nodes.length,
        filteredNodeCount: filteredCount,
    };
}
function aomToPromptString(snapshot) {
    const header = [
        `URL: ${snapshot.url}`,
        `Title: ${snapshot.title}`,
        `Timestamp: ${snapshot.timestamp}`,
        `Nodes: ${snapshot.filteredNodeCount}`,
        "",
    ].join("\n");
    const tree = JSON.stringify(snapshot.nodes, null, 2);
    return `${header}=== ACCESSIBLE UI ELEMENTS ===\n${tree}`;
}

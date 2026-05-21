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
    const accessibility = await extractAccessibilitySnapshot(page);
    const pageData = await page.evaluate(() => {
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
        function attr(el, name) {
            return cleanText(el.getAttribute(name));
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
        function getReferencedText(idList) {
            if (!idList)
                return "";
            return idList
                .split(/\s+/)
                .map((id) => cleanText(document.getElementById(id)?.textContent))
                .filter(Boolean)
                .join(" ");
        }
        function getAriaLabelledBy(el) {
            const labelledBy = el.getAttribute("aria-labelledby");
            if (!labelledBy)
                return "";
            return getReferencedText(labelledBy);
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
        function getAncestorText(el) {
            const candidates = [
                el.closest("[role='dialog']"),
                el.closest("[role='row']"),
                el.closest("tr"),
                el.closest("form"),
                el.closest("fieldset"),
                el.closest("section"),
                el.closest("article"),
                el.closest("[class*='MuiFormControl-root']"),
                el.closest("[class*='MuiTextField-root']"),
                el.closest("[class*='mat-form-field']"),
                el.closest("[class*='ng-select']"),
                el.parentElement?.parentElement,
            ].filter((candidate) => Boolean(candidate));
            const ancestor = candidates[0];
            if (!ancestor)
                return "";
            const clone = ancestor.cloneNode(true);
            clone
                .querySelectorAll("script, style, svg, path")
                .forEach((node) => node.remove());
            return cleanText(clone.textContent).slice(0, 240);
        }
        function getNearestHeading(el) {
            const headingSelector = "h1,h2,h3,h4,h5,h6,[role='heading']";
            const container = el.closest("[role='dialog']") ||
                el.closest("form") ||
                el.closest("section") ||
                el.closest("main") ||
                document.body;
            const headings = Array.from(container.querySelectorAll(headingSelector));
            if (headings.length === 0)
                return "";
            const elementRect = el.getBoundingClientRect();
            let bestHeading = "";
            let bestDistance = Number.POSITIVE_INFINITY;
            for (const heading of headings) {
                const text = cleanText(heading.textContent);
                if (!text)
                    continue;
                const rect = heading.getBoundingClientRect();
                const distance = Math.abs(elementRect.top - rect.bottom) +
                    Math.abs(elementRect.left - rect.left);
                if (rect.top <= elementRect.top + 20 && distance < bestDistance) {
                    bestDistance = distance;
                    bestHeading = text;
                }
            }
            return bestHeading.slice(0, 120);
        }
        function getFormText(el) {
            const form = el.closest("form") ||
                el.closest("[role='form']") ||
                el.closest("fieldset") ||
                el.closest("[class*='MuiFormControl-root']") ||
                el.closest("[class*='mat-form-field']");
            if (!form)
                return "";
            const clone = form.cloneNode(true);
            clone
                .querySelectorAll("input, textarea, select, button, a, svg, path")
                .forEach((node) => node.remove());
            return cleanText(clone.textContent).slice(0, 200);
        }
        function getComponentHints(el) {
            const hints = new Set();
            let current = el;
            let depth = 0;
            while (current && depth < 5) {
                const className = typeof current.className === "string"
                    ? current.className
                    : "";
                const tagName = current.tagName.toLowerCase();
                if (className.includes("Mui"))
                    hints.add("mui");
                if (className.includes("MuiAutocomplete"))
                    hints.add("mui-autocomplete");
                if (className.includes("MuiSelect"))
                    hints.add("mui-select");
                if (className.includes("MuiTextField"))
                    hints.add("mui-textfield");
                if (className.includes("MuiInputBase"))
                    hints.add("mui-input");
                if (className.includes("MuiButton"))
                    hints.add("mui-button");
                if (className.includes("MuiPickers") || className.includes("MuiDate")) {
                    hints.add("mui-picker");
                }
                if (className.includes("MuiDataGrid"))
                    hints.add("mui-datagrid");
                if (className.includes("MuiDialog") || current.getAttribute("role") === "dialog") {
                    hints.add("dialog");
                }
                if (className.includes("mat-"))
                    hints.add("angular-material");
                if (className.includes("mat-select"))
                    hints.add("mat-select");
                if (className.includes("mat-form-field"))
                    hints.add("mat-form-field");
                if (className.includes("ng-") || current.hasAttribute("ng-reflect-name")) {
                    hints.add("angular");
                }
                if (className.includes("react-select"))
                    hints.add("react-select");
                if (className.includes("ant-"))
                    hints.add("ant-design");
                if (className.includes("ant-picker"))
                    hints.add("ant-picker");
                if (className.includes("ant-select"))
                    hints.add("ant-select");
                if (className.includes("chakra-"))
                    hints.add("chakra-ui");
                if (className.includes("v-") || current.hasAttribute("data-v-app"))
                    hints.add("vue");
                if (className.includes("svelte-"))
                    hints.add("svelte");
                if (className.includes("select") && tagName !== "select")
                    hints.add("custom-select");
                if (className.includes("datepicker") || className.includes("date-picker")) {
                    hints.add("date-picker");
                }
                if (className.includes("timepicker") || className.includes("time-picker")) {
                    hints.add("time-picker");
                }
                if (tagName === "table" || current.getAttribute("role") === "table")
                    hints.add("table");
                if (current.getAttribute("role") === "grid")
                    hints.add("grid");
                if (current.getAttribute("role") === "menu")
                    hints.add("menu");
                if (current.getAttribute("role") === "listbox")
                    hints.add("listbox");
                if (current.getAttribute("role") === "option")
                    hints.add("option");
                if (current.getAttribute("role") === "tablist")
                    hints.add("tabs");
                if (current.getAttribute("role") === "alert")
                    hints.add("alert");
                if (current.getAttribute("aria-live"))
                    hints.add("live-region");
                if (current.hasAttribute("contenteditable"))
                    hints.add("rich-text");
                current = current.parentElement;
                depth += 1;
            }
            return Array.from(hints);
        }
        function getComponentContext(el) {
            const parts = [];
            let current = el;
            let depth = 0;
            while (current && depth < 4) {
                const htmlEl = current;
                const tag = current.tagName.toLowerCase();
                const role = attr(current, "role");
                const id = attr(current, "id");
                const className = typeof htmlEl.className === "string"
                    ? cleanText(htmlEl.className).slice(0, 90)
                    : "";
                const segment = [
                    tag,
                    role ? `role=${role}` : "",
                    id ? `id=${id}` : "",
                    className ? `class=${className}` : "",
                ]
                    .filter(Boolean)
                    .join(" ");
                if (segment)
                    parts.push(segment);
                current = current.parentElement;
                depth += 1;
            }
            return parts.join(" <- ").slice(0, 360);
        }
        function getOptions(el) {
            if (el.tagName.toLowerCase() !== "select")
                return undefined;
            const select = el;
            const options = Array.from(select.options)
                .map((option) => cleanText(option.label || option.textContent || option.value))
                .filter(Boolean);
            return options.length > 0 ? options.slice(0, 30) : undefined;
        }
        function getBounds(el) {
            const rect = el.getBoundingClientRect();
            const centerX = Math.round(rect.x + rect.width / 2);
            const centerY = Math.round(rect.y + rect.height / 2);
            return {
                x: Math.round(rect.x),
                y: Math.round(rect.y),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
                centerX,
                centerY,
                inViewport: rect.bottom >= 0 &&
                    rect.right >= 0 &&
                    rect.top <= window.innerHeight &&
                    rect.left <= window.innerWidth,
            };
        }
        function getLayoutText(selector, limit) {
            return Array.from(document.querySelectorAll(selector))
                .filter((el) => isVisible(el))
                .map((el) => cleanText(el.textContent || el.getAttribute("aria-label")))
                .filter(Boolean)
                .slice(0, limit);
        }
        function getLayoutHints() {
            return {
                dialogs: getLayoutText("[role='dialog'],dialog,[aria-modal='true']", 8),
                headings: getLayoutText("h1,h2,h3,h4,h5,h6,[role='heading']", 20),
                forms: getLayoutText("form,[role='form'],fieldset", 10).map((text) => text.slice(0, 180)),
                tables: getLayoutText("table,[role='table'],[role='grid']", 10).map((text) => text.slice(0, 180)),
                navigation: getLayoutText("nav,[role='navigation'],[role='menubar']", 10),
            };
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
            const testId = attr(el, "data-testid") ||
                attr(el, "data-test") ||
                attr(el, "data-cy") ||
                attr(el, "data-qa");
            const nearbyText = getNearbyText(el);
            const ancestorText = getAncestorText(el);
            const nearestHeading = getNearestHeading(el);
            const label = ariaLabel ||
                ariaLabelledBy ||
                labelByFor ||
                parentLabel ||
                muiLabel ||
                placeholder ||
                title ||
                text ||
                testId ||
                nearbyText ||
                nearestHeading ||
                ancestorText ||
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
            const description = getReferencedText(el.getAttribute("aria-describedby"));
            return description || undefined;
        }
        const selector = [
            "button",
            "a[href]",
            "input:not([type='hidden'])",
            "textarea",
            "select",
            "tr",
            "td",
            "th",
            "[role]",
            "[role='row']",
            "[role='cell']",
            "[role='gridcell']",
            "[aria-label]",
            "[aria-labelledby]",
            "[placeholder]",
            "[contenteditable='true']",
            "[contenteditable='']",
            "[tabindex]:not([tabindex='-1'])",
            "[data-testid]",
            "[data-test]",
            "[data-cy]",
            "[data-qa]",
            "summary",
        ].join(",");
        const elements = Array.from(document.querySelectorAll(selector)).filter((el) => {
            const tagName = el.tagName.toLowerCase();
            if (tagName === "input") {
                const type = (el.type || "").toLowerCase();
                if (type === "hidden")
                    return false;
            }
            if (!isVisible(el))
                return false;
            if (tagName === "td" || tagName === "th") {
                return cleanText(el.textContent).length > 0;
            }
            if (tagName === "tr" || el.getAttribute("role") === "row") {
                return cleanText(el.textContent).length > 0;
            }
            return true;
        });
        const nodes = elements.map((el, index) => {
            const htmlEl = el;
            const inputEl = el;
            const tagName = el.tagName.toLowerCase();
            const inputType = tagName === "input" ? (inputEl.type || "text").toLowerCase() : undefined;
            const uid = `ai_el_${String(index + 1).padStart(4, "0")}`;
            htmlEl.setAttribute("data-ai-uid", uid);
            const bestName = getBestName(el);
            const role = getRole(el);
            const ariaDescribedBy = attr(el, "aria-describedby");
            const ariaLabelledBy = attr(el, "aria-labelledby");
            const componentHints = getComponentHints(el);
            const rect = getBounds(el);
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
                title: attr(el, "title") || undefined,
                ariaLabel: attr(el, "aria-label") || undefined,
                ariaLabelledBy: ariaLabelledBy || undefined,
                ariaLabelledByText: getReferencedText(ariaLabelledBy) || undefined,
                ariaDescribedBy: ariaDescribedBy || undefined,
                ariaDescribedByText: getReferencedText(ariaDescribedBy) || undefined,
                testId: attr(el, "data-testid") ||
                    attr(el, "data-test") ||
                    attr(el, "data-cy") ||
                    attr(el, "data-qa") ||
                    undefined,
                dataTestId: attr(el, "data-testid") || undefined,
                dataTest: attr(el, "data-test") || undefined,
                dataCy: attr(el, "data-cy") || undefined,
                dataQa: attr(el, "data-qa") || undefined,
                autoComplete: attr(el, "autocomplete") || undefined,
                href: attr(el, "href") || undefined,
                nearestHeading: getNearestHeading(el) || undefined,
                nearbyText: getNearbyText(el) || undefined,
                ancestorText: getAncestorText(el) || undefined,
                formText: getFormText(el) || undefined,
                componentContext: getComponentContext(el) || undefined,
                componentHints: componentHints.length > 0 ? componentHints : undefined,
                options: getOptions(el),
                bounds: rect,
                children: [],
            };
        });
        const activeElement = document.activeElement;
        const activeElementUid = activeElement?.getAttribute("data-ai-uid") || undefined;
        const layoutHints = {
            ...getLayoutHints(),
            activeElementUid,
        };
        return {
            visibleText: cleanText(document.body.innerText).slice(0, 5000),
            viewport: {
                width: window.innerWidth,
                height: window.innerHeight,
                scrollX: Math.round(window.scrollX),
                scrollY: Math.round(window.scrollY),
            },
            layoutHints,
            nodes,
        };
    });
    const nodes = pageData.nodes;
    const filteredCount = countNodes(nodes);
    logger.debug(`DOM snapshot: ${nodes.length} executable elements -> ${filteredCount} nodes`, {
        url,
    });
    return {
        url,
        title,
        timestamp: new Date().toISOString(),
        visibleText: pageData.visibleText,
        viewport: pageData.viewport,
        accessibility,
        layoutHints: pageData.layoutHints,
        nodes,
        rawNodeCount: nodes.length,
        filteredNodeCount: filteredCount,
    };
}
async function extractAccessibilitySnapshot(page) {
    try {
        const ariaSnapshot = page.ariaSnapshot;
        if (!ariaSnapshot) {
            return {
                available: false,
                source: "unavailable",
                error: "page.ariaSnapshot() is not available in this Playwright version.",
            };
        }
        const snapshot = await ariaSnapshot.call(page, {
            mode: "ai",
            timeout: 2_000,
        });
        return {
            available: true,
            source: "playwright-aria-snapshot",
            snapshot: snapshot.slice(0, 12_000),
        };
    }
    catch (error) {
        return {
            available: false,
            source: "unavailable",
            error: error instanceof Error ? error.message : String(error),
        };
    }
}
function aomToPromptString(snapshot) {
    const header = [
        `URL: ${snapshot.url}`,
        `Title: ${snapshot.title}`,
        `Timestamp: ${snapshot.timestamp}`,
        `Nodes: ${snapshot.filteredNodeCount}`,
        `Viewport: ${snapshot.viewport.width}x${snapshot.viewport.height} scroll=(${snapshot.viewport.scrollX},${snapshot.viewport.scrollY})`,
        `Visible text excerpt: ${snapshot.visibleText.slice(0, 2500)}`,
        "",
        `=== LAYOUT HINTS ===`,
        JSON.stringify(snapshot.layoutHints, null, 2),
        "",
        `=== PLAYWRIGHT ARIA SNAPSHOT (${snapshot.accessibility.available ? "available" : "unavailable"}) ===`,
        snapshot.accessibility.snapshot ||
            snapshot.accessibility.error ||
            "No accessibility snapshot available.",
        "",
    ].join("\n");
    const tree = JSON.stringify(snapshot.nodes, null, 2);
    return `${header}=== ACCESSIBLE UI ELEMENTS ===\n${tree}`;
}

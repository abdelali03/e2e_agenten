"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnhancedMcpSnapshotTool = void 0;
const Logger_1 = require("./Logger");
const logger = new Logger_1.Logger("EnhancedMcpSnapshotTool");
class EnhancedMcpSnapshotTool {
    async capture(mcp, args = {}) {
        const snapshotArgs = {
            ...args,
            boxes: true,
        };
        const snapshot = await mcp.callTool("browser_snapshot", snapshotArgs);
        const context = await this.extractUiContext(mcp);
        return {
            text: this.buildEnhancedText(snapshot.text, context.context, context.error),
            rawSnapshotText: snapshot.text,
            context: context.context,
            contextError: context.error,
            isError: snapshot.isError,
        };
    }
    async extractUiContext(mcp) {
        try {
            const result = await mcp.callTool("browser_run_code_unsafe", {
                code: this.getExtractionCode(),
            });
            if (result.isError) {
                return { error: result.text || "browser_run_code_unsafe failed." };
            }
            const context = this.parseContext(result.text);
            if (!context) {
                return { error: "Could not parse enhanced UI context from MCP result." };
            }
            return { context };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.warn("Enhanced UI context extraction failed:", message);
            return { error: message };
        }
    }
    parseContext(text) {
        const trimmed = text.trim();
        const candidates = [
            trimmed,
            this.extractFirstJsonObject(trimmed),
            this.extractJsonStringLiteral(trimmed),
        ].filter((candidate) => Boolean(candidate));
        for (const candidate of candidates) {
            try {
                const parsed = JSON.parse(candidate);
                if (parsed && typeof parsed === "object" && parsed.url && parsed.viewport) {
                    return parsed;
                }
            }
            catch {
                // Try the next candidate.
            }
        }
        return undefined;
    }
    extractFirstJsonObject(text) {
        const start = text.indexOf("{");
        if (start < 0)
            return undefined;
        let depth = 0;
        let inString = false;
        let escaped = false;
        for (let index = start; index < text.length; index += 1) {
            const char = text[index];
            if (escaped) {
                escaped = false;
                continue;
            }
            if (char === "\\") {
                escaped = true;
                continue;
            }
            if (char === "\"") {
                inString = !inString;
                continue;
            }
            if (inString)
                continue;
            if (char === "{")
                depth += 1;
            if (char === "}") {
                depth -= 1;
                if (depth === 0)
                    return text.slice(start, index + 1);
            }
        }
        return undefined;
    }
    extractJsonStringLiteral(text) {
        try {
            const parsed = JSON.parse(text);
            return typeof parsed === "string" ? parsed : undefined;
        }
        catch {
            return undefined;
        }
    }
    buildEnhancedText(snapshotText, context, contextError) {
        const sections = [
            "=== MCP ACCESSIBILITY SNAPSHOT WITH BOXES ===",
            snapshotText.slice(0, 36_000),
            "",
            "=== ENHANCED UI CONTEXT ===",
        ];
        if (context) {
            sections.push("", "=== UI ACTIVE SURFACE SUMMARY ===", JSON.stringify(this.buildSurfaceSummary(context), null, 2));
            logger.info("Enhanced UI context summary", {
                dialogs: context.dialogs.length,
                overlays: context.overlays.length,
                fields: context.fields.length,
                interactiveElements: context.interactiveElements.length,
                menusAndPopups: context.menusAndPopups.length,
                errorsAndAlerts: context.errorsAndAlerts.length,
                componentHints: context.componentHints.slice(0, 8),
            });
            sections.push("", "=== FULL ENHANCED UI CONTEXT ===", JSON.stringify(context, null, 2).slice(0, 18_000));
        }
        else {
            sections.push(JSON.stringify({
                available: false,
                error: contextError || "Enhanced UI context unavailable.",
            }, null, 2));
        }
        sections.push("", "=== USAGE NOTES ===", "- Use MCP refs from the accessibility snapshot for browser_click, browser_fill_form, browser_type, and related actions.", "- Use enhanced UI context to understand visible text, layout, dialogs, overlays, active/focused elements, validation errors, forms, custom widgets, and accessibility gaps.", "- If enhanced context shows visible UI that the MCP snapshot does not expose as refs, do not invent refs. Prefer waiting, keyboard navigation, a fresh snapshot, or another accessible path.");
        return sections.join("\n").slice(0, 60_000);
    }
    buildSurfaceSummary(context) {
        const activeSurfaces = [
            ...context.dialogs.map((item) => ({ kind: "dialog", ...item })),
            ...context.overlays.map((item) => ({ kind: "overlay", ...item })),
            ...context.menusAndPopups.map((item) => ({ kind: "menuOrPopup", ...item })),
        ].slice(0, 12);
        return {
            url: context.url,
            title: context.title,
            activeElement: context.activeElement,
            activeSurfaces,
            fields: context.fields.slice(0, 18),
            primaryControls: context.interactiveElements.slice(0, 24),
            errorsAndAlerts: context.errorsAndAlerts.slice(0, 10),
            tablesAndLists: context.tablesAndLists.slice(0, 8),
            componentHints: context.componentHints,
            accessibilityWarnings: context.accessibilityWarnings,
            note: "This summary is perception only. Use MCP refs from the accessibility snapshot for execution; if an active surface exists, interact inside it before background controls.",
        };
    }
    getExtractionCode() {
        return `async (page) => {
  return await page.evaluate(() => {
    const MAX_TEXT = 5000;

    function clean(value) {
      if (value === null || value === undefined) return "";
      return String(value).replace(/\\s+/g, " ").trim();
    }

    function attr(el, name) {
      return clean(el.getAttribute(name));
    }

    function isVisible(el) {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.opacity !== "0" &&
        rect.width > 0 &&
        rect.height > 0
      );
    }

    function bounds(el) {
      const rect = el.getBoundingClientRect();
      return {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    }

    function positionFromBounds(rect) {
      const centerX = rect.x + rect.width / 2;
      const centerY = rect.y + rect.height / 2;
      const horizontal =
        centerX < window.innerWidth * 0.33
          ? "left"
          : centerX > window.innerWidth * 0.66
          ? "right"
          : "center";
      const vertical =
        centerY < window.innerHeight * 0.33
          ? "top"
          : centerY > window.innerHeight * 0.66
          ? "bottom"
          : "middle";
      return vertical === "middle" && horizontal === "center"
        ? "center"
        : vertical + " " + horizontal;
    }

    function labelFor(el) {
      const aria = attr(el, "aria-label");
      if (aria) return aria;

      const labelledBy = attr(el, "aria-labelledby");
      if (labelledBy) {
        const text = labelledBy
          .split(/\\s+/)
          .map((id) => clean(document.getElementById(id)?.textContent))
          .filter(Boolean)
          .join(" ");
        if (text) return text;
      }

      if (el.id) {
        const label = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
        const text = clean(label?.textContent);
        if (text) return text;
      }

      const parentLabel = clean(el.closest("label")?.textContent);
      if (parentLabel) return parentLabel;

      const formControl = el.closest(".MuiFormControl-root,.MuiTextField-root,.mat-form-field,.ant-form-item");
      const visibleLabel = clean(formControl?.querySelector("label,.MuiFormLabel-root,.MuiInputLabel-root,.ant-form-item-label")?.textContent);
      if (visibleLabel) return visibleLabel;

      return "";
    }

    function componentHints(el) {
      const hints = new Set();
      let current = el;
      let depth = 0;

      while (current && depth < 5) {
        const cls = typeof current.className === "string" ? current.className : "";
        const role = attr(current, "role");
        const tag = current.tagName.toLowerCase();

        if (role) hints.add("role:" + role);
        if (tag === "dialog" || role === "dialog" || attr(current, "aria-modal") === "true") hints.add("dialog");
        if (role === "alert" || attr(current, "aria-live")) hints.add("alert-live-region");
        if (role === "menu" || role === "menubar") hints.add("menu");
        if (role === "listbox" || role === "option") hints.add("select-popup");
        if (role === "grid" || role === "table" || tag === "table") hints.add("table-or-grid");
        if (role === "tablist" || role === "tab") hints.add("tabs");
        if (cls.includes("Mui")) hints.add("mui");
        if (cls.includes("MuiDialog")) hints.add("mui-dialog");
        if (cls.includes("MuiPopover") || cls.includes("MuiPopper")) hints.add("mui-popover");
        if (cls.includes("MuiPickers") || cls.includes("MuiDate") || cls.includes("datepicker") || cls.includes("date-picker")) hints.add("date-picker");
        if (cls.includes("timepicker") || cls.includes("time-picker")) hints.add("time-picker");
        if (cls.includes("MuiAutocomplete") || cls.includes("react-select") || cls.includes("select")) hints.add("custom-select");
        if (cls.includes("modal") || cls.includes("dialog") || cls.includes("overlay") || cls.includes("backdrop")) hints.add("overlay-or-modal");
        if (cls.includes("toast") || cls.includes("snackbar") || cls.includes("alert") || cls.includes("error")) hints.add("message-or-error");
        if (current.hasAttribute("contenteditable")) hints.add("rich-text-editor");

        current = current.parentElement;
        depth += 1;
      }

      return Array.from(hints).slice(0, 8);
    }

    function summary(el) {
      const html = el;
      const input = el;
      const rect = bounds(el);
      const style = window.getComputedStyle(el);
      const tagName = el.tagName.toLowerCase();
      const role = attr(el, "role") || undefined;
      const text = clean(html.innerText || el.textContent).slice(0, 500) || undefined;
      const value = "value" in input ? clean(input.value).slice(0, 200) : undefined;

      return {
        tagName,
        role,
        type: tagName === "input" ? clean(input.type || "text") : undefined,
        text,
        label: labelFor(el) || undefined,
        placeholder: attr(el, "placeholder") || undefined,
        value,
        ariaLabel: attr(el, "aria-label") || undefined,
        ariaModal: attr(el, "aria-modal") || undefined,
        ariaHidden: attr(el, "aria-hidden") || undefined,
        inert: el.hasAttribute("inert"),
        disabled: Boolean(input.disabled) || attr(el, "aria-disabled") === "true",
        required: Boolean(input.required) || attr(el, "aria-required") === "true",
        checked: "checked" in input ? Boolean(input.checked) : undefined,
        expanded: attr(el, "aria-expanded") || undefined,
        selected: attr(el, "aria-selected") === "true" || undefined,
        componentHints: componentHints(el),
        position: positionFromBounds(rect),
        bounds: rect,
        visible: isVisible(el),
        zIndex: style.zIndex && style.zIndex !== "auto" ? style.zIndex : undefined,
      };
    }

    function visibleList(selector, limit) {
      return Array.from(document.querySelectorAll(selector))
        .filter((el) => isVisible(el))
        .slice(0, limit)
        .map(summary);
    }

    function looksOverlay(el) {
      if (!isVisible(el)) return false;
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const cls = typeof el.className === "string" ? el.className.toLowerCase() : "";
      const id = (el.id || "").toLowerCase();
      const role = attr(el, "role");
      const fixedOrAbsolute = style.position === "fixed" || style.position === "absolute" || style.position === "sticky";
      const largeLayer = rect.width >= window.innerWidth * 0.35 && rect.height >= window.innerHeight * 0.2;
      const modalName = /modal|dialog|overlay|backdrop|drawer|popover|popper|portal/.test(cls + " " + id);
      return fixedOrAbsolute && (largeLayer || modalName || role === "dialog" || attr(el, "aria-modal") === "true");
    }

    function accessibilityWarnings() {
      const warnings = [];
      const visibleDialogLike = Array.from(document.querySelectorAll("dialog,[role='dialog'],[aria-modal='true'],[class*='Dialog'],[class*='dialog'],[class*='modal'],[class*='Modal']"))
        .filter((el) => isVisible(el));

      for (const el of visibleDialogLike.slice(0, 6)) {
        if (!attr(el, "role") && el.tagName.toLowerCase() !== "dialog") {
          warnings.push("Visible dialog-like component has no role=dialog.");
        }
        if (attr(el, "aria-modal") !== "true" && el.tagName.toLowerCase() !== "dialog") {
          warnings.push("Visible dialog-like component has no aria-modal=true.");
        }
      }

      const active = document.activeElement;
      if (active && active !== document.body && active.closest("[aria-hidden='true'],[inert]")) {
        warnings.push("Focused element is inside aria-hidden or inert subtree.");
      }

      return Array.from(new Set(warnings)).slice(0, 10);
    }

    const fieldSelector = "input:not([type='hidden']),textarea,select,[contenteditable='true'],[contenteditable=''],[role='textbox'],[role='combobox'],[role='searchbox'],[role='spinbutton']";
    const interactiveSelector = "button,a[href],input:not([type='hidden']),textarea,select,[role='button'],[role='link'],[role='checkbox'],[role='radio'],[role='tab'],[role='menuitem'],[role='option'],[role='switch'],[tabindex]:not([tabindex='-1']),summary";
    const errorSelector = "[role='alert'],[aria-live],.error,.Error,.invalid,.Invalid,.alert,.Alert,.toast,.Toast,.snackbar,.Snackbar,[class*='error'],[class*='Error'],[class*='invalid'],[class*='Invalid']";
    const menuSelector = "[role='menu'],[role='menubar'],[role='listbox'],[role='tree'],[role='tooltip'],[class*='Menu'],[class*='menu'],[class*='Popover'],[class*='popover'],[class*='Popper'],[class*='popper']";
    const tableSelector = "table,[role='table'],[role='grid'],[role='list'],[class*='DataGrid'],[class*='Table'],[class*='table']";

    const overlays = Array.from(document.querySelectorAll("body *"))
      .filter(looksOverlay)
      .sort((a, b) => {
        const az = Number.parseInt(window.getComputedStyle(a).zIndex || "0", 10) || 0;
        const bz = Number.parseInt(window.getComputedStyle(b).zIndex || "0", 10) || 0;
        return bz - az;
      })
      .slice(0, 10)
      .map(summary);

    const allHints = new Set();
    [
      ...visibleList("[role='dialog'],dialog,[aria-modal='true']", 10),
      ...overlays,
      ...visibleList(fieldSelector, 30),
      ...visibleList(interactiveSelector, 40),
      ...visibleList(menuSelector, 15),
      ...visibleList(tableSelector, 10),
    ].forEach((item) => (item.componentHints || []).forEach((hint) => allHints.add(hint)));

    const active = document.activeElement && document.activeElement !== document.body
      ? summary(document.activeElement)
      : undefined;

    const context = {
      url: window.location.href,
      title: document.title,
      timestamp: new Date().toISOString(),
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        scrollX: Math.round(window.scrollX),
        scrollY: Math.round(window.scrollY),
      },
      activeElement: active,
      visibleText: clean(document.body.innerText).slice(0, MAX_TEXT),
      dialogs: visibleList("[role='dialog'],dialog,[aria-modal='true']", 10),
      overlays,
      forms: visibleList("form,[role='form'],fieldset", 12),
      fields: visibleList(fieldSelector, 35),
      interactiveElements: visibleList(interactiveSelector, 50),
      errorsAndAlerts: visibleList(errorSelector, 20),
      menusAndPopups: visibleList(menuSelector, 20),
      tablesAndLists: visibleList(tableSelector, 12),
      componentHints: Array.from(allHints).slice(0, 30),
      accessibilityWarnings: accessibilityWarnings(),
    };

    return JSON.stringify(context);
  });
}`;
    }
}
exports.EnhancedMcpSnapshotTool = EnhancedMcpSnapshotTool;

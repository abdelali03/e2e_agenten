"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateMcpActionTarget = validateMcpActionTarget;
const ACTION_TOOLS = new Set([
    "browser_click",
    "browser_type",
    "browser_fill_form",
    "browser_select_option",
    "browser_hover",
    "browser_drag",
]);
function validateMcpActionTarget(toolName, args) {
    if (!ACTION_TOOLS.has(toolName)) {
        return { ok: true };
    }
    if (toolName === "browser_fill_form") {
        return validateFillForm(args);
    }
    const target = args.target;
    if (typeof target !== "string" || !target.trim()) {
        return {
            ok: false,
            error: `${toolName} requires a non-empty string target.`,
        };
    }
    const trimmed = target.trim();
    if (/^\[\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*\]$/.test(trimmed)) {
        return {
            ok: false,
            target: trimmed,
            error: "Vision coordinates are not executable MCP targets. Use an MCP ref like e123 or a valid selector/text/role locator.",
        };
    }
    if (/^\{.*(?:point|box_2d|x|y).*\}$/i.test(trimmed)) {
        return {
            ok: false,
            target: trimmed,
            error: "Raw vision JSON is not an executable MCP target. Convert visual hints to MCP refs/selectors first.",
        };
    }
    if (/^e\d+$/.test(trimmed)) {
        return { ok: true, target: trimmed };
    }
    if (isLikelyValidSelector(trimmed)) {
        return { ok: true, target: trimmed };
    }
    return {
        ok: false,
        target: trimmed,
        error: "Target is neither an MCP ref nor a supported selector. Use browser_snapshot/perception to resolve a valid target.",
    };
}
function validateFillForm(args) {
    const fields = args.fields;
    if (!Array.isArray(fields)) {
        return { ok: true };
    }
    for (const field of fields) {
        if (!field || typeof field !== "object")
            continue;
        const target = field.target;
        if (typeof target !== "string")
            continue;
        const result = validateMcpActionTarget("browser_click", { target });
        if (!result.ok) {
            return result;
        }
    }
    return { ok: true };
}
function isLikelyValidSelector(target) {
    return (/^text\s*=/.test(target) ||
        /^role\s*=/.test(target) ||
        /^css\s*=/.test(target) ||
        /^xpath\s*=/.test(target) ||
        /^id\s*=/.test(target) ||
        /^data-testid\s*=/.test(target) ||
        /^getBy(Role|Text|Label|Placeholder|TestId)\(/.test(target) ||
        /^page\.getBy(Role|Text|Label|Placeholder|TestId)\(/.test(target) ||
        /^[.#\[][\s\S]+/.test(target) ||
        /^[a-zA-Z][\w-]*(?:[#.\[: ][\s\S]*)?$/.test(target));
}

"use strict";
// src/agents/DomAnalystAgent.ts
// Schritt 3: DOM-Analyst Agent
// Nimmt den AOM/DOM-Snapshot + Instruktion und entscheidet,
// welche konkrete Aktion auf welchem konkreten Element ausgeführt werden soll.
Object.defineProperty(exports, "__esModule", { value: true });
exports.DomAnalystAgent = void 0;
const LlmClient_1 = require("../../../utils/LlmClient");
const Logger_1 = require("../../../utils/Logger");
const AomExtractor_1 = require("../../../utils/AomExtractor");
const logger = new Logger_1.Logger("DomAnalystAgent");
const SYSTEM_PROMPT = `You are a precise UI interaction analyst for automated browser testing.

Your job:
Given a hybrid UI snapshot (DOM targets + optional Playwright ARIA snapshot + layout hints) and a test instruction, choose the EXACT existing element that should be used for the next browser action.

The executor is a Playwright executor.
It can execute actions best when you return the exact targetUid and selector from the DOM target list.

## Critical rules
- You MUST choose an existing element from the provided AOM.
- You MUST copy "uid" exactly from a chosen element in "ACCESSIBLE UI ELEMENTS" into "targetUid".
- You MUST copy "selector" exactly from that same element into "selector".
- Never invent targetUid.
- Never invent selector.
- Never output a selector that is not present in the AOM.
- Use the Playwright ARIA snapshot, layout hints, viewport, and bounds only to resolve intent and visual/semantic ambiguity. They are context, not executable selectors.
- Prefer elements with clear name, label, ariaLabel, ariaLabelledByText, placeholder, testId, dataTestId, text, id, nameAttr, or inputType.
- For forms, match the instruction to fields by name, label, ariaLabel, ariaLabelledByText, placeholder, inputType, nameAttr, id, testId, nearbyText, nearestHeading, formText, componentContext, and domIndex.
- For buttons and links, match by visible text/name.
- For table row/cell instructions, prefer a row, tr, td, th, cell, or gridcell whose name/text/ancestorText contains the requested date or exact text. Do not click a row action button like "Offene Termine" unless the instruction explicitly asks for that button.
- For React/Angular/MUI components, use componentHints, componentContext, nearbyText, ancestorText, nearestHeading, and formText to understand which nested input/button is the real target.
- For MUI TextField/FormControl, prefer the nested input/textarea with textbox role, using the surrounding label/nearbyText as the field name.
- For fill/type/setDate/setTime, choose a truly editable element: input, textarea, select, or contenteditable. Avoid non-editable div/span wrappers, MUI section containers, and MUI picker spinbutton sections unless no editable input exists.
- For MUI date/time pickers, prefer the visible textbox/input whose name or label is "Datum", "Start", or "Ende" and whose value looks like a date or time. Do not fill individual non-editable picker section divs.
- For custom selects/autocomplete widgets, prefer a combobox/button/input with componentHints such as mui-select, mui-autocomplete, react-select, mat-select, or custom-select.
- For elements with data-testid/data-test/data-cy/data-qa, treat those as strong stable identifiers when they match the instruction.
- For assertions and waits, choose the smallest matching visible element when possible; if the assertion is page-wide text or URL, targetUid and selector may be omitted according to the rules below.
- If multiple fields are similar, use domIndex/order and explain why.
- For "first textbox", choose the textbox with the lowest domIndex.
- For "email", prefer inputType "email", then name/label/placeholder containing "email" or "e-mail".
- For "password", prefer inputType "password".
- For "repeat password", "confirm password", or "Passwort wiederholen", choose the second password field.
- For "Vorname", prefer fields whose name/label/placeholder/id/nameAttr contains "vorname" or "first".
- For "Nachname", prefer fields whose name/label/placeholder/id/nameAttr contains "nachname" or "last".
- Do not choose disabled elements unless the instruction explicitly requires it.
- For navigate/assertUrl/waitForUrl actions, targetUid and selector may be omitted, but value must be the URL or URL fragment/pattern.
- For press actions, targetUid and selector may be omitted if the key should be pressed globally.
- For waitForText actions, targetUid and selector may be omitted if the text should be found anywhere on the page.
- Return only valid JSON. No markdown. No extra text.

## Action mapping
- "Click ..." => actionType "click"
- "Click text ..." => actionType "clickText"
- "Click row containing ..." or "Click the row for ..." => actionType "clickRowContaining"
- "Click cell containing ..." => actionType "clickCellContaining"
- "Click outside" => actionType "clickOutside"
- "Double click ..." => actionType "doubleClick"
- "Right click ..." or context menu => actionType "rightClick"
- "Fill ...", "Set value ...", "Enter ... into field" => actionType "setValue"
- "Type ..." => actionType "type"
- "Append ..." => actionType "appendText"
- "Clear ..." => actionType "clear"
- "Select ..." or dropdown option => actionType "selectOption"
- "Open dropdown/date picker/time picker" => actionType "openDropdown" | "openDatePicker" | "openTimePicker"
- "Close dropdown/menu/overlay" or dismiss backdrop => actionType "dismissOverlay"
- "Check ..." => actionType "check"
- "Uncheck ..." => actionType "uncheck"
- "Toggle ..." => actionType "toggle"
- "Focus ..." => actionType "focus"
- "Blur ..." => actionType "blur"
- "Press Enter/Tab/..." => actionType "press"
- "Navigate to URL" => actionType "navigate"
- "Go back/forward/reload" => actionType "goBack" | "goForward" | "reload"
- "Wait for page ready" => actionType "waitForPageReady"
- "Wait until ... is visible" => actionType "waitForVisible"
- "Wait until ... disappears/is hidden" => actionType "waitForHidden"
- "Wait until text ... appears" => actionType "waitForText"
- "Wait until URL ..." => actionType "waitForUrl"
- "Verify/Assert ... is visible" => actionType "assertVisible"
- "Verify/Assert ... is hidden" => actionType "assertHidden"
- "Verify/Assert text ..." => actionType "assertText"
- "Verify/Assert field value ..." => actionType "assertValue"
- "Verify/Assert URL ..." => actionType "assertUrl"
- "Verify row exists ..." => actionType "verifyRowExists"
- "Verify cell value ..." => actionType "verifyCellValue"
- "Scroll to ..." => actionType "scrollIntoView"
- "Scroll to text ..." => actionType "scrollToText"
- "Scroll page/container up/down" => actionType "scrollPage" | "scrollContainer"
- "Set date ..." => actionType "setDate"
- "Set time ..." => actionType "setTime"
- "Submit form" => actionType "submitForm"
- "Reset form" => actionType "resetForm"
- "Add row" => actionType "addRow"
- "Delete row" => actionType "deleteRow"
- "Wait for dialog/toast" => actionType "waitForDialog" | "waitForToast"
- "Confirm/cancel/close dialog" => actionType "confirmDialog" | "cancelDialog" | "closeDialog"
- "Upload file ..." => actionType "uploadFile"

## Response format
{
  "actionType": "click" | "clickText" | "clickNearest" | "clickRowContaining" | "clickCellContaining" | "clickOutside" | "doubleClick" | "rightClick" | "fill" | "setValue" | "fillField" | "fillForm" | "type" | "appendText" | "clear" | "clearValue" | "select" | "selectOption" | "openDropdown" | "closeDropdown" | "check" | "uncheck" | "toggle" | "selectRadio" | "hover" | "focus" | "blur" | "press" | "pressShortcut" | "navigate" | "goBack" | "goForward" | "reload" | "waitForPageReady" | "waitForNavigationOrStateChange" | "waitForVisible" | "waitForHidden" | "waitForText" | "waitForUrl" | "assertVisible" | "assertHidden" | "assertText" | "verifyTextVisible" | "assertTextNotVisible" | "assertValue" | "assertUrl" | "assertTitle" | "assertEnabled" | "assertDisabled" | "assertChecked" | "scrollIntoView" | "scrollToText" | "scrollPage" | "scrollContainer" | "setDate" | "setTime" | "pickDate" | "pickTime" | "openDatePicker" | "openTimePicker" | "submitForm" | "resetForm" | "addRow" | "deleteRow" | "sortColumn" | "filterColumn" | "verifyRowExists" | "verifyCellValue" | "waitForDialog" | "confirmDialog" | "cancelDialog" | "closeDialog" | "dismissOverlay" | "waitForToast" | "verifyToast" | "uploadFile",
  "targetUid": "exact uid from AOM, e.g. ai_el_0004",
  "selector": "exact selector from AOM, e.g. [data-ai-uid=\\"ai_el_0004\\"]",
  "targetDescription": "short human-readable description of the chosen target",
  "targetRole": "role from AOM",
  "targetName": "name/label/text of the chosen element from AOM",
  "value": "value to fill/type/select/press/navigate/assert/wait/upload/set, if needed",
  "reasoning": "brief explanation of why this exact element was chosen"
}`;
class DomAnalystAgent {
    llm;
    constructor() {
        this.llm = new LlmClient_1.LlmClient();
    }
    async analyze(input) {
        logger.info(`Analyzing: "${input.instruction}"`);
        const aomContext = typeof input.aomTree === "object" &&
            input.aomTree !== null &&
            "nodes" in input.aomTree
            ? (0, AomExtractor_1.aomToPromptString)(input.aomTree)
            : JSON.stringify(input.aomTree, null, 2);
        const userMessage = this.buildUserMessage(input, aomContext);
        const response = await this.llm.complete([
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userMessage },
        ], 4096);
        logger.debug("LLM raw response:", response.content);
        const output = LlmClient_1.LlmClient.parseJsonResponse(response.content);
        this.validateOutput(output, input);
        logger.info(`Decision: ${output.actionType} on [${output.targetRole}] "${output.targetName}"`, {
            targetUid: output.targetUid,
            selector: output.selector,
            value: output.value,
            reasoning: output.reasoning,
        });
        return output;
    }
    buildUserMessage(input, aomContext) {
        const parts = [
            `## Test Instruction`,
            input.instruction,
            ``,
            `## Current Page State (AOM)`,
            aomContext,
            ``,
            ...(input.visualContext
                ? [
                    `## Visual Recovery Context`,
                    input.visualContext,
                    ``,
                    `Use this screenshot description to resolve ambiguity, but still choose a real AOM target and selector when the action needs a target.`,
                    ``,
                ]
                : []),
            `## Required output`,
            `Choose exactly one existing element from the AOM for this instruction.`,
            `Return its exact uid as targetUid and exact selector as selector.`,
            `For value-based actions, include the required value.`,
        ];
        if (input.previousError) {
            parts.push(``, `## Previous Attempt Failed`, `Error: ${input.previousError}`, `Choose a different existing AOM element or explain why the same element is still correct.`);
        }
        return parts.join("\n");
    }
    validateOutput(output, input) {
        if (!output || typeof output !== "object") {
            throw new Error("DomAnalyst returned invalid empty output");
        }
        if (!output.actionType) {
            throw new Error("DomAnalyst output is missing actionType");
        }
        const actionsRequiringValue = new Set([
            "fill",
            "setValue",
            "fillField",
            "fillForm",
            "type",
            "appendText",
            "select",
            "selectOption",
            "clickText",
            "clickRowContaining",
            "clickCellContaining",
            "press",
            "pressShortcut",
            "navigate",
            "waitForText",
            "waitForUrl",
            "assertText",
            "verifyTextVisible",
            "assertTextNotVisible",
            "assertValue",
            "assertUrl",
            "assertTitle",
            "scrollToText",
            "scrollPage",
            "scrollContainer",
            "setDate",
            "setTime",
            "pickDate",
            "pickTime",
            "filterColumn",
            "verifyRowExists",
            "verifyCellValue",
            "waitForToast",
            "verifyToast",
            "uploadFile",
        ]);
        if (actionsRequiringValue.has(output.actionType)) {
            if (!output.value) {
                throw new Error(`DomAnalyst output for actionType="${output.actionType}" is missing value`);
            }
        }
        const targetlessActions = new Set([
            "observePage",
            "navigate",
            "goBack",
            "goForward",
            "reload",
            "waitForPageReady",
            "waitForNavigationOrStateChange",
            "press",
            "pressShortcut",
            "clickText",
            "clickRowContaining",
            "clickCellContaining",
            "clickOutside",
            "waitForText",
            "waitForUrl",
            "assertUrl",
            "assertTitle",
            "verifyTextVisible",
            "assertTextNotVisible",
            "scrollToText",
            "scrollPage",
            "closeDropdown",
            "dismissOverlay",
            "waitForDialog",
            "confirmDialog",
            "cancelDialog",
            "closeDialog",
            "waitForToast",
            "verifyToast",
            "verifyRowExists",
        ]);
        if (!targetlessActions.has(output.actionType)) {
            if (!output.targetUid && !output.selector) {
                throw new Error(`DomAnalyst did not return targetUid/selector for instruction: "${input.instruction}"`);
            }
        }
        this.validateEditableTarget(output, input);
    }
    validateEditableTarget(output, input) {
        const editableActions = new Set([
            "fill",
            "setValue",
            "fillField",
            "type",
            "appendText",
            "setDate",
            "setTime",
            "pickDate",
            "pickTime",
        ]);
        if (!editableActions.has(output.actionType)) {
            return;
        }
        const nodes = this.getAomNodes(input.aomTree);
        const target = nodes.find((node) => node.uid === output.targetUid ||
            (output.selector && node.selector === output.selector));
        if (!target) {
            return;
        }
        const tagName = target.tagName?.toLowerCase();
        const isEditableTag = tagName === "input" || tagName === "textarea" || tagName === "select";
        if (!isEditableTag) {
            throw new Error(`DomAnalyst chose non-editable ${tagName ?? target.role} for ${output.actionType}: "${target.name}". Choose an input, textarea, select, or contenteditable element.`);
        }
    }
    getAomNodes(aomTree) {
        const root = typeof aomTree === "object" && aomTree !== null && "nodes" in aomTree
            ? aomTree.nodes
            : aomTree;
        return this.flattenNodes(Array.isArray(root) ? root : []);
    }
    flattenNodes(nodes) {
        return nodes.flatMap((node) => [
            node,
            ...this.flattenNodes(node.children ?? []),
        ]);
    }
}
exports.DomAnalystAgent = DomAnalystAgent;

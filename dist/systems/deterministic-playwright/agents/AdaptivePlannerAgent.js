"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdaptivePlannerAgent = void 0;
const LlmClient_1 = require("../../../utils/LlmClient");
const Logger_1 = require("../../../utils/Logger");
const AomExtractor_1 = require("../../../utils/AomExtractor");
const logger = new Logger_1.Logger("AdaptivePlannerAgent");
const SYSTEM_PROMPT = `You are an adaptive browser test planner.

Your job:
Given a high-level goal, structured test data, current page state, and execution history, decide the single next atomic browser instruction that makes progress toward the goal.

## Core behavior
- Plan exactly ONE next browser action at a time.
- Use the current page state. Do not assume old planned URLs or old pages.
- If the current page already contains the next needed UI element, interact with it directly.
- Never wait for a URL fragment unless the current application clearly uses that route.
- Prefer visible UI evidence from the AOM over generic assumptions like "dashboard".
- Use the visible text excerpt to understand what is actually on the page before deciding.
- Do not trust a previous action's success flag blindly. Check history.observedAfter and the current page state to see whether the UI actually changed as expected.
- For table goals, first look for rows/cells whose text contains the target value. If the target text is already visible, click that row/cell directly instead of scrolling.
- Only plan scrolling when the target text is not present in the current visible text or AOM.
- Use the structured test data exactly for credentials, appointment name, description, date, and times.
- If the goal is already complete, return status "complete".
- If you cannot continue because required data is missing or the app shows a blocking error, return status "blocked".

## Atomic instruction rules
- Each instruction must be one action only: click, fill, select, set date, set time, wait, verify, scroll, or navigate.
- Do not combine actions like "wait then click".
- Do not include AOM uids such as ai_el_0001 in the instruction.
- Write instructions in stable human language, for example "Fill the username field with user@example.com" or "Click the Termine navigation button".
- The DOM analyst, not you, will choose the concrete uid and selector from the latest AOM.
- Prefer capability-shaped instructions: "Click the row containing 01.05.2026", "Set the Startzeit field to 09:00", "Dismiss the open overlay", "Verify text X is visible".
- For login, fill username, fill password, click login, then continue from the actual page shown.
- For time fields, inspect the current AOM. If there is one time field, set the full value like "09:00". If there are separate hour/minute fields, set hour and minute in separate actions.
- For completion, require evidence such as a success message, created appointment visible, or another strong UI signal.

## Available generic capabilities
- navigation: navigate, go back, go forward, reload, wait for page ready, wait for URL
- clicking: click element, click visible text, click row/cell containing text, click outside
- values: set field value, clear value, append text, focus/blur, press key/shortcut
- forms: fill field/form, submit form, reset form, verify field value
- selection: open dropdown, select option, close dropdown
- toggles: check, uncheck, toggle, select radio
- dates/times: set date, set time, pick date/time, open date/time picker
- tables/grids: click row containing text, click cell containing text, add/delete row, sort/filter column, verify row/cell
- dialogs/overlays: wait for dialog, confirm/cancel/close dialog, dismiss overlay, wait for toast
- scrolling/assertions: scroll to text, scroll page/container, wait/verify visible/hidden/text/url/title/enabled/disabled/checked

## Response format
Respond ONLY with valid JSON. Do not include markdown, explanations before/after JSON, or <think> blocks:
{
  "status": "continue" | "complete" | "blocked",
  "instruction": "One atomic browser instruction when status is continue",
  "expectedOutcome": "What should be true after this action",
  "reasoning": "Brief reason grounded in current page state"
}`;
class AdaptivePlannerAgent {
    llm;
    constructor() {
        this.llm = new LlmClient_1.LlmClient();
    }
    async nextAction(input) {
        logger.info("Planning next adaptive action");
        const response = await this.llm.complete([
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: this.buildUserMessage(input) },
        ], 2048);
        const output = LlmClient_1.LlmClient.parseJsonResponse(response.content);
        this.normalizeInstruction(output, input.snapshot);
        this.validateOutput(output);
        logger.info(`Planner status: ${output.status}`, {
            instruction: output.instruction,
            expectedOutcome: output.expectedOutcome,
            reasoning: output.reasoning,
        });
        return output;
    }
    buildUserMessage(input) {
        return [
            `## Goal`,
            input.goal.goal,
            ``,
            `## Starting URL`,
            input.goal.url,
            ``,
            `## Structured Test Data`,
            JSON.stringify(input.goal.testData ?? {}, null, 2),
            ``,
            input.goal.context ? `## Extra Context\n${input.goal.context}\n` : "",
            `## Current Page State`,
            (0, AomExtractor_1.aomToPromptString)(input.snapshot),
            ``,
            `## Execution History`,
            JSON.stringify(input.history.slice(-12), null, 2),
            ``,
            input.lastError ? `## Last Error\n${input.lastError}\n` : "",
            `Decide the next single atomic instruction, or complete/blocked.`,
        ]
            .filter((part) => part.length > 0)
            .join("\n");
    }
    validateOutput(output) {
        if (!output || typeof output !== "object") {
            throw new Error("Adaptive planner returned invalid empty output");
        }
        if (!["continue", "complete", "blocked"].includes(output.status)) {
            throw new Error(`Adaptive planner returned invalid status: ${output.status}`);
        }
        if (output.status === "continue" && !output.instruction?.trim()) {
            throw new Error("Adaptive planner status continue requires instruction");
        }
        if (!output.reasoning?.trim()) {
            throw new Error("Adaptive planner output is missing reasoning");
        }
    }
    normalizeInstruction(output, snapshot) {
        if (output.status !== "continue" || !output.instruction) {
            return;
        }
        const normalized = this.convertUidSyntaxToStableInstruction(output.instruction, snapshot);
        if (normalized !== output.instruction) {
            logger.info("Normalized planner UID instruction", {
                from: output.instruction,
                to: normalized,
            });
            output.instruction = normalized;
        }
    }
    convertUidSyntaxToStableInstruction(instruction, snapshot) {
        const match = instruction
            .trim()
            .match(/^(fill|type|click|select|setDate|setTime)\s*\[\s*(ai_el_\d+)\s*(?:,\s*(.*?)\s*)?\]$/i);
        if (!match) {
            return instruction;
        }
        const [, rawAction, uid, rawValue = ""] = match;
        const node = snapshot.nodes.find((candidate) => candidate.uid === uid);
        if (!node) {
            return instruction.replace(/\bai_el_\d+\b/g, "the matching visible element");
        }
        const action = rawAction.toLowerCase();
        const target = this.describeNode(node);
        const value = rawValue.trim();
        if (action === "click") {
            return `Click the ${target}`;
        }
        if (action === "select") {
            return `Select ${value} in the ${target}`;
        }
        if (action === "setdate") {
            return `Set the ${target} to ${value}`;
        }
        if (action === "settime") {
            return `Set the ${target} to ${value}`;
        }
        return `Fill the ${target} with ${value}`;
    }
    describeNode(node) {
        const name = node.label ||
            node.name ||
            node.ariaLabel ||
            node.placeholder ||
            node.text ||
            node.id ||
            node.nameAttr ||
            node.role ||
            node.tagName ||
            "matching visible element";
        const role = node.role || node.tagName || "element";
        if (/button|link/i.test(role)) {
            return `${name} ${role}`;
        }
        if (/textbox|spinbutton|combobox/i.test(role)) {
            return `${name} field`;
        }
        return `${name} ${role}`;
    }
}
exports.AdaptivePlannerAgent = AdaptivePlannerAgent;

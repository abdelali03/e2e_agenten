"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AllLlmAgent = void 0;
const LlmClient_1 = require("../utils/LlmClient");
const Logger_1 = require("../utils/Logger");
const AomExtractor_1 = require("../utils/AomExtractor");
const logger = new Logger_1.Logger("AllLlmAgent");
const SYSTEM_PROMPT = `You are an autonomous browser workflow agent for scientific comparison.

You control the whole workflow yourself: planning, target selection, selector choice, action choice, recovery, and completion judgment.
There is no separate deterministic DOM analyst or handcrafted selector synthesizer.

You receive a hybrid page snapshot. Choose exactly ONE next browser command.

## Selector control
You must choose the locator strategy yourself.
Prefer user-facing Playwright locators that would also be maintainable in a real test:
1. testId when an explicit data-testid/data-test/data-cy/data-qa matches
2. role with accessible name for buttons, links, tabs, menuitems, checkboxes
3. label for form fields
4. placeholder for form fields
5. text for visible text, rows, cells, links, simple buttons
6. css or xpath only when needed
7. uid only as a last-resort runtime fallback when no stable locator is obvious
8. coordinate only for truly custom widgets where no DOM locator can work

The uid strategy is allowed for this experimental branch, but it is runtime-only and less maintainable. Prefer stable locator strategies when possible.

## Workflow rules
- Think from the current page, not from an old plan.
- Execute one atomic action at a time.
- Use previous errors to choose a different locator/action.
- If a modal, menu, date picker, or autocomplete is open, continue from that state.
- For inputs, prefer fill. For custom controls, click/open first, then choose the option/text on the next turn.
- For MUI/Angular/React widgets, use componentHints, labels, text, bounds, and the ARIA snapshot to infer intent.
- For tables/grids, interact with visible rows/cells by text or role when possible.
- Mark complete only when the current page visibly proves the goal is done.
- Mark blocked only when required data is missing or the UI blocks progress.

## Response
Return ONLY valid JSON:
{
  "status": "continue" | "complete" | "blocked",
  "actionType": "navigate" | "click" | "doubleClick" | "fill" | "type" | "clear" | "press" | "selectOption" | "check" | "uncheck" | "hover" | "waitForVisible" | "waitForText" | "assertVisible" | "assertText" | "assertUrl" | "scroll" | "wait",
  "locator": {
    "strategy": "none" | "uid" | "role" | "label" | "placeholder" | "text" | "testId" | "css" | "xpath" | "coordinate",
    "value": "selector/text/label/test id/uid/xpath when needed",
    "role": "button/link/textbox/checkbox/etc when strategy is role",
    "name": "accessible name when strategy is role",
    "exact": false,
    "x": 100,
    "y": 200
  },
  "value": "value to fill/type/select/press/navigate/assert/wait/scroll",
  "expectedOutcome": "short expected result after the command",
  "reasoning": "brief page-grounded reason"
}`;
class AllLlmAgent {
    llm;
    constructor() {
        this.llm = new LlmClient_1.LlmClient();
    }
    async decide(input) {
        logger.info("All-LLM agent deciding next command");
        const response = await this.llm.complete([
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: this.buildUserMessage(input) },
        ], 4096);
        const command = LlmClient_1.LlmClient.parseJsonResponse(response.content);
        this.validate(command);
        logger.info(`All-LLM command: ${command.status}`, {
            actionType: command.actionType,
            locator: command.locator,
            value: command.value,
            reasoning: command.reasoning,
        });
        return command;
    }
    buildUserMessage(input) {
        return [
            `## Goal`,
            input.goal.goal,
            ``,
            `## Start URL`,
            input.goal.url,
            ``,
            `## Structured Test Data`,
            JSON.stringify(input.goal.testData ?? {}, null, 2),
            ``,
            input.goal.context ? `## Extra Context\n${input.goal.context}\n` : "",
            `## Current Page Snapshot`,
            (0, AomExtractor_1.aomToPromptString)(input.snapshot),
            ``,
            `## Recent All-LLM History`,
            JSON.stringify(input.history.slice(-12), null, 2),
            ``,
            input.lastError ? `## Last Error\n${input.lastError}\n` : "",
            `Choose the next single browser command.`,
        ]
            .filter((part) => part.length > 0)
            .join("\n");
    }
    validate(command) {
        if (!command || typeof command !== "object") {
            throw new Error("AllLlmAgent returned invalid empty command");
        }
        if (!["continue", "complete", "blocked"].includes(command.status)) {
            throw new Error(`Invalid AllLlm status: ${command.status}`);
        }
        if (!command.reasoning?.trim()) {
            throw new Error("AllLlm command is missing reasoning");
        }
        if (command.status !== "continue") {
            return;
        }
        if (!command.actionType) {
            throw new Error("AllLlm continue command is missing actionType");
        }
        if (!command.locator) {
            command.locator = { strategy: "none" };
        }
        if (!command.locator.strategy) {
            command.locator.strategy = "none";
        }
    }
}
exports.AllLlmAgent = AllLlmAgent;

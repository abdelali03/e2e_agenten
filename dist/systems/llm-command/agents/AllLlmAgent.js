"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AllLlmAgent = void 0;
const LlmClient_1 = require("../../../utils/LlmClient");
const Logger_1 = require("../../../utils/Logger");
const AomExtractor_1 = require("../../../utils/AomExtractor");
const logger = new Logger_1.Logger("AllLlmAgent");
const SYSTEM_PROMPT = `You are an autonomous browser workflow agent for scientific comparison.

You control planning, selector choice, action choice, recovery, and completion judgment.
Choose exactly one next browser command.

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
    llm = new LlmClient_1.LlmClient();
    async decide(input) {
        logger.info("All-LLM command agent deciding next command");
        const response = await this.llm.complete([
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: this.buildUserMessage(input) },
        ], 4096);
        const command = this.normalize(LlmClient_1.LlmClient.parseJsonResponse(response.content));
        logger.info(`All-LLM command: ${command.status}`, command);
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
            `## Recent History`,
            JSON.stringify(input.history.slice(-10), null, 2),
            ``,
            input.lastError ? `## Last Error\n${input.lastError}\n` : "",
            `Choose the next single browser command.`,
        ]
            .filter(Boolean)
            .join("\n");
    }
    normalize(raw) {
        const status = raw.status && ["continue", "complete", "blocked"].includes(raw.status)
            ? raw.status
            : raw.actionType
                ? "continue"
                : "blocked";
        return {
            status,
            actionType: raw.actionType,
            locator: raw.locator ?? { strategy: "none" },
            value: raw.value,
            expectedOutcome: raw.expectedOutcome,
            reasoning: raw.reasoning?.trim() ||
                `No reasoning returned by model for status="${status}".`,
        };
    }
}
exports.AllLlmAgent = AllLlmAgent;

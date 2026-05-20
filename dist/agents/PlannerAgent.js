"use strict";
// src/agents/PlannerAgent.ts
// Schritt 4: Planner Agent
// Zerlegt ein High-Level-Testziel in geordnete Einzel-Instruktionen.
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlannerAgent = void 0;
const LlmClient_1 = require("../utils/LlmClient");
const Logger_1 = require("../utils/Logger");
const logger = new Logger_1.Logger("PlannerAgent");
const SYSTEM_PROMPT = `You are an expert test automation planner for web applications.

Your job: Break down a high-level test goal into a precise, ordered list of atomic browser actions.

## Rules for generating steps
- Each step must be ONE atomic action (click, fill, select, wait, verify, navigate, scroll, upload)
- Steps must be in the correct execution order
- Be specific: name form fields, button labels, and values explicitly
- Include verification steps where appropriate (e.g. "Verify the success message is visible", "Verify the URL contains /appointments")
- Account for prerequisite steps (e.g. waiting for a modal before interacting with it)
- Max 15 steps per plan - break complex goals into smaller sub-goals if needed

## Response format
Respond ONLY with a valid JSON object - no markdown:
{
  "steps": [
    "Step description 1",
    "Step description 2",
    ...
  ]
}`;
class PlannerAgent {
    llm;
    constructor() {
        this.llm = new LlmClient_1.LlmClient();
    }
    /**
     * Erstellt einen geordneten Aktionsplan für ein Testziel.
     *
     * @param input  Testziel + Start-URL + optionaler Kontext
     * @returns      Geordnete Liste von atomaren Instruktionen
     */
    async plan(input) {
        logger.info(`Planning: "${input.goal}"`);
        const userMessage = this.buildUserMessage(input);
        const response = await this.llm.complete([
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userMessage },
        ], 1024);
        const output = LlmClient_1.LlmClient.parseJsonResponse(response.content);
        logger.info(`Plan created: ${output.steps.length} steps`, {
            steps: output.steps,
        });
        return output;
    }
    buildUserMessage(input) {
        let message = `## Test Goal\n${input.goal}\n\n`;
        message += `## Starting URL\n${input.url}`;
        if (input.context) {
            message += `\n\n## Context / Test Data\n${input.context}`;
        }
        return message;
    }
}
exports.PlannerAgent = PlannerAgent;

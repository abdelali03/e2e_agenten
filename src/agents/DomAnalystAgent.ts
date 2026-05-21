// src/agents/DomAnalystAgent.ts
// Schritt 3: DOM-Analyst Agent
// Nimmt den AOM/DOM-Snapshot + Instruktion und entscheidet,
// welche konkrete Aktion auf welchem konkreten Element ausgeführt werden soll.

import { LlmClient } from "../utils/LlmClient";
import { Logger } from "../utils/Logger";
import { aomToPromptString } from "../utils/AomExtractor";
import type { AomSnapshot } from "../utils/AomExtractor";
import { AnalystInput, AnalystOutput } from "../core/types";

const logger = new Logger("DomAnalystAgent");

const SYSTEM_PROMPT = `You are a precise UI interaction analyst for automated browser testing.

Your job:
Given a DOM/Accessibility snapshot (AOM) and a test instruction, choose the EXACT existing element that should be used for the next browser action.

The executor is a Playwright executor.
It can execute actions best when you return the exact targetUid and selector from the AOM.

## Critical rules
- You MUST choose an existing element from the provided AOM.
- You MUST copy "uid" exactly from the chosen AOM element into "targetUid".
- You MUST copy "selector" exactly from the chosen AOM element into "selector".
- Never invent targetUid.
- Never invent selector.
- Never output a selector that is not present in the AOM.
- Prefer elements with clear name, label, ariaLabel, ariaLabelledByText, placeholder, testId, dataTestId, text, id, nameAttr, or inputType.
- For forms, match the instruction to fields by name, label, ariaLabel, ariaLabelledByText, placeholder, inputType, nameAttr, id, testId, nearbyText, nearestHeading, formText, componentContext, and domIndex.
- For buttons and links, match by visible text/name.
- For React/Angular/MUI components, use componentHints, componentContext, nearbyText, ancestorText, nearestHeading, and formText to understand which nested input/button is the real target.
- For MUI TextField/FormControl, prefer the nested input/textarea with textbox role, using the surrounding label/nearbyText as the field name.
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
- "Double click ..." => actionType "doubleClick"
- "Right click ..." or context menu => actionType "rightClick"
- "Fill ..." => actionType "fill"
- "Type ..." => actionType "type"
- "Clear ..." => actionType "clear"
- "Select ..." or dropdown option => actionType "select" or "click", depending on the target element
- "Check ..." => actionType "check"
- "Uncheck ..." => actionType "uncheck"
- "Open dropdown" => actionType "click"
- "Press Enter/Tab/..." => actionType "press"
- "Navigate to URL" => actionType "navigate"
- "Wait until ... is visible" => actionType "waitForVisible"
- "Wait until ... disappears/is hidden" => actionType "waitForHidden"
- "Wait until text ... appears" => actionType "waitForText"
- "Wait until URL ..." => actionType "waitForUrl"
- "Verify/Assert ... is visible" => actionType "assertVisible"
- "Verify/Assert ... is hidden" => actionType "assertHidden"
- "Verify/Assert text ..." => actionType "assertText"
- "Verify/Assert field value ..." => actionType "assertValue"
- "Verify/Assert URL ..." => actionType "assertUrl"
- "Scroll to ..." => actionType "scrollIntoView"
- "Set date ..." => actionType "setDate"
- "Set time ..." => actionType "setTime"
- "Upload file ..." => actionType "uploadFile"

## Response format
{
  "actionType": "click" | "doubleClick" | "rightClick" | "fill" | "type" | "clear" | "select" | "check" | "uncheck" | "hover" | "press" | "navigate" | "waitForVisible" | "waitForHidden" | "waitForText" | "waitForUrl" | "assertVisible" | "assertHidden" | "assertText" | "assertValue" | "assertUrl" | "scrollIntoView" | "setDate" | "setTime" | "uploadFile",
  "targetUid": "exact uid from AOM, e.g. ai_el_0004",
  "selector": "exact selector from AOM, e.g. [data-ai-uid=\\"ai_el_0004\\"]",
  "targetDescription": "short human-readable description of the chosen target",
  "targetRole": "role from AOM",
  "targetName": "name/label/text of the chosen element from AOM",
  "value": "value to fill/type/select/press/navigate/assert/wait/upload/set, if needed",
  "reasoning": "brief explanation of why this exact element was chosen"
}`;

export class DomAnalystAgent {
  private readonly llm: LlmClient;

  constructor() {
    this.llm = new LlmClient();
  }

  public async analyze(input: AnalystInput): Promise<AnalystOutput> {
    logger.info(`Analyzing: "${input.instruction}"`);

    const aomContext =
      typeof input.aomTree === "object" &&
      input.aomTree !== null &&
      "nodes" in (input.aomTree as object)
        ? aomToPromptString(input.aomTree as unknown as AomSnapshot)
        : JSON.stringify(input.aomTree, null, 2);

    const userMessage = this.buildUserMessage(input, aomContext);

    const response = await this.llm.complete(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      4096
    );

    logger.debug("LLM raw response:", response.content);

    const output = LlmClient.parseJsonResponse<AnalystOutput>(response.content);

    this.validateOutput(output, input);

    logger.info(
      `Decision: ${output.actionType} on [${output.targetRole}] "${output.targetName}"`,
      {
        targetUid: output.targetUid,
        selector: output.selector,
        value: output.value,
        reasoning: output.reasoning,
      }
    );

    return output;
  }

  private buildUserMessage(input: AnalystInput, aomContext: string): string {
    const parts: string[] = [
      `## Test Instruction`,
      input.instruction,
      ``,
      `## Current Page State (AOM)`,
      aomContext,
      ``,
      `## Required output`,
      `Choose exactly one existing element from the AOM for this instruction.`,
      `Return its exact uid as targetUid and exact selector as selector.`,
      `For value-based actions, include the required value.`,
    ];

    if (input.previousError) {
      parts.push(
        ``,
        `## Previous Attempt Failed`,
        `Error: ${input.previousError}`,
        `Choose a different existing AOM element or explain why the same element is still correct.`
      );
    }

    return parts.join("\n");
  }

  private validateOutput(output: AnalystOutput, input: AnalystInput): void {
    if (!output || typeof output !== "object") {
      throw new Error("DomAnalyst returned invalid empty output");
    }

    if (!output.actionType) {
      throw new Error("DomAnalyst output is missing actionType");
    }

    const actionsRequiringValue = new Set([
      "fill",
      "type",
      "select",
      "press",
      "navigate",
      "waitForText",
      "waitForUrl",
      "assertText",
      "assertValue",
      "assertUrl",
      "setDate",
      "setTime",
      "uploadFile",
    ]);

    if (actionsRequiringValue.has(output.actionType)) {
      if (!output.value) {
        throw new Error(
          `DomAnalyst output for actionType="${output.actionType}" is missing value`
        );
      }
    }

    const targetlessActions = new Set([
      "navigate",
      "press",
      "waitForText",
      "waitForUrl",
      "assertUrl",
    ]);

    if (!targetlessActions.has(output.actionType)) {
      if (!output.targetUid && !output.selector) {
        throw new Error(
          `DomAnalyst did not return targetUid/selector for instruction: "${input.instruction}"`
        );
      }
    }
  }
}

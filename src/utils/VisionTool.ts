import { LlmClient } from "./LlmClient";
import { Logger } from "./Logger";
import { PlaywrightMcpClient } from "./PlaywrightMcpClient";
import { VisionClient } from "./VisionClient";

const logger = new Logger("VisionTool");

export interface VisionToolInput {
  goal: string;
  currentSubgoal?: string;
  expectedOutcome?: string;
  visualTask?: string;
  lastError?: string;
  recentFailures: string[];
  recentObservations?: string[];
}

export interface VisionComponentDescription {
  componentKind: string;
  description: string;
  visibleText?: string;
  approximatePosition: string;
  visualState?: string;
  relationToGoal?: string;
}

export interface VisionToolResult {
  pageSummary: string;
  components: VisionComponentDescription[];
  layoutDescription: string;
  goalProgress: {
    completed: string[];
    missing: string[];
    uncertain: string[];
    visibleEvidence: string[];
  };
  goalCompletionEstimate: "not_started" | "partial" | "likely_complete" | "blocked" | "unknown";
  blockingElements: string[];
  visibleErrors: string[];
  mismatch: string;
  recommendedNextAction: string;
  confidence: "low" | "medium" | "high";
}

export class VisionTool {
  private readonly vision = new VisionClient();
  private readonly llm = new LlmClient();

  public async analyzeCurrentPage(
    mcp: PlaywrightMcpClient,
    input: VisionToolInput
  ): Promise<VisionToolResult | undefined> {
    if (process.env.MINIMAX_VISION_ENABLED !== "true") {
      logger.debug("VisionTool skipped. Set MINIMAX_VISION_ENABLED=true to enable it.");
      return undefined;
    }

    try {
      const screenshot = await mcp.takeScreenshot();

      if (!screenshot?.data) {
        logger.warn("VisionTool could not capture a screenshot image from MCP.");
        return undefined;
      }

      const visualDescription = await this.vision.describeScreenshot({
        screenshotBase64: screenshot.data,
        prompt: this.buildVisionPrompt(input),
      });

      if (!visualDescription?.trim()) {
        logger.warn("VisionTool received no visual description.");
        return undefined;
      }

      const analysis = await this.structureAnalysis(input, visualDescription);
      if (analysis) {
        this.logStructuredAnalysis(analysis);
      }

      return analysis;
    } catch (error) {
      logger.warn(
        "VisionTool failed:",
        error instanceof Error ? error.message : String(error)
      );
      return undefined;
    }
  }

  private buildVisionPrompt(input: VisionToolInput): string {
    return [
      "You are a visual UI analyst for browser automation recovery.",
      "Describe the screenshot in detail for another agent that must continue an end-to-end test.",
      "",
      "Important rules:",
      "- Identify the visible UI components as they appear in the image.",
      "- Do not force components into predefined categories; name what you see naturally.",
      "- Describe approximate screen positions using words, not coordinates.",
      "- Mention visible text, labels, values, placeholders, icons, dialogs, overlays, warnings, validation messages, tables, menus, forms, or custom widgets if present.",
      "- Describe visual state such as focused, empty, filled, selected, disabled, loading, covered, or invalid when visible.",
      "- Compare the visual state with the current goal and recent failures.",
      "- Verify which parts of the goal appear completed, missing, uncertain, or blocked based only on visible evidence.",
      "- Do not invent DOM selectors, MCP refs, CSS selectors, XPath, or exact coordinates.",
      "- Recommend one safe next browser action in natural language.",
      "",
      "Overall goal:",
      input.goal,
      "",
      "Current subgoal:",
      input.currentSubgoal || "Not specified",
      "",
      "Expected outcome:",
      input.expectedOutcome || "Not specified",
      "",
      "Specific visual task:",
      input.visualTask ||
        "Describe the current visible UI and assess what is needed for the browser workflow.",
      "",
      "Last error:",
      input.lastError || "None",
      "",
      "Recent failures:",
      input.recentFailures.length > 0 ? input.recentFailures.join("\n") : "None",
      "",
      "Recent observations:",
      input.recentObservations?.length
        ? input.recentObservations.join("\n")
        : "Not provided",
      "",
      "Return a concise but detailed plain-text analysis.",
    ].join("\n");
  }

  private async structureAnalysis(
    input: VisionToolInput,
    visualDescription: string
  ): Promise<VisionToolResult | undefined> {
    try {
      const response = await this.llm.complete(
        [
          {
            role: "system",
            content:
              "You convert visual UI descriptions into strict JSON for browser automation recovery. Return only valid JSON.",
          },
          {
            role: "user",
            content: [
              "Overall goal:",
              input.goal,
              "",
              "Current subgoal:",
              input.currentSubgoal || "Not specified",
              "",
              "Expected outcome:",
              input.expectedOutcome || "Not specified",
              "",
              "Specific visual task:",
              input.visualTask ||
                "Describe the current visible UI and assess what is needed for the browser workflow.",
              "",
              "Last error:",
              input.lastError || "None",
              "",
              "Visual description:",
              visualDescription,
              "",
              "Return exactly this JSON shape:",
              "{",
              '  "pageSummary": "short description of the current visible page or dialog",',
              '  "components": [',
              "    {",
              '      "componentKind": "free-form component name from the image, e.g. modal dialog, search field, date picker grid, navigation item, table row, validation message",',
              '      "description": "what the component looks like and why it matters",',
              '      "visibleText": "visible text/value/label if present",',
              '      "approximatePosition": "top left | top | top right | center left | center | center right | bottom left | bottom | bottom right | full page | unknown",',
              '      "visualState": "empty/filled/focused/disabled/selected/invalid/loading/covered/etc if visible",',
              '      "relationToGoal": "how this component relates to the goal or failure"',
              "    }",
              "  ],",
              '  "layoutDescription": "how the relevant components are arranged",',
              '  "goalProgress": {',
              '    "completed": ["goal parts that are visibly completed"],',
              '    "missing": ["goal parts that are visibly not done yet"],',
              '    "uncertain": ["goal parts that cannot be verified visually"],',
              '    "visibleEvidence": ["specific visible evidence from the screenshot"]',
              "  },",
              '  "goalCompletionEstimate": "not_started|partial|likely_complete|blocked|unknown",',
              '  "blockingElements": ["dialogs, overlays, spinners, menus, or blockers visible"],',
              '  "visibleErrors": ["visible validation or application errors"],',
              '  "mismatch": "what the previous agent believed or expected vs what the screenshot shows",',
              '  "recommendedNextAction": "one safe next browser action in natural language, without selectors or coordinates",',
              '  "confidence": "low|medium|high"',
              "}",
            ].join("\n"),
          },
        ],
        3072
      );

      const parsed = LlmClient.parseJsonResponse<VisionToolResult>(response.content);
      return this.normalize(parsed);
    } catch (error) {
      logger.warn(
        "VisionTool could not structure visual analysis:",
        error instanceof Error ? error.message : String(error)
      );
      return undefined;
    }
  }

  private normalize(raw: Partial<VisionToolResult>): VisionToolResult {
    const confidence = ["low", "medium", "high"].includes(raw.confidence ?? "")
      ? raw.confidence!
      : "low";

    const components = Array.isArray(raw.components)
      ? raw.components
          .filter((component) => component && typeof component === "object")
          .slice(0, 12)
          .map((component) => ({
            componentKind:
              String(component.componentKind || "visible UI component").slice(0, 120),
            description: String(component.description || "").slice(0, 600),
            visibleText: component.visibleText
              ? String(component.visibleText).slice(0, 300)
              : undefined,
            approximatePosition: String(
              component.approximatePosition || "unknown"
            ).slice(0, 80),
            visualState: component.visualState
              ? String(component.visualState).slice(0, 200)
              : undefined,
            relationToGoal: component.relationToGoal
              ? String(component.relationToGoal).slice(0, 300)
              : undefined,
          }))
      : [];

    return {
      pageSummary: String(raw.pageSummary || "No visual summary returned.").slice(
        0,
        1200
      ),
      components,
      layoutDescription: String(raw.layoutDescription || "").slice(0, 1000),
      goalProgress: this.normalizeGoalProgress(raw.goalProgress),
      goalCompletionEstimate: this.normalizeGoalCompletionEstimate(
        raw.goalCompletionEstimate
      ),
      blockingElements: this.toStringArray(raw.blockingElements, 8, 300),
      visibleErrors: this.toStringArray(raw.visibleErrors, 8, 300),
      mismatch: String(raw.mismatch || "No mismatch described.").slice(0, 1000),
      recommendedNextAction: String(
        raw.recommendedNextAction ||
          "Use the visual analysis with a fresh MCP snapshot to choose the next safe action."
      ).slice(0, 800),
      confidence,
    };
  }

  private toStringArray(
    value: unknown,
    maxItems: number,
    maxLength: number
  ): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter((item) => item !== undefined && item !== null)
      .slice(0, maxItems)
      .map((item) => String(item).slice(0, maxLength));
  }

  private normalizeGoalProgress(value: unknown): VisionToolResult["goalProgress"] {
    const progress = value as Partial<VisionToolResult["goalProgress"]> | undefined;

    return {
      completed: this.toStringArray(progress?.completed, 8, 300),
      missing: this.toStringArray(progress?.missing, 8, 300),
      uncertain: this.toStringArray(progress?.uncertain, 8, 300),
      visibleEvidence: this.toStringArray(progress?.visibleEvidence, 10, 300),
    };
  }

  private normalizeGoalCompletionEstimate(
    value: unknown
  ): VisionToolResult["goalCompletionEstimate"] {
    const allowed: VisionToolResult["goalCompletionEstimate"][] = [
      "not_started",
      "partial",
      "likely_complete",
      "blocked",
      "unknown",
    ];
    const estimate = String(value || "");

    return allowed.includes(estimate as VisionToolResult["goalCompletionEstimate"])
      ? (estimate as VisionToolResult["goalCompletionEstimate"])
      : "unknown";
  }

  private logStructuredAnalysis(analysis: VisionToolResult): void {
    const meta = {
      confidence: analysis.confidence,
      pageSummary: analysis.pageSummary,
      componentCount: analysis.components.length,
      components: analysis.components.slice(0, 6),
      goalProgress: analysis.goalProgress,
      goalCompletionEstimate: analysis.goalCompletionEstimate,
      blockingElements: analysis.blockingElements,
      visibleErrors: analysis.visibleErrors,
      mismatch: analysis.mismatch,
      recommendedNextAction: analysis.recommendedNextAction,
    };

    logger.info(
      process.env.VISION_LOG_RESULT === "true"
        ? "VisionTool structured analysis"
        : "VisionTool structured analysis (summary)",
      process.env.VISION_LOG_RESULT === "true"
        ? meta
        : {
            confidence: meta.confidence,
            pageSummary: meta.pageSummary.slice(0, 500),
            componentCount: meta.componentCount,
            goalProgress: meta.goalProgress,
            goalCompletionEstimate: meta.goalCompletionEstimate,
            mismatch: meta.mismatch.slice(0, 500),
            recommendedNextAction: meta.recommendedNextAction.slice(0, 500),
          }
    );
  }
}

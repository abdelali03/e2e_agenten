import { Locator, Page } from "playwright";
import { Logger } from "../../../utils/Logger";
import type {
  ActionResult,
  LlmBrowserCommand,
  LlmLocatorSpec,
} from "../../../core/types";

const logger = new Logger("LlmCommandExecutor");
const ACTION_TIMEOUT = 15_000;

export class LlmCommandExecutorAgent {
  constructor(private readonly page: Page) {}

  public async execute(command: LlmBrowserCommand): Promise<ActionResult> {
    const start = Date.now();

    try {
      if (command.status !== "continue") {
        return {
          success: true,
          actionPerformed: command.status,
          durationMs: Date.now() - start,
        };
      }

      logger.info(`Executing LLM command: ${command.actionType}`, command);
      await this.perform(command);

      return {
        success: true,
        actionPerformed: `${command.actionType} ${JSON.stringify(
          command.locator ?? {}
        )}`,
        durationMs: Date.now() - start,
      };
    } catch (error) {
      return {
        success: false,
        actionPerformed: `${command.actionType ?? command.status}`,
        errorMessage: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - start,
      };
    }
  }

  private async perform(command: LlmBrowserCommand): Promise<void> {
    switch (command.actionType) {
      case "navigate":
        await this.page.goto(this.requiredValue(command, "navigate"), {
          waitUntil: "domcontentloaded",
          timeout: ACTION_TIMEOUT,
        });
        return;
      case "click":
        if (this.isCoordinate(command.locator)) {
          await this.page.mouse.click(command.locator.x, command.locator.y);
          return;
        }
        await (await this.requiredLocator(command)).click({ timeout: ACTION_TIMEOUT });
        return;
      case "doubleClick":
        await (await this.requiredLocator(command)).dblclick({
          timeout: ACTION_TIMEOUT,
        });
        return;
      case "fill":
        await (await this.requiredLocator(command)).fill(
          this.requiredValue(command, "fill"),
          { timeout: ACTION_TIMEOUT }
        );
        return;
      case "type":
        await (await this.requiredLocator(command)).pressSequentially(
          this.requiredValue(command, "type"),
          { timeout: ACTION_TIMEOUT }
        );
        return;
      case "clear":
        await (await this.requiredLocator(command)).clear({ timeout: ACTION_TIMEOUT });
        return;
      case "press":
        await this.page.keyboard.press(this.requiredValue(command, "press"));
        return;
      case "selectOption":
        await (await this.requiredLocator(command)).selectOption(
          this.requiredValue(command, "selectOption"),
          { timeout: ACTION_TIMEOUT }
        );
        return;
      case "check":
        await (await this.requiredLocator(command)).check({ timeout: ACTION_TIMEOUT });
        return;
      case "uncheck":
        await (await this.requiredLocator(command)).uncheck({
          timeout: ACTION_TIMEOUT,
        });
        return;
      case "hover":
        await (await this.requiredLocator(command)).hover({ timeout: ACTION_TIMEOUT });
        return;
      case "waitForVisible":
        await (await this.requiredLocator(command)).waitFor({
          state: "visible",
          timeout: ACTION_TIMEOUT,
        });
        return;
      case "waitForText":
        await this.page
          .getByText(this.requiredValue(command, "waitForText"), { exact: false })
          .first()
          .waitFor({ state: "visible", timeout: ACTION_TIMEOUT });
        return;
      case "assertVisible":
        if (!(await (await this.requiredLocator(command)).isVisible())) {
          throw new Error("Expected target to be visible");
        }
        return;
      case "assertText":
        await this.page
          .getByText(this.requiredValue(command, "assertText"), { exact: false })
          .first()
          .waitFor({ state: "visible", timeout: ACTION_TIMEOUT });
        return;
      case "assertUrl":
        if (!this.page.url().includes(this.requiredValue(command, "assertUrl"))) {
          throw new Error(`URL did not contain ${command.value}`);
        }
        return;
      case "scroll":
        await this.page.mouse.wheel(0, command.value?.includes("up") ? -700 : 700);
        return;
      case "wait":
        await this.page.waitForTimeout(Number(command.value) || 1000);
        return;
      default:
        throw new Error(`Unsupported LLM actionType: ${command.actionType}`);
    }
  }

  private async requiredLocator(command: LlmBrowserCommand): Promise<Locator> {
    const locator = await this.locatorFor(command.locator ?? { strategy: "none" });
    if (!locator) throw new Error(`${command.actionType} requires locator`);
    return locator;
  }

  private async locatorFor(spec: LlmLocatorSpec): Promise<Locator | null> {
    switch (spec.strategy) {
      case "none":
      case "coordinate":
        return null;
      case "uid":
        return this.page.locator(`[data-ai-uid="${this.escape(spec.value ?? "")}"]`).first();
      case "role":
        if (!spec.role) throw new Error("role locator requires role");
        return this.page
          .getByRole(spec.role as Parameters<Page["getByRole"]>[0], {
            name: spec.name ? new RegExp(this.escapeRegex(spec.name), "i") : undefined,
            exact: spec.exact,
          })
          .first();
      case "label":
        return this.page.getByLabel(new RegExp(this.escapeRegex(spec.value ?? ""), "i")).first();
      case "placeholder":
        return this.page
          .getByPlaceholder(new RegExp(this.escapeRegex(spec.value ?? ""), "i"))
          .first();
      case "text":
        return this.page.getByText(new RegExp(this.escapeRegex(spec.value ?? ""), "i")).first();
      case "testId":
        return this.page.getByTestId(spec.value ?? "").first();
      case "css":
        return this.page.locator(spec.value ?? "").first();
      case "xpath":
        return this.page.locator(`xpath=${spec.value ?? ""}`).first();
      default:
        throw new Error(`Unsupported locator strategy: ${spec.strategy}`);
    }
  }

  private requiredValue(command: LlmBrowserCommand, action: string): string {
    if (!command.value?.trim()) throw new Error(`${action} requires value`);
    return command.value;
  }

  private isCoordinate(
    spec: LlmLocatorSpec | undefined
  ): spec is LlmLocatorSpec & { x: number; y: number } {
    return spec?.strategy === "coordinate" && typeof spec.x === "number" && typeof spec.y === "number";
  }

  private escape(value: string): string {
    return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}

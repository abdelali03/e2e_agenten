// src/agents/ExecutorAgent.ts
// Reiner Playwright Executor ohne Stagehand.
// Das LLM entscheidet die Aktion + Ziel-UID/Selector.
// Playwright führt deterministisch aus.

import { Page, Locator } from "playwright";
import { Logger } from "../utils/Logger";
import { AnalystOutput, ActionResult } from "../core/types";

const logger = new Logger("ExecutorAgent");

const ACTION_TIMEOUT = 15_000;

export class ExecutorAgent {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  public async execute(decision: AnalystOutput): Promise<ActionResult> {
    const start = Date.now();

    logger.info(
      `Executing: ${decision.actionType} → "${decision.targetDescription}"`
    );

    try {
      await this.performAction(decision);

      const durationMs = Date.now() - start;

      logger.info(`✅ Action succeeded in ${durationMs}ms`);

      return {
        success: true,
        actionPerformed: `${decision.actionType} on "${
          decision.targetName ??
          decision.targetUid ??
          decision.selector ??
          decision.targetDescription
        }"`,
        durationMs,
      };
    } catch (error) {
      const durationMs = Date.now() - start;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      logger.warn(`❌ Action failed after ${durationMs}ms: ${errorMessage}`);

      return {
        success: false,
        actionPerformed: `${decision.actionType} on "${
          decision.targetName ??
          decision.targetUid ??
          decision.selector ??
          decision.targetDescription
        }"`,
        errorMessage,
        durationMs,
      };
    }
  }

  private async performAction(decision: AnalystOutput): Promise<void> {
    switch (decision.actionType) {
      case "navigate":
        await this.handleNavigate(decision);
        break;

      case "click":
        await this.handleClick(decision);
        break;

      case "doubleClick":
        await this.handleDoubleClick(decision);
        break;

      case "rightClick":
        await this.handleRightClick(decision);
        break;

      case "fill":
        await this.handleFill(decision);
        break;

      case "type":
        await this.handleType(decision);
        break;

      case "clear":
        await this.handleClear(decision);
        break;

      case "check":
        await this.handleCheck(decision);
        break;

      case "uncheck":
        await this.handleUncheck(decision);
        break;

      case "select":
        await this.handleSelect(decision);
        break;

      case "hover":
        await this.handleHover(decision);
        break;

      case "press":
        await this.handlePress(decision);
        break;

      case "waitForVisible":
        await this.handleWaitForVisible(decision);
        break;

      case "waitForHidden":
        await this.handleWaitForHidden(decision);
        break;

      case "waitForText":
        await this.handleWaitForText(decision);
        break;

      case "waitForUrl":
        await this.handleWaitForUrl(decision);
        break;

      case "assertVisible":
        await this.handleAssertVisible(decision);
        break;

      case "assertHidden":
        await this.handleAssertHidden(decision);
        break;

      case "assertText":
        await this.handleAssertText(decision);
        break;

      case "assertValue":
        await this.handleAssertValue(decision);
        break;

      case "assertUrl":
        await this.handleAssertUrl(decision);
        break;

      case "scrollIntoView":
        await this.handleScrollIntoView(decision);
        break;

      case "setDate":
        await this.handleSetDate(decision);
        break;

      case "setTime":
        await this.handleSetTime(decision);
        break;

      case "uploadFile":
        await this.handleUploadFile(decision);
        break;

      default:
        throw new Error(
          `Unknown actionType: ${(decision as AnalystOutput).actionType}`
        );
    }
  }

  // ─────────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────────

  private async handleNavigate(decision: AnalystOutput): Promise<void> {
    if (!decision.value) {
      throw new Error("navigate requires a value (URL)");
    }

    await this.page.goto(decision.value, {
      waitUntil: "domcontentloaded",
      timeout: ACTION_TIMEOUT,
    });
  }

  private async handleClick(decision: AnalystOutput): Promise<void> {
    const locator = await this.getRequiredLocator(decision);
    await locator.click({ timeout: ACTION_TIMEOUT });
  }

  private async handleDoubleClick(decision: AnalystOutput): Promise<void> {
    const locator = await this.getRequiredLocator(decision);
    await locator.dblclick({ timeout: ACTION_TIMEOUT });
  }

  private async handleRightClick(decision: AnalystOutput): Promise<void> {
    const locator = await this.getRequiredLocator(decision);
    await locator.click({ button: "right", timeout: ACTION_TIMEOUT });
  }

  private async handleFill(decision: AnalystOutput): Promise<void> {
    if (!decision.value) {
      throw new Error("fill requires a value");
    }

    const locator = await this.getRequiredLocator(decision);
    await locator.fill(decision.value, { timeout: ACTION_TIMEOUT });
  }

  private async handleType(decision: AnalystOutput): Promise<void> {
    if (!decision.value) {
      throw new Error("type requires a value");
    }

    const locator = await this.getRequiredLocator(decision);
    await locator.pressSequentially(decision.value, { timeout: ACTION_TIMEOUT });
  }

  private async handleClear(decision: AnalystOutput): Promise<void> {
    const locator = await this.getRequiredLocator(decision);
    await locator.clear({ timeout: ACTION_TIMEOUT });
  }

  private async handleCheck(decision: AnalystOutput): Promise<void> {
    const locator = await this.getRequiredLocator(decision);
    await locator.check({ timeout: ACTION_TIMEOUT });
  }

  private async handleUncheck(decision: AnalystOutput): Promise<void> {
    const locator = await this.getRequiredLocator(decision);
    await locator.uncheck({ timeout: ACTION_TIMEOUT });
  }

  private async handleSelect(decision: AnalystOutput): Promise<void> {
    if (!decision.value) {
      throw new Error("select requires a value");
    }

    const directLocator = await this.getRequiredLocator(decision);

    if (directLocator) {
      const tagName = await directLocator.evaluate((el) =>
        el.tagName.toLowerCase()
      );

      if (tagName === "select") {
        await directLocator.selectOption(decision.value, {
          timeout: ACTION_TIMEOUT,
        });
        return;
      }

      // Custom dropdown fallback
      await directLocator.click({ timeout: ACTION_TIMEOUT });
      await this.page.locator("text=" + decision.value).first().click({
        timeout: ACTION_TIMEOUT,
      });
      return;
    }
  }

  private async handleHover(decision: AnalystOutput): Promise<void> {
    const locator = await this.getRequiredLocator(decision);
    await locator.hover({ timeout: ACTION_TIMEOUT });
  }

  private async handlePress(decision: AnalystOutput): Promise<void> {
    if (!decision.value) {
      throw new Error("press requires a key value, e.g. 'Enter' or 'Tab'");
    }

    await this.page.keyboard.press(decision.value);
  }

  private async handleWaitForVisible(decision: AnalystOutput): Promise<void> {
    const locator = await this.getRequiredLocator(decision);
    await locator.waitFor({ state: "visible", timeout: ACTION_TIMEOUT });
  }

  private async handleWaitForHidden(decision: AnalystOutput): Promise<void> {
    const locator = await this.getRequiredLocator(decision);
    await locator.waitFor({ state: "hidden", timeout: ACTION_TIMEOUT });
  }

  private async handleWaitForText(decision: AnalystOutput): Promise<void> {
    if (!decision.value) {
      throw new Error("waitForText requires a value");
    }

    const directLocator = await this.getDirectLocator(decision);

    if (directLocator) {
      await directLocator.waitFor({ state: "visible", timeout: ACTION_TIMEOUT });
      await this.waitUntil(async () => {
        const text = await directLocator.innerText({ timeout: ACTION_TIMEOUT });
        return text.includes(decision.value!);
      }, `Text "${decision.value}" did not appear in target`);
      return;
    }

    await this.page.getByText(decision.value).first().waitFor({
      state: "visible",
      timeout: ACTION_TIMEOUT,
    });
  }

  private async handleWaitForUrl(decision: AnalystOutput): Promise<void> {
    if (!decision.value) {
      throw new Error("waitForUrl requires a value");
    }

    await this.page.waitForURL(
      (url) => url.toString().includes(decision.value!),
      { timeout: ACTION_TIMEOUT }
    );
  }

  private async handleAssertVisible(decision: AnalystOutput): Promise<void> {
    const locator = await this.getRequiredLocator(decision);

    if (!(await locator.isVisible({ timeout: ACTION_TIMEOUT }))) {
      throw new Error(`Expected "${this.getTargetText(decision)}" to be visible`);
    }
  }

  private async handleAssertHidden(decision: AnalystOutput): Promise<void> {
    const locator = await this.getRequiredLocator(decision);

    if (await locator.isVisible({ timeout: ACTION_TIMEOUT })) {
      throw new Error(`Expected "${this.getTargetText(decision)}" to be hidden`);
    }
  }

  private async handleAssertText(decision: AnalystOutput): Promise<void> {
    if (!decision.value) {
      throw new Error("assertText requires a value");
    }

    const directLocator = await this.getDirectLocator(decision);

    if (directLocator) {
      const text = await directLocator.innerText({ timeout: ACTION_TIMEOUT });
      if (!text.includes(decision.value)) {
        throw new Error(
          `Expected target text to contain "${decision.value}", got "${text}"`
        );
      }
      return;
    }

    if (!(await this.exists(this.page.getByText(decision.value).first()))) {
      throw new Error(`Expected page text "${decision.value}" to be visible`);
    }
  }

  private async handleAssertValue(decision: AnalystOutput): Promise<void> {
    if (!decision.value) {
      throw new Error("assertValue requires a value");
    }

    const locator = await this.getRequiredLocator(decision);
    const actualValue = await locator.inputValue({ timeout: ACTION_TIMEOUT });

    if (actualValue !== decision.value) {
      throw new Error(
        `Expected input value "${decision.value}", got "${actualValue}"`
      );
    }
  }

  private async handleAssertUrl(decision: AnalystOutput): Promise<void> {
    if (!decision.value) {
      throw new Error("assertUrl requires a value");
    }

    const currentUrl = this.page.url();

    if (!currentUrl.includes(decision.value)) {
      throw new Error(`Expected URL to contain "${decision.value}", got "${currentUrl}"`);
    }
  }

  private async handleScrollIntoView(decision: AnalystOutput): Promise<void> {
    const locator = await this.getRequiredLocator(decision);
    await locator.scrollIntoViewIfNeeded({ timeout: ACTION_TIMEOUT });
  }

  private async handleSetDate(decision: AnalystOutput): Promise<void> {
    if (!decision.value) {
      throw new Error("setDate requires a value");
    }

    const locator = await this.getRequiredLocator(decision);
    await locator.fill(await this.normalizeDateValue(locator, decision.value), {
      timeout: ACTION_TIMEOUT,
    });
  }

  private async handleSetTime(decision: AnalystOutput): Promise<void> {
    if (!decision.value) {
      throw new Error("setTime requires a value");
    }

    const locator = await this.getRequiredLocator(decision);
    await locator.fill(this.normalizeTimeValue(decision.value), {
      timeout: ACTION_TIMEOUT,
    });
  }

  private async handleUploadFile(decision: AnalystOutput): Promise<void> {
    if (!decision.value) {
      throw new Error("uploadFile requires a file path value");
    }

    const locator = await this.getRequiredLocator(decision);
    await locator.setInputFiles(decision.value, { timeout: ACTION_TIMEOUT });
  }

  // ─────────────────────────────────────────────
  // Locator helpers
  // ─────────────────────────────────────────────

  private async getDirectLocator(
    decision: AnalystOutput
  ): Promise<Locator | null> {
    if (decision.selector && decision.selector.trim().length > 0) {
      const locator = this.page.locator(decision.selector).first();

      if (await this.exists(locator)) {
        return locator;
      }
    }

    if (decision.targetUid && decision.targetUid.trim().length > 0) {
      const locator = this.page
        .locator(`[data-ai-uid="${this.escapeAttribute(decision.targetUid)}"]`)
        .first();

      if (await this.exists(locator)) {
        return locator;
      }
    }

    return null;
  }

  private async getRequiredLocator(decision: AnalystOutput): Promise<Locator> {
    const directLocator = await this.getDirectLocator(decision);

    if (directLocator) {
      return directLocator;
    }

    const target = this.getTargetText(decision);

    if (!target) {
      throw new Error(`No target locator or target text for ${decision.actionType}`);
    }

    const fallbackLocator = this.page.locator(`text=${target}`).first();

    if (await this.exists(fallbackLocator)) {
      return fallbackLocator;
    }

    throw new Error(`No element found for "${target}"`);
  }

  private async exists(locator: Locator): Promise<boolean> {
    try {
      return (await locator.count()) > 0;
    } catch {
      return false;
    }
  }

  private getTargetText(decision: AnalystOutput): string {
    return (
      decision.targetName?.trim() ||
      decision.targetDescription?.trim() ||
      decision.targetUid?.trim() ||
      ""
    );
  }

  private escapeAttribute(value: string): string {
    return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  private async waitUntil(
    predicate: () => Promise<boolean>,
    errorMessage: string
  ): Promise<void> {
    const startedAt = Date.now();

    while (Date.now() - startedAt < ACTION_TIMEOUT) {
      if (await predicate()) {
        return;
      }

      await this.page.waitForTimeout(250);
    }

    throw new Error(errorMessage);
  }

  private async normalizeDateValue(
    locator: Locator,
    value: string
  ): Promise<string> {
    const inputType = await locator.evaluate((el) =>
      el instanceof HTMLInputElement ? el.type : ""
    );

    if (inputType !== "date") {
      return value;
    }

    const germanDate = value.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (!germanDate) {
      return value;
    }

    const [, day, month, year] = germanDate;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  private normalizeTimeValue(value: string): string {
    const time = value.match(/^(\d{1,2})(?::|\.| Uhr )?(\d{2})?$/i);

    if (!time) {
      return value;
    }

    const [, hour, minute = "00"] = time;
    return `${hour.padStart(2, "0")}:${minute}`;
  }
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LlmCommandExecutorAgent = void 0;
const Logger_1 = require("../utils/Logger");
const logger = new Logger_1.Logger("LlmCommandExecutor");
const ACTION_TIMEOUT = 15_000;
class LlmCommandExecutorAgent {
    page;
    constructor(page) {
        this.page = page;
    }
    async execute(command) {
        const start = Date.now();
        try {
            if (command.status !== "continue") {
                return {
                    success: true,
                    actionPerformed: command.status,
                    durationMs: Date.now() - start,
                };
            }
            logger.info(`Executing LLM command: ${command.actionType}`, {
                locator: command.locator,
                value: command.value,
            });
            await this.perform(command);
            return {
                success: true,
                actionPerformed: this.describe(command),
                durationMs: Date.now() - start,
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.warn(`LLM command failed: ${errorMessage}`);
            return {
                success: false,
                actionPerformed: this.describe(command),
                errorMessage,
                durationMs: Date.now() - start,
            };
        }
    }
    async perform(command) {
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
                await this.clickWithRetry(await this.requiredLocator(command));
                return;
            case "doubleClick":
                if (this.isCoordinate(command.locator)) {
                    await this.page.mouse.dblclick(command.locator.x, command.locator.y);
                    return;
                }
                await (await this.requiredLocator(command)).dblclick({
                    timeout: ACTION_TIMEOUT,
                });
                return;
            case "fill":
                await (await this.requiredLocator(command)).fill(this.requiredValue(command, "fill"), { timeout: ACTION_TIMEOUT });
                return;
            case "type":
                await (await this.requiredLocator(command)).pressSequentially(this.requiredValue(command, "type"), { timeout: ACTION_TIMEOUT });
                return;
            case "clear":
                await (await this.requiredLocator(command)).clear({
                    timeout: ACTION_TIMEOUT,
                });
                return;
            case "press":
                await this.page.keyboard.press(this.requiredValue(command, "press"));
                return;
            case "selectOption":
                await (await this.requiredLocator(command)).selectOption(this.requiredValue(command, "selectOption"), { timeout: ACTION_TIMEOUT });
                return;
            case "check":
                await (await this.requiredLocator(command)).check({
                    timeout: ACTION_TIMEOUT,
                });
                return;
            case "uncheck":
                await (await this.requiredLocator(command)).uncheck({
                    timeout: ACTION_TIMEOUT,
                });
                return;
            case "hover":
                if (this.isCoordinate(command.locator)) {
                    await this.page.mouse.move(command.locator.x, command.locator.y);
                    return;
                }
                await (await this.requiredLocator(command)).hover({
                    timeout: ACTION_TIMEOUT,
                });
                return;
            case "waitForVisible":
                await (await this.requiredLocator(command)).waitFor({
                    state: "visible",
                    timeout: ACTION_TIMEOUT,
                });
                return;
            case "waitForText":
                await this.page
                    .getByText(this.requiredValue(command, "waitForText"), {
                    exact: false,
                })
                    .first()
                    .waitFor({ state: "visible", timeout: ACTION_TIMEOUT });
                return;
            case "assertVisible":
                if (!(await (await this.requiredLocator(command)).isVisible())) {
                    throw new Error("Expected LLM target to be visible");
                }
                return;
            case "assertText":
                await this.assertText(command);
                return;
            case "assertUrl":
                if (!this.page.url().includes(this.requiredValue(command, "assertUrl"))) {
                    throw new Error(`URL did not contain ${command.value}. Current: ${this.page.url()}`);
                }
                return;
            case "scroll":
                await this.scroll(command.value);
                return;
            case "wait":
                await this.page.waitForTimeout(this.parseWaitMs(command.value));
                return;
            default:
                throw new Error(`Unsupported LLM actionType: ${command.actionType}`);
        }
    }
    async requiredLocator(command) {
        const locator = await this.locatorFor(command.locator ?? { strategy: "none" });
        if (!locator) {
            throw new Error(`Command ${command.actionType} requires a locator`);
        }
        return locator;
    }
    async locatorFor(spec) {
        switch (spec.strategy) {
            case "none":
                return null;
            case "uid":
                return this.page
                    .locator(`[data-ai-uid="${this.escapeAttribute(this.requiredLocatorValue(spec))}"]`)
                    .first();
            case "role":
                if (!spec.role) {
                    throw new Error("role locator requires role");
                }
                return this.page
                    .getByRole(spec.role, {
                    name: spec.name ? this.toNameMatcher(spec.name, spec.exact) : undefined,
                    exact: spec.exact,
                })
                    .first();
            case "label":
                return this.page
                    .getByLabel(this.toNameMatcher(this.requiredLocatorValue(spec), spec.exact), {
                    exact: spec.exact,
                })
                    .first();
            case "placeholder":
                return this.page
                    .getByPlaceholder(this.toNameMatcher(this.requiredLocatorValue(spec), spec.exact), { exact: spec.exact })
                    .first();
            case "text":
                return this.page
                    .getByText(this.toNameMatcher(this.requiredLocatorValue(spec), spec.exact), {
                    exact: spec.exact,
                })
                    .first();
            case "testId":
                return this.page.getByTestId(this.requiredLocatorValue(spec)).first();
            case "css":
                return this.page.locator(this.requiredLocatorValue(spec)).first();
            case "xpath":
                return this.page.locator(`xpath=${this.requiredLocatorValue(spec)}`).first();
            case "coordinate":
                if (typeof spec.x !== "number" || typeof spec.y !== "number") {
                    throw new Error("coordinate locator requires x and y");
                }
                return null;
            default:
                throw new Error(`Unsupported locator strategy: ${spec.strategy}`);
        }
    }
    async clickWithRetry(locator) {
        try {
            await locator.click({ timeout: ACTION_TIMEOUT });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (!message.includes("intercepts pointer events")) {
                throw error;
            }
            await this.page.keyboard.press("Escape");
            await this.page.waitForTimeout(300);
            await locator.click({ timeout: ACTION_TIMEOUT });
        }
    }
    async assertText(command) {
        const expected = this.requiredValue(command, "assertText");
        const locator = command.locator ? await this.locatorFor(command.locator) : null;
        if (locator) {
            const text = await locator.innerText({ timeout: ACTION_TIMEOUT });
            if (!text.includes(expected)) {
                throw new Error(`Expected target text to contain "${expected}", got "${text}"`);
            }
            return;
        }
        await this.page
            .getByText(expected, { exact: false })
            .first()
            .waitFor({ state: "visible", timeout: ACTION_TIMEOUT });
    }
    async scroll(value) {
        const normalized = (value || "down").toLowerCase();
        const amountMatch = normalized.match(/-?\d+/);
        const amount = amountMatch ? Number(amountMatch[0]) : 700;
        const delta = normalized.includes("up") ? -Math.abs(amount) : Math.abs(amount);
        await this.page.mouse.wheel(0, delta);
        await this.page.waitForTimeout(250);
    }
    parseWaitMs(value) {
        if (!value)
            return 1000;
        const numeric = Number(value);
        if (Number.isFinite(numeric)) {
            return Math.max(0, Math.min(numeric, ACTION_TIMEOUT));
        }
        const seconds = value.match(/(\d+(?:\.\d+)?)\s*s/i);
        if (seconds) {
            return Math.max(0, Math.min(Number(seconds[1]) * 1000, ACTION_TIMEOUT));
        }
        return 1000;
    }
    requiredValue(command, action) {
        if (!command.value?.trim()) {
            throw new Error(`${action} requires value`);
        }
        return command.value;
    }
    isCoordinate(spec) {
        return (spec?.strategy === "coordinate" &&
            typeof spec.x === "number" &&
            typeof spec.y === "number");
    }
    requiredLocatorValue(spec) {
        if (!spec.value?.trim()) {
            throw new Error(`${spec.strategy} locator requires value`);
        }
        return spec.value;
    }
    toNameMatcher(value, exact) {
        if (exact) {
            return value;
        }
        return new RegExp(this.escapeRegExp(value), "i");
    }
    describe(command) {
        return `${command.actionType ?? command.status} ${JSON.stringify(command.locator ?? { strategy: "none" })}${command.value ? ` value="${command.value}"` : ""}`;
    }
    escapeAttribute(value) {
        return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    }
    escapeRegExp(value) {
        return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
}
exports.LlmCommandExecutorAgent = LlmCommandExecutorAgent;

"use strict";
// src/agents/ExecutorAgent.ts
// Reiner Playwright Executor ohne Stagehand.
// Das LLM entscheidet die Aktion + Ziel-UID/Selector.
// Playwright führt deterministisch aus.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExecutorAgent = void 0;
const Logger_1 = require("../../../utils/Logger");
const logger = new Logger_1.Logger("ExecutorAgent");
const ACTION_TIMEOUT = 15_000;
class ExecutorAgent {
    page;
    constructor(page) {
        this.page = page;
    }
    async execute(decision) {
        const start = Date.now();
        logger.info(`Executing: ${decision.actionType} → "${decision.targetDescription}"`);
        try {
            await this.performAction(decision);
            const durationMs = Date.now() - start;
            logger.info(`✅ Action succeeded in ${durationMs}ms`);
            return {
                success: true,
                actionPerformed: `${decision.actionType} on "${decision.targetName ??
                    decision.targetUid ??
                    decision.selector ??
                    decision.targetDescription}"`,
                durationMs,
            };
        }
        catch (error) {
            const durationMs = Date.now() - start;
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.warn(`❌ Action failed after ${durationMs}ms: ${errorMessage}`);
            return {
                success: false,
                actionPerformed: `${decision.actionType} on "${decision.targetName ??
                    decision.targetUid ??
                    decision.selector ??
                    decision.targetDescription}"`,
                errorMessage,
                durationMs,
            };
        }
    }
    async performAction(decision) {
        switch (decision.actionType) {
            case "observePage":
                await this.handleObservePage();
                break;
            case "navigate":
                await this.handleNavigate(decision);
                break;
            case "goBack":
                await this.page.goBack({ waitUntil: "domcontentloaded", timeout: ACTION_TIMEOUT });
                break;
            case "goForward":
                await this.page.goForward({ waitUntil: "domcontentloaded", timeout: ACTION_TIMEOUT });
                break;
            case "reload":
                await this.page.reload({ waitUntil: "domcontentloaded", timeout: ACTION_TIMEOUT });
                break;
            case "waitForPageReady":
                await this.handleWaitForPageReady();
                break;
            case "waitForNavigationOrStateChange":
                await this.handleWaitForNavigationOrStateChange();
                break;
            case "click":
                await this.handleClick(decision);
                break;
            case "clickText":
                await this.handleClickText(decision);
                break;
            case "clickNearest":
                await this.handleClickNearest(decision);
                break;
            case "clickRowContaining":
                await this.handleClickRowContaining(decision);
                break;
            case "clickCellContaining":
                await this.handleClickCellContaining(decision);
                break;
            case "clickOutside":
                await this.handleClickOutside();
                break;
            case "doubleClick":
                await this.handleDoubleClick(decision);
                break;
            case "rightClick":
                await this.handleRightClick(decision);
                break;
            case "fill":
            case "setValue":
            case "fillField":
                await this.handleFill(decision);
                break;
            case "fillForm":
                await this.handleFillForm(decision);
                break;
            case "type":
                await this.handleType(decision);
                break;
            case "appendText":
                await this.handleAppendText(decision);
                break;
            case "clear":
            case "clearValue":
                await this.handleClear(decision);
                break;
            case "check":
                await this.handleCheck(decision);
                break;
            case "uncheck":
                await this.handleUncheck(decision);
                break;
            case "select":
            case "selectOption":
                await this.handleSelect(decision);
                break;
            case "openDropdown":
            case "openDatePicker":
            case "openTimePicker":
                await this.handleClick(decision);
                break;
            case "closeDropdown":
            case "dismissOverlay":
                await this.handleDismissOverlay();
                break;
            case "toggle":
                await this.handleToggle(decision);
                break;
            case "selectRadio":
                await this.handleCheck(decision);
                break;
            case "hover":
                await this.handleHover(decision);
                break;
            case "focus":
                await this.handleFocus(decision);
                break;
            case "blur":
                await this.page.keyboard.press("Tab");
                break;
            case "press":
            case "pressShortcut":
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
            case "verifyTextVisible":
            case "verifyToast":
                await this.handleAssertText(decision);
                break;
            case "assertTextNotVisible":
                await this.handleAssertTextNotVisible(decision);
                break;
            case "assertValue":
                await this.handleAssertValue(decision);
                break;
            case "assertUrl":
                await this.handleAssertUrl(decision);
                break;
            case "assertTitle":
                await this.handleAssertTitle(decision);
                break;
            case "assertEnabled":
                await this.handleAssertEnabled(decision);
                break;
            case "assertDisabled":
                await this.handleAssertDisabled(decision);
                break;
            case "assertChecked":
                await this.handleAssertChecked(decision);
                break;
            case "scrollIntoView":
                await this.handleScrollIntoView(decision);
                break;
            case "scrollToText":
                await this.handleScrollToText(decision);
                break;
            case "scrollPage":
            case "scrollContainer":
                await this.handleScrollPage(decision);
                break;
            case "setDate":
            case "pickDate":
                await this.handleSetDate(decision);
                break;
            case "setTime":
            case "pickTime":
                await this.handleSetTime(decision);
                break;
            case "submitForm":
                await this.handleSubmitForm(decision);
                break;
            case "resetForm":
                await this.handleResetForm(decision);
                break;
            case "addRow":
                await this.handleClick(decision);
                break;
            case "deleteRow":
                await this.handleClick(decision);
                break;
            case "sortColumn":
                await this.handleClick(decision);
                break;
            case "filterColumn":
                await this.handleFilterColumn(decision);
                break;
            case "verifyRowExists":
                await this.handleVerifyRowExists(decision);
                break;
            case "verifyCellValue":
                await this.handleVerifyCellValue(decision);
                break;
            case "waitForDialog":
                await this.handleWaitForDialog();
                break;
            case "confirmDialog":
                await this.handleConfirmDialog();
                break;
            case "cancelDialog":
            case "closeDialog":
                await this.handleCloseDialog();
                break;
            case "waitForToast":
                await this.handleWaitForText(decision);
                break;
            case "uploadFile":
                await this.handleUploadFile(decision);
                break;
            default:
                throw new Error(`Unknown actionType: ${decision.actionType}`);
        }
    }
    // ─────────────────────────────────────────────
    // Actions
    // ─────────────────────────────────────────────
    async handleNavigate(decision) {
        if (!decision.value) {
            throw new Error("navigate requires a value (URL)");
        }
        await this.page.goto(decision.value, {
            waitUntil: "domcontentloaded",
            timeout: ACTION_TIMEOUT,
        });
    }
    async handleObservePage() {
        await this.handleWaitForPageReady();
    }
    async handleWaitForPageReady() {
        await this.page.waitForLoadState("domcontentloaded", { timeout: ACTION_TIMEOUT });
        await this.page.waitForLoadState("networkidle", { timeout: ACTION_TIMEOUT }).catch(() => {
            logger.debug("networkidle was not reached; continuing after domcontentloaded.");
        });
    }
    async handleWaitForNavigationOrStateChange() {
        const currentUrl = this.page.url();
        await Promise.race([
            this.page.waitForURL((url) => url.toString() !== currentUrl, {
                timeout: ACTION_TIMEOUT,
            }),
            this.page.waitForTimeout(1200),
        ]);
    }
    async handleClick(decision) {
        const locator = await this.getRequiredLocator(decision);
        try {
            await locator.click({ timeout: ACTION_TIMEOUT });
        }
        catch (error) {
            if (!this.isOverlayInterception(error)) {
                throw error;
            }
            logger.warn("Click was blocked by an overlay. Pressing Escape and retrying once.");
            await this.page.keyboard.press("Escape");
            await this.page.waitForTimeout(300);
            await locator.click({ timeout: ACTION_TIMEOUT });
        }
    }
    async handleClickText(decision) {
        if (!decision.value && !this.getTargetText(decision)) {
            throw new Error("clickText requires text value or target text");
        }
        const text = decision.value || this.getTargetText(decision);
        await this.clickWithOverlayRetry(this.page.getByText(text, { exact: false }).first());
    }
    async handleClickNearest(decision) {
        const locator = await this.getRequiredLocator(decision);
        await this.clickWithOverlayRetry(locator);
    }
    async handleClickRowContaining(decision) {
        const text = decision.value || this.getTargetText(decision);
        if (!text)
            throw new Error("clickRowContaining requires row text");
        const row = this.page
            .locator("tr,[role='row']")
            .filter({ hasText: text })
            .first();
        if (await this.exists(row)) {
            await this.clickWithOverlayRetry(row);
            return;
        }
        await this.clickWithOverlayRetry(this.page.getByText(text, { exact: false }).first());
    }
    async handleClickCellContaining(decision) {
        const text = decision.value || this.getTargetText(decision);
        if (!text)
            throw new Error("clickCellContaining requires cell text");
        const cell = this.page
            .locator("td,th,[role='cell'],[role='gridcell']")
            .filter({ hasText: text })
            .first();
        if (await this.exists(cell)) {
            await this.clickWithOverlayRetry(cell);
            return;
        }
        await this.handleClickRowContaining(decision);
    }
    async handleClickOutside() {
        await this.page.mouse.click(5, 5);
    }
    async handleDoubleClick(decision) {
        const locator = await this.getRequiredLocator(decision);
        await locator.dblclick({ timeout: ACTION_TIMEOUT });
    }
    async handleRightClick(decision) {
        const locator = await this.getRequiredLocator(decision);
        await locator.click({ button: "right", timeout: ACTION_TIMEOUT });
    }
    async handleFill(decision) {
        if (!decision.value) {
            throw new Error("fill requires a value");
        }
        const locator = await this.getRequiredLocator(decision);
        await this.setValueWithStrategies(locator, decision.value);
    }
    async handleFillForm(decision) {
        if (!decision.value) {
            throw new Error("fillForm requires a JSON object value");
        }
        let fields;
        try {
            fields = JSON.parse(decision.value);
        }
        catch {
            throw new Error("fillForm value must be JSON, e.g. {\"Email\":\"a@b.de\"}");
        }
        for (const [label, value] of Object.entries(fields)) {
            const locator = this.page
                .getByLabel(label)
                .or(this.page.getByPlaceholder(label))
                .or(this.page.locator(`input[name="${this.escapeCssString(label)}"]`))
                .first();
            await this.setValueWithStrategies(locator, value);
        }
    }
    async handleType(decision) {
        if (!decision.value) {
            throw new Error("type requires a value");
        }
        const locator = await this.getRequiredLocator(decision);
        await locator.pressSequentially(decision.value, { timeout: ACTION_TIMEOUT });
    }
    async handleAppendText(decision) {
        if (!decision.value) {
            throw new Error("appendText requires a value");
        }
        const locator = await this.getRequiredLocator(decision);
        await locator.focus({ timeout: ACTION_TIMEOUT });
        await locator.pressSequentially(decision.value, { timeout: ACTION_TIMEOUT });
    }
    async handleClear(decision) {
        const locator = await this.getRequiredLocator(decision);
        await locator.clear({ timeout: ACTION_TIMEOUT });
    }
    async handleCheck(decision) {
        const locator = await this.getRequiredLocator(decision);
        await locator.check({ timeout: ACTION_TIMEOUT });
    }
    async handleUncheck(decision) {
        const locator = await this.getRequiredLocator(decision);
        await locator.uncheck({ timeout: ACTION_TIMEOUT });
    }
    async handleSelect(decision) {
        if (!decision.value) {
            throw new Error("select requires a value");
        }
        const directLocator = await this.getRequiredLocator(decision);
        if (directLocator) {
            const tagName = await directLocator.evaluate((el) => el.tagName.toLowerCase());
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
    async handleFilterColumn(decision) {
        if (!decision.value) {
            throw new Error("filterColumn requires a filter value");
        }
        const locator = await this.getRequiredLocator(decision);
        await this.clickWithOverlayRetry(locator);
        await this.page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
        await this.page.keyboard.type(decision.value);
        await this.page.keyboard.press("Enter");
    }
    async handleHover(decision) {
        const locator = await this.getRequiredLocator(decision);
        await locator.hover({ timeout: ACTION_TIMEOUT });
    }
    async handleFocus(decision) {
        const locator = await this.getRequiredLocator(decision);
        await locator.focus({ timeout: ACTION_TIMEOUT });
    }
    async handleToggle(decision) {
        const locator = await this.getRequiredLocator(decision);
        await this.clickWithOverlayRetry(locator);
    }
    async handlePress(decision) {
        if (!decision.value) {
            throw new Error("press requires a key value, e.g. 'Enter' or 'Tab'");
        }
        await this.page.keyboard.press(decision.value);
    }
    async handleWaitForVisible(decision) {
        const locator = await this.getRequiredLocator(decision);
        await locator.waitFor({ state: "visible", timeout: ACTION_TIMEOUT });
    }
    async handleWaitForHidden(decision) {
        const locator = await this.getRequiredLocator(decision);
        await locator.waitFor({ state: "hidden", timeout: ACTION_TIMEOUT });
    }
    async handleWaitForText(decision) {
        if (!decision.value) {
            throw new Error("waitForText requires a value");
        }
        const directLocator = await this.getDirectLocator(decision);
        if (directLocator) {
            await directLocator.waitFor({ state: "visible", timeout: ACTION_TIMEOUT });
            await this.waitUntil(async () => {
                const text = await directLocator.innerText({ timeout: ACTION_TIMEOUT });
                return text.includes(decision.value);
            }, `Text "${decision.value}" did not appear in target`);
            return;
        }
        await this.page.getByText(decision.value).first().waitFor({
            state: "visible",
            timeout: ACTION_TIMEOUT,
        });
    }
    async handleWaitForUrl(decision) {
        if (!decision.value) {
            throw new Error("waitForUrl requires a value");
        }
        await this.page.waitForURL((url) => url.toString().includes(decision.value), { timeout: ACTION_TIMEOUT });
    }
    async handleAssertVisible(decision) {
        const locator = await this.getRequiredLocator(decision);
        if (!(await locator.isVisible({ timeout: ACTION_TIMEOUT }))) {
            throw new Error(`Expected "${this.getTargetText(decision)}" to be visible`);
        }
    }
    async handleAssertHidden(decision) {
        const locator = await this.getRequiredLocator(decision);
        if (await locator.isVisible({ timeout: ACTION_TIMEOUT })) {
            throw new Error(`Expected "${this.getTargetText(decision)}" to be hidden`);
        }
    }
    async handleAssertText(decision) {
        if (!decision.value) {
            throw new Error("assertText requires a value");
        }
        const directLocator = await this.getDirectLocator(decision);
        if (directLocator) {
            const text = await directLocator.innerText({ timeout: ACTION_TIMEOUT });
            if (!text.includes(decision.value)) {
                throw new Error(`Expected target text to contain "${decision.value}", got "${text}"`);
            }
            return;
        }
        if (!(await this.exists(this.page.getByText(decision.value).first()))) {
            throw new Error(`Expected page text "${decision.value}" to be visible`);
        }
    }
    async handleAssertTextNotVisible(decision) {
        if (!decision.value) {
            throw new Error("assertTextNotVisible requires a value");
        }
        if (await this.exists(this.page.getByText(decision.value).first())) {
            throw new Error(`Expected page text "${decision.value}" to be hidden`);
        }
    }
    async handleAssertValue(decision) {
        if (!decision.value) {
            throw new Error("assertValue requires a value");
        }
        const locator = await this.getRequiredLocator(decision);
        const actualValue = await locator.inputValue({ timeout: ACTION_TIMEOUT });
        if (actualValue !== decision.value) {
            throw new Error(`Expected input value "${decision.value}", got "${actualValue}"`);
        }
    }
    async handleAssertUrl(decision) {
        if (!decision.value) {
            throw new Error("assertUrl requires a value");
        }
        const currentUrl = this.page.url();
        if (!currentUrl.includes(decision.value)) {
            throw new Error(`Expected URL to contain "${decision.value}", got "${currentUrl}"`);
        }
    }
    async handleAssertTitle(decision) {
        if (!decision.value) {
            throw new Error("assertTitle requires a value");
        }
        const title = await this.page.title();
        if (!title.includes(decision.value)) {
            throw new Error(`Expected title to contain "${decision.value}", got "${title}"`);
        }
    }
    async handleAssertEnabled(decision) {
        const locator = await this.getRequiredLocator(decision);
        if (!(await locator.isEnabled({ timeout: ACTION_TIMEOUT }))) {
            throw new Error(`Expected "${this.getTargetText(decision)}" to be enabled`);
        }
    }
    async handleAssertDisabled(decision) {
        const locator = await this.getRequiredLocator(decision);
        if (await locator.isEnabled({ timeout: ACTION_TIMEOUT })) {
            throw new Error(`Expected "${this.getTargetText(decision)}" to be disabled`);
        }
    }
    async handleAssertChecked(decision) {
        const locator = await this.getRequiredLocator(decision);
        if (!(await locator.isChecked({ timeout: ACTION_TIMEOUT }))) {
            throw new Error(`Expected "${this.getTargetText(decision)}" to be checked`);
        }
    }
    async handleScrollIntoView(decision) {
        const locator = await this.getRequiredLocator(decision);
        await locator.scrollIntoViewIfNeeded({ timeout: ACTION_TIMEOUT });
    }
    async handleScrollToText(decision) {
        const text = decision.value || this.getTargetText(decision);
        if (!text)
            throw new Error("scrollToText requires text");
        const locator = this.page.getByText(text, { exact: false }).first();
        await locator.scrollIntoViewIfNeeded({ timeout: ACTION_TIMEOUT });
    }
    async handleScrollPage(decision) {
        const direction = (decision.value || "down").toLowerCase();
        const delta = direction.includes("up") ? -700 : 700;
        await this.page.mouse.wheel(0, delta);
        await this.page.waitForTimeout(250);
    }
    async handleSetDate(decision) {
        if (!decision.value) {
            throw new Error("setDate requires a value");
        }
        const locator = await this.getRequiredLocator(decision);
        await this.setValueWithStrategies(locator, await this.normalizeDateValue(locator, decision.value));
    }
    async handleSetTime(decision) {
        if (!decision.value) {
            throw new Error("setTime requires a value");
        }
        const locator = await this.getRequiredLocator(decision);
        await this.setValueWithStrategies(locator, this.normalizeTimeValue(decision.value));
    }
    async handleSubmitForm(decision) {
        const locator = await this.getDirectLocator(decision);
        if (locator) {
            await locator.evaluate((el) => {
                const form = el instanceof HTMLFormElement ? el : el.closest("form");
                if (form) {
                    form.requestSubmit();
                    return;
                }
                el.click();
            });
            return;
        }
        await this.page.keyboard.press("Enter");
    }
    async handleResetForm(decision) {
        const locator = await this.getRequiredLocator(decision);
        await locator.evaluate((el) => {
            const form = el instanceof HTMLFormElement ? el : el.closest("form");
            if (!form)
                throw new Error("No form found for reset");
            form.reset();
        });
    }
    async handleVerifyRowExists(decision) {
        const text = decision.value || this.getTargetText(decision);
        if (!text)
            throw new Error("verifyRowExists requires row text");
        const row = this.page.locator("tr,[role='row']").filter({ hasText: text }).first();
        if (!(await this.exists(row))) {
            throw new Error(`Expected row containing "${text}" to exist`);
        }
    }
    async handleVerifyCellValue(decision) {
        if (!decision.value)
            throw new Error("verifyCellValue requires a value");
        await this.handleAssertText(decision);
    }
    async handleWaitForDialog() {
        await this.page.locator("[role='dialog'],dialog").first().waitFor({
            state: "visible",
            timeout: ACTION_TIMEOUT,
        });
    }
    async handleConfirmDialog() {
        const button = this.page
            .getByRole("button", { name: /ok|yes|ja|confirm|bestätigen|speichern/i })
            .first();
        await this.clickWithOverlayRetry(button);
    }
    async handleCloseDialog() {
        const button = this.page
            .getByRole("button", { name: /close|cancel|abbrechen|schließen|x/i })
            .first();
        if (await this.exists(button)) {
            await this.clickWithOverlayRetry(button);
            return;
        }
        await this.page.keyboard.press("Escape");
    }
    async handleDismissOverlay() {
        await this.page.keyboard.press("Escape");
        await this.page.waitForTimeout(250);
    }
    async handleUploadFile(decision) {
        if (!decision.value) {
            throw new Error("uploadFile requires a file path value");
        }
        const locator = await this.getRequiredLocator(decision);
        await locator.setInputFiles(decision.value, { timeout: ACTION_TIMEOUT });
    }
    async clickWithOverlayRetry(locator) {
        try {
            await locator.click({ timeout: ACTION_TIMEOUT });
        }
        catch (error) {
            if (!this.isOverlayInterception(error)) {
                throw error;
            }
            logger.warn("Click was blocked by an overlay. Pressing Escape and retrying once.");
            await this.page.keyboard.press("Escape");
            await this.page.waitForTimeout(300);
            await locator.click({ timeout: ACTION_TIMEOUT });
        }
    }
    async setValueWithStrategies(locator, value) {
        const strategies = [
            async () => {
                logger.debug("setValue strategy: direct fill");
                await locator.fill(value, { timeout: ACTION_TIMEOUT });
            },
            async () => {
                logger.debug("setValue strategy: click, select all, type, tab");
                await this.clickWithOverlayRetry(locator);
                await this.selectAll();
                await this.page.keyboard.type(value);
                await this.page.keyboard.press("Tab");
            },
            async () => {
                logger.debug("setValue strategy: focus inner input");
                const inner = locator.locator("input,textarea,[contenteditable='true']").first();
                await inner.fill(value, { timeout: ACTION_TIMEOUT });
            },
            async () => {
                logger.debug("setValue strategy: keyboard commit");
                await this.clickWithOverlayRetry(locator);
                await this.selectAll();
                await this.page.keyboard.type(value);
                await this.page.keyboard.press("Enter");
            },
        ];
        let lastError;
        for (const strategy of strategies) {
            try {
                await strategy();
                await this.page.waitForTimeout(250);
                if (await this.valueLooksApplied(locator, value)) {
                    return;
                }
                lastError = new Error(`Value "${value}" was not visible/applied after strategy.`);
            }
            catch (error) {
                lastError = error;
            }
        }
        throw lastError instanceof Error
            ? lastError
            : new Error(`Could not set value "${value}"`);
    }
    async valueLooksApplied(locator, value) {
        const normalizedExpected = this.normalizeComparableValue(value);
        try {
            const inputValue = await locator.inputValue({ timeout: 1_000 });
            if (this.normalizeComparableValue(inputValue).includes(normalizedExpected)) {
                return true;
            }
        }
        catch {
            // Not every target exposes inputValue.
        }
        try {
            const innerInput = locator.locator("input,textarea").first();
            if (await this.exists(innerInput)) {
                const inputValue = await innerInput.inputValue({ timeout: 1_000 });
                if (this.normalizeComparableValue(inputValue).includes(normalizedExpected)) {
                    return true;
                }
            }
        }
        catch {
            // Fall through to visible text.
        }
        try {
            const text = await locator.innerText({ timeout: 1_000 });
            return this.normalizeComparableValue(text).includes(normalizedExpected);
        }
        catch {
            return true;
        }
    }
    async selectAll() {
        await this.page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
    }
    normalizeComparableValue(value) {
        return value.replace(/\s+/g, "").trim().toLowerCase();
    }
    // ─────────────────────────────────────────────
    // Locator helpers
    // ─────────────────────────────────────────────
    async getDirectLocator(decision) {
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
    async getRequiredLocator(decision) {
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
    async exists(locator) {
        try {
            return (await locator.count()) > 0;
        }
        catch {
            return false;
        }
    }
    getTargetText(decision) {
        return (decision.targetName?.trim() ||
            decision.targetDescription?.trim() ||
            decision.targetUid?.trim() ||
            "");
    }
    escapeAttribute(value) {
        return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    }
    escapeCssString(value) {
        return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    }
    async waitUntil(predicate, errorMessage) {
        const startedAt = Date.now();
        while (Date.now() - startedAt < ACTION_TIMEOUT) {
            if (await predicate()) {
                return;
            }
            await this.page.waitForTimeout(250);
        }
        throw new Error(errorMessage);
    }
    async normalizeDateValue(locator, value) {
        const inputType = await locator.evaluate((el) => el instanceof HTMLInputElement ? el.type : "");
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
    normalizeTimeValue(value) {
        const time = value.match(/^(\d{1,2})(?::|\.| Uhr )?(\d{2})?$/i);
        if (!time) {
            return value;
        }
        const [, hour, minute = "00"] = time;
        return `${hour.padStart(2, "0")}:${minute}`;
    }
    isOverlayInterception(error) {
        const message = error instanceof Error ? error.message : String(error);
        return (message.includes("intercepts pointer events") &&
            (message.includes("MuiBackdrop") ||
                message.includes("MuiPopover") ||
                message.includes("MuiModal") ||
                message.includes("backdrop")));
    }
}
exports.ExecutorAgent = ExecutorAgent;

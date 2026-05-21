"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const BrowserManager_1 = require("./systems/deterministic-playwright/core/BrowserManager");
const Logger_1 = require("./utils/Logger");
const logger = new Logger_1.Logger("Bootstrap");
async function main() {
    logger.info("AI Test Agent starting...");
    const browser = BrowserManager_1.BrowserManager.getInstance();
    try {
        await browser.initialize();
        logger.info("Browser initialized successfully.");
        await browser.navigateTo("http://localhost:82/login");
        logger.info("Navigation successful.");
        const screenshot = await browser.takeScreenshot();
        logger.debug(`Screenshot captured (base64 length: ${screenshot.length})`);
        logger.info("✅ Smoke test passed – System ready for agent orchestration.");
    }
    catch (error) {
        logger.error("Initialization failed:", error);
        process.exit(1);
    }
    finally {
        await browser.close();
    }
}
main();

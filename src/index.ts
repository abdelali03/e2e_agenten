import dotenv from "dotenv";
dotenv.config();

import { BrowserManager } from "./systems/deterministic-playwright/core/BrowserManager";
import { Logger } from "./utils/Logger";

const logger = new Logger("Bootstrap");

async function main(): Promise<void> {
  logger.info("AI Test Agent starting...");

  const browser = BrowserManager.getInstance();

  try {
    await browser.initialize();
    logger.info("Browser initialized successfully.");

    await browser.navigateTo("http://localhost:82/login");
    logger.info("Navigation successful.");

    const screenshot = await browser.takeScreenshot();
    logger.debug(`Screenshot captured (base64 length: ${screenshot.length})`);

    logger.info("✅ Smoke test passed – System ready for agent orchestration.");
  } catch (error) {
    logger.error("Initialization failed:", error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();

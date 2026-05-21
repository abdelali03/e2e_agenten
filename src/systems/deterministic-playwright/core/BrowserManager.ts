// src/core/BrowserManager.ts
// Reiner Playwright BrowserManager ohne Stagehand

import { chromium, Browser, Page, BrowserContext } from "playwright";
import dotenv from "dotenv";
import { Logger } from "../../../utils/Logger";

dotenv.config();

const logger = new Logger("BrowserManager");

export class BrowserManager {
  private static instance: BrowserManager | null = null;

  private _browser: Browser | null = null;
  private _context: BrowserContext | null = null;
  private _page: Page | null = null;

  private constructor() {}

  public static getInstance(): BrowserManager {
    if (!BrowserManager.instance) {
      BrowserManager.instance = new BrowserManager();
    }
    return BrowserManager.instance;
  }

  public static resetInstance(): void {
    BrowserManager.instance = null;
  }

  public async initialize(): Promise<void> {
    if (this._browser && this._context && this._page) {
      logger.info("Already initialized – skipping.");
      return;
    }

    logger.info("Initializing Playwright browser");

    this._browser = await chromium.launch({
      headless: process.env.HEADLESS === "true",
    });

    this._context = await this._browser.newContext({
      viewport: { width: 1280, height: 720 },
    });

    this._page = await this._context.newPage();

    logger.info("Playwright browser initialized successfully.");
  }

  public get page(): Page {
    if (!this._page) {
      throw new Error("BrowserManager not initialized. Call initialize() first.");
    }

    return this._page;
  }

  public async navigateTo(url: string): Promise<void> {
    await this.page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });

    logger.info(`Navigated to: ${url}`);
  }

  public async takeScreenshot(): Promise<string> {
    const buffer = await this.page.screenshot({
      type: "png",
      fullPage: false,
    });

    return buffer.toString("base64");
  }

  public async close(): Promise<void> {
    if (this._context) {
      await this._context.close();
      this._context = null;
    }

    if (this._browser) {
      await this._browser.close();
      this._browser = null;
    }

    this._page = null;
    BrowserManager.instance = null;

    logger.info("Browser closed.");
  }
}

"use strict";
// src/core/BrowserManager.ts
// Reiner Playwright BrowserManager ohne Stagehand
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrowserManager = void 0;
const playwright_1 = require("playwright");
const dotenv_1 = __importDefault(require("dotenv"));
const Logger_1 = require("../utils/Logger");
dotenv_1.default.config();
const logger = new Logger_1.Logger("BrowserManager");
class BrowserManager {
    static instance = null;
    _browser = null;
    _context = null;
    _page = null;
    constructor() { }
    static getInstance() {
        if (!BrowserManager.instance) {
            BrowserManager.instance = new BrowserManager();
        }
        return BrowserManager.instance;
    }
    static resetInstance() {
        BrowserManager.instance = null;
    }
    async initialize() {
        if (this._browser && this._context && this._page) {
            logger.info("Already initialized – skipping.");
            return;
        }
        logger.info("Initializing Playwright browser");
        this._browser = await playwright_1.chromium.launch({
            headless: process.env.HEADLESS === "true",
        });
        this._context = await this._browser.newContext({
            viewport: { width: 1280, height: 720 },
        });
        this._page = await this._context.newPage();
        logger.info("Playwright browser initialized successfully.");
    }
    get page() {
        if (!this._page) {
            throw new Error("BrowserManager not initialized. Call initialize() first.");
        }
        return this._page;
    }
    async navigateTo(url) {
        await this.page.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: 30_000,
        });
        logger.info(`Navigated to: ${url}`);
    }
    async takeScreenshot() {
        const buffer = await this.page.screenshot({
            type: "png",
            fullPage: false,
        });
        return buffer.toString("base64");
    }
    async close() {
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
exports.BrowserManager = BrowserManager;

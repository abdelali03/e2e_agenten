"use strict";
// src/tests/registration-and-appointment.ts
// Vollständiger E2E-Test: Registrierung → Login → Termin erstellen
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const DirectRunner_1 = require("../core/DirectRunner");
const BrowserManager_1 = require("../core/BrowserManager");
const Logger_1 = require("../utils/Logger");
const logger = new Logger_1.Logger("Test:RegistrationAndAppointment");
const START_URL = "http://localhost:82/login";
const steps = [
    { id: 11, instruction: "Fill the username or email field with aelamine@conet.de" },
    { id: 12, instruction: "Fill the login password field with 12345678" },
    { id: 13, instruction: "Click the ANMELDEN login button" },
    // ── Termin erstellen ─────────────────────────────────────────────────
    { id: 14, instruction: "Wait until the Termine navigation button is visible" },
    { id: 15, instruction: "Click the Termine navigation button" },
    { id: 16, instruction: "Fill the Name des Termins field with testtermin" },
    { id: 17, instruction: "Fill the Kurzbeschreibung field with terminbeschreibung" },
    { id: 18, instruction: "Set Start time hour to 09" },
    { id: 19, instruction: "Set Start time minute to 00" },
    { id: 20, instruction: "Set Ende time hour to 10" },
    { id: 21, instruction: "Set Ende time minute to 00" },
    { id: 22, instruction: "Set date field to 19.05.2026" },
    { id: 23, instruction: "Click the Termin erstellen button" },
];
async function main() {
    logger.info(`Starting E2E test: ${steps.length} steps`);
    const runner = new DirectRunner_1.DirectRunner({
        startUrl: START_URL,
        stepDelayMs: 1000,
        screenshotOnFailure: true,
    });
    try {
        const state = await runner.run(steps, "registration-and-appointment");
        const finalState = state.getState();
        process.exit(finalState.isComplete ? 0 : 1);
    }
    catch (error) {
        logger.error("Unhandled error:", error);
        process.exit(1);
    }
    finally {
        await BrowserManager_1.BrowserManager.getInstance().close();
    }
}
main();

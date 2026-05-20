// src/tests/registration-and-appointment.ts
// Vollständiger E2E-Test: Registrierung → Login → Termin erstellen

import dotenv from "dotenv";
dotenv.config();

import { DirectRunner, TestStep } from "../core/DirectRunner";
import { BrowserManager } from "../core/BrowserManager";
import { Logger } from "../utils/Logger";

const logger = new Logger("Test:RegistrationAndAppointment");

const START_URL = "http://localhost:82/login";

const steps: TestStep[] = [
  { id: 11, instruction: "Fill the username or email field with test@conet.de" },
  { id: 12, instruction: "Fill the login password field with Passwort123" },
  { id: 13, instruction: "Click the ANMELDEN login button" },

  // ── Termin erstellen ─────────────────────────────────────────────────
  { id: 14, instruction: "Wait until the Termine navigation button is visible, then click it" },
  { id: 15, instruction: "Fill the Name des Termins field with testtermin" },
  { id: 16, instruction: "Fill the Kurzbeschreibung field with terminbeschreibung" },
  { id: 17, instruction: "Set Start time hour to 09" },
  { id: 18, instruction: "Set Start time minute to 00" },
  { id: 19, instruction: "Set Ende time hour to 10" },
  { id: 20, instruction: "Set Ende time minute to 00" },
  { id: 21, instruction: "Set date field to 19.05.2026" },
  { id: 22, instruction: "Click the Termin erstellen button" },
];

async function main(): Promise<void> {
  logger.info(`Starting E2E test: ${steps.length} steps`);

  const runner = new DirectRunner({
    startUrl: START_URL,
    stepDelayMs: 1000,
    screenshotOnFailure: true,
  });

  try {
    const state = await runner.run(steps, "registration-and-appointment");
    const finalState = state.getState();
    process.exit(finalState.isComplete ? 0 : 1);
  } catch (error) {
    logger.error("Unhandled error:", error);
    process.exit(1);
  } finally {
    await BrowserManager.getInstance().close();
  }
}

main();
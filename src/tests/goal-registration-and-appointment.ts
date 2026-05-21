import dotenv from "dotenv";
dotenv.config();

import { AdaptiveOrchestrator } from "../systems/deterministic-playwright/core/AdaptiveOrchestrator";
import { BrowserManager } from "../systems/deterministic-playwright/core/BrowserManager";
import { Logger } from "../utils/Logger";
import type { GoalInput } from "../core/types";

const logger = new Logger("Test:GoalRegistrationAndAppointment");

const goalInput: GoalInput = {
  url: "http://localhost:82/login",
  goal:
    "Melde dich an und erstelle einen neuen Termin mit den angegebenen Testdaten.",
  testData: {
    credentials: {
      username: process.env.TEST_USERNAME || "aelamine@conet.de",
      password: process.env.TEST_PASSWORD || "12345678",
    },
    appointment: {
      name: process.env.TEST_APPOINTMENT_NAME || "testtermin",
      description:
        process.env.TEST_APPOINTMENT_DESCRIPTION || "terminbeschreibung",
      date: process.env.TEST_APPOINTMENT_DATE || "19.05.2026",
      startTime: process.env.TEST_APPOINTMENT_START || "09:00",
      endTime: process.env.TEST_APPOINTMENT_END || "10:00",
    },
  },
  context:
    "Die Anwendung landet nach erfolgreichem Login typischerweise auf der Root-Seite '/'. Verwende sichtbare Navigationselemente wie 'Termine' statt eine Dashboard-URL zu erwarten.",
};

async function main(): Promise<void> {
  logger.info("Starting adaptive goal-based E2E test");

  const runner = new AdaptiveOrchestrator({
    maxActions: 30,
    maxRetriesPerAction: 3,
    stepDelayMs: 1000,
    screenshotOnFailure: true,
    verifyEveryActions: 3,
  });

  try {
    const result = await runner.run(
      goalInput,
      "goal-registration-and-appointment"
    );
    process.exit(result.status === "passed" ? 0 : 1);
  } catch (error) {
    logger.error("Unhandled error:", error);
    process.exit(1);
  } finally {
    await BrowserManager.getInstance().close();
  }
}

main();

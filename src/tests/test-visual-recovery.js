require("dotenv").config();

const { readFile } = require("fs/promises");
const { VisionClient } = require("../../dist/utils/VisionClient");

async function main() {
  const imagePath = process.argv[2] || "src/screenshots/image.png";
  const buffer = await readFile(imagePath);
  const vision = new VisionClient();

  const analysis = await vision.analyzeUiRecovery({
    screenshotBase64: buffer.toString("base64"),
    goal:
      "Add a new row in the zeiterfassung table for 01.05.2026, set Startzeit to 09:00, Endzeit to 10:00, Beschreibung to testbeschreibung, then click Prüfen und Speichern.",
    instruction: "Fill the Startzeit field with 09:00",
    expectedOutcome: "Startzeit field visibly shows 09:00 and Endzeit becomes editable.",
    errorMessage:
      "Executor reported success, but verifier says Startzeit still shows placeholder hh:mm.",
  });

  console.log(JSON.stringify(analysis, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

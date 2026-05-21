require("dotenv").config();

const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

async function main() {
  const imagePath = process.argv[2];
  const prompt =
    process.argv.slice(3).join(" ") ||
    "Describe this screenshot in detail. Focus on visible UI state, filled fields, placeholders, disabled fields, errors, dialogs, tables, buttons, and likely next action.";

  if (!imagePath) {
    throw new Error(
      "Usage: node src/tests/describe-image-with-minimax.js <image-path> [prompt]"
    );
  }

  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) {
    throw new Error("MINIMAX_API_KEY is missing in .env");
  }

  const command = process.env.MINIMAX_VISION_COMMAND || "mmx";
  const mmxArgs = [
    "--api-key",
    apiKey,
    "vision",
    "describe",
    "--image",
    imagePath,
    "--prompt",
    prompt,
  ];

  const executable = command.endsWith(".cmd") ? "cmd.exe" : command;
  const args = command.endsWith(".cmd") ? ["/c", command, ...mmxArgs] : mmxArgs;

  const { stdout, stderr } = await execFileAsync(executable, args, {
    timeout: 60_000,
    maxBuffer: 2_000_000,
  });

  console.log(`${stdout}\n${stderr}`.trim());
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

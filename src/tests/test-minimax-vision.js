require("dotenv").config();

const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

(async () => {
  const apiKey = process.env.MINIMAX_API_KEY;

  if (!apiKey) {
    throw new Error("MINIMAX_API_KEY is missing in .env");
  }

  const command = process.env.MINIMAX_VISION_COMMAND || "mmx";
  const args = [
      "--api-key",
      apiKey,
      "vision",
      "describe",
      "--image",
      "C:\\tmp\\ai-test-agent-vision-test.png",
      "--prompt",
      "Read the visible text in this image and summarize it.",
    ];
  const executable = command.endsWith(".cmd") ? "cmd.exe" : command;
  const executableArgs = command.endsWith(".cmd") ? ["/c", command, ...args] : args;

  const { stdout, stderr } = await execFileAsync(
    executable,
    executableArgs,
    {
      timeout: 60_000,
      maxBuffer: 2_000_000,
    }
  );

  console.log(`${stdout}\n${stderr}`.trim());
})().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

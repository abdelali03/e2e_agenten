// src/utils/Logger.ts
// Strukturiertes Logging mit Level-Kontrolle via LOG_LEVEL env-Variable

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const COLORS: Record<LogLevel, string> = {
  debug: "\x1b[36m",  // Cyan
  info:  "\x1b[32m",  // Grün
  warn:  "\x1b[33m",  // Gelb
  error: "\x1b[31m",  // Rot
};

const RESET = "\x1b[0m";

export class Logger {
  private readonly context: string;
  private readonly minLevel: number;

  constructor(context: string) {
    this.context = context;
    const envLevel = (process.env.LOG_LEVEL ?? "info") as LogLevel;
    this.minLevel = LEVELS[envLevel] ?? LEVELS.info;
  }

  private log(level: LogLevel, message: string, meta?: unknown): void {
    if (LEVELS[level] < this.minLevel) return;

    const timestamp = new Date().toISOString();
    const color = COLORS[level];
    const prefix = `${color}[${level.toUpperCase()}]${RESET} ${timestamp} [${this.context}]`;

    if (meta !== undefined) {
      console.log(`${prefix} ${message}`, meta);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }

  public debug(message: string, meta?: unknown): void {
    this.log("debug", message, meta);
  }

  public info(message: string, meta?: unknown): void {
    this.log("info", message, meta);
  }

  public warn(message: string, meta?: unknown): void {
    this.log("warn", message, meta);
  }

  public error(message: string, meta?: unknown): void {
    this.log("error", message, meta);
  }
}

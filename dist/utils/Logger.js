"use strict";
// src/utils/Logger.ts
// Strukturiertes Logging mit Level-Kontrolle via LOG_LEVEL env-Variable
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
const LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};
const COLORS = {
    debug: "\x1b[36m", // Cyan
    info: "\x1b[32m", // Grün
    warn: "\x1b[33m", // Gelb
    error: "\x1b[31m", // Rot
};
const RESET = "\x1b[0m";
class Logger {
    context;
    minLevel;
    constructor(context) {
        this.context = context;
        const envLevel = (process.env.LOG_LEVEL ?? "info");
        this.minLevel = LEVELS[envLevel] ?? LEVELS.info;
    }
    log(level, message, meta) {
        if (LEVELS[level] < this.minLevel)
            return;
        const timestamp = new Date().toISOString();
        const color = COLORS[level];
        const prefix = `${color}[${level.toUpperCase()}]${RESET} ${timestamp} [${this.context}]`;
        if (meta !== undefined) {
            console.log(`${prefix} ${message}`, meta);
        }
        else {
            console.log(`${prefix} ${message}`);
        }
    }
    debug(message, meta) {
        this.log("debug", message, meta);
    }
    info(message, meta) {
        this.log("info", message, meta);
    }
    warn(message, meta) {
        this.log("warn", message, meta);
    }
    error(message, meta) {
        this.log("error", message, meta);
    }
}
exports.Logger = Logger;

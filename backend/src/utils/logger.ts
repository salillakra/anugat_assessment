import { correlationIdStorage } from "./correlation";

const COLORS = {
  reset: "\x1b[0m",
  info: "\x1b[32m",
  warn: "\x1b[33m",
  error: "\x1b[31m",
  debug: "\x1b[34m",
  gray: "\x1b[90m",
};

function formatMessage(level: keyof typeof COLORS, msg: string, ...args: any[]): string {
  const timestamp = new Date().toISOString();
  const correlationId = correlationIdStorage.getStore();
  const cidStr = correlationId ? ` [CID: ${correlationId}]` : "";
  const levelStr = `[${level.toUpperCase()}]`.padEnd(7);
  const color = COLORS[level] || COLORS.reset;
  
  let formattedArgs = "";
  if (args.length > 0) {
    formattedArgs = args.map(arg => {
      if (arg instanceof Error) {
        return `\n${arg.stack || arg.message}`;
      }
      if (typeof arg === "object") {
        try {
          return `\n${JSON.stringify(arg, null, 2)}`;
        } catch {
          return ` ${arg}`;
        }
      }
      return ` ${arg}`;
    }).join("");
  }
  
  return `${COLORS.gray}[${timestamp}]${COLORS.reset} ${color}${levelStr}${COLORS.reset}${COLORS.gray}${cidStr}${COLORS.reset} ${msg}${formattedArgs}`;
}

export const logger = {
  info(msg: string, ...args: any[]) {
    console.log(formatMessage("info", msg, ...args));
  },
  warn(msg: string, ...args: any[]) {
    console.warn(formatMessage("warn", msg, ...args));
  },
  error(msg: string, ...args: any[]) {
    console.error(formatMessage("error", msg, ...args));
  },
  debug(msg: string, ...args: any[]) {
    if (process.env.NODE_ENV !== "production") {
      console.log(formatMessage("debug", msg, ...args));
    }
  },
};

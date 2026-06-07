import { Context } from "hono";
import { logger } from "../utils/logger";

export const errorHandler = (err: Error, c: Context) => {
  const correlationId = c.get("correlationId") ?? "unknown";
  logger.error(`[${correlationId}] Unhandled error: ${err.message}`, {
    stack: err.stack,
  });

  if (err.message.includes("Unique constraint")) {
    return c.json(
      { success: false, error: "A record with that value already exists" },
      409,
    );
  }

  if (err.message.includes("Record to update not found")) {
    return c.json({ success: false, error: "Record not found" }, 404);
  }

  return c.json({ success: false, error: "Internal server error" }, 500);
};

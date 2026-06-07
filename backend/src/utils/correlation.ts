import { Context, type Next } from "hono";
import { randomUUID } from "crypto";
import { AsyncLocalStorage } from "async_hooks";

export const correlationIdStorage = new AsyncLocalStorage<string>();

export const correlationIdMiddleware = async (c: Context, next: Next) => {
  const correlationId = c.req.header("x-correlation-id") ?? randomUUID();
  c.set("correlationId", correlationId);
  c.header("X-Correlation-ID", correlationId);
  await correlationIdStorage.run(correlationId, next);
};

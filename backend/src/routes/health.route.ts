import { Hono } from "hono";
import { prisma } from "../config/db";
import { getRedis } from "../config/redis";
import { logger } from "@/utils/logger";

const router = new Hono();

router.get("/", async (c) => {
  const checks = {
    db: "unhealthy",
    redis: "unhealthy",
    queue: "unhealthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  };

  // Check DB
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.db = "healthy";
  } catch (err) {
    logger.error(`Database health check failed error: ${(err as Error).message}`);
  }

  // Check Redis
  try {
    const redis = getRedis();
    await redis.ping();
    checks.redis = "healthy";
    checks.queue = "healthy"; 
  } catch (err) {
    logger.error(`Redis health check failed error: ${(err as Error).message}`);
  }

  const allHealthy = checks.db === "healthy" && checks.redis === "healthy";
  return c.json({ success: true, data: checks }, allHealthy ? 200 : 503 as any);
});

export { router as healthRouter };

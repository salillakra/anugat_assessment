import { Redis } from "ioredis";
import { env } from "./env";

let redisInstance: Redis | null = null;

export function getRedis(): Redis {
  if (!redisInstance) {
    redisInstance = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null, // required by BullMQ
      enableReadyCheck: false,
    });

    redisInstance.on("error", (err) => {
      console.error("[Redis] Connection error:", err.message);
    });

    redisInstance.on("connect", () => {
      console.info("[Redis] Connected");
    });
  }
  return redisInstance;
}

// shared connection used by bullmq workers/queues
export const redisConnection = {
  host: (() => {
    try {
      return new URL(env.REDIS_URL).hostname;
    } catch {
      return "localhost";
    }
  })(),
  port: (() => {
    try {
      return parseInt(new URL(env.REDIS_URL).port || "6379", 10);
    } catch {
      return 6379;
    }
  })(),
};

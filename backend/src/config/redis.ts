import { Redis } from "ioredis";
import { env } from "./env";

let redisInstance: Redis | null = null;

function parseRedisUrl(url: string) {
  try {
    const parsed = new URL(url);
    const isTls = parsed.protocol === "rediss:";
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port || "6379", 10),
      username: parsed.username || undefined,
      password: parsed.password
        ? decodeURIComponent(parsed.password)
        : undefined,
      tls: isTls ? {} : undefined,
    };
  } catch {
    console.warn("[Redis] Invalid REDIS_URL, using localhost defaults");
    return { host: "localhost", port: 6379 };
  }
}

async function enforceNoEviction(redis: Redis): Promise<void> {
  try {
    const policy = await redis.config("GET", "maxmemory-policy");
    const current = (policy as string[])[1]; 
    if (current !== "noeviction") {
      await redis.config("SET", "maxmemory-policy", "noeviction");
      console.info(
        `[Redis] maxmemory-policy changed from "${current}" to "noeviction" (required by BullMQ)`,
      );
    }
  } catch (err: any) {
    console.warn(
      `[Redis] Could not enforce noeviction policy: ${err?.message ?? err}. ` +
        "Please set maxmemory-policy=noeviction in your Redis configuration.",
    );
  }
}

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
      // Enforce policy once connected
      enforceNoEviction(redisInstance!);
    });
  }
  return redisInstance;
}

export const redisConnection = {
  ...parseRedisUrl(env.REDIS_URL),
  maxRetriesPerRequest: null, // required by BullMQ
  enableReadyCheck: false,
};

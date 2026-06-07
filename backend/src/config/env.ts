import "dotenv/config";

function requireEnv(key: string): string {
  const val = process.env[key] ?? Bun.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

function optionalEnv(key: string, fallback = ""): string {
  return process.env[key] ?? Bun.env[key] ?? fallback;
}

export const env = {
  NODE_ENV: optionalEnv("NODE_ENV", "development"),
  PORT: parseInt(optionalEnv("PORT", "3001"), 10),

  DATABASE_URL: requireEnv("DATABASE_URL"),
  DIRECT_URL: optionalEnv("DIRECT_URL"),

  REDIS_URL: optionalEnv("REDIS_URL", "redis://localhost:6379"),

  FRONTEND_URL: optionalEnv("FRONTEND_URL", "http://localhost:3000"),

  // Upload storage
  UPLOAD_DIR: optionalEnv("UPLOAD_DIR", "./uploads"),

  // Timetable PDF extraction
  GEMINI_API_KEY: optionalEnv("GEMINI_API_KEY"),
  TIMETABLE_OCR_LANG: optionalEnv("TIMETABLE_OCR_LANG", "eng"),
  TESSERACT_PATH: optionalEnv("TESSERACT_PATH", "tesseract"),
  RUN_WORKER_IN_PROCESS:
    optionalEnv("RUN_WORKER_IN_PROCESS", "true") === "true",
} as const;

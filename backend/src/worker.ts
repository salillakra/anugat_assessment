/**
 * Run this instead of (or alongside) the main API server
 * to handle BullMQ background jobs in isolation.
 *
 * >>> bun run src/worker.ts
 */
import { logger } from "./utils/logger";
import { startTimetableProcessingWorkers } from "./workers/timetable";

logger.info("[Worker] Samayak background worker starting...");

const timetableWorkers = startTimetableProcessingWorkers();

logger.info("[Worker] Timetable processing workers started (6 workers)");

// graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("[Worker] SIGTERM received, shutting down...");
  await timetableWorkers.closeAll();
  process.exit(0);
});

process.on("SIGINT", async () => {
  logger.info("[Worker] SIGINT received, shutting down...");
  await timetableWorkers.closeAll();
  process.exit(0);
});

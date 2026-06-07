import { Worker, type Job } from "bullmq";
import { redisConnection } from "../../config/redis";
import { logger } from "../../utils/logger";
import { prisma } from "../../config/db";
import { SocketManager } from "../../socket/socket";
import { QUEUE_NAMES, JOB_NAMES } from "../../types/timetable-processing.types";
import { createOcrPageWorker } from "./ocr-page.worker";
import { handlePdfConversion } from "./pdf-conversion.worker";
import { handleOcrAggregation } from "./ocr-aggregator.worker";
import { handleGeminiParsing } from "./gemini-parsing.worker";
import { handleValidation } from "./validation.worker";
import { handleDatabasePersist } from "./database.worker";


interface TimetableWorkers {
  mainWorker: Worker;
  ocrWorker: Worker;
  closeAll: () => Promise<void>;
}

export function startTimetableProcessingWorkers(): TimetableWorkers {
  logger.info("[TimetableWorkers] Starting timetable processing pipeline...");

  //main queue dispatcher
  const mainWorker = new Worker(
    QUEUE_NAMES.TIMETABLE_PROCESSING,
    async (job: Job) => {
      const jobName = job.name;

      try {
        if (jobName.startsWith(JOB_NAMES.PDF_CONVERSION)) {
          return await handlePdfConversion(job as any);
        }

        if (jobName.startsWith(JOB_NAMES.OCR_AGGREGATE)) {
          return await handleOcrAggregation(job as any);
        }

        if (jobName.startsWith(JOB_NAMES.GEMINI_PARSE)) {
          return await handleGeminiParsing(job as any);
        }

        if (jobName.startsWith(JOB_NAMES.VALIDATE)) {
          return await handleValidation(job as any);
        }

        if (jobName.startsWith(JOB_NAMES.DB_PERSIST)) {
          return await handleDatabasePersist(job as any);
        }

        logger.warn(`[TimetableWorkers] Unknown job name: ${jobName}`);
      } catch (err) {
        //update ImportJob status on failure
        const importJobId = (job.data as any)?.importJobId;
        if (importJobId) {
          try {
            await prisma.importJob.update({
              where: { id: importJobId },
              data: {
                status: "FAILED",
                errorMsg: (err as Error)?.message ?? "Unknown error",
              },
            });
            SocketManager.emitToRoom(
              `import:${importJobId}`,
              "import:progress",
              {
                importJobId,
                stage: "FAILED",
                progress: 0,
                message: (err as Error)?.message || "Unknown error",
              },
            );
          } catch {
            logger.error(
              `[TimetableWorkers] Failed to update ImportJob ${importJobId} on failure:`,
              err,
            );
          }
        }
        throw err; // bull-mq handles the error
      }
    },
    {
      connection: redisConnection,
      concurrency: 3,
    },
  );

  mainWorker.on("completed", (job) => {
    logger.info(`[TimetableWorkers] Job ${job.name} (${job.id}) completed`);
  });

  mainWorker.on("failed", (job, err) => {
    logger.error(
      `[TimetableWorkers] Job ${job?.name} (${job?.id}) failed:`,
      err,
    );
  });

  // OCR Child Job Worker
  const ocrWorker = createOcrPageWorker();

  logger.info(
    `[TimetableWorkers] Started timetable processing pipeline ${
      mainWorker.name
    }, ${ocrWorker.name}`,
  );

  const closeAll = async () => {
    logger.info("[TimetableWorkers] Shutting down all workers...");
    await Promise.allSettled([mainWorker.close(), ocrWorker.close()]);
    logger.info("[TimetableWorkers] All workers shut down");
  };

  return {
    mainWorker,
    ocrWorker,
    closeAll,
  };
}

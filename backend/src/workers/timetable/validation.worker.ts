import { type Job } from "bullmq";
import { logger } from "../../utils/logger";
import { prisma } from "../../config/db";
import { SocketManager } from "../../socket/socket";
import {
  timetableQueue,
  timetableDLQ,
} from "../../queues/timetable-processing.queue";
import { validateGeminiOutput } from "../../validators/timetable.validator";
import type {
  ValidationJobData,
  GeminiParsingJobData,
  DatabaseJobData,
  GeminiTimetableOutput,
} from "../../types/timetable-processing.types";
import { JOB_NAMES } from "../../types/timetable-processing.types";

const MAX_GEMINI_RETRIES = 1;

export async function handleValidation(
  job: Job<ValidationJobData>,
): Promise<{ valid: boolean; retrying?: boolean; errors?: string[] }> {
  const {
    importJobId,
    geminiOutput,
    ocrResults,
    pdfPath,
    retryCount = 0,
  } = job.data;
  logger.info(
    `[Validation] Validating Gemini output (job: ${job.id}, retry: ${retryCount})`,
  );

  emitProgress(
    importJobId,
    "VALIDATION",
    80,
    "Validating timetable structure...",
  );

  // Run Zod validation
  const result = validateGeminiOutput(geminiOutput);

  if (result.success && result.data) {
    logger.info(`[Validation] Validation passed for import ${importJobId}`);

    emitProgress(
      importJobId,
      "VALIDATION",
      85,
      "Validation passed, saving to database...",
    );

    // Update status
    await prisma.importJob.update({
      where: { id: importJobId },
      data: { status: "INTEGRATING" },
    });

    // Create database persistence job
    await timetableQueue.add(
      JOB_NAMES.DB_PERSIST,
      {
        importJobId,
        validatedData: result.data as GeminiTimetableOutput,
      } satisfies DatabaseJobData,
      {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
      },
    );

    return { valid: true };
  }

  // Validation failed
  const errors = result.errors ?? ["Unknown validation error"];
  logger.warn(
    `[Validation] Validation failed for import ${importJobId}:`,
    errors,
  );

  if (retryCount < MAX_GEMINI_RETRIES) {
    // Retry Gemini with error context
    logger.info(
      `[Validation] Retrying Gemini (attempt ${retryCount + 1}/${MAX_GEMINI_RETRIES})`,
    );

    emitProgress(
      importJobId,
      "VALIDATION",
      70,
      `Validation failed, retrying Gemini (${retryCount + 1}/${MAX_GEMINI_RETRIES})...`,
    );

    await timetableQueue.add(
      JOB_NAMES.GEMINI_PARSE,
      {
        importJobId,
        ocrResults,
        pdfPath,
        retryCount: retryCount + 1,
        previousErrors: errors,
      } satisfies GeminiParsingJobData,
      {
        attempts: 2,
        backoff: { type: "exponential", delay: 5000 },
      },
    );

    return { valid: false, retrying: true, errors };
  }

  // Max retries — sending to DLQ
  logger.error(
    `[Validation] Max retries exhausted for import ${importJobId}. Sending to DLQ.`,
  );

  await timetableDLQ.add(`dlq-${importJobId}`, {
    importJobId,
    geminiOutput,
    validationErrors: errors,
    retryCount,
    timestamp: new Date().toISOString(),
  });

  await prisma.importJob.update({
    where: { id: importJobId },
    data: {
      status: "FAILED",
      errorMsg: `Validation failed after ${retryCount + 1} attempts: ${errors.join("; ")}`,
    },
  });

  emitProgress(
    importJobId,
    "FAILED",
    0,
    `Validation failed: ${errors.join("; ")}`,
  );

  return { valid: false, retrying: false, errors };
}

function emitProgress(
  importJobId: string,
  stage: string,
  progress: number,
  message: string,
) {
  SocketManager.emitToRoom(`import:${importJobId}`, "import:progress", {
    importJobId,
    stage,
    progress,
    message,
  });
}

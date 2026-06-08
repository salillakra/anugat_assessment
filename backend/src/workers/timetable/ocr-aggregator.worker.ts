import { type Job } from "bullmq";
import { logger } from "../../utils/logger";
import { prisma } from "../../config/db";
import { SocketManager } from "../../socket/socket";
import { timetableQueue } from "../../queues/timetable-processing.queue";
import type {
  OcrAggregatorJobData,
  OcrPageResult,
  GeminiParsingJobData,
} from "../../types/timetable-processing.types";
import { JOB_NAMES } from "../../types/timetable-processing.types";
import { rm } from "fs/promises";

export async function handleOcrAggregation(
  job: Job<OcrAggregatorJobData>,
): Promise<{
  totalWords: number;
  avgConfidence: number;
  pagesProcessed: number;
}> {
  const { importJobId, totalPages, tempDir, pdfPath } = job.data;

  logger.info(
    `[OcrAggregator] Aggregating OCR results for ${totalPages} pages (job: ${job.id})`,
  );

  emitProgress(importJobId, "OCR_AGGREGATION", 55, "Merging OCR results...");

  const childrenValues = await job.getChildrenValues();
  const ocrResults: OcrPageResult[] = [];

  for (const value of Object.values(childrenValues)) {
    if (value && typeof value === "object" && "page" in value) {
      ocrResults.push(value as OcrPageResult);
    }
  }

  ocrResults.sort((a, b) => a.page - b.page);

  if (ocrResults.length === 0) {
    throw new Error(
      "No OCR results collected — all child jobs may have failed",
    );
  }

  const totalWords = ocrResults.reduce((sum, r) => sum + r.words.length, 0);
  const avgConfidence =
    ocrResults.reduce((sum, r) => sum + r.confidence, 0) / ocrResults.length;

  logger.info(
    `[OcrAggregator] Merged ${ocrResults.length} pages: ${totalWords} total words, avg confidence: ${avgConfidence.toFixed(1)}%`,
  );

  try {
    await rm(tempDir, { recursive: true, force: true });
    logger.info(`[OcrAggregator] Cleaned up temp directory: ${tempDir}`);
  } catch (err) {
    logger.warn(
      `[OcrAggregator] Failed to cleanup temp dir: ${(err as Error).message}`,
    );
  }

  await prisma.importJob.update({
    where: { id: importJobId },
    data: { status: "GEMINI_PARSING" },
  });

  emitProgress(
    importJobId,
    "OCR_AGGREGATION",
    60,
    `Aggregated ${totalWords} words from ${ocrResults.length} pages`,
  );

  await timetableQueue.add(
    JOB_NAMES.GEMINI_PARSE,
    {
      importJobId,
      ocrResults,
      pdfPath,
      retryCount: 0,
    } satisfies GeminiParsingJobData,
    {
      attempts: 2,
      backoff: { type: "exponential", delay: 5000 },
    },
  );

  logger.info(
    `[OcrAggregator] Created Gemini parsing job for import ${importJobId}`,
  );

  return { totalWords, avgConfidence, pagesProcessed: ocrResults.length };
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

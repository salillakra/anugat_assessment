import { type Job } from "bullmq";
import { preprocessForOcr } from "../../utils/image-processing";
import { logger } from "../../utils/logger";
import { prisma } from "../../config/db";
import { SocketManager } from "../../socket/socket";
import { timetableFlowProducer } from "../../queues/timetable-processing.queue";
import type {
  PdfConversionJobData,
  OcrPageJobData,
  OcrAggregatorJobData,
} from "../../types/timetable-processing.types";
import { QUEUE_NAMES, JOB_NAMES } from "../../types/timetable-processing.types";
import { fromPath } from "pdf2pic";
import { mkdirSync, existsSync } from "fs";
import { join } from "path";
import { env } from "../../config/env";

export async function handlePdfConversion(
  job: Job<PdfConversionJobData>,
): Promise<{ totalPages: number; tempDir: string }> {
  const { importJobId, filePath, filename } = job.data;
  logger.info(
    `[PdfConversion] Starting PDF conversion for ${filename} (job: ${job.id})`,
  );

  // Update import status
  await prisma.importJob.update({
    where: { id: importJobId },
    data: { status: "PARSING" },
  });
  emitProgress(importJobId, "PDF_CONVERSION", 5, "Converting PDF to images...");

  // Create temp directory for page images
  const tempDir = join(env.UPLOAD_DIR, "timetable-temp", importJobId);
  if (!existsSync(tempDir)) {
    mkdirSync(tempDir, { recursive: true });
  }

  // Convert PDF to PNG images
  const converter = fromPath(filePath, {
    density: 300,
    saveFilename: "page",
    savePath: tempDir,
    format: "png",
    width: 2480,
    height: 3508,
  });

  const results = await converter.bulk(-1, { responseType: "image" });
  const totalPages = results.length;

  if (totalPages === 0) {
    throw new Error("PDF has no pages or conversion failed");
  }

  logger.info(`[PdfConversion] Converted ${totalPages} pages from ${filename}`);
  emitProgress(
    importJobId,
    "PDF_CONVERSION",
    10,
    `Converted ${totalPages} pages. Enhancing images for OCR...`,
  );

  logger.info(
    `[PdfConversion] Starting image preprocessing for ${totalPages} pages...`,
  );

  const preprocessedResults = await Promise.all(
    results.map(async (result, index) => {
      if (!result.path)
        throw new Error(`Missing image path for page ${index + 1}`);

      try {
        const processedPath = await preprocessForOcr(result.path);
        return {
          originalPath: result.path,
          processedPath: processedPath,
          pageNumber: index + 1,
        };
      } catch (error) {
        logger.error(
          `[PdfConversion] Failed to preprocess page ${index + 1}`,
          error,
        );
        throw error; // the BullMQ job fails and retries
      }
    }),
  );

  emitProgress(
    importJobId,
    "PDF_CONVERSION",
    15,
    `Preprocessed ${totalPages} pages`,
  );

  await prisma.importJob.update({
    where: { id: importJobId },
    data: { status: "OCR_PROCESSING" },
  });

  const ocrChildren = preprocessedResults.map((result) => ({
    name: `${JOB_NAMES.OCR_PAGE}-${result.pageNumber}`,
    queueName: QUEUE_NAMES.TIMETABLE_OCR,
    data: {
      importJobId,
      imagePath: result.processedPath, 
      pageNumber: result.pageNumber,
      totalPages,
    } satisfies OcrPageJobData,
    opts: {
      attempts: 2,
      backoff: { type: "exponential" as const, delay: 3000 },
    },
  }));

  await timetableFlowProducer.add({
    name: JOB_NAMES.OCR_AGGREGATE,
    queueName: QUEUE_NAMES.TIMETABLE_PROCESSING,
    data: {
      importJobId,
      totalPages,
      tempDir,
      pdfPath: filePath, 
    } satisfies OcrAggregatorJobData,
    opts: {
      attempts: 1,
    },
    children: ocrChildren,
  });

  logger.info(
    `[PdfConversion] Created ${totalPages} OCR child jobs with aggregator parent`,
  );

  return { totalPages, tempDir };
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

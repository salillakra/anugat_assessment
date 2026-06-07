import { Worker, type Job } from "bullmq";
import { redisConnection } from "../../config/redis";
import { logger } from "../../utils/logger";
import { SocketManager } from "../../socket/socket";
import type {
  OcrPageJobData,
  OcrPageResult,
  OcrWord,
} from "../../types/timetable-processing.types";
import { QUEUE_NAMES } from "../../types/timetable-processing.types";
import Tesseract from "tesseract.js";

export function createOcrPageWorker(): Worker<OcrPageJobData, OcrPageResult> {
  const worker = new Worker<OcrPageJobData, OcrPageResult>(
    QUEUE_NAMES.TIMETABLE_OCR,
    async (job: Job<OcrPageJobData>): Promise<OcrPageResult> => {
      const { importJobId, imagePath, pageNumber, totalPages } = job.data;
      logger.info(
        `[OcrPage] Processing page ${pageNumber}/${totalPages} (job: ${job.id})`,
      );
      const progress = 20 + Math.round((pageNumber / totalPages) * 30);
      SocketManager.emitToRoom(`import:${importJobId}`, "import:progress", {
        importJobId,
        stage: "OCR_PROCESSING",
        progress,
        message: `OCR processing page ${pageNumber} of ${totalPages}`,
      });

      const worker = await Tesseract.createWorker("eng", 1, {
        logger: (m) => {
          if (m.status === "recognizing text") {
            job.updateProgress(Math.round((m.progress ?? 0) * 100));
          }
        },
      });

      try {
        const result = await worker.recognize(imagePath, {}, { blocks: true });

        // Extract words
        const words: OcrWord[] = [];
        for (const block of result.data.blocks ?? []) {
          for (const paragraph of block.paragraphs ?? []) {
            for (const line of paragraph.lines ?? []) {
              for (const word of line.words ?? []) {
                if (word.text.trim()) {
                  words.push({
                    text: word.text.trim(),
                    confidence: word.confidence,
                    bbox: {
                      x0: word.bbox.x0,
                      y0: word.bbox.y0,
                      x1: word.bbox.x1,
                      y1: word.bbox.y1,
                    },
                    page: pageNumber,
                  });
                }
              }
            }
          }
        }

        const pageResult: OcrPageResult = {
          page: pageNumber,
          text: result.data.text,
          words,
          confidence: result.data.confidence,
        };

        logger.info(
          `[OcrPage] Page ${pageNumber}: ${words.length} words, confidence: ${result.data.confidence.toFixed(1)}%`,
        );

        return pageResult;
      } finally {
        await worker.terminate();
      }
    },
    {
      connection: redisConnection,
      concurrency: 3,
      limiter: {
        max: 6,
        duration: 60000,
      },
    },
  );

  worker.on("completed", (job) => {
    logger.info(`[OcrPage] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    logger.error(`[OcrPage] Job ${job?.id} failed:`, err);
  });

  return worker;
}

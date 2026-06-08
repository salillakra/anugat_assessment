import { type Job } from "bullmq";
import { readFileSync, existsSync } from "fs";
import { logger } from "../../utils/logger";
import { SocketManager } from "../../socket/socket";
import { timetableQueue } from "../../queues/timetable-processing.queue";
import { ai, geminiModels, timetableGeminiConfig } from "../../config/gemini";

import type {
  GeminiParsingJobData,
  ValidationJobData,
  OcrPageResult,
} from "../../types/timetable-processing.types";
import { JOB_NAMES } from "../../types/timetable-processing.types";

export async function handleGeminiParsing(
  job: Job<GeminiParsingJobData>,
): Promise<{ success: boolean }> {
  const {
    importJobId,
    ocrResults,
    pdfPath,
    retryCount = 0,
    previousErrors,
  } = job.data;

  logger.info(
    `[GeminiParsing] Starting (job: ${job.id}, retry: ${retryCount})`,
  );

  emitProgress(
    importJobId,
    "GEMINI_PARSING",
    65,
    "Sending data to Gemini AI...",
  );

  const parts: Array<
    { text: string } | { inlineData: { mimeType: string; data: string } }
  > = [];

  if (existsSync(pdfPath)) {
    try {
      const pdfBytes = readFileSync(pdfPath);
      parts.push({
        inlineData: {
          mimeType: "application/pdf",
          data: pdfBytes.toString("base64"),
        },
      });
      logger.info(
        `[GeminiParsing] Attached PDF (${(pdfBytes.length / 1024).toFixed(0)} KB) as inline data`,
      );
    } catch (err) {
      logger.warn(
        `[GeminiParsing] Could not read PDF (${(err as Error).message}) — falling back to OCR-only`,
      );
    }
  } else {
    logger.warn(`[GeminiParsing] PDF not found at ${pdfPath} — OCR-only mode`);
  }

  let ocrText = `OCR words extracted from the timetable PDF:\n\n${formatOcrForGemini(ocrResults)}`;
  if (retryCount > 0 && previousErrors?.length) {
    ocrText += `\n\nPREVIOUS ATTEMPT FAILED VALIDATION. Errors to fix:\n${previousErrors.join("\n")}`;
  }
  parts.push({ text: ocrText });

  const response = await ai.models.generateContent({
    model: geminiModels.gemini_3_1_flash_lite,
    contents: [{ role: "user", parts: parts as any }],
    config: timetableGeminiConfig,
  });

  if (!response.text) {
    throw new Error("Gemini returned an empty response");
  }

  let geminiOutput: unknown;
  try {
    geminiOutput = JSON.parse(response.text);
  } catch {
    throw new Error(
      `Gemini returned invalid JSON: ${response.text.substring(0, 300)}`,
    );
  }

  logger.info(
    `[GeminiParsing] Gemini returned structured data for import ${importJobId}`,
  );

  emitProgress(
    importJobId,
    "GEMINI_PARSING",
    75,
    "Gemini parsing complete, validating...",
  );

  await timetableQueue.add(
    JOB_NAMES.VALIDATE,
    {
      importJobId,
      geminiOutput,
      ocrResults,
      pdfPath,
      retryCount,
    } satisfies ValidationJobData,
    { attempts: 1 },
  );

  return { success: true };
}

function formatOcrForGemini(ocrResults: OcrPageResult[]): string {
  const lines: string[] = [];
  for (const page of ocrResults) {
    lines.push(
      `--- PAGE ${page.page} (confidence: ${page.confidence.toFixed(1)}%) ---`,
    );
    for (const word of page.words) {
      lines.push(
        `[p:${word.page} x0:${word.bbox.x0} y0:${word.bbox.y0} x1:${word.bbox.x1} y1:${word.bbox.y1} c:${word.confidence.toFixed(0)}] "${word.text}"`,
      );
    }
    lines.push("");
  }
  return lines.join("\n");
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

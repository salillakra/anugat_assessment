import { type Job } from "bullmq";
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
  const { importJobId, ocrResults, retryCount = 0, previousErrors } = job.data;
  logger.info(
    `[GeminiParsing] Starting Gemini parsing (job: ${job.id}, retry: ${retryCount})`,
  );

  emitProgress(
    importJobId,
    "GEMINI_PARSING",
    65,
    "Sending OCR data to Gemini AI...",
  );

  const ocrPayload = formatOcrForGemini(ocrResults);

  let userPrompt = `Here are the OCR words extracted from a scanned university timetable PDF:\n\n${ocrPayload}`;

  if (retryCount > 0 && previousErrors?.length) {
    userPrompt += `\n\nPREVIOUS ATTEMPT FAILED VALIDATION. Fix these errors:\n${previousErrors.join("\n")}`;
  }

  const response = await ai.models.generateContent({
    model: geminiModels.gemini_3_1_flash_lite,
    contents: [{ text: userPrompt }],
    config: timetableGeminiConfig,
  });

  if (!response.text) {
    throw new Error("Gemini returned an empty response");
  }

  // parse JSON response
  let geminiOutput: unknown;
  try {
    geminiOutput = JSON.parse(response.text);
  } catch {
    throw new Error(
      `Gemini returned invalid JSON: ${response.text.substring(0, 200)}...`,
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

  // Create validation job
  await timetableQueue.add(
    JOB_NAMES.VALIDATE,
    {
      importJobId,
      geminiOutput,
      ocrResults,
      retryCount,
    } satisfies ValidationJobData,
    {
      attempts: 1,
    },
  );

  return { success: true };
}

// helpers
function formatOcrForGemini(ocrResults: OcrPageResult[]): string {
  const lines: string[] = [];

  for (const page of ocrResults) {
    lines.push(
      `--- PAGE ${page.page} (confidence: ${page.confidence.toFixed(1)}%) ---`,
    );

    for (const word of page.words) {
      lines.push(
        `[page:${word.page} x0:${word.bbox.x0} y0:${word.bbox.y0} x1:${word.bbox.x1} y1:${word.bbox.y1} conf:${word.confidence.toFixed(0)}] "${word.text}"`,
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

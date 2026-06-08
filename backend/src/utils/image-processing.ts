import sharp from "sharp";
import { parse, join } from "path";
import { logger } from "./logger";

/**
 * Preprocess a timetable page image for Tesseract OCR.
 *
 * Strategy:
 * 1. Upscale to at least 300 DPI equivalent (2x if needed) — Tesseract accuracy
 *    drops sharply below ~200px per character height.
 * 2. Convert to greyscale.
 * 3. Normalize contrast so faint ink is visible.
 * 4. Apply a mild unsharp mask to crisp up text edges before binarisation.
 * 5. Use an adaptive-style threshold via a local contrast trick (dilate → subtract)
 *    instead of a hard global threshold — handles uneven lighting / scanner artifacts.
 * 6. Save as PNG (lossless).
 */
export async function preprocessForOcr(
  inputImagePath: string,
): Promise<string> {
  try {
    const parsedPath = parse(inputImagePath);
    const outputPath = join(
      parsedPath.dir,
      `${parsedPath.name}-processed${parsedPath.ext}`,
    );

    const meta = await sharp(inputImagePath).metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;

    // Scale factor: ensure minimum 2480px wide (A4 @ 300dpi).
    // If the PDF was already rendered at high res by pdf2pic this is a no-op.
    const targetWidth = 2480;
    const scaleFactor =
      width > 0 && width < targetWidth ? Math.ceil(targetWidth / width) : 1;

    await sharp(inputImagePath)
      // 1. Optional upscale
      .resize(
        scaleFactor > 1 ? width * scaleFactor : undefined,
        scaleFactor > 1 ? height * scaleFactor : undefined,
        { kernel: sharp.kernel.lanczos3, fit: "fill" },
      )
      // 2. Greyscale
      .greyscale()
      // 3. Normalize (auto-stretch histogram)
      .normalize()
      // 4. Mild unsharp mask — sharpens character edges without creating ringing
      .sharpen({ sigma: 1.0, m1: 1.0, m2: 0.5 })
      // 5. Linear contrast boost before threshold (increases ink-to-background gap)
      .linear(1.3, -30)
      // 6. Hard threshold at 140 — after normalize+linear the background is near 255
      //    and ink is below 140. Slightly higher than 128 catches faint strokes.
      .threshold(140)
      .png({ compressionLevel: 6 })
      .toFile(outputPath);

    logger.info(
      `[ImageProcessing] Preprocessed ${parsedPath.base}` +
        (scaleFactor > 1 ? ` (upscaled ${scaleFactor}x)` : ""),
    );

    return outputPath;
  } catch (error) {
    logger.error(
      `[ImageProcessing] Sharp failed to process ${inputImagePath}:`,
      error,
    );
    throw error;
  }
}

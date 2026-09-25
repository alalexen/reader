import { preprocessImageForOcr } from "./imageProcessingService.js";

/**
 * Runs Hebrew OCR in the browser using Tesseract.js.
 */
export async function recognizeHebrewText(image, onProgress = () => {}) {
  if (!window.Tesseract) {
    throw new Error("Tesseract.js is not available.");
  }

  onProgress("Preparing image", 0);

  const processedImage = await preprocessImageForOcr(image);

  const worker = await window.Tesseract.createWorker("heb", 1, {
    logger(message) {
      onProgress(message.status, message.progress);
    },
  });

  try {
    await worker.setParameters({
      tessedit_pageseg_mode: "6",
      preserve_interword_spaces: "1",
    });

    const result = await worker.recognize(processedImage);
    return result.data.text.trim();
  } finally {
    await worker.terminate();
  }
}

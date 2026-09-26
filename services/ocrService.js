import { preprocessImageForOcr } from "./imageProcessingService.js";

async function recognizeWithGoogleVision(image, onProgress) {
  onProgress("Trying Google Vision OCR", 0.1);

  const response = await fetch("/api/ocr", {
    method: "POST",
    headers: {
      "Content-Type": image.type || "application/octet-stream",
    },
    body: image,
  });

  if (!response.ok) {
    throw new Error("Google Vision OCR is unavailable.");
  }

  const payload = await response.json();
  return (payload.text || "").trim();
}

async function recognizeWithTesseract(image, onProgress) {
  if (!window.Tesseract) {
    throw new Error("Tesseract.js is not available.");
  }

  onProgress("Preparing image for local OCR", 0);

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

/**
 * Uses Google Vision OCR first and falls back to local Tesseract.js.
 */
export async function recognizeHebrewText(image, onProgress = () => {}) {
  try {
    const text = await recognizeWithGoogleVision(image, onProgress);

    if (text) {
      onProgress("Google Vision OCR complete", 1);
      return { text, provider: "google-vision" };
    }

    throw new Error("Google Vision returned no text.");
  } catch (error) {
    console.warn("Google Vision OCR failed, using Tesseract.js:", error);
    onProgress("Google Vision unavailable. Using local OCR", 0);
    const text = await recognizeWithTesseract(image, onProgress);
    return { text, provider: "tesseract" };
  }
}

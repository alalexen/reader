/**
 * Runs Hebrew OCR in the browser using Tesseract.js.
 */
export async function recognizeHebrewText(image, onProgress = () => {}) {
  if (!window.Tesseract) {
    throw new Error("Tesseract.js is not available.");
  }

  const result = await window.Tesseract.recognize(image, "heb", {
    logger(message) {
      onProgress(message.status, message.progress);
    },
  });

  return result.data.text.trim();
}

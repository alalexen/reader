/**
 * Prepares a book-page photo for OCR.
 *
 * The image is resized to a useful OCR resolution and receives mild grayscale
 * and contrast enhancement. This improves recognition while preserving Hebrew
 * letter shapes better than aggressive thresholding.
 */
export async function preprocessImageForOcr(file) {
  const bitmap = await createImageBitmap(file);

  const longestSide = Math.max(bitmap.width, bitmap.height);
  const targetLongestSide = Math.min(Math.max(longestSide * 1.6, 1800), 2800);
  const scale = targetLongestSide / longestSide;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);

  const context = canvas.getContext("2d");

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.filter = "grayscale(1) contrast(1.45)";
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  bitmap.close();

  return canvas;
}

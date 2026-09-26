import { recognizeHebrewText } from "../services/ocrService.js";

export function createImageController({ elements, state, reader }) {
  function setImagePreview(file) {
    if (state.previewUrl) {
      URL.revokeObjectURL(state.previewUrl);
    }

    state.previewUrl = URL.createObjectURL(file);
    elements.imagePreview.src = state.previewUrl;
    elements.imageWorkspace.classList.remove("hidden");
  }

  function resetCropSelection() {
    state.cropSelection = null;
    state.cropDragStart = null;
    elements.cropSelection.classList.add("hidden");
    elements.cropSelection.removeAttribute("style");
    elements.applyCropButton.disabled = true;
  }

  function setCropMode(enabled) {
    state.isCropping = enabled;
    state.cropDragStart = null;
    elements.imagePreviewFrame.classList.toggle("is-cropping", enabled);
    elements.cropControls.classList.toggle("hidden", !enabled);

    if (!enabled) {
      resetCropSelection();
    }
  }

  function getCropPoint(event) {
    const rect = elements.imagePreview.getBoundingClientRect();

    return {
      x: Math.min(Math.max(event.clientX - rect.left, 0), rect.width),
      y: Math.min(Math.max(event.clientY - rect.top, 0), rect.height),
      width: rect.width,
      height: rect.height,
    };
  }

  function updateCropSelection(start, current) {
    const left = Math.min(start.x, current.x);
    const top = Math.min(start.y, current.y);
    const width = Math.abs(current.x - start.x);
    const height = Math.abs(current.y - start.y);

    state.cropSelection = { left, top, width, height };

    Object.assign(elements.cropSelection.style, {
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
    });

    elements.cropSelection.classList.remove("hidden");
    elements.applyCropButton.disabled = width < 12 || height < 12;
  }

  function startCropDrag(event) {
    if (!state.isCropping || event.button > 0) {
      return;
    }

    event.preventDefault();
    const point = getCropPoint(event);
    state.cropDragStart = point;
    updateCropSelection(point, point);
    elements.imagePreviewFrame.setPointerCapture?.(event.pointerId);
  }

  function moveCropDrag(event) {
    if (!state.isCropping || !state.cropDragStart) {
      return;
    }

    event.preventDefault();
    updateCropSelection(state.cropDragStart, getCropPoint(event));
  }

  function endCropDrag(event) {
    if (!state.cropDragStart) {
      return;
    }

    moveCropDrag(event);
    state.cropDragStart = null;

    if (elements.imagePreviewFrame.hasPointerCapture?.(event.pointerId)) {
      elements.imagePreviewFrame.releasePointerCapture(event.pointerId);
    }
  }

  function useFullImage() {
    if (!state.originalImage) {
      return;
    }

    setCropMode(false);
    state.selectedImage = state.originalImage;
    setImagePreview(state.originalImage);
    elements.recognizeButton.disabled = false;
    elements.ocrStatus.textContent =
      "Full image selected. Ready to recognize Hebrew text.";
  }

  function enterCropMode() {
    resetCropSelection();
    setCropMode(true);
    elements.ocrStatus.textContent =
      "Crop mode: drag across the image to select the text area.";
  }

  function cancelCrop() {
    setCropMode(false);
    elements.ocrStatus.textContent =
      "Crop cancelled. Current image is ready for recognition.";
  }

  function handleFileSelection() {
    const [file] = elements.imageInput.files;

    if (!file) {
      return;
    }

    state.originalImage = file;
    state.selectedImage = file;
    setCropMode(false);
    setImagePreview(file);
    elements.recognizeButton.disabled = false;
    elements.ocrStatus.textContent =
      "Image loaded. Use it as is, or crop it before recognition.";
  }

  async function applyImageCrop() {
    const selection = state.cropSelection;

    if (!selection || !state.selectedImage) {
      return;
    }

    elements.applyCropButton.disabled = true;

    try {
      const bitmap = await createImageBitmap(state.selectedImage);
      const displayedWidth = elements.imagePreview.clientWidth;
      const displayedHeight = elements.imagePreview.clientHeight;
      const scaleX = bitmap.width / displayedWidth;
      const scaleY = bitmap.height / displayedHeight;

      const sourceX = Math.max(0, Math.round(selection.left * scaleX));
      const sourceY = Math.max(0, Math.round(selection.top * scaleY));
      const sourceWidth = Math.min(
        bitmap.width - sourceX,
        Math.max(1, Math.round(selection.width * scaleX)),
      );
      const sourceHeight = Math.min(
        bitmap.height - sourceY,
        Math.max(1, Math.round(selection.height * scaleY)),
      );

      const canvas = document.createElement("canvas");
      canvas.width = sourceWidth;
      canvas.height = sourceHeight;

      const context = canvas.getContext("2d");
      context.drawImage(
        bitmap,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        sourceWidth,
        sourceHeight,
      );
      bitmap.close();

      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (result) => {
            if (result) {
              resolve(result);
            } else {
              reject(new Error("Could not create cropped image."));
            }
          },
          "image/png",
        );
      });

      const croppedFile = new File([blob], "cropped-hebrew-page.png", {
        type: "image/png",
      });

      state.selectedImage = croppedFile;
      setCropMode(false);
      setImagePreview(croppedFile);
      elements.recognizeButton.disabled = false;
      elements.ocrStatus.textContent =
        "Crop applied. Ready to recognize Hebrew text.";
    } catch (error) {
      console.error("Could not crop image:", error);
      elements.ocrStatus.textContent =
        "Could not crop this image. You can use the full image instead.";
      elements.applyCropButton.disabled = false;
    }
  }

  async function runOcr() {
    if (!state.selectedImage) {
      return;
    }

    elements.recognizeButton.disabled = true;
    elements.ocrProgress.value = 0;
    elements.ocrProgress.classList.remove("hidden");

    try {
      const result = await recognizeHebrewText(
        state.selectedImage,
        elements.ocrEngine.value,
        (status, progress) => {
          const percentage =
            typeof progress === "number"
              ? ` ${Math.round(progress * 100)}%`
              : "";

          if (typeof progress === "number") {
            elements.ocrProgress.value = progress;
          }

          elements.ocrStatus.textContent =
            `${status || "Processing"}${percentage}`;
        },
      );

      elements.editableText.value = result.text;
      reader.setReaderMode("edit");
      reader.updateTextWorkspaceControls();
      elements.ocrStatus.textContent =
        result.provider === "google-vision"
          ? "Recognized with Google Vision"
          : "Recognized with local Tesseract (default)";
    } catch (error) {
      console.error("Hebrew OCR failed:", error);
      elements.ocrStatus.textContent =
        "OCR failed. Try a sharper photo with the page filling most of the frame.";
    } finally {
      elements.recognizeButton.disabled = false;
      elements.ocrProgress.classList.add("hidden");
    }
  }

  function clear() {
    if (state.previewUrl) {
      URL.revokeObjectURL(state.previewUrl);
      state.previewUrl = "";
    }

    state.selectedImage = null;
    state.originalImage = null;
    state.cropSelection = null;
    state.isCropping = false;
    state.cropDragStart = null;

    elements.imageInput.value = "";
    elements.imagePreview.removeAttribute("src");
    elements.imageWorkspace.classList.add("hidden");
    elements.imagePreviewFrame.classList.remove("is-cropping");
    elements.cropControls.classList.add("hidden");
    resetCropSelection();
    elements.recognizeButton.disabled = true;
    elements.ocrStatus.textContent = "";
    elements.ocrProgress.value = 0;
    elements.ocrProgress.classList.add("hidden");
  }

  return {
    applyImageCrop,
    cancelCrop,
    clear,
    endCropDrag,
    enterCropMode,
    handleFileSelection,
    moveCropDrag,
    resetCropSelection,
    runOcr,
    startCropDrag,
    useFullImage,
  };
}

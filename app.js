const imageInput = document.querySelector("#imageInput");
const imagePreview = document.querySelector("#imagePreview");
const recognizeButton = document.querySelector("#recognizeButton");
const clearButton = document.querySelector("#clearButton");
const ocrStatus = document.querySelector("#ocrStatus");
const ocrProgress = document.querySelector("#ocrProgress");
const editableText = document.querySelector("#editableText");
const renderButton = document.querySelector("#renderButton");
const reader = document.querySelector("#reader");
const speakButton = document.querySelector("#speakButton");
const stopButton = document.querySelector("#stopButton");
const speechRate = document.querySelector("#speechRate");
const wordPanel = document.querySelector("#wordPanel");
const selectedWord = document.querySelector("#selectedWord");
const speakWordButton = document.querySelector("#speakWordButton");

let selectedImage = null;

/**
 * Returns true when the token contains at least one Hebrew character.
 */
function containsHebrew(token) {
  return /[\u0590-\u05FF]/u.test(token);
}

/**
 * Removes surrounding punctuation while preserving Hebrew letters and marks.
 */
function normalizeHebrewWord(token) {
  return token.replace(/^[^\u0590-\u05FF]+|[^\u0590-\u05FF]+$/gu, "");
}

/**
 * Updates speech control availability based on the current text.
 */
function updateSpeechButtons() {
  const hasText = editableText.value.trim().length > 0;
  speakButton.disabled = !hasText;
  stopButton.disabled = !hasText;
}

/**
 * Finds a Hebrew voice exposed by the current browser or operating system.
 */
function findHebrewVoice() {
  const voices = window.speechSynthesis.getVoices();

  return (
    voices.find((voice) => voice.lang.toLowerCase() === "he-il") ||
    voices.find((voice) => voice.lang.toLowerCase().startsWith("he")) ||
    null
  );
}

/**
 * Speaks Hebrew text with the browser Web Speech API.
 */
function speakHebrew(text) {
  const cleanText = text.trim();

  if (!cleanText) {
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(cleanText);
  const hebrewVoice = findHebrewVoice();

  utterance.lang = "he-IL";
  utterance.rate = Number(speechRate.value);

  if (hebrewVoice) {
    utterance.voice = hebrewVoice;
  }

  window.speechSynthesis.speak(utterance);
}

/**
 * Converts plain Hebrew text into clickable word spans.
 */
function renderClickableText() {
  const text = editableText.value.trim();

  reader.replaceChildren();

  if (!text) {
    const emptyState = document.createElement("p");
    emptyState.className = "empty-state";
    emptyState.textContent = "Your Hebrew text will appear here.";
    reader.append(emptyState);
    wordPanel.classList.add("hidden");
    updateSpeechButtons();
    return;
  }

  const tokens = text.split(/(\s+)/u);

  tokens.forEach((token) => {
    if (/^\s+$/u.test(token)) {
      reader.append(document.createTextNode(token));
      return;
    }

    if (!containsHebrew(token)) {
      reader.append(document.createTextNode(token));
      return;
    }

    const button = document.createElement("span");
    button.className = "word-token";
    button.tabIndex = 0;
    button.setAttribute("role", "button");
    button.textContent = token;

    const activateWord = () => {
      const word = normalizeHebrewWord(token);

      if (!word) {
        return;
      }

      selectedWord.textContent = word;
      wordPanel.classList.remove("hidden");
    };

    button.addEventListener("click", activateWord);
    button.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activateWord();
      }
    });

    reader.append(button);
  });

  updateSpeechButtons();
}

/**
 * Runs Hebrew OCR locally in the browser using Tesseract.js.
 */
async function recognizeHebrewText() {
  if (!selectedImage) {
    return;
  }

  recognizeButton.disabled = true;
  ocrProgress.value = 0;
  ocrProgress.classList.remove("hidden");
  ocrStatus.textContent = "Preparing Hebrew OCR...";

  try {
    const result = await Tesseract.recognize(selectedImage, "heb", {
      logger(message) {
        if (typeof message.progress === "number") {
          ocrProgress.value = message.progress;
        }

        if (message.status) {
          const percentage =
            typeof message.progress === "number"
              ? ` ${Math.round(message.progress * 100)}%`
              : "";

          ocrStatus.textContent = `${message.status}${percentage}`;
        }
      },
    });

    editableText.value = result.data.text.trim();
    renderClickableText();
    ocrStatus.textContent = "Hebrew text recognized. You can correct it manually if needed.";
  } catch (error) {
    console.error("Hebrew OCR failed:", error);
    ocrStatus.textContent =
      "OCR failed. Check your internet connection and try another image.";
  } finally {
    recognizeButton.disabled = false;
    ocrProgress.classList.add("hidden");
  }
}

imageInput.addEventListener("change", () => {
  const [file] = imageInput.files;

  if (!file) {
    return;
  }

  selectedImage = file;
  imagePreview.src = URL.createObjectURL(file);
  imagePreview.classList.remove("hidden");
  recognizeButton.disabled = false;
  ocrStatus.textContent = "Image loaded. Ready to recognize Hebrew text.";
});

recognizeButton.addEventListener("click", recognizeHebrewText);

renderButton.addEventListener("click", renderClickableText);

editableText.addEventListener("input", updateSpeechButtons);

speakButton.addEventListener("click", () => {
  speakHebrew(editableText.value);
});

stopButton.addEventListener("click", () => {
  window.speechSynthesis.cancel();
});

speakWordButton.addEventListener("click", () => {
  speakHebrew(selectedWord.textContent);
});

clearButton.addEventListener("click", () => {
  window.speechSynthesis.cancel();

  if (imagePreview.src) {
    URL.revokeObjectURL(imagePreview.src);
  }

  selectedImage = null;
  imageInput.value = "";
  imagePreview.removeAttribute("src");
  imagePreview.classList.add("hidden");
  editableText.value = "";
  recognizeButton.disabled = true;
  ocrStatus.textContent = "";
  ocrProgress.value = 0;
  ocrProgress.classList.add("hidden");
  wordPanel.classList.add("hidden");
  renderClickableText();
});

window.speechSynthesis.addEventListener?.("voiceschanged", () => {
  findHebrewVoice();
});

renderClickableText();

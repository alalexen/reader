import { fetchDueCards, gradeReview } from "../services/reviewService.js";

const LANGUAGES = [["en", "English"], ["ru", "Russian"], ["uk", "Ukrainian"]];

export function createReviewController({ elements, speak }) {
  let queue = [];
  let index = 0;
  let answered = 0;
  let busy = false;

  function setStatus(message) {
    elements.reviewStatus.textContent = message;
  }

  function render() {
    const card = queue[index];
    elements.reviewSession.classList.toggle("hidden", !card);
    elements.reviewEmpty.classList.toggle("hidden", Boolean(card));
    elements.reviewCount.textContent = String(queue.length);
    elements.reviewProgress.textContent = card
      ? `Card ${index + 1} of ${queue.length}`
      : answered ? `Reviewed ${answered} card${answered === 1 ? "" : "s"} this session.` : "";
    if (!card) {
      elements.reviewEmpty.textContent = answered
        ? "Session complete! Check back later for more words."
        : "No cards due right now. Save some words while reading.";
      return;
    }
    elements.reviewWord.textContent = card.word;
    elements.reviewSentence.textContent = card.sentence || "";
    elements.reviewSentence.classList.toggle("hidden", !card.sentence);
    elements.reviewAnswer.replaceChildren();
    for (const [code, label] of LANGUAGES) {
      const item = document.createElement("p");
      const name = document.createElement("strong");
      name.textContent = `${label}: `;
      item.append(name, document.createTextNode(card.translations?.[code] || "—"));
      elements.reviewAnswer.append(item);
    }
    elements.reviewAnswer.classList.add("hidden");
    elements.revealReviewButton.classList.remove("hidden");
    elements.reviewRatingButtons.classList.add("hidden");
    elements.reviewSpeakSentence.disabled = !card.sentence;
    elements.reviewSkipButton.disabled = false;
    setStatus("");
  }

  async function refresh() {
    busy = true;
    setStatus("Loading review cards...");
    try {
      const cards = await fetchDueCards();
      queue = cards;
      index = 0;
      answered = 0;
      render();
    } catch (error) {
      console.error("Could not load review queue:", error);
      setStatus("Could not load reviews. Check the PostgreSQL connection and retry.");
    } finally {
      busy = false;
    }
  }

  function reveal() {
    if (busy || !queue[index]) return;
    elements.reviewAnswer.classList.remove("hidden");
    elements.revealReviewButton.classList.add("hidden");
    elements.reviewRatingButtons.classList.remove("hidden");
  }

  async function rate(rating) {
    if (busy || !queue[index]) return;
    busy = true;
    elements.reviewRatingButtons.querySelectorAll("button").forEach((b) => { b.disabled = true; });
    const card = queue[index];
    try {
      await gradeReview(card.id, rating);
      answered += 1;
      index += 1;
      render();
    } catch (error) {
      console.error("Could not save review:", error);
      setStatus("Your rating was not confirmed. Try again.");
      elements.reviewRatingButtons.querySelectorAll("button").forEach((b) => { b.disabled = false; });
    } finally {
      busy = false;
    }
  }

  function skip() {
    if (busy || !queue[index]) return;
    index += 1;
    render();
  }

  elements.reviewRefreshButton.addEventListener("click", refresh);
  elements.revealReviewButton.addEventListener("click", reveal);
  elements.reviewSkipButton.addEventListener("click", skip);
  elements.reviewSpeakWord.addEventListener("click", () => {
    if (queue[index]) speak(queue[index].word);
  });
  elements.reviewSpeakSentence.addEventListener("click", () => {
    if (queue[index]?.sentence) speak(queue[index].sentence);
  });
  elements.reviewRatingButtons.querySelectorAll("[data-review-rating]").forEach((button) => {
    button.addEventListener("click", () => rate(button.dataset.reviewRating));
  });
  return { refresh };
}

import { removeFlashcard } from "../services/flashcardsService.js";
import { gradeWord } from "../services/studyService.js";
import { dateTitle, groupBySavedDay, localDayKey, sortSavedCards } from "../utils/savedWords.js";

const LANGUAGE_NAMES = { en: "English", ru: "Russian", uk: "Ukrainian" };
const RATING_LABELS = { again: "Again", hard: "Hard", good: "Good", easy: "Easy" };

function node(tag, className = "", value = null) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (value !== null) element.textContent = value;
  return element;
}

function wordCount(count) {
  return `${count} ${count === 1 ? "word" : "words"}`;
}

function displayDay(key) {
  const today = localDayKey(new Date());
  const previous = new Date();
  previous.setDate(previous.getDate() - 1);
  if (key === today) return "Today";
  if (key === localDayKey(previous)) return "Yesterday";
  return dateTitle(key);
}

export function createVocabularyController({ elements, state, speak, navigate }) {
  let search = "";
  let sort = "newest";
  let filter = "all";
  let selectedIds = new Set();
  let selectedDay = null;
  let calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  let session = null;
  let busy = false;

  function updateCards(cards) {
    state.flashcards = cards;
    const available = new Set(cards.map((card) => card.id));
    selectedIds = new Set([...selectedIds].filter((id) => available.has(id)));
    renderSavedWords();
    renderCalendar();
    if (selectedDay) renderDay();
  }

  function showError(message) {
    elements.savedWordsStatus.textContent = message;
    elements.calendarStatus.textContent = message;
  }

  function filteredCards() {
    const needle = search.trim().toLocaleLowerCase();
    const now = Date.now();
    return sortSavedCards(state.flashcards.filter((card) => {
      if (filter === "due" && card.nextReviewAt && Date.parse(card.nextReviewAt) > now) {
        return false;
      }
      if (filter === "learning" && !["learning", "new"].includes(card.state)) {
        return false;
      }
      if (needle) {
        const corpus = [card.word, card.sentence, ...Object.values(card.translations || {})]
          .join(" ").toLocaleLowerCase();
        if (!corpus.includes(needle)) return false;
      }
      return true;
    }), sort);
  }

  function translationsPanel(card) {
    const panel = node("div", "vocab-expanded hidden");
    panel.id = "word-details-" + card.id;
    const grid = node("div", "vocab-translations");
    for (const language of ["en", "ru", "uk"]) {
      const item = node("div", "vocab-translation");
      item.append(node("small", "", LANGUAGE_NAMES[language]), node("span", "", card.translations?.[language] || "—"));
      grid.append(item);
    }
    const deleteButton = node("button", "secondary vocab-delete", "Delete word");
    deleteButton.type = "button";
    deleteButton.addEventListener("click", async () => {
      if (!window.confirm(`Delete "${card.word}" from Saved Words?`)) return;
      deleteButton.disabled = true;
      try {
        const cards = await removeFlashcard(card.id);
        updateCards(cards);
        elements.savedWordsStatus.textContent = "Word deleted.";
      } catch (error) {
        console.error("Could not delete word:", error);
        elements.savedWordsStatus.textContent = "Could not delete word. Try again.";
        deleteButton.disabled = false;
      }
    });
    panel.append(grid, deleteButton);
    return panel;
  }

  function createRow(card, { selectable = false } = {}) {
    const article = node("article", "vocab-row");
    const top = node("div", "vocab-row-main");
    if (selectable) {
      const check = node("input", "vocab-check");
      check.type = "checkbox";
      check.checked = selectedIds.has(card.id);
      check.setAttribute("aria-label", "Select " + card.word);
      check.addEventListener("change", () => {
        if (check.checked) selectedIds.add(card.id);
        else selectedIds.delete(card.id);
        updateStudyButton();
      });
      top.append(check);
    }
    const term = node("div", "vocab-term");
    const word = node("strong", "vocab-hebrew", card.word);
    word.dir = "rtl";
    word.lang = "he";
    term.append(word, node("span", "vocab-meaning", card.translations?.en || card.translations?.uk || "—"));
    const sentence = node("p", "vocab-sentence", card.sentence || "No example sentence saved");
    if (card.sentence) { sentence.lang = "he"; sentence.dir = "rtl"; }
    const context = node("div", "vocab-context");
    context.append(sentence);
    const when = node("span", "vocab-timestamp");
    const date = new Date(card.savedAt || "");
    when.textContent = Number.isNaN(date.getTime())
      ? "Date unknown"
      : date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    const actions = node("div", "vocab-row-actions");
    const listen = node("button", "vocab-icon-button", "♪");
    listen.type = "button";
    listen.title = "Listen to " + card.word;
    listen.setAttribute("aria-label", listen.title);
    listen.addEventListener("click", () => speak(card.word));
    const open = node("button", "secondary vocab-open", "Open");
    open.type = "button";
    open.setAttribute("aria-expanded", "false");
    open.setAttribute("aria-controls", "word-details-" + card.id);
    const panel = translationsPanel(card);
    open.addEventListener("click", () => {
      const expanded = !panel.classList.toggle("hidden");
      open.setAttribute("aria-expanded", String(expanded));
      open.textContent = expanded ? "Close" : "Open";
    });
    actions.append(listen, open);
    top.append(term, context, when, actions);
    article.append(top, panel);
    return article;
  }

  function updateStudyButton() {
    const count = selectedIds.size;
    elements.studySavedButton.textContent = count
      ? `Study selected (${count})` : "Study saved words";
    elements.studySavedButton.disabled = state.flashcards.length === 0;
  }

  function renderSavedWords() {
    const cards = filteredCards();
    elements.savedWordsGroups.replaceChildren();
    elements.savedWordsCount.textContent = wordCount(state.flashcards.length) + " saved";
    updateStudyButton();
    if (!cards.length) {
      elements.savedWordsGroups.append(node("p", "vocab-empty", state.flashcards.length
        ? "No words match your search or filter."
        : "No saved words yet. Go to Read and choose Remember word."));
      return;
    }
    const groups = groupBySavedDay(cards);
    for (const [key, words] of groups) {
      const group = node("section", "vocab-date-group");
      const heading = node("div", "vocab-group-heading");
      const title = node("h2", "", displayDay(key));
      heading.append(title, node("span", "", wordCount(words.length)));
      const list = node("div", "vocab-group-list");
      for (const card of words) list.append(createRow(card, { selectable: true }));
      group.append(heading, list);
      elements.savedWordsGroups.append(group);
    }
  }

  function wordsOnDay(key) {
    return sortSavedCards(state.flashcards.filter((card) => localDayKey(card.savedAt) === key), "newest");
  }

  function renderDay() {
    const cards = wordsOnDay(selectedDay);
    elements.dayWordsTitle.textContent = "Words added on " + dateTitle(selectedDay);
    elements.dayWordsSubtitle.textContent = wordCount(cards.length) + " saved on this date.";
    elements.dayWordsList.replaceChildren();
    elements.studyDayButton.disabled = cards.length === 0;
    for (const card of cards) elements.dayWordsList.append(createRow(card));
    if (!cards.length) elements.dayWordsList.append(node("p", "vocab-empty", "No words were saved on this date."));
  }

  function openDay(key) {
    selectedDay = key;
    renderDay();
    navigate("day");
  }

  function renderCalendar() {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    elements.calendarTitle.textContent = calendarMonth.toLocaleDateString("en-US", {
      month: "long", year: "numeric",
    });
    const counts = new Map();
    for (const card of state.flashcards) {
      const key = localDayKey(card.savedAt);
      if (key) counts.set(key, (counts.get(key) || 0) + 1);
    }
    const first = new Date(year, month, 1);
    const offset = first.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cellCount = Math.ceil((offset + daysInMonth) / 7) * 7;
    let monthlyCount = 0;
    let activeDays = 0;
    let peak = 0;

    elements.calendarGrid.replaceChildren();
    for (const name of ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]) {
      elements.calendarGrid.append(node("div", "calendar-weekday", name));
    }
    for (let i = 0; i < cellCount; i += 1) {
      const day = new Date(year, month, 1 + i - offset);
      const key = localDayKey(day);
      const count = counts.get(key) || 0;
      const inMonth = day.getMonth() === month;
      if (inMonth) {
        monthlyCount += count;
        if (count) activeDays += 1;
        peak = Math.max(peak, count);
      }
      const button = node("button", "calendar-day");
      button.type = "button";
      if (!inMonth) button.classList.add("is-outside");
      if (key === localDayKey(new Date())) button.classList.add("is-today");
      if (count) button.classList.add("has-words");
      if (count >= 5) button.classList.add("is-busy");
      button.setAttribute("aria-label", `${dateTitle(key)}: ${wordCount(count)} added. Open day.`);
      const number = node("span", "calendar-day-number", String(day.getDate()));
      const badge = node("span", "calendar-day-count", wordCount(count));
      button.append(number, badge);
      button.addEventListener("click", () => openDay(key));
      elements.calendarGrid.append(button);
    }
    elements.calendarMonthlyWords.textContent = String(monthlyCount);
    elements.calendarActiveDays.textContent = String(activeDays);
    elements.calendarPeak.textContent = wordCount(peak);
  }

  function showStudy() {
    if (!session) return;
    const current = session.cards[session.index];
    elements.studyCard.classList.toggle("hidden", !current);
    elements.studyComplete.classList.toggle("hidden", Boolean(current));
    elements.studyStatus.textContent = "";
    elements.studySource.textContent = session.source;
    if (!current) {
      elements.studyComplete.textContent =
        `Session complete — ${session.rated.size} of ${session.cards.length} words reviewed.`;
      return;
    }
    elements.studyProgressLabel.textContent = `${session.index + 1} of ${session.cards.length}`;
    elements.studyProgress.value = 100 * session.index / session.cards.length;
    elements.studyPrevious.disabled = session.index === 0;
    elements.studyNext.disabled = false;
    elements.studyWord.textContent = current.word;
    elements.studySentence.textContent = current.sentence || "";
    elements.studySentence.classList.toggle("hidden", !current.sentence);
    elements.studyListenSentence.disabled = !current.sentence;
    elements.studyTranslations.replaceChildren();
    for (const lang of ["en", "ru", "uk"]) {
      const row = node("div", "study-translation-row");
      row.append(node("span", "", LANGUAGE_NAMES[lang]), node("strong", "", current.translations?.[lang] || "—"));
      elements.studyTranslations.append(row);
    }
    const rated = session.rated.has(current.id);
    elements.studyAnswer.classList.toggle("hidden", !rated);
    elements.studyReveal.classList.toggle("hidden", rated);
    elements.studyRatingButtons.classList.add("hidden");
    if (rated) elements.studyStatus.textContent = "Already reviewed in this session.";
  }

  function startStudy(cards, source, returnPage) {
    if (!cards.length) return;
    session = {
      cards: [...cards],
      index: 0,
      rated: new Set(),
      source,
      returnPage,
    };
    showStudy();
    navigate("study");
  }

  async function rate(rating) {
    if (busy || !session) return;
    const card = session.cards[session.index];
    if (!card || session.rated.has(card.id)) return;
    busy = true;
    const buttons = elements.studyRatingButtons.querySelectorAll("button");
    buttons.forEach((button) => { button.disabled = true; });
    try {
      const updated = await gradeWord(card.id, rating);
      session.rated.add(card.id);
      state.flashcards = state.flashcards.map((item) => item.id === card.id ? { ...item, ...updated } : item);
      session.index += 1;
      showStudy();
      renderSavedWords();
    } catch (error) {
      console.error("Could not record review:", error);
      elements.studyStatus.textContent = "Could not save this review. Please try again.";
    } finally {
      busy = false;
      buttons.forEach((button) => { button.disabled = false; });
    }
  }

  function revealAnswer() {
    if (busy || !session?.cards[session.index]) return;
    elements.studyAnswer.classList.remove("hidden");
    elements.studyReveal.classList.add("hidden");
    elements.studyRatingButtons.classList.remove("hidden");
  }

  function moveStudy(direction) {
    if (busy || !session) return;
    const next = session.index + direction;
    if (next < 0 || next > session.cards.length) return;
    session.index = next;
    showStudy();
  }

  elements.savedSearch.addEventListener("input", () => {
    search = elements.savedSearch.value;
    renderSavedWords();
  });
  elements.savedSort.addEventListener("change", () => {
    sort = elements.savedSort.value;
    renderSavedWords();
  });
  elements.savedFilter.addEventListener("change", () => {
    filter = elements.savedFilter.value;
    renderSavedWords();
  });
  elements.studySavedButton.addEventListener("click", () => {
    const cards = selectedIds.size
      ? filteredCards().filter((card) => selectedIds.has(card.id))
      : filteredCards();
    startStudy(cards, selectedIds.size ? "Selected words" : "All saved words", "saved");
  });
  elements.savedCalendarButton.addEventListener("click", () => navigate("calendar"));
  elements.calendarPrevious.addEventListener("click", () => {
    calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1);
    renderCalendar();
  });
  elements.calendarNext.addEventListener("click", () => {
    calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1);
    renderCalendar();
  });
  elements.calendarToday.addEventListener("click", () => {
    calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    renderCalendar();
  });
  elements.dayBack.addEventListener("click", () => navigate("calendar"));
  elements.studyDayButton.addEventListener("click", () => {
    startStudy(wordsOnDay(selectedDay), dateTitle(selectedDay), "day");
  });
  elements.studyBack.addEventListener("click", () => navigate(session?.returnPage || "saved"));
  elements.studyReveal.addEventListener("click", revealAnswer);
  elements.studyPrevious.addEventListener("click", () => moveStudy(-1));
  elements.studyNext.addEventListener("click", () => moveStudy(1));
  elements.studyListenWord.addEventListener("click", () => {
    const word = session?.cards[session.index]?.word;
    if (word) speak(word);
  });
  elements.studyListenSentence.addEventListener("click", () => {
    const sentence = session?.cards[session.index]?.sentence;
    if (sentence) speak(sentence);
  });
  for (const button of elements.studyRatingButtons.querySelectorAll("[data-rating]")) {
    if (!RATING_LABELS[button.dataset.rating]) throw new Error("Invalid rating button.");
    button.addEventListener("click", () => rate(button.dataset.rating));
  }

  renderSavedWords();
  renderCalendar();
  return { updateCards, showError };
}

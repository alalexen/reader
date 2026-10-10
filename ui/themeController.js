import { saveSettings } from "../services/settingsService.js";

/** Applies and persists the two supported appearance modes without changing any reading data. */
export function createThemeController({ elements, state }) {
  /** Reflects theme preference in CSS, the toggle, and appearance controls. */
  function apply(theme) {
    const normalized = theme === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = normalized;
    elements.themeToggle.setAttribute("aria-pressed", String(normalized === "dark"));
    elements.themeToggle.setAttribute(
      "aria-label",
      normalized === "dark" ? "Switch to light mode" : "Switch to dark mode",
    );
    elements.themeToggle.title = normalized === "dark" ? "Light mode" : "Dark mode";
    elements.themeToggle.querySelector(".theme-toggle-icon").textContent =
      normalized === "dark" ? "☾" : "☀";
    elements.appearanceInputs.forEach((input) => {
      input.checked = input.value === normalized;
    });
  }

  /** Updates stored preference only after a real user interaction. */
  function choose(theme) {
    state.settings.theme = theme === "dark" ? "dark" : "light";
    saveSettings(state.settings);
    apply(state.settings.theme);
  }

  /** Toggles between the existing light palette and the gothic dark palette. */
  function toggle() {
    choose(state.settings.theme === "dark" ? "light" : "dark");
  }

  elements.themeToggle.addEventListener("click", toggle);
  apply(state.settings.theme);
  return { apply, choose };
}

/** Lightweight page navigation. Reading state remains mounted between views. */
const VIEWS = ["read", "saved", "calendar", "day", "study"];

export function createNavigationController({ elements, onLeaveRead }) {
  let currentView = "read";

  function show(view) {
    if (!VIEWS.includes(view)) throw new Error("Unknown page: " + view);
    if (currentView === "read" && view !== "read") onLeaveRead();
    currentView = view;
    document.querySelectorAll("[data-page]").forEach((page) => {
      const active = page.dataset.page === view;
      page.classList.toggle("hidden", !active);
      page.setAttribute("aria-hidden", String(!active));
    });
    document.querySelectorAll("[data-nav]").forEach((button) => {
      const active = button.dataset.nav === (view === "day" ? "calendar" : view === "study" ? "saved" : view);
      button.classList.toggle("is-active", active);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    document.title = (view === "read" ? "Hebrew Reader" : ({
      saved: "Saved Words", calendar: "Word Calendar",
      day: "Words by Date", study: "Study Saved Words",
    })[view] + " · Hebrew Reader");
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  elements.navRead.addEventListener("click", () => show("read"));
  elements.navSaved.addEventListener("click", () => show("saved"));
  elements.navCalendar.addEventListener("click", () => show("calendar"));
  return { show, getCurrentView: () => currentView };
}

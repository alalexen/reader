export function initializeSessionTimer(element) {
  const startedAt = Date.now();

  const updateTimer = () => {
    const elapsedSeconds = Math.max(
      0,
      Math.floor((Date.now() - startedAt) / 1000),
    );
    const hours = Math.floor(elapsedSeconds / 3600) % 24;
    const minutes = Math.floor((elapsedSeconds % 3600) / 60);
    const seconds = elapsedSeconds % 60;
    const value = [hours, minutes, seconds]
      .map((part) => String(part).padStart(2, "0"))
      .join(":");

    element.textContent = value;
    element.dateTime = `PT${elapsedSeconds}S`;
  };

  updateTimer();
  return window.setInterval(updateTimer, 1000);
}

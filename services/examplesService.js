/**
 * Builds the official Reverso Context page URL for a selected Hebrew word.
 *
 * Reverso does not publish a documented public Context API for browser apps,
 * so the project deliberately avoids undocumented scraping endpoints.
 */
export function buildReversoContextUrl(word) {
  const cleanWord = word.trim();

  return `https://context.reverso.net/translation/hebrew-english/${encodeURIComponent(cleanWord)}`;
}

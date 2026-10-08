/* Text anchors are independent of rendered HTML, fonts and window size. */
(function (root) {
  'use strict';
  function anchor(text, start, end) {
    while (start < end && /\s/.test(text[start])) start++;
    while (end > start && /\s/.test(text[end - 1])) end--;
    if (start < 0 || end > text.length || start >= end) return null;
    return { start, end, quote:text.slice(start, end), prefix:text.slice(Math.max(0, start - 48), start), suffix:text.slice(end, end + 48) };
  }
  function locate(item, text) {
    if (!item || typeof item.quote !== 'string' || !item.quote) return null;
    const prefix = item.prefix || '', suffix = item.suffix || '';
    const candidates = [];
    let start = text.indexOf(item.quote);
    while (start !== -1 && candidates.length < 2000) {
      const end = start + item.quote.length;
      let score = 0;
      for (let i = 1; i <= prefix.length && start >= i && text[start - i] === prefix[prefix.length - i]; i++) score++;
      for (let i = 0; i < suffix.length && text[end + i] === suffix[i]; i++) score++;
      candidates.push({ start, end, score });
      start = text.indexOf(item.quote, start + 1);
    }
    if (candidates.length === 1) return candidates[0];
    if (!candidates.length || candidates.length === 2000) return null;
    candidates.sort((a, b) => b.score - a.score);
    // Ambiguous passages stay in the list instead of highlighting the wrong text.
    return candidates[0].score > candidates[1].score ? candidates[0] : null;
  }
  const api = { anchor, locate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.YueHighlights = api;
})(typeof globalThis === 'undefined' ? this : globalThis);

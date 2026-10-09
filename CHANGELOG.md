# Changelog

## 1.2.2 — 2026-10-09 — Faster opening

- Remove the repeatable two-second lookup delay for the internal Windows host while retaining the same origin, documents, highlights and preferences.
- Read command-line files while WebView2 initializes and render the requested file directly on first load.
- Restore the document library in the background; save imported files without blocking their display. Load cached images only when referenced.
- Avoid scanning unannotated documents for highlights and remove the idle gap between native file-open requests.
- Keep the guarded, opaque first frame and the shared web/offline/Windows interface.
- This remains an unsigned public preview; signing still requires a verified publisher identity.

## 1.2.1 — 2026-10-08 — Typography refinement

- Use classic Georgia for Latin text before CJK serif fallbacks; recognize Noto Serif SC and Source Han Serif SC when installed.
- Apply the chosen reading font to document headings as well as body text, quotes, lists and tables. Code remains monospace and controls keep the UI font.
- Refine serif heading weight, line height and spacing; rename the setting to Reading font in all seven languages.
- Keep web, offline HTML and Windows editions in sync without adding downloadable fonts.

## 1.2.0 — 2026-10-08 — Public preview

- Softer Paper and Sage, neutral White and Night themes.
- Seven switchable languages in the reader, guides, Windows setup and website.
- Document text and highlights remain unchanged across language changes.
- Website connects the web reader, installer, portable ZIP, offline HTML and open source.
- MIT license, build documentation, issue templates, checksums and launch materials.

## 1.1.1 — Private preview

- Unified theme menu, paler highlights and guarded WebView2 startup reveal.
- Clear Install button/title and shared web/Windows UI.

## 1.1.0 — Private preview

- Local persistent text highlights, excerpt list, cancellation, undo and relocation.

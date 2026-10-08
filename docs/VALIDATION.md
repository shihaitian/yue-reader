# 1.2.1 validation

## Signing pipeline preparation (after 1.2.1)

- Added staged compilation, certificate-store signing and a gated signed-release export. The existing 1.2.1 download bytes and unsigned status remain unchanged.
- 16 signing/release checks cover a real timestamped Microsoft SDK signature, wrong publisher, unsigned/tampered/missing files, absent signing identity, non-overwriting output, and path boundaries. No private key or trust-store changes are involved.
- No trusted Yue signing identity is available yet. End-to-end signed release creation and download/install reputation are **not validated**. See [signing setup](WINDOWS-SIGNING.md).

## Reader typography

- Verified actual rendered fonts through browser font inspection: Georgia for English and Noto Serif SC for Chinese on the test machine.
- Inspected English and Chinese serif screenshots. Headings, paragraphs, quotes, lists and tables follow the selected face; inline and block code remain monospace. Font preference persistence, switching back to sans, and narrow screens passed.
- Seven-language localization checks and the Windows build boundary checks are rerun for this release.

## 1.2.0 baseline validation

- 41 highlight regression checks: database migration, persistence, formatted and multi-paragraph selections, relocation, orphan excerpts, undo, search, themes, narrow screens and storage failures.
- 48 localization checks: seven complete 267-string catalogs, placeholder parity, system default, language persistence, translated help, 320px layouts, unchanged user text/highlights and four themes.
- Seven-language website checks: localized text, reader links, responsive layouts, screenshots and theme preview.
- 17 native checks: encoding, file size/type boundaries, traversal rejection, association quoting and candidate registration. No registry writes.
- Native startup checks use transparent, non-activating windows and isolated data. The first sampled reading frame had no black blank region. Four themes and seven languages propagated to the native surface/title and persisted.
- Installer layout tests cover seven languages without installing or changing file associations. Rendered English and German layouts were visually inspected.

This is not a complete OS/browser compatibility matrix. Full install/uninstall/default-app journeys have not been tested across supported Windows versions. The installer is unsigned. Startup behavior can vary by graphics driver. Test real download/install flows before broad paid promotion.

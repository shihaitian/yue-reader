# Validation

## 1.2.2 startup performance — 2026-10-09

- Before the fix, three small-document launches with fresh isolated WebView2 profiles reached the document at 3027, 2996 and 2907 ms. Resources did not start loading until about 2010 ms into each navigation; an existing profile showed the same delay.
- Resolving only `yue.local` inside the app's browser process removes that lookup delay. The origin and profile directory are unchanged; there is no data migration and no system DNS, security, certificate or Defender change.
- Final build: three fresh-profile runs reached the requested document at **727, 699 and 734 ms**. Reusing the profile took **666 ms**. Subsequent file forwarding through the named pipe took **16–29 ms**, excluding the shell/second-process launch cost. These are this machine's measurements from benchmark Main to the document-ready state, not universal latency guarantees.
- `Run-StartupChecks.ps1` uses transparent, non-activating windows and isolated data. Native first-frame checks found zero sampled black pixels and the correct document; four themes and seven languages still propagate and persist. Full cold-boot, antivirus download scanning, slow network drives and large-file performance are not included in the small-file figures.
- 13 startup browser checks cover slow storage, early native display, preservation of fresh file content, saved position and highlights, deferred writes, fetching only referenced cached images, and restoring cached native images without reopening the original file. All 41 highlight and 48 localization checks passed, as did 17 native boundary checks and 16 signing/release rejection checks. Native benchmarks also check that initial local-image replies are not dropped before the page-ready handshake.
- The EXE and ZIP are explicitly unsigned public previews. Trusted-release export still rejects unsigned binaries. The installer payload and portable ZIP must match the shared UI and all 25 app files before publication.

Run `node md-reader/tests/startup.test.cjs` with the reader server active. For native measurements, build Windows, then run `./tests/Run-StartupChecks.ps1` from yue-windows. Test harnesses are built outside the app payload.

## 1.2.1 typography

## Signing pipeline preparation (after 1.2.1)

- Added staged compilation, certificate-store signing and a gated signed-release export. The existing 1.2.1 download bytes and unsigned status remain unchanged.
- 16 signing/release checks cover a real timestamped Microsoft SDK signature, wrong publisher, unsigned/tampered/missing files, absent signing identity, non-overwriting output, and path boundaries. No private key or trust-store changes are involved.
- No trusted Yue signing identity is available yet. End-to-end signed release creation and download/install reputation are **not validated**. See [signing setup](WINDOWS-SIGNING.md).

### Reader typography

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

# Contributing

Bug reports, small fixes and translation improvements are welcome. Check existing issues and include the version, operating system, language, visible problem and reproduction steps. Use a minimal synthetic Markdown example; never upload confidential documents.

Keep the reader buildless and browser-local. Preserve the shared web/Windows interface, stable document IDs, existing IndexedDB records and original Markdown. Changes to filesystem boundaries, HTML sanitization or file association behavior need relevant regression checks. Do not write protected Windows default-choice registry values.

For translations, update the relevant TSV row in all seven columns, run build-locales.mjs (including --native for Windows strings), and verify placeholders and the UI. Screenshot sample documents, never personal documents.

Submit a focused pull request describing behavior and validation. Contributions are licensed under MIT. Please be respectful and discuss the work rather than the person.

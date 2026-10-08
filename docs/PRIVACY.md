# Privacy notes

Yue processes Markdown and imported images on the current device. IndexedDB stores document snapshots, relative image assets and highlights; localStorage stores interface and reading preferences. Windows uses a WebView2 profile under %LOCALAPPDATA%/YueReader/WebView2 and a small local language preference. YUE_READER_DATA isolates automated test data.

No app account, document upload, behavioral analytics, advertising or cloud synchronization is implemented. Browsers, devices and the Windows app have separate stores. A website visit sends ordinary network requests to the hosting provider. Source and download links may contact GitHub. External document images contact their hosts after the user chooses to load them; external links open their destination.

Removing an item from the library does not remove its original file. Clearing browser/app data removes saved copies and highlights. Windows uninstall is designed to retain originals and reading data. Keep backups of important originals.

Yue does not claim end-to-end encryption, encrypted local storage or synchronized backups.

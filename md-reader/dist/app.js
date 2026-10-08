(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const nativeHost = window.chrome?.webview;
  const { t } = window.YueI18n;
  const locale = () => window.YueI18n.locale;
  const imageRequests = new Map();
  const chooseFiles = () => nativeHost ? nativeHost.postMessage({ type:'open' }) : $('file-input').click();
  const icons = {
    'book-open':'<path d="m3 4 9 3 9-3v16l-9-3-9 3V4Z"/><path d="M12 7v10"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    file:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
    upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5"/>',
    shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
    help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4.2 1.8c-1.2.6-1.7 1-1.7 2.2M12 17h.01"/>',
    panel:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
    sun:'<circle cx="12" cy="12" r="3.5"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M19 5l-1.5 1.5m-11 11L5 19"/>',
    moon:'<path d="M20.9 13.5A9 9 0 0 1 10.5 3.1a9 9 0 1 0 10.4 10.4Z"/>',
    focus:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
    minimize:'<path d="M3 8h5V3m13 5h-5V3M3 16h5v5m13-5h-5v5"/>',
    more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    leaf:'<path d="M20 3C7 3 2 8 5 15s15 2 15-12Z"/><path d="M4 21 15 10"/>',
    list:'<path d="M9 6h12M9 12h12M9 18h12M3 6h.01M3 12h.01M3 18h.01"/>',
    'arrow-up':'<path d="M12 20V4m-6 6 6-6 6 6"/>',
    'arrow-right':'<path d="M4 12h16m-6-6 6 6-6 6"/>',
    up:'<path d="m6 14 6-6 6 6"/>',
    down:'<path d="m6 10 6 6 6-6"/>',
    x:'<path d="m6 6 12 12M6 18 18 6"/>',
    copy:'<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M15 9V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h4"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    folder:'<path d="M3 7V5a2 2 0 0 1 2-2h4l3 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/>',
    clipboard:'<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M8 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3M8 12h8M8 16h5"/>',
    download:'<path d="M12 3v13m-5-5 5 5 5-5M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>',
    printer:'<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6zM18 12h.01"/>',
    image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.5"/><path d="m21 15-6-6L3 21"/>',
    highlighter:'<path d="m9 11 7-7 5 5-7 7-5-5ZM9 11l-4 4 4 4 5-3M4 20h7"/>',
  };
  const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.file}</svg>`;
  document.querySelectorAll('[data-icon]').forEach((node) => { node.innerHTML = icon(node.dataset.icon); });
  const defaults = { theme:'paper', size:16, font:'sans', width:'comfortable', active:'welcome' };
  let prefs;
  try { prefs = { ...defaults, ...JSON.parse(localStorage.getItem('yue-preferences') || '{}') }; } catch { prefs = { ...defaults }; }
  // Keep the user's previous light-green or sepia preference after the upgrade.
  if (prefs.theme === 'light') prefs.theme = 'green';
  if (prefs.theme === 'sepia') prefs.theme = 'paper';
  if (!['white','paper','green','dark'].includes(prefs.theme)) prefs.theme = defaults.theme;
  prefs.size = Math.max(13, Math.min(22, Number(prefs.size) || 16));
  const samples = window.YueSamples(locale());
  let docs = [...samples];
  let active = samples[0];
  let database = null;
  let assets = new Map();
  let headings = [];
  let matches = [];
  let matchIndex = -1;
  let focused = false;
  let renderVersion = 0;
  let toastTimer, positionTimer, findTimer;
  const positions = new Map();
  const annotations = new Map();
  let annotationsReady = false, annotationBusy = false, pendingSelection = null;
  let highlightMarks = new Map(), resolvedHighlights = new Map(), selectionFrame;
  const MAX_DOCUMENT = 5 * 1024 * 1024;
  const isMarkdown = (name) => /\.(md|markdown|mdown|mkd|txt)$/i.test(name);
  const isImage = (name) => /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i.test(name);
  const bytesLabel = (size) => size < 1024 ? `${size} B` : `${(size/1024).toFixed(1)} KB`;
  const uid = () => 'doc-' + (crypto.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2));
  const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function toast(message, action) {
    clearTimeout(toastTimer);
    $('toast').replaceChildren(document.createTextNode(message));
    if (action) {
      const button = document.createElement('button');
      button.textContent = action.label;
      button.onclick = () => { action.run(); $('toast').hidden = true; };
      $('toast').append(button);
    }
    $('toast').hidden = false;
    toastTimer = setTimeout(() => { $('toast').hidden = true; }, action ? 9000 : 3800);
  }
  function persistPrefs() { try { localStorage.setItem('yue-preferences', JSON.stringify(prefs)); } catch { /* Session preferences still work. */ } }
  function applyPreferences() {
    document.documentElement.dataset.theme = prefs.theme;
    document.documentElement.style.setProperty('--article-size', `${prefs.size}px`);
    document.documentElement.style.setProperty('--article-width', prefs.width === 'wide' ? '1050px' : '760px');
    document.documentElement.style.setProperty('--article-font', prefs.font === 'serif' ? '"Songti SC","Noto Serif CJK SC",SimSun,serif' : 'var(--body-font)');
    $('font-value').value = prefs.size;
    $('font-minus').disabled = prefs.size <= 13;
    $('font-plus').disabled = prefs.size >= 22;
    document.querySelectorAll('[data-font]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.font === prefs.font)));
    document.querySelectorAll('[data-width]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.width === prefs.width)));
    document.querySelectorAll('[data-theme-choice]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.themeChoice === prefs.theme)));
    const themeName = t({ white:'浅白', paper:'暖纸', green:'浅绿', dark:'夜间' }[prefs.theme]);
    $('theme-toggle').title = `${t('主题')} · ${themeName}`;
    $('theme-toggle').setAttribute('aria-label', t('主题，当前为{theme}', { theme:themeName }));
    document.querySelector('meta[name="theme-color"]').content = { white:'#fafafa', paper:'#faf9f6', green:'#f8f9f7', dark:'#242424' }[prefs.theme];
    requestAnimationFrame(updateProgress);
    persistPrefs();
  }
  function storageUnavailable() { $('storage-status').textContent = t('本次会话可用'); }
  function openDatabase() {
    return new Promise((resolve) => {
      let settled = false;
      const settle = (db) => { if (!settled) { settled = true; resolve(db); } else db?.close(); };
      try {
        const request = indexedDB.open('yue-reader', 2);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains('docs')) db.createObjectStore('docs', { keyPath:'id' });
          if (!db.objectStoreNames.contains('assets')) db.createObjectStore('assets', { keyPath:'path' });
          if (!db.objectStoreNames.contains('highlights')) db.createObjectStore('highlights', { keyPath:'docId' });
        };
        request.onsuccess = () => settle(request.result);
        request.onerror = () => settle(null);
        request.onblocked = () => settle(null);
        setTimeout(() => settle(null), 2500);
      } catch { settle(null); }
    });
  }
  function dbOperation(store, operation, value) {
    if (!database) return Promise.resolve(operation === 'getAll' ? [] : undefined);
    return new Promise((resolve, reject) => {
      const tx = database.transaction(store, operation === 'getAll' ? 'readonly' : 'readwrite');
      const request = tx.objectStore(store)[operation](value);
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }
  async function saveDoc(doc) {
    try { await dbOperation('docs', 'put', doc); }
    catch { storageUnavailable(); toast(t('浏览器存储空间不足；文档仍可阅读，请保留原文件。')); }
  }
  function renderLibrary() {
    const filter = $('library-filter').value.trim().toLocaleLowerCase();
    $('document-list').replaceChildren();
    $('doc-count').textContent = docs.length;
    const filtered = docs.filter((doc) => doc.name.toLocaleLowerCase().includes(filter));
    filtered.forEach((doc) => {
      const row = document.createElement('div');
      row.className = 'document-row' + (doc.id === active.id ? ' active' : '');
      const button = document.createElement('button');
      button.className = 'document-button';
      button.title = doc.path || doc.name;
      button.innerHTML = icon('file') + `<span class="doc-name">${escapeHTML(doc.name)}</span>`;
      if (doc.id === active.id) button.setAttribute('aria-current', 'page');
      button.onclick = () => openDocument(doc.id);
      row.append(button);
      if (!doc.sample) {
        const remove = document.createElement('button');
        remove.className = 'remove-doc icon-button small';
        remove.setAttribute('aria-label', t('移除 {name}', { name:doc.name }));
        remove.title = t('移除（可撤销）');
        remove.innerHTML = icon('x');
        remove.onclick = () => removeDocument(doc);
        row.append(remove);
      }
      $('document-list').append(row);
    });
    if (!filtered.length) {
      const empty = document.createElement('p');
      empty.className = 'library-empty';
      empty.textContent = t('没有找到匹配的文档');
      $('document-list').append(empty);
    }
  }
  function rememberPosition() {
    if (!active) return;
    const scroller = $('reading-scroll');
    positions.set(active.id, scroller.scrollTop);
    active.position = scroller.scrollTop;
  }
  function closeMobileLibrary() { $('sidebar').classList.remove('mobile-open'); $('sidebar-scrim').hidden = true; }
  function openDocument(id, { restore = true, remember = true } = {}) {
    const doc = docs.find((d) => d.id === id);
    if (!doc) return;
    if (remember) { rememberPosition(); if (active.id !== id && database) saveDoc(active); }
    clearTimeout(positionTimer);
    active = doc;
    prefs.active = id;
    persistPrefs();
    $('current-filename').textContent = doc.name;
    document.title = `${doc.name} · Yue`;
    document.querySelector('.file-extension').textContent = doc.name.split('.').pop().toUpperCase().slice(0,8);
    $('document-type').innerHTML = icon(doc.sample ? 'leaf' : 'file') + (doc.sample ? t('一页开始，一刻专注') : t('我的本地文档'));
    const words = (doc.content.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]|[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) || []).length;
    $('document-meta').textContent = t('{count} 字 · 约 {minutes} 分钟', { count:YueI18n.number(words), minutes:YueI18n.number(Math.max(1, Math.ceil(words / (['zh-CN','ja'].includes(locale()) ? 450 : 220)))) });
    $('word-count').textContent = t('{count} 字', { count:YueI18n.number(words) });
    $('status-description').textContent = `${doc.sample ? t('示例文档') : t('本地文档')} · ${bytesLabel(new Blob([doc.content]).size)}`;
    renderArticle();
    renderLibrary();
    closeMobileLibrary();
    requestAnimationFrame(() => {
      $('reading-scroll').scrollTo({ top: restore ? positions.get(id) ?? doc.position ?? 0 : 0, behavior:'instant' });
      updateProgress();
    });
  }
  function normalizePath(path) {
    const parts = [];
    String(path).replace(/\\/g, '/').split('/').forEach((part) => { if (part === '..') parts.pop(); else if (part && part !== '.') parts.push(part); });
    return parts.join('/');
  }
  function relativePath(src) {
    const dir = (active.path || '').split('/').slice(0,-1).join('/');
    let decoded = src;
    try { decoded = decodeURIComponent(src); } catch { /* Malformed percent signs are literal. */ }
    return normalizePath((dir ? dir + '/' : '') + decoded.split(/[?#]/)[0]);
  }
  function configureImages(fragment) {
    fragment.querySelectorAll('img').forEach((img) => {
      const src = img.getAttribute('src') || '';
      const alt = img.getAttribute('alt') || t('文档图片');
      img.removeAttribute('src');
      img.removeAttribute('srcset');
      img.removeAttribute('width');
      img.removeAttribute('height');
      img.loading = 'lazy';
      img.referrerPolicy = 'no-referrer';
      img.alt = alt;
      const nativeKey = `native:${active.id}:${src}`;
      const local = assets.get(nativeKey) || assets.get(relativePath(src)) || assets.get(normalizePath(src));
      if (local) { img.src = local.url; return; }
      if (/^data:image\/(png|jpeg|gif|webp|avif);base64,/i.test(src)) { img.src = src; return; }
      const placeholder = document.createElement('div');
      placeholder.className = 'image-placeholder';
      placeholder.innerHTML = icon('image');
      const label = document.createElement('span');
      label.textContent = alt;
      placeholder.append(label);
      if (/^https?:\/\//i.test(src) || /^\/\//.test(src)) {
        const load = document.createElement('button');
        load.textContent = t('加载外部图片');
        load.onclick = () => {
          img.onerror = () => { placeholder.replaceChildren(document.createTextNode(t('图片暂时无法加载'))); if (img.isConnected) img.replaceWith(placeholder); };
          img.src = src;
          placeholder.replaceWith(img);
        };
        placeholder.append(load);
      } else if (nativeHost && active.native && src) {
        const hint = document.createElement('small'); hint.textContent = t('正在加载本地图片…'); placeholder.append(hint);
        const requestId = uid();
        imageRequests.set(requestId,{ img, placeholder, hint, key:nativeKey });
        nativeHost.postMessage({ type:'image', requestId, docId:active.id, src });
      } else {
        const hint = document.createElement('small');
        hint.textContent = t('请将本地图片一同拖入，或打开所在文件夹');
        placeholder.append(hint);
      }
      img.replaceWith(placeholder);
    });
  }
  function renderArticle() {
    renderVersion++;
    hideSelectionToolbar();
    highlightMarks = new Map();
    imageRequests.clear();
    const source = active.content.replace(/^\uFEFF/, '');
    const cleaned = DOMPurify.sanitize(marked.parse(source, { gfm:true, breaks:false, async:false }), {
      USE_PROFILES:{ html:true },
      FORBID_TAGS:['style','form','button','textarea','select','iframe','object','embed','audio','video','source','base','meta','link'],
      FORBID_ATTR:['style','id','name','srcset','autofocus','contenteditable','formaction','action'],
    });
    const template = document.createElement('template');
    template.innerHTML = cleaned;
    template.content.querySelectorAll('input').forEach((input) => { if (input.type !== 'checkbox') input.remove(); else input.disabled = true; });
    configureImages(template.content);
    template.content.querySelectorAll('a').forEach((a) => {
      const href = a.getAttribute('href') || '';
      if (/^(https?:|mailto:|tel:)/i.test(href)) {
        a.target = '_blank'; a.rel = 'noopener noreferrer';
      } else if (href && !href.startsWith('#')) {
        a.onclick = (event) => {
          event.preventDefault();
          const path = relativePath(href);
          const target = docs.find((doc) => doc.path === path || doc.name === path);
          if (target) { openDocument(target.id); const hash = href.split('#')[1]; if (hash) requestAnimationFrame(() => scrollToHash(hash)); }
          else if (nativeHost && active.native) nativeHost.postMessage({ type:'open-relative', docId:active.id, src:href });
          else toast(t('请先打开此链接对应的本地文档。'));
        };
      }
    });
    $('article').replaceChildren(template.content);
    if (!source.trim()) {
      const p = document.createElement('p'); p.textContent = t('这是一份空文档。'); $('article').append(p);
    }
    const used = new Set();
    headings = [...$('article').querySelectorAll('h1,h2,h3,h4,h5,h6')];
    headings.forEach((heading, index) => {
      const text = heading.textContent;
      const base = text.toLocaleLowerCase().replace(/[^\p{L}\p{N}_\-\s]/gu, '').trim().replace(/\s+/g, '-') || `section-${index+1}`;
      let slug = base, suffix = 1;
      while (used.has(slug)) slug = `${base}-${suffix++}`;
      used.add(slug);
      heading.id = `heading-${slug}`;
      heading.dataset.slug = slug;
      heading.dataset.title = text;
      const anchor = document.createElement('a');
      anchor.href = `#${encodeURIComponent(slug)}`;
      anchor.className = 'heading-anchor';
      anchor.textContent = '#';
      anchor.setAttribute('aria-label', t('跳转到 {name}', { name:text }));
      heading.append(anchor);
    });
    $('article').querySelectorAll('a[href^="#"]').forEach((a) => {
      a.onclick = (event) => { event.preventDefault(); scrollToHash(a.getAttribute('href').slice(1)); };
    });
    $('article').querySelectorAll('pre > code').forEach((code) => {
      const original = code.textContent;
      const language = [...code.classList].find((c) => c.startsWith('language-'))?.slice(9) || 'text';
      if (original.length < 100000 && language !== 'text') {
        try { if (hljs.getLanguage(language)) code.innerHTML = hljs.highlight(original, { language, ignoreIllegals:true }).value; } catch { /* Plain code is still readable. */ }
      }
      const header = document.createElement('div');
      header.className = 'code-header';
      const name = document.createElement('span'); name.textContent = language;
      const copy = document.createElement('button'); copy.className = 'copy-code'; copy.innerHTML = icon('copy') + t('复制'); copy.setAttribute('aria-label',t('复制代码'));
      copy.onclick = async () => {
        if (await copyText(original)) { copy.innerHTML = icon('check') + t('已复制'); setTimeout(() => { copy.innerHTML = icon('copy') + t('复制'); }, 1800); }
      };
      header.append(name, copy); code.parentElement.prepend(header);
    });
    $('article').querySelectorAll('table').forEach((table) => { const wrapper = document.createElement('div'); wrapper.className = 'table-wrap'; table.before(wrapper); wrapper.append(table); });
    renderOutline();
    renderHighlights();
    if (!$('find-bar').hidden && $('find-input').value) runFind(false); else { matches = []; matchIndex = -1; updateFindCount(); }
  }
  function renderOutline() {
    $('outline-list').replaceChildren();
    $('mobile-outline').replaceChildren();
    const list = headings.filter((h) => h.tagName !== 'H1');
    (list.length ? list : headings).forEach((heading) => {
      const link = document.createElement('a');
      link.href = '#' + encodeURIComponent(heading.dataset.slug);
      link.textContent = heading.dataset.title;
      link.dataset.target = heading.id;
      link.className = 'level-' + heading.tagName.slice(1);
      link.onclick = (event) => { event.preventDefault(); heading.scrollIntoView({ behavior:reducedMotion() ? 'instant' : 'smooth', block:'start' }); };
      $('outline-list').append(link);
      const mobileLink = link.cloneNode(true);
      mobileLink.onclick = (event) => { event.preventDefault(); $('outline-dialog').close(); heading.scrollIntoView({ behavior:reducedMotion() ? 'instant' : 'smooth', block:'start' }); };
      $('mobile-outline').append(mobileLink);
    });
    if (!headings.length) $('mobile-outline').textContent = t('本文暂无标题');
  }
  function scrollToHash(hash) {
    let decoded = hash;
    try { decoded = decodeURIComponent(hash); } catch { /* Use literal hash. */ }
    const target = headings.find((heading) => heading.dataset.slug === decoded || heading.dataset.title === decoded || heading.id === decoded);
    if (target) target.scrollIntoView({ behavior:reducedMotion() ? 'instant' : 'smooth', block:'start' });
  }
  function reducedMotion() { return matchMedia('(prefers-reduced-motion: reduce)').matches; }
  function updateProgress() {
    const scroller = $('reading-scroll');
    const max = scroller.scrollHeight - scroller.clientHeight;
    const percentage = max > 1 ? Math.max(0, Math.min(100, Math.round(scroller.scrollTop / max * 100))) : 100;
    $('progress-value').textContent = percentage + '%';
    $('progress-bar').style.width = percentage + '%';
    const top = scroller.getBoundingClientRect().top + 95;
    let current = headings[0];
    headings.forEach((heading) => { if (heading.getBoundingClientRect().top <= top) current = heading; });
    const links = [...$('outline-list').children];
    if (percentage === 100 && links.length) current = headings.find((h) => h.id === links.at(-1).dataset.target);
    links.forEach((link, i) => {
      const selected = link.dataset.target === current?.id || (current?.tagName === 'H1' && i === 0);
      link.classList.toggle('active', selected);
      if (selected) link.setAttribute('aria-current','location'); else link.removeAttribute('aria-current');
    });
  }
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch {
      const temporary = document.createElement('textarea');
      temporary.value = text; temporary.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.body.append(temporary); temporary.select();
      let copied = false;
      try { copied = document.execCommand('copy'); } catch { /* Manual selection remains available. */ }
      temporary.remove();
      if (!copied) toast(t('未能访问剪贴板，请选择代码后手动复制。'));
      return copied;
    }
  }
  function clearMatches() {
    $('article').querySelectorAll('mark.find-match').forEach((mark) => { mark.replaceWith(document.createTextNode(mark.textContent)); });
    $('article').normalize();
    matches = []; matchIndex = -1;
  }
  function textIndex() {
    const nodes = [];
    let text = '';
    const walker = document.createTreeWalker($('article'), NodeFilter.SHOW_TEXT, { acceptNode(node) {
      return node.parentElement.closest('.heading-anchor,.code-header,.image-placeholder,button,script,style') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
    }});
    while (walker.nextNode()) {
      const node = walker.currentNode;
      nodes.push({ node, start:text.length, end:text.length + node.length });
      text += node.data;
    }
    return { text, nodes };
  }
  function hideSelectionToolbar() { pendingSelection = null; $('selection-toolbar').hidden = true; }
  function captureSelection() {
    if (annotationBusy || document.querySelector('dialog[open]')) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) {
      if (!$('selection-toolbar').contains(document.activeElement)) hideSelectionToolbar();
      return;
    }
    const range = selection.getRangeAt(0);
    if (!$('article').contains(range.startContainer) || !$('article').contains(range.endContainer)) { hideSelectionToolbar(); return; }
    const index = textIndex();
    let start = null, end = null;
    for (const entry of index.nodes) {
      if (!range.intersectsNode(entry.node)) continue;
      const from = range.startContainer === entry.node ? range.startOffset : 0;
      const to = range.endContainer === entry.node ? range.endOffset : entry.node.length;
      if (from >= to) continue;
      if (start === null) start = entry.start + from;
      end = entry.start + to;
    }
    const anchor = start === null ? null : YueHighlights.anchor(index.text, start, end);
    if (!anchor) { hideSelectionToolbar(); return; }
    pendingSelection = { docId:active.id, anchor, text:index.text };
    const toolbar = $('selection-toolbar');
    const rect = [...range.getClientRects()].find((r) => r.width && r.height) || range.getBoundingClientRect();
    toolbar.hidden = false;
    $('highlight-selection').disabled = !annotationsReady || !database;
    toolbar.style.left = Math.max(8, Math.min(innerWidth - toolbar.offsetWidth - 8, rect.left + Math.min(rect.width, 240) / 2 - toolbar.offsetWidth / 2)) + 'px';
    const top = rect.top >= toolbar.offsetHeight + 12 ? rect.top - toolbar.offsetHeight - 8 : rect.bottom + 8;
    toolbar.style.top = Math.max(8, Math.min(innerHeight - toolbar.offsetHeight - 8, top)) + 'px';
  }
  function scheduleSelection() { cancelAnimationFrame(selectionFrame); selectionFrame = requestAnimationFrame(captureSelection); }
  function mutateAnnotations(docId, update) {
    return new Promise((resolve, reject) => {
      if (!database || !annotationsReady) { reject(new Error('storage-unavailable')); return; }
      const tx = database.transaction('highlights', 'readwrite');
      const store = tx.objectStore('highlights');
      const request = store.get(docId);
      let items;
      request.onsuccess = () => {
        try { items = update(request.result?.items || []); store.put({ docId, items }); }
        catch (error) { tx.abort(); reject(error); }
      };
      tx.oncomplete = () => { annotations.set(docId, items); resolve(items); };
      tx.onerror = tx.onabort = () => reject(tx.error || new Error('storage-unavailable'));
    });
  }
  async function addHighlight() {
    if (annotationBusy) return;
    if (!pendingSelection) captureSelection();
    const selected = pendingSelection;
    if (!selected || selected.docId !== active.id) { toast(t('先选中正文中的文字或段落，再点击高亮。')); return; }
    if (selected.anchor.quote.length > 50000) { toast(t('这段文字较长，请分段高亮。')); return; }
    annotationBusy = true;
    $('highlight-selection').disabled = true;
    try {
      await mutateAnnotations(selected.docId, (items) => {
        let start = selected.anchor.start, end = selected.anchor.end;
        const kept = [];
        for (const item of items) {
          const found = YueHighlights.locate(item, selected.text);
          if (found && found.start < end && found.end > start) { start = Math.min(start, found.start); end = Math.max(end, found.end); }
          else kept.push(item);
        }
        if (kept.length >= 1000) throw new Error('highlight-limit');
        kept.push({ ...YueHighlights.anchor(selected.text, start, end), id:uid(), created:Date.now() });
        return kept;
      });
      hideSelectionToolbar();
      window.getSelection()?.removeAllRanges();
      if (active.id === selected.docId) refreshHighlights();
      toast(t('高亮已保存，下次打开仍会保留。'));
    } catch (error) {
      toast(error.message === 'highlight-limit' ? t('本篇高亮较多，请先整理已有记录。') : t('高亮未能保存，请检查本地存储空间后重试。'));
    } finally { annotationBusy = false; $('highlight-selection').disabled = !annotationsReady || !database; }
  }
  async function removeHighlight(docId, id) {
    if (annotationBusy) return;
    annotationBusy = true;
    let removed;
    try {
      await mutateAnnotations(docId, (items) => { removed = items.find((item) => item.id === id); return items.filter((item) => item.id !== id); });
      if (active.id === docId) refreshHighlights();
      toast(t('已取消高亮。'), { label:t('撤销'), run:async () => {
        if (!removed) return;
        try { await mutateAnnotations(docId, (items) => items.some((item) => item.id === removed.id) ? items : [...items, removed]); if (active.id === docId) refreshHighlights(); }
        catch { toast(t('未能恢复高亮，请检查本地存储空间。')); }
      }});
    } catch { toast(t('取消操作未保存，请稍后重试。')); }
    finally { annotationBusy = false; }
  }
  function refreshHighlights() {
    hideSelectionToolbar();
    clearMatches();
    renderHighlights();
    if (!$('find-bar').hidden && $('find-input').value) runFind(false);
  }
  function renderHighlights() {
    for (const marks of highlightMarks.values()) for (const mark of marks) if (mark.isConnected) mark.replaceWith(...mark.childNodes);
    $('article').normalize();
    highlightMarks = new Map(); resolvedHighlights = new Map();
    const index = textIndex();
    const items = annotations.get(active.id) || [];
    const ranges = [];
    for (const item of items) {
      const range = YueHighlights.locate(item, index.text);
      resolvedHighlights.set(item.id, range);
      if (range) { ranges.push({ ...range, id:item.id }); highlightMarks.set(item.id, []); }
    }
    for (const entry of index.nodes) {
      const overlaps = ranges.filter((r) => r.start < entry.end && r.end > entry.start);
      if (!overlaps.length) continue;
      const cuts = [...new Set([0, entry.node.length, ...overlaps.flatMap((r) => [Math.max(0, r.start - entry.start), Math.min(entry.node.length, r.end - entry.start)])])].sort((a, b) => a - b);
      const fragment = document.createDocumentFragment();
      for (let i = 1; i < cuts.length; i++) {
        const from = cuts[i - 1], to = cuts[i];
        const covering = overlaps.filter((r) => r.start < entry.start + to && r.end > entry.start + from);
        const value = entry.node.data.slice(from, to);
        if (!covering.length) { fragment.append(document.createTextNode(value)); continue; }
        const mark = document.createElement('mark');
        mark.className = 'user-highlight'; mark.textContent = value;
        mark.title = t('已保存的高亮 · 点击查看');
        mark.onclick = (e) => {
          if (!window.getSelection()?.isCollapsed) return;
          e.preventDefault(); setHighlightsPanel(true);
          const card = [...$('highlights-list').children].find((card) => card.dataset.highlightId === covering[0].id);
          card?.scrollIntoView({ block:'nearest' }); card?.querySelector('button')?.focus({ preventScroll:true });
        };
        fragment.append(mark);
        covering.forEach((r) => highlightMarks.get(r.id).push(mark));
      }
      entry.node.replaceWith(fragment);
    }
    renderHighlightList(items);
  }
  function renderHighlightList(items) {
    $('highlight-count').textContent = items.length;
    $('highlights-toggle').title = `${t('本篇高亮')}${items.length ? ` · ${YueI18n.number(items.length)}` : ''}`;
    $('highlights-toggle').classList.toggle('has-highlights', items.length > 0);
    $('highlights-storage').textContent = !annotationsReady ? t('正在读取本地记录…') : !database ? t('本地存储不可用，暂时无法保存高亮') : t('自动保存在本地 · 原文件不变');
    $('highlights-list').replaceChildren();
    if (!items.length) {
      const empty = document.createElement('div'); empty.className = 'highlights-empty';
      empty.innerHTML = icon('highlighter') + '<strong>' + escapeHTML(t('把喜欢的句子留下来')) + '</strong><p>' + escapeHTML(t('选中一段文字，点击浮条中的「高亮」。')) + '<br>' + escapeHTML(t('也可以按 Ctrl + Shift + H。')) + '</p>';
      $('highlights-list').append(empty); return;
    }
    [...items].sort((a, b) => (resolvedHighlights.get(a.id)?.start ?? Infinity) - (resolvedHighlights.get(b.id)?.start ?? Infinity) || a.created - b.created).forEach((item) => {
      const card = document.createElement('div'); card.className = 'highlight-card'; card.dataset.highlightId = item.id;
      const quote = document.createElement('button'); quote.className = 'highlight-quote'; quote.textContent = item.quote;
      quote.setAttribute('aria-label', t('跳转到高亮：{quote}', { quote:item.quote.slice(0, 80) }));
      const found = resolvedHighlights.get(item.id);
      quote.disabled = !found;
      quote.onclick = () => {
        if (matchMedia('(max-width:1020px)').matches) setHighlightsPanel(false);
        const marks = highlightMarks.get(item.id) || [];
        marks[0]?.scrollIntoView({ behavior:reducedMotion() ? 'instant' : 'smooth', block:'center' });
        marks.forEach((mark) => { mark.classList.add('highlight-jump'); setTimeout(() => mark.classList.remove('highlight-jump'), 1600); });
      };
      const footer = document.createElement('div'); footer.className = 'highlight-card-footer';
      const status = document.createElement('span'); status.textContent = found ? t('已保存') : t('原文有变动，保留此摘录');
      const remove = document.createElement('button'); remove.textContent = t('取消高亮'); remove.setAttribute('aria-label', t('取消高亮：{quote}', { quote:item.quote.slice(0, 60) }));
      const docId = active.id;
      remove.onclick = () => removeHighlight(docId, item.id);
      footer.append(status, remove); card.append(quote, footer); $('highlights-list').append(card);
    });
  }
  function setHighlightsPanel(open) {
    $('highlights-panel').hidden = !open;
    $('highlights-toggle').setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('show-highlights', open);
    hideSelectionToolbar(); closePopovers();
    requestAnimationFrame(updateProgress);
  }
  function runFind(scroll = true) {
    clearMatches();
    const query = $('find-input').value.toLocaleLowerCase().trim();
    if (!query) { updateFindCount(); return; }
    const walker = document.createTreeWalker($('article'), NodeFilter.SHOW_TEXT, { acceptNode(node) {
      return node.parentElement.closest('.heading-anchor,.code-header,.image-placeholder') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
    }});
    const groups = new Map();
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const block = node.parentElement.closest('p,h1,h2,h3,h4,h5,h6,li,td,th,pre') || node.parentElement;
      if (!groups.has(block)) groups.set(block, { text:'', nodes:[] });
      const group = groups.get(block);
      group.nodes.push({ node, start:group.text.length, end:group.text.length + node.textContent.length });
      group.text += node.textContent;
    }
    for (const group of groups.values()) {
      const lower = group.text.toLocaleLowerCase();
      const ranges = [];
      let found = lower.indexOf(query);
      while (found !== -1 && matches.length < 2000) {
        const marks = [];
        ranges.push({ start:found, end:found+query.length, marks });
        matches.push(marks);
        found = lower.indexOf(query, found+query.length);
      }
      for (const entry of group.nodes) {
        const overlaps = ranges.filter((r) => r.start < entry.end && r.end > entry.start);
        if (!overlaps.length) continue;
        const value = entry.node.textContent;
        const fragment = document.createDocumentFragment();
        let cursor = 0;
        overlaps.forEach((range) => {
          const start = Math.max(0,range.start-entry.start), end = Math.min(value.length,range.end-entry.start);
          fragment.append(document.createTextNode(value.slice(cursor,start)));
          const mark = document.createElement('mark'); mark.className = 'find-match'; mark.textContent = value.slice(start,end);
          fragment.append(mark); range.marks.push(mark); cursor = end;
        });
        fragment.append(document.createTextNode(value.slice(cursor)));
        entry.node.replaceWith(fragment);
      }
      if (matches.length >= 2000) break;
    }
    if (matches.length) { matchIndex = 0; activateMatch(scroll); } else updateFindCount();
  }
  function updateFindCount() {
    $('find-count').textContent = !$('find-input').value.trim() ? t('输入关键词') : !matches.length ? t('未找到匹配') : `${matchIndex+1} / ${matches.length}${matches.length >= 2000 ? '+' : ''}`;
    $('find-prev').disabled = $('find-next').disabled = !matches.length;
  }
  function activateMatch(scroll = true) {
    matches.forEach((group,i) => group.forEach((mark) => mark.classList.toggle('current',i === matchIndex)));
    if (scroll) matches[matchIndex]?.[0]?.scrollIntoView({ behavior:'instant', block:'center' });
    updateFindCount();
  }
  function stepMatch(direction) { if (matches.length) { matchIndex = (matchIndex + direction + matches.length) % matches.length; activateMatch(); } }
  function openFind() { closePopovers(); $('find-bar').hidden = false; $('find-input').focus(); $('find-input').select(); }
  function closeFind() { clearTimeout(findTimer); $('find-bar').hidden = true; clearMatches(); $('find-input').value = ''; updateProgress(); $('search-toggle').focus(); }
  async function decodeFile(file) {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    if (bytes[0] === 255 && bytes[1] === 254) return new TextDecoder('utf-16le').decode(buffer);
    if (bytes[0] === 254 && bytes[1] === 255) return new TextDecoder('utf-16be').decode(buffer);
    try { return new TextDecoder('utf-8', { fatal:true }).decode(buffer); }
    catch { return new TextDecoder('gb18030').decode(buffer); }
  }
  async function importFiles(files) {
    const list = [...files];
    let imported = [], images = 0, skipped = 0;
    for (const file of list) {
      if (!isImage(file.name)) continue;
      if (file.size > 15 * 1024 * 1024) { skipped++; continue; }
      const path = normalizePath(file.webkitRelativePath || file.name);
      const previous = assets.get(path);
      if (previous) URL.revokeObjectURL(previous.url);
      assets.set(path, { blob:file, url:URL.createObjectURL(file) });
      images++;
      try { await dbOperation('assets','put',{ path, blob:file }); } catch { storageUnavailable(); }
    }
    for (const file of list) {
      if (!isMarkdown(file.name)) continue;
      if (file.size > MAX_DOCUMENT) { skipped++; continue; }
      try {
        const content = await decodeFile(file);
        const path = normalizePath(file.webkitRelativePath || file.name);
        const existing = docs.find((doc) => !doc.sample && doc.path === path);
        const doc = { id:existing?.id || uid(), name:file.name, path, content, position:existing?.position || 0, updated:Date.now() };
        if (existing) docs.splice(docs.indexOf(existing),1,doc); else docs.push(doc);
        await saveDoc(doc);
        imported.push(doc);
      } catch { skipped++; }
    }
    if (imported.length) { $('library-filter').value = ''; openDocument(imported[0].id); }
    else if (images) { renderArticle(); updateProgress(); }
    if (imported.length || images) toast([t('已打开 {count} 份文档', { count:YueI18n.number(imported.length) }), images ? t('载入 {count} 张图片', { count:YueI18n.number(images) }) : '', skipped ? t('{count} 个文件过大或无法读取', { count:YueI18n.number(skipped) }) : ''].filter(Boolean).join(' · '));
    else toast(skipped ? t('文件过大或无法读取。文档上限 5 MB，图片上限 15 MB。') : t('请选择 Markdown、TXT 文档或配套图片。'));
    $('file-input').value = ''; $('folder-input').value = '';
  }
  async function removeDocument(doc) {
    const index = docs.indexOf(doc);
    docs.splice(index,1);
    if (active.id === doc.id) openDocument(docs[Math.min(index, docs.length-1)].id); else renderLibrary();
    try { await dbOperation('docs','delete',doc.id); } catch { storageUnavailable(); }
    toast(t('已从文档库移除，原文件不受影响。'), { label:t('撤销'), run:() => { docs.splice(index,0,doc); saveDoc(doc); openDocument(doc.id); } });
  }
  function closePopovers(restoreFocus = false) {
    let trigger;
    ['settings','theme','more'].forEach((name) => {
      if (!$(name + '-panel').hidden) trigger = $(name + '-toggle');
      $(name + '-panel').hidden = true;
      $(name + '-toggle').setAttribute('aria-expanded','false');
    });
    if (restoreFocus === true) trigger?.focus();
  }
  function togglePopover(panel, trigger) {
    const open = $(panel).hidden;
    closePopovers();
    $(panel).hidden = !open;
    $(trigger).setAttribute('aria-expanded', String(open));
    if (open && panel === 'theme-panel') $(panel).querySelector('[aria-pressed="true"]').focus();
  }
  function toggleFocus(force) {
    focused = typeof force === 'boolean' ? force : !focused;
    document.body.classList.toggle('focus-mode',focused);
    $('focus-toggle').innerHTML = icon(focused ? 'minimize' : 'focus');
    $('focus-toggle').setAttribute('aria-label',focused ? t('退出专注模式') : t('进入专注模式'));
    $('focus-toggle').title = focused ? t('退出专注模式 (Esc)') : t('专注模式 (F)');
    $('focus-toggle').setAttribute('aria-pressed',String(focused));
    closeMobileLibrary(); closePopovers();
    requestAnimationFrame(updateProgress);
  }
  $('open-file').onclick = $('drop-card').onclick = chooseFiles;
  $('file-input').onchange = (e) => importFiles(e.target.files);
  $('folder-input').onchange = (e) => importFiles(e.target.files);
  $('folder-open').onclick = () => { closePopovers(); $('folder-input').click(); };
  $('brand').onclick = (e) => { e.preventDefault(); openDocument('welcome', { restore:false }); };
  $('library-search-toggle').onclick = () => {
    $('library-filter-wrap').hidden = !$('library-filter-wrap').hidden;
    if (!$('library-filter-wrap').hidden) $('library-filter').focus();
    else { $('library-filter').value = ''; renderLibrary(); }
  };
  $('library-filter').oninput = renderLibrary;
  $('sidebar-toggle').onclick = () => {
    if (focused) toggleFocus(false);
    if (matchMedia('(max-width:760px)').matches) { $('sidebar').classList.toggle('mobile-open'); $('sidebar-scrim').hidden = !$('sidebar').classList.contains('mobile-open'); }
    else document.body.classList.toggle('sidebar-collapsed');
  };
  $('sidebar-scrim').onclick = closeMobileLibrary;
  $('theme-toggle').onclick = () => togglePopover('theme-panel','theme-toggle');
  $('focus-toggle').onclick = $('status-focus').onclick = () => toggleFocus();
  $('settings-toggle').onclick = () => togglePopover('settings-panel','settings-toggle');
  $('more-toggle').onclick = () => togglePopover('more-panel','more-toggle');
  $('highlights-toggle').onclick = () => setHighlightsPanel($('highlights-panel').hidden);
  $('highlights-close').onclick = () => { setHighlightsPanel(false); $('highlights-toggle').focus(); };
  $('highlight-selection').onclick = addHighlight;
  $('selection-toolbar').addEventListener('pointerdown', (e) => e.preventDefault());
  document.addEventListener('selectionchange', scheduleSelection);
  document.addEventListener('pointerup', (e) => { if (!$('selection-toolbar').contains(e.target)) scheduleSelection(); });
  document.querySelectorAll('[data-close-popovers]').forEach((b) => { b.onclick = () => closePopovers(true); });
  $('font-minus').onclick = () => { prefs.size--; applyPreferences(); };
  $('font-plus').onclick = () => { prefs.size++; applyPreferences(); };
  document.querySelectorAll('[data-font]').forEach((b) => { b.onclick = () => { prefs.font = b.dataset.font; applyPreferences(); }; });
  document.querySelectorAll('[data-width]').forEach((b) => { b.onclick = () => { prefs.width = b.dataset.width; applyPreferences(); }; });
  document.querySelectorAll('[data-theme-choice]').forEach((b) => { b.onclick = () => {
    prefs.theme = b.dataset.themeChoice;
    applyPreferences();
    nativeHost?.postMessage({ type:'theme-changed', theme:prefs.theme, language:locale() });
    closePopovers(true);
  }; });
  $('reset-settings').onclick = () => { prefs = { ...defaults, theme:prefs.theme, active:active.id }; applyPreferences(); };
  document.addEventListener('click',(e) => { if (!e.target.closest('.popover,#settings-toggle,#theme-toggle,#more-toggle')) closePopovers(); });
  $('search-toggle').onclick = openFind;
  $('find-close').onclick = closeFind;
  $('find-input').oninput = () => { clearTimeout(findTimer); findTimer = setTimeout(runFind, 140); };
  $('find-input').onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); stepMatch(e.shiftKey ? -1 : 1); } };
  $('find-prev').onclick = () => stepMatch(-1);
  $('find-next').onclick = () => stepMatch(1);
  $('back-to-top').onclick = () => $('reading-scroll').scrollTo({ top:0, behavior:reducedMotion() ? 'instant' : 'smooth' });
  $('website-open').onclick = () => { closePopovers(); const url = 'https://yue-markdown-shiha.txqy0831.chatgpt.site/?lang=' + locale(); if (nativeHost) nativeHost.postMessage({ type:'website', url }); else window.open(url, '_blank', 'noopener'); };
  $('paste-open').onclick = () => { closePopovers(); $('paste-dialog').showModal(); $('paste-content').focus(); };
  $('paste-submit').onclick = async () => {
    const content = $('paste-content').value;
    if (!content.trim()) { $('paste-content').focus(); toast(t('先粘贴一些文字吧。')); return; }
    if (new Blob([content]).size > MAX_DOCUMENT) { toast(t('文档超过 5 MB，请适当分段后再打开。')); return; }
    let name = $('paste-name').value.trim() || content.match(/^#\s+(.+)$/m)?.[1]?.slice(0,80) || t('未命名文档');
    name = name.replace(/[<>:"/\\|?*\u0000-\u001f]/g,'-');
    if (!isMarkdown(name)) name += '.md';
    const doc = { id:uid(), name, content, position:0, updated:Date.now() };
    docs.push(doc); await saveDoc(doc); $('library-filter').value = ''; openDocument(doc.id, { restore:false });
    $('paste-dialog').close(); $('paste-content').value = ''; $('paste-name').value = '';
    toast(t('文字已就位，开始阅读吧。'));
  };
  $('help-button').onclick = () => $('help-dialog').showModal();
  $('outline-open').onclick = () => { closePopovers(); $('outline-dialog').showModal(); };
  $('download-file').onclick = () => {
    closePopovers();
    const url = URL.createObjectURL(new Blob([active.content],{type:'text/markdown;charset=utf-8'}));
    const a = document.createElement('a'); a.href = url; a.download = active.name; a.click();
    setTimeout(() => URL.revokeObjectURL(url),10000);
  };
  $('print-file').onclick = () => { closePopovers(); window.print(); };
  $('reading-scroll').addEventListener('scroll',() => {
    hideSelectionToolbar();
    updateProgress(); rememberPosition(); clearTimeout(positionTimer);
    const doc = active;
    positionTimer = setTimeout(() => saveDoc(doc),450);
  },{ passive:true });
  window.addEventListener('resize',() => { hideSelectionToolbar(); if (!matchMedia('(max-width:760px)').matches) closeMobileLibrary(); updateProgress(); });
  document.addEventListener('keydown',(e) => {
    const editing = e.target.matches('input,textarea,[contenteditable=true]');
    const modal = !!document.querySelector('dialog[open]');
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && !editing && !modal && e.key.toLowerCase() === 'h') { e.preventDefault(); addHighlight(); }
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !modal && e.key.toLowerCase() === 'o') { e.preventDefault(); chooseFiles(); }
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !modal && (e.key.toLowerCase() === 'k' || (e.key.toLowerCase() === 'f' && !editing))) { e.preventDefault(); openFind(); }
    if (!editing && !modal && !e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'f') { e.preventDefault(); toggleFocus(); }
    if (e.key === 'Escape' && !modal) {
      if (!$('selection-toolbar').hidden) { hideSelectionToolbar(); window.getSelection()?.removeAllRanges(); }
      else if (!$('settings-panel').hidden || !$('theme-panel').hidden || !$('more-panel').hidden) closePopovers(true);
      else if (!$('highlights-panel').hidden) setHighlightsPanel(false);
      else if (!$('find-bar').hidden) closeFind();
      else if ($('sidebar').classList.contains('mobile-open')) closeMobileLibrary();
      else if (focused) toggleFocus(false);
    }
  });
  let dragDepth = 0;
  const hasFiles = (event) => [...(event.dataTransfer?.types || [])].includes('Files');
  document.addEventListener('dragenter',(e) => { if (hasFiles(e)) { e.preventDefault(); dragDepth++; $('drop-overlay').hidden = false; } });
  document.addEventListener('dragover',(e) => { if (hasFiles(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
  document.addEventListener('dragleave',() => { if (--dragDepth <= 0) { dragDepth = 0; $('drop-overlay').hidden = true; } });
  document.addEventListener('drop',(e) => { e.preventDefault(); dragDepth = 0; $('drop-overlay').hidden = true; if (e.dataTransfer?.files.length) importFiles(e.dataTransfer.files); });
  window.addEventListener('pagehide',() => { rememberPosition(); saveDoc(active); });
  if (nativeHost) {
    const defaultsButton = document.createElement('button');
    defaultsButton.innerHTML = icon('file') + '<span id="native-defaults-label">' + escapeHTML(t('设为默认阅读器')) + '</span>';
    defaultsButton.onclick = () => { closePopovers(); nativeHost.postMessage({ type:'defaults' }); };
    $('more-panel').append(defaultsButton);
    let nativeUpdates = Promise.resolve(), nativeViewPrepared = false;
    nativeHost.addEventListener('message', ({ data }) => {
      // A prepare message must wait for the preceding file import and its storage write.
      nativeUpdates = nativeUpdates.then(async () => {
      if (data.type === 'notice') toast(data.message);
      if (data.type === 'image') {
        const request = imageRequests.get(data.requestId);
        if (!request) return;
        imageRequests.delete(data.requestId);
        if (data.error) { request.hint.textContent = data.error; return; }
        const bytes = Uint8Array.from(atob(data.bytes),(c) => c.charCodeAt(0));
        const blob = new Blob([bytes],{ type:data.mime });
        const url = URL.createObjectURL(blob);
        const old = assets.get(request.key); if (old) URL.revokeObjectURL(old.url);
        assets.set(request.key,{ blob, url });
        request.img.src = url; request.placeholder.replaceWith(request.img);
        try { await dbOperation('assets','put',{ path:request.key, blob }); } catch { /* Image remains available this session. */ }
      }
      if (data.type === 'open-documents') {
        for (const item of data.documents) {
          const existing = docs.find((d) => d.id === item.id);
          const doc = { ...item, native:true, position:existing?.position || 0, updated:Date.now() };
          if (existing) docs.splice(docs.indexOf(existing),1,doc); else docs.push(doc);
          await saveDoc(doc);
        }
        $('library-filter').value = '';
        if (data.documents.length) openDocument(data.documents[0].id);
      }
      if (data.type === 'prepare-view') {
        await document.fonts.ready;
        $('reading-scroll').scrollTop = positions.get(active.id) ?? active.position ?? 0;
        updateProgress();
        nativeViewPrepared = true;
        nativeHost.postMessage({ type:'view-ready', theme:prefs.theme });
      }
      }).catch(() => {
        if (!nativeViewPrepared) nativeHost.postMessage({ type:'view-error' });
        else toast(t('暂时无法打开此内容，请重新打开文档后重试。'));
      });
    });
  }
  window.addEventListener('yue-language-change', () => {
    rememberPosition();
    const localized = window.YueSamples(locale());
    for (const sample of localized) { const index=docs.findIndex(doc => doc.id===sample.id); if(index>=0) docs[index]={ ...sample, position:docs[index].position }; }
    applyPreferences();
    openDocument(active.id, { remember:false });
    toggleFocus(focused);
    if (!database) storageUnavailable();
    if (!$('find-bar').hidden) runFind();
    $('toast').hidden=true;
    if(nativeHost) { nativeHost.postMessage({ type:'language-changed', language:locale() }); document.getElementById('native-defaults-label').textContent=t('设为默认阅读器'); }
  });
  applyPreferences();
  renderLibrary();
  const requestedId = prefs.active;
  // Draw the first document immediately; restored local content follows asynchronously.
  openDocument('welcome', { restore:false, remember:false });
  (async () => {
    database = await openDatabase();
    if (!database) storageUnavailable();
    else database.onversionchange = () => { database.close(); database = null; storageUnavailable(); renderHighlightList(annotations.get(active.id) || []); };
    try {
      const [saved, savedAssets, savedHighlights] = await Promise.all([dbOperation('docs','getAll'), dbOperation('assets','getAll'), dbOperation('highlights','getAll')]);
      for (const record of savedHighlights) if (record && typeof record.docId === 'string' && Array.isArray(record.items)) annotations.set(record.docId, record.items.filter((item) => item && typeof item.id === 'string' && typeof item.quote === 'string'));
      annotationsReady = true;
      const initialVersion = renderVersion;
      for (const doc of saved) {
        if (!doc || typeof doc.content !== 'string' || typeof doc.name !== 'string') continue;
        const index = docs.findIndex((d) => d.id === doc.id);
        if (index >= 0) { if (docs[index].sample) docs[index].position = doc.position; }
        else docs.push(doc);
      }
      for (const asset of savedAssets) { if (!assets.has(asset.path)) assets.set(asset.path,{ blob:asset.blob, url:URL.createObjectURL(asset.blob) }); }
      // Only restore if the reader has not navigated while storage was opening.
      if (initialVersion === 1 && renderVersion === 1) openDocument(docs.some((d) => d.id === requestedId) ? requestedId : 'welcome', { remember:false });
      else { renderLibrary(); refreshHighlights(); }
      for (const doc of docs) if (!doc.sample && !saved.some((savedDoc) => savedDoc.id === doc.id)) saveDoc(doc);
    } catch { storageUnavailable(); }
    finally { annotationsReady = true; renderHighlightList(annotations.get(active.id) || []); nativeHost?.postMessage({ type:'ready', language:locale() }); }
  })();
})();

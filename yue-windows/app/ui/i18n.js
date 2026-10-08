(() => {
  'use strict';
  const languages = [ ['zh-CN','简体中文'], ['en','English'], ['es','Español'], ['fr','Français'], ['de','Deutsch'], ['ja','日本語'], ['pt-BR','Português'] ];
  const catalogs = window.YUE_LOCALES;
  function normalize(value) {
    const primary = String(value || '').toLowerCase().split('-')[0];
    return languages.find(([id]) => id.toLowerCase().split('-')[0] === primary)?.[0] || 'en';
  }
  let preference = 'auto';
  try { preference = localStorage.getItem('yue-language') || 'auto'; } catch { /* In-memory preferences work without storage. */ }
  const query = new URLSearchParams(location.search).get('lang');
  if (query && languages.some(([id]) => id === query)) preference = query;
  if (preference !== 'auto' && !languages.some(([id]) => id === preference)) preference = 'auto';
  let locale = preference === 'auto' ? normalize(navigator.language) : preference;
  const bindings = [];
  function t(key, values = {}) {
    return (catalogs[locale]?.[key] ?? catalogs.en[key] ?? key).replace(/\{(\w+)\}/g, (match, name) => values[name] == null ? match : String(values[name]));
  }
  function captureStatic() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.parentElement.closest('script,style,pre,.brand-cn,#article,#document-list,#highlights-list')) continue;
      const key = node.textContent.trim();
      if (catalogs.en[key]) bindings.push({ node, key, before:node.textContent.match(/^\s*/)[0], after:node.textContent.match(/\s*$/)[0] });
    }
    document.querySelectorAll('[title],[aria-label],[placeholder],meta[name="description"]').forEach(node => {
      for (const attr of ['title','aria-label','placeholder','content']) {
        const key = node.getAttribute(attr);
        if (key && catalogs.en[key]) bindings.push({ node, attr, key });
      }
    });
  }
  function apply() {
    document.documentElement.lang = locale;
    for (const binding of bindings) {
      if (!binding.node.isConnected) continue;
      if (binding.attr) binding.node.setAttribute(binding.attr, t(binding.key));
      else binding.node.textContent = binding.before + t(binding.key) + binding.after;
    }
    document.querySelectorAll('[data-language-select]').forEach(select => {
      select.replaceChildren();
      for (const [id, name] of [['auto',t('跟随系统')], ...languages]) {
        const option = document.createElement('option'); option.value=id; option.textContent=name; select.append(option);
      }
      select.value = preference;
      select.onchange = () => setLanguage(select.value);
    });
  }
  function setLanguage(value) {
    preference = value === 'auto' ? 'auto' : normalize(value);
    locale = preference === 'auto' ? normalize(navigator.language) : preference;
    try { localStorage.setItem('yue-language', preference); } catch { /* Session-only selection. */ }
    apply();
    window.dispatchEvent(new Event('yue-language-change'));
  }
  window.YueI18n = { t, setLanguage, languages, get locale() { return locale; }, get preference() { return preference; }, number(value) { return new Intl.NumberFormat(locale).format(value); } };
  captureStatic(); apply();
})();

(() => {
  const {t}=YueI18n;
  function localize(){
    document.querySelectorAll('[data-reader-link]').forEach(link=>link.href='app/?lang='+YueI18n.locale);
    document.getElementById('reader-shot').src='assets/reader-'+YueI18n.locale+'.png';
    document.title='Yue · '+t('简洁、轻量的 Markdown 阅读器');
    document.querySelectorAll('[data-installer-size]').forEach(node=>node.textContent=window.YueRelease ? new Intl.NumberFormat(YueI18n.locale,{maximumFractionDigits:0}).format(YueRelease.installerBytes/1024)+' KB' : 'x64');
    document.getElementById('share-status').textContent='';
  }
  document.querySelectorAll('[data-preview-theme]').forEach(button=>button.onclick=()=>{
    document.querySelector('.theme-demo').dataset.preview=button.dataset.previewTheme;
    document.querySelectorAll('[data-preview-theme]').forEach(choice=>choice.setAttribute('aria-pressed',String(choice===button)));
  });
  document.getElementById('share-link').onclick=async()=>{
    try{await navigator.clipboard.writeText('https://yue-markdown-shiha.txqy0831.chatgpt.site/?lang='+YueI18n.locale);document.getElementById('share-status').textContent=t('已复制');}
    catch{document.getElementById('share-status').textContent=t('请复制浏览器地址栏中的链接。');}
  };
  window.addEventListener('yue-language-change',localize);localize();
})();

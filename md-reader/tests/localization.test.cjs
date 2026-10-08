const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const path=require('node:path');
const fs=require('node:fs');
const languages=['zh-CN','en','es','fr','de','ja','pt-BR'];
let checks=0;
function check(value,name){assert.ok(value,name);checks++;console.log('PASS '+name);}
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const context=await browser.newContext({locale:'en',viewport:{width:1380,height:900}});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(process.env.YUE_TEST_URL||'http://127.0.0.1:4173/');
  await page.locator('#article h1').waitFor();
  check(await page.locator('html').getAttribute('lang')==='en','Initial language follows the system');
  const catalog=await page.evaluate(()=>YUE_LOCALES);
  for(const language of languages){
   check(Object.keys(catalog[language]).length===Object.keys(catalog.en).length,Object.keys(catalog.en).length+' complete strings: '+language);
   for(const [key,value] of Object.entries(catalog[language]))assert.deepEqual([...value.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort(),[...key.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort(),language+' placeholders: '+key);
  }
  const assetDir=path.join(__dirname,'../website/screenshots');fs.mkdirSync(assetDir,{recursive:true});
  for(const language of languages){
   if(await page.locator('#settings-panel').isHidden())await page.locator('#settings-toggle').click();
   await page.selectOption('#language-select',language);
   check(await page.locator('#theme-toggle').textContent().then(t=>t.trim()===catalog[language]['主题']),'Live toolbar language: '+language);
   await page.reload();await page.locator('#article h1').waitFor();
   check(await page.locator('html').getAttribute('lang')===language,'Language persists: '+language);
   await page.screenshot({path:path.join(assetDir,'reader-'+language+'.png')});
   await page.locator('#settings-toggle').click();
   check(await page.locator('#help-dialog').textContent().then(t=>t.includes(catalog[language]['文档仅在本地处理，不上传服务器。高亮会自动保存在本地，可在工具栏的「本篇高亮」中查看和取消。清除应用或浏览器数据会移除文档及高亮记录，重要文件请保留原件。单个文档最大 5 MB。'])),'Help is translated: '+language);
   await page.keyboard.press('Escape');
   await page.setViewportSize({width:320,height:780});
   await page.locator('#theme-toggle').click();
   check(await page.locator('.toolbar-actions').evaluate(el=>el.getBoundingClientRect().right<=innerWidth)&&await page.locator('#theme-panel').evaluate(el=>el.getBoundingClientRect().left>=0&&el.getBoundingClientRect().right<=innerWidth),'320px layout: '+language);
   await page.keyboard.press('Escape');await page.setViewportSize({width:1380,height:900});
  }
  const content='# 我的文档 / User document\n\n主题 打开文件 高亮 复制 — These words must stay exactly as written.\n\nSecond paragraph.';
  await page.locator('#file-input').setInputFiles({name:'原文.md',mimeType:'text/markdown',buffer:Buffer.from(content)});
  await page.waitForFunction(()=>document.getElementById('current-filename').textContent==='原文.md');
  await page.waitForFunction(()=>document.getElementById('highlights-storage').textContent.includes(YueI18n.t('自动保存在本地 · 原文件不变')));
  await page.evaluate(()=>{const range=document.createRange();range.selectNodeContents(document.querySelector('#article p'));getSelection().removeAllRanges();getSelection().addRange(range)});
  await page.locator('#selection-toolbar').waitFor();await page.locator('#highlight-selection').click();
  await page.locator('.user-highlight').first().waitFor();const originalText=await page.locator('#article').innerText();
  for(const language of languages){
   if(await page.locator('#settings-panel').isHidden())await page.locator('#settings-toggle').click();await page.selectOption('#language-select',language);
   check(await page.locator('#article').innerText()===originalText&&await page.locator('.user-highlight').count()===1,'Original text and highlight unchanged: '+language);
  }
  for(const [theme,color] of [['white','rgb(250, 250, 250)'],['paper','rgb(250, 249, 246)'],['green','rgb(248, 249, 247)'],['dark','rgb(36, 36, 36)']]){
   await page.locator('#theme-toggle').click();await page.locator('[data-theme-choice='+theme+']').click();
   check(await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor)===color,'Theme color: '+theme);
  }
  check(errors.length===0,'No runtime errors: '+errors.join('; '));
  console.log('Passed '+checks+' localization checks.');
 }finally{await context.close();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { chromium } = require('playwright');
const sandbox = { module:{ exports:{} } };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../dist/highlights.js'), 'utf8'), sandbox);
const { anchor, locate } = sandbox.module.exports;
let passed = 0;
function check(value, name) { assert.ok(value, name); passed++; console.log('PASS ' + name); }
const original = '开篇。\n有一段值得记住的文字。\n后记。';
const quote = '值得记住的文字';
const saved = anchor(original, original.indexOf(quote), original.indexOf(quote) + quote.length);
check(locate(saved, original)?.start === original.indexOf(quote), 'Original anchor');
check(locate(saved, '新增的一段。\n' + original)?.start === original.indexOf(quote) + '新增的一段。\n'.length, 'Inserted text shifts anchor');
check(locate(saved, original.replace(quote, '内容已修改')) === null, 'Edited passage is retained as an orphan');
const repeated = '第一节：相同的一句话。结尾甲。\n第二节：相同的一句话。结尾乙。';
const second = anchor(repeated, repeated.lastIndexOf('相同'), repeated.lastIndexOf('相同') + 7);
check(locate(second, '序言\n' + repeated)?.start === repeated.lastIndexOf('相同') + 3, 'Repeated quotations resolve by context');
check(locate({ quote:'一样', prefix:'', suffix:'' }, '一样。一样。') === null, 'Ambiguous quotations never guess');
check(anchor('  你好 😀  ', 0, 9).quote === '你好 😀', 'Whitespace and Unicode selection');

const content = '# 高亮测试\n\n这是一段**加粗文字**和[链接](https://example.com)，用来记录重点。\n\n第二段值得慢慢阅读，和上一段一起保存。\n\n第三段保持普通文字。\n\n```js\nconst value = 42;\n```';
const fixture = { id:'qa-highlight-doc', name:'高亮测试.md', path:'高亮测试.md', content, position:0 };
const url = process.env.YUE_TEST_URL || 'http://127.0.0.1:4173/';
(async () => {
  const browser = await chromium.launch({ channel:'msedge', headless:true });
  const context = await browser.newContext({ locale:'zh-CN', viewport:{ width:1380, height:900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.goto(new URL('qa-seed', url).href);
    await page.evaluate(async (doc) => {
      await new Promise((resolve, reject) => {
        const req = indexedDB.open('yue-reader', 1);
        req.onupgradeneeded = () => { req.result.createObjectStore('docs', { keyPath:'id' }); req.result.createObjectStore('assets', { keyPath:'path' }); };
        req.onerror = () => reject(req.error);
        req.onsuccess = () => { const db = req.result; const tx = db.transaction('docs', 'readwrite'); tx.objectStore('docs').put(doc); tx.oncomplete = () => { db.close(); resolve(); }; };
      });
      localStorage.setItem('yue-preferences', JSON.stringify({ active:doc.id }));
    }, fixture);
    await page.goto(url);
    await page.locator('#current-filename').filter({ hasText:fixture.name }).waitFor();
    await page.waitForFunction(() => document.getElementById('highlights-storage').textContent.includes('自动保存'));
    check(await page.locator('#article strong').textContent() === '加粗文字', 'v1 database migrates without losing documents');
    const count = () => page.evaluate(() => new Promise((resolve, reject) => {
      const req = indexedDB.open('yue-reader', 2); req.onerror = () => reject(req.error);
      req.onsuccess = () => { const db = req.result; const tx = db.transaction('highlights'); const read = tx.objectStore('highlights').get('qa-highlight-doc'); tx.oncomplete = () => { resolve(read.result?.items.length || 0); db.close(); }; };
    }));
    const selectParagraphs = async (from, to = from) => {
      await page.evaluate(([from, to]) => {
        const paragraphs = document.querySelectorAll('#article > p');
        const range = document.createRange(); range.setStartBefore(paragraphs[from].firstChild); range.setEndAfter(paragraphs[to].lastChild);
        const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
        document.dispatchEvent(new Event('selectionchange'));
      }, [from, to]);
      await page.locator('#selection-toolbar').waitFor({ state:'visible' });
    };
    await selectParagraphs(0);
    await page.locator('#highlight-selection').click();
    await page.waitForFunction(() => document.getElementById('highlight-count').textContent === '1');
    check(await count() === 1, 'Selection is committed to IndexedDB');
    check(await page.locator('#article strong .user-highlight').count() === 1 && await page.locator('#article a .user-highlight').count() === 1, 'Inline formatting and links survive highlighting');
    await page.reload();
    await page.locator('#article .user-highlight').first().waitFor();
    check(await count() === 1, 'Reload restores the saved highlight');
    await selectParagraphs(1);
    await page.keyboard.press('Control+Shift+H');
    await page.waitForFunction(() => document.getElementById('highlight-count').textContent === '2');
    check(await count() === 2, 'Keyboard shortcut saves a second passage');
    await selectParagraphs(0, 1);
    await page.locator('#highlight-selection').click();
    await page.waitForFunction(() => document.getElementById('highlight-count').textContent === '1');
    check(await count() === 1, 'Overlapping and multi-paragraph highlights combine');
    await page.locator('#search-toggle').click(); await page.locator('#find-input').fill('加粗文字');
    await page.locator('#article .find-match').first().waitFor();
    await page.locator('#find-close').click();
    check(await page.locator('#article .find-match').count() === 0 && await page.locator('#article .user-highlight').count() > 0, 'Closing search preserves saved highlights');
    for (const [theme, background] of [['green','rgb(248, 249, 247)'],['paper','rgb(250, 249, 246)'],['dark','rgb(36, 36, 36)']]) {
      await page.locator('#theme-toggle').click();
      await page.locator(`[data-theme-choice="${theme}"]`).click();
      check(await page.locator('body').evaluate((el) => getComputedStyle(el).backgroundColor) === background && await page.locator('#theme-panel').isHidden(), theme + ' theme applies from the unified menu');
      await page.reload();
      await page.locator('#article .user-highlight').first().waitFor();
      check(await page.locator('html').getAttribute('data-theme') === theme && await count() === 1, theme + ' theme survives reopening without changing highlights');
    }
    await page.locator('#theme-toggle').click();
    await page.keyboard.press('Escape');
    check(await page.locator('#theme-panel').isHidden() && await page.locator('#theme-toggle').evaluate((el) => document.activeElement === el), 'Escape closes the theme menu and returns keyboard focus');
    await page.locator('#theme-toggle').click();
    await page.locator('#settings-toggle').click();
    check(await page.locator('#theme-panel').isHidden(), 'Reading settings and the theme menu do not overlap');
    await page.locator('#reset-settings').click();
    check(await page.locator('html').getAttribute('data-theme') === 'dark', 'Resetting typography preserves the chosen theme');
    await page.keyboard.press('Escape');
    check(await page.locator('#article .user-highlight').first().evaluate((mark) => getComputedStyle(mark).backgroundColor) === 'rgba(223, 205, 152, 0.18)', 'Dark theme uses translucent highlights');
    await page.locator('#highlights-toggle').click();
    await page.locator('.highlight-quote').first().click();
    check(await page.locator('.highlight-jump').count() > 0, 'Highlight list jumps to the passage');
    await page.locator('#file-input').setInputFiles({ name:fixture.name, mimeType:'text/markdown', buffer:Buffer.from('# 新增说明\n\n新增一个段落。\n\n' + content) });
    await page.waitForFunction(() => document.getElementById('article').textContent.includes('新增一个段落'));
    check(await page.locator('#article .user-highlight').count() > 0 && await count() === 1, 'Reimported file keeps and relocates highlights');
    await page.setViewportSize({ width:375, height:780 });
    await page.locator('#highlights-toggle').click();
    await page.locator('#highlights-toggle').click();
    check(await page.locator('#highlights-panel').evaluate((el) => { const r=el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.height > 200; }), 'Highlight panel fits a narrow screen');
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal page overflow on a phone');
    for (const width of [320, 375]) {
      await page.setViewportSize({ width, height:780 });
      await page.locator('#theme-toggle').click();
      check(await page.locator('#theme-panel').evaluate((el) => { const r=el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; }) && await page.locator('#theme-toggle').evaluate((el) => { const r=el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; }), 'Theme menu and its label fit ' + width + 'px screens');
      await page.keyboard.press('Escape');
    }
    await page.setViewportSize({ width:1380, height:900 });
    await page.waitForTimeout(300);
    check(await page.evaluate(() => window.scrollX === 0 && document.querySelector('.sidebar').getBoundingClientRect().left >= 0), 'Sidebar remains inside the page after resizing');
    await page.screenshot({ path:path.join(__dirname, '../../highlight-qa.png') });
    await page.locator('#file-input').setInputFiles({ name:fixture.name, mimeType:'text/markdown', buffer:Buffer.from('# 已修改\n\n第三段保持普通文字。') });
    await page.waitForFunction(() => document.querySelector('.highlight-card-footer')?.textContent.includes('原文有变动'));
    check(await count() === 1 && await page.locator('#article .user-highlight').count() === 0, 'Missing passage remains in the list without mis-highlighting');
    await page.locator('.highlight-card-footer button').click();
    await page.waitForFunction(() => document.getElementById('highlight-count').textContent === '0');
    check(await count() === 0, 'Cancel highlight is persisted');
    await page.locator('#toast button').click();
    await page.waitForFunction(() => document.getElementById('highlight-count').textContent === '1');
    check(await count() === 1, 'Undo restores the saved record');
    await page.reload();
    await page.waitForFunction(() => document.getElementById('highlight-count').textContent === '1');
    check(await page.locator('.highlight-card-footer').textContent().then((t) => t.includes('原文有变动')), 'Orphan excerpt survives restarting the page');
    check(errors.length === 0, 'No browser runtime errors: ' + errors.join('; '));
    const failureContext = await browser.newContext({ locale:'zh-CN' });
    await failureContext.addInitScript(() => {
      const original = IDBDatabase.prototype.transaction;
      IDBDatabase.prototype.transaction = function (stores, mode, ...args) {
        if (stores === 'highlights' && mode === 'readwrite') throw new DOMException('Test storage full', 'QuotaExceededError');
        return original.call(this, stores, mode, ...args);
      };
    });
    const failurePage = await failureContext.newPage();
    await failurePage.goto(url);
    await failurePage.waitForFunction(() => document.getElementById('highlights-storage').textContent.includes('自动保存'));
    await failurePage.evaluate(() => {
      const range = document.createRange(); range.selectNodeContents(document.querySelector('#article p'));
      window.getSelection().removeAllRanges(); window.getSelection().addRange(range);
    });
    await failurePage.locator('#selection-toolbar').waitFor({ state:'visible' });
    await failurePage.locator('#highlight-selection').click();
    await failurePage.locator('#toast').filter({ hasText:'高亮未能保存' }).waitFor();
    check(await failurePage.locator('.user-highlight').count() === 0 && await failurePage.locator('#highlight-count').textContent() === '0', 'Storage failure never reports a false successful save');
    await failureContext.close();
    const nativeContext = await browser.newContext({ locale:'zh-CN' });
    await nativeContext.addInitScript((doc) => {
      let receive;
      window.chrome = window.chrome || {};
      window.chrome.webview = {
        addEventListener(type, callback) { receive = callback; },
        postMessage(message) {
          if (message.type === 'ready') {
            receive({ data:{ type:'open-documents', documents:[doc] } });
            receive({ data:{ type:'prepare-view' } });
          }
          if (message.type === 'view-ready') window.startupResult = { title:document.getElementById('current-filename').textContent, theme:message.theme };
        },
      };
    }, fixture);
    const nativePage = await nativeContext.newPage(); await nativePage.goto(url);
    await nativePage.waitForFunction(() => window.startupResult);
    check(await nativePage.evaluate(() => window.startupResult.title === '高亮测试.md'), 'Native reveal waits for the command-line document to finish importing');
    check(await nativePage.locator('body').evaluate((node) => getComputedStyle(node).backgroundColor) === 'rgb(250, 249, 246)', 'Default reading surface is warm paper');
    await nativePage.evaluate(() => { const range=document.createRange(); range.selectNodeContents(document.querySelector('#article p')); window.getSelection().removeAllRanges(); window.getSelection().addRange(range); });
    await nativePage.locator('#selection-toolbar').waitFor({ state:'visible' }); await nativePage.locator('#highlight-selection').click();
    await nativePage.locator('.user-highlight').first().waitFor();
    check(await nativePage.locator('.user-highlight').first().evaluate((node) => getComputedStyle(node).backgroundColor) === 'rgba(219, 194, 114, 0.2)', 'Paper theme uses a pale 20% yellow highlight');
    await nativePage.locator('#highlights-toggle').click();
    await nativePage.screenshot({ path:path.join(__dirname, '../../paper-theme-qa.png') });
    await nativeContext.close();
    for (const [oldTheme, currentTheme] of [['light','green'],['sepia','paper']]) {
      const migrationContext = await browser.newContext({ locale:'zh-CN' });
      await migrationContext.addInitScript((theme) => localStorage.setItem('yue-preferences', JSON.stringify({ theme })), oldTheme);
      const migrationPage = await migrationContext.newPage();
      await migrationPage.goto(url);
      await migrationPage.locator('#article h1').waitFor();
      check(await migrationPage.locator('html').getAttribute('data-theme') === currentTheme, 'Existing ' + oldTheme + ' preference migrates to ' + currentTheme);
      await migrationContext.close();
    }
    console.log('Passed ' + passed + ' highlight checks.');
  } finally { await context.close(); await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode=1; });

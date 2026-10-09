const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const url = process.env.YUE_TEST_URL || 'http://127.0.0.1:4173/';
let passed = 0;
function check(condition, name) { assert.ok(condition,name); passed++; console.log('PASS ' + name); }
const fixture = { id:'win-startup-fixture', name:'instant.md', path:'instant.md', position:450, content:'# Fresh disk content\n\nKeep this highlighted passage.\n\n' + 'A paragraph for reading position.\n\n'.repeat(90) };
async function seed(page, doc, image = false) {
  await page.goto(new URL('qa-seed',url).href);
  await page.evaluate(async ({doc,image}) => {
    const db = await new Promise((resolve,reject) => { const r=indexedDB.open('yue-reader',2); r.onupgradeneeded=()=>{ for(const [name,keyPath] of [['docs','id'],['assets','path'],['highlights','docId']])r.result.createObjectStore(name,{keyPath}); };r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error); });
    await new Promise((resolve,reject) => {
      const tx=db.transaction(['docs','assets','highlights'],'readwrite');
      tx.objectStore('docs').put(doc);
      tx.objectStore('highlights').put({docId:doc.id,items:[{id:'saved-mark',quote:'Keep this highlighted passage.',prefix:'',suffix:'',created:1}]});
      if(image) {
        const blob=new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="gray"/></svg>'],{type:'image/svg+xml'});
        tx.objectStore('assets').put({path:doc.native?'native:'+doc.id+':note.svg':'note.svg',blob});
        for(let i=0;i<25;i++)tx.objectStore('assets').put({path:'unrelated-'+i,blob});
      }
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
    });db.close();
    localStorage.setItem('yue-preferences',JSON.stringify({active:doc.id,theme:'white',font:'serif'}));
  },{doc,image});
}
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try {
    const context=await browser.newContext({locale:'en',viewport:{width:1280,height:860}});
    const page=await context.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await seed(page,{...fixture,content:fixture.content.replace('Fresh disk content','Stale cached content')});
    await page.addInitScript((incoming)=>{
      const open=indexedDB.open.bind(indexedDB);
      indexedDB.open=function(...args){
        const request=open(...args);
        return new Proxy(request,{get(target,key){const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;},set(target,key,value){
          if(key==='onsuccess')target[key]=event=>setTimeout(()=>{window.storageOpenedAt=performance.now();value(event);},1000);else target[key]=value;return true;
        }});
      };
      let receive;window.chrome=window.chrome||{};
      window.chrome.webview={addEventListener(type,fn){receive=fn;},postMessage(message){
        if(message.type==='ready'){receive({data:{type:'open-documents',documents:[incoming]}});receive({data:{type:'prepare-view'}});}
        if(message.type==='view-ready')window.initialView={time:performance.now(),storagePending:!window.storageOpenedAt,title:document.querySelector('#current-filename').textContent,text:document.querySelector('#article').textContent,theme:message.theme};
      }};
    },{...fixture,position:0});
    await page.goto(url);
    await page.waitForFunction(()=>window.initialView);
    const first=await page.evaluate(()=>window.initialView);
    check(first.storagePending,'Requested native document displays before slow storage opens');
    check(first.title===fixture.name && first.text.includes('Fresh disk content'),'First view contains the requested file, not welcome or stale content');
    check(first.theme==='white','Saved theme is applied before native reveal');
    await page.locator('.user-highlight').first().waitFor();
    check(await page.locator('#article h1').textContent().then(t=>t.includes('Fresh disk content')),'Background restore never replaces fresh disk content');
    check(await page.locator('#reading-scroll').evaluate(e=>e.scrollTop)>=440,'Saved reading position survives opening before storage is ready');
    check(await page.locator('#highlight-count').textContent()==='1','Existing highlight restores after the early document opens');
    const saved=await page.evaluate(async()=>{const db=await new Promise(r=>{const q=indexedDB.open('yue-reader',2);q.onsuccess=()=>r(q.result)});return await new Promise(r=>{const tx=db.transaction('docs');const q=tx.objectStore('docs').get('win-startup-fixture');tx.oncomplete=()=>{db.close();r(q.result)}})});
    check(saved.content.startsWith('# Fresh disk content') && saved.position>=440,'Queued write preserves both new content and saved position');
    check(!errors.length,'No runtime errors during asynchronous hydration');
    await context.close();

    const imageContext=await browser.newContext({locale:'en'});const imagePage=await imageContext.newPage();
    await seed(imagePage,{...fixture,content:fixture.content+'\n\n![Local image](note.svg)'},true);
    await imagePage.addInitScript(()=>{window.assetReads=[];for(const method of ['get','getAll']){const original=IDBObjectStore.prototype[method];IDBObjectStore.prototype[method]=function(...args){if(this.name==='assets')window.assetReads.push([method,args[0]]);return original.apply(this,args)};}});
    await imagePage.goto(url);
    await imagePage.locator('#article img').scrollIntoViewIfNeeded();
    await imagePage.waitForFunction(()=>document.querySelector('#article img')?.naturalWidth===40);
    const reads=await imagePage.evaluate(()=>window.assetReads);
    check(!reads.some(([method])=>method==='getAll'),'Startup never loads the entire cached-image store');
    check(reads.some(([method,key])=>method==='get' && key==='note.svg') && !reads.some(([,key])=>key?.startsWith('unrelated-')),'Only images referenced by the active document are restored');
    check(await imagePage.locator('.user-highlight').count()===1,'Lazy image restore preserves document highlights');
    await imageContext.close();
    const cachedContext=await browser.newContext({locale:'en'});const cachedPage=await cachedContext.newPage();
    await seed(cachedPage,{...fixture,native:true,position:0,content:'# Remembered file\n\n![Native cache](note.svg)\n\nKeep this highlighted passage.'},true);
    await cachedPage.addInitScript(()=>{
      let receive;window.chrome=window.chrome||{};
      window.chrome.webview={addEventListener(type,fn){receive=fn;},postMessage(message){
        if(message.type==='ready')receive({data:{type:'prepare-view'}});
        if(message.type==='image'){window.nativeImageRequested=true;queueMicrotask(()=>receive({data:{type:'image',requestId:message.requestId,error:'Reopen original file'}}));}
      }};
    });
    await cachedPage.goto(url);
    await cachedPage.waitForFunction(()=>document.querySelector('#article img')?.naturalWidth===40);
    check(await cachedPage.evaluate(()=>window.nativeImageRequested),'Remembered native document retains cached images without reopening its file');
    check(await cachedPage.locator('#highlight-count').textContent()==='1','Cached native-image fallback keeps saved highlights');
    await cachedContext.close();
    console.log('Passed '+passed+' startup checks.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

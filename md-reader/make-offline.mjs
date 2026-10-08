import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('./dist/', import.meta.url));
const destination = process.argv[2];
if (!destination || !path.isAbsolute(destination)) throw new Error('Pass an absolute output .html path.');
let html = await readFile(path.join(root,'index.html'),'utf8');
const css = await readFile(path.join(root,'styles.css'),'utf8');
html = html.replace('<link rel="stylesheet" href="styles.css">', () => `<style>${css}</style>`);
const embeddedScripts = [];
for (const file of ['vendor/marked.umd.js','vendor/purify.min.js','vendor/highlight.min.js','locales.js','i18n.js','samples.js','highlights.js','app.js']) {
  const source = (await readFile(path.join(root,file),'utf8')).replace(/<\/script/gi,'<\\/script').replace(/\/\/# sourceMappingURL=.*$/gm,'');
  html = html.replace(`<script src="${file}" defer></script>`,'');
  embeddedScripts.push(`<script>${source}</script>`);
}
html = html.replace('</body>',() => `${embeddedScripts.join('\n')}\n</body>`);
const licenses = await Promise.all(['yue-LICENSE.txt','marked-LICENSE.txt','dompurify-LICENSE.txt','highlight-LICENSE.txt'].map(async (name) => `${name}\n\n${await readFile(path.join(root,'vendor',name),'utf8')}`));
const licenseText = licenses.join('\n\n------------------------\n\n').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
html = html.replace(/<p class="help-footnote">[\s\S]*?<\/p>/, () => `<details class="help-footnote"><summary>开源组件与许可证</summary><pre style="white-space:pre-wrap;font-size:9px;max-height:220px;overflow:auto">${licenseText}</pre></details>`);
await writeFile(destination,html);
console.log(JSON.stringify({ output:destination, bytes:Buffer.byteLength(html) }));

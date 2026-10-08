import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const site=path.join(root,'out');fs.mkdirSync(path.join(site,'assets'),{recursive:true});
fs.cpSync(path.join(root,'dist'),path.join(site,'app'),{recursive:true});
fs.copyFileSync(path.join(root,'website/index.html'),path.join(site,'index.html'));
for(const file of ['site.css','site.js','logo.svg'])fs.copyFileSync(path.join(root,'website',file),path.join(site,'assets',file));
for(const file of ['locales.js','i18n.js'])fs.copyFileSync(path.join(root,'dist',file),path.join(site,'assets',file));
if(fs.existsSync(path.join(root,'website/screenshots')))fs.cpSync(path.join(root,'website/screenshots'),path.join(site,'assets'),{recursive:true});
if(fs.existsSync(path.join(root,'release-assets')))fs.cpSync(path.join(root,'release-assets'),path.join(site,'downloads'),{recursive:true});
const installer=path.join(site,'downloads/Yue-Setup-1.2.1-x64.exe');
if(fs.existsSync(installer)){
  let js=fs.readFileSync(path.join(site,'assets/site.js'),'utf8');
  fs.writeFileSync(path.join(site,'assets/site.js'),'window.YueRelease = '+JSON.stringify({version:'1.2.1',installerBytes:fs.statSync(installer).size})+';\n'+js);
}
fs.writeFileSync(path.join(site,'robots.txt'),'User-agent: *\nAllow: /\nDisallow: /app/\nSitemap: https://yue-markdown-shiha.txqy0831.chatgpt.site/sitemap.xml\n');
fs.writeFileSync(path.join(site,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://yue-markdown-shiha.txqy0831.chatgpt.site/</loc></url></urlset>');
fs.writeFileSync(path.join(site,'_headers'),'/downloads/*.exe\n  Content-Type: application/vnd.microsoft.portable-executable\n  Content-Disposition: attachment\n/downloads/*.zip\n  Content-Disposition: attachment\n/downloads/*.html\n  Content-Disposition: attachment\n/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n');
console.log('Built out/ with website, reader and available release downloads.');

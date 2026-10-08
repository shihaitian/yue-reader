import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const siteMode=process.argv.includes('--site');
const port=siteMode?4174:4173;
const root = fileURLToPath(new URL(siteMode?'./out/':'./dist/', import.meta.url));
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.svg':'image/svg+xml', '.txt':'text/plain; charset=utf-8', '.png':'image/png', '.xml':'application/xml', '.zip':'application/zip' };
http.createServer(async (req,res) => {
  try {
    const url = new URL(req.url,'http://127.0.0.1');
    let relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    if(relative.endsWith('/')) relative+='index.html';
    const file = path.resolve(root,relative);
    if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
    const bytes = await readFile(file);
    res.writeHead(200,{ 'Content-Type':types[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff' });
    res.end(bytes);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(port,'127.0.0.1',() => console.log('Local: http://127.0.0.1:'+port));

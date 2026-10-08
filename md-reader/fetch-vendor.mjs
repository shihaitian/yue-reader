import { writeFile, mkdir } from 'node:fs/promises';
const out = new URL('./dist/vendor/', import.meta.url);
await mkdir(out, { recursive: true });
const files = {
  'marked.umd.js': 'https://cdn.jsdelivr.net/npm/marked@18.1.0/lib/marked.umd.js',
  'purify.min.js': 'https://cdn.jsdelivr.net/npm/dompurify@3.4.16/dist/purify.min.js',
  'highlight.min.js': 'https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.12.0/highlight.min.js',
  'marked-LICENSE.txt': 'https://cdn.jsdelivr.net/npm/marked@18.1.0/LICENSE',
  'dompurify-LICENSE.txt': 'https://cdn.jsdelivr.net/npm/dompurify@3.4.16/LICENSE',
  'highlight-LICENSE.txt': 'https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.12.0/LICENSE',
};
const results = await Promise.allSettled(Object.entries(files).map(async ([name, url]) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  await writeFile(new URL(name, out), bytes);
  console.log(`${name}: ${bytes.length} bytes`);
}));
for (const result of results) if (result.status === 'rejected') { console.error(result.reason.message); process.exitCode = 1; }

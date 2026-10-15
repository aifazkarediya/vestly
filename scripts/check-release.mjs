import { readFile, readdir, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
const allowed = new Set(['index.html','app.js','gemini.js','csv.js','privacy.html','404.html','favicon.svg','_headers','.nojekyll','assets','licenses']);
for (const file of await readdir(root)) if (!allowed.has(file)) throw new Error(`Unexpected file in release: ${file}`);
async function check(dir) {
  for (const entry of await readdir(dir,{withFileTypes:true})) {
    const file=path.join(dir,entry.name);
    if(entry.isDirectory()) { await check(file); continue; }
    if (!/\.(html|css|js)$/.test(entry.name)) continue;
    const text=await readFile(file,'utf8');
    if (/AIza[0-9A-Za-z_-]{30,}/.test(text)) throw new Error('Possible embedded API key in release');
    if (!/\.(html|css)$/.test(entry.name)) continue;
    const references = entry.name.endsWith('.html') ? [...text.matchAll(/(?:src|href)="([^"]+)"/g)].map(m=>m[1]) : [...text.matchAll(/url\(["']?([^\s)"']+)/g)].map(m=>m[1]);
    for (const ref of references) {
      if (/^(https:|data:|#)/.test(ref)) continue;
      if (ref.startsWith('/')) throw new Error('Asset URL will break on a GitHub project site: '+ref);
      const target=path.resolve(dir,ref.split(/[?#]/)[0]);
      if (target !== root && !target.startsWith(root + path.sep)) throw new Error('Asset outside release');
      await access(target);
    }
  }
}
await check(root);
console.log('Release checks passed: files, relative links, fonts, and no embedded API keys.');

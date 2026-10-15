import { mkdir, readFile, writeFile, copyFile, readdir, rm, lstat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { compile } from '@tailwindcss/node';
import { Scanner } from '@tailwindcss/oxide';
const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.resolve(root, 'dist');
if (path.dirname(output) !== path.resolve(root)) throw new Error('Invalid build directory');
try { if ((await lstat(output)).isSymbolicLink()) throw new Error('dist must not be a symbolic link'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await mkdir(path.join(root, 'assets', 'fonts'), { recursive: true });
const compiler = await compile(await readFile(path.join(root, 'styles.css'), 'utf8'), { base: root, onDependency() {} });
const scanner = new Scanner({ sources: ['index.html', 'app.js'].map(pattern => ({ base: root, pattern, negated: false })) });
await writeFile(path.join(root, 'assets', 'app.css'), compiler.build(scanner.scan()));
const dependencies = [
  ['@fontsource-variable/inter', 'inter'],
  ['@fontsource-variable/plus-jakarta-sans', 'plus-jakarta-sans'],
  ['@fontsource-variable/jetbrains-mono', 'jetbrains-mono']
];
const generatedAssets = ['app.css', 'privacy.css'];
await mkdir(path.join(output, 'licenses'), { recursive: true });
for (const [pkg, name] of dependencies) {
  const base = path.join(root, 'node_modules', pkg);
  await copyFile(path.join(base, 'files', `${name}-latin-wght-normal.woff2`), path.join(root, 'assets', 'fonts', `${name}.woff2`));
  generatedAssets.push(`fonts/${name}.woff2`);
  await copyFile(path.join(base, 'LICENSE'), path.join(output, 'licenses', `${name}.txt`));
}
for (const weight of ['regular', 'bold', 'fill']) {
  const dest = path.join(root, 'assets', 'icons', weight);
  await mkdir(dest, { recursive: true });
  const source = path.join(root, 'node_modules', '@phosphor-icons', 'web', 'src', weight);
  for (const file of await readdir(source)) {
    if (file === 'style.css' || /\.(woff2?|ttf|svg)$/.test(file)) {
      await copyFile(path.join(source, file), path.join(dest, file));
      generatedAssets.push(`icons/${weight}/${file}`);
    }
  }
}
await copyFile(path.join(root, 'node_modules', '@phosphor-icons', 'web', 'LICENSE'), path.join(output, 'licenses', 'phosphor.txt'));
const allowed = ['index.html', 'app.js', 'gemini.js', 'csv.js', 'privacy.html', 'favicon.svg', '_headers'];
for (const file of allowed) await copyFile(path.join(root, file), path.join(output, file));
await mkdir(path.join(output, 'assets'), { recursive: true });
await copyFile(path.join(root, 'privacy.css'), path.join(root, 'assets', 'privacy.css'));
for (const file of generatedAssets) {
  const destination = path.join(output, 'assets', file);
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(path.join(root, 'assets', file), destination);
}
await writeFile(path.join(output, '.nojekyll'), '');
await writeFile(path.join(output, '404.html'), '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Page not found</title><body><h1>Page not found</h1><p>Check the address or return to the website home page.</p></body></html>');
const html = await readFile(path.join(output, 'index.html'), 'utf8');
if (/\son(?:click|input|focus|keydown|submit)=|<script(?![^>]*src=)/i.test(html)) throw new Error('Inline JavaScript is not allowed in the release');
console.log('Built dist/ with local assets and application files only.');

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const { createCSV } = require('../csv.js');

test('CSV quotes text correctly and prevents spreadsheet formula injection', () => {
  const row = {month:'=HYPERLINK("example","name")', startingBal:10000, addingBal:500, returnPct:-1, grossProfit:-105,withdrawals:0,netProfit:-105,endingBal:10395};
  const csv = createCSV([row]);
  assert(csv.startsWith('\uFEFFRow #'));
  assert(csv.includes('"\'=HYPERLINK(""example"",""name"")"'));
  assert(csv.includes(',-1.00%,-105.00,'));
  assert(createCSV([{...row,month:'Jan #1, 2027'}]).includes('"Jan #1, 2027"'));
});

test('release source has no inline or third-party executable JavaScript', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'),'utf8');
  assert(!/\son(?:click|input|focus|keydown|submit)\s*=/i.test(html));
  assert(!/<script(?![^>]*src=)/i.test(html));
  assert(!/(?:src|href)="https?:\/\/(?:cdn|unpkg|fonts\.)/.test(html));
  assert(html.includes("script-src 'self'"));
  for (const file of ['app.js','gemini.js','csv.js']) {
    const source = fs.readFileSync(path.join(root,file),'utf8');
    new Function(source);
    assert(!/\beval\s*\(/.test(source));
  }
});

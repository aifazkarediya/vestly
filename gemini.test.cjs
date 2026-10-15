const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createGeminiClient, validateResult } = require('./gemini.js');
const row = { month: 'Jan 2027', startingBal: 10000, overrideStarting: false, addingBal: 500, returnPct: 5, withdrawals: 0 };
const result = { summary: 'Added a monthly deposit', rows: [row] };
const models = { models: [{ name: 'models/gemini-3.8-flash', displayName: 'Gemini Flash', supportedGenerationMethods: ['generateContent'] }] };
const response = value => ({ ok: true, json: async () => value });

test('connect checks the key without sending sheet data; update validates the full response', async () => {
    const calls = [];
    const client = createGeminiClient(async (url, options) => {
        calls.push({ url, options });
        return response(calls.length === 1 ? models : { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(result) }] } }] });
    });
    await client.connect('test-placeholder');
    assert.equal(calls[0].options.method, 'GET');
    assert.equal(calls[0].options.body, undefined);
    assert(!calls[0].url.includes('test-placeholder'));
    assert.equal(calls[0].options.headers['x-goog-api-key'], 'test-placeholder');
    assert.deepEqual(await client.update('add a deposit', [row], {}), result);
    const body = JSON.parse(calls[1].options.body);
    assert.equal(JSON.parse(body.contents[0].parts[0].text).instruction, 'add a deposit');
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    client.disconnect();
    assert.equal(client.isConnected(), false);
    await assert.rejects(client.update('change', [row], {}), /Connect your Gemini key/);
});

test('missing keys never make a request', async () => {
    const client = createGeminiClient(() => { throw new Error('Unexpected network call'); });
    await assert.rejects(client.connect(' '), /Paste the complete/);
});

test('invalid, truncated and overflowing results cannot replace the sheet', () => {
    for (const value of [null, { summary: 'empty', rows: [] }, { ...result, rows: [{ ...row, addingBal: '500' }] },
        { ...result, rows: [{ ...row, returnPct: Infinity }] }, { ...result, rows: [{ ...row, overrideStarting: 'false' }] },
        { ...result, rows: Array.from({ length: 601 }, () => row) }]) {
        assert.throws(() => validateResult(value));
    }
    assert.throws(() => validateResult({ ...result, rows: Array.from({ length: 30 }, () => ({ ...row, returnPct: 10000 })) }), /balance is too large/);
});

test('auth and quota errors use safe messages without raw provider error details', async () => {
    for (const status of [400, 401, 403, 429, 503]) {
        const client = createGeminiClient(async () => ({ ok: false, status, json: () => { throw new Error('Raw error must not be read'); } }));
        await assert.rejects(client.connect('test-placeholder'), error => !error.message.includes('test-placeholder'));
        assert.equal(client.isConnected(), false);
    }
});

test('incomplete output and malformed JSON are rejected', async () => {
    for (const candidate of [{ finishReason: 'MAX_TOKENS' }, { finishReason: 'STOP', content: { parts: [{ text: 'broken JSON' }] } }]) {
        let call = 0;
        const client = createGeminiClient(async () => response(++call === 1 ? models : { candidates: [candidate] }));
        await client.connect('test-placeholder');
        await assert.rejects(client.update('change', [row], {}));
    }
});

test('disconnect during an in-flight response prevents applying it', async () => {
    let call = 0, finish;
    const client = createGeminiClient(async () => ++call === 1 ? response(models) : await new Promise(resolve => { finish = resolve; }));
    await client.connect('test-placeholder');
    const pending = client.update('change', [row], {});
    client.disconnect();
    finish(response({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(result) }] } }] }));
    await assert.rejects(pending, /Connection changed/);
});

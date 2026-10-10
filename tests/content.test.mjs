import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { QUOTES } from '../src/quotes.js';
import { T } from '../src/i18n.js';

test('quotes: at least 183, each with text and an author, no repeats', () => {
  assert.ok(QUOTES.length >= 183);
  const seen = new Set();
  for (const [q, a] of QUOTES) {
    assert.ok(q && a, 'missing text or author: ' + q);
    assert.ok(q.length < 300, 'too long: ' + q);
    assert.ok(!a.includes('\u2014'), 'dash in author: ' + a);
    assert.ok(!seen.has(q.toLowerCase()), 'repeat: ' + q); seen.add(q.toLowerCase());
  }
});

test('every piece of interface text used in the code exists', () => {
  const src = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  for (const m of src.matchAll(/tr\('(\w+)'\)/g)) assert.ok(m[1] in T.en, 'missing text: ' + m[1]);
});

test('no secrets are stored in the backend file', () => {
  const gs = fs.readFileSync(new URL('../backend/Code.gs', import.meta.url), 'utf8');
  assert.equal(/[a-f0-9]{64}/.test(gs), false, 'a password hash is in Code.gs');
  assert.equal(/SHEET_ID\s*=\s*'/.test(gs), false, 'the Sheet ID is in Code.gs');
});

test('the page has no inline scripts or handlers (needed by the security policy)', () => {
  for (const f of ['../index.html', '../src/main.js']) {
    const s = fs.readFileSync(new URL(f, import.meta.url), 'utf8');
    assert.equal(/\son(click|error|load|change|input)=/.test(s), false, f);
  }
});

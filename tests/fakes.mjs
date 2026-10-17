// A small pretend Google Sheets + Apps Script, so the real backend/Code.gs can be tested on any computer.
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';

export function createBackend({ roles = ['student', 'librarian', 'principal', 'admin'], omit = [], ownerEmail = null } = {}) {
  const sheets = {}, cache = {}, props = { SHEET_ID: 'test-sheet', SALT: 'test-salt' };
  omit.forEach(k => delete props[k]);
  const stats = { reads: 0, slept: 0, logs: [], mails: [] }, clock = { t: Date.now() }, triggers = [], drive = { folder: null, files: [] };
  class FakeDate extends Date { constructor(...a) { if (a.length) super(...a); else super(clock.t); } static now() { return clock.t; } }
  const mk = (name, header) => {
    const rows = header ? [header] : [];
    sheets[name] = {
      rows, getLastRow: () => rows.length, getLastColumn: () => (rows.length ? Math.max(...rows.map(r => r.length)) : 0),
      appendRow: r => rows.push([...r]), deleteRow: i => rows.splice(i - 1, 1), deleteRows: (i, n) => rows.splice(i - 1, n),
      getRange: (r, c, nr = 1, nc = 1) => {
        if (typeof r === 'string') return { setNumberFormat() {} };
        return {
          getValues: () => { stats.reads++; return Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => (rows[r - 1 + i] || [])[c - 1 + j] ?? '')); },
          getValue: () => (rows[r - 1] || [])[c - 1] ?? '',
          setValue: v => { (rows[r - 1] = rows[r - 1] || [])[c - 1] = v; },
          setValues: vs => vs.forEach((vr, i) => vr.forEach((v, j) => { (rows[r - 1 + i] = rows[r - 1 + i] || [])[c - 1 + j] = v; })),
          setNumberFormat() {}, clearContent: () => { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) if (rows[r - 1 + i]) rows[r - 1 + i][c - 1 + j] = ''; }
        };
      }
    };
    return sheets[name];
  };
  mk('Inventory', ['BookID', 'Title', 'Author', 'Genre', 'SubGenre', 'Available', 'AgeGroup', 'Condition', 'Language', 'ContainedWorks', 'ISBN']);
  mk('Checkouts', ['CheckoutID', 'RollNumber', 'BookID', 'Title', 'CheckoutDate', 'DueDate', 'Returned']);
  mk('Genres', ['Genre', 'SubGenre']);
  const mkFile = name => ({ name, trashed: false, created: clock.t + drive.files.length, getName() { return name; }, getUrl: () => 'https://drive/' + name, getDateCreated() { return new Date(this.created); }, setTrashed(v) { this.trashed = v; } });
  const ctx = {
    Date: FakeDate,
    Utilities: { DigestAlgorithm: { SHA_256: 1 }, Charset: { UTF_8: 1 }, getUuid: () => crypto.randomUUID(), formatDate: () => '2026-10-07', sleep: ms => { stats.slept += ms; },
      computeHmacSha256Signature: (m, k) => [...crypto.createHmac('sha256', k).update(m).digest()].map(b => (b > 127 ? b - 256 : b)),
      computeDigest: (a, t) => [...crypto.createHash('sha256').update(t).digest()].map(b => (b > 127 ? b - 256 : b)) },
    MailApp: { sendEmail: (to, subject, body) => { stats.mails.push({ to, subject, body }); }, getRemainingDailyQuota: () => 100 },
    DriveApp: { getRootFolder() {}, getFoldersByName: () => ({ hasNext: () => !!drive.folder, next: () => drive.folder }),
      createFolder: () => (drive.folder = { getFiles: () => { const l = drive.files.filter(f => !f.trashed); let i = 0; return { hasNext: () => i < l.length, next: () => l[i++] }; } }),
      getFileById: () => ({ makeCopy: name => { const f = mkFile(name); drive.files.push(f); clock.t += 1000; return f; } }) },
    ScriptApp: { WeekDay: { SUNDAY: 'SUNDAY' }, getProjectTriggers: () => triggers, deleteTrigger: t => { triggers.splice(triggers.indexOf(t), 1); },
      newTrigger: fn => { const t = { getHandlerFunction: () => fn }; const b = { timeBased: () => b, onWeekDay: () => b, atHour: () => b, create: () => { triggers.push(t); return t; } }; return b; } },
    Logger: { log: m => stats.logs.push(String(m)) },
    Session: { getScriptTimeZone: () => 'Asia/Kolkata' },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    CacheService: { getScriptCache: () => ({ get: k => cache[k] ?? null, put: (k, v) => { cache[k] = v; }, putAll: o => Object.assign(cache, o),
      getAll: ks => Object.fromEntries(ks.filter(k => k in cache).map(k => [k, cache[k]])), remove: k => { delete cache[k]; }, removeAll: ks => ks.forEach(k => delete cache[k]) }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] ?? null, setProperty: (k, v) => { props[k] = v; } }) },
    ContentService: { createTextOutput: t => ({ t, setMimeType: () => ({ t }) }), MimeType: { JSON: 1 } },
    SpreadsheetApp: { openById: () => ({ getSheetByName: n => sheets[n] || null, insertSheet: n => mk(n) }) }
  };
  vm.createContext(ctx);
  vm.runInContext((ownerEmail ? fs.readFileSync(new URL('../backend/Code.gs', import.meta.url), 'utf8').replace("'PUT-YOUR-EMAIL-HERE@example.com'", JSON.stringify(ownerEmail)) : fs.readFileSync(new URL('../backend/Code.gs', import.meta.url), 'utf8')) + ';this.api={H,login,doPost,pwHash,makeAllHashes,checkSetup,resume};', ctx);
  const { H, login, doPost, pwHash, makeAllHashes, checkSetup } = ctx.api;
  roles.forEach(r => { props['HASH_' + r] = pwHash(r, 'pw-' + r); });
  const signIn = role => login({ role, password: 'pw-' + role }).token;
  const call = (token, action, data = {}) => JSON.parse(doPost({ postData: { contents: JSON.stringify({ action, token, ...data }) } }).t);
  return { H, login, call, signIn, sheets, cache, props, stats, makeAllHashes, checkSetup, pwHash, clock, triggers, drive, resume: ctx.api.resume };
}

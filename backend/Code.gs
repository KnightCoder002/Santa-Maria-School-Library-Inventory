// ═══ School Library backend (Google Apps Script) ═══
// Nothing secret is stored in this file. Set these in Project Settings > Script properties:
//   SHEET_ID, SALT (any long random text), HASH_student, HASH_librarian, HASH_principal, HASH_admin
// Create each HASH_ value with makeHash() at the bottom of this file (see DEPLOY.md).
// ▼▼▼ REPLACE THIS with the email address that should receive a message whenever someone reports a problem.
// Leave it as it is to switch report emails off. (Only this one line needs editing. Or add a Script property named OWNER_EMAIL instead.)
const OWNER_EMAIL = 'PUT-YOUR-EMAIL-HERE@example.com';

const P = PropertiesService.getScriptProperties();
const SHEET_ID = P.getProperty('SHEET_ID');
const SALT = P.getProperty('SALT');
const TTL = 4 * 3600;
const ALL = ['student', 'librarian', 'principal', 'admin'], STAFF = ['librarian', 'principal'], REP = ALL, OWNER = ['admin'];
const REMEMBER_DAYS = 30;   // how long "keep me signed in" lasts for students
const ACL = { getAll: ALL, addBook: ['librarian'], updateBook: STAFF, checkout: ['librarian'], returnBook: STAFF, removeBook: ['principal'],
  listOpen: ['student'], listToggle: ['student'], listReset: STAFF, addGenre: ['principal'], report: REP,
  getReports: OWNER, setReport: OWNER, getLog: OWNER, saveSettings: OWNER, saveQuotes: OWNER, setPassword: OWNER, signOutAll: OWNER,
  backupNow: OWNER, getBackups: OWNER, setWeeklyBackup: OWNER };
const INV = ['BookID', 'Title', 'Author', 'Genre', 'SubGenre', 'Available', 'AgeGroup', 'Condition', 'Language', 'ContainedWorks', 'ISBN'];

function doGet() { return out({ success: false, error: 'Use POST.' }); }
function doPost(e) {
  try {
    const p = JSON.parse(e.postData.contents);
    let data;
    if (p.action === 'ping') data = { ok: true };            // keeps the script warm: no sign-in needed
    else if (p.action === 'login') data = login(p);
    else if (p.action === 'resume') data = resume(p);          // student "keep me signed in"
    else {
      const role = requireToken(p.token);
      if (!H[p.action] || !ACL[p.action] || ACL[p.action].indexOf(role) < 0) throw new Error('Not allowed.');
      data = H[p.action](p, role);
    }
    return out({ success: true, data: data });
  } catch (err) { return out({ success: false, error: err.message }); }
}
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

// ── Auth ──
function sha(t) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, t, Utilities.Charset.UTF_8).map(b => ('0' + (b & 255).toString(16)).slice(-2)).join(''); }
function pwHash(role, pw) { return sha('pw:' + role + ':' + pw + ':' + SALT); }
const epoch = () => String(P.getProperty('EPOCH') || '0');
function hmacHex(msg) { return Utilities.computeHmacSha256Signature(msg, SALT + ':remember').map(b => ('0' + (b & 255).toString(16)).slice(-2)).join(''); }
function makeRemember() { const msg = 'student.' + (Date.now() + REMEMBER_DAYS * 864e5) + '.' + epoch(); return 'R.' + msg + '.' + hmacHex(msg); }
function checkRemember(t) {
  const m = /^R\.student\.(\d+)\.(\d+)\.([a-f0-9]{64})$/.exec(String(t || ''));
  return !!m && hmacHex('student.' + m[1] + '.' + m[2]) === m[3] && +m[1] > Date.now() && m[2] === epoch();
}
function newSession(role) {
  const token = Utilities.getUuid() + Utilities.getUuid();
  CacheService.getScriptCache().put('s_' + token, role + '|' + epoch(), TTL);
  return token;
}
function login(p) {
  const role = String(p.role || ''), pw = String(p.password || '');
  if (!SALT || !SHEET_ID) throw new Error('The server is not set up yet. See DEPLOY.md, step 2.');
  if (!role || !pw) throw new Error('Role and password are required.');
  const c = CacheService.getScriptCache(), k = 'fail_' + role, n = +(c.get(k) || 0), expected = String(P.getProperty('HASH_' + role) || '').trim().toLowerCase();
  if (['student', 'librarian', 'principal', 'admin'].indexOf(role) >= 0 && !expected) throw new Error('This login is not set up yet: the Script property HASH_' + role + ' is missing. See DEPLOY.md, step 2.');
  if (expected && !/^[a-f0-9]{64}$/.test(expected)) throw new Error('The saved password hash for ' + role + ' looks wrong (it must be exactly 64 letters and digits). Make it again with makeAllHashes().');
  if (role === 'admin' && n >= 5) throw new Error('Too many attempts. Try again later.');
  if (!expected || pwHash(role, pw) !== expected) {
    c.put(k, String(n + 1), role === 'admin' ? 1800 : 600);
    if (role === 'admin') logEvent('Unknown', 'Wrong Owner password', 'attempt ' + (n + 1));
    // Everyone else is never locked out by someone else's wrong guesses: repeated guesses are just slowed down.
    if (role !== 'admin' && n >= 5) Utilities.sleep(Math.min(n - 4, 5) * 1500);
    throw new Error('Incorrect password.');
  }
  c.remove(k);
  const res = { role: role };
  if (p.remember && role === 'student') { res.token = makeRemember(); res.remember = true; }   // students only, never staff
  else res.token = newSession(role);
  if (role !== 'student') logEvent(role, 'Signed in', '');
  if (p.withData) res.data = H.getAll({}, role);   // one round trip instead of two
  return res;
}
// Reopens the site for a student whose device was remembered. Gives a fresh 30-day token each time.
function resume(p) {
  if (!SALT || !SHEET_ID) throw new Error('The server is not set up yet. See DEPLOY.md, step 2.');
  if (!checkRemember(p.token)) throw new Error('Session expired. Please sign in again.');
  return { token: makeRemember(), role: 'student', remember: true, data: H.getAll({}, 'student') };
}
function requireToken(t) {
  if (String(t || '').indexOf('R.') === 0) { if (checkRemember(t)) return 'student'; throw new Error('Session expired. Please sign in again.'); }
  const c = CacheService.getScriptCache(), v = t && c.get('s_' + t), parts = v ? String(v).split('|') : [];
  if (!parts[0] || parts[1] !== epoch()) throw new Error('Session expired. Please sign in again.');
  c.put('s_' + t, v, TTL);
  return parts[0];
}

// ── Helpers ──
const fmt = d => Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
let _ss;
function ss() { return _ss || (_ss = SpreadsheetApp.openById(SHEET_ID)); }       // opened once per request
function sh(n) { const s = ss().getSheetByName(n); if (!s) throw new Error('Missing tab: ' + n); return s; }
function read(n, sheet) {
  const s = sheet || sh(n), r = s.getLastRow(), c = s.getLastColumn();
  if (r < 2) return [];
  const v = s.getRange(1, 1, r, c).getValues(), h = v[0].map(x => String(x).trim());
  return v.slice(1).map(row => { const o = {}; h.forEach((k, j) => { const x = row[j]; o[k] = x instanceof Date ? fmt(x) : (x == null ? '' : String(x)); }); return o; });
}
function logSheet() {
  let s = ss().getSheetByName('Log');
  if (!s) { s = ss().insertSheet('Log'); s.appendRow(['Time', 'Who', 'Action', 'Detail']); s.getRange('A:A').setNumberFormat('@'); }
  return s;
}
function logEvent(who, action, detail) {   // the activity log; never allowed to break the real action
  try {
    const s = logSheet();
    s.appendRow([Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm'), who, action, clean(detail, 200)]);
    if (Math.random() < 0.005 && s.getLastRow() > 5000) s.deleteRows(2, 1000);   // keep the log from growing forever
  } catch (e) {}
}
function readSettings() { const o = {}; readOpt('Settings').forEach(r => { if (r.Key) o[r.Key] = r.Value; }); return o; }
function readQuotes() { return readOpt('Quotes').filter(r => r.Quote).map(r => [r.Quote, r.Author || '']); }
function tabOf(name, header) { let s = ss().getSheetByName(name); if (!s) { s = ss().insertSheet(name); s.appendRow(header); } return s; }
function readOpt(n) { return ss().getSheetByName(n) ? read(n) : []; }
function rowOf(s, id) {
  const r = s.getLastRow(); if (r < 2) return -1;
  const v = s.getRange(2, 1, r - 1, 1).getValues();
  for (let i = 0; i < v.length; i++) if (String(v[i][0]) === String(id)) return i + 2;
  return -1;
}
function locked(f) { const l = LockService.getScriptLock(); l.waitLock(20000); try { return f(); } finally { l.releaseLock(); } }
// Runs fn once per request id: a retried request (after a dropped connection) never repeats the action.
function once(p, fn) {
  const c = CacheService.getScriptCache(), k = p.rid ? 'rid_' + String(p.rid).slice(0, 60) : null;
  if (k) { const done = c.get(k); if (done) return JSON.parse(done); }
  const r = fn();
  if (k) c.put(k, JSON.stringify(r), 21600);
  return r;
}
function clean(x, max) { const s = String(x == null ? '' : x).trim().slice(0, max || 200); return /^[=+\-@]/.test(s) ? "'" + s : s; }
function code(s, n) { return String(s || '').replace(/[^a-zA-Z]/g, '').substring(0, n).toUpperCase(); }
function scanMax(sheet, col, prefix) {
  const r = sheet.getLastRow(); let max = 0; if (r < 2) return 0;
  sheet.getRange(2, col, r - 1, 1).getValues().forEach(x => { const id = String(x[0]); if (id.indexOf(prefix + '-') === 0) max = Math.max(max, parseInt(id.split('-').pop(), 10) || 0); });
  return max;
}
function nextId(genre, sub) {
  const prefix = (genre === 'Fiction' ? 'FIC' : genre === 'Non-Fiction' ? 'NF' : code(genre, 3) || 'GEN') + '-' + (code(String(sub).split('|')[0], 3) || 'SUB'), key = 'seq_' + prefix;
  let max = parseInt(P.getProperty(key) || '', 10);
  if (isNaN(max)) max = scanMax(sh('Checkouts'), 3, prefix);   // first time only: remember IDs of books removed earlier
  max = Math.max(max, scanMax(sh('Inventory'), 1, prefix)) + 1;
  P.setProperty(key, String(max));
  return prefix + '-' + String(max).padStart(3, '0');
}
function bookRow(b, id, avail) {
  b = b || {};
  const title = clean(b.Title, 200), author = clean(b.Author, 150);
  if (!title || !author || !b.Genre || !b.SubGenre) throw new Error('Title, author, genre and sub-genre are required.');
  return [id, title, author, clean(b.Genre, 40), clean(b.SubGenre, 200), avail, clean(b.AgeGroup, 40), clean(b.Condition, 20), clean(b.Language, 20), clean(b.ContainedWorks, 1000), clean(b.ISBN, 20)];
}
// One-time sheet preparation (headers and plain-text columns), remembered so it never slows a save again.
function ensureCols() {
  if (P.getProperty('cols_ok')) return;
  const inv = sh('Inventory');
  if (!inv.getRange(1, 10).getValue()) inv.getRange(1, 10).setValue('ContainedWorks');
  if (!inv.getRange(1, 11).getValue()) inv.getRange(1, 11).setValue('ISBN');
  inv.getRange('K:K').setNumberFormat('@');
  sh('Checkouts').getRange('B:B').setNumberFormat('@');
  P.setProperty('cols_ok', '1');
}

// ── Cached copy of the library data (a few seconds old at most; cleared on every write) ──
function cachePutBig(key, str) {
  const parts = {}; let n = 0;
  for (let i = 0; i < str.length; i += 30000) parts[key + '_' + n++] = str.slice(i, i + 30000);
  if (n > 30) return;
  parts[key + '_n'] = String(n);
  CacheService.getScriptCache().putAll(parts, 120);
}
function cacheGetBig(key) {
  const c = CacheService.getScriptCache(), n = +(c.get(key + '_n') || 0);
  if (!n) return null;
  const keys = []; for (let i = 0; i < n; i++) keys.push(key + '_' + i);
  const got = c.getAll(keys); let s = '';
  for (let i = 0; i < n; i++) { const part = got[keys[i]]; if (part == null) return null; s += part; }
  return s;
}
function bust() { CacheService.getScriptCache().removeAll(['gi_n', 'gc_n']); }
function loadAll(needCheckouts) {
  const gi = cacheGetBig('gi'), gc = needCheckouts ? cacheGetBig('gc') : '[]';
  if (gi && gc) { const a = JSON.parse(gi); a.checkouts = JSON.parse(gc); return a; }
  const inv = read('Inventory'), co = read('Checkouts'), due = {}, cnt = {};
  co.forEach(c => { cnt[c.BookID] = (cnt[c.BookID] || 0) + 1; if (c.Returned !== 'Yes') due[c.BookID] = c.DueDate; });
  inv.forEach(b => { b.Borrows = String(cnt[b.BookID] || 0); if (b.Available === 'No') b.DueBack = due[b.BookID] || ''; });  // only the date, never who has it
  const a = { inventory: inv, genres: readOpt('Genres'), settings: readSettings(), quotes: readQuotes() };
  try { cachePutBig('gi', JSON.stringify(a)); cachePutBig('gc', JSON.stringify(co)); } catch (e) {}
  a.checkouts = co;
  return a;
}

// ── Personal reading lists: roll number + 4-digit PIN, stored in the Lists tab ──
function listSheet() {
  let s = ss().getSheetByName('Lists');
  if (!s) { s = ss().insertSheet('Lists'); s.appendRow(['RollNumber', 'PinHash', 'Books', 'Updated']); s.getRange('A:A').setNumberFormat('@'); }
  return s;
}
// A list is identified by roll number AND PIN together: the PIN belongs to one roll number only,
// so different roll numbers can freely choose the same PIN (e.g. roll 1 and roll 54 can both use 1468).
function listCheck(p) {
  const roll = String(p.roll || '').trim(), pin = String(p.pin || '');
  if (!/^[A-Za-z0-9\-\/]{1,20}$/.test(roll)) throw new Error('Enter your roll number.');
  if (!/^\d{4}$/.test(pin)) throw new Error('The PIN must be 4 digits.');
  const c = CacheService.getScriptCache(), k = 'pin_' + roll, n = +(c.get(k) || 0);
  if (n >= 5) throw new Error('Too many wrong PINs. Try again in 10 minutes.');
  return { roll: roll, hash: sha('list:' + roll + ':' + pin), c: c, k: k, n: n };
}
function listRead(s, r) { const row = s.getRange(r, 1, 1, 3).getValues()[0]; return { hash: row[1], books: String(row[2]).split('|').filter(Boolean) }; }
function listPin(a, cur) {
  if (cur.hash !== a.hash) { a.c.put(a.k, String(a.n + 1), 600); throw new Error('Wrong PIN. ' + Math.max(0, 4 - a.n) + ' tries left.'); }
  a.c.remove(a.k);
  return { books: cur.books, isNew: false };
}
function quota(key, max, secs, msg) {
  const c = CacheService.getScriptCache(), n = +(c.get(key) || 0);
  if (n >= max) throw new Error(msg);
  c.put(key, String(n + 1), secs);
}

// ── Actions ──
const H = {
  getAll(p, role) {
    const a = loadAll(role !== 'student'), res = { inventory: a.inventory, genres: a.genres, settings: a.settings, quotes: a.quotes };
    if (role !== 'student') res.checkouts = a.checkouts;   // roll numbers never reach students
    if (role === 'admin') { const l = ss().getSheetByName('Lists'); res.meta = { lists: l ? Math.max(0, l.getLastRow() - 1) : 0, lastBackup: P.getProperty('LAST_BACKUP') || '' }; }
    return res;
  },
  addBook(p, role) {
    return locked(() => once(p, () => {
      ensureCols();
      const b = p.book || {}, id = nextId(b.Genre, b.SubGenre);
      sh('Inventory').appendRow(bookRow(b, id, 'Yes'));
      bust(); logEvent(role, 'Added book', id + ' ' + b.Title);
      return { bookId: id };
    }));
  },
  updateBook(p, role) {
    return locked(() => {
      const s = sh('Inventory'), r = rowOf(s, p.bookId);
      if (r < 0) throw new Error('Book not found.');
      const avail = s.getRange(r, 6).getValue() === 'No' ? 'No' : 'Yes';
      s.getRange(r, 1, 1, INV.length).setValues([bookRow(p.book, p.bookId, avail)]);
      bust(); logEvent(role, 'Edited book', p.bookId + ' ' + (p.book || {}).Title);
      return { updated: true };
    });
  },
  // Checkout and return are single locked operations: no half-written state, no double checkout.
  checkout(p, role) {
    return locked(() => once(p, () => {
      const roll = String(p.roll || '').trim();
      if (!/^[A-Za-z0-9\-\/]{1,20}$/.test(roll)) throw new Error('Invalid roll number.');
      const days = Math.min(90, Math.max(1, parseInt(p.days, 10) || parseInt(readSettings().loan_days, 10) || 14));
      const inv = sh('Inventory'), r = rowOf(inv, p.bookId);
      if (r < 0) throw new Error('Book not found.');
      const rec = inv.getRange(r, 1, 1, 6).getValues()[0];
      if (rec[5] === 'No') throw new Error('This book is already checked out.');
      const co = sh('Checkouts'), now = new Date(), due = new Date(now.getTime() + days * 864e5);
      const id = 'CO-' + Date.now().toString(36).toUpperCase() + '-' + co.getLastRow();
      co.appendRow([id, roll, rec[0], rec[1], fmt(now), fmt(due), 'No']);
      inv.getRange(r, 6).setValue('No');
      bust(); logEvent(role, 'Checked out', rec[0] + ' ' + rec[1] + ' to roll ' + roll);
      return { checkoutId: id, dueDate: fmt(due) };
    }));
  },
  returnBook(p, role) {
    return locked(() => once(p, () => {
      const co = sh('Checkouts'), r = rowOf(co, p.checkoutId);
      if (r < 0) throw new Error('Checkout not found.');
      const rec = co.getRange(r, 1, 1, 7).getValues()[0];
      if (rec[6] === 'Yes') throw new Error('Already returned.');
      co.getRange(r, 7).setValue('Yes');
      const inv = sh('Inventory'), ir = rowOf(inv, rec[2]);
      if (ir > 0) inv.getRange(ir, 6).setValue('Yes');
      bust(); logEvent(role, 'Returned', rec[2] + ' ' + rec[3] + ' from roll ' + rec[1]);
      return { returned: true };
    }));
  },
  removeBook(p, role) {
    return locked(() => {
      const s = sh('Inventory'), r = rowOf(s, p.bookId);
      if (r < 0) throw new Error('Book not found.');
      if (s.getRange(r, 6).getValue() === 'No') throw new Error('Cannot remove a book that is checked out.');
      const gone = s.getRange(r, 1, 1, 2).getValues()[0];
      s.deleteRow(r);
      bust(); logEvent(role, 'Removed book', gone[0] + ' ' + gone[1]);
      return { deleted: true };
    });
  },
  // Reading lists only touch one student's own row, so saving does not take the library-wide lock.
  listOpen(p) {
    const a = listCheck(p), s = listSheet(), r = rowOf(s, a.roll), cur = r > 0 ? listRead(s, r) : null;
    if (cur && cur.hash) return listPin(a, cur);
    return locked(() => {   // first use of this roll number, or its PIN was reset
      const r2 = rowOf(s, a.roll), now = r2 > 0 ? listRead(s, r2) : null;
      if (!now) { quota('nl_' + p.token, 5, 3600, 'Too many new lists from this device. Try again later.'); s.appendRow([a.roll, a.hash, '', fmt(new Date())]); return { books: [], isNew: true }; }
      if (!now.hash) { s.getRange(r2, 2).setValue(a.hash); a.c.remove(a.k); return { books: now.books, isNew: true }; }
      return listPin(a, now);   // someone set it a moment ago
    });
  },
  listToggle(p) {   // adds or removes ONE book, so quick taps can never overwrite each other
    const a = listCheck(p), s = listSheet(), r = rowOf(s, a.roll);
    if (r < 0) throw new Error('Open your list first.');
    const row = s.getRange(r, 2, 1, 2).getValues()[0];
    if (row[0] !== a.hash) { a.c.put(a.k, String(a.n + 1), 600); throw new Error('Wrong PIN.'); }
    const id = String(p.bookId || '').replace(/[^A-Za-z0-9\-]/g, '');
    if (!id) throw new Error('Choose a book.');
    const books = String(row[1]).split('|').filter(Boolean).filter(x => x !== id);
    if (p.on) books.push(id);
    s.getRange(r, 3, 1, 2).setValues([[books.slice(0, 200).join('|'), fmt(new Date())]]);
    return { books: books };
  },
  listReset(p, role) {
    return locked(() => {
      const roll = String(p.roll || '').trim(), s = listSheet(), r = rowOf(s, roll);
      if (r < 0) throw new Error('That roll number has no saved list.');
      s.getRange(r, 2).setValue(''); CacheService.getScriptCache().remove('pin_' + roll); logEvent(role, 'Reset list PIN', 'roll ' + roll);
      return { reset: true };
    });
  },
  addGenre(p, role) {
    const ok = t => /^[a-zA-Z0-9 \/'&.\-]{2,40}$/.test(String(t || '').trim());
    if (!ok(p.genre) || !ok(p.subgenre)) throw new Error('Names may use letters, numbers, spaces and / \' & . - (2-40 characters).');
    return locked(() => { sh('Genres').appendRow([String(p.genre).trim(), String(p.subgenre).trim()]); bust(); logEvent(role, 'Added sub-genre', p.genre + ' / ' + p.subgenre); return { added: true }; });
  },
  report(p, role) {
    const types = ['A book is missing', 'Wrong book details', 'Problem with this site', 'Something else'];
    const msg = clean(p.message, 1000);
    if (!msg || types.indexOf(p.type) < 0) throw new Error('Please describe the problem.');
    quota('rep_' + p.token, 5, 3600, 'Too many reports. Please try again later.');
    quota('rep_all', 60, 3600, 'Too many reports right now. Please try again later.');
    return locked(() => {
      repSheet().appendRow(['R-' + Date.now().toString(36).toUpperCase(), fmt(new Date()), role, p.type, msg, clean(p.contact, 80), 'Open', '']);
      logEvent(role, 'Report sent', p.type);
      notifyOwner(p.type, role, msg, clean(p.contact, 80));
      return { reported: true };
    });
  },
  getReports() { return read('Reports', repSheet()); },
  setReport(p, role) {
    return locked(() => {
      const s = repSheet(), r = rowOf(s, p.reportId);
      if (r < 0) throw new Error('Report not found.');
      if (p.status !== undefined) s.getRange(r, 7).setValue(p.status === 'Resolved' ? 'Resolved' : 'Open');
      if (p.notes !== undefined) s.getRange(r, 8).setValue(clean(p.notes, 500));
      logEvent(role, p.status === 'Resolved' ? 'Resolved report' : p.status === 'Open' ? 'Reopened report' : 'Noted report', p.reportId);
      return { ok: true };
    });
  },
  getLog() {
    const s = logSheet(), r = s.getLastRow();
    if (r < 2) return [];
    const from = Math.max(2, r - 299), tz = Session.getScriptTimeZone();
    return s.getRange(from, 1, r - from + 1, 4).getValues().map(x => ({ Time: x[0] instanceof Date ? Utilities.formatDate(x[0], tz, 'yyyy-MM-dd HH:mm') : String(x[0]), Who: String(x[1]), Action: String(x[2]), Detail: String(x[3]) })).reverse();
  },
  // ── Owner tools ──
  saveSettings(p, role) {
    const rules = { loan_days: v => /^\d+$/.test(v) && +v >= 1 && +v <= 90, loan_limit: v => /^\d+$/.test(v) && +v <= 20, banner_text: v => v.length <= 200,
      banner_on: v => v === 'yes' || v === 'no', builtin_quotes: v => v === 'yes' || v === 'no' };
    const given = p.settings || {}, keys = Object.keys(given);
    keys.forEach(k => { if (!rules[k]) throw new Error('Unknown setting: ' + k); if (!rules[k](String(given[k]))) throw new Error('That value is not allowed for ' + k.replace('_', ' ') + '.'); });
    return locked(() => {
      const s = tabOf('Settings', ['Key', 'Value']);
      keys.forEach(k => { const r = rowOf(s, k), v = clean(given[k], 200); if (r < 0) s.appendRow([k, v]); else s.getRange(r, 2).setValue(v); });
      bust(); logEvent(role, 'Changed settings', keys.join(', '));
      return { saved: true };
    });
  },
  saveQuotes(p, role) {
    const list = (Array.isArray(p.quotes) ? p.quotes : []).slice(0, 300).map(q => [clean(q[0], 300), clean(q[1], 80)]).filter(q => q[0]);
    return locked(() => {
      const s = tabOf('Quotes', ['Quote', 'Author']), last = s.getLastRow();
      if (last > 1) s.getRange(2, 1, last - 1, 2).clearContent();
      if (list.length) s.getRange(2, 1, list.length, 2).setValues(list);
      bust(); logEvent(role, 'Changed quotes', list.length + ' custom quotes');
      return { saved: list.length };
    });
  },
  setPassword(p, role) {
    const target = String(p.role || ''), names = { student: 'student', librarian: 'librarian', principal: 'principal', admin: 'Owner' };
    if (!names[target]) throw new Error('Choose which login to change.');
    quota('pwchange', 10, 3600, 'Too many password changes. Try again later.');
    const pw = String(p.password || ''), min = target === 'student' ? 6 : 12;
    if (pw.length < min) throw new Error('Use at least ' + min + ' characters for the ' + names[target] + ' password.');
    if (pwHash('admin', String(p.current || '')) !== String(P.getProperty('HASH_admin') || '').trim().toLowerCase()) throw new Error('Your current Owner password is not right.');
    P.setProperty('HASH_' + target, pwHash(target, pw));
    logEvent(role, 'Changed password', 'for ' + names[target]);
    const res = { changed: target };
    if (p.signOutAll) res.token = signOutEverywhere(role);
    return res;
  },
  signOutAll(p, role) { return { token: signOutEverywhere(role) }; },
  backupNow(p, role) { const r = doBackup(role); pruneBackups(12); return r; },
  getBackups() { return { weekly: weeklyOn(), backups: listBackups() }; },
  setWeeklyBackup(p, role) {
    ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'weeklyBackup').forEach(t => ScriptApp.deleteTrigger(t));
    if (p.on) ScriptApp.newTrigger('weeklyBackup').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(2).create();
    logEvent(role, p.on ? 'Turned on weekly backup' : 'Turned off weekly backup', '');
    return { weekly: !!p.on };
  }
};
function signOutEverywhere(who) {   // everyone (students who chose "keep me signed in" too) must sign in again; the Owner gets a fresh sign-in
  P.setProperty('EPOCH', String((+P.getProperty('EPOCH') || 0) + 1));
  logEvent(who, 'Signed everyone out', '');
  return newSession('admin');
}
function notifyOwner(type, role, msg, contact) {
  const to = P.getProperty('OWNER_EMAIL') || OWNER_EMAIL;   // a Script property named OWNER_EMAIL also works and survives updates
  if (!to || to.indexOf('PUT-YOUR-EMAIL-HERE') >= 0) return;
  try { MailApp.sendEmail(to, 'Library report: ' + type, 'From: ' + role + (contact ? ' (' + contact + ')' : '') + '\n\n' + msg + '\n\nOpen the Owner page to resolve it.'); } catch (e) {}
}
// ── Backups: a dated copy of the whole Sheet in a Drive folder called "Library backups" ──
function backupFolder() { const it = DriveApp.getFoldersByName('Library backups'); return it.hasNext() ? it.next() : DriveApp.createFolder('Library backups'); }
function backupFiles() { const out = [], it = backupFolder().getFiles(); while (it.hasNext()) out.push(it.next()); return out.sort((a, b) => b.getDateCreated() - a.getDateCreated()); }
function doBackup(who) {
  const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm'), name = 'Library backup ' + stamp;
  const file = DriveApp.getFileById(SHEET_ID).makeCopy(name, backupFolder());
  P.setProperty('LAST_BACKUP', stamp);
  logEvent(who, 'Backup made', name);
  return { name: name, url: file.getUrl() };
}
function pruneBackups(keep) { backupFiles().slice(keep).forEach(f => f.setTrashed(true)); }
function listBackups() { return backupFiles().slice(0, 10).map(f => ({ name: f.getName(), url: f.getUrl() })); }
function weeklyOn() { return ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'weeklyBackup'); }
function weeklyBackup() { doBackup('Automatic'); pruneBackups(12); }   // run by the weekly trigger
// Run this once from the editor after pasting a new version: it makes Google ask for the permissions the Owner tools need
// (Drive for backups, Gmail for report emails, triggers for the weekly backup).
function authorizeAll() { DriveApp.getRootFolder(); MailApp.getRemainingDailyQuota(); ScriptApp.getProjectTriggers(); Logger.log('All permissions are in place.'); }
function repSheet() {
  const s = tabOf('Reports', ['ReportID', 'Date', 'Role', 'Type', 'Message', 'Contact', 'Status', 'Notes']);
  if (!P.getProperty('rep_notes_ok')) { if (!s.getRange(1, 8).getValue()) s.getRange(1, 8).setValue('Notes'); P.setProperty('rep_notes_ok', '1'); }
  return s;
}

// EASIEST WAY TO SET UP PASSWORDS: type the four passwords below, press Run, open View > Execution log.
// It prints four lines such as  HASH_admin = 3f9a...  Copy the long text after the equals sign into the Script
// property with the same name. Then delete the passwords from this function.
function makeAllHashes() {
  const pw = { student: 'CHANGE-ME', librarian: 'CHANGE-ME', principal: 'CHANGE-ME', admin: 'CHANGE-ME' };
  Object.keys(pw).forEach(r => Logger.log('HASH_' + r + ' = ' + pwHash(r, pw[r])));
}
// Makes one hash. Change BOTH the role and the password, press Run, copy the result from the Execution log.
function makeHash() { Logger.log(pwHash('student', 'CHANGE-THIS-PASSWORD')); }

// Finds setup mistakes. Set `role` to the login that fails and `pw` to the password you type on the site, press Run.
function checkSetup() {
  const role = 'admin', pw = 'CHANGE-THIS-PASSWORD', roles = ['student', 'librarian', 'principal', 'admin'];
  ['SHEET_ID', 'SALT'].concat(roles.map(r => 'HASH_' + r)).forEach(k => {
    const v = P.getProperty(k);
    Logger.log(k + ': ' + (v == null ? 'MISSING' : k.indexOf('HASH_') === 0 ? (/^[a-f0-9]{64}$/.test(String(v).trim().toLowerCase()) ? 'ok' : 'WRONG FORMAT (' + v.length + ' characters, it must be 64 letters and digits)') : 'ok'));
  });
  if (pw === 'CHANGE-THIS-PASSWORD') Logger.log('Type the password you are testing in place of CHANGE-THIS-PASSWORD, then run again.');
  const saved = r => String(P.getProperty('HASH_' + r) || '').trim().toLowerCase();
  const hits = roles.filter(r => pwHash(r, pw) === saved(r));
  if (hits.indexOf(role) >= 0) Logger.log('Password for ' + role + ': MATCHES. Signing in will work.');
  else if (hits.length) Logger.log('Password for ' + role + ': DOES NOT MATCH, but this password matches the hash saved for ' + hits.join(', ') + '. So the ' + role + ' hash was made with the wrong role. Make it again with makeAllHashes() and paste it into HASH_' + role + '.');
  else Logger.log('Password for ' + role + ': DOES NOT MATCH any saved hash. Either the password text is different (check spaces and capital letters) or SALT was changed after the hashes were made. Run makeAllHashes() again and replace all four HASH_ values.');
}

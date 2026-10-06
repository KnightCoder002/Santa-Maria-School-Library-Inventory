// ═══ School Library backend (Google Apps Script) ═══
// Deploy: Web app → Execute as: Me → Access: Anyone. Put the /exec URL in Vercel as GAS_URL.
// Every action except login needs a session token; students never receive checkout data.
const SHEET_ID = 'YOUR_GOOGLE_SHEET_ID_HERE';
const HASHES = { // SHA-256 of each password. CHANGE THESE (see README): the old ones were shared in chat.
  student:   '703b0a3d6ad75b649a28adde7d83c6251da457549263bc7ff45ec709b0a8448b',
  librarian: 'ab8e89c55367f55a2f933b8dc8a9994d61f997df2b402274eb943fa22d77394a',
  principal: '3549f22fb8622a6d216ef2dcd592e04ed1f1e604cef032d7e5c425e8e72a878e'
};
const TTL = 4 * 3600;
const ALL = ['student', 'librarian', 'principal'], STAFF = ['librarian', 'principal'];
const ACL = { getAll: ALL, addBook: STAFF, updateBook: STAFF, checkout: STAFF, returnBook: STAFF, removeBook: ['principal'], addGenre: ['principal'], report: ALL, getReports: ['principal'], setReport: ['principal'] };
const INV = ['BookID','Title','Author','Genre','SubGenre','Available','AgeGroup','Condition','Language','ContainedWorks','ISBN'];

function doGet() { return out({ success: false, error: 'Use POST.' }); }
function doPost(e) {
  try {
    const p = JSON.parse(e.postData.contents);
    let data;
    if (p.action === 'login') data = login(p.role, p.password);
    else {
      const role = requireToken(p.token);
      if (!H[p.action] || ACL[p.action].indexOf(role) < 0) throw new Error('Not allowed.');
      data = H[p.action](p, role);
    }
    return out({ success: true, data: data });
  } catch (err) { return out({ success: false, error: err.message }); }
}
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

// ── Auth ──
function sha(t) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, t, Utilities.Charset.UTF_8).map(b => ('0' + (b & 255).toString(16)).slice(-2)).join(''); }
function login(role, pw) {
  const c = CacheService.getScriptCache(), k = 'fail_' + role, n = +(c.get(k) || 0);
  if (n >= 10) throw new Error('Too many attempts. Try again in 10 minutes.');
  if (!HASHES[role] || sha(String(pw || '')) !== HASHES[role]) { c.put(k, String(n + 1), 600); throw new Error('Incorrect password.'); }
  c.remove(k);
  const token = Utilities.getUuid() + Utilities.getUuid();
  c.put('s_' + token, role, TTL);
  return { token: token, role: role };
}
function requireToken(t) {
  const c = CacheService.getScriptCache(), role = t && c.get('s_' + t);
  if (!role) throw new Error('Session expired. Please sign in again.');
  c.put('s_' + t, role, TTL);
  return role;
}

// ── Helpers ──
const fmt = d => Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
function sh(n) { const s = SpreadsheetApp.openById(SHEET_ID).getSheetByName(n); if (!s) throw new Error('Missing tab: ' + n); return s; }
function read(n) {
  const s = sh(n), r = s.getLastRow(), c = s.getLastColumn();
  if (r < 2) return [];
  const v = s.getRange(1, 1, r, c).getValues(), h = v[0].map(x => String(x).trim());
  return v.slice(1).map(row => { const o = {}; h.forEach((k, j) => { const x = row[j]; o[k] = x instanceof Date ? fmt(x) : (x == null ? '' : String(x)); }); return o; });
}
function repSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let s = ss.getSheetByName('Reports');
  if (!s) { s = ss.insertSheet('Reports'); s.appendRow(['ReportID', 'Date', 'Role', 'Type', 'Message', 'Contact', 'Status']); }
  return s;
}
function rowOf(s, id) {
  const r = s.getLastRow(); if (r < 2) return -1;
  const v = s.getRange(2, 1, r - 1, 1).getValues();
  for (let i = 0; i < v.length; i++) if (String(v[i][0]) === String(id)) return i + 2;
  return -1;
}
function locked(f) { const l = LockService.getScriptLock(); l.waitLock(20000); try { return f(); } finally { l.releaseLock(); } }
function clean(x, max) { const s = String(x == null ? '' : x).trim().slice(0, max || 200); return /^[=+\-@]/.test(s) ? "'" + s : s; }
function code(s, n) { return String(s || '').replace(/[^a-zA-Z]/g, '').substring(0, n).toUpperCase(); }
function nextId(genre, sub) {
  const prefix = (genre === 'Fiction' ? 'FIC' : genre === 'Non-Fiction' ? 'NF' : code(genre, 3) || 'GEN') + '-' + (code(String(sub).split('|')[0], 3) || 'SUB');
  let max = 0;
  [['Inventory', 0], ['Checkouts', 2]].forEach(([tab, col]) => {
    const s = sh(tab), r = s.getLastRow(); if (r < 2) return;
    s.getRange(2, col + 1, r - 1, 1).getValues().forEach(x => {
      const id = String(x[0]); if (id.indexOf(prefix + '-') === 0) max = Math.max(max, parseInt(id.split('-').pop(), 10) || 0);
    });
  });
  return prefix + '-' + String(max + 1).padStart(3, '0');
}
function bookRow(b, id, avail) {
  b = b || {};
  const title = clean(b.Title, 200), author = clean(b.Author, 150);
  if (!title || !author || !b.Genre || !b.SubGenre) throw new Error('Title, author, genre and sub-genre are required.');
  return [id, title, author, clean(b.Genre, 40), clean(b.SubGenre, 200), avail, clean(b.AgeGroup, 40), clean(b.Condition, 20), clean(b.Language, 20), clean(b.ContainedWorks, 1000), clean(b.ISBN, 20)];
}

// ── Actions ──
const H = {
  getAll(p, role) {
    const base = { inventory: read('Inventory'), genres: read('Genres') }, co = read('Checkouts'), due = {};
    const cnt = {}; co.forEach(c => { cnt[c.BookID] = (cnt[c.BookID] || 0) + 1; if (c.Returned !== 'Yes') due[c.BookID] = c.DueDate; });
    base.inventory.forEach(b => { b.Borrows = String(cnt[b.BookID] || 0); if (b.Available === 'No') b.DueBack = due[b.BookID] || ''; }); // only the date, never who has it
    if (role !== 'student') base.checkouts = co; // roll numbers never reach students
    return base;
  },
  addBook(p) {
    return locked(() => {
      const s = sh('Inventory');
      if (!s.getRange(1, 10).getValue()) s.getRange(1, 10).setValue('ContainedWorks'); if (!s.getRange(1, 11).getValue()) s.getRange(1, 11).setValue('ISBN'); // never touches your existing headers
      s.getRange('K:K').setNumberFormat('@'); // keep ISBN leading zeros
      const id = nextId((p.book || {}).Genre, (p.book || {}).SubGenre);
      s.appendRow(bookRow(p.book, id, 'Yes'));
      return { bookId: id };
    });
  },
  updateBook(p) {
    return locked(() => {
      const s = sh('Inventory'), r = rowOf(s, p.bookId);
      if (r < 0) throw new Error('Book not found.');
      const avail = s.getRange(r, 6).getValue() === 'No' ? 'No' : 'Yes';
      s.getRange(r, 1, 1, INV.length).setValues([bookRow(p.book, p.bookId, avail)]);
      return { updated: true };
    });
  },
  // Checkout and return are single locked operations: no half-written state, no double checkout.
  checkout(p) {
    return locked(() => {
      const roll = String(p.roll || '').trim();
      if (!/^[A-Za-z0-9\-\/]{1,20}$/.test(roll)) throw new Error('Invalid roll number.');
      const days = Math.min(90, Math.max(1, parseInt(p.days, 10) || 14));
      const inv = sh('Inventory'), r = rowOf(inv, p.bookId);
      if (r < 0) throw new Error('Book not found.');
      const rec = inv.getRange(r, 1, 1, 6).getValues()[0];
      if (rec[5] === 'No') throw new Error('This book is already checked out.');
      const co = sh('Checkouts'), now = new Date(), due = new Date(now.getTime() + days * 864e5);
      const id = 'CO-' + Date.now().toString(36).toUpperCase() + '-' + co.getLastRow();
      co.appendRow([id, roll, rec[0], rec[1], fmt(now), fmt(due), 'No']);
      inv.getRange(r, 6).setValue('No');
      return { checkoutId: id, dueDate: fmt(due) };
    });
  },
  returnBook(p) {
    return locked(() => {
      const co = sh('Checkouts'), r = rowOf(co, p.checkoutId);
      if (r < 0) throw new Error('Checkout not found.');
      const rec = co.getRange(r, 1, 1, 7).getValues()[0];
      if (rec[6] === 'Yes') throw new Error('Already returned.');
      co.getRange(r, 7).setValue('Yes');
      const inv = sh('Inventory'), ir = rowOf(inv, rec[2]);
      if (ir > 0) inv.getRange(ir, 6).setValue('Yes');
      return { returned: true };
    });
  },
  removeBook(p) {
    return locked(() => {
      const s = sh('Inventory'), r = rowOf(s, p.bookId);
      if (r < 0) throw new Error('Book not found.');
      if (s.getRange(r, 6).getValue() === 'No') throw new Error('Cannot remove a book that is checked out.');
      s.deleteRow(r);
      return { deleted: true };
    });
  },
  report(p, role) {
    const types = ['A book is missing', 'Wrong book details', 'Problem with this site', 'Something else'];
    const msg = clean(p.message, 1000);
    if (!msg || types.indexOf(p.type) < 0) throw new Error('Please describe the problem.');
    const c = CacheService.getScriptCache(), k = 'rep_' + p.token, n = +(c.get(k) || 0);
    if (n >= 5) throw new Error('Too many reports. Please try again later.');
    c.put(k, String(n + 1), 3600);
    return locked(() => { repSheet().appendRow(['R-' + Date.now().toString(36).toUpperCase(), fmt(new Date()), role, p.type, msg, clean(p.contact, 80), 'Open']); return { reported: true }; });
  },
  getReports() { repSheet(); return read('Reports'); },
  setReport(p) {
    return locked(() => {
      const s = repSheet(), r = rowOf(s, p.reportId);
      if (r < 0) throw new Error('Report not found.');
      s.getRange(r, 7).setValue(p.status === 'Resolved' ? 'Resolved' : 'Open');
      return { ok: true };
    });
  },
  addGenre(p) {
    const ok = t => /^[a-zA-Z0-9 \/'&.\-]{2,40}$/.test(String(t || '').trim());
    if (!ok(p.genre) || !ok(p.subgenre)) throw new Error('Names may use letters, numbers, spaces and / \' & . - (2–40 characters).');
    return locked(() => { sh('Genres').appendRow([String(p.genre).trim(), String(p.subgenre).trim()]); return { added: true }; });
  }
};

// Run this once from the Apps Script editor to get a password hash (see DEPLOY.md). Edit the text, run, read the Execution log.
function makeHash() { Logger.log(sha('CHANGE-THIS-PASSWORD')); }

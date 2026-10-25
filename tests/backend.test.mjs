import test from 'node:test';
import assert from 'node:assert/strict';
import { createBackend } from './fakes.mjs';

const book = { Title: 'Emma', Author: 'Jane Austen', Genre: 'Fiction', SubGenre: 'Drama', ISBN: '9780141439587' };

test('sign-in returns the library in the same request, and students never get checkouts', () => {
  const b = createBackend();
  const r = b.login({ role: 'student', password: 'pw-student', withData: true });
  assert.ok(r.token); assert.ok(Array.isArray(r.data.inventory)); assert.equal('checkouts' in r.data, false);
  assert.ok(b.login({ role: 'admin', password: 'pw-admin', withData: true }).data.checkouts);
});

test('wrong guesses slow staff logins down but never lock the real person out; the Owner login locks', () => {
  const b = createBackend();
  for (let i = 0; i < 8; i++) assert.throws(() => b.login({ role: 'librarian', password: 'bad' }));
  assert.ok(b.login({ role: 'librarian', password: 'pw-librarian' }).token);
  assert.ok(b.stats.slept > 0);
  for (let i = 0; i < 5; i++) assert.throws(() => b.login({ role: 'admin', password: 'bad' }));
  assert.throws(() => b.login({ role: 'admin', password: 'pw-admin' }), /Too many attempts/);
});

test('a login with a missing or damaged hash says exactly what is wrong; stray spaces are ignored', () => {
  const b = createBackend(); delete b.props.HASH_admin;
  assert.throws(() => b.login({ role: 'admin', password: 'x' }), /HASH_admin is missing/);
  b.props.HASH_admin = 'abc';
  assert.throws(() => b.login({ role: 'admin', password: 'x' }), /looks wrong/);
  const ok = createBackend(); ok.props.HASH_librarian = '  ' + ok.props.HASH_librarian.toUpperCase() + '\n';
  assert.ok(ok.login({ role: 'librarian', password: 'pw-librarian' }).token);
});

test('makeAllHashes prints four hashes that really work for sign-in', () => {
  const b = createBackend(); b.makeAllHashes();
  const lines = b.stats.logs.filter(l => l.startsWith('HASH_'));
  assert.equal(lines.length, 4);
  for (const l of lines) { const [name, hash] = l.split(' = '); b.props[name] = hash; }
  for (const r of ['student', 'librarian', 'principal', 'admin']) assert.ok(b.login({ role: r, password: 'CHANGE-ME' }).token, r);
});

test('checkSetup names the role whose hash a password really matches', () => {
  const b = createBackend();
  b.props.HASH_student = b.pwHash('student', 'CHANGE-THIS-PASSWORD');   // the likely mistake: the Owner hash was made under another role
  b.props.HASH_admin = b.pwHash('student', 'CHANGE-THIS-PASSWORD');
  b.checkSetup();
  assert.ok(b.stats.logs.some(l => l.includes('matches the hash saved for student, admin') || l.includes('matches the hash saved for student')));
  const w = createBackend(); w.props.HASH_admin = 'a'.repeat(64); w.checkSetup();
  assert.ok(w.stats.logs.some(l => l.includes('DOES NOT MATCH any saved hash')));
});

test('the server refuses to run without its Script properties', () => {
  const b = createBackend({ omit: ['SALT'] });
  assert.throws(() => b.login({ role: 'student', password: 'pw-student' }), /not set up/);
});

test('only the librarian can add books (the principal cannot)', () => {
  const b = createBackend();
  assert.equal(b.call(b.signIn('principal'), 'addBook', { book, rid: 'p1' }).error, 'Not allowed.');
  assert.equal(b.call(b.signIn('librarian'), 'addBook', { book, rid: 'p2' }).success, true);
});

test('adding a book is safe to retry: same request id, one row; ids never reuse a removed book', () => {
  const b = createBackend(), lib = b.signIn('librarian'), pri = b.signIn('principal');
  const a1 = b.call(lib, 'addBook', { book, rid: 'r1' }).data, a2 = b.call(lib, 'addBook', { book, rid: 'r1' }).data;
  assert.equal(a1.bookId, a2.bookId); assert.equal(b.sheets.Inventory.rows.length, 2);
  const second = b.call(lib, 'addBook', { book: { ...book, Title: 'Persuasion' }, rid: 'r2' }).data;
  assert.equal(second.bookId, 'FIC-DRA-002');
  assert.equal(b.call(pri, 'removeBook', { bookId: second.bookId }).success, true);
  assert.equal(b.call(lib, 'addBook', { book: { ...book, Title: 'Sense' }, rid: 'r3' }).data.bookId, 'FIC-DRA-003');
});

test('checkout: only the librarian, never twice, and a retry does not repeat it', () => {
  const b = createBackend(), lib = b.signIn('librarian'), pri = b.signIn('principal'), stu = b.signIn('student');
  const id = b.call(lib, 'addBook', { book, rid: 'a' }).data.bookId;
  assert.equal(b.call(pri, 'checkout', { bookId: id, roll: '1' }).error, 'Not allowed.');
  assert.equal(b.call(stu, 'checkout', { bookId: id, roll: '1' }).error, 'Not allowed.');
  const first = b.call(lib, 'checkout', { bookId: id, roll: '1371', days: 14, rid: 'c1' });
  assert.equal(first.success, true);
  assert.deepEqual(b.call(lib, 'checkout', { bookId: id, roll: '1371', days: 14, rid: 'c1' }).data, first.data);
  assert.equal(b.sheets.Checkouts.rows.length, 2);
  assert.match(b.call(lib, 'checkout', { bookId: id, roll: '55', days: 14, rid: 'c2' }).error, /already checked out/);
  assert.equal(b.call(lib, 'returnBook', { checkoutId: first.data.checkoutId, rid: 'x1' }).success, true);
  assert.equal(b.call(lib, 'checkout', { bookId: id, roll: '55', days: 14, rid: 'c3' }).success, true);
});

test('the library data is cached, and any write clears the cache', () => {
  const b = createBackend(), lib = b.signIn('librarian'), id = b.call(b.signIn('librarian'), 'addBook', { book, rid: 'a' }).data.bookId;
  b.stats.reads = 0; b.call(lib, 'getAll'); assert.ok(b.stats.reads > 0);
  b.stats.reads = 0; b.call(b.signIn('student'), 'getAll'); assert.equal(b.stats.reads, 0);
  b.call(lib, 'updateBook', { bookId: id, book: { ...book, Title: 'Emma (2nd ed.)' } });
  b.stats.reads = 0; const r = b.call(lib, 'getAll').data; assert.ok(b.stats.reads > 0);
  assert.equal(r.inventory[0].Title, 'Emma (2nd ed.)');
});

test('the Genres tab is optional', () => {
  const b = createBackend(); delete b.sheets.Genres;
  assert.equal(b.call(b.signIn('student'), 'getAll').success, true);
});

test('reading lists: roll and PIN together; the same PIN works for different rolls', () => {
  const b = createBackend(), t = b.signIn('student');
  assert.equal(b.call(t, 'listOpen', { roll: '1', pin: '1468' }).data.isNew, true);
  assert.equal(b.call(t, 'listOpen', { roll: '54', pin: '1468' }).data.isNew, true);
  b.call(t, 'listToggle', { roll: '1', pin: '1468', bookId: 'FIC-DRA-001', on: true });
  assert.deepEqual(b.call(t, 'listOpen', { roll: '1', pin: '1468' }).data.books, ['FIC-DRA-001']);
  assert.deepEqual(b.call(t, 'listOpen', { roll: '54', pin: '1468' }).data.books, []);
  assert.match(b.call(t, 'listOpen', { roll: '1', pin: '9999' }).error, /Wrong PIN/);
  assert.match(b.call(t, 'listToggle', { roll: '1', pin: '0000', bookId: 'X-1', on: true }).error, /Wrong PIN/);
});

test('reading lists: add and remove one book at a time; a PIN reset keeps the books', () => {
  const b = createBackend(), t = b.signIn('student'), lib = b.signIn('librarian');
  b.call(t, 'listOpen', { roll: '7', pin: '1111' });
  const add = id => b.call(t, 'listToggle', { roll: '7', pin: '1111', bookId: id, on: true }).data.books;
  add('A-1'); add('B-2'); add('A-1');
  assert.deepEqual(add('C-3'), ['B-2', 'A-1', 'C-3']);
  assert.deepEqual(b.call(t, 'listToggle', { roll: '7', pin: '1111', bookId: 'B-2', on: false }).data.books, ['A-1', 'C-3']);
  assert.equal(b.call(t, 'listReset', { roll: '7' }).error, 'Not allowed.');
  assert.equal(b.call(lib, 'listReset', { roll: '7' }).success, true);
  const again = b.call(t, 'listOpen', { roll: '7', pin: '2222' }).data;
  assert.equal(again.isNew, true); assert.deepEqual(again.books, ['A-1', 'C-3']);
});

test('one device cannot create unlimited reading lists', () => {
  const b = createBackend(), t = b.signIn('student');
  let blocked = 0;
  for (let i = 0; i < 8; i++) if (!b.call(t, 'listOpen', { roll: 'R' + i, pin: '1111' }).success) blocked++;
  assert.equal(blocked, 3);
});

test('reports: any login can send, only the Owner can read; bad types are refused', () => {
  const b = createBackend(), stu = b.signIn('student'), pri = b.signIn('principal'), own = b.signIn('admin');
  assert.equal(b.call(stu, 'report', { type: 'Something else', message: 'hello' }).success, true);
  assert.match(b.call(stu, 'report', { type: 'Nope', message: 'x' }).error, /describe/);
  assert.equal(b.call(pri, 'getReports').error, 'Not allowed.');
  assert.equal(b.call(own, 'getReports').data.length, 1);
});

test('spreadsheet formulas typed into a book are neutralised', () => {
  const b = createBackend(), lib = b.signIn('librarian');
  b.call(lib, 'addBook', { book: { ...book, Title: '=HYPERLINK("http://x")' }, rid: 'f' });
  assert.equal(b.sheets.Inventory.rows[1][1][0], "'");
});

test('without a valid sign-in nothing works, and unknown actions are refused', () => {
  const b = createBackend();
  assert.match(b.call('nope', 'getAll').error, /Session expired/);
  assert.equal(b.call(b.signIn('student'), 'doesNotExist').error, 'Not allowed.');
  assert.equal(b.call(undefined, 'ping').success, true);
});

// ───────── Owner tools, "keep me signed in", settings, log, backups ─────────
test('keep me signed in: students only, signed, expiring, and revocable', () => {
  const b = createBackend();
  const s = b.login({ role: 'student', password: 'pw-student', remember: true });
  assert.ok(s.token.startsWith('R.') && s.remember);
  assert.equal(b.call(s.token, 'getAll').success, true);
  assert.ok(!b.login({ role: 'librarian', password: 'pw-librarian', remember: true }).token.startsWith('R.'));   // never for staff
  const last = s.token.slice(-1), tampered = s.token.slice(0, -1) + (last === 'a' ? 'b' : 'a');   // always really different
  assert.match(b.call(tampered, 'getAll').error, /Session expired/);                           // tampered
  assert.equal(b.call(s.token, 'addBook', { book }).error, 'Not allowed.');                                         // it is only a student
  const r = b.resume({ token: s.token });
  assert.ok(r.token.startsWith('R.') && r.data.inventory);
  b.clock.t += 31 * 864e5;
  assert.match(b.call(s.token, 'getAll').error, /Session expired/);                                                // 30 days later
});

test('sign everyone out: old sessions and remembered devices stop; the Owner keeps a fresh sign-in', () => {
  const b = createBackend(), own = b.signIn('admin'), lib = b.signIn('librarian'), rem = b.login({ role: 'student', password: 'pw-student', remember: true }).token;
  const r = b.call(own, 'signOutAll').data;
  assert.match(b.call(lib, 'getAll').error, /Session expired/);
  assert.match(b.call(rem, 'getAll').error, /Session expired/);
  assert.match(b.call(own, 'getReports').error, /Session expired/);
  assert.equal(b.call(r.token, 'getReports').success, true);
});

test('Owner can change passwords: needs the current one, a long enough new one, and the old one stops working', () => {
  const b = createBackend(), own = b.signIn('admin');
  assert.match(b.call(own, 'setPassword', { role: 'librarian', password: 'a-long-new-passphrase', current: 'wrong' }).error, /current Owner password/);
  assert.match(b.call(own, 'setPassword', { role: 'librarian', password: 'short', current: 'pw-admin' }).error, /at least 12/);
  assert.equal(b.call(own, 'setPassword', { role: 'student', password: 'tiny', current: 'pw-admin' }).error, 'Use at least 6 characters for the student password.');
  assert.equal(b.call(own, 'setPassword', { role: 'librarian', password: 'a-long-new-passphrase', current: 'pw-admin' }).success, true);
  assert.throws(() => b.login({ role: 'librarian', password: 'pw-librarian' }), /Incorrect/);
  assert.ok(b.login({ role: 'librarian', password: 'a-long-new-passphrase' }).token);
  assert.ok(b.login({ role: 'principal', password: 'pw-principal' }).token);   // others untouched
  assert.equal(b.call(b.signIn('principal'), 'setPassword', { role: 'student', password: 'whatever1', current: 'x' }).error, 'Not allowed.');
});

test('settings, notice banner and custom quotes reach students; only the Owner can change them', () => {
  const b = createBackend(), own = b.signIn('admin'), stu = b.signIn('student');
  assert.match(b.call(own, 'saveSettings', { settings: { loan_days: '500' } }).error, /not allowed/);
  assert.match(b.call(own, 'saveSettings', { settings: { evil: 'x' } }).error, /Unknown setting/);
  assert.equal(b.call(own, 'saveSettings', { settings: { loan_days: '10', loan_limit: '2', banner_on: 'yes', banner_text: 'Closed on Friday' } }).success, true);
  assert.equal(b.call(own, 'saveQuotes', { quotes: [['Read often.', 'Me'], ['', 'blank'], ['=SUM(1)', 'x']] }).data.saved, 2);
  const s = b.call(stu, 'getAll').data;
  assert.equal(s.settings.banner_text, 'Closed on Friday'); assert.equal(s.settings.loan_limit, '2');
  assert.equal(s.quotes[0][0], 'Read often.'); assert.equal(s.quotes[1][0][0], "'");
  assert.equal(b.call(b.signIn('principal'), 'saveSettings', { settings: { banner_on: 'no' } }).error, 'Not allowed.');
  assert.equal(b.call(stu, 'saveQuotes', { quotes: [] }).error, 'Not allowed.');
});

test('reports: notes are saved; email goes out only when the address has been replaced', () => {
  const off = createBackend(), stu = off.signIn('student'), own = off.signIn('admin');
  off.call(stu, 'report', { type: 'A book is missing', message: 'Wings of Fire' });
  assert.equal(off.stats.mails.length, 0);
  const id = off.call(own, 'getReports').data[0].ReportID;
  off.call(own, 'setReport', { reportId: id, notes: 'Will buy in November' });
  off.call(own, 'setReport', { reportId: id, status: 'Resolved' });
  const row = off.call(own, 'getReports').data[0];
  assert.equal(row.Notes, 'Will buy in November'); assert.equal(row.Status, 'Resolved');
  const on = createBackend({ ownerEmail: 'owner@school.example' });
  on.call(on.signIn('student'), 'report', { type: 'Something else', message: 'Hello', contact: 'roll 5' });
  assert.equal(on.stats.mails.length, 1); assert.equal(on.stats.mails[0].to, 'owner@school.example');
  assert.match(on.stats.mails[0].subject, /Something else/);
});

test('report emails can also be switched on with a Script property', () => {
  const b = createBackend(); b.props.OWNER_EMAIL = 'me@school.example';
  b.call(b.signIn('student'), 'report', { type: 'Something else', message: 'Hi' });
  assert.equal(b.stats.mails.length, 1); assert.equal(b.stats.mails[0].to, 'me@school.example');
});

test('every report sends its own email to the address in the OWNER_EMAIL property', () => {
  const b = createBackend(); b.props.OWNER_EMAIL = '  me@school.example ';
  const stu = b.signIn('student');
  b.call(stu, 'report', { type: 'A book is missing', message: 'Wings of Fire', contact: 'roll 5' });
  b.call(stu, 'report', { type: 'Problem with this site', message: 'Search is slow' });
  assert.equal(b.stats.mails.length, 2);
  assert.ok(b.stats.mails.every(m => m.to === 'me@school.example'));
  assert.match(b.stats.mails[0].subject, /A book is missing/);
  assert.ok(b.stats.mails[0].body.includes('Wings of Fire') && b.stats.mails[0].body.includes('roll 5') && b.stats.mails[0].body.includes('student'));
  b.props.SITE_URL = 'https://lib.example.com/'; b.call(stu, 'report', { type: 'Something else', message: 'Hi' });
  assert.ok(b.stats.mails[2].body.includes('https://lib.example.com/#owner'));
});

test('a failed or impossible email never blocks the report, and the failure shows in the activity log', () => {
  const bad = createBackend({ failMail: true }); bad.props.OWNER_EMAIL = 'me@school.example';
  assert.equal(bad.call(bad.signIn('student'), 'report', { type: 'Something else', message: 'Hi' }).success, true);
  assert.equal(bad.call(bad.signIn('admin'), 'getReports').data.length, 1);
  assert.ok(bad.call(bad.signIn('admin'), 'getLog').data.some(l => l.Action === 'Report email failed' && l.Detail.includes('too many times')));
  const typo = createBackend(); typo.props.OWNER_EMAIL = 'not-an-address';
  typo.call(typo.signIn('student'), 'report', { type: 'Something else', message: 'Hi' });
  assert.ok(typo.call(typo.signIn('admin'), 'getLog').data.some(l => l.Detail.includes('does not look like an email')));
});

test('the Owner can send a test email and sees which address is used (partly hidden)', () => {
  const none = createBackend(), own0 = none.signIn('admin');
  assert.match(none.call(own0, 'sendTestEmail').error, /No email address is set/);
  assert.equal(none.call(own0, 'getAll').data.meta.email, '');
  const b = createBackend(); b.props.OWNER_EMAIL = 'sarah@school.example'; const own = b.signIn('admin');
  assert.equal(b.call(own, 'getAll').data.meta.email, 's***@school.example');
  assert.deepEqual(b.call(own, 'sendTestEmail').data, { sent: true, to: 's***@school.example' });
  assert.equal(b.stats.mails.length, 1);
  assert.equal(b.call(b.signIn('principal'), 'sendTestEmail').error, 'Not allowed.');
});

test('activity log: staff actions are recorded, only the Owner reads it, wrong Owner passwords are noted', () => {
  const b = createBackend(), lib = b.signIn('librarian'), own = b.signIn('admin');
  const id = b.call(lib, 'addBook', { book, rid: 'l1' }).data.bookId;
  b.call(lib, 'checkout', { bookId: id, roll: '1371', days: 7, rid: 'l2' });
  assert.throws(() => b.login({ role: 'admin', password: 'nope' }));
  const log = b.call(own, 'getLog').data, actions = log.map(l => l.Action);
  for (const a of ['Added book', 'Checked out', 'Wrong Owner password', 'Signed in']) assert.ok(actions.includes(a), a);
  assert.ok(log.some(l => l.Who === 'librarian' && l.Detail.includes('roll 1371')));
  assert.equal(b.call(lib, 'getLog').error, 'Not allowed.');
  const before = b.call(own, 'getLog').data.length; b.signIn('student'); assert.equal(b.call(own, 'getLog').data.length, before);   // student sign-ins are not logged
});

test('a missing Google Drive permission is explained in plain words, and authorizeAll reports each service', () => {
  const b = createBackend({ denyDrive: true }), own = b.signIn('admin');
  for (const e of [b.call(own, 'backupNow').error, b.call(own, 'getBackups').error]) { assert.match(e, /Google Drive permission is missing/); assert.match(e, /authorizeAll/); assert.ok(!e.includes('Required permissions')); }
  assert.equal(b.call(own, 'getReports').success, true);   // everything else keeps working
  b.authorizeAll();
  assert.ok(b.stats.logs.some(l => l.startsWith('Google Drive (backups): PROBLEM')));
  const ok = createBackend(); ok.authorizeAll();
  assert.ok(ok.stats.logs.includes('Google Drive (backups): OK') && ok.stats.logs.includes('Email (report emails): OK'));
});

test('backups: a copy is made, only the newest 12 are kept, weekly backup can be switched on and off', () => {
  const b = createBackend(), own = b.signIn('admin');
  assert.match(b.call(own, 'backupNow').data.name, /^Library backup /);
  for (let i = 0; i < 14; i++) b.call(own, 'backupNow');
  assert.equal(b.call(own, 'getBackups').data.backups.length, 10);
  assert.equal(b.drive.files.filter(f => !f.trashed).length, 12);
  assert.equal(b.call(own, 'getBackups').data.weekly, false);
  assert.equal(b.call(own, 'setWeeklyBackup', { on: true }).data.weekly, true); assert.equal(b.triggers.length, 1);
  assert.equal(b.call(own, 'getBackups').data.weekly, true);
  b.call(own, 'setWeeklyBackup', { on: false }); assert.equal(b.triggers.length, 0);
  assert.ok(b.call(own, 'getAll').data.meta.lastBackup);
  assert.equal(b.call(b.signIn('principal'), 'backupNow').error, 'Not allowed.');
});

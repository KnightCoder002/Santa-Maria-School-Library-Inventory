import test from 'node:test';
import assert from 'node:assert/strict';
import { createBackend } from './fakes.mjs';

const book = { Title: 'Emma', Author: 'Jane Austen', Genre: 'Fiction', SubGenre: 'Drama', ISBN: '9780141439587' };

test('sign-in returns the library in the same request, and students never get checkouts', () => {
  const b = createBackend();
  const r = b.login({ role: 'student', password: 'pw-student', withData: true });
  assert.ok(r.token); assert.ok(Array.isArray(r.data.inventory)); assert.equal('checkouts' in r.data, false);
  assert.equal('data' in b.login({ role: 'admin', password: 'pw-admin', withData: true }), false);
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

test('the server refuses to run without its Script properties', () => {
  const b = createBackend({ omit: ['SALT'] });
  assert.throws(() => b.login({ role: 'student', password: 'pw-student' }), /not set up/);
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

import './style.css';
import { api, setToken, lookup, newId, ping } from './api.js';
const scanner = () => import('./scanner.js');   // the scanner is only downloaded when someone scans
import { QUOTES } from './quotes.js';
import { T } from './i18n.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"'`]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' }[c]));
const overLimit = n => { const L = +(S.settings.loan_limit ?? 3); return L > 0 && n >= L; };   // warning only; the Owner sets it under Settings
const FILL = ' fill="currentColor" fill-opacity=".22"';
const P = {
  clock: `<circle cx="12" cy="12" r="9"${FILL}/><path d="M12 7v5l3 2"/>`,
  check: `<circle cx="12" cy="12" r="9"${FILL}/><path d="m8 12.5 3 3 5-6"/>`,
  cog: `<circle cx="12" cy="12" r="3.2"${FILL}/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>`,
  shield: `<path d="M12 3.5 4.5 6.5v5.5c0 4.5 3 7.4 7.5 8.5 4.5-1.1 7.5-4 7.5-8.5V6.5z"${FILL}/><path d="m9 12 2.2 2.2L15.5 10"/>`,
  chevron: `<path d="m6 9 6 6 6-6"/>`,
  home: `<path d="M3.5 11 12 4l8.5 7V20h-17z"${FILL}/><path d="M10 20v-5.5h4V20"/>`,
  out: `<rect x="3.5" y="12" width="17" height="8" rx="2"${FILL}/><path d="M12 15V3.5M7.5 8 12 3.5 16.5 8"/>`,
  ledger: `<rect x="5" y="3.5" width="14" height="17" rx="2"${FILL}/><path d="M8.5 8.5h7M8.5 12.5h7M8.5 16.5h4"/>`,
  books: `<rect x="3.5" y="4" width="5" height="16" rx="1.2"${FILL}/><rect x="10.5" y="4" width="5" height="16" rx="1.2"/><path d="m17.4 6.8 3-1 2.4 13.2-3 .8z"/>`,
  plus: `<circle cx="12" cy="12" r="9"${FILL}/><path d="M12 7.5v9M7.5 12h9"/>`,
  chart: `<rect x="4" y="12" width="4" height="8"${FILL}/><rect x="10" y="7" width="4" height="13"/><rect x="16" y="3.5" width="4" height="16.5"/>`,
  tag: `<path d="M3.5 12.5v-8h8l9 9-8 8z"${FILL}/><circle cx="8" cy="9" r="1.2"/>`,
  flag: `<path d="M5.5 21V4"/><path d="M5.5 5h12l-2.5 4 2.5 4h-12z"${FILL}/>`,
  dice: `<rect x="3.5" y="3.5" width="17" height="17" rx="4"${FILL}/><circle cx="8.5" cy="8.5" r="1.1"/><circle cx="12" cy="12" r="1.1"/><circle cx="15.5" cy="15.5" r="1.1"/>`,
  heart: `<path d="M12 20.5S3.5 15 3.5 8.8A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 8.5 1.8C20.5 15 12 20.5 12 20.5z"${FILL}/>`,
  scan: `<path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16M7.5 12h9"/>`,
  search: `<circle cx="10.5" cy="10.5" r="6.5"${FILL}/><path d="m15.5 15.5 5 5"/>`,
  install: `<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M4.5 19.5h15"/>`,
  display: `<path d="M12 3.5a8.5 8.5 0 0 0 0 17z" fill="currentColor"/><circle cx="12" cy="12" r="8.5"/>`
};
// Bold duotone icons: one set, drawn for this app. `on` fills the shape solid.
const ic = (n, c = 'h-5 w-5', on = false) => `<svg viewBox="0 0 24 24" class="${c} shrink-0" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${on ? P[n].replace('fill-opacity=".22"', 'fill-opacity="1"') : P[n]}</svg>`;
const FIC = ['Historical Fiction', 'Mystery', 'Fantasy', 'Folktale', 'Science Fiction', 'Religious Fiction'];
const NF = ['Biographies', 'Poetry'];
const AGES = ['Junior (Gr. 1–5)', 'Middle (Gr. 6–8)', 'Senior (Gr. 9–12)', 'All Ages'];
const CONDS = ['Good', 'Fair', 'Poor', 'Damaged'];
const LANGS = ['English', 'Tamil', 'Hindi'];
const LANG_CODE = { en: 'English', ta: 'Tamil', hi: 'Hindi' };
const CAT_MAP = [['mystery', 'Mystery'], ['detective', 'Mystery'], ['science fiction', 'Science Fiction'], ['fantasy', 'Fantasy'], ['historical', 'Historical Fiction'],
  ['biograph', 'Biographies'], ['memoir', 'Biographies'], ['poetry', 'Poetry'], ['fairy', 'Folktale'], ['folk', 'Folktale'], ['religio', 'Religious Fiction'], ['christian', 'Religious Fiction']];
const ROLES = {
  student: { get name() { return tr('role_student'); } },
  librarian: { get name() { return tr('role_librarian'); } },
  principal: { get name() { return tr('role_principal'); } },
  admin: { get name() { return tr('role_admin'); } }
};
const TABS = {
  student: [['catalogue', 'tab_cat', 'books'], ['list', 'tab_list', 'heart']],
  staff: [['dashboard', 'Home', 'home'], ['checkout', 'Check out', 'out'], ['records', 'Records', 'ledger'], ['catalogue', 'Books', 'books'], ['add', 'Add', 'plus']]
};

// The owner sign-in has no link anywhere. It opens only at this hidden address, e.g. https://your-site.vercel.app/#owner
// Change the word to something only you know. The password is the real protection; this just keeps the door out of sight.
const OWNER_HASH = '#owner';
addEventListener('hashchange', () => { if (location.hash === OWNER_HASH && !S.role) { S.login = 'admin'; render(); } });
const clearHash = () => history.replaceState(null, '', location.pathname + location.search);
const store = { get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
const S = { role: null, tab: 'catalogue', books: [], checkouts: [], genres: [], q: '', avail: '', fg: [], fs: [], open: null, more: false, lng: '', age: '', editId: null, theme: store.get('theme2', 'light'), display: false, loading: false, loadedAt: 0, list: [], me: null, listLogin: null, surprise: null, report: null, reports: [], canInstall: false, cq: '', rq: '', roll: '', days: 14, pick: null,
  login: null, confirm: null, scanning: false, draft: null, results: [], sticky: { genre: 'Fiction', age: '', cond: 'Good', lang: 'English' } };

const isStaff = () => S.role && S.role !== 'student';
const tabsFor = () => {
  if (S.role === 'student') return TABS.student;
  if (S.role === 'admin') { const n = S.reports.filter(r => r.Status !== 'Resolved').length; return [['overview', 'Overview', 'home'], ['reports', 'Reports' + (n ? ` (${n})` : ''), 'flag'], ['wanted', 'Wanted books', 'books'], ['analytics', 'Stats', 'chart'], ['activity', 'Activity', 'clock'], ['checks', 'Checks', 'check'], ['settings', 'Settings', 'cog'], ['safety', 'Safety', 'shield']]; }
  if (S.role === 'principal') return [...TABS.staff.filter(x => !['checkout', 'add'].includes(x[0])), ['analytics', 'Stats', 'chart'], ['genres', 'Genres', 'tag']];
  return TABS.staff;
};
const tr = k => T.en[k] ?? k;
const subs = g => [...new Set([...(g === 'Fiction' ? FIC : NF), ...S.genres.filter(x => x.Genre === g).map(x => x.SubGenre)])];
const norm = s => String(s || '').toLowerCase().replace(/[\u0300-\u036f]/g, '').replace(/(\d)-(?=\d)/g, '$1').replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
const lev = (a, b) => { if (Math.abs(a.length - b.length) > 2) return 3; let p = Array.from({ length: b.length + 1 }, (_, i) => i); for (let i = 1; i <= a.length; i++) { const c = [i]; for (let j = 1; j <= b.length; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = c; } return p[b.length]; };
// Forgiving search: substring first, then word-by-word with small typo tolerance (works for Tamil/Hindi text too).
const matches = (b, q) => {
  const nq = norm(q); if (!nq) return true;
  const hay = b._h || (b._h = norm([b.Title, b.Author, b.ISBN, b.ContainedWorks].join(' ').replace(/\|/g, ' ')));
  if (hay.includes(nq)) return true;
  const words = b._w || (b._w = hay.split(' '));
  return nq.split(' ').every(tk => words.some(w => w.startsWith(tk) || (tk.length >= 4 && lev(w.slice(0, tk.length), tk) <= (tk.length >= 8 ? 2 : 1))));
};
const parseDay = s => { const m = /^(\d{4})-(\d\d)-(\d\d)/.exec(s || ''); return m ? new Date(+m[1], m[2] - 1, +m[3]) : null; };
const daysLeft = s => { const d = parseDay(s); if (!d) return 0; const n = new Date(); n.setHours(0, 0, 0, 0); return Math.round((d - n) / 864e5); };
const showDate = s => { const d = parseDay(s); return d ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'; };
const state = c => c.Returned === 'Yes' ? 'returned' : daysLeft(c.DueDate) < 0 ? 'overdue' : 'active';
const debounce = (f, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => f(...a), ms); }; };

function toast(msg, type = 'info') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = `show rounded-lg px-4 py-3 text-sm font-medium shadow-lg text-white ${type === 'error' ? 'bg-red-800' : type === 'success' ? 'bg-emerald-700' : 'bg-ink'}`;
  clearTimeout(toast.t); toast.t = setTimeout(() => { t.className = ''; }, 3500);
}

const loadReports = async () => { S.reports = (await api('getReports')).map(r => fill(r, REPORT_KEYS)); };
const BOOK_KEYS = ['BookID', 'Title', 'Author', 'Genre', 'SubGenre', 'Available', 'AgeGroup', 'Condition', 'Language', 'ContainedWorks', 'ISBN', 'DueBack', 'Borrows'];
const CHECKOUT_KEYS = ['CheckoutID', 'RollNumber', 'BookID', 'Title', 'CheckoutDate', 'DueDate', 'Returned'];
const REPORT_KEYS = ['ReportID', 'Date', 'Role', 'Type', 'Message', 'Contact', 'Status', 'Notes'];
const fill = (o, keys) => { const r = { ...o }; keys.forEach(k => { r[k] = r[k] == null ? '' : String(r[k]); }); return r; };
function applyAll(d) {
  // Same rule as your old app: anything that is not exactly 'No' counts as available.
  S.books = (d.inventory || []).filter(b => b.BookID && b.BookID !== 'REMOVED').map(b => ({ ...fill(b, BOOK_KEYS), Available: b.Available === 'No' ? 'No' : 'Yes' }));
  S.checkouts = (d.checkouts || []).map(c => fill(c, CHECKOUT_KEYS));
  S.genres = (d.genres || []).map(g => fill(g, ['Genre', 'SubGenre']));
  S.settings = d.settings || {}; S.quotesCustom = d.quotes || []; S.meta = d.meta || {};
  if (!S.daysTouched) S.days = +S.settings.loan_days || 14;
  S.loadedAt = Date.now();
}
// Loads the library once, then reuses it for 45 seconds. Saves update the screen directly, so no reload is needed after them.
let loadP = null;
function load({ force = false } = {}) {
  if (!force && S.loadedAt && Date.now() - S.loadedAt < 45000) return Promise.resolve();
  return loadP || (loadP = api('getAll').then(applyAll).finally(() => { loadP = null; }));
}

// ───────── Views ─────────
const bookCard = (b, extra = '') => {
  const works = String(b.ContainedWorks || '').split('|').filter(Boolean);
  const sgs = String(b.SubGenre || '').split('|').filter(Boolean).map(s => `<span class="pill">${esc(s)}</span>`).join(' ');
  return `<li class="card reveal flex items-start justify-between gap-3">
    <div class="min-w-0"><p class="font-semibold text-navy">${esc(b.Title)}${works.length ? ` <span class="pill">${works.length} works</span>` : ''}</p>
    <p class="text-sm text-slate-500">${esc(b.Author)} · <code class="text-xs">${esc(b.BookID)}</code></p>
    <div class="mt-2 flex flex-wrap gap-1">${sgs}${b.Language ? `<span class="pill">${esc(b.Language)}</span>` : ''}</div></div>
    <div class="flex shrink-0 flex-col items-end gap-2"><span class="pill ${b.Available === 'Yes' ? 'ok' : 'warn'}">${b.Available === 'Yes' ? tr('available') : tr('out')}</span>${b.Available === 'No' && b.DueBack ? `<span class="text-xs text-slate-500">${tr('back')} ${showDate(b.DueBack)}</span>` : ''}${extra}</div></li>`;
};
const empty = t => `<li class="card text-center text-slate-500 col-span-full">${t}</li>`;

const bookList = () => {
  const ul = (inner, cls = '') => `<ul class="grid gap-3 sm:grid-cols-2 ${cls}">${inner}</ul>`;
  if (S.loading) return ul(Array.from({ length: 6 }, () => '<li class="card h-24 animate-pulse bg-stone-100"></li>').join(''));
  const q = S.q.toLowerCase().trim();
  const rows = S.books.filter(b => matches(b, q) && (!S.avail || b.Available === S.avail) && (!S.fg.length || S.fg.includes(b.Genre)) && (!S.fs.length || S.fs.some(x => String(b.SubGenre || '').split('|').includes(x))) && (!S.lng || b.Language === S.lng) && (!S.age || b.AgeGroup === S.age)).slice(0, 400);
  if (!rows.length) return ul(noMatch());
  const acts = b => (S.role === 'student' ? favBtn(b) : '') + (isStaff() ? `<button class="btn !px-2.5 !py-1 text-xs" data-act="edit" data-tip="Edit this book" data-id="${esc(b.BookID)}">Edit</button>` : '') + (S.role === 'principal' && b.Available === 'Yes' ? `<button class="btn-red !px-2.5 !py-1 text-xs" data-act="ask-remove" data-tip="Remove this book from the library" data-id="${esc(b.BookID)}">Remove</button>` : '');
  const cards = rows.map(b => bookCard(b, acts(b))).join('');
  if (!isStaff()) return ul(cards);
  // Staff on a desktop get a dense table; phones and tablets get the cards.
  const td = 'px-3 py-2';
  const trs = rows.map(b => `<tr class="border-b border-stone-100"><td class="${td} font-mono text-xs">${esc(b.BookID)}</td><td class="${td} font-bold">${esc(b.Title)}</td><td class="${td}">${esc(b.Author)}</td><td class="${td}">${esc(String(b.SubGenre || '').split('|').join(', '))}</td><td class="${td}">${esc(b.Language || '')}</td>
    <td class="${td}"><span class="pill ${b.Available === 'Yes' ? 'ok' : 'warn'}">${b.Available === 'Yes' ? tr('available') : tr('out')}</span>${b.Available === 'No' && b.DueBack ? `<span class="ml-2 text-xs text-slate-500">${showDate(b.DueBack)}</span>` : ''}</td><td class="${td}"><div class="flex justify-end gap-2">${acts(b)}</div></td></tr>`).join('');
  return ul(cards, 'lg:hidden') + `<div class="card hidden overflow-x-auto !p-0 lg:block"><table class="w-full text-left text-sm"><thead class="bg-ink text-white"><tr>${['ID', 'Title', 'Author', 'Sub-genres', 'Language', 'Status', ''].map(h => `<th class="px-3 py-2.5 font-bold">${h}</th>`).join('')}</tr></thead><tbody>${trs}</tbody></table></div>` + (S.books.length > 400 && rows.length === 400 ? '<p class="mt-2 text-sm text-slate-500">Showing the first 400. Search to narrow down.</p>' : '');
};
const checkoutList = () => {
  const q = S.cq.toLowerCase().trim();
  if (!q) return empty('Type a title or author to find a book.');
  const rows = S.books.filter(b => b.Available === 'Yes' && matches(b, q)).slice(0, 30);
  return rows.length ? rows.map(b => bookCard(b, `<button class="btn-gold !py-1 text-xs" data-act="pick" data-tip="Choose this book" data-id="${esc(b.BookID)}">Select</button>`)).join('') : empty('No available copy found.');
};
const recordList = () => {
  const rows = filteredRecords().slice(0, 300);
  if (!rows.length) return `<ul class="grid gap-3">${empty('No records yet.')}</ul>`;
  const chip = c => { const st = state(c), d = daysLeft(c.DueDate); return st === 'returned' ? '<span class="pill">Returned</span>' : st === 'overdue' ? `<span class="pill bad">${-d}d overdue</span>` : `<span class="pill ${d <= 3 ? 'warn' : 'ok'}">Due in ${d}d</span>`; };
  const ret = c => state(c) !== 'returned' ? `<button class="btn-gold !min-h-9 !py-1 text-xs" data-act="return" data-tip="Mark this book as returned" data-id="${esc(c.CheckoutID)}">Return</button>` : '';
  const cards = rows.map(c => `<li class="card flex items-center justify-between gap-3"><div class="min-w-0"><p class="font-bold text-navy">${esc(titleOf(c))}</p><p class="text-sm text-slate-500">Roll ${esc(c.RollNumber)}, out ${showDate(c.CheckoutDate)}, due ${showDate(c.DueDate)}</p></div><div class="flex flex-col items-end gap-2">${chip(c)}${ret(c)}</div></li>`).join('');
  const td = 'px-3 py-2';
  const trs = rows.map(c => `<tr class="border-b border-stone-100"><td class="${td} font-bold">${esc(c.RollNumber)}</td><td class="${td}">${esc(titleOf(c))}</td><td class="${td} font-mono text-xs">${esc(c.BookID)}</td><td class="${td}">${showDate(c.CheckoutDate)}</td><td class="${td}">${showDate(c.DueDate)}</td><td class="${td}">${chip(c)}</td><td class="${td} text-right">${ret(c)}</td></tr>`).join('');
  return `<ul class="grid gap-3 lg:hidden">${cards}</ul><div class="card hidden overflow-x-auto !p-0 lg:block"><table class="w-full text-left text-sm"><thead class="bg-ink text-white"><tr>${['Roll no.', 'Book', 'Book ID', 'Checked out', 'Due', 'Status', ''].map(h => `<th class="px-3 py-2.5 font-bold">${h}</th>`).join('')}</tr></thead><tbody>${trs}</tbody></table></div>`;
};

const favBtn = (b, c = '!px-2.5 !py-1 text-xs') => `<button class="btn ${c}" data-act="fav" data-tip="Save to, or remove from, my reading list" data-id="${esc(b.BookID)}">${ic('heart', 'h-4 w-4', S.list.includes(b.BookID))} ${S.list.includes(b.BookID) ? tr('saved') : tr('save')}</button>`;
const noMatch = () => `<li class="card col-span-full text-center text-slate-600">${tr('nomatch')}<br><button class="btn mt-3" data-act="report-open" data-tip="Report a problem or a missing book" data-id="t_missing">${ic('flag')} ${tr('report')}</button></li>`;
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone;
const installBlock = () => standalone() ? '' : S.canInstall ? `<div class="mt-8 text-center md:hidden"><button class="btn-gold" data-act="install" data-tip="Add this site to your home screen">${ic('install')} ${tr('install')}</button></div>` : /iphone|ipad|ipod/i.test(navigator.userAgent) ? `<p class="mt-8 text-center text-sm text-white/60">${tr('iosHint')}</p>` : '';
const daySeed = () => { const d = new Date(); return d.getFullYear() * 400 + d.getMonth() * 32 + d.getDate(); };
const TILES = ['tile-b', 'tile-c', 'tile-a', 'tile-e'];
const discover = () => {
  const open = S.books.filter(b => b.Available === 'Yes'), b = open.length ? open[daySeed() % open.length] : null, qq = pickQuote(), banner = S.settings.banner_on === 'yes' ? S.settings.banner_text || '' : '';
  const sgs = b ? String(b.SubGenre || '').split('|').filter(Boolean).map(s => `<span class="pill">${esc(s)}</span>`).join('') : '';
  const count = {}; S.books.forEach(x => String(x.SubGenre || '').split('|').filter(Boolean).forEach(g => { count[g] = (count[g] || 0) + 1; }));
  const genres = Object.entries(count).sort((x, y) => y[1] - x[1]).slice(0, S.role === 'student' ? 7 : 8);
  return `<section class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">${banner ? `<div class="card tile-d col-span-2 sm:col-span-4"><h2 class="font-display text-xl">Notice</h2><p class="mt-1 text-lg">${esc(banner)}</p></div>` : ''}
    <div class="card tile-e relative col-span-2 flex flex-col justify-between gap-8 overflow-hidden sm:col-span-4 sm:flex-row sm:items-end"><img src="/school.jpg" alt="" data-hide-on-error class="absolute inset-0 h-full w-full object-cover opacity-20">
      <div class="relative"><h2 class="font-display text-4xl leading-tight sm:text-6xl">${tr('hero')}</h2><p class="mt-2 text-white/80">${S.books.length} ${tr('booksWord')}, ${open.length} ${tr('availnow')}</p></div>
      <button data-act="surprise" data-tip="Pick a random available book for me" class="btn-gold relative shrink-0">${ic('dice')} ${tr('surprise')}</button></div>
    ${b ? `<div class="card tile-d ${qq ? 'col-span-2' : 'col-span-2 sm:col-span-4'}"><h2 class="font-display text-xl">${tr('bod')}</h2><p class="font-display mt-3 text-3xl leading-tight">${esc(b.Title)}</p><p class="mt-1">${esc(b.Author)}</p><div class="mt-3 flex flex-wrap gap-1">${sgs}<span class="pill ok">${tr('availnow')}</span></div></div>` : ''}
    ${qq ? `<div class="card tile-a col-span-2"><h2 class="font-display text-xl">${tr('quote')}</h2><p class="mt-3 text-lg leading-snug">${esc(qq[0])}</p><p class="mt-2 text-sm text-white/80">${esc(qq[1])}</p></div>` : ''}
    ${genres.map(([g, n], i) => `<button data-act="sg" data-id="${esc(g)}" class="card ${TILES[i % 4]} flex min-h-28 flex-col justify-between text-left"><span class="font-display text-2xl leading-tight">${esc(g)}</span><span class="text-sm">${n} ${tr('booksWord')}</span></button>`).join('')}
    ${S.role === 'student' ? `<button data-act="tab" data-id="list" data-tip="See the books I saved" class="card tile-d flex min-h-28 flex-col justify-between text-left">${ic('heart', 'h-8 w-8')}<span class="font-display text-2xl">${tr('tab_list')}${S.me ? ' (' + S.list.length + ')' : ''}</span></button>` : ''}</section>`;
};
const tabTip = id => ({ dashboard: 'Overview of today', checkout: 'Lend a book to a student or teacher', records: 'All checkouts and returns', catalogue: 'Browse and search all books', add: 'Add new books by scanning or typing', analytics: 'Charts and statistics', genres: 'Add genres and sub-genres', reports: 'Problems reported by users', list: 'Books I saved', overview: 'The state of the library at a glance', wanted: 'Books students asked for', activity: 'Who did what, and when', checks: 'Find problems in the books and checkouts', settings: 'Notice, loan rules and quotes', safety: 'Passwords, sign-outs and backups' })[id] || '';
const toggle = (a, x) => a.includes(x) ? a.filter(y => y !== x) : [...a, x];
const subOptions = () => [...new Set(S.books.filter(b => !S.fg.length || S.fg.includes(b.Genre)).flatMap(b => String(b.SubGenre || '').split('|').filter(Boolean)))].sort();
const keepScroll = () => { const t = document.querySelector('[id^="dd-"]')?.scrollTop || 0; return () => { const e = document.querySelector('[id^="dd-"]'); if (e) e.scrollTop = t; }; };
const dd = (key, label, items, sel) => `<div class="sm:relative"><button class="btn !min-h-10 ${sel.length ? '!bg-gold !text-ink' : ''}" data-act="dd" data-id="${key}" data-tip="Choose one or more ${label.toLowerCase()}s" aria-expanded="${S.open === key}">${label}${sel.length ? ' (' + sel.length + ')' : ''}${ic('chevron', 'h-4 w-4')}</button>${S.open === key ? `<div id="dd-${key}" class="absolute inset-x-0 z-30 mt-2 max-h-72 overflow-y-auto rounded-xl border-2 border-stone-300 bg-surface p-2 shadow-lg sm:inset-x-auto sm:left-0 sm:w-72">${items.length ? items.map(x => `<label class="flex min-h-10 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-stone-100"><input type="checkbox" class="h-5 w-5" style="accent-color:#c9a84c" data-act="${key === 'g' ? 'fg' : 'fs'}" data-id="${esc(x)}" ${sel.includes(x) ? 'checked' : ''}>${esc(x)}</label>`).join('') : '<p class="p-2 text-sm text-slate-500">Nothing to choose yet.</p>'}</div>` : ''}</div>`;
const filterBar = () => {
  const genres = [...new Set(S.books.map(b => b.Genre).filter(Boolean))].sort(), any = S.fg.length || S.fs.length || S.lng || S.age || S.avail;
  const sel = (id, label, opts, cur) => `<select id="${id}" class="input !min-h-10 !w-auto !py-1.5 text-sm" aria-label="${label}"><option value="">${label}: all</option>${opts.map(o => `<option ${o === cur ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  return `<div class="relative mt-2 flex flex-wrap items-center gap-2">${dd('g', 'Genre', genres, S.fg)}${dd('s', 'Sub-genre', subOptions(), S.fs)}<button class="btn !min-h-10" data-act="more" data-tip="Show language and age group filters" aria-expanded="${S.more}">More filters${ic('chevron', 'h-4 w-4')}</button>${any ? '<button class="btn !min-h-10" data-act="clear-all" data-tip="Remove every filter">Clear all</button>' : ''}</div>${S.more ? `<div class="mt-2 flex flex-wrap gap-2">${sel('lng-sel', 'Language', LANGS, S.lng)}${sel('age-sel', 'Age group', AGES, S.age)}</div>` : ''}`;
};
let tmap = null, tmapFor = null, tmapN = -1;
const titleOf = c => {   // a checkout shows the book's current title, so edits to a title reach old records too
  if (tmapFor !== S.books || tmapN !== S.books.length) { tmap = new Map(S.books.map(b => [b.BookID, b])); tmapFor = S.books; tmapN = S.books.length; }
  return tmap.get(c.BookID)?.Title || c.Title || '';
};
const isoDay = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const spark = v => { const mx = Math.max(1, ...v), pts = v.map((n, i) => `${(i / (v.length - 1)) * 120},${36 - (n / mx) * 32}`).join(' '); return `<svg viewBox="0 0 120 40" class="h-12 w-32 text-gold" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><polyline points="${pts}"/></svg>`; };
const strip = (title, books) => books.length ? `<section class="mb-6"><h2 class="font-display mb-2 text-2xl text-navy">${title}</h2><ul class="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">${books.map(b => `<li class="card w-44 shrink-0 !p-3"><p class="line-clamp-2 font-bold text-navy">${esc(b.Title)}</p><p class="line-clamp-1 text-sm text-slate-500">${esc(b.Author)}</p><span class="pill mt-2 ${b.Available === 'Yes' ? 'ok' : 'warn'}">${b.Available === 'Yes' ? tr('available') : tr('out')}</span></li>`).join('')}</ul></section>` : '';
const strips = () => strip(tr('newArr'), S.books.slice(-8).reverse()) + strip(tr('mostB'), S.books.filter(b => +b.Borrows > 0).sort((a, b) => b.Borrows - a.Borrows).slice(0, 8));
const neverBorrowed = () => { const seen = new Set(S.checkouts.map(c => c.BookID)); return S.books.filter(b => !seen.has(b.BookID)); };
const loansOf = r => S.checkouts.filter(c => r && c.RollNumber === r && c.Returned !== 'Yes');
const loansBox = () => { const r = S.roll.trim(), l = loansOf(r); if (!r) return ''; const over = l.filter(c => daysLeft(c.DueDate) < 0).length; return `<div class="card mb-4 ${over || overLimit(l.length) ? 'border-2 border-red-600' : ''}"><p class="font-bold text-navy">Roll ${esc(r)} has ${l.length} ${l.length === 1 ? 'book' : 'books'} out${over ? `, ${over} overdue` : ''}</p>${l.map(c => `<p class="text-sm text-slate-500">${esc(titleOf(c))}, due ${showDate(c.DueDate)}</p>`).join('')}</div>`; };
const recentRolls = () => { const r = store.get('rolls', []); return r.length ? `<div class="mb-3 flex flex-wrap gap-2">${r.map(x => `<button class="pill !min-h-9 !px-3" data-act="roll" data-tip="Use this roll number" data-id="${esc(x)}">${esc(x)}</button>`).join('')}</div>` : ''; };
const overdueText = () => { const by = {}; S.checkouts.filter(c => state(c) === 'overdue').forEach(c => (by[c.RollNumber] ||= []).push(c)); return Object.entries(by).map(([r, l]) => `Roll ${r}: ` + l.map(c => `${titleOf(c)} (due ${showDate(c.DueDate)}, ${-daysLeft(c.DueDate)} days late)`).join('; ')).join('\n'); };
const queued = () => store.get('queue', []);
const retry = async fn => { try { return await fn(); } catch (e) { if (!e.offline) throw e; await new Promise(r => setTimeout(r, 1500)); return fn(); } };
let listChain = Promise.resolve(), saveChain = Promise.resolve(), savingCount = 0;
const showSaving = () => { const el = $('#saving'); if (!el) return; el.classList.toggle('hidden', !savingCount); el.textContent = savingCount ? `Saving ${savingCount}...` : ''; };
const draftFromBook = b => ({ ...b, SubGenre: String(b.SubGenre || '').split('|').filter(Boolean) });
function saveBook(book, rid, row) {
  savingCount++; showSaving();
  saveChain = saveChain.then(async () => {
    try { const r = await retry(() => api('addBook', { book, rid })); row.BookID = r.bookId; }
    catch (e) {
      if (e.offline) { row.BookID = '(waiting to sync)'; store.set('queue', [...queued(), { book, rid }]); toast('No connection. Saved on this phone, it will sync when you are online.', 'info'); }
      else { S.books = S.books.filter(x => x !== row); if (!S.draft.Title) S.draft = draftFromBook(book); toast(`Could not save "${book.Title}": ${e.message}`, 'error'); }
    } finally { savingCount--; showSaving(); if (!S.scanning && S.tab === 'catalogue') refreshList('#list', bookList); }
  });
}
addEventListener('beforeunload', e => { if (savingCount) { e.preventDefault(); e.returnValue = ''; } });
async function syncQueue() {
  let q = queued(); if (!q.length || S.role !== 'librarian') return;
  try {
    while (q.length) { const it = q[0].book ? q[0] : { book: q[0], rid: newId() }; await api('addBook', { book: it.book, rid: it.rid }); q = q.slice(1); store.set('queue', q); }
    toast('Saved books synced.', 'success'); await load({ force: true }); render();
  } catch {}
}

const tally = a => { const m = {}; a.forEach(k => { if (k) m[k] = (m[k] || 0) + 1; }); return Object.entries(m).sort((x, y) => y[1] - x[1]).slice(0, 8); };
const bars = rows => { const mx = Math.max(1, ...rows.map(r => r[1])); return rows.length ? rows.map(([k, n]) => `<div class="mb-2"><div class="flex justify-between gap-2 text-sm"><span class="truncate">${esc(k)}</span><span>${n}</span></div><div class="h-2 rounded bg-stone-100"><div class="h-2 rounded bg-ink" style="width:${n / mx * 100}%"></div></div></div>`).join('') : '<p class="text-sm text-slate-500">No data yet.</p>'; };

// ── Stats page helpers ──
const PALETTE = ['#c9a84c', '#3b7dd8', '#4f9a5f', '#c25555', '#9aa0b8'];
const count = a => Object.entries(a.filter(Boolean).reduce((m, k) => (m[k] = (m[k] || 0) + 1, m), {})).sort((x, y) => y[1] - x[1]);
const nothing = '<p class="text-sm text-slate-500">Nothing to show yet.</p>';
const rankList = (rows, total) => rows.length ? `<ol>${rows.map(([name, n], i) => `<li class="flex items-center gap-3 border-b border-stone-100 py-2 last:border-0"><span class="grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${i === 0 ? 'bg-gold text-ink' : 'bg-stone-100'}">${i + 1}</span><div class="min-w-0 flex-1"><p class="truncate text-sm font-bold">${esc(name)}</p><div class="mt-1 h-1.5 rounded bg-stone-100"><div class="h-1.5 rounded bg-gold" style="width:${Math.max(4, n / rows[0][1] * 100)}%"></div></div></div><span class="shrink-0 text-sm font-bold">${n}${total ? ` <span class="font-normal text-slate-500">${Math.round(n / total * 100)}%</span>` : ''}</span></li>`).join('')}</ol>` : nothing;
const splitBar = rows => {
  const t = rows.reduce((a, r) => a + r[1], 0); if (!t) return nothing;
  return `<div class="flex h-4 overflow-hidden rounded-full bg-stone-100" role="img" aria-label="${esc(rows.map(r => r[0] + ' ' + r[1]).join(', '))}">${rows.map(([n, c], i) => `<div style="width:${c / t * 100}%;background:${PALETTE[i % 5]}" title="${esc(n)}: ${c}"></div>`).join('')}</div>
    <ul class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">${rows.map(([n, c], i) => `<li class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-full" style="background:${PALETTE[i % 5]}"></span>${esc(n)} <b>${c}</b> <span class="text-slate-500">${Math.round(c / t * 100)}%</span></li>`).join('')}</ul>`;
};
const columnChart = (items, hi, W = 600) => {   // items: [label, small label, value]; W is the drawing width (narrower = bigger text)
  const max = Math.max(1, ...items.map(i => i[2])), w = W / items.length;
  return `<svg viewBox="0 0 ${W} 230" class="w-full text-slate-600" role="img" aria-label="Column chart"><line x1="0" y1="190" x2="${W}" y2="190" stroke="currentColor" stroke-opacity=".3"/>${items.map(([l, sub, v], i) => {
    const h = v / max * 150, x = i * w + w * .18, cx = i * w + w / 2;
    return `<g><title>${esc(l)} ${esc(sub)}: ${v}</title><rect x="${x}" y="${190 - h}" width="${w * .64}" height="${Math.max(h, v ? 2 : 0)}" rx="4" style="fill:${i === hi ? 'var(--color-navy)' : '#c9a84c'}"/><text x="${cx}" y="${182 - h}" text-anchor="middle" font-size="13" font-weight="700" fill="currentColor">${v || ''}</text><text x="${cx}" y="208" text-anchor="middle" font-size="12" fill="currentColor">${esc(l)}</text><text x="${cx}" y="223" text-anchor="middle" font-size="10" fill="currentColor" fill-opacity=".7">${esc(sub)}</text></g>`;
  }).join('')}</svg>`;
};

const views = {
  catalogue: () => `${!S.q && !S.avail && !S.fg.length && !S.fs.length && !S.lng && !S.age ? discover() + strips() : ''}<div class="flex items-center justify-between gap-3"><h1 class="h1">${S.role === 'student' ? tr('title') : 'Books'}</h1></div>
    <div class="sticky top-14 z-10 -mx-4 bg-parchment/95 px-4 py-2 sm:static sm:mx-0 sm:px-0"><div class="flex gap-2"><input id="q" class="input flex-1" placeholder="${esc(tr('search'))}" value="${esc(S.q)}">
    <select id="avail" class="input !w-auto"><option value="">${tr('all')}</option><option value="Yes" ${S.avail === 'Yes' ? 'selected' : ''}>${tr('available')}</option><option value="No" ${S.avail === 'No' ? 'selected' : ''}>${tr('out')}</option></select></div>${filterBar()}</div>
    <div id="list" class="mt-2">${bookList()}</div>`,

  checkout: () => {
    const b = S.books.find(x => x.BookID === S.pick);
    return `<h1 class="h1">Check out a book</h1><div class="card my-4 grid gap-3 sm:grid-cols-2">
      <div><label class="label" for="roll">Roll number</label><input id="roll" class="input" inputmode="text" value="${esc(S.roll)}" placeholder="e.g. 1371"></div>
      <div><label class="label" for="days">Loan days</label><input id="days" type="number" min="1" max="90" class="input" value="${S.days}"></div></div>${recentRolls()}<div id="loans">${loansBox()}</div>
      ${b ? `<div class="card mb-4 border-gold"><p class="label">Selected</p><p class="font-semibold text-navy">${esc(b.Title)}</p><p class="text-sm text-slate-500">${esc(b.Author)} · ${esc(b.BookID)}</p></div>` : `
      <input id="cq" class="input mb-3" placeholder="Search for the book to lend" value="${esc(S.cq)}"><ul id="clist" class="mb-4 grid gap-3">${checkoutList()}</ul>`}
      <button class="btn-gold w-full" data-act="checkout" data-tip="Lend the selected book to this roll number">Confirm check out</button>
      ${b ? `<button class="btn mt-2 w-full" data-act="unpick" data-tip="Pick a different book">Choose a different book</button>` : ''}`;
  },

  records: () => `${recordsHead()}${filteredRecords().length > 300 ? '<p class="mt-2 text-sm text-slate-500">Showing the newest 300. Export to get every record.</p>' : ''}<div id="rlist" class="mt-3">${recordList()}</div>`,

  list: () => {
    if (!S.me) return `<h1 class="h1">${tr('tab_list')}</h1><div class="card mt-4 max-w-md"><p class="font-bold text-navy">Your reading list is private.</p><p class="mt-1 text-sm text-slate-500">Open it with your roll number and a 4-digit PIN. It works on any device.</p><button class="btn-gold mt-4" data-act="list-open" data-tip="Open or create your reading list">Open my list</button></div>`;
    const rows = S.list.map(id => S.books.find(b => b.BookID === id)).filter(Boolean);
    return `<div class="flex flex-wrap items-center justify-between gap-3"><h1 class="h1">${tr('tab_list')}</h1><div class="flex items-center gap-3 text-sm text-slate-500">Roll ${esc(S.me.roll)}<button class="btn !min-h-9" data-act="list-lock" data-tip="Lock your list on this device">Lock</button></div></div><ul class="mt-4 grid gap-3 sm:grid-cols-2">${rows.length ? rows.map(b => bookCard(b, favBtn(b))).join('') : empty(tr('emptylist'))}</ul>`;
  },
  analytics: () => {
    const c = S.checkouts, by = Object.fromEntries(S.books.map(b => [b.BookID, b])), now = new Date();
    if (!c.length) return `<h1 class="h1">Analytics</h1><div class="card mt-4 max-w-md"><p class="font-bold text-navy">No checkouts yet.</p><p class="mt-1 text-sm text-slate-500">Charts appear after the first book is checked out.</p></div>`;
    const key = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, perMonth = {};
    c.forEach(x => { const m = x.CheckoutDate.slice(0, 7); if (m) perMonth[m] = (perMonth[m] || 0) + 1; });
    const months = Array.from({ length: 12 }, (_, i) => { const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1); return [d.toLocaleDateString('en-IN', { month: 'short' }), i === 0 || d.getMonth() === 0 ? String(d.getFullYear()) : '', perMonth[key(d)] || 0]; });
    const thisM = months[11][2], diff = thisM - months[10][2];
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], perDay = [0, 0, 0, 0, 0, 0, 0];
    c.forEach(x => { const d = parseDay(x.CheckoutDate); if (d) perDay[(d.getDay() + 6) % 7]++; });
    const busiest = perDay.indexOf(Math.max(...perDay)), act = c.filter(x => x.Returned !== 'Yes'), late = act.filter(x => daysLeft(x.DueDate) < 0).length;
    const subs = c.flatMap(x => String((by[x.BookID] || {}).SubGenre || '').split('|').filter(Boolean));
    const tile = (label, value, sub, bt) => `<div class="card ${bt} flex flex-col justify-between"><p class="text-sm font-bold text-slate-600">${label}</p><p class="font-display mt-3 text-4xl font-bold">${value}</p><p class="mt-1 text-sm text-slate-500">${sub}</p></div>`;
    const box = (title, inner, span = '') => `<div class="card ${span}"><h2 class="mb-3 font-display text-xl text-navy">${title}</h2>${inner}</div>`;
    return `<div class="flex flex-wrap items-center justify-between gap-3"><h1 class="h1">Analytics</h1><button class="btn" data-act="csv" data-tip="Download all checkouts as a spreadsheet file">${ic('install')} Export checkouts (CSV)</button></div>
    <div class="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">${tile('All-time checkouts', c.length, 'since this system started', 'bt-a')}${tile('This month', thisM, diff === 0 ? 'same as last month' : `${diff > 0 ? '+' : ''}${diff} vs last month`, 'bt-b')}${tile('Readers', new Set(c.map(x => x.RollNumber).filter(Boolean)).size, 'different roll numbers', 'bt-e')}${tile('Out right now', act.length, late ? `${late} overdue` : 'none overdue', late ? 'bt-c' : 'bt-d')}</div>
    <div class="mt-3 grid gap-3 lg:grid-cols-3">
      ${box('Checkouts per month', `<div class="scroll-end overflow-x-auto"><div class="min-w-[520px] lg:min-w-0">${columnChart(months, 11)}</div></div>`, 'lg:col-span-2')}
      ${box('Busiest days', columnChart(dayNames.map((n, i) => [n, '', perDay[i]]), busiest, 280) + `<p class="mt-1 text-sm text-slate-500">Most checkouts happen on ${dayNames[busiest]}.</p>`)}
      ${box('Most borrowed books', rankList(tally(c.map(titleOf))), 'lg:col-span-2')}
      ${box('Fiction and non-fiction', splitBar(count(c.map(x => (by[x.BookID] || {}).Genre))))}
      ${box('Popular sub-genres', rankList(tally(subs), subs.length), 'lg:col-span-2')}
      ${box('Most active readers', rankList(tally(c.map(x => x.RollNumber ? 'Roll ' + x.RollNumber : ''))))}
    </div>`;
  },
  genres: () => `<h1 class="h1">Genres</h1><div class="mt-4 grid gap-4 sm:grid-cols-2"><div class="card grid gap-3"><div><label class="label" for="g-parent">Parent genre</label><select id="g-parent" class="input"><option>Fiction</option><option>Non-Fiction</option></select></div>
    <div><label class="label" for="g-name">New sub-genre</label><input id="g-name" class="input"></div><button class="btn-gold" data-act="addgenre" data-tip="Add this sub-genre">Add sub-genre</button></div>
    <div class="card">${['Fiction', 'Non-Fiction'].map(g => `<p class="label">${g}</p><div class="mb-3 flex flex-wrap gap-1">${subs(g).map(s => `<span class="pill">${esc(s)}</span>`).join('')}</div>`).join('')}</div></div>`,

  add: () => {
    const d = S.draft, dup = d.ISBN && S.books.filter(b => b.ISBN === d.ISBN);
    const opts = (arr, v) => arr.map(x => `<option ${x === v ? 'selected' : ''}>${esc(x)}</option>`).join('');
    return `<h1 class="h1">${S.editId ? 'Edit book ' + esc(S.editId) : 'Add books'}</h1>${S.editId ? '' : '<button class="btn-gold mt-4 w-full !py-4 text-base" data-act="scan" data-tip="Scan a book barcode with the camera">' + ic('scan') + ' Scan ISBN barcode</button><p class="my-2 text-center text-sm text-slate-500">No barcode, or the scan finds nothing? Type the title and author, then tap Look up.</p>'}
    ${queued().length ? `<p class="card mt-3 text-sm font-bold">${queued().length} saved on this phone, waiting to sync.</p>` : ''}<div class="card mt-3 grid gap-3">
      <div><label class="label" for="f-title">Title</label><input id="f-title" class="input" value="${esc(d.Title)}"></div>
      <div><label class="label" for="f-author">Author</label><input id="f-author" class="input" value="${esc(d.Author)}"></div>
      <div><label class="label" for="f-isbn">ISBN <span class="font-normal">(optional)</span></label><input id="f-isbn" class="input" inputmode="numeric" value="${esc(d.ISBN)}"></div>
      <button class="btn" data-act="search" data-tip="Look up this book online">${ic('search')} Look up details online</button>
      ${S.results.length ? `<ul class="grid gap-2">${S.results.map((r, i) => `<li><button class="card w-full text-left hover:border-gold" data-act="use" data-tip="Use this match" data-id="${i}"><span class="font-semibold text-navy">${esc(r.title)}</span><br><span class="text-sm text-slate-500">${esc(r.author)}</span></button></li>`).join('')}</ul>` : ''}
      ${dup && dup.length ? `<p class="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Already in the library (${esc(dup.map(b => b.BookID).join(', '))}). Saving adds another copy with its own ID.</p>` : ''}
      <div class="grid grid-cols-2 gap-3"><div><label class="label" for="f-genre">Genre</label><select id="f-genre" class="input">${opts(['Fiction', 'Non-Fiction'], d.Genre)}</select></div>
      <div><label class="label" for="f-lang">Language</label><select id="f-lang" class="input"><option value="">Not specified</option>${opts(LANGS, d.Language)}</select></div></div>
      <div><p class="label">Sub-genres (pick one or more)</p><div class="flex flex-wrap gap-2">${[...new Set([...subs(d.Genre), ...d.SubGenre])].map(s => `<label class="cursor-pointer"><input type="checkbox" class="peer sr-only" name="sg" value="${esc(s)}" ${d.SubGenre.includes(s) ? 'checked' : ''}><span class="pill peer-checked:bg-ink peer-checked:text-white peer-focus-visible:outline-2">${esc(s)}</span></label>`).join('')}</div></div>
      <div class="grid grid-cols-2 gap-3"><div><label class="label" for="f-age">Age group</label><select id="f-age" class="input"><option value="">Not specified</option>${opts(AGES, d.AgeGroup)}</select></div>
      <div><label class="label" for="f-cond">Condition</label><select id="f-cond" class="input"><option value="">Not noted</option>${opts(CONDS, d.Condition)}</select></div></div>
      <div><label class="label" for="f-works">Contained titles <span class="font-normal">(compilations only, one per line)</span></label><textarea id="f-works" rows="2" class="input">${esc(d.ContainedWorks.split('|').join('\n'))}</textarea></div>
      ${S.editId ? '<button class="btn" data-act="cancel-edit" data-tip="Discard the changes">Cancel</button>' : '<label class="flex items-center gap-2 text-sm"><input type="checkbox" id="batch" checked> Open the scanner again after saving</label>'}
      <button class="btn-gold" data-act="save" data-tip="Save this book to the library">${S.editId ? 'Save changes' : 'Save book'}</button></div>`;
  }
};

const newDraft = () => ({ Title: '', Author: '', ISBN: '', Genre: S.sticky.genre, SubGenre: [], AgeGroup: S.sticky.age, Condition: S.sticky.cond, Language: S.sticky.lang, ContainedWorks: '' });

function readForm() {
  if (!$('#f-title')) return;
  S.draft = { Title: $('#f-title').value.trim(), Author: $('#f-author').value.trim(), ISBN: $('#f-isbn').value.replace(/[^0-9Xx]/g, ''), Genre: $('#f-genre').value,
    SubGenre: [...document.querySelectorAll('input[name=sg]:checked')].map(x => x.value), AgeGroup: $('#f-age').value, Condition: $('#f-cond').value,
    Language: $('#f-lang').value, ContainedWorks: $('#f-works').value.split('\n').map(s => s.trim()).filter(Boolean).join('|') };
}

function applyItem(it, isbn) {
  const text = `${it.categories} ${it.description}`.toLowerCase();
  const found = [...new Set(CAT_MAP.filter(([k]) => text.includes(k)).map(([, v]) => v))];
  const d = S.draft;
  Object.assign(d, { Title: it.title || d.Title, Author: it.author || d.Author, ISBN: it.isbn || isbn || d.ISBN });
  if (LANG_CODE[it.language]) d.Language = LANG_CODE[it.language];
  if (found.length) { d.Genre = found.every(f => NF.includes(f)) ? 'Non-Fiction' : 'Fiction'; d.SubGenre = found.filter(f => subs(d.Genre).includes(f)); }
  else if (/fiction/.test(text)) d.Genre = 'Fiction';
  S.results = [];
}

// ───────── Shell & render ─────────
const landing = () => `<main class="relative min-h-dvh overflow-hidden bg-ink p-6 text-white print:hidden"><img src="/school.jpg" alt="" data-hide-on-error class="absolute inset-0 h-full w-full object-cover opacity-20">
  <div class="relative mx-auto flex min-h-[calc(100dvh-3rem)] max-w-3xl flex-col justify-between gap-10"><div class="flex justify-end"><button class="btn !min-h-10 !px-3" data-act="display" data-tip="Change the colour theme" aria-label="Display settings">${ic('display')}</button></div>
  <div><img src="/logo.png" alt="Santa Maria School crest" class="mb-6 h-28 w-auto"><h1 class="font-display text-5xl sm:text-7xl">${tr('library')}</h1><p class="mt-3 text-lg text-white/75">Santa Maria Matriculation Higher Secondary School</p></div>
  <div class="grid gap-5"><button data-act="role" data-id="student" class="btn-gold !min-h-16 !justify-between !text-xl"><span>${tr('role_student')}</span>${ic('books', 'h-7 w-7')}</button>
  <div class="flex flex-wrap items-center gap-3 text-sm text-white/75"><span>${tr('staff')}</span><button class="btn !min-h-10" data-act="role" data-id="librarian">${tr('role_librarian')}</button><button class="btn !min-h-10" data-act="role" data-id="principal">${tr('role_principal')}</button></div>${installBlock()}</div></div></main>`;

function shell() {
  const tabs = tabsFor(), staff = isStaff(), v = views[S.tab](), narrow = staff && ['add', 'checkout'].includes(S.tab);
  const side = staff ? `<aside class="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col justify-between border-r border-white/10 bg-ink p-4 text-white lg:flex">
    <div><div class="flex items-center gap-3 px-2 pb-6"><img src="/logo.png" alt="" class="h-12 w-auto"><div><p class="font-display text-xl leading-tight">Library</p><p class="text-xs text-white/70">${tr('role_' + S.role)}</p></div></div>
    <nav class="grid gap-1">${tabs.map(x => `<button data-act="tab" data-id="${x[0]}" data-tip="${tabTip(x[0])}" class="navbtn gap-3 !justify-start !text-base ${S.tab === x[0] ? 'on' : ''}">${ic(x[2])}${tr(x[1])}</button>`).join('')}</nav></div>
    <div class="grid gap-2"><button class="navbtn gap-3 border border-white/20 !justify-start" data-act="report-open" data-tip="Report a problem or a missing book" data-id="t_other">${ic('flag')}${tr('report')}</button><button class="navbtn gap-3 border border-white/20 !justify-start" data-act="display" data-tip="Change the colour theme">${ic('display')}Display</button><button class="navbtn border border-white/20 !justify-start" data-act="logout" data-tip="Sign out">${tr('signout')}</button></div></aside>` : '';
  return `<div class="min-h-dvh ${staff ? 'lg:flex' : ''} ${tabs.length > 1 ? 'pb-20 ' + (staff ? 'lg:pb-0' : 'sm:pb-0') : ''}">${side}
  <div class="min-w-0 flex-1"><header class="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-white/10 bg-ink px-4 py-3 text-white sm:px-8 ${staff ? 'lg:hidden' : ''}">
    <div class="flex items-center gap-3"><img src="/logo.png" alt="" class="h-8 w-auto"><span class="font-display hidden text-lg sm:inline">Library</span><span class="hidden rounded-full bg-white/10 px-3 py-1 text-xs sm:inline">${ROLES[S.role].name}</span></div>
    ${tabs.length > 1 && !staff ? `<nav class="hidden gap-1 sm:flex">${tabs.map(x => `<button data-act="tab" data-id="${x[0]}" data-tip="${tabTip(x[0])}" class="navbtn ${S.tab === x[0] ? 'on' : ''}">${tr(x[1])}</button>`).join('')}</nav>` : ''}
    <div class="flex items-center gap-2"><button class="navbtn border border-white/20" data-act="report-open" data-tip="Report a problem or a missing book" data-id="t_other" aria-label="${esc(tr('report'))}">${ic('flag')}</button><button class="navbtn border border-white/20" data-act="display" data-tip="Change the colour theme" aria-label="Display settings">${ic('display')}</button><button class="navbtn border border-white/20" data-act="logout" data-tip="Sign out">${tr('signout')}</button></div></header>
  <main class="mx-auto p-4 ${staff ? 'max-w-7xl sm:p-6 lg:p-10' : 'max-w-5xl sm:p-8'}">${narrow ? `<div class="mx-auto max-w-3xl">${v}</div>` : v}</main></div>
  ${tabs.length > 1 ? `<nav class="fixed inset-x-0 bottom-0 z-20 flex overflow-x-auto border-t border-stone-200 bg-surface pb-[env(safe-area-inset-bottom)] ${staff ? 'lg:hidden' : 'sm:hidden'}">${tabs.map(x => `<button data-act="tab" data-id="${x[0]}" data-tip="${tabTip(x[0])}" class="flex min-w-[4.5rem] flex-1 flex-col items-center py-2 text-xs ${S.tab === x[0] ? 'font-bold text-navy' : 'text-slate-500'}">${ic(x[2])}${tr(x[1])}</button>`).join('')}</nav>` : ''}</div>`;
}

function overlays() {
  if (S.scanning) return `<div role="dialog" aria-modal="true" aria-label="Barcode scanner" class="fixed inset-0 z-50 flex flex-col bg-black"><p class="p-4 text-center text-sm text-white">Point the camera at the barcode on the back of the book</p><div id="reader" class="flex-1"></div><button class="btn m-4" data-act="cancel-scan">Cancel</button></div>`;
  const box = inner => `<div class="fixed inset-0 z-50 grid place-items-center bg-ink/70 p-4"><div role="dialog" aria-modal="true" class="w-full max-w-sm rounded-2xl bg-surface p-6">${inner}</div></div>`;
  if (S.login) return box(`<h2 class="font-display text-2xl text-navy">${ROLES[S.login].name}</h2><label class="label mt-4" for="pw">${tr('password')}</label><input id="pw" type="password" class="input" autocomplete="current-password">
    ${S.login === 'student' ? '<label class="mt-3 flex items-center gap-2 text-sm"><input id="remember" type="checkbox" checked class="h-5 w-5" style="accent-color:#c9a84c"> Keep me signed in on this device</label>' : ''}<p id="lerr" class="mt-2 hidden text-sm text-red-800"></p><p id="lnote" class="mt-2 text-sm text-slate-500" aria-live="polite"></p><button class="btn-gold mt-4 w-full" data-act="login">${tr('signin')}</button><button class="btn mt-2 w-full" data-act="close">${tr('back2')}</button>`);
  if (S.confirm) { const b = S.books.find(x => x.BookID === S.confirm); return box(`<h2 class="font-display text-xl text-navy">Remove this book?</h2><p class="my-3 text-sm text-slate-600">${esc(b?.Title)} (${esc(S.confirm)}) will be deleted from the catalogue.</p>
    <div class="flex gap-2"><button class="btn flex-1" data-act="close">Keep</button><button class="btn-red flex-1" data-act="remove">Remove</button></div>`); }
  if (S.display) return box(`<h2 class="font-display text-2xl text-navy">Display</h2><p class="label mt-4">Theme</p><div class="grid gap-2">${[['light', 'Paper', 'Warm and calm'], ['dark', 'Night', 'High contrast, easy on the eyes'], ['bento', 'Bento', 'Navy tiles with gold accents']].map(([k, n, d]) => `<button data-act="theme" data-id="${k}" aria-pressed="${S.theme === k}" class="btn !justify-between ${S.theme === k ? '!bg-gold !text-ink' : ''}"><span>${n}</span><span class="text-xs font-normal">${d}</span></button>`).join('')}</div>
    <button class="btn-gold mt-5 w-full" data-act="close">Done</button>`);
  if (S.listLogin) return box(`<h2 class="font-display text-2xl text-navy">My reading list</h2><p class="mt-1 text-sm text-slate-500">Only you can open it, from any device. First time? Choose any 4-digit PIN and remember it. A librarian can reset it.</p>
    <label class="label mt-4" for="ll-roll">Roll number</label><input id="ll-roll" class="input" autocomplete="off"><label class="label mt-3" for="ll-pin">4-digit PIN</label><input id="ll-pin" type="password" inputmode="numeric" maxlength="4" autocomplete="off" class="input">
    <p id="ll-err" class="mt-2 hidden text-sm text-red-800"></p><div class="mt-4 flex gap-2"><button class="btn flex-1" data-act="close">Cancel</button><button class="btn-gold flex-1" data-act="list-go">Open</button></div>`);
  if (S.surprise) {
    const b = S.books.find(x => x.BookID === S.surprise);
    if (b) return box(`<p class="text-sm font-semibold text-amber-700">${tr('surprise')}</p><h2 class="font-display mt-2 text-2xl text-navy">${esc(b.Title)}</h2><p class="text-slate-500">${esc(b.Author)}</p>
      <div class="mt-3 flex flex-wrap gap-1">${String(b.SubGenre || '').split('|').filter(Boolean).map(x => `<span class="pill">${esc(x)}</span>`).join('')}<span class="pill ok">${tr('availnow')}</span></div>
      <div class="mt-5 flex gap-2"><button class="btn flex-1" data-act="surprise" data-tip="Pick a random available book for me">${tr('another')}</button>${S.role === 'student' ? favBtn(b, 'flex-1') : ''}<button class="btn-gold flex-1" data-act="close">${tr('close')}</button></div>`);
  }
  if (S.report) {
    const r = S.report;
    return box(`<h2 class="font-display text-xl text-navy">${tr('report')}</h2><label class="label mt-4" for="r-type">${tr('what')}</label>
      <select id="r-type" class="input">${['t_missing', 't_wrong', 't_app', 't_other'].map(k => `<option value="${k}" ${r.type === k ? 'selected' : ''}>${esc(tr(k))}</option>`).join('')}</select>
      <label class="label mt-3" for="r-msg">${tr('describe')}</label><textarea id="r-msg" rows="4" maxlength="1000" class="input">${esc(r.msg)}</textarea>
      <label class="label mt-3" for="r-contact">${tr('contact')}</label><input id="r-contact" class="input" maxlength="80">
      <div class="mt-4 flex gap-2"><button class="btn flex-1" data-act="close">${tr('cancel')}</button><button class="btn-gold flex-1" data-act="report-send" data-tip="Send this report">${tr('send')}</button></div>`);
  }
  return '';
}

let first = true;
function render() {
  $('#app').innerHTML = (S.role ? shell() : S.resuming ? resumeScreen() : landing()) + overlays();
  if (S.login) $('#pw')?.focus();
  if (S.listLogin) $('#ll-roll')?.focus();
  document.querySelectorAll('.scroll-end').forEach(e => { e.scrollLeft = e.scrollWidth; });   // wide charts open on the newest data
  const dlg = document.querySelector('[role=dialog]');
  if (dlg && !dlg.contains(document.activeElement)) dlg.querySelector('input,select,textarea,button')?.focus();
}
const refreshList = (id, fn) => { const el = $(id); if (el) el.innerHTML = fn(); };
const guard = async (fn) => { try { await fn(); } catch (e) { toast(e.message, 'error'); if (/sign in again/i.test(e.message)) H.logout(); } };

// ───────── Actions ─────────
let busy = false;
async function onCode(code) {
  if (busy) return; busy = true;
  await (await scanner()).stopScan(); S.scanning = false;
  S.draft.ISBN = code; toast('Looking up ' + code + '…');
  const r = await lookup({ isbn: code });
  if (r.items?.length) applyItem(r.items[0], code); else toast('Not found online. Fill in the details by hand.', 'info');
  render(); busy = false;
}
async function openScanner() {
  readForm(); S.scanning = true; render();
  try { await (await scanner()).startScan('reader', onCode); } catch { S.scanning = false; render(); toast('Camera unavailable. Allow camera access, or type the details.', 'error'); }
}

const H = {
  role: id => { S.login = id; render(); },
  close: () => { if (S.login === 'admin') clearHash(); S.listLogin = null; S.open = null; S.display = false; S.login = null; S.confirm = null; S.report = null; S.surprise = null; render(); },
  async login() {
    if (S.signingIn) return;
    S.signingIn = true;
    const btn = $('[data-act="login"]'), label = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Signing in...';
    const slow = setTimeout(() => { const n = $('#lnote'); if (n) n.textContent = 'Waking up the library. This can take a few seconds the first time.'; }, 3000);
    try {
      const role = S.login, d = await api('login', { role, password: $('#pw').value, withData: true, remember: role === 'student' && !!$('#remember')?.checked });   // sign-in and data in one request
      setToken(d.token); if (d.remember) store.set('remember', d.token); if (role === 'admin') clearHash(); S.role = role; S.login = null; S.tab = role === 'student' ? 'catalogue' : role === 'admin' ? 'overview' : 'dashboard'; S.draft = newDraft();
      if (d.data) applyAll(d.data);
      S.loading = !d.data; render();
      if (!d.data) { try { await (role === 'admin' ? loadReports() : load({ force: true })); } catch (e) { toast(e.message, 'error'); } S.loading = false; render(); }
      if (role === 'admin') adminLoad('overview').then(() => render()).catch(e => toast(e.message, 'error'));
      syncQueue();
    } catch (e) { console.error(e); const el = $('#lerr'); if (el) { el.textContent = e.message; el.classList.remove('hidden'); } }
    finally { clearTimeout(slow); S.signingIn = false; const b = $('[data-act="login"]'); if (b) { b.disabled = false; b.innerHTML = label; } const n = $('#lnote'); if (n) n.textContent = ''; }
  },
  logout: () => { setToken(null); store.set('remember', null); Object.assign(S, { role: null, loadedAt: 0, me: null, list: [], listLogin: null, editId: null, books: [], checkouts: [], genres: [], pick: null, roll: '', q: '', cq: '', rq: '' }); render(); },
  tab: id => { readForm(); if (S.tab === 'add' && id !== 'add' && S.editId) { S.editId = null; S.draft = newDraft(); } S.tab = id; render(); if (id !== 'add') guard(async () => { const was = S.loadedAt; await (S.role === 'admin' ? adminLoad(id) : load()); if (S.tab === id && (S.role === 'admin' || S.loadedAt !== was)) render(); }); },
  pick: id => { S.pick = id; render(); },
  unpick: () => { S.pick = null; render(); },
  checkout: () => guard(async () => {
    if (!S.roll.trim()) throw new Error('Enter the roll number.');
    if (!S.pick) throw new Error('Select a book first.');
    const roll = S.roll.trim(), held = loansOf(roll), late = held.filter(c => daysLeft(c.DueDate) < 0).length;
    if ((late || overLimit(held.length)) && !confirm(`Roll ${roll} has ${held.length} book(s) out${late ? ` and ${late} overdue` : ''}. Check out anyway?`)) return;
    // The screen updates at once; the save runs in the background and is undone if it fails.
    const book = S.books.find(b => b.BookID === S.pick), days = +S.days || 14, rid = newId(), was = book.Available;
    const rec = { CheckoutID: 'pending-' + rid, RollNumber: roll, BookID: book.BookID, Title: book.Title, CheckoutDate: isoDay(new Date()), DueDate: isoDay(new Date(Date.now() + days * 864e5)), Returned: 'No' };
    book.Available = 'No'; S.checkouts = [...S.checkouts, rec];
    store.set('rolls', [roll, ...store.get('rolls', []).filter(x => x !== roll)].slice(0, 8)); S.pick = null; S.roll = ''; S.cq = ''; render();
    toast(`Checked out. Due ${showDate(rec.DueDate)}.`, 'success');
    retry(() => api('checkout', { bookId: book.BookID, roll, days, rid })).then(r => { rec.CheckoutID = r.checkoutId; rec.DueDate = r.dueDate; })
      .catch(e => { book.Available = was; S.checkouts = S.checkouts.filter(x => x !== rec); render(); toast(`Check out failed: ${e.message}`, 'error'); });
  }),
  return: id => {
    const c = S.checkouts.find(x => x.CheckoutID === id); if (!c || c.Returned === 'Yes') return;
    if (id.startsWith('pending-')) return toast('Still saving that checkout. Try again in a moment.');
    const book = S.books.find(b => b.BookID === c.BookID), was = book?.Available, rid = newId();
    c.Returned = 'Yes'; if (book) book.Available = 'Yes'; render(); toast('Book returned.', 'success');
    retry(() => api('returnBook', { checkoutId: id, rid })).catch(e => {
      if (/already returned/i.test(e.message)) return;
      c.Returned = 'No'; if (book) book.Available = was; render(); toast(`Could not mark as returned: ${e.message}`, 'error');
    });
  },
  'ask-remove': id => { S.confirm = id; render(); },
  remove: () => {
    const id = S.confirm, i = S.books.findIndex(b => b.BookID === id); if (i < 0) return H.close();
    const [gone] = S.books.splice(i, 1); S.confirm = null; render(); toast('Book removed.', 'success');
    api('removeBook', { bookId: id }).catch(e => { S.books.splice(i, 0, gone); render(); toast(`Could not remove it: ${e.message}`, 'error'); });
  },
  sg: id => { S.fg = []; S.fs = [id]; render(); },
  dd: id => { S.open = S.open === id ? null : id; render(); },
  fg: id => { const back = keepScroll(); S.fg = toggle(S.fg, id); S.fs = S.fs.filter(x => subOptions().includes(x)); render(); back(); },
  fs: id => { const back = keepScroll(); S.fs = toggle(S.fs, id); render(); back(); },
  more: () => { S.more = !S.more; render(); },
  'clear-all': () => { S.fg = []; S.fs = []; S.lng = ''; S.age = ''; S.avail = ''; S.open = null; render(); },
  edit: id => {
    const b = S.books.find(x => x.BookID === id); if (!b) return;
    S.editId = id; S.tab = 'add'; S.results = [];
    S.draft = { Title: b.Title, Author: b.Author, ISBN: b.ISBN || '', Genre: b.Genre || 'Fiction', SubGenre: String(b.SubGenre || '').split('|').filter(Boolean), AgeGroup: b.AgeGroup || '', Condition: b.Condition || '', Language: b.Language || '', ContainedWorks: b.ContainedWorks || '' };
    render(); scrollTo(0, 0);
  },
  'cancel-edit': () => { S.editId = null; S.draft = newDraft(); S.tab = 'catalogue'; render(); },
  addgenre: () => guard(async () => {
    const genre = $('#g-parent').value, name = $('#g-name').value.trim();
    if (subs(genre).some(s => s.toLowerCase() === name.toLowerCase())) throw new Error('That sub-genre already exists.');
    await api('addGenre', { genre, subgenre: name }); S.genres = [...S.genres, { Genre: genre, SubGenre: name }]; render(); toast(`Added “${name}”.`, 'success');
  }),
  fav: (id, el) => {
    if (!S.me) { S.listLogin = { pending: id }; render(); return; }
    const on = !S.list.includes(id), { roll, pin } = S.me;
    S.list = on ? [...S.list, id] : S.list.filter(x => x !== id);
    if (S.tab === 'list' && !S.surprise) render(); else el.innerHTML = ic('heart', 'h-4 w-4', on) + ' ' + tr(on ? 'saved' : 'save');
    listChain = listChain.then(() => api('listToggle', { roll, pin, bookId: id, on }))   // one at a time, in the order tapped
      .catch(e => { S.list = on ? S.list.filter(x => x !== id) : [...S.list, id]; render(); toast(e.message, 'error'); });
  },
  'list-open': () => { S.listLogin = { pending: null }; render(); },
  'list-go': async () => {
    if (S.listBusy) return; S.listBusy = true;
    const go = $('[data-act="list-go"]'), goLabel = go?.innerHTML; if (go) { go.disabled = true; go.innerHTML = '<span class="spinner"></span> Opening...'; }
    const roll = $('#ll-roll').value.trim(), pin = $('#ll-pin').value.trim(), err = $('#ll-err'), pending = S.listLogin?.pending;
    try {
      const r = await api('listOpen', { roll, pin }); let books = r.books;
      if (pending && !books.includes(pending)) { await api('listToggle', { roll, pin, bookId: pending, on: true }); books = [...books, pending]; }
      S.me = { roll, pin }; S.list = books; S.listLogin = null; render();
      toast(r.isNew ? 'List created. Remember your PIN.' : 'Welcome back.', 'success');
    } catch (e) { err.textContent = e.message; err.classList.remove('hidden'); }
    finally { S.listBusy = false; if (go?.isConnected) { go.disabled = false; go.innerHTML = goLabel; } }
  },
  'list-lock': () => { S.me = null; S.list = []; render(); },
  'reset-pin': () => guard(async () => {
    const roll = $('#pin-roll').value.trim(); await api('listReset', { roll }); $('#pin-roll').value = '';
    toast(`PIN reset for roll ${roll}. They choose a new one next time.`, 'success');
  }),
  surprise: () => {
    const open = S.books.filter(b => b.Available === 'Yes' && b.BookID !== S.surprise);
    if (!open.length) return toast(tr('nomatch'));
    S.surprise = open[Math.floor(Math.random() * open.length)].BookID; render();
  },
  'report-open': id => { S.report = { type: id || 't_other', msg: id === 't_missing' && S.q ? S.q : '' }; render(); },
  'report-send': () => guard(async () => {
    const message = $('#r-msg').value.trim();
    if (!message) throw new Error(tr('describe'));
    await api('report', { type: T.en[$('#r-type').value], message, contact: $('#r-contact').value.trim() });
    S.report = null; render(); toast(tr('thanks'), 'success');
  }),
  install: async () => { if (!deferredPrompt) return; deferredPrompt.prompt(); deferredPrompt = null; S.canInstall = false; render(); },
  display: () => { S.display = true; render(); },
  theme: id => { S.theme = id; store.set('theme2', id); applyDisplay(); render(); },
  roll: id => { S.roll = id; render(); },
  'copy-overdue': () => { const t = overdueText(); if (!t) return toast('Nothing is overdue.'); navigator.clipboard.writeText(t).then(() => toast('Overdue list copied.', 'success'), () => toast('Could not copy.', 'error')); },
  'print-overdue': () => { const t = overdueText(); if (!t) return toast('Nothing is overdue.'); $('#printarea').innerHTML = `<h1 style="font:700 22px sans-serif">Overdue books, ${new Date().toLocaleDateString('en-IN')}</h1><pre style="font:15px/1.6 sans-serif;white-space:pre-wrap">${esc(t)}</pre>`; print(); },
  scan: openScanner,
  'cancel-scan': async () => { await (await scanner()).stopScan(); S.scanning = false; render(); },
  search: () => guard(async () => {
    readForm(); const d = S.draft;
    if (d.ISBN) { const r = await lookup({ isbn: d.ISBN }); if (r.items?.[0]) { applyItem(r.items[0], d.ISBN); render(); return; } }
    if (!d.Title) throw new Error('Enter a title (and author) to look up.');
    S.results = (await lookup({ q: `${d.Title} ${d.Author}` })).items || [];
    if (!S.results.length) toast('Nothing found. Fill in the details by hand.');
    render();
  }),
  use: i => { readForm(); applyItem(S.results[i]); render(); },
  refresh: () => guard(async () => { await load({ force: true }); render(); toast('Up to date.', 'success'); }),
  save: () => {
    readForm(); const d = S.draft;
    if (!d.Title || !d.Author || !d.SubGenre.length) return toast('Title, author and at least one sub-genre are required.', 'error');
    const book = { ...d, SubGenre: d.SubGenre.join('|') };
    if (S.editId) {   // edit: the screen updates at once, the save follows in the background
      const id = S.editId, b = S.books.find(x => x.BookID === id); if (!b) return toast('Book not found.', 'error');
      const prev = { ...b };
      Object.assign(b, book); delete b._h; delete b._w;
      S.editId = null; S.draft = newDraft(); S.tab = 'catalogue'; render(); toast('Changes saved.', 'success');
      api('updateBook', { bookId: id, book }).catch(e => { Object.assign(b, prev); render(); toast(`Could not save the changes: ${e.message}`, 'error'); });
      return;
    }
    // add: ready for the next book immediately; saves go through one at a time in the background
    const again = $('#batch').checked, row = { ...book, BookID: '(saving)', Available: 'Yes' };
    S.books.push(row); S.sticky = { genre: d.Genre, age: d.AgeGroup, cond: d.Condition, lang: d.Language };
    S.draft = newDraft(); S.results = [];
    saveBook(book, newId(), row);
    toast(`Saving "${book.Title}"`, 'success');
    if (again) openScanner(); else render();
  }
};

// ───────── Owner tools, settings and "keep me signed in" ─────────
Object.assign(S, { settings: {}, quotesCustom: [], meta: {}, log: [], backups: null, repFilter: 'open', repQ: '', logQ: '', setf: null, qdraft: null, resuming: false, daysTouched: false });
const loadLog = async () => { S.log = await api('getLog'); };
const loadBackups = async () => { S.backups = await api('getBackups'); };
async function adminLoad(id) {
  const jobs = [];
  if (['overview', 'reports', 'wanted'].includes(id)) jobs.push(loadReports());
  if (['overview', 'activity'].includes(id)) jobs.push(loadLog());
  if (id === 'safety') jobs.push(loadBackups());
  if (['overview', 'analytics', 'checks', 'settings'].includes(id)) jobs.push(load());
  await Promise.all(jobs);
}
async function resume(tok) {   // a remembered student device reopens straight into the library
  setToken(tok);
  try {
    const d = await api('resume');
    setToken(d.token); store.set('remember', d.token); S.role = 'student'; S.tab = 'catalogue'; S.draft = newDraft(); applyAll(d.data);
  } catch (e) { setToken(null); if (!e.offline) store.set('remember', null); }
  S.resuming = false; render();
}
function pickQuote() { const q = (S.settings.builtin_quotes === 'no' ? [] : QUOTES).concat(S.quotesCustom); return q.length ? q[daySeed() % q.length] : null; }
async function withBusy(el, label, fn) {
  const old = el?.innerHTML; if (el) { el.disabled = true; el.innerHTML = `<span class="spinner"></span> ${label}`; }
  try { return await fn(); } finally { if (el?.isConnected) { el.disabled = false; el.innerHTML = old; } }
}
const statTile = (label, value, sub, bt) => `<div class="card ${bt} flex flex-col justify-between"><p class="text-sm font-bold text-slate-600">${label}</p><p class="font-display mt-3 text-4xl font-bold">${value}</p><p class="mt-1 text-sm text-slate-500">${sub}</p></div>`;
const wantedGroups = () => {
  const g = {};
  S.reports.filter(r => r.Type === 'A book is missing' && r.Status !== 'Resolved').forEach(r => {
    const k = r.Message.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim(); if (!k) return;
    (g[k] = g[k] || { text: r.Message, ids: [], latest: '' }).ids.push(r.ReportID); if (r.Date > g[k].latest) g[k].latest = r.Date;
  });
  return g;
};
const reportList = () => {
  const f = S.repFilter, q = S.repQ.toLowerCase().trim();
  const rows = S.reports.filter(r => (f === 'all' || (f === 'open') === (r.Status !== 'Resolved')) && (!q || [r.Message, r.Type, r.Contact, r.Notes, r.Role].some(x => x.toLowerCase().includes(q)))).sort((a, b) => b.Date.localeCompare(a.Date));
  if (!rows.length) return `<ul class="grid gap-3">${empty('Nothing here.')}</ul>`;
  return `<ul class="grid gap-3">${rows.map(r => `<li class="card ${r.Status === 'Resolved' ? 'opacity-70' : ''}"><div class="flex flex-wrap items-center gap-2"><span class="pill ${r.Status === 'Resolved' ? 'ok' : 'warn'}">${esc(r.Status || 'Open')}</span><span class="pill">${esc(r.Type)}</span><span class="pill">${esc(r.Role)}</span><span class="text-xs text-slate-500">${showDate(r.Date)}</span></div>
    <p class="mt-2 whitespace-pre-wrap text-sm">${esc(r.Message)}</p>${r.Contact ? `<p class="mt-1 text-xs text-slate-500">From: ${esc(r.Contact)}</p>` : ''}
    <textarea rows="2" class="input mt-3 text-sm" placeholder="Private note (only the Owner sees this)" data-note="${esc(r.ReportID)}">${esc(r.Notes)}</textarea>
    <div class="mt-2 flex flex-wrap gap-2"><button class="btn !min-h-9 text-xs" data-act="savenote" data-id="${esc(r.ReportID)}" data-tip="Save the private note">Save note</button><button class="btn !min-h-9 text-xs" data-act="resolve" data-id="${esc(r.ReportID)}" data-tip="Mark this report as done, or reopen it">${r.Status === 'Resolved' ? 'Reopen' : 'Mark resolved'}</button></div></li>`).join('')}</ul>`;
};
const logList = () => {
  const q = S.logQ.toLowerCase().trim(), rows = S.log.filter(l => !q || [l.Who, l.Action, l.Detail].some(x => x.toLowerCase().includes(q)));
  return rows.length ? `<ul class="card !p-2">${rows.map(l => `<li class="grid gap-x-3 border-b border-stone-100 px-2 py-2 text-sm last:border-0 sm:grid-cols-[9.5rem_6.5rem_11rem_1fr]"><span class="text-slate-500">${esc(l.Time)}</span><span class="font-bold capitalize">${esc(l.Who)}</span><span>${esc(l.Action)}</span><span class="text-slate-600">${esc(l.Detail)}</span></li>`).join('')}</ul>` : `<ul class="grid gap-3">${empty('Nothing logged yet.')}</ul>`;
};
const healthChecks = () => {
  const B = S.books, C = S.checkouts, byId = {}, openBy = {}, openC = C.filter(c => c.Returned !== 'Yes');
  B.forEach(b => { (byId[b.BookID] = byId[b.BookID] || []).push(b); }); openC.forEach(c => { (openBy[c.BookID] = openBy[c.BookID] || []).push(c); });
  const ids = bs => bs.map(b => `${b.BookID}  ${b.Title}`);
  const copies = {}; B.forEach(b => { const k = (b.Title + '|' + b.Author).toLowerCase(); (copies[k] = copies[k] || []).push(b); });
  return [
    ['Books with no genre or sub-genre', 'They will not appear when students browse by genre.', ids(B.filter(b => !b.Genre || !b.SubGenre))],
    ['Books with no author', 'Students search by author.', ids(B.filter(b => !b.Author))],
    ['Books with no language', 'Students can filter by language.', ids(B.filter(b => !b.Language))],
    ['The same Book ID used twice', 'Every copy needs its own ID.', Object.keys(byId).filter(k => byId[k].length > 1).map(k => `${k}  (${byId[k].length} rows)`)],
    ['ISBN that does not look right', 'An ISBN has 10 or 13 digits.', ids(B.filter(b => { const d = b.ISBN.replace(/[-\s]/g, ''); return d && !/^(\d{13}|\d{9}[\dXx])$/.test(d); }))],
    ['Marked checked out, but no open checkout', 'The book may be stuck as unavailable.', ids(B.filter(b => b.Available === 'No' && !openBy[b.BookID]))],
    ['Marked available, but has an open checkout', 'The Sheet may have been edited by hand.', ids(B.filter(b => b.Available === 'Yes' && openBy[b.BookID]))],
    ['Two open checkouts for one book', 'Only one person can hold a copy.', Object.keys(openBy).filter(k => openBy[k].length > 1).map(k => `${k}: rolls ${openBy[k].map(c => c.RollNumber).join(', ')}`)],
    ['Overdue by more than 30 days', 'Probably lost or forgotten.', openC.filter(c => daysLeft(c.DueDate) < -30).map(c => `${titleOf(c)}, roll ${c.RollNumber}, due ${showDate(c.DueDate)}`)],
    ['Same title and author on different IDs', 'Fine if these are extra copies. Worth a look if not.', Object.values(copies).filter(l => l.length > 1).map(l => `${l[0].Title}, ${l[0].Author}  (${l.length} copies: ${l.map(b => b.BookID).join(', ')})`)],
    ['Problem reports waiting over 30 days', 'They are still open.', S.reports.filter(r => r.Status !== 'Resolved' && daysLeft(r.Date) < -30).map(r => `${showDate(r.Date)}  ${r.Type}`)]
  ];
};
const setVals = () => S.setf || { on: S.settings.banner_on === 'yes', text: S.settings.banner_text || '', days: S.settings.loan_days || '14', limit: S.settings.loan_limit ?? '3', builtin: S.settings.builtin_quotes !== 'no' };
const readSetf = () => { if (!$('#set-banner')) return; S.setf = { on: $('#set-banner-on').checked, text: $('#set-banner').value, days: $('#set-days').value, limit: $('#set-limit').value, builtin: $('#set-builtin').checked }; };
const qd = () => S.qdraft || (S.qdraft = S.quotesCustom.map(q => [...q]));
const section = (title, note, inner) => `<div class="card"><h2 class="font-display text-xl text-navy">${title}</h2>${note ? `<p class="mb-3 mt-1 text-sm text-slate-500">${note}</p>` : '<div class="mb-3"></div>'}${inner}</div>`;

Object.assign(views, {
  overview: () => {
    const open = S.reports.filter(r => r.Status !== 'Resolved'), act = S.checkouts.filter(c => c.Returned !== 'Yes'), late = act.filter(c => daysLeft(c.DueDate) < 0).length;
    const since = isoDay(new Date(Date.now() - 6 * 864e5)), week = S.checkouts.filter(c => c.CheckoutDate >= since).length;
    const lb = S.meta.lastBackup, age = lb ? Math.floor((Date.now() - new Date(lb.replace(' ', 'T')).getTime()) / 864e5) : null;
    return `<div class="flex flex-wrap items-center justify-between gap-3"><h1 class="h1">Overview</h1><button class="btn" data-act="backup-now" data-tip="Save a dated copy of the whole Sheet in Google Drive">${ic('install')} Back up now</button></div>
    <div class="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3">${statTile('Open reports', open.length, open.length ? 'waiting for you' : 'all handled', open.length ? 'bt-c' : 'bt-b')}${statTile('Books', S.books.length, 'in the library', 'bt-a')}${statTile('Checkouts, last 7 days', week, `${act.length} out now${late ? `, ${late} overdue` : ''}`, 'bt-e')}${statTile('Reading lists', S.meta.lists ?? 0, 'students with a saved list', 'bt-e')}${statTile('Last backup', lb ? showDate(lb.slice(0, 10)) : 'Never', lb ? (age > 14 ? 'older than two weeks' : 'looks recent') : 'make one now', lb && age <= 14 ? 'bt-b' : 'bt-d')}${statTile('Wanted books', Object.keys(wantedGroups()).length, 'titles students asked for', 'bt-a')}</div>
    <div class="mt-3 grid gap-3 lg:grid-cols-2">
      <div class="card"><h2 class="mb-2 font-display text-xl text-navy">Newest open reports</h2>${open.length ? `<ul>${open.sort((a, b) => b.Date.localeCompare(a.Date)).slice(0, 5).map(r => `<li class="border-b border-stone-100 py-2 text-sm last:border-0"><span class="pill mr-2">${esc(r.Type)}</span><span class="text-slate-500">${showDate(r.Date)}</span><p class="mt-1 truncate">${esc(r.Message)}</p></li>`).join('')}</ul><button class="btn mt-3 !min-h-9 text-xs" data-act="tab" data-id="reports">See all reports</button>` : '<p class="text-sm text-slate-500">No open reports.</p>'}</div>
      <div class="card"><h2 class="mb-2 font-display text-xl text-navy">Recent activity</h2>${S.log.length ? `<ul>${S.log.slice(0, 8).map(l => `<li class="border-b border-stone-100 py-2 text-sm last:border-0"><span class="text-slate-500">${esc(l.Time)}</span> <b class="capitalize">${esc(l.Who)}</b> ${esc(l.Action)} <span class="text-slate-600">${esc(l.Detail)}</span></li>`).join('')}</ul><button class="btn mt-3 !min-h-9 text-xs" data-act="tab" data-id="activity">See all activity</button>` : '<p class="text-sm text-slate-500">Nothing logged yet.</p>'}</div></div>`;
  },
  reports: () => {
    const n = f => S.reports.filter(r => f === 'all' || (f === 'open') === (r.Status !== 'Resolved')).length;
    const chip = (id, label) => `<button data-act="repf" data-id="${id}" aria-pressed="${S.repFilter === id}" class="pill !min-h-9 !px-3 !py-1.5 ${S.repFilter === id ? 'bg-ink text-white' : ''}">${label} (${n(id)})</button>`;
    return `<h1 class="h1">Reports</h1><div class="mt-4 flex flex-wrap items-center gap-2">${chip('open', 'Open')}${chip('resolved', 'Resolved')}${chip('all', 'All')}<input id="repq" class="input !w-auto min-w-48 flex-1 !min-h-9" placeholder="Search reports" value="${esc(S.repQ)}"></div><div id="replist" class="mt-3">${reportList()}</div>`;
  },
  wanted: () => {
    const rows = Object.entries(wantedGroups()).sort((a, b) => b[1].ids.length - a[1].ids.length);
    return `<h1 class="h1">Wanted books</h1><p class="mt-1 text-sm text-slate-500">Titles students reported as missing, grouped when the same one is asked for more than once. Use it as a shopping list.</p>
    <ul class="mt-4 grid gap-3 sm:grid-cols-2">${rows.length ? rows.map(([k, g]) => `<li class="card flex items-start justify-between gap-3"><div class="min-w-0"><p class="font-bold text-navy">${esc(g.text)}</p><p class="text-sm text-slate-500">Asked ${g.ids.length} ${g.ids.length === 1 ? 'time' : 'times'}, latest ${showDate(g.latest)}</p></div><button class="btn !min-h-9 shrink-0 text-xs" data-act="wantdone" data-id="${esc(k)}" data-tip="Mark every request for this title as handled">Bought or handled</button></li>`).join('') : empty('No open requests. When a student reports a missing book it appears here.')}</ul>`;
  },
  activity: () => `<h1 class="h1">Activity</h1><p class="mt-1 text-sm text-slate-500">The latest 300 things staff did: adding, editing and removing books, checkouts, returns, setting changes and sign-ins.</p><input id="logq" class="input mt-4 max-w-md" placeholder="Search the activity" value="${esc(S.logQ)}"><div id="loglist" class="mt-3">${logList()}</div>`,
  checks: () => {
    const all = healthChecks(), bad = all.filter(c => c[2].length);
    return `<h1 class="h1">Checks</h1><div class="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">${statTile('Things to look at', bad.length, bad.length ? 'see below' : 'all clear', bad.length ? 'bt-c' : 'bt-b')}${statTile('Books checked', S.books.length, 'every row', 'bt-a')}${statTile('Checkouts checked', S.checkouts.length, 'every row', 'bt-e')}${statTile('Checks run', all.length, `${all.length - bad.length} passed`, 'bt-d')}</div>
    <div class="mt-3 grid gap-3 lg:grid-cols-2">${bad.map(([t, note, items]) => section(`${esc(t)} (${items.length})`, note, `<ul class="text-sm">${items.slice(0, 10).map(i => `<li class="border-b border-stone-100 py-1.5 last:border-0">${esc(i)}</li>`).join('')}</ul>${items.length > 10 ? `<p class="mt-2 text-sm text-slate-500">and ${items.length - 10} more</p>` : ''}`)).join('') || section('All clear', '', '<p class="text-sm">No problems found in the books and checkouts.</p>')}</div>
    ${bad.length ? `<p class="mt-3 text-sm text-slate-500">Passed: ${all.filter(c => !c[2].length).map(c => esc(c[0])).join('; ') || 'none'}.</p>` : ''}`;
  },
  settings: () => {
    const v = setVals(), q = qd();
    return `<h1 class="h1">Settings</h1><div class="mt-4 grid gap-3 lg:grid-cols-2">
    ${section('Notice for students', 'Shows as a gold tile at the top of the student home page.', `<label class="mb-3 flex items-center gap-2 text-sm"><input id="set-banner-on" type="checkbox" class="h-5 w-5" style="accent-color:#c9a84c" ${v.on ? 'checked' : ''}> Show the notice</label><label class="label" for="set-banner">Message (up to 200 characters)</label><input id="set-banner" class="input" maxlength="200" value="${esc(v.text)}" placeholder="Example: The library is closed on Friday"><button class="btn-gold mt-3" data-act="save-banner">Save notice</button>`)}
    ${section('Loan rules', 'Used by the librarian when checking books out.', `<div class="grid grid-cols-2 gap-3"><div><label class="label" for="set-days">Default loan days</label><input id="set-days" type="number" min="1" max="90" class="input" value="${esc(v.days)}"></div><div><label class="label" for="set-limit">Warn at this many books (0 = never)</label><input id="set-limit" type="number" min="0" max="20" class="input" value="${esc(v.limit)}"></div></div><button class="btn-gold mt-3" data-act="save-loan">Save loan rules</button>`)}
    <div class="lg:col-span-2">${section('Quote of the day', `Your own quotes join the ${QUOTES.length} built-in ones. Untick the box to use only your own.`, `<label class="mb-3 flex items-center gap-2 text-sm"><input id="set-builtin" type="checkbox" class="h-5 w-5" style="accent-color:#c9a84c" ${v.builtin ? 'checked' : ''}> Also use the ${QUOTES.length} built-in quotes</label>
      <ul class="mb-3">${q.length ? q.map((x, i) => `<li class="flex items-start justify-between gap-3 border-b border-stone-100 py-2 text-sm last:border-0"><span class="min-w-0">${esc(x[0])} <span class="text-slate-500">${esc(x[1])}</span></span><button class="btn !min-h-8 shrink-0 !px-2 text-xs" data-act="quote-del" data-id="${i}" data-tip="Remove this quote">Remove</button></li>`).join('') : '<li class="text-sm text-slate-500">No custom quotes yet.</li>'}</ul>
      <div class="grid gap-2 sm:grid-cols-[1fr_14rem_auto]"><input id="nq-text" class="input" maxlength="300" placeholder="Quote"><input id="nq-author" class="input" maxlength="80" placeholder="Author and book"><button class="btn" data-act="quote-add">Add</button></div>
      <button class="btn-gold mt-3" data-act="save-quotes">Save quotes</button>`)}</div></div>`;
  },
  safety: () => {
    const b = S.backups;
    return `<h1 class="h1">Safety</h1><div class="mt-4 grid gap-3 lg:grid-cols-2">
    ${section('Change a password', 'The new password works at once. Staff and Owner passwords need 12 or more characters, the student password 6 or more.', `<label class="label" for="pw-role">Which login</label><select id="pw-role" class="input"><option value="student">Student / Teacher</option><option value="librarian">Librarian</option><option value="principal">Principal / Director</option><option value="admin">Owner (you)</option></select>
      <label class="label mt-3" for="pw-new">New password</label><input id="pw-new" type="password" autocomplete="new-password" class="input"><label class="label mt-3" for="pw-again">New password again</label><input id="pw-again" type="password" autocomplete="new-password" class="input">
      <label class="label mt-3" for="pw-current">Your current Owner password</label><input id="pw-current" type="password" autocomplete="current-password" class="input"><label class="mt-3 flex items-center gap-2 text-sm"><input id="pw-all" type="checkbox" checked class="h-5 w-5" style="accent-color:#c9a84c"> Also sign everyone out</label><button class="btn-gold mt-3" data-act="save-pw">Change password</button>`)}
    <div class="grid content-start gap-3">
    ${section('Sign everyone out', 'Ends every session, including students who chose "keep me signed in". You stay signed in. Use it if a password may have leaked.', '<button class="btn-red" data-act="signout-all">Sign everyone out</button>')}
    ${section('Report emails', 'Every problem report is also emailed to the address saved in the Script property OWNER_EMAIL.', `<p class="mb-3 text-sm">${S.meta.email ? `Reports are emailed to <b>${esc(S.meta.email)}</b>.` : 'No address is set yet. Add a Script property named <b>OWNER_EMAIL</b> in Apps Script (DEPLOY.md, step 3).'}</p><button class="btn-gold" data-act="test-email" data-tip="Send yourself a test message to check that report emails work">Send a test email</button>`)}
    ${section('Backups', 'A dated copy of the whole Sheet in your Google Drive folder "Library backups". The newest 12 are kept.', `<div class="flex flex-wrap items-center gap-3"><button class="btn-gold" data-act="backup-now">Back up now</button><label class="flex items-center gap-2 text-sm"><input id="weekly" type="checkbox" data-act="weekly" class="h-5 w-5" style="accent-color:#c9a84c" ${b?.weekly ? 'checked' : ''}> Back up automatically every Sunday</label></div>
      <h3 class="label mt-4">Recent backups</h3>${b ? (b.backups.length ? `<ul class="text-sm">${b.backups.map(x => `<li class="border-b border-stone-100 py-1.5 last:border-0"><a class="underline" href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.name.replace('Library backup ', ''))}</a></li>`).join('')}</ul>` : '<p class="text-sm text-slate-500">No backups yet.</p>') : '<p class="text-sm text-slate-500"><span class="spinner"></span> Loading...</p>'}`)}</div></div>`;
  }
});

Object.assign(H, {
  repf: id => { S.repFilter = id; render(); },
  savenote: id => guard(async () => {
    const r = S.reports.find(x => x.ReportID === id), ta = document.querySelector(`textarea[data-note="${CSS.escape(id)}"]`), notes = ta.value.trim();
    await api('setReport', { reportId: id, notes }); r.Notes = notes; toast('Note saved.', 'success');
  }),
  resolve: id => guard(async () => {
    const r = S.reports.find(x => x.ReportID === id), status = r.Status === 'Resolved' ? 'Open' : 'Resolved', ta = document.querySelector(`textarea[data-note="${CSS.escape(id)}"]`), notes = ta ? ta.value.trim() : r.Notes;
    await api('setReport', { reportId: id, status, notes }); r.Status = status; r.Notes = notes; render();
  }),
  wantdone: key => guard(async () => {
    const g = wantedGroups()[key]; if (!g) return;
    for (const id of g.ids) { await api('setReport', { reportId: id, status: 'Resolved', notes: 'Handled from Wanted books' }); const r = S.reports.find(x => x.ReportID === id); if (r) { r.Status = 'Resolved'; r.Notes = 'Handled from Wanted books'; } }
    render(); toast('Marked as handled.', 'success');
  }),
  'save-banner': (_, el) => withBusy(el, 'Saving...', () => guard(async () => {
    readSetf(); const v = setVals(), on = v.on ? 'yes' : 'no';
    await api('saveSettings', { settings: { banner_on: on, banner_text: v.text.trim() } });
    S.settings.banner_on = on; S.settings.banner_text = v.text.trim(); S.setf = null; render(); toast('Notice saved.', 'success');
  })),
  'save-loan': (_, el) => withBusy(el, 'Saving...', () => guard(async () => {
    readSetf(); const v = setVals(), days = String(v.days).trim(), limit = String(v.limit).trim();
    if (!/^\d+$/.test(days) || +days < 1 || +days > 90) throw new Error('Loan days must be between 1 and 90.');
    if (!/^\d+$/.test(limit) || +limit > 20) throw new Error('The warning limit must be between 0 and 20.');
    await api('saveSettings', { settings: { loan_days: days, loan_limit: limit } });
    S.settings.loan_days = days; S.settings.loan_limit = limit; S.setf = null; if (!S.daysTouched) S.days = +days; render(); toast('Loan rules saved.', 'success');
  })),
  'quote-add': () => { readSetf(); const t = $('#nq-text').value.trim(); if (!t) return toast('Type the quote first.', 'error'); qd().push([t, $('#nq-author').value.trim()]); render(); },
  'quote-del': i => { readSetf(); qd().splice(+i, 1); render(); },
  'save-quotes': (_, el) => withBusy(el, 'Saving...', () => guard(async () => {
    readSetf(); const v = setVals(), list = qd().map(q => [...q]);
    await api('saveQuotes', { quotes: list }); await api('saveSettings', { settings: { builtin_quotes: v.builtin ? 'yes' : 'no' } });
    S.quotesCustom = list; S.settings.builtin_quotes = v.builtin ? 'yes' : 'no'; S.qdraft = null; S.setf = null; render(); toast('Quotes saved.', 'success');
  })),
  'save-pw': (_, el) => withBusy(el, 'Saving...', () => guard(async () => {
    const role = $('#pw-role').value, pw = $('#pw-new').value, min = role === 'student' ? 6 : 12;
    if (pw.length < min) throw new Error(`Use at least ${min} characters.`);
    if (pw !== $('#pw-again').value) throw new Error('The two new passwords are not the same.');
    const r = await api('setPassword', { role, password: pw, current: $('#pw-current').value, signOutAll: $('#pw-all').checked });
    if (r.token) setToken(r.token);
    ['#pw-new', '#pw-again', '#pw-current'].forEach(s => { $(s).value = ''; });
    toast(`Password changed for ${role === 'admin' ? 'the Owner' : 'the ' + role}.`, 'success');
  })),
  'signout-all': (_, el) => {
    if (!confirm('Sign out everyone, including students who chose "keep me signed in"? You stay signed in.')) return;
    return withBusy(el, 'Signing out...', () => guard(async () => { const r = await api('signOutAll'); setToken(r.token); toast('Everyone has been signed out.', 'success'); }));
  },
  'backup-now': (_, el) => withBusy(el, 'Backing up...', () => guard(async () => {
    const r = await api('backupNow'); S.meta.lastBackup = r.name.replace('Library backup ', ''); if (S.tab === 'safety') await loadBackups(); render(); toast('Backup saved in Google Drive.', 'success');
  })),
  'test-email': (_, el) => withBusy(el, 'Sending...', () => guard(async () => { const r = await api('sendTestEmail'); toast(`Test email sent to ${r.to}. Check your inbox (and spam).`, 'success'); })),
  weekly: () => guard(async () => {
    const on = $('#weekly').checked, r = await api('setWeeklyBackup', { on });
    S.backups = { ...(S.backups || { backups: [] }), weekly: r.weekly }; toast(on ? 'Weekly backup is on (Sundays, about 2 am).' : 'Weekly backup is off.', 'success');
  })
});

const resumeScreen = () => `<main class="grid min-h-dvh place-items-center bg-ink p-6 text-white print:hidden"><div class="text-center"><img src="/logo.png" alt="" class="mx-auto mb-5 h-24 w-auto"><p class="font-display text-2xl">Opening the library</p><p class="mt-3"><span class="spinner"></span></p></div></main>`;

// ───────── Dashboards: the librarian runs the desk, the principal oversees the collection ─────────
const dashRow = c => `<li class="flex justify-between gap-2 border-b border-stone-100 py-2 text-sm last:border-0"><span class="truncate">${esc(titleOf(c))}</span><span class="shrink-0 text-slate-500">Roll ${esc(c.RollNumber)}, ${showDate(c.DueDate)}</span></li>`;
const none = t => `<p class="text-sm text-slate-500">${t}</p>`;
const dashDate = () => new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
const dueCard = (title, rows, empty2, extra = '', span = 'col-span-2') => `<div class="card ${span}"><div class="mb-2 flex items-center justify-between gap-2"><h2 class="font-display text-xl text-navy">${title}</h2>${extra}</div><ul>${rows.slice(0, 8).map(dashRow).join('') || none(empty2)}</ul></div>`;
const copyPrint = '<div class="flex gap-2"><button class="btn !min-h-9 !px-3" data-act="copy-overdue">Copy</button><button class="btn !min-h-9 !px-3" data-act="print-overdue">Print</button></div>';
const librarianDash = () => {
  const act = S.checkouts.filter(c => c.Returned !== 'Yes'), over = act.filter(c => daysLeft(c.DueDate) < 0), soon = act.filter(c => { const d = daysLeft(c.DueDate); return d >= 0 && d <= 3; });
  const week = act.filter(c => { const d = daysLeft(c.DueDate); return d >= 4 && d <= 7; }), today = isoDay(new Date());
  return `<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
    <div class="card bt-e col-span-2 flex flex-col justify-between gap-4"><div><h1 class="h1">Today at the library</h1><p class="text-slate-500">${dashDate()}</p></div>
      <div class="flex flex-wrap gap-2"><button class="btn-gold" data-act="tab" data-id="checkout" data-tip="Go to the check out screen">${ic('out')} Check out</button><button class="btn" data-act="tab" data-id="add" data-tip="Go to add books">${ic('scan')} Add books</button><button class="btn" data-act="refresh" data-tip="Load the latest data from the library">Refresh</button></div></div>
    ${statTile('Checked out today', S.checkouts.filter(c => c.CheckoutDate === today).length, `${act.filter(c => c.DueDate === today).length} due back today`, 'bt-a')}${statTile('Out right now', act.length, `of ${S.books.length} books`, 'bt-b')}
    ${statTile('Due in 3 days', soon.length, 'a gentle reminder', 'bt-d')}${statTile('Overdue', over.length, over.length ? 'ask for these back' : 'none', 'bt-c')}
    <div class="card col-span-2"><h2 class="font-display text-xl text-navy">Student forgot their list PIN?</h2><p class="text-sm text-slate-500">Resets the PIN only. Their saved books are kept, and they choose a new PIN next time.</p><div class="mt-3 flex gap-2"><input id="pin-roll" class="input" placeholder="Roll number" autocomplete="off"><button class="btn-gold shrink-0" data-act="reset-pin" data-tip="Let this student choose a new list PIN">Reset PIN</button></div></div>
    ${dueCard('Overdue', over, 'Nothing overdue.', copyPrint)}${dueCard('Due in the next 3 days', soon, 'Nothing due in the next 3 days.')}
    ${dueCard('Due in 4 to 7 days', week, 'Nothing due that week.')}
    <div class="card col-span-2"><h2 class="mb-2 font-display text-xl text-navy">Newest additions</h2><ul>${S.books.slice(-6).reverse().map(b => `<li class="truncate border-b border-stone-100 py-1.5 text-sm last:border-0">${esc(b.Title)}</li>`).join('') || none('No books yet.')}</ul></div></div>`;
};
const principalDash = () => {
  const c = S.checkouts, b = S.books, now = new Date(), key = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, mk = key(now);
  const act = c.filter(x => x.Returned !== 'Yes'), over = act.filter(x => daysLeft(x.DueDate) < 0), soon = act.filter(x => { const d = daysLeft(x.DueDate); return d >= 0 && d <= 3; });
  const perMonth = {}; c.forEach(x => { const m = x.CheckoutDate.slice(0, 7); if (m) perMonth[m] = (perMonth[m] || 0) + 1; });
  const months = Array.from({ length: 12 }, (_, i) => { const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1); return [d.toLocaleDateString('en-IN', { month: 'short' }), i === 0 || d.getMonth() === 0 ? String(d.getFullYear()) : '', perMonth[key(d)] || 0]; });
  const thisM = months[11][2], diff = thisM - months[10][2], days14 = Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - 13 + i); return c.filter(x => x.CheckoutDate === isoDay(d)).length; });
  const mine = c.filter(x => x.CheckoutDate.startsWith(mk)), poor = b.filter(x => x.Condition === 'Poor' || x.Condition === 'Damaged'), never = neverBorrowed();
  const oldest = over.length ? Math.max(...over.map(x => -daysLeft(x.DueDate))) : 0;
  const box = (title, inner, span = '') => `<div class="card ${span}"><h2 class="mb-3 font-display text-xl text-navy">${title}</h2>${inner}</div>`;
  const list = (rows, empty2) => `<ul class="text-sm">${rows.slice(0, 8).map(r => `<li class="border-b border-stone-100 py-1.5 last:border-0">${esc(r)}</li>`).join('') || `<li class="text-slate-500">${empty2}</li>`}</ul>${rows.length > 8 ? `<p class="mt-2 text-sm text-slate-500">and ${rows.length - 8} more</p>` : ''}`;
  return `<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
    <div class="card bt-e col-span-2 flex flex-col justify-between gap-4"><div><h1 class="h1">The library at a glance</h1><p class="text-slate-500">${dashDate()}</p></div>
      <div class="flex flex-wrap gap-2"><button class="btn-gold" data-act="tab" data-id="records" data-tip="All checkouts and returns">${ic('ledger')} Records</button><button class="btn" data-act="tab" data-id="analytics" data-tip="Charts and statistics">${ic('chart')} Stats</button><button class="btn" data-act="refresh" data-tip="Load the latest data from the library">Refresh</button></div></div>
    <div class="card col-span-2"><p class="text-sm font-bold text-slate-600">Checkouts, last 14 days</p><div class="mt-3 flex items-end justify-between gap-3"><p class="font-display text-5xl font-bold">${days14.reduce((x, y) => x + y, 0)}</p>${spark(days14)}</div></div>
    ${statTile('Books', b.length, `${new Set(b.map(x => x.Genre).filter(Boolean)).size} genres`, 'bt-a')}${statTile('Out right now', act.length, `${b.length ? Math.min(100, Math.round(act.length / b.length * 100)) : 0}% of the library`, 'bt-b')}
    ${statTile('Overdue', over.length, over.length ? `oldest ${oldest} days late` : 'none', 'bt-c')}${statTile('Readers this month', new Set(mine.map(x => x.RollNumber).filter(Boolean)).size, 'different roll numbers', 'bt-e')}
    ${statTile('This month', thisM, diff === 0 ? 'same as last month' : `${diff > 0 ? '+' : ''}${diff} vs last month`, 'bt-d')}${statTile('Needs attention', poor.length, poor.length ? 'poor or damaged books' : 'all books in good shape', poor.length ? 'bt-c' : 'bt-b')}
    ${statTile('Never borrowed', never.length, `${b.length ? Math.round(never.length / b.length * 100) : 0}% of the books`, 'bt-a')}${statTile('Due in 3 days', soon.length, 'coming back soon', 'bt-e')}
    ${dueCard('Overdue', over, 'Nothing overdue.', copyPrint)}
    ${box('Most borrowed this month', rankList(tally(mine.map(titleOf))), 'col-span-2')}
    ${box('Checkouts per month', `<div class="scroll-end overflow-x-auto"><div class="min-w-[520px] lg:min-w-0">${columnChart(months, 11)}</div></div>`, 'col-span-2 lg:col-span-4')}
    ${box('The collection', `<p class="label">Fiction and non-fiction</p>${splitBar(count(b.map(x => x.Genre)))}<p class="label mt-5">Condition of the books</p>${splitBar(count(b.map(x => x.Condition || 'Not noted')))}<p class="label mt-5">Age groups</p>${splitBar(count(b.map(x => x.AgeGroup || 'Not set')))}`, 'col-span-2')}
    <div class="col-span-2 grid content-start gap-3">${box(`Books needing attention (${poor.length})`, list(poor.map(x => `${x.BookID}  ${x.Title}  (${x.Condition})`), 'None. Every book is in fair or good condition.'))}
    ${box(`Never borrowed (${never.length})`, list(never.map(x => `${x.BookID}  ${x.Title}`), 'Every book has been borrowed at least once.'))}</div></div>`;
};
Object.assign(views, { dashboard: () => (S.role === 'principal' ? principalDash() : librarianDash()) });

// Records: filter by status, then export what is on screen
const filteredRecords = () => {
  const q = S.rq.toLowerCase().trim(), f = S.rstat;
  return S.checkouts.filter(c => (!q || c.RollNumber.toLowerCase().includes(q) || titleOf(c).toLowerCase().includes(q)) && (f === 'all' || (f === 'out' ? state(c) !== 'returned' : state(c) === f))).sort((a, b) => b.CheckoutDate.localeCompare(a.CheckoutDate));
};
const statusLabel = c => ({ returned: 'Returned', overdue: 'Overdue', active: 'Out' })[state(c)];
const recordsHead = () => {
  const n = f => S.checkouts.filter(c => f === 'all' || (f === 'out' ? state(c) !== 'returned' : state(c) === f)).length;
  const chip = (id, label) => `<button data-act="rstat" data-id="${id}" aria-pressed="${S.rstat === id}" class="pill !min-h-9 !px-3 !py-1.5 ${S.rstat === id ? 'bg-ink text-white' : ''}">${label} (${n(id)})</button>`;
  return `<div class="flex flex-wrap items-center justify-between gap-3"><h1 class="h1">Records</h1><div class="flex gap-2"><button class="btn" data-act="export-records" data-tip="Download what is shown below as a CSV file (opens in Excel)">${ic('install')} Export CSV</button><button class="btn" data-act="print-records" data-tip="Print what is shown below, or save it as a PDF">Print or PDF</button></div></div>
    <div class="mt-4 flex flex-wrap items-center gap-2">${chip('all', 'All')}${chip('out', 'Out now')}${chip('overdue', 'Overdue')}${chip('returned', 'Returned')}<input id="rq" class="input !w-auto min-w-48 flex-1 !min-h-9" placeholder="Search roll number or title" value="${esc(S.rq)}"></div>`;
};
function downloadCsv(name, rows) {
  const q = v => { let s = String(v ?? ''); if (/^[=+\-@]/.test(s)) s = "'" + s; return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };   // blocks spreadsheet formulas
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + rows.map(r => r.map(q).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' }));
  a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
Object.assign(S, { rstat: 'all' });
Object.assign(H, {
  rstat: id => { S.rstat = id; render(); },
  csv: () => downloadCsv('checkouts.csv', [['Roll', 'Title', 'BookID', 'Checked out', 'Due', 'Status'], ...S.checkouts.map(c => [c.RollNumber, titleOf(c), c.BookID, c.CheckoutDate, c.DueDate, statusLabel(c)])]),
  'export-records': () => { const rows = filteredRecords(); if (!rows.length) return toast('There are no records to export.', 'error'); downloadCsv(`records-${isoDay(new Date())}.csv`, [['Roll', 'Book', 'Book ID', 'Checked out', 'Due', 'Status'], ...rows.map(c => [c.RollNumber, titleOf(c), c.BookID, c.CheckoutDate, c.DueDate, statusLabel(c)])]); toast(`Exported ${rows.length} ${rows.length === 1 ? 'record' : 'records'}.`, 'success'); },
  'print-records': () => {
    const rows = filteredRecords(); if (!rows.length) return toast('There are no records to print.', 'error');
    const td = 'border-bottom:1px solid #999;padding:4px 8px;text-align:left';
    $('#printarea').innerHTML = `<h1 style="font:700 22px sans-serif">Checkout records, ${new Date().toLocaleDateString('en-IN')}</h1><p style="font:14px sans-serif">${esc(S.rstat === 'all' ? 'All records' : S.rstat === 'out' ? 'Books out now' : S.rstat === 'overdue' ? 'Overdue books' : 'Returned books')}${S.rq ? `, matching "${esc(S.rq)}"` : ''}: ${rows.length}</p>
      <table style="border-collapse:collapse;font:13px sans-serif;width:100%"><thead><tr>${['Roll', 'Book', 'Book ID', 'Checked out', 'Due', 'Status'].map(h => `<th style="${td}">${h}</th>`).join('')}</tr></thead><tbody>${rows.map(c => `<tr>${[c.RollNumber, titleOf(c), c.BookID, showDate(c.CheckoutDate), showDate(c.DueDate), statusLabel(c)].map(v => `<td style="${td}">${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    print();
  }
});

// ───────── Events ─────────
document.addEventListener('click', e => {
  if (S.open && !e.target.closest('[data-act="dd"]') && !e.target.closest('[id^="dd-"]')) { S.open = null; queueMicrotask(render); }
  const el = e.target.closest('[data-act]'); if (el) H[el.dataset.act]?.(el.dataset.id, el);
});
// Hover and keyboard-focus hints: a small box naming what a control does.
document.addEventListener('error', e => { if (e.target?.hasAttribute?.('data-hide-on-error')) e.target.remove(); }, true);   // hides the optional school photo if it is missing
const tipEl = document.body.appendChild(Object.assign(document.createElement('div'), { id: 'tip' }));
tipEl.setAttribute('role', 'tooltip');
const tipHide = () => { tipEl.style.display = 'none'; };
const tipShow = e => {
  const t = e.target.closest?.('[data-tip]');
  if (!t || !t.dataset.tip || !matchMedia('(hover: hover)').matches) return tipHide();
  tipEl.textContent = t.dataset.tip; tipEl.style.display = 'block';
  const r = t.getBoundingClientRect(), w = tipEl.offsetWidth, h = tipEl.offsetHeight;
  tipEl.style.left = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, innerWidth - w - 8)) + 'px';
  tipEl.style.top = (r.bottom + 8 + h < innerHeight ? r.bottom + 8 : r.top - h - 8) + 'px';
};
document.addEventListener('mouseover', tipShow); document.addEventListener('focusin', tipShow);
['mousedown', 'scroll', 'keydown'].forEach(ev => addEventListener(ev, tipHide, true));
document.addEventListener('keydown', e => {
  if (e.key === 'Tab') {   // keep keyboard focus inside an open dialog
    const d = document.querySelector('[role=dialog]');
    const f = d ? [...d.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(x => !x.disabled && x.getClientRects().length) : [];
    if (f.length) { const i = f.indexOf(document.activeElement); if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && (i === -1 || i === f.length - 1)) { e.preventDefault(); f[0].focus(); } }
  }
  if (e.key === 'Escape' && (S.login || S.confirm || S.report || S.surprise || S.display || S.open || S.listLogin)) H.close();
  if (e.key === 'Enter' && e.target.id === 'pw') { e.target.blur(); H.login(); }   // blur() closes the phone keyboard
  if (e.key === 'Enter' && e.target.id === 'll-pin') { e.target.blur(); H['list-go'](); }
  if (e.key === 'Enter' && ['q', 'cq', 'rq', 'repq', 'logq'].includes(e.target.id)) e.target.blur();
});
const applyDisplay = () => { document.documentElement.dataset.theme = S.theme;  };
applyDisplay();
addEventListener('online', syncQueue);
let deferredPrompt = null;
document.documentElement.lang = 'en';
addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; S.canInstall = true; if (!S.role && !S.login) render(); });
if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
const lists = { q: v => { S.q = v; refreshList('#list', bookList); }, cq: v => { S.cq = v; refreshList('#clist', checkoutList); }, rq: v => { S.rq = v; refreshList('#rlist', recordList); } };
const dl = { q: debounce(lists.q, 150), cq: debounce(lists.cq, 150), rq: debounce(lists.rq, 150) };
document.addEventListener('input', e => {
  const { id, value } = e.target;
  if (dl[id]) dl[id](value);
  if (id === 'roll') { S.roll = value; refreshList('#loans', loansBox); }
  if (id === 'days') { S.days = value; S.daysTouched = true; }
  if (id === 'repq') { S.repQ = value; refreshList('#replist', reportList); }
  if (id === 'logq') { S.logQ = value; refreshList('#loglist', logList); }
});
document.addEventListener('change', e => {
  if (e.target.id === 'lng-sel') { S.lng = e.target.value; render(); }
  if (e.target.id === 'age-sel') { S.age = e.target.value; render(); }
  if (e.target.id === 'avail') { S.avail = e.target.value; refreshList('#list', bookList); }
  if (e.target.id === 'f-genre') { readForm(); S.draft.SubGenre = []; render(); }
});

if (location.hash === OWNER_HASH) S.login = 'admin';
const savedToken = store.get('remember', null);
if (savedToken && !S.login) { S.resuming = true; resume(savedToken); }
render();
ping(); setInterval(() => { if (!document.hidden) ping(); }, 4 * 60 * 1000);   // keeps the backend warm so nothing waits on a cold start

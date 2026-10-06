import './style.css';
import { api, setToken, lookup } from './api.js';
import { startScan, stopScan } from './scanner.js';
import { QUOTES } from './quotes.js';
import { T } from './i18n.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"'`]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' }[c]));
const LOAN_LIMIT = 3; // warning only, never blocks. Change to your policy.
const FILL = ' fill="currentColor" fill-opacity=".22"';
const P = {
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
  student: { icon: '', get name() { return tr('role_student'); }, get desc() { return tr('desc_student'); } },
  librarian: { icon: '', get name() { return tr('role_librarian'); }, get desc() { return tr('desc_librarian'); } },
  principal: { icon: '', get name() { return tr('role_principal'); }, get desc() { return tr('desc_principal'); } }
};
const TABS = {
  student: [['catalogue', 'tab_cat', 'books'], ['list', 'tab_list', 'heart']],
  staff: [['dashboard', 'Home', 'home'], ['checkout', 'Check out', 'out'], ['records', 'Records', 'ledger'], ['catalogue', 'Books', 'books'], ['add', 'Add', 'plus']]
};

const store = { get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
const S = { role: null, tab: 'catalogue', books: [], checkouts: [], genres: [], q: '', avail: '', sg: '', lng: '', age: '', editId: null, theme: store.get('theme', 'bento'), big: store.get('big', false), display: false, loading: false, lang: store.get('lang', 'en'), list: store.get('list', []), surprise: null, report: null, reports: [], canInstall: false, cq: '', rq: '', roll: '', days: 14, pick: null,
  login: null, confirm: null, scanning: false, draft: null, results: [], sticky: { genre: 'Fiction', age: '', cond: 'Good', lang: 'English' } };

const isStaff = () => S.role && S.role !== 'student';
const tabsFor = () => S.role === 'student' ? TABS.student : S.role === 'principal' ? [...TABS.staff, ['analytics', 'Stats', 'chart'], ['genres', 'Genres', 'tag'], ['reports', 'Reports' + (S.reports.filter(r => r.Status !== 'Resolved').length ? ` (${S.reports.filter(r => r.Status !== 'Resolved').length})` : ''), 'flag']] : TABS.staff;
const tr = k => ((isStaff() ? T.en : T[S.lang] || T.en)[k]) ?? T.en[k] ?? k;
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

const loadReports = async () => { S.reports = await api('getReports'); };
async function load() {
  const d = await api('getAll');
  // Same rule as your old app: anything that is not exactly 'No' counts as available.
  S.books = (d.inventory || []).filter(b => b.BookID && b.BookID !== 'REMOVED').map(b => ({ ...b, Available: b.Available === 'No' ? 'No' : 'Yes' }));
  S.checkouts = d.checkouts || [];
  S.genres = d.genres || [];
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
  const rows = S.books.filter(b => matches(b, q) && (!S.avail || b.Available === S.avail) && (!S.sg || String(b.SubGenre || '').split('|').includes(S.sg)) && (!S.lng || b.Language === S.lng) && (!S.age || b.AgeGroup === S.age)).slice(0, 400);
  if (!rows.length) return ul(noMatch());
  const acts = b => (S.role === 'student' ? favBtn(b) : '') + (isStaff() ? `<button class="btn !px-2.5 !py-1 text-xs" data-act="edit" data-id="${esc(b.BookID)}">Edit</button>` : '') + (S.role === 'principal' && b.Available === 'Yes' ? `<button class="btn-red !px-2.5 !py-1 text-xs" data-act="ask-remove" data-id="${esc(b.BookID)}">Remove</button>` : '');
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
  return rows.length ? rows.map(b => bookCard(b, `<button class="btn-gold !py-1 text-xs" data-act="pick" data-id="${esc(b.BookID)}">Select</button>`)).join('') : empty('No available copy found.');
};
const recordList = () => {
  const q = S.rq.toLowerCase().trim();
  const rows = S.checkouts.filter(c => !q || c.RollNumber.toLowerCase().includes(q) || c.Title.toLowerCase().includes(q)).sort((a, b) => b.CheckoutDate.localeCompare(a.CheckoutDate)).slice(0, 300);
  if (!rows.length) return `<ul class="grid gap-3">${empty('No records yet.')}</ul>`;
  const chip = c => { const st = state(c), d = daysLeft(c.DueDate); return st === 'returned' ? '<span class="pill">Returned</span>' : st === 'overdue' ? `<span class="pill bad">${-d}d overdue</span>` : `<span class="pill ${d <= 3 ? 'warn' : 'ok'}">Due in ${d}d</span>`; };
  const ret = c => state(c) !== 'returned' ? `<button class="btn-gold !min-h-9 !py-1 text-xs" data-act="return" data-id="${esc(c.CheckoutID)}">Return</button>` : '';
  const cards = rows.map(c => `<li class="card flex items-center justify-between gap-3"><div class="min-w-0"><p class="font-bold text-navy">${esc(c.Title)}</p><p class="text-sm text-slate-500">Roll ${esc(c.RollNumber)}, out ${showDate(c.CheckoutDate)}, due ${showDate(c.DueDate)}</p></div><div class="flex flex-col items-end gap-2">${chip(c)}${ret(c)}</div></li>`).join('');
  const td = 'px-3 py-2';
  const trs = rows.map(c => `<tr class="border-b border-stone-100"><td class="${td} font-bold">${esc(c.RollNumber)}</td><td class="${td}">${esc(c.Title)}</td><td class="${td} font-mono text-xs">${esc(c.BookID)}</td><td class="${td}">${showDate(c.CheckoutDate)}</td><td class="${td}">${showDate(c.DueDate)}</td><td class="${td}">${chip(c)}</td><td class="${td} text-right">${ret(c)}</td></tr>`).join('');
  return `<ul class="grid gap-3 lg:hidden">${cards}</ul><div class="card hidden overflow-x-auto !p-0 lg:block"><table class="w-full text-left text-sm"><thead class="bg-ink text-white"><tr>${['Roll no.', 'Book', 'Book ID', 'Checked out', 'Due', 'Status', ''].map(h => `<th class="px-3 py-2.5 font-bold">${h}</th>`).join('')}</tr></thead><tbody>${trs}</tbody></table></div>`;
};

const favBtn = (b, c = '!px-2.5 !py-1 text-xs') => `<button class="btn ${c}" data-act="fav" data-id="${esc(b.BookID)}">${ic('heart', 'h-4 w-4', S.list.includes(b.BookID))} ${S.list.includes(b.BookID) ? tr('saved') : tr('save')}</button>`;
const noMatch = () => `<li class="card col-span-full text-center text-slate-600">${tr('nomatch')}<br><button class="btn mt-3" data-act="report-open" data-id="t_missing">${ic('flag')} ${tr('report')}</button></li>`;
const langBar = () => `<div class="flex gap-1">${[['en', 'EN'], ['ta', 'தமிழ்'], ['hi', 'हिन्दी']].map(([k, l]) => `<button data-act="lang" data-id="${k}" class="rounded-md px-2 py-1 text-xs ${S.lang === k ? 'bg-gold font-semibold text-navy' : 'border border-white/20 text-white/70'}">${l}</button>`).join('')}</div>`;
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone;
const installBlock = () => standalone() ? '' : S.canInstall ? `<div class="mt-8 text-center"><button class="btn-gold" data-act="install">${ic('install')} ${tr('install')}</button></div>` : /iphone|ipad|ipod/i.test(navigator.userAgent) ? `<p class="mt-8 text-center text-sm text-white/60">${tr('iosHint')}</p>` : '';
const daySeed = () => { const d = new Date(); return d.getFullYear() * 400 + d.getMonth() * 32 + d.getDate(); };
const TILES = ['tile-b', 'tile-c', 'tile-a', 'tile-e'];
const discover = () => {
  const open = S.books.filter(b => b.Available === 'Yes'), b = open.length ? open[daySeed() % open.length] : null, qq = QUOTES.length ? QUOTES[daySeed() % QUOTES.length] : null;
  const sgs = b ? String(b.SubGenre || '').split('|').filter(Boolean).map(s => `<span class="pill">${esc(s)}</span>`).join('') : '';
  const count = {}; S.books.forEach(x => String(x.SubGenre || '').split('|').filter(Boolean).forEach(g => { count[g] = (count[g] || 0) + 1; }));
  const genres = Object.entries(count).sort((x, y) => y[1] - x[1]).slice(0, S.role === 'student' ? 7 : 8);
  return `<section class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
    <div class="card tile-e relative col-span-2 flex flex-col justify-between gap-8 overflow-hidden sm:col-span-4 sm:flex-row sm:items-end"><img src="/school.jpg" alt="" onerror="this.remove()" class="absolute inset-0 h-full w-full object-cover opacity-20">
      <div class="relative"><h2 class="font-display text-4xl leading-tight sm:text-6xl">${tr('hero')}</h2><p class="mt-2 text-white/80">${S.books.length} ${tr('booksWord')}, ${open.length} ${tr('availnow')}</p></div>
      <button data-act="surprise" class="btn-gold relative shrink-0">${ic('dice')} ${tr('surprise')}</button></div>
    ${b ? `<div class="card tile-d ${qq ? 'col-span-2' : 'col-span-2 sm:col-span-4'}"><h2 class="font-display text-xl">${tr('bod')}</h2><p class="font-display mt-3 text-3xl leading-tight">${esc(b.Title)}</p><p class="mt-1">${esc(b.Author)}</p><div class="mt-3 flex flex-wrap gap-1">${sgs}<span class="pill ok">${tr('availnow')}</span></div></div>` : ''}
    ${qq ? `<div class="card tile-a col-span-2"><h2 class="font-display text-xl">${tr('quote')}</h2><p class="mt-3 text-lg leading-snug">${esc(qq[0])}</p><p class="mt-2 text-sm text-white/80">${esc(qq[1])}</p></div>` : ''}
    ${genres.map(([g, n], i) => `<button data-act="sg" data-id="${esc(g)}" class="card ${TILES[i % 4]} flex min-h-28 flex-col justify-between text-left"><span class="font-display text-2xl leading-tight">${esc(g)}</span><span class="text-sm">${n} ${tr('booksWord')}</span></button>`).join('')}
    ${S.role === 'student' ? `<button data-act="tab" data-id="list" class="card tile-d flex min-h-28 flex-col justify-between text-left">${ic('heart', 'h-8 w-8')}<span class="font-display text-2xl">${tr('tab_list')} (${S.list.length})</span></button>` : ''}</section>`;
};
const isoDay = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const spark = v => { const mx = Math.max(1, ...v), pts = v.map((n, i) => `${(i / (v.length - 1)) * 120},${36 - (n / mx) * 32}`).join(' '); return `<svg viewBox="0 0 120 40" class="h-12 w-32 text-gold" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><polyline points="${pts}"/></svg>`; };
const strip = (title, books) => books.length ? `<section class="mb-6"><h2 class="font-display mb-2 text-2xl text-navy">${title}</h2><ul class="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">${books.map(b => `<li class="card w-44 shrink-0 !p-3"><p class="line-clamp-2 font-bold text-navy">${esc(b.Title)}</p><p class="line-clamp-1 text-sm text-slate-500">${esc(b.Author)}</p><span class="pill mt-2 ${b.Available === 'Yes' ? 'ok' : 'warn'}">${b.Available === 'Yes' ? tr('available') : tr('out')}</span></li>`).join('')}</ul></section>` : '';
const strips = () => strip(tr('newArr'), S.books.slice(-8).reverse()) + strip(tr('mostB'), S.books.filter(b => +b.Borrows > 0).sort((a, b) => b.Borrows - a.Borrows).slice(0, 8));
const chipRow = (act, items, cur) => items.length > 1 ? `<div class="mt-2 flex gap-2 overflow-x-auto pb-1" role="group">${['', ...items].map(s => `<button data-act="${act}" data-id="${esc(s)}" aria-pressed="${cur === s}" class="pill shrink-0 !min-h-9 !px-3 !py-1.5 ${cur === s ? 'bg-ink text-white' : ''}">${s ? esc(s) : tr('all')}</button>`).join('')}</div>` : '';
const neverBorrowed = () => { const seen = new Set(S.checkouts.map(c => c.BookID)); return S.books.filter(b => !seen.has(b.BookID)); };
const loansOf = r => S.checkouts.filter(c => r && c.RollNumber === r && c.Returned !== 'Yes');
const loansBox = () => { const r = S.roll.trim(), l = loansOf(r); if (!r) return ''; const over = l.filter(c => daysLeft(c.DueDate) < 0).length; return `<div class="card mb-4 ${over || l.length >= LOAN_LIMIT ? 'border-2 border-red-600' : ''}"><p class="font-bold text-navy">Roll ${esc(r)} has ${l.length} ${l.length === 1 ? 'book' : 'books'} out${over ? `, ${over} overdue` : ''}</p>${l.map(c => `<p class="text-sm text-slate-500">${esc(c.Title)}, due ${showDate(c.DueDate)}</p>`).join('')}</div>`; };
const recentRolls = () => { const r = store.get('rolls', []); return r.length ? `<div class="mb-3 flex flex-wrap gap-2">${r.map(x => `<button class="pill !min-h-9 !px-3" data-act="roll" data-id="${esc(x)}">${esc(x)}</button>`).join('')}</div>` : ''; };
const overdueText = () => { const by = {}; S.checkouts.filter(c => state(c) === 'overdue').forEach(c => (by[c.RollNumber] ||= []).push(c)); return Object.entries(by).map(([r, l]) => `Roll ${r}: ` + l.map(c => `${c.Title} (due ${showDate(c.DueDate)}, ${-daysLeft(c.DueDate)} days late)`).join('; ')).join('\n'); };
const queued = () => store.get('queue', []);
async function syncQueue() {
  let q = queued(); if (!q.length || !S.role || S.role === 'student') return;
  try { while (q.length) { await api('addBook', { book: q[0] }); q = q.slice(1); store.set('queue', q); } toast('Saved books synced.', 'success'); await load(); render(); } catch {}
}

const sgChipsOld = () => { const all = [...new Set(S.books.flatMap(b => String(b.SubGenre || '').split('|').filter(Boolean)))].sort(); return all.length ? `<div class="mt-2 flex gap-2 overflow-x-auto pb-1">${['', ...all].map(s => `<button data-act="sg" data-id="${esc(s)}" class="pill shrink-0 !px-3 !py-1.5 ${S.sg === s ? 'bg-ink text-white' : ''}">${s ? esc(s) : tr('all')}</button>`).join('')}</div>` : ''; };
const sgChips = () => chipRow('sg', [...new Set(S.books.flatMap(b => String(b.SubGenre || '').split('|').filter(Boolean)))].sort(), S.sg) + chipRow('lng', LANGS, S.lng) + chipRow('age', AGES, S.age);
const tally = a => { const m = {}; a.forEach(k => { if (k) m[k] = (m[k] || 0) + 1; }); return Object.entries(m).sort((x, y) => y[1] - x[1]).slice(0, 8); };
const bars = rows => { const mx = Math.max(1, ...rows.map(r => r[1])); return rows.length ? rows.map(([k, n]) => `<div class="mb-2"><div class="flex justify-between gap-2 text-sm"><span class="truncate">${esc(k)}</span><span>${n}</span></div><div class="h-2 rounded bg-stone-100"><div class="h-2 rounded bg-ink" style="width:${n / mx * 100}%"></div></div></div>`).join('') : '<p class="text-sm text-slate-500">No data yet.</p>'; };

const views = {
  catalogue: () => `${!S.q && !S.avail && !S.sg && !S.lng && !S.age ? discover() + strips() : ''}<div class="flex items-center justify-between gap-3"><h1 class="h1">${S.role === 'student' ? tr('title') : 'Books'}</h1></div>
    <div class="sticky top-14 z-10 -mx-4 bg-parchment/95 px-4 py-2 sm:static sm:mx-0 sm:px-0"><div class="flex gap-2"><input id="q" class="input flex-1" placeholder="${esc(tr('search'))}" value="${esc(S.q)}">
    <select id="avail" class="input !w-auto"><option value="">${tr('all')}</option><option value="Yes" ${S.avail === 'Yes' ? 'selected' : ''}>${tr('available')}</option><option value="No" ${S.avail === 'No' ? 'selected' : ''}>${tr('out')}</option></select></div>${sgChips()}</div>
    <div id="list" class="mt-2">${bookList()}</div>`,

  dashboard: () => {
    const act = S.checkouts.filter(c => c.Returned !== 'Yes'), over = act.filter(c => daysLeft(c.DueDate) < 0), soon = act.filter(c => { const d = daysLeft(c.DueDate); return d >= 0 && d <= 3; });
    const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - 13 + i); return S.checkouts.filter(c => c.CheckoutDate === isoDay(d)).length; });
    const row = c => `<li class="flex justify-between gap-2 border-b border-stone-100 py-2 text-sm"><span class="truncate">${esc(c.Title)}</span><span class="shrink-0 text-slate-500">Roll ${esc(c.RollNumber)}, ${showDate(c.DueDate)}</span></li>`;
    const none = t => `<p class="text-sm text-slate-500">${t}</p>`;
    const stat = (n, l, cls = '') => `<div class="card flex flex-col justify-between"><p class="text-sm font-bold text-slate-600">${l}</p><p class="font-display mt-4 text-5xl font-bold ${cls}">${n}</p></div>`;
    const month = tally(S.checkouts.map(x => x.CheckoutDate.slice(0, 7))).sort((a, b) => a[0].localeCompare(b[0]));
    return `<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div class="card col-span-2 flex flex-col justify-between gap-4"><div><h1 class="h1">Today at the library</h1><p class="text-slate-500">${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p></div>
        <div class="flex flex-wrap gap-2"><button class="btn-gold" data-act="tab" data-id="checkout">${ic('out')} Check out</button><button class="btn" data-act="tab" data-id="add">${ic('scan')} Add books</button></div></div>
      <div class="card col-span-2"><p class="text-sm font-bold text-slate-600">Checkouts, last 14 days</p><div class="mt-3 flex items-end justify-between gap-3"><p class="font-display text-5xl font-bold">${days.reduce((a, b) => a + b, 0)}</p>${spark(days)}</div></div>
      ${stat(S.books.length, 'Books')}${stat(act.length, 'Checked out')}${stat(soon.length, 'Due in 3 days', 'text-amber-700')}${stat(over.length, 'Overdue', 'text-red-800')}
      <div class="card col-span-2 row-span-2"><div class="mb-2 flex items-center justify-between gap-2"><h2 class="font-display text-xl text-navy">Overdue</h2><div class="flex gap-2"><button class="btn !min-h-9 !px-3" data-act="copy-overdue">Copy</button><button class="btn !min-h-9 !px-3" data-act="print-overdue">Print</button></div></div><ul>${over.slice(0, 8).map(row).join('') || none('Nothing overdue.')}</ul></div>
      <div class="card col-span-2"><h2 class="mb-2 font-display text-xl text-navy">Due soon</h2><ul>${soon.slice(0, 5).map(row).join('') || none('Nothing due in the next 3 days.')}</ul></div>
      <div class="card col-span-2"><h2 class="mb-2 font-display text-xl text-navy">Newest additions</h2><ul>${S.books.slice(-5).reverse().map(b => `<li class="truncate border-b border-stone-100 py-1.5 text-sm">${esc(b.Title)}</li>`).join('') || none('No books yet.')}</ul></div>
      <div class="card col-span-2"><h2 class="mb-3 font-display text-xl text-navy">Checkouts per month</h2>${bars(month)}</div>
      <div class="card col-span-2"><h2 class="mb-2 font-display text-xl text-navy">Never borrowed (${neverBorrowed().length})</h2><ul>${neverBorrowed().slice(0, 8).map(b => `<li class="truncate border-b border-stone-100 py-1.5 text-sm">${esc(b.Title)}</li>`).join('') || none('Every book has been borrowed.')}</ul></div></div>`;
  },

  checkout: () => {
    const b = S.books.find(x => x.BookID === S.pick);
    return `<h1 class="h1">Check out a book</h1><div class="card my-4 grid gap-3 sm:grid-cols-2">
      <div><label class="label" for="roll">Roll number</label><input id="roll" class="input" inputmode="text" value="${esc(S.roll)}" placeholder="e.g. 1371"></div>
      <div><label class="label" for="days">Loan days</label><input id="days" type="number" min="1" max="90" class="input" value="${S.days}"></div></div>${recentRolls()}<div id="loans">${loansBox()}</div>
      ${b ? `<div class="card mb-4 border-gold"><p class="label">Selected</p><p class="font-semibold text-navy">${esc(b.Title)}</p><p class="text-sm text-slate-500">${esc(b.Author)} · ${esc(b.BookID)}</p></div>` : `
      <input id="cq" class="input mb-3" placeholder="Search for the book to lend" value="${esc(S.cq)}"><ul id="clist" class="mb-4 grid gap-3">${checkoutList()}</ul>`}
      <button class="btn-gold w-full" data-act="checkout">Confirm check out</button>
      ${b ? `<button class="btn mt-2 w-full" data-act="unpick">Choose a different book</button>` : ''}`;
  },

  records: () => `<h1 class="h1">Records</h1><input id="rq" class="input my-4" placeholder="Search roll number or title" value="${esc(S.rq)}"><div id="rlist">${recordList()}</div>`,

  list: () => { const rows = S.list.map(id => S.books.find(b => b.BookID === id)).filter(Boolean); return `<h1 class="h1">${tr('tab_list')}</h1><ul class="mt-4 grid gap-3 sm:grid-cols-2">${rows.length ? rows.map(b => bookCard(b, favBtn(b))).join('') : empty(tr('emptylist'))}</ul>`; },
  reports: () => {
    const rows = [...S.reports].sort((a, b) => (a.Status === 'Resolved') - (b.Status === 'Resolved') || b.Date.localeCompare(a.Date));
    return `<h1 class="h1">Reports</h1><ul class="mt-4 grid gap-3">${rows.length ? rows.map(r => `<li class="card ${r.Status === 'Resolved' ? 'opacity-60' : ''}"><div class="flex flex-wrap items-center gap-2"><span class="pill ${r.Status === 'Resolved' ? 'ok' : 'warn'}">${esc(r.Status || 'Open')}</span><span class="pill">${esc(r.Type)}</span><span class="pill">${esc(r.Role)}</span><span class="text-xs text-slate-500">${showDate(r.Date)}</span></div>
      <p class="mt-2 whitespace-pre-wrap text-sm">${esc(r.Message)}</p>${r.Contact ? `<p class="mt-1 text-xs text-slate-500">From: ${esc(r.Contact)}</p>` : ''}<button class="btn mt-3 !py-1 text-xs" data-act="resolve" data-id="${esc(r.ReportID)}">${r.Status === 'Resolved' ? 'Reopen' : 'Mark resolved'}</button></li>`).join('') : empty('No reports yet.')}</ul>`;
  },
  analytics: () => {
    const by = Object.fromEntries(S.books.map(b => [b.BookID, b])), c = S.checkouts;
    const cards = [['Most borrowed books', tally(c.map(x => x.Title))], ['Checkouts by sub-genre', tally(c.flatMap(x => String((by[x.BookID] || {}).SubGenre || '').split('|')))],
      ['Most active readers (roll no.)', tally(c.map(x => x.RollNumber))], ['Checkouts per month', tally(c.map(x => x.CheckoutDate.slice(0, 7))).sort((a, b) => a[0].localeCompare(b[0]))]];
    return `<h1 class="h1">Analytics</h1><div class="my-4 flex justify-end"><button class="btn" data-act="csv">${ic('install')} Export checkouts (CSV)</button></div><div class="grid gap-4 sm:grid-cols-2">${cards.map(([t, r]) => `<div class="card"><h2 class="mb-3 font-semibold text-navy">${t}</h2>${bars(r)}</div>`).join('')}</div>`;
  },
  genres: () => `<h1 class="h1">Genres</h1><div class="mt-4 grid gap-4 sm:grid-cols-2"><div class="card grid gap-3"><div><label class="label" for="g-parent">Parent genre</label><select id="g-parent" class="input"><option>Fiction</option><option>Non-Fiction</option></select></div>
    <div><label class="label" for="g-name">New sub-genre</label><input id="g-name" class="input"></div><button class="btn-gold" data-act="addgenre">Add sub-genre</button></div>
    <div class="card">${['Fiction', 'Non-Fiction'].map(g => `<p class="label">${g}</p><div class="mb-3 flex flex-wrap gap-1">${subs(g).map(s => `<span class="pill">${esc(s)}</span>`).join('')}</div>`).join('')}</div></div>`,

  add: () => {
    const d = S.draft, dup = d.ISBN && S.books.filter(b => b.ISBN === d.ISBN);
    const opts = (arr, v) => arr.map(x => `<option ${x === v ? 'selected' : ''}>${esc(x)}</option>`).join('');
    return `<h1 class="h1">${S.editId ? 'Edit book ' + esc(S.editId) : 'Add books'}</h1>${S.editId ? '' : '<button class="btn-gold mt-4 w-full !py-4 text-base" data-act="scan">' + ic('scan') + ' Scan ISBN barcode</button><p class="my-2 text-center text-sm text-slate-500">No barcode, or the scan finds nothing? Type the title and author, then tap Look up.</p>'}
    ${queued().length ? `<p class="card mt-3 text-sm font-bold">${queued().length} saved on this phone, waiting to sync.</p>` : ''}<div class="card mt-3 grid gap-3">
      <div><label class="label" for="f-title">Title</label><input id="f-title" class="input" value="${esc(d.Title)}"></div>
      <div><label class="label" for="f-author">Author</label><input id="f-author" class="input" value="${esc(d.Author)}"></div>
      <div><label class="label" for="f-isbn">ISBN <span class="font-normal">(optional)</span></label><input id="f-isbn" class="input" inputmode="numeric" value="${esc(d.ISBN)}"></div>
      <button class="btn" data-act="search">${ic('search')} Look up details online</button>
      ${S.results.length ? `<ul class="grid gap-2">${S.results.map((r, i) => `<li><button class="card w-full text-left hover:border-gold" data-act="use" data-id="${i}"><span class="font-semibold text-navy">${esc(r.title)}</span><br><span class="text-sm text-slate-500">${esc(r.author)}</span></button></li>`).join('')}</ul>` : ''}
      ${dup && dup.length ? `<p class="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Already in the library (${esc(dup.map(b => b.BookID).join(', '))}). Saving adds another copy with its own ID.</p>` : ''}
      <div class="grid grid-cols-2 gap-3"><div><label class="label" for="f-genre">Genre</label><select id="f-genre" class="input">${opts(['Fiction', 'Non-Fiction'], d.Genre)}</select></div>
      <div><label class="label" for="f-lang">Language</label><select id="f-lang" class="input"><option value="">Not specified</option>${opts(LANGS, d.Language)}</select></div></div>
      <div><p class="label">Sub-genres (pick one or more)</p><div class="flex flex-wrap gap-2">${[...new Set([...subs(d.Genre), ...d.SubGenre])].map(s => `<label class="cursor-pointer"><input type="checkbox" class="peer sr-only" name="sg" value="${esc(s)}" ${d.SubGenre.includes(s) ? 'checked' : ''}><span class="pill peer-checked:bg-ink peer-checked:text-white peer-focus-visible:outline-2">${esc(s)}</span></label>`).join('')}</div></div>
      <div class="grid grid-cols-2 gap-3"><div><label class="label" for="f-age">Age group</label><select id="f-age" class="input"><option value="">Not specified</option>${opts(AGES, d.AgeGroup)}</select></div>
      <div><label class="label" for="f-cond">Condition</label><select id="f-cond" class="input"><option value="">Not noted</option>${opts(CONDS, d.Condition)}</select></div></div>
      <div><label class="label" for="f-works">Contained titles <span class="font-normal">(compilations only, one per line)</span></label><textarea id="f-works" rows="2" class="input">${esc(d.ContainedWorks.split('|').join('\n'))}</textarea></div>
      ${S.editId ? '<button class="btn" data-act="cancel-edit">Cancel</button>' : '<label class="flex items-center gap-2 text-sm"><input type="checkbox" id="batch" checked> Open the scanner again after saving</label>'}
      <button class="btn-gold" data-act="save">${S.editId ? 'Save changes' : 'Save book'}</button></div>`;
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
const landing = () => `<main class="relative min-h-dvh overflow-hidden bg-ink p-6 text-white print:hidden"><img src="/school.jpg" alt="" onerror="this.remove()" class="absolute inset-0 h-full w-full object-cover opacity-20">
  <div class="relative mx-auto flex min-h-[calc(100dvh-3rem)] max-w-3xl flex-col justify-between gap-10"><div class="flex flex-wrap justify-between gap-2">${langBar()}<button class="btn !min-h-10 !px-3" data-act="display" aria-label="Display settings">${ic('display')}</button></div>
  <div><img src="/logo.png" alt="Santa Maria School crest" class="mb-6 h-28 w-auto"><h1 class="font-display text-5xl sm:text-7xl">${tr('library')}</h1><p class="mt-3 text-lg text-white/75">Santa Maria Matriculation Higher Secondary School</p></div>
  <div class="grid gap-5"><button data-act="role" data-id="student" class="btn-gold !min-h-16 !justify-between !text-xl"><span>${tr('role_student')}</span>${ic('books', 'h-7 w-7')}</button>
  <div class="flex flex-wrap items-center gap-3 text-sm text-white/75"><span>${tr('staff')}</span><button class="btn !min-h-10" data-act="role" data-id="librarian">${tr('role_librarian')}</button><button class="btn !min-h-10" data-act="role" data-id="principal">${tr('role_principal')}</button></div>${installBlock()}</div></div></main>`;

function shell() {
  const tabs = tabsFor(), staff = isStaff(), v = views[S.tab](), narrow = staff && ['add', 'checkout'].includes(S.tab);
  const side = staff ? `<aside class="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col justify-between border-r border-white/10 bg-ink p-4 text-white lg:flex">
    <div><div class="flex items-center gap-3 px-2 pb-6"><img src="/logo.png" alt="" class="h-12 w-auto"><div><p class="font-display text-xl leading-tight">Library</p><p class="text-xs text-white/70">${tr('role_' + S.role)}</p></div></div>
    <nav class="grid gap-1">${tabs.map(x => `<button data-act="tab" data-id="${x[0]}" class="navbtn gap-3 !justify-start !text-base ${S.tab === x[0] ? 'on' : ''}">${ic(x[2])}${tr(x[1])}</button>`).join('')}</nav></div>
    <div class="grid gap-2"><button class="navbtn gap-3 border border-white/20 !justify-start" data-act="report-open" data-id="t_other">${ic('flag')}${tr('report')}</button><button class="navbtn gap-3 border border-white/20 !justify-start" data-act="display">${ic('display')}Display</button><button class="navbtn border border-white/20 !justify-start" data-act="logout">${tr('signout')}</button></div></aside>` : '';
  return `<div class="min-h-dvh ${staff ? 'lg:flex' : ''} ${tabs.length > 1 ? 'pb-20 ' + (staff ? 'lg:pb-0' : 'sm:pb-0') : ''}">${side}
  <div class="min-w-0 flex-1"><header class="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-white/10 bg-ink px-4 py-3 text-white sm:px-8 ${staff ? 'lg:hidden' : ''}">
    <div class="flex items-center gap-3"><img src="/logo.png" alt="" class="h-8 w-auto"><span class="font-display hidden text-lg sm:inline">Library</span><span class="hidden rounded-full bg-white/10 px-3 py-1 text-xs sm:inline">${ROLES[S.role].name}</span></div>
    ${tabs.length > 1 && !staff ? `<nav class="hidden gap-1 sm:flex">${tabs.map(x => `<button data-act="tab" data-id="${x[0]}" class="navbtn ${S.tab === x[0] ? 'on' : ''}">${tr(x[1])}</button>`).join('')}</nav>` : ''}
    <div class="flex items-center gap-2">${S.role === 'student' ? langBar() : ''}<button class="navbtn border border-white/20" data-act="report-open" data-id="t_other" aria-label="${esc(tr('report'))}">${ic('flag')}</button><button class="navbtn border border-white/20" data-act="display" aria-label="Display settings">${ic('display')}</button><button class="navbtn border border-white/20" data-act="logout">${tr('signout')}</button></div></header>
  <main class="mx-auto p-4 ${staff ? 'max-w-7xl sm:p-6 lg:p-10' : 'max-w-5xl sm:p-8'}">${narrow ? `<div class="mx-auto max-w-3xl">${v}</div>` : v}</main></div>
  ${tabs.length > 1 ? `<nav class="fixed inset-x-0 bottom-0 z-20 flex overflow-x-auto border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)] ${staff ? 'lg:hidden' : 'sm:hidden'}">${tabs.map(x => `<button data-act="tab" data-id="${x[0]}" class="flex min-w-[4.5rem] flex-1 flex-col items-center py-2 text-xs ${S.tab === x[0] ? 'font-bold text-navy' : 'text-slate-500'}">${ic(x[2])}${tr(x[1])}</button>`).join('')}</nav>` : ''}</div>`;
}

function overlays() {
  if (S.scanning) return `<div class="fixed inset-0 z-50 flex flex-col bg-black"><p class="p-4 text-center text-sm text-white">Point the camera at the barcode on the back of the book</p><div id="reader" class="flex-1"></div><button class="btn m-4" data-act="cancel-scan">Cancel</button></div>`;
  const box = inner => `<div class="fixed inset-0 z-50 grid place-items-center bg-ink/70 p-4"><div role="dialog" aria-modal="true" class="w-full max-w-sm rounded-2xl bg-white p-6">${inner}</div></div>`;
  if (S.login) return box(`<h2 class="font-display text-2xl text-navy">${ROLES[S.login].name}</h2><label class="label mt-4" for="pw">${tr('password')}</label><input id="pw" type="password" class="input" autocomplete="current-password">
    <p id="lerr" class="mt-2 hidden text-sm text-red-800"></p><button class="btn-gold mt-4 w-full" data-act="login">${tr('signin')}</button><button class="btn mt-2 w-full" data-act="close">${tr('back2')}</button>`);
  if (S.confirm) { const b = S.books.find(x => x.BookID === S.confirm); return box(`<h2 class="font-display text-xl text-navy">Remove this book?</h2><p class="my-3 text-sm text-slate-600">${esc(b?.Title)} (${esc(S.confirm)}) will be deleted from the catalogue.</p>
    <div class="flex gap-2"><button class="btn flex-1" data-act="close">Keep</button><button class="btn-red flex-1" data-act="remove">Remove</button></div>`); }
  if (S.display) return box(`<h2 class="font-display text-2xl text-navy">Display</h2><p class="label mt-4">Theme</p><div class="grid gap-2">${[['light', 'Paper', 'Warm and calm'], ['dark', 'Night', 'High contrast, easy on the eyes'], ['bento', 'Bento', 'Navy tiles with gold accents']].map(([k, n, d]) => `<button data-act="theme" data-id="${k}" aria-pressed="${S.theme === k}" class="btn !justify-between ${S.theme === k ? '!bg-gold !text-ink' : ''}"><span>${n}</span><span class="text-xs font-normal">${d}</span></button>`).join('')}</div>
    <p class="label mt-4">Text size</p><div class="grid grid-cols-2 gap-2">${[['', 'Normal'], ['big', 'Large']].map(([k, n]) => `<button data-act="size" data-id="${k}" aria-pressed="${S.big === !!k}" class="btn ${S.big === !!k ? '!bg-gold !text-ink' : ''}">${n}</button>`).join('')}</div><button class="btn-gold mt-5 w-full" data-act="close">Done</button>`);
  if (S.surprise) {
    const b = S.books.find(x => x.BookID === S.surprise);
    if (b) return box(`<p class="text-sm font-semibold text-amber-700">${tr('surprise')}</p><h2 class="font-display mt-2 text-2xl text-navy">${esc(b.Title)}</h2><p class="text-slate-500">${esc(b.Author)}</p>
      <div class="mt-3 flex flex-wrap gap-1">${String(b.SubGenre || '').split('|').filter(Boolean).map(x => `<span class="pill">${esc(x)}</span>`).join('')}<span class="pill ok">${tr('availnow')}</span></div>
      <div class="mt-5 flex gap-2"><button class="btn flex-1" data-act="surprise">${tr('another')}</button>${S.role === 'student' ? favBtn(b, 'flex-1') : ''}<button class="btn-gold flex-1" data-act="close">${tr('close')}</button></div>`);
  }
  if (S.report) {
    const r = S.report;
    return box(`<h2 class="font-display text-xl text-navy">${tr('report')}</h2><label class="label mt-4" for="r-type">${tr('what')}</label>
      <select id="r-type" class="input">${['t_missing', 't_wrong', 't_app', 't_other'].map(k => `<option value="${k}" ${r.type === k ? 'selected' : ''}>${esc(tr(k))}</option>`).join('')}</select>
      <label class="label mt-3" for="r-msg">${tr('describe')}</label><textarea id="r-msg" rows="4" maxlength="1000" class="input">${esc(r.msg)}</textarea>
      <label class="label mt-3" for="r-contact">${tr('contact')}</label><input id="r-contact" class="input" maxlength="80">
      <div class="mt-4 flex gap-2"><button class="btn flex-1" data-act="close">${tr('cancel')}</button><button class="btn-gold flex-1" data-act="report-send">${tr('send')}</button></div>`);
  }
  return '';
}

let first = true;
function render() {
  $('#app').innerHTML = (S.role ? shell() : landing()) + overlays();
  if (S.login) $('#pw')?.focus();
}
const refreshList = (id, fn) => { const el = $(id); if (el) el.innerHTML = fn(); };
const guard = async (fn) => { try { await fn(); } catch (e) { toast(e.message, 'error'); if (/sign in again/i.test(e.message)) H.logout(); } };

// ───────── Actions ─────────
let busy = false;
async function onCode(code) {
  if (busy) return; busy = true;
  await stopScan(); S.scanning = false;
  S.draft.ISBN = code; toast('Looking up ' + code + '…');
  const r = await lookup({ isbn: code });
  if (r.items?.length) applyItem(r.items[0], code); else toast('Not found online. Fill in the details by hand.', 'info');
  render(); busy = false;
}
async function openScanner() {
  readForm(); S.scanning = true; render();
  try { await startScan('reader', onCode); } catch { S.scanning = false; render(); toast('Camera unavailable. Allow camera access, or type the details.', 'error'); }
}

const H = {
  role: id => { S.login = id; render(); },
  close: () => { S.display = false; S.login = null; S.confirm = null; S.report = null; S.surprise = null; render(); },
  async login() {
    try {
      const d = await api('login', { role: S.login, password: $('#pw').value });
      setToken(d.token); S.role = S.login; S.login = null; S.tab = S.role === 'student' ? 'catalogue' : 'dashboard'; S.draft = newDraft();
      S.loading = true; render(); try { await load(); } catch (e) { toast(e.message, 'error'); } S.loading = false; render(); syncQueue();
      if (S.role === 'principal') loadReports().then(render).catch(() => {});
    } catch (e) { const el = $('#lerr'); el.textContent = e.message; el.classList.remove('hidden'); }
  },
  logout: () => { setToken(null); Object.assign(S, { role: null, editId: null, sg: '', books: [], checkouts: [], genres: [], pick: null, roll: '', q: '', cq: '', rq: '' }); render(); },
  tab: id => { readForm(); if (S.tab === 'add' && id !== 'add' && S.editId) { S.editId = null; S.draft = newDraft(); } S.tab = id; render(); if (id !== 'add') guard(async () => { await load(); if (S.role === 'principal' && id === 'reports') await loadReports(); if (S.tab === id) render(); }); },
  pick: id => { S.pick = id; render(); },
  unpick: () => { S.pick = null; render(); },
  checkout: () => guard(async () => {
    if (!S.roll.trim()) throw new Error('Enter the roll number.');
    if (!S.pick) throw new Error('Select a book first.');
    const held = loansOf(S.roll.trim()), late = held.filter(c => daysLeft(c.DueDate) < 0).length;
    if ((late || held.length >= LOAN_LIMIT) && !confirm(`Roll ${S.roll.trim()} has ${held.length} book(s) out${late ? ` and ${late} overdue` : ''}. Check out anyway?`)) return;
    const r = await api('checkout', { bookId: S.pick, roll: S.roll.trim(), days: +S.days || 14 });
    store.set('rolls', [S.roll.trim(), ...store.get('rolls', []).filter(x => x !== S.roll.trim())].slice(0, 8)); S.pick = null; S.roll = ''; S.cq = ''; await load(); render(); toast(`Checked out. Due ${showDate(r.dueDate)}.`, 'success');
  }),
  return: id => guard(async () => { await api('returnBook', { checkoutId: id }); await load(); render(); toast('Book returned.', 'success'); }),
  'ask-remove': id => { S.confirm = id; render(); },
  remove: () => guard(async () => { await api('removeBook', { bookId: S.confirm }); S.confirm = null; await load(); render(); toast('Book removed.', 'success'); }),
  sg: id => { S.sg = id === S.sg ? '' : id; render(); },
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
    await api('addGenre', { genre, subgenre: name }); await load(); render(); toast(`Added “${name}”.`, 'success');
  }),
  csv: () => {
    const q = v => { let s = String(v ?? ''); if (/^[=+\-@]/.test(s)) s = "'" + s; return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const rows = [['Roll', 'Title', 'BookID', 'Checked out', 'Due', 'Status'], ...S.checkouts.map(c => [c.RollNumber, c.Title, c.BookID, c.CheckoutDate, c.DueDate, state(c)])];
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([rows.map(r => r.map(q).join(',')).join('\n')], { type: 'text/csv' }));
    a.download = 'checkouts.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },
  lang: id => { S.lang = id; store.set('lang', id); document.documentElement.lang = id; render(); },
  fav: (id, el) => {
    S.list = S.list.includes(id) ? S.list.filter(x => x !== id) : [...S.list, id]; store.set('list', S.list);
    if (S.tab === 'list' && !S.surprise) render(); else { const on = S.list.includes(id); el.innerHTML = ic('heart', 'h-4 w-4', on) + ' ' + tr(on ? 'saved' : 'save'); }
  },
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
  resolve: id => guard(async () => {
    const r = S.reports.find(x => x.ReportID === id), status = r.Status === 'Resolved' ? 'Open' : 'Resolved';
    await api('setReport', { reportId: id, status }); r.Status = status; render();
  }),
  install: async () => { if (!deferredPrompt) return; deferredPrompt.prompt(); deferredPrompt = null; S.canInstall = false; render(); },
  display: () => { S.display = true; render(); },
  theme: id => { S.theme = id; store.set('theme', id); applyDisplay(); render(); },
  size: id => { S.big = !!id; store.set('big', S.big); applyDisplay(); render(); },
  roll: id => { S.roll = id; render(); },
  lng: id => { S.lng = id === S.lng ? '' : id; render(); },
  age: id => { S.age = id === S.age ? '' : id; render(); },
  'copy-overdue': () => { const t = overdueText(); if (!t) return toast('Nothing is overdue.'); navigator.clipboard.writeText(t).then(() => toast('Overdue list copied.', 'success'), () => toast('Could not copy.', 'error')); },
  'print-overdue': () => { const t = overdueText(); if (!t) return toast('Nothing is overdue.'); $('#printarea').innerHTML = `<h1 style="font:700 22px sans-serif">Overdue books, ${new Date().toLocaleDateString('en-IN')}</h1><pre style="font:15px/1.6 sans-serif;white-space:pre-wrap">${esc(t)}</pre>`; print(); },
  scan: openScanner,
  'cancel-scan': async () => { await stopScan(); S.scanning = false; render(); },
  search: () => guard(async () => {
    readForm(); const d = S.draft;
    if (d.ISBN) { const r = await lookup({ isbn: d.ISBN }); if (r.items?.[0]) { applyItem(r.items[0], d.ISBN); render(); return; } }
    if (!d.Title) throw new Error('Enter a title (and author) to look up.');
    S.results = (await lookup({ q: `${d.Title} ${d.Author}` })).items || [];
    if (!S.results.length) toast('Nothing found. Fill in the details by hand.');
    render();
  }),
  use: i => { readForm(); applyItem(S.results[i]); render(); },
  save: () => guard(async () => {
    readForm(); const d = S.draft;
    if (!d.Title || !d.Author || !d.SubGenre.length) throw new Error('Title, author and at least one sub-genre are required.');
    if (S.editId) { await api('updateBook', { bookId: S.editId, book: { ...d, SubGenre: d.SubGenre.join('|') } }); S.editId = null; S.draft = newDraft(); S.tab = 'catalogue'; await load(); render(); toast('Changes saved.', 'success'); return; }
    const again = $('#batch').checked;
    const book = { ...d, SubGenre: d.SubGenre.join('|') };
    let r; try { r = await api('addBook', { book }); } catch (e) { if (!e.offline) throw e; store.set('queue', [...queued(), book]); r = { queued: true }; }
    S.sticky = { genre: d.Genre, age: d.AgeGroup, cond: d.Condition, lang: d.Language };
    S.draft = newDraft(); S.results = []; if (!r.queued) await load();
    toast(r.queued ? 'Saved on this phone. It will sync when you are online.' : `Saved as ${r.bookId}.`, 'success');
    if (again) openScanner(); else render();
  })
};

// ───────── Events ─────────
document.addEventListener('click', e => { const el = e.target.closest('[data-act]'); if (el) H[el.dataset.act]?.(el.dataset.id, el); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && (S.login || S.confirm || S.report || S.surprise || S.display)) H.close();
  if (e.key === 'Enter' && e.target.id === 'pw') H.login();
});
const applyDisplay = () => { document.documentElement.dataset.theme = S.theme; document.documentElement.classList.toggle('big', S.big); };
applyDisplay();
addEventListener('online', syncQueue);
let deferredPrompt = null;
document.documentElement.lang = S.lang;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; S.canInstall = true; if (!S.role && !S.login) render(); });
if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
const lists = { q: v => { S.q = v; refreshList('#list', bookList); }, cq: v => { S.cq = v; refreshList('#clist', checkoutList); }, rq: v => { S.rq = v; refreshList('#rlist', recordList); } };
const dl = { q: debounce(lists.q, 150), cq: debounce(lists.cq, 150), rq: debounce(lists.rq, 150) };
document.addEventListener('input', e => {
  const { id, value } = e.target;
  if (dl[id]) dl[id](value);
  if (id === 'roll') { S.roll = value; refreshList('#loans', loansBox); }
  if (id === 'days') S.days = value;
});
document.addEventListener('change', e => {
  if (e.target.id === 'avail') { S.avail = e.target.value; refreshList('#list', bookList); }
  if (e.target.id === 'f-genre') { readForm(); S.draft.SubGenre = []; render(); }
});

render();

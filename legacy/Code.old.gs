// ════════════════════════════════════════════════════════════
// CONFIGURATION
// ════════════════════════════════════════════════════════════
const SHEET_ID = 'YOUR_GOOGLE_SHEET_ID_HERE'; // ← your Sheet ID

const TABS = {
  inventory: 'Inventory',
  checkouts: 'Checkouts',
  genres:    'Genres',
};

// Password hashes live here now — never shipped to the client.
// Generate a new hash with: Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'yourpassword')
//   then run bytesToHex() on the result (see helper below), or use any SHA-256 tool.
const PASSWORD_HASHES = {
  student:   '703b0a3d6ad75b649a28adde7d83c6251da457549263bc7ff45ec709b0a8448b',
  librarian: 'ab8e89c55367f55a2f933b8dc8a9994d61f997df2b402274eb943fa22d77394a',
  principal: '3549f22fb8622a6d216ef2dcd592e04ed1f1e604cef032d7e5c425e8e72a878e',
};

const TOKEN_TTL_SECONDS = 60 * 60 * 4; // 4 hour session
const CACHE_TTL_SECONDS = 30;          // getAll() cache lifetime

// ════════════════════════════════════════════════════════════
// ENTRY POINTS
// ════════════════════════════════════════════════════════════
function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  try {
    const action = e.parameter.action;
    let result;

    // ── PUBLIC ACTIONS (no token required) ──────────────────
    if (action === 'login') {
      result = loginAction(e.parameter.role, e.parameter.password);

    } else if (action === 'getAll') {
      // Read-only — no token required, but still rate-limited by cache
      result = getAllCached();

    // ── AUTHENTICATED WRITE ACTIONS ──────────────────────────
    } else if (action === 'appendRow') {
      requireToken(e.parameter.token);
      const tab = e.parameter.tab;
      const row = JSON.parse(e.parameter.row);
      result = appendRowAction(tab, row);

    } else if (action === 'updateCell') {
      requireToken(e.parameter.token);
      result = updateCellByIdAction(e.parameter);

    } else if (action === 'updateRow') {
      requireToken(e.parameter.token);
      result = updateRowByIdAction(e.parameter);

    } else if (action === 'deleteRow') {
      requireToken(e.parameter.token);
      result = deleteRowByIdAction(e.parameter);

    } else if (action === 'rewriteSheet') {
      requireToken(e.parameter.token);
      const tab  = e.parameter.tab;
      const rows = JSON.parse(e.parameter.rows);
      result = rewriteSheet(tab, rows);

    } else if (action === 'addGenre') {
      requireToken(e.parameter.token);
      result = addGenreAction(e.parameter.genre, e.parameter.subgenre);

    } else {
      result = { error: 'Unknown action: ' + action };
    }

    return jsonOut({ success: true, data: result });

  } catch (err) {
    return jsonOut({ success: false, error: err.message });
  }
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ════════════════════════════════════════════════════════════
// AUTH — password check + token issuance/validation
// ════════════════════════════════════════════════════════════
function sha256Hex(text) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
  return bytes.map(b => {
    const v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
}

function loginAction(role, password) {
  if (!role || !password) throw new Error('Role and password are required.');
  const expectedHash = PASSWORD_HASHES[role];
  if (!expectedHash) throw new Error('Unknown role.');

  const actualHash = sha256Hex(password);
  if (actualHash !== expectedHash) {
    throw new Error('Incorrect password.');
  }

  // Issue a random token, store role alongside it so write actions can know who's acting
  const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  const cache = CacheService.getScriptCache();
  cache.put('session_' + token, role, TOKEN_TTL_SECONDS);

  return { token: token, role: role };
}

function requireToken(token) {
  if (!token) throw new Error('Missing session token. Please log in again.');
  const cache = CacheService.getScriptCache();
  const role = cache.get('session_' + token);
  if (!role) throw new Error('Session expired or invalid. Please log in again.');
  // Refresh TTL on use (sliding expiry)
  cache.put('session_' + token, role, TOKEN_TTL_SECONDS);
  return role;
}

// ════════════════════════════════════════════════════════════
// CACHING for getAll() — invalidated after every write
// ════════════════════════════════════════════════════════════
function getAllCached() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('getAll_cache');
  if (cached) {
    return JSON.parse(cached);
  }
  const fresh = {
    inventory: getSheetData(TABS.inventory),
    checkouts: getSheetData(TABS.checkouts),
    genres:    getSheetData(TABS.genres),
  };
  // CacheService has a 100KB per-key limit; if the library grows large enough
  // to exceed that, this put() will silently fail-safe (caught) and just skip caching.
  try {
    cache.put('getAll_cache', JSON.stringify(fresh), CACHE_TTL_SECONDS);
  } catch (e) {
    // Too large to cache — fine, just serve uncached next time too.
  }
  return fresh;
}

function invalidateCache() {
  CacheService.getScriptCache().remove('getAll_cache');
}

// ════════════════════════════════════════════════════════════
// SHEET READ HELPERS
// ════════════════════════════════════════════════════════════
function getSheetData(tabName) {
  const ss    = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(tabName);
  if (!sheet) return [];

  // Use getLastRow/getLastColumn to avoid scanning empty trailing rows from
  // sheet formatting bloat (addresses performance item 4).
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];

  const values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  const headers = values[0].map(h => h.toString().trim());

  return values.slice(1).map((row, i) => {
    const obj = { _rowIndex: i + 2 };
    headers.forEach((h, j) => {
      const cell = row[j];
      // Google Sheets returns real Date objects for date-formatted cells.
      // Serialise them as "YYYY-MM-DD" so the client always receives a
      // consistent, unambiguous string (not a locale-dependent .toString()).
      if (cell instanceof Date && !isNaN(cell.getTime())) {
        const y  = cell.getFullYear();
        const mo = String(cell.getMonth() + 1).padStart(2, '0');
        const d  = String(cell.getDate()).padStart(2, '0');
        obj[h] = `${y}-${mo}-${d}`;
      } else {
        obj[h] = cell !== undefined && cell !== null ? cell.toString() : '';
      }
    });
    return obj;
  });
}

// Find the 1-based sheet row for a given ID column value. Returns -1 if not found.
function findRowById(sheet, idColIndex, idValue) {
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) { // skip header row
    if (String(values[i][idColIndex - 1]) === String(idValue)) {
      return i + 1; // 1-based row number
    }
  }
  return -1;
}

// ════════════════════════════════════════════════════════════
// WRITE ACTIONS — all wrapped in LockService to serialize
// concurrent requests against the same spreadsheet.
// ════════════════════════════════════════════════════════════

// Inventory column order: BookID(1) Title(2) Author(3) Genre(4) SubGenre(5)
//                          Available(6) AgeGroup(7) Condition(8) Language(9)
//                          ContainedWorks(10) — optional, pipe-separated list
//                          of individual novel/story titles for compilation
//                          books (e.g. omnibus editions). Add "ContainedWorks"
//                          as the header of column J in your Inventory sheet
//                          tab for this to work; existing rows can leave it blank.
// Checkouts column order: CheckoutID(1) RollNumber(2) BookID(3) Title(4)
//                          CheckoutDate(5) DueDate(6) Returned(7)

function appendRowAction(tabName, row) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ss    = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName(tabName);
    if (!sheet) throw new Error('Tab not found: ' + tabName);

    // Inventory rows get their BookID generated server-side — authoritative,
    // computed from a live read of the sheet while holding the lock, so two
    // concurrent "Add Book" calls can never produce the same ID.
    if (tabName === TABS.inventory) {
      const genre    = row[3];
      const subgenre = row[4];
      const generatedId = generateBookIdLocked(sheet, genre, subgenre);
      row[0] = generatedId; // overwrite whatever the client sent (or left blank)
      sheet.appendRow(row);
      invalidateCache();
      return { appended: true, bookId: generatedId };
    }

    if (tabName === TABS.checkouts) {
      const generatedId = generateCheckoutIdLocked(sheet);
      row[0] = generatedId;
      sheet.appendRow(row);
      invalidateCache();
      return { appended: true, checkoutId: generatedId };
    }

    sheet.appendRow(row);
    invalidateCache();
    return { appended: true };

  } finally {
    lock.releaseLock();
  }
}

// Generates the next BookID for a genre/subgenre by scanning the live sheet.
// Must be called while holding the script lock.
function generateBookIdLocked(sheet, genre, subgenre) {
  const prefix = genrePrefix(genre) + '-' + subgenreCode(subgenre);
  const values = sheet.getDataRange().getValues();
  let max = 0;
  for (let i = 1; i < values.length; i++) {
    const id = String(values[i][0] || '');
    if (id.indexOf(prefix + '-') === 0) {
      const parts = id.split('-');
      const num = parseInt(parts[parts.length - 1], 10) || 0;
      if (num > max) max = num;
    }
  }
  // Also check the Checkouts sheet so a retired book's ID is never reused
  const checkoutSheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(TABS.checkouts);
  if (checkoutSheet) {
    const coValues = checkoutSheet.getDataRange().getValues();
    for (let i = 1; i < coValues.length; i++) {
      const id = String(coValues[i][2] || ''); // BookID is column C in Checkouts
      if (id.indexOf(prefix + '-') === 0) {
        const parts = id.split('-');
        const num = parseInt(parts[parts.length - 1], 10) || 0;
        if (num > max) max = num;
      }
    }
  }
  return prefix + '-' + String(max + 1).padStart(3, '0');
}

function generateCheckoutIdLocked(sheet) {
  // Timestamp-based + sheet row count is sufficient here since the lock
  // already prevents two requests from running this concurrently.
  const lastRow = sheet.getLastRow();
  return 'CO-' + Date.now().toString(36).toUpperCase() + '-' + lastRow;
}

function genrePrefix(genre) {
  if (genre === 'Fiction') return 'FIC';
  if (genre === 'Non-Fiction') return 'NF';
  return String(genre || '').replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase() || 'GEN';
}

function subgenreCode(subgenre) {
  return String(subgenre || '').replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase() || 'SUB';
}

// ── Update / delete actions now resolve the row by a stable ID,
//    not a client-supplied row number, to avoid acting on the wrong row. ──

function updateCellByIdAction(p) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const tabName = p.tab;
    const idValue = p.id;
    const col     = parseInt(p.col, 10);
    const value   = p.value;

    const ss    = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName(tabName);
    if (!sheet) throw new Error('Tab not found: ' + tabName);

    const rowIndex = findRowById(sheet, 1, idValue); // ID column is always column A
    if (rowIndex === -1) throw new Error('Record not found (ID: ' + idValue + '). It may have been modified by someone else — please refresh and try again.');

    sheet.getRange(rowIndex, col).setValue(value);
    invalidateCache();
    return { updated: true };

  } finally {
    lock.releaseLock();
  }
}

function updateRowByIdAction(p) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const tabName = p.tab;
    const idValue = p.id;
    const values  = JSON.parse(p.values);

    const ss    = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName(tabName);
    if (!sheet) throw new Error('Tab not found: ' + tabName);

    const idCol = 1; // BookID/CheckoutID are both column A
    const rowIndex = findRowById(sheet, idCol, idValue);
    if (rowIndex === -1) throw new Error('Record not found (ID: ' + idValue + '). It may have been modified by someone else — please refresh and try again.');

    sheet.getRange(rowIndex, 1, 1, values.length).setValues([values]);
    invalidateCache();
    return { updated: true };

  } finally {
    lock.releaseLock();
  }
}

function deleteRowByIdAction(p) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const tabName = p.tab;
    const idValue = p.id;

    const ss    = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName(tabName);
    if (!sheet) throw new Error('Tab not found: ' + tabName);

    const idCol = 1;
    const rowIndex = findRowById(sheet, idCol, idValue);
    if (rowIndex === -1) throw new Error('Record not found (ID: ' + idValue + '). It may have already been removed.');

    sheet.deleteRow(rowIndex);
    invalidateCache();
    return { deleted: true };

  } finally {
    lock.releaseLock();
  }
}

function rewriteSheet(tabName, rows) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ss    = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName(tabName);
    if (!sheet) throw new Error('Tab not found: ' + tabName);

    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      const lastCol = sheet.getLastColumn();
      sheet.getRange(2, 1, lastRow - 1, lastCol).clearContent();
    }
    if (rows && rows.length) {
      sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
    }
    invalidateCache();
    return { rewritten: true };

  } finally {
    lock.releaseLock();
  }
}

// ── Genre creation, validated server-side regardless of what the client sent ──
function addGenreAction(genre, subgenre) {
  const cleanGenre    = validateGenreText(genre, 'Genre');
  const cleanSubgenre = validateGenreText(subgenre, 'Sub-genre');

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ss    = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName(TABS.genres);
    if (!sheet) throw new Error('Tab not found: ' + TABS.genres);

    // Reject duplicates server-side too
    const values = sheet.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][0]) === cleanGenre && String(values[i][1]) === cleanSubgenre) {
        throw new Error('This sub-genre already exists.');
      }
    }

    sheet.appendRow([cleanGenre, cleanSubgenre]);
    invalidateCache();
    return { added: true, genre: cleanGenre, subgenre: cleanSubgenre };

  } finally {
    lock.releaseLock();
  }
}

// Alphanumeric + spaces + common punctuation, 2–40 chars. Throws if invalid.
// Mirrors the client-side GENRE_NAME_PATTERN — both must stay in sync.
function validateGenreText(text, label) {
  const trimmed = String(text || '').trim();
  if (!/^[a-zA-Z0-9 \/'&.\-]{2,40}$/.test(trimmed)) {
    throw new Error(label + ' may only contain letters, numbers, spaces, and / \' & . - (2-40 characters).');
  }
  return trimmed;
}

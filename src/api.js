let token = null;
export const setToken = t => { token = t; };
export const newId = () => crypto.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2);

// All backend calls go through the Vercel proxy (/api/gas) via POST,
// so the Apps Script URL and secrets never reach the browser or URLs.
// A call that times out or loses the connection is marked `offline`: the caller can retry it safely
// when it carries a request id (`rid`), because the server ignores repeats.
export async function api(action, data = {}, { timeout = 28000 } = {}) {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), timeout);
  let r;
  try {
    r = await fetch('/api/gas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, token, ...data }), signal: ctl.signal });
  } catch (e) {
    const err = new Error(e.name === 'AbortError' ? 'This is taking too long. It may have worked, so refresh to check.' : 'No connection. Check the internet and try again.');
    err.offline = true; throw err;
  } finally { clearTimeout(timer); }
  const j = await r.json().catch(() => ({ success: false, error: 'Server returned an invalid response.' }));
  if (!j.success) throw new Error(j.error || 'Request failed.');
  return j.data;
}

// Wakes the backend so the first real request is not slow.
export const ping = () => api('ping', {}, { timeout: 15000 }).catch(() => {});

export async function lookup(params) {
  try { const r = await fetch('/api/isbn?' + new URLSearchParams(params)); return r.ok ? await r.json() : { items: [] }; }
  catch { return { items: [] }; }
}

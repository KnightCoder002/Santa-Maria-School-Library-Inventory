let token = null;
export const setToken = t => { token = t; };

// All backend calls go through the Vercel proxy (/api/gas) via POST,
// so the Apps Script URL and secrets never reach the browser or URLs.
export async function api(action, data = {}) {
  let r;
  try {
    r = await fetch('/api/gas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, token, ...data }) });
  } catch { const e = new Error('No connection. Check the internet and try again.'); e.offline = true; throw e; }
  const j = await r.json().catch(() => ({ success: false, error: 'Server returned an invalid response.' }));
  if (!j.success) throw new Error(j.error || 'Request failed.');
  return j.data;
}

export async function lookup(params) {
  try { const r = await fetch('/api/isbn?' + new URLSearchParams(params)); return r.ok ? await r.json() : { items: [] }; }
  catch { return { items: [] }; }
}

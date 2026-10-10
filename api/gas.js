// Thin proxy to Apps Script: hides the script URL, keeps requests POST-only, small and time-limited.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'POST only.' });
  if (!process.env.GAS_URL) return res.status(500).json({ success: false, error: 'The server is not configured (GAS_URL).' });
  const body = JSON.stringify(req.body ?? {});
  if (body.length > 20000) return res.status(413).json({ success: false, error: 'Request too large.' });
  try {
    const r = await fetch(process.env.GAS_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body, signal: AbortSignal.timeout(27000) });
    res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(await r.text());
  } catch { res.status(502).json({ success: false, error: 'The library server did not answer. It may still have saved: refresh to check.' }); }
}

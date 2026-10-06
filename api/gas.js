// Thin proxy to Apps Script: hides the script URL, keeps requests POST-only.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'POST only.' });
  try {
    const r = await fetch(process.env.GAS_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(req.body) });
    res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(await r.text());
  } catch { res.status(502).json({ success: false, error: 'Backend unreachable.' }); }
}

import { Html5Qrcode, Html5QrcodeSupportedFormats as F } from 'html5-qrcode';
let sc = null;
export async function startScan(elId, onCode) {
  sc = new Html5Qrcode(elId, { formatsToSupport: [F.EAN_13, F.EAN_8, F.UPC_A], verbose: false });
  await sc.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 280, height: 140 } }, t => onCode(t), () => {});
}
export async function stopScan() {
  if (!sc) return;
  try { await sc.stop(); } catch {}
  try { sc.clear(); } catch {}
  sc = null;
}

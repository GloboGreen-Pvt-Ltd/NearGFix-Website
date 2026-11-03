/**
 * receiptImage.js — the booking receipt drawn as a PNG on a <canvas> (no
 * library), laid out like the Partner app's booking-confirmation card
 * (BookingConfirmCard): shop + green "Service Booking Confirmed" badge,
 * Booking ID card, greeting + mobile chips, device card (name, variant /
 * colour, photo), repair services, delivery band, payment summary, shop
 * contact and the green "Thank you … Powered by NearGFix" footer. Takes the
 * receipt page's `card`. Photos are drawn only when their host allows CORS;
 * otherwise they are left out rather than tainting the canvas.
 */

const GREEN = '#01AC77';
const GREEN_DARK = '#03714F';
const NAVY = '#05366E';
const MINT = '#E6F7F1';
const MINT_SOFT = '#F3FBF8';
const MUTED = '#6B7280';
const LINE = '#E5E7EB';
const ORANGE = '#B45309';
const W = 720;
const PAD = 28;
const FONT = 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const EMOJI = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';

const inr = (n) => `₹${(Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) { resolve(null); return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const t = setTimeout(() => resolve(null), 4000);
    img.onload = () => { clearTimeout(t); resolve(img); };
    img.onerror = () => { clearTimeout(t); resolve(null); };
    img.src = src;
  });
}

/** Draws the receipt; resolves a PNG Blob (or null when the browser can't). */
export async function receiptPng(card) {
  const [photo, shopImg] = await Promise.all([loadImage(card.image), loadImage(card.shopImage)]);
  const scale = 2;
  const H = 2600;
  const canvas = document.createElement('canvas');
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);

  const font = (size, weight = 600) => { ctx.font = `${weight} ${size}px ${FONT}`; };
  const text = (t, x, y, { size = 15, weight = 600, color = NAVY, align = 'left' } = {}) => {
    font(size, weight); ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(String(t ?? ''), x, y); ctx.textAlign = 'left';
    return ctx.measureText(String(t ?? '')).width;
  };
  const emoji = (e, x, y, size = 18) => { ctx.font = `${size}px ${EMOJI}`; ctx.textAlign = 'center'; ctx.fillText(e, x, y); ctx.textAlign = 'left'; };
  const rr = (x, y, w, h, r, fill, stroke) => {
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke(); }
  };
  const circleImg = (img, cx, cy, r) => {
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
    const s = Math.max((r * 2) / img.width, (r * 2) / img.height);
    ctx.drawImage(img, cx - (img.width * s) / 2, cy - (img.height * s) / 2, img.width * s, img.height * s);
    ctx.restore();
  };
  const wrap = (t, maxW, size, weight) => {
    font(size, weight);
    const out = []; let line = '';
    String(t || '').split(/\s+/).forEach((w) => {
      const n = line ? `${line} ${w}` : w;
      if (ctx.measureText(n).width > maxW && line) { out.push(line); line = w; } else line = n;
    });
    if (line) out.push(line);
    return out;
  };
  const ellipsize = (t, maxW, size, weight) => {
    font(size, weight);
    let s = String(t || '');
    if (ctx.measureText(s).width <= maxW) return s;
    while (s && ctx.measureText(`${s}..`).width > maxW) s = s.slice(0, -1);
    return `${s}..`;
  };
  const inner = W - PAD * 2;
  let y = 24;

  // ── Header: shop avatar + name · Service Booking Confirmed badge ──
  let nameX = PAD;
  if (shopImg) { circleImg(shopImg, PAD + 28, y + 40, 28); nameX = PAD + 70; }
  text(ellipsize(card.shopName || 'Shop', 330, 30, 800), nameX, y + 51, { size: 30, weight: 800 });
  rr(W - PAD - 232, y, 232, 82, 22, MINT);
  ctx.beginPath(); ctx.arc(W - PAD - 194, y + 41, 21, 0, Math.PI * 2); ctx.fillStyle = GREEN; ctx.fill();
  ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(W - PAD - 203, y + 41); ctx.lineTo(W - PAD - 197, y + 47); ctx.lineTo(W - PAD - 185, y + 35); ctx.stroke();
  text('Service Booking', W - PAD - 16, y + 34, { size: 17, weight: 500, align: 'right' });
  text('Confirmed', W - PAD - 16, y + 63, { size: 25, weight: 800, align: 'right' });
  y += 108;

  // ── Booking ID card ──
  rr(PAD, y, inner, 126, 22, MINT_SOFT, LINE);
  emoji('🎫', PAD + 36, y + 72, 24);
  text('Booking ID', PAD + 68, y + 36, { size: 17, weight: 500, color: MUTED });
  text(card.tid || '—', PAD + 68, y + 72, { size: 26, weight: 800 });
  if (card.bookedOn) text(`Booked on ${card.bookedOn}`, PAD + 68, y + 106, { size: 17, weight: 500, color: MUTED });
  font(18, 800);
  const sw = ctx.measureText(card.statusLabel || '').width + 36;
  rr(W - PAD - 22 - sw, y + 42, sw, 40, 20, MINT);
  text(card.statusLabel || '', W - PAD - 22 - sw / 2, y + 69, { size: 18, weight: 800, color: GREEN_DARK, align: 'center' });
  y += 160;

  // ── Greeting + mobile chips ──
  const dw = text('Dear ', PAD, y, { size: 24, weight: 500 });
  const nw = text(card.customerName || 'Customer', PAD + dw, y, { size: 24, weight: 800 });
  text(',', PAD + dw + nw, y, { size: 24, weight: 500 });
  y += 38;
  const greet = wrap(`Your device repair booking has been successfully registered with ${card.shopName}.`, inner, 19, 500);
  greet.forEach((l, i) => {
    const isLast = i === greet.length - 1;
    const shop = String(card.shopName || '');
    if (isLast && shop && l.endsWith(`${shop}.`)) {
      const head = l.slice(0, l.length - shop.length - 1);
      const hw = text(head, PAD, y, { size: 19, weight: 500, color: '#374151' });
      const sw2 = text(shop, PAD + hw, y, { size: 19, weight: 800, color: GREEN });
      text('.', PAD + hw + sw2, y, { size: 19, weight: 500, color: '#374151' });
    } else text(l, PAD, y, { size: 19, weight: 500, color: '#374151' });
    y += 30;
  });
  y += 4;
  let cx = PAD;
  [['Mobile', card.customerPhone], ['Alt. Mobile', card.altPhone]].filter(([, v]) => v).forEach(([k, v]) => {
    font(17, 500); const kw = ctx.measureText(k).width; font(19, 800); const vw = ctx.measureText(v).width;
    const w = 44 + kw + 10 + vw + 18;
    rr(cx, y, w, 42, 21, '#FFFFFF', LINE);
    emoji('📞', cx + 22, y + 28, 15);
    text(k, cx + 40, y + 27, { size: 17, weight: 500, color: MUTED });
    text(v, cx + 40 + kw + 10, y + 28, { size: 19, weight: 800 });
    cx += w + 12;
  });
  y += 68;

  // ── Device card ──
  const top = y;
  const colW = photo ? inner - 250 : inner - 40;
  const row = (icon, label, value, ry) => {
    rr(PAD + 20, ry, 46, 46, 12, MINT);
    emoji(icon, PAD + 43, ry + 31, 20);
    text(label, PAD + 84, ry + 18, { size: 17, weight: 500, color: MUTED });
    const lines = wrap(value, colW - 70, 23, 800);
    lines.forEach((l, i) => text(l, PAD + 84, ry + 48 + i * 30, { size: 23, weight: 800 }));
    return ry + 48 + (lines.length - 1) * 30 + 22;
  };
  let ry = row('📱', 'Device', card.deviceName || 'Device', y + 26);
  const variant = [card.ramStorage, card.color].filter(Boolean).join(' · ');
  if (variant) {
    ctx.fillStyle = LINE; ctx.fillRect(PAD + 20, ry, colW, 1.5);
    ry = row('🎨', 'Variant / Colour', variant, ry + 18);
  }
  if (photo) {
    const box = 200;
    const s = Math.min(box / photo.width, box / photo.height);
    ctx.drawImage(photo, W - PAD - 20 - box + (box - photo.width * s) / 2, y + 44 + (box - photo.height * s) / 2, photo.width * s, photo.height * s);
  }
  y = Math.max(ry + 14, photo ? y + 270 : 0);
  ctx.fillStyle = LINE; ctx.fillRect(PAD, y, inner, 1.5);
  y += 42;

  emoji('🔧', PAD + 34, y, 20);
  text('REPAIR SERVICES', PAD + 60, y, { size: 19, weight: 800 });
  y += 44;
  (card.lines || []).forEach((l, i) => {
    rr(PAD + 20, y - 24, 32, 32, 8, MINT);
    text(String(i + 1), PAD + 36, y - 1, { size: 17, weight: 800, color: GREEN_DARK, align: 'center' });
    const lines = wrap(l.name, inner - 230, 23, 800);
    lines.forEach((t, j) => text(t, PAD + 68, y + j * 30, { size: 23, weight: 800 }));
    if (l.amount != null) text(inr(l.amount), W - PAD - 22, y, { size: 23, weight: 800, align: 'right' });
    y += (lines.length - 1) * 30 + 34;
    if (l.warranty) { text(`Warranty: ${l.warranty}`, PAD + 68, y - 4, { size: 17, weight: 500, color: MUTED }); y += 30; }
    y += 8;
  });
  if (card.serviceCharge > 0) {
    text('Service Charge', PAD + 68, y + 4, { size: 21, weight: 600, color: MUTED });
    text(inr(card.serviceCharge), W - PAD - 22, y + 4, { size: 22, weight: 800, align: 'right' });
    y += 48;
  }
  [['🎧', 'Accessories', card.accessories], ['📝', 'Issue', card.complaint], ['⚠️', 'Missing / Damaged', card.parts]].forEach(([ic, k, v]) => {
    if (!v) return;
    emoji(ic, PAD + 34, y + 2, 18);
    text(k, PAD + 60, y, { size: 19, weight: 500, color: MUTED });
    const lines = wrap(v, inner - 290, 19, 800);
    lines.forEach((t, j) => text(t, PAD + 250, y + j * 26, { size: 19, weight: 800 }));
    y += lines.length * 26 + 16;
  });
  y += 6;
  // Delivery band (bottom of the device card)
  ctx.save();
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(PAD, top, inner, y + 96 - top, 22) : ctx.rect(PAD, top, inner, y + 96 - top); ctx.clip();
  ctx.fillStyle = MINT; ctx.fillRect(PAD, y, inner, 96);
  ctx.restore();
  emoji('🗓️', PAD + 38, y + 58, 24);
  text('ESTIMATED DELIVERY DATE & TIME', PAD + 70, y + 36, { size: 17, weight: 800, color: GREEN_DARK });
  text(card.delivery || 'To Be Confirmed', PAD + 70, y + 72, { size: 26, weight: 800 });
  y += 96;
  rr(PAD, top, inner, y - top, 22, null, LINE);
  y += 22;

  // ── Payment summary ──
  const pTop = y;
  y += 42;
  emoji('💳', PAD + 34, y, 19);
  text('PAYMENT SUMMARY', PAD + 60, y, { size: 19, weight: 800 });
  y += 50;
  [['Estimated Repair Total', inr(card.total)], ['Amount Paid', inr(card.paid)]].forEach(([k, v]) => {
    text(k, PAD + 22, y, { size: 21, weight: 500, color: MUTED });
    text(v, W - PAD - 22, y, { size: 22, weight: 800, align: 'right' });
    y += 42;
  });
  ctx.fillStyle = LINE; ctx.fillRect(PAD + 22, y - 12, inner - 44, 1.5);
  y += 30;
  text('Balance Amount', PAD + 22, y, { size: 23, weight: 800 });
  text(inr(card.balance), W - PAD - 22, y, { size: 27, weight: 800, color: ORANGE, align: 'right' });
  y += 34;
  rr(PAD, pTop, inner, y - pTop, 22, null, LINE);
  y += 22;

  // ── Shop contact ──
  rr(PAD, y, inner, 98, 22, '#FFFFFF', LINE);
  let sx = PAD + 22;
  if (shopImg) { circleImg(shopImg, PAD + 50, y + 49, 28); sx = PAD + 92; }
  text('Shop Contact', sx, y + 40, { size: 17, weight: 500, color: MUTED });
  text(ellipsize(card.shopName, 220, 23, 800), sx, y + 72, { size: 23, weight: 800 });
  const phoneW = text(card.shopPhone || '', W - PAD - 22, y + 60, { size: 26, weight: 800, align: 'right' });
  ctx.beginPath(); ctx.arc(W - PAD - 22 - phoneW - 34, y + 50, 21, 0, Math.PI * 2); ctx.fillStyle = GREEN; ctx.fill();
  emoji('📞', W - PAD - 22 - phoneW - 34, y + 57, 18);
  y += 120;

  // ── Footer band ──
  const fh = 92;
  rr(PAD, y, inner, fh, 18, GREEN_DARK);
  ctx.save();
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(PAD, y, inner, fh, 18) : ctx.rect(PAD, y, inner, fh); ctx.clip();
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath(); ctx.ellipse(W - PAD + 40, y + fh / 2, 250, 120, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  emoji('🤝', PAD + 40, y + 56, 26);
  const tw = text('Thank you for choosing ', PAD + 78, y + 40, { size: 19, weight: 500, color: '#FFFFFF' });
  text(ellipsize(card.shopName, 120, 19, 800), PAD + 78 + tw, y + 40, { size: 19, weight: 800, color: '#FFFFFF' });
  text('Your trust means a lot to us. 💚', PAD + 78, y + 70, { size: 17, weight: 500, color: '#E6F7F1' });
  text('Powered by', W - PAD - 100, y + 36, { size: 15, weight: 500, color: MUTED, align: 'center' });
  ctx.beginPath(); ctx.arc(W - PAD - 172, y + 62, 11, 0, Math.PI * 2); ctx.fillStyle = NAVY; ctx.fill();
  text('G', W - PAD - 172, y + 67, { size: 13, weight: 800, color: '#FFFFFF', align: 'center' });
  text('NearGFix', W - PAD - 92, y + 70, { size: 25, weight: 800, align: 'center' });
  y += fh + 24;

  const out = document.createElement('canvas');
  out.width = W * scale;
  out.height = Math.ceil(y * scale);
  out.getContext('2d').drawImage(canvas, 0, 0);
  return new Promise((resolve) => {
    try { out.toBlob((b) => resolve(b), 'image/png'); } catch { resolve(null); }
  });
}

/* Slayer Fleet — ฟอร์มสั่งทำไอดี End Game */
'use strict';
const $ = (s) => document.querySelector(s);
// ตัวเลือก (แก้รายชื่อได้ตรงนี้)
const CLANS = ['Kamado', 'Tomioka', 'Agatsuma', 'Hashibira', 'Rengoku', 'Tokito', 'Uzui', 'Kocho', 'Himejima', 'Shinazugawa', 'Iguro', 'Kanroji'];
const WEAPONS = ['Katana', 'Sickles', 'Scythe', 'Spear', 'War Fans', 'Bladed Wagasa', 'Axe and Mace', 'Cutlass', 'Tanto', 'Gauntlet'];
const LINES = ['Nightfall', 'Firstlight'];
const BREATHS = ['Water', 'Flame', 'Thunder', 'Wind', 'Insect', 'Stone', 'Sound', 'Mist', 'Serpent', 'Beast', 'Moon', 'Sun'];
const DEMONS = ['Blood Manipulation', 'Cryokinesis', 'Dream', 'Tamari', 'Obi Manipulation'];
let kind = 'breath', sent = false;

const opt = (sel, list, first) => { const e = $(sel); e.replaceChildren(); if (first) e.append(new Option(first, '')); for (const v of list) e.append(typeof v === 'object' ? new Option(v[1], v[0]) : new Option(v, v)); };
const tiers = [['', '—'], ['1', 'T1'], ['2', 'T2'], ['3', 'T3']], pluses = [['', '—'], ...Array.from({ length: 11 }, (_, i) => [String(i), '+' + i])];
opt('#w-type', WEAPONS, 'ไม่ระบุ'); opt('#w-line', LINES, 'ไม่ระบุ');
for (const p of ['t', 'b']) { opt('#' + p + '-line', LINES, 'ไม่ระบุ'); opt('#' + p + '-tier', tiers); opt('#' + p + '-plus', pluses); }
opt('#w-tier', tiers); opt('#w-plus', pluses);
// ค่าเริ่มต้นแบบตัวอย่าง End Game
$('#w-type').value = 'Katana'; $('#w-line').value = 'Nightfall'; $('#w-tier').value = '3'; $('#w-plus').value = '10';
$('#t-line').value = 'Nightfall'; $('#t-tier').value = '3'; $('#t-plus').value = '10';
$('#dl-clan').replaceChildren(...CLANS.map((c) => new Option(c)));
const setPowerList = () => { $('#dl-power').replaceChildren(...(kind === 'demon' ? DEMONS : BREATHS).map((c) => new Option(c))); $('#p-name').placeholder = kind === 'demon' ? 'เช่น Blood Manipulation' : 'เช่น Water'; };
setPowerList();
document.querySelectorAll('.seg.big button').forEach((b) => (b.onclick = () => { kind = b.dataset.k; document.querySelectorAll('.seg.big button').forEach((x) => x.setAttribute('aria-pressed', x === b)); setPowerList(); update(); }));
$('#same').onchange = () => { $('#row-bot').hidden = $('#same').checked; $('#lbl-top').textContent = $('#same').checked ? 'เสื้อ + กางเกง' : 'เสื้อ'; update(); };

const num = (id) => { const v = $(id).value; return v === '' ? null : Number(v); };
const gear = (p) => ({ line: $('#' + p + '-line').value, tier: num('#' + p + '-tier'), plus: num('#' + p + '-plus') });
function data() {
  const top = gear('t'), bottom = $('#same').checked ? top : gear('b');
  return {
    clan: $('#clan').value.trim(),
    weapon: Object.assign(gear('w'), { type: $('#w-type').value, mastery: num('#w-mas') }),
    power: { kind, name: $('#p-name').value.trim(), mastery: num('#p-mas') },
    top, bottom, title: $('#title').value.trim(), level: num('#level'),
    brief: $('#brief').value.trim(), roblox: $('#roblox').value.trim(),
    contact: { via: $('#c-via').value, handle: $('#c-handle').value.trim() }, website: $('#hp').value,
  };
}
const g = (x) => (x && x.line ? `${x.line}${x.tier ? ' T' + x.tier : ''}${x.plus != null ? '+' + x.plus : ''}` : '');
function text(d) {
  const L = [];
  if (d.clan) L.push('ตระกูล: ' + d.clan);
  if (d.weapon.type) L.push(`อาวุธ: ${d.weapon.type} ${g(d.weapon)}`.trim() + (d.weapon.mastery ? ` (ฟาร์มให้จน Mastery ${d.weapon.mastery})` : ''));
  if (d.power.name) L.push(`${d.power.kind === 'demon' ? 'มนต์อสูร' : 'ปราณ'}: ${d.power.name}` + (d.power.mastery ? ` (ฟาร์มให้จน Mastery ${d.power.mastery})` : ''));
  else if (d.power.mastery) L.push(`${d.power.kind === 'demon' ? 'มนต์อสูร' : 'ปราณ'}: (ฟาร์มให้จน Mastery ${d.power.mastery})`);
  if ($('#same').checked) { if (g(d.top)) L.push('เสื้อ, กางเกง: ' + g(d.top)); }
  else { if (g(d.top)) L.push('เสื้อ: ' + g(d.top)); if (g(d.bottom)) L.push('กางเกง: ' + g(d.bottom)); }
  if (d.title) L.push('(ฉายา): ' + d.title);
  if (d.level) L.push('เลเวล: ' + d.level);
  if (d.brief) L.push('บรีฟ: ' + d.brief);
  if (d.roblox) L.push('ไอดี Roblox: ' + d.roblox);
  return L.length ? L.join('\n') : 'ยังไม่ได้เลือกอะไร';
}
function update() { if (!sent) $('#sum').textContent = text(data()); }
$('#of').addEventListener('input', update); $('#of').addEventListener('change', update); update();

function toast(m, bad) { const t = $('#toast'); t.textContent = m; t.className = 'toast on' + (bad ? ' bad' : ''); clearTimeout(toast.t); toast.t = setTimeout(() => (t.className = 'toast'), 3000); }
$('#copy').onclick = async () => {
  const d = data(), msg = 'รับทำไอดี End Game\n' + text(d) + '\nราคา: ขึ้นอยู่กับความต้องการ เริ่มต้น 200 บาท' + (d.contact.handle ? '\nติดต่อ: ' + d.contact.via + ' ' + d.contact.handle : '');
  try { await navigator.clipboard.writeText(msg); toast('ก๊อปข้อความแล้ว'); } catch (e) { toast('ก๊อปไม่ได้ ลองเลือกข้อความเอง', true); }
};
$('#send').onclick = async () => {
  const d = data(); $('#err').textContent = '';
  if (!d.contact.handle) { $('#err').textContent = 'กรุณาใส่ช่องทางติดต่อกลับ (ข้อ 6)'; $('#c-handle').focus(); return; }
  if (d.roblox && !/^[A-Za-z0-9_]{3,20}$/.test(d.roblox)) { $('#err').textContent = 'ชื่อไอดี Roblox ใช้ได้แค่ตัวอักษรอังกฤษ ตัวเลข และ _'; $('#roblox').focus(); return; }
  const btn = $('#send'); btn.disabled = true;
  try {
    const r = await fetch('/api/v1/order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { $('#err').textContent = j.error || 'ส่งไม่สำเร็จ ลองใหม่อีกครั้ง'; return; }
    sent = true;
    const via = { facebook: 'Facebook', discord: 'Discord', line: 'LINE', other: '' }[d.contact.via] || '';
    $('#ticket').classList.add('done');
    $('#ticket').replaceChildren(
      Object.assign(document.createElement('div'), { className: 'tk-ok', textContent: '✓' }),
      Object.assign(document.createElement('h2'), { textContent: 'ส่งออเดอร์แล้ว' }),
      Object.assign(document.createElement('p'), { className: 'tk-id', textContent: 'เลขที่ ' + j.id }),
      Object.assign(document.createElement('p'), { textContent: 'ร้านจะติดต่อกลับทาง ' + (via ? via + ' ' : '') + d.contact.handle + ' เร็ว ๆ นี้ เพื่อสรุปรายละเอียด ราคา และการชำระเงิน' }),
      Object.assign(document.createElement('pre'), { className: 'tk-body', textContent: text(d) }));
    $('#ticket').scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (e) { $('#err').textContent = 'ต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง'; } finally { btn.disabled = false; }
};

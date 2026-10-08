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

// ===== ตัวเลือกแบบการ์ดมีรูปไอเทมจากในเกม =====
const ICON_OF = {
  Katana: 'Nightfall Katana', Sickles: 'Sickles', Scythe: 'Scythe', Spear: 'Spear', 'War Fans': 'War Fans', Cutlass: 'Cutlass', 'Axe and Mace': 'Nightfall Axe and Mace Schematic',
  Water: 'Water Katana', Flame: 'Flame Katana', Thunder: 'Thunder Katana', Wind: 'Wind Katana', Insect: 'Insect Katana', Stone: 'Stone Haori', Sound: 'Sound Katanas', Mist: 'Mist Kumo Sodenashi', Serpent: 'Serpent Katana', Beast: 'Beast Core',
  'Blood Manipulation': 'Blood Sickles', Cryokinesis: 'Frozen Heart', Dream: 'Sweet Dreams Eye Mask', Tamari: 'Demon Horns', 'Obi Manipulation': 'Demonic Lantern',
};
const LINE_ICON = { w: { Nightfall: 'Nightfall Katana', Firstlight: 'Firstlight Forged Ingot' }, a: { Nightfall: "Nightfall Weaver's Cloth", Firstlight: "Firstlight Weaver's Silk" } };
let ICONS = {};
const pickers = [];
// ตราประจำตระกูล (สร้างเองจากชื่อ ไม่ซ้ำกัน): วงแหวน + กลีบ + แกนกลาง
const NS = 'http://www.w3.org/2000/svg';
function crest(name) {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const petals = 3 + (h % 6), shape = (h >> 3) % 3, inner = (h >> 5) % 3, hue = [38, 12, 350, 200, 160, 280][(h >> 7) % 6];
  const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '-50 -50 100 100'); svg.setAttribute('aria-hidden', 'true'); svg.classList.add('crest');
  const el = (t, a) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); svg.append(e); return e; };
  const gold = '#e2b65c', tint = `hsl(${hue} 55% 42%)`;
  el('circle', { r: 47, fill: '#1c1315', stroke: gold, 'stroke-width': 4 });
  el('circle', { r: 39, fill: 'none', stroke: tint, 'stroke-width': 1.5, opacity: .8 });
  for (let k = 0; k < petals; k++) {
    const g = el('g', { transform: `rotate(${(360 / petals) * k})` });
    const e = document.createElementNS(NS, shape === 0 ? 'ellipse' : shape === 1 ? 'path' : 'rect');
    if (shape === 0) { e.setAttribute('cx', 0); e.setAttribute('cy', -19); e.setAttribute('rx', 8); e.setAttribute('ry', 15); }
    else if (shape === 1) e.setAttribute('d', 'M0 -36 C10 -26 10 -12 0 -6 C-10 -12 -10 -26 0 -36Z');
    else { e.setAttribute('x', -6); e.setAttribute('y', -34); e.setAttribute('width', 12); e.setAttribute('height', 22); e.setAttribute('rx', 3); e.setAttribute('transform', 'rotate(45 0 -23)'); }
    e.setAttribute('fill', gold); g.append(e);
  }
  if (inner === 0) el('circle', { r: 8, fill: tint, stroke: gold, 'stroke-width': 2.5 });
  else if (inner === 1) el('rect', { x: -7, y: -7, width: 14, height: 14, transform: 'rotate(45)', fill: tint, stroke: gold, 'stroke-width': 2.5 });
  else { el('circle', { r: 9, fill: 'none', stroke: gold, 'stroke-width': 3 }); el('circle', { r: 3.5, fill: gold }); }
  return svg;
}
function icon(label, iconName, isClan) {
  const f = document.createElement('span'); f.className = 'dd-ic';
  if (isClan && label !== 'ไม่ระบุ') f.append(crest(label));
  else if (iconName && ICONS[iconName]) { const im = new Image(); im.src = ICONS[iconName]; im.alt = ''; im.onerror = () => { im.remove(); f.textContent = label[0]; }; f.append(im); }
  else f.textContent = label === 'ไม่ระบุ' ? '–' : label[0];
  return f;
}
// ช่องเลือกแบบเลื่อน มีไอคอนเล็กหน้าชื่อ (ค่าจริงยังเก็บใน select/input เดิมของฟอร์ม)
let openDD = null;
function closeDD() { if (openDD) { openDD.list.hidden = true; openDD.btn.setAttribute('aria-expanded', 'false'); openDD = null; } }
document.addEventListener('click', (e) => { if (openDD && !openDD.box.contains(e.target)) closeDD(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && openDD) { const b = openDD.btn; closeDD(); b.focus(); } });
function picker(el, list, iconOf, title, where, isClan) {
  const box = document.createElement('div'); box.className = 'dd';
  const lab = document.createElement('span'); lab.className = 'dd-cap'; lab.textContent = title;
  const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'dd-btn f'; btn.setAttribute('aria-haspopup', 'listbox'); btn.setAttribute('aria-expanded', 'false');
  const ul = document.createElement('div'); ul.className = 'dd-list'; ul.setAttribute('role', 'listbox'); ul.setAttribute('aria-label', title); ul.hidden = true;
  box.append(lab, btn, ul);
  const items = () => (typeof list === 'function' ? list() : list);
  const draw = () => {
    const cur = el.value, label = cur || (el.tagName === 'INPUT' ? 'เลือก หรือพิมพ์เองด้านล่าง' : 'ไม่ระบุ');
    const t = document.createElement('span'); t.className = 'dd-t'; t.textContent = label;
    const chev = document.createElement('span'); chev.className = 'dd-chev'; chev.textContent = '▾';
    btn.replaceChildren(icon(cur || 'ไม่ระบุ', iconOf(cur), isClan), t, chev);
    ul.replaceChildren(...items().map((v) => {
      const o = document.createElement('button'); o.type = 'button'; o.className = 'dd-opt'; o.setAttribute('role', 'option'); o.setAttribute('aria-selected', String(v === cur));
      const ot = document.createElement('span'); ot.textContent = v || 'ไม่ระบุ';
      o.append(icon(v || 'ไม่ระบุ', iconOf(v), isClan), ot);
      o.onclick = () => { el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); closeDD(); redrawAll(); btn.focus(); };
      return o;
    }));
  };
  btn.onclick = (e) => {
    e.stopPropagation(); const was = openDD && openDD.box === box; closeDD(); if (was) return;
    ul.hidden = false; btn.setAttribute('aria-expanded', 'true'); openDD = { box, btn, list: ul };
    const sel = ul.querySelector('[aria-selected=true]') || ul.firstChild; if (sel) { sel.scrollIntoView({ block: 'nearest' }); sel.focus(); }
  };
  ul.addEventListener('keydown', (e) => {
    const opts = [...ul.children], k = opts.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); (opts[k + 1] || opts[0]).focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); (opts[k - 1] || opts[opts.length - 1]).focus(); }
  });
  where(box); pickers.push(draw); return draw;
}
function redrawAll() { for (const d of pickers) d(); }
const hideLabel = (sel) => { const l = $(sel).closest('label'); if (l) l.hidden = true; };
function buildPickers() {
  const before = (ref) => (box) => ref.parentNode.insertBefore(box, ref);
  const at = (sel) => (box) => { const l = $(sel).closest('label'); l.parentNode.insertBefore(box, l); };
  picker($('#w-type'), ['', ...WEAPONS], (v) => ICON_OF[v], 'ประเภท', at('#w-type'));
  picker($('#w-line'), ['', ...LINES], (v) => LINE_ICON.w[v], 'สาย', at('#w-line'));
  hideLabel('#w-type'); hideLabel('#w-line');
  picker($('#clan'), CLANS, () => null, 'ตระกูล', before($('#clan')), true);
  picker($('#p-name'), () => (kind === 'demon' ? DEMONS : BREATHS), (v) => ICON_OF[v], 'ชื่อ', before($('#p-name')));
  picker($('#t-line'), ['', ...LINES], (v) => LINE_ICON.a[v], 'สาย', at('#t-line'));
  picker($('#b-line'), ['', ...LINES], (v) => LINE_ICON.a[v], 'สาย', at('#b-line'));
  hideLabel('#t-line'); hideLabel('#b-line');
  $('#clan').addEventListener('input', redrawAll); $('#p-name').addEventListener('input', redrawAll);
  document.querySelectorAll('.seg.big button').forEach((b) => b.addEventListener('click', redrawAll));
  redrawAll();
}
fetch('/api/v1/icons').then((r) => (r.ok ? r.json() : {})).catch(() => ({})).then((j) => { ICONS = j || {}; buildPickers(); });
// ปุ่มกลับ: มาจากหน้าในเว็บนี้ -> ย้อนกลับ, เปิดลิงก์ตรง -> ไปหน้าเข้าสู่ระบบ
$('#back').onclick = (e) => { try { if (document.referrer && new URL(document.referrer).origin === location.origin && history.length > 1) { e.preventDefault(); history.back(); } } catch (x) {} };

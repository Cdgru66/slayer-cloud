/* Slayer Fleet — ฟอร์มสั่งทำไอดี End Game */
'use strict';
const $ = (s) => document.querySelector(s);
// ตัวเลือก (แก้รายชื่อได้ตรงนี้)
const CLANS = ['Kamado', 'Tomioka', 'Agatsuma', 'Hashibira', 'Rengoku', 'Tokito', 'Uzui', 'Kocho', 'Himejima', 'Shinazugawa', 'Iguro', 'Kanroji'];
const WEAPONS = ['Katana', 'Sickles', 'Scythe', 'Spear', 'War Fans', 'Bladed Wagasa', 'Axe and Mace', 'Cutlass', 'Tanto', 'Gauntlet'];
const LINES = ['Nightfall', 'Firstlight'];
const BREATHS = ['Water', 'Flame', 'Thunder', 'Wind', 'Insect', 'Stone', 'Sound', 'Mist', 'Serpent', 'Beast', 'Moon', 'Sun'];
const DEMONS = ['Blood Manipulation', 'Cryokinesis', 'Pyrokinesis', 'Shockwave', 'Reaper', 'Dream', 'Tamari', 'Obi Manipulation'];
let kind = 'breath', sent = false;

const opt = (sel, list, first) => { const e = $(sel); e.replaceChildren(); if (first) e.append(new Option(first, '')); for (const v of list) e.append(typeof v === 'object' ? new Option(v[1], v[0]) : new Option(v, v)); };
const tiers = [['', '—'], ['1', 'T1'], ['2', 'T2'], ['3', 'T3']], pluses = [['', '—'], ...Array.from({ length: 11 }, (_, i) => [String(i), '+' + i])];
opt('#w-type', WEAPONS, 'ไม่ระบุ'); opt('#w-line', LINES, 'ไม่ระบุ');
for (const p of ['t', 'b', 'h']) { opt('#' + p + '-line', LINES, 'ไม่ระบุ'); opt('#' + p + '-tier', tiers); opt('#' + p + '-plus', pluses); }
opt('#w-tier', tiers); opt('#w-plus', pluses);
// ค่าเริ่มต้นแบบตัวอย่าง End Game
$('#w-type').value = 'Katana'; $('#w-line').value = 'Nightfall'; $('#w-tier').value = '3'; $('#w-plus').value = '10';
$('#t-line').value = 'Nightfall'; $('#t-tier').value = '3'; $('#t-plus').value = '10';
$('#dl-clan').replaceChildren(...CLANS.map((c) => new Option(c)));
const setPowerList = () => { $('#dl-power').replaceChildren(...(kind === 'demon' ? DEMONS : BREATHS).map((c) => new Option(c))); $('#p-name').placeholder = kind === 'demon' ? 'เช่น Blood Manipulation' : 'เช่น Water'; };
setPowerList();
document.querySelectorAll('.seg.big button').forEach((b) => (b.onclick = () => { kind = b.dataset.k; document.querySelectorAll('.seg.big button').forEach((x) => x.setAttribute('aria-pressed', x === b)); setPowerList(); update(); }));
// ชุด: Nightfall หมวกกับกางเกงตีบวกได้สูงสุด +3 (เสื้อได้ถึง +10)
const PLUS_CAP = { Nightfall: 3 };
const capOf = (line) => PLUS_CAP[line] ?? null;
const capped = (plus, line) => (plus == null || capOf(line) == null ? plus : Math.min(plus, capOf(line)));
function limitPlus(p) { // จำกัดตัวเลือกตีบวกของกางเกง/หมวกตามสาย
  const sel = $('#' + p + '-plus'), cap = capOf($('#' + p + '-line').value), cur = sel.value;
  opt('#' + p + '-plus', pluses.filter(([v]) => v === '' || cap == null || Number(v) <= cap));
  sel.value = cur !== '' && cap != null && Number(cur) > cap ? String(cap) : cur;
}
function armorSync() {
  const same = $('#same').checked;
  $('#row-bot').hidden = same; $('#row-hat').hidden = same;
  $('#lbl-top').textContent = same ? 'ทั้งชุด' : 'เสื้อ'; $('#lbl-tplus').textContent = same ? 'ตีบวกเสื้อ' : 'ตีบวก';
  limitPlus('b'); limitPlus('h');
  const info = $('#capinfo'), line = $('#t-line').value, tp = num('#t-plus');
  if (same && line && tp != null) {
    const c = capped(tp, line); info.hidden = false;
    info.textContent = c < tp ? `หมวก + กางเกง ${line} ตีบวกได้สูงสุด +${capOf(line)} · ตั้งให้ +${c} อัตโนมัติ` : `หมวก + กางเกง ตีบวก +${c} เท่าเสื้อ`;
  } else info.hidden = true;
}
$('#same').onchange = () => {
  if (!$('#same').checked) for (const p of ['b', 'h']) { // แยกชิ้น: เริ่มจากค่าของเสื้อ (ตีบวกตามเพดานของสาย)
    $('#' + p + '-line').value = $('#t-line').value; $('#' + p + '-tier').value = $('#t-tier').value;
    limitPlus(p); const c = capped(num('#t-plus'), $('#t-line').value); $('#' + p + '-plus').value = c == null ? '' : String(c);
  }
  armorSync(); if (typeof redrawAll === 'function') redrawAll(); if (typeof drawChips === 'function') drawChips(); update();
};
for (const id of ['#t-line', '#t-plus', '#b-line', '#h-line']) $(id).addEventListener('change', () => { armorSync(); update(); });

const num = (id) => { const v = $(id).value; return v === '' ? null : Number(v); };
const gear = (p) => ({ line: $('#' + p + '-line').value, tier: num('#' + p + '-tier'), plus: num('#' + p + '-plus') });
function data() {
  const top = gear('t'), same = $('#same').checked, bottom = same ? Object.assign({}, top, { plus: capped(top.plus, top.line) }) : gear('b'), hat = same ? Object.assign({}, bottom) : gear('h');
  return {
    clan: $('#clan').value.trim(),
    weapon: Object.assign(gear('w'), { type: $('#w-type').value, variant: varEl() ? varEl().value : '', mastery: num('#w-mas') }),
    power: { kind, name: $('#p-name').value.trim(), mastery: num('#p-mas') },
    top, bottom, hat, title: $('#title').value.trim(), level: num('#level'),
    brief: $('#brief').value.trim(), roblox: $('#roblox').value.trim(),
    contact: { via: $('#c-via').value, handle: $('#c-handle').value.trim() }, website: $('#hp').value, pack: packName(),
  };
}
const g = (x) => (x && x.line ? `${x.line}${x.tier ? ' T' + x.tier : ''}${x.plus != null ? '+' + x.plus : ''}` : '');
function text(d) {
  const L = [];
  if (d.pack) L.push('เซท: ' + d.pack);
  if (d.clan) L.push('ตระกูล: ' + d.clan);
  if (d.weapon.type) L.push(`อาวุธ: ${d.weapon.variant ? d.weapon.variant + ' ' + d.weapon.type + ' · ' : d.weapon.type + ' '}${g(d.weapon)}`.trim() + ' · Mastery ตัน');
  if (d.power.name) L.push(`${d.power.kind === 'demon' ? 'มนต์อสูร' : 'ปราณ'}: ${d.power.name}` + ' · Mastery ตัน');
  if ($('#same').checked) { if (d.top.line) L.push(`ชุด ${d.top.line}${d.top.tier ? ' T' + d.top.tier : ''}: เสื้อ${d.top.plus != null ? ' +' + d.top.plus : ''} · หมวก/กางเกง${d.bottom.plus != null ? ' +' + d.bottom.plus : ''}`); }
  else { if (g(d.top)) L.push('เสื้อ: ' + g(d.top)); if (g(d.bottom)) L.push('กางเกง: ' + g(d.bottom)); if (g(d.hat)) L.push('หมวก: ' + g(d.hat)); }
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
  { const cp = typeof compatProblem === 'function' ? compatProblem() : null; if (cp) { $('#err').textContent = 'อาวุธกับปราณจับคู่กันไม่ได้: ' + cp; $('#w-type').closest('fieldset').scrollIntoView({ behavior: 'smooth', block: 'center' }); return; } }
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
      Object.assign(document.createElement('pre'), { className: 'tk-body', textContent: text(d) }),
      payBox(j.id));
    $('#ticket').scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (e) { $('#err').textContent = 'ต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง'; } finally { btn.disabled = false; }
};

// ===== ตัวเลือกแบบการ์ดมีรูปไอเทมจากในเกม =====
const ICON_OF = {
  Katana: 'Regular Katana', Sickles: 'Sickles', Scythe: 'Scythe', Spear: 'Spear', 'War Fans': 'War Fans', Cutlass: 'Cutlass', Tanto: 'Tanto', 'Bladed Wagasa': 'Bladed Wagasa', 'Axe and Mace': 'Nightfall Axe and Mace Schematic',
  Water: 'Water Katana', Flame: 'Flame Katana', Thunder: 'Thunder Katana', Wind: 'Wind Katana', Insect: 'Insect Katana', Stone: 'Stone Haori', Sound: 'Sound Katanas', Mist: 'Mist Kumo Sodenashi', Serpent: 'Serpent Katana', Beast: 'Beast Core',
  'Blood Manipulation': 'Blood Manipulation Orb', Cryokinesis: 'Cryokinesis Orb', Pyrokinesis: 'Pyrokenesis Orb', Shockwave: 'Shockwave Orb', Reaper: 'Reaper Orb',
  Dream: 'Dream Orb', Tamari: 'Tamari Orb', 'Obi Manipulation': 'Obi Manipulation Orb',
};
const LINE_ICON = { w: { Nightfall: 'Nightfall Katana', Firstlight: 'Firstlight Forged Ingot' }, a: { Nightfall: 'Nightfall Mask', Firstlight: 'Firstlight Mask' } };
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
// ไอคอนธาตุ (ใช้ระหว่างที่ยังไม่มีรูปจริงจากเกม)
const ELEM = {
  Thundercloud: ['#ffd84a', 'M13 2 4 14h6l-2 8 10-13h-6l3-7z'],
  Tidal: ['#5fc7ff', 'M2 14c3-4 6-4 9 0s6 4 9 0v3c-3 4-6 4-9 0s-6-4-9 0zM2 8c3-4 6-4 9 0s6 4 9 0v3c-3 4-6 4-9 0S5 7 2 11z'],
  Tornadic: ['#9fe6c8', 'M3 4h18v2H3zM5 9h14v2H5zM7 14h10v2H7zM10 19h5v2h-5z'],
  Volcanic: ['#ff7a3d', 'M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-7 1 2 1 4 3 5 1-3-1-6 0-10z'],
};
function elemIcon(k) { const e = ELEM[k]; if (!e) return null; const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true'); svg.classList.add('elem');
  const p = document.createElementNS(NS, 'path'); p.setAttribute('d', e[1]); p.setAttribute('fill', e[0]); svg.append(p); return svg; }
function icon(label, iconName, isClan) {
  const f = document.createElement('span'); f.className = 'dd-ic';
  if (isClan && label !== 'ไม่ระบุ') f.append(crest(label));
  else if (!ICONS[iconName] && ELEM[label]) f.append(elemIcon(label));
  else if (iconName && ICONS[iconName]) { const im = new Image(); im.src = ICONS[iconName]; im.alt = ''; im.onerror = () => { im.remove(); f.textContent = label[0]; }; f.append(im); }
  else f.textContent = label === 'ไม่ระบุ' ? '–' : label[0];
  return f;
}
// ช่องเลือกแบบเลื่อน มีไอคอนเล็กหน้าชื่อ (ค่าจริงยังเก็บใน select/input เดิมของฟอร์ม)
let openDD = null;
function closeDD() { if (openDD) { openDD.list.hidden = true; openDD.btn.setAttribute('aria-expanded', 'false'); openDD = null; } }
document.addEventListener('click', (e) => { if (openDD && !openDD.box.contains(e.target)) closeDD(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && openDD) { const b = openDD.btn; closeDD(); b.focus(); } });
function picker(el, list, iconOf, title, where, isClan, dis) {
  const box = document.createElement('div'); box.className = 'dd';
  const lab = document.createElement('span'); lab.className = 'dd-cap'; lab.textContent = title;
  const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'dd-btn f'; btn.setAttribute('aria-haspopup', 'listbox'); btn.setAttribute('aria-expanded', 'false');
  const ul = document.createElement('div'); ul.className = 'dd-list'; ul.setAttribute('role', 'listbox'); ul.setAttribute('aria-label', title); ul.hidden = true;
  box.append(lab, btn, ul);
  const items = () => (typeof list === 'function' ? list() : list);
  const draw = () => {
    const cur = el.value, label = cur || (el.tagName === 'INPUT' ? 'แตะเพื่อเลือก' : el.id === 'w-var' ? 'ร่างปกติ' : 'ไม่ระบุ');
    const t = document.createElement('span'); t.className = 'dd-t'; t.textContent = label;
    const chev = document.createElement('span'); chev.className = 'dd-chev'; chev.textContent = '▾';
    btn.replaceChildren(icon(cur || 'ไม่ระบุ', iconOf(cur), isClan), t, chev);
    ul.replaceChildren(...items().map((v) => {
      const o = document.createElement('button'); o.type = 'button'; o.className = 'dd-opt'; o.setAttribute('role', 'option'); o.setAttribute('aria-selected', String(v === cur));
      const ot = document.createElement('span'); ot.textContent = v || (el.id === 'w-var' ? 'ร่างปกติ' : 'ไม่ระบุ');
      o.append(icon(v || 'ไม่ระบุ', iconOf(v), isClan), ot);
      const r = dis ? dis(v) : null, why = r && (r.text || r), block = r && !r.soft;
      if (why) { if (block) o.setAttribute('aria-disabled', 'true'); o.title = why; const sm = document.createElement('small'); sm.className = 'dd-why' + (block ? '' : ' soft'); sm.textContent = why; o.append(sm); }
      o.onclick = () => { if (block) { toast(why, true); return; } el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); closeDD(); redrawAll(); btn.focus(); };
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
  // ไอคอนสายอาวุธตามประเภทที่เลือก: ใช้ตัวอาวุธจริงก่อน ไม่มีค่อยใช้แบบพิมพ์เขียว ไม่ใช้รูปแร่
  const wLineIcon = (v) => (v ? v + ' Forged Ingot' : null); // สาย = แร่ที่ใช้ตีอาวุธ
  picker($('#w-line'), ['', ...LINES], wLineIcon, 'สาย', at('#w-line'), false, (v) => { const al = TYPE_LINES[$('#w-type').value]; return v && al && !al.includes(v) ? $('#w-type').value + ' ไม่มีสาย ' + v : null; });
  hideLabel('#w-type'); hideLabel('#w-line');
  picker($('#clan'), CLANS, () => null, 'ตระกูล', before($('#clan')), true);
  picker($('#p-name'), () => (kind === 'demon' ? DEMONS : BREATHS), (v) => ICON_OF[v], 'เลือกสาย', before($('#p-name')));
  picker($('#t-line'), ['', ...LINES], (v) => LINE_ICON.a[v], 'สาย', at('#t-line'));
  picker($('#b-line'), ['', ...LINES], (v) => LINE_ICON.a[v], 'สาย', at('#b-line'));
  picker($('#h-line'), ['', ...LINES], (v) => LINE_ICON.a[v], 'สาย', at('#h-line'));
  hideLabel('#t-line'); hideLabel('#b-line'); hideLabel('#h-line'); armorSync();
  $('#clan').addEventListener('input', redrawAll); $('#p-name').addEventListener('input', redrawAll);
  document.querySelectorAll('.seg.big button').forEach((b) => b.addEventListener('click', redrawAll));
  redrawAll();
}
fetch('/api/v1/icons').then((r) => (r.ok ? r.json() : {})).catch(() => ({})).then((j) => { ICONS = j || {}; buildPickers(); buildVariant(); buildSets(); });
// ปุ่มกลับ: มาจากหน้าในเว็บนี้ -> ย้อนกลับ, เปิดลิงก์ตรง -> ไปหน้าเข้าสู่ระบบ
$('#back').onclick = (e) => { try { if (document.referrer && new URL(document.referrer).origin === location.origin && history.length > 1) { e.preventDefault(); history.back(); } } catch (x) {} };

// หลังส่งออเดอร์: ขั้นตอนชำระเงิน + QR พร้อมเพย์
function payBox(id) {
  const el = (t, c, txt) => { const e = document.createElement(t); if (c) e.className = c; if (txt) e.textContent = txt; return e; };
  const box = el('div', 'paydone');
  box.append(el('h3', '', 'ขั้นตอนต่อไป'));
  const ol = el('ol', 'steps');
  for (const t of ['รอร้านติดต่อกลับเพื่อสรุปรายละเอียดและราคา', 'ร้านยืนยันราคาแล้ว จึงโอนผ่าน QR ด้านล่าง', 'ส่งสลิปพร้อมเลขออเดอร์ ' + id + ' ให้ร้าน', 'ร้านเริ่มทำไอดี ติดตามความคืบหน้าได้ตลอด']) ol.append(el('li', '', t));
  const img = new Image(590, 800); img.src = '/pay-qr.jpg'; img.alt = 'QR พร้อมเพย์ของร้าน'; img.className = 'qr';
  const dl = el('a', 'btn', 'บันทึกรูป QR'); dl.href = '/pay-qr.jpg'; dl.download = 'qr-promptpay.jpg';
  box.append(ol, img, el('p', 'warn', 'กรุณาโอนหลังร้านยืนยันราคาแล้วเท่านั้น'), dl);
  return box;
}

// ===== แพ็กเกจสำเร็จรูป (แก้ชื่อ/รายละเอียด/ราคาได้ที่นี่) =====
var chosenSet = null;
var PACKS = [
  { id: 'slayer', name: 'สายดาบ End Game', icon: 'Nightfall Katana', price: 'เริ่มต้น 200 บาท',
    lines: ['Katana Nightfall T3+10', 'ปราณ Mastery ตัน', 'ชุด Nightfall T3 (เสื้อ +10)'],
    set: { 'w-type': 'Katana', 'w-line': 'Nightfall', 'w-tier': '3', 'w-plus': '10', 'w-mas': '400', kind: 'breath', 'p-name': 'Water', 'p-mas': '400', 't-line': 'Nightfall', 't-tier': '3', 't-plus': '10' } },
  { id: 'demon', name: 'สายอสูร End Game', icon: 'Blood Manipulation Orb', price: 'เริ่มต้น 200 บาท',
    lines: ['Katana Nightfall T3+10', 'มนต์อสูร Mastery ตัน', 'ชุด Nightfall T3 (เสื้อ +10)'],
    set: { 'w-type': 'Katana', 'w-line': 'Nightfall', 'w-tier': '3', 'w-plus': '10', 'w-mas': '400', kind: 'demon', 'p-name': 'Blood Manipulation', 'p-mas': '400', 't-line': 'Nightfall', 't-tier': '3', 't-plus': '10' } },
  { id: 'custom', name: 'ออกแบบเอง', icon: null, price: 'ราคาตามบรีฟ',
    lines: ['เลือกทุกอย่างเอง', 'หรือเขียนบรีฟอย่างเดียว', 'ร้านประเมินราคาให้'],
    set: { 'w-type': '', 'w-line': '', 'w-tier': '', 'w-plus': '', 'w-mas': '0', 'p-name': '', 'p-mas': '0', 't-line': '', 't-tier': '', 't-plus': '' } },
];
var packSel = null;
function packName() { if (chosenSet) return chosenSet.name; const p = (PACKS || []).find((x) => x.id === packSel); return p && p.id !== 'custom' ? p.name : ''; }
function applyPack(pk) {
  packSel = pk.id;
  if (pk.set.kind) { kind = pk.set.kind; document.querySelectorAll('.seg.big button').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.k === kind))); setPowerList(); }
  for (const [k, v] of Object.entries(pk.set)) { if (k === 'kind') continue; const el = $('#' + k); if (el) el.value = v; }
  if (varEl()) { varEl().value = pk.set['w-var'] || ''; }
  $('#same').checked = true; armorSync();
  redrawAll(); drawPacks(); drawChips(); if (typeof autoPair === 'function') autoPair('pack'); update();
  if (pk.id === 'custom') $('#brief').focus({ preventScroll: true });
  $('#custom-head').scrollIntoView({ behavior: 'smooth', block: 'start' });
  toast(pk.id === 'custom' ? 'เลือกเองหรือเขียนบรีฟด้านล่างได้เลย' : 'เติมฟอร์มให้แล้ว ปรับแต่งต่อด้านล่างได้');
}
let packBox;
function drawPacks() {
  packBox.replaceChildren(...PACKS.map((pk) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'pack' + (pk.id === 'custom' ? ' custom' : ''); b.setAttribute('aria-pressed', String(packSel === pk.id));
    const ic = document.createElement('span'); ic.className = 'pack-ic';
    if (pk.icon && ICONS[pk.icon]) { const im = new Image(); im.src = ICONS[pk.icon]; im.alt = ''; ic.append(im); } else ic.textContent = '✎';
    const nm = document.createElement('b'); nm.textContent = pk.name;
    const ul = document.createElement('ul'); for (const l of pk.lines) { const li = document.createElement('li'); li.textContent = l; ul.append(li); }
    const pr = document.createElement('span'); pr.className = 'pack-pr'; pr.textContent = pk.price;
    b.append(ic, nm, ul, pr); b.onclick = () => applyPack(pk); return b;
  }));
}
// ระดับ T1-T3 เป็นปุ่มกด (ค่าจริงยังอยู่ใน select เดิม)
const chipDraws = [];
function chips(sel) {
  const el = $(sel), wrap = document.createElement('div'); wrap.className = 'chips'; wrap.setAttribute('role', 'radiogroup');
  const draw = () => wrap.replaceChildren(...[['', '–'], ['1', 'T1'], ['2', 'T2'], ['3', 'T3']].map(([v, l]) => {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = l; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(el.value === v));
    b.onclick = () => { el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); drawChips(); }; return b; }));
  el.after(wrap); el.hidden = true; chipDraws.push(draw); draw();
}
function drawChips() { for (const d of chipDraws) d(); }
function buildPacks() {
  const sec = document.createElement('section'); sec.className = 'packs-sec';
  const h = document.createElement('h2'); h.className = 'packs-h'; h.textContent = 'เลือกแพ็กเกจ';
  const sub = document.createElement('p'); sub.className = 'packs-sub'; sub.textContent = 'กดแพ็กเกจเพื่อเติมฟอร์มให้อัตโนมัติ แล้วปรับแต่งต่อด้านล่างได้ทุกอย่าง';
  packBox = document.createElement('div'); packBox.className = 'packs';
  const ch = document.createElement('h2'); ch.className = 'packs-h'; ch.id = 'custom-head'; ch.textContent = 'ปรับแต่งเพิ่ม';
  sec.append(h, sub, packBox);
  const form = $('#of'); $('.ord-main').before(sec); form.prepend(ch);
  for (const s of ['#w-tier', '#t-tier', '#b-tier', '#h-tier']) chips(s);
  drawPacks();
}

// ===== จับคู่อาวุธกับปราณ (แก้กฎได้ตรงนี้) =====
// ร่างอาวุธที่อัปเกรดจาก Nightfall/Firstlight Katana T1 ได้ในโรงตีดาบ แต่ละร่างผูกกับปราณ 1 สาย
// mastery = ปราณที่ใช้ได้ (ไม่ใส่ = ได้ทุกสาย), line = สายที่ทำได้ (ไม่ใส่ = ได้ทุกสาย) · มนต์อสูรใช้ได้กับทุกอาวุธ
var VARIANTS = {
  Katana: [
    { v: '', label: 'ร่างปกติ (ปราณไหนก็ได้)' },
    { v: 'Thundercloud', label: 'Thundercloud Katana', breath: ['Thunder'] },
    { v: 'Tidal', label: 'Tidal Katana', breath: ['Water'] },
    { v: 'Tornadic', label: 'Tornadic Katana', breath: ['Wind'] },
    { v: 'Volcanic', label: 'Volcanic Katana', breath: ['Flame'] },
    { v: 'Insect', label: 'Insect Katana', breath: ['Insect'], line: ['Firstlight'] },
  ],
};
// อาวุธทั้งประเภทที่ใช้ได้กับปราณบางสายเท่านั้น (เติมเมื่อรู้กฎ เช่น 'War Fans': ['Wind'])
var TYPE_BREATH = {};
// อาวุธที่ไม่มีสาย Firstlight (มีแต่ Nightfall)
var TYPE_LINES = { Sickles: ['Nightfall'], Scythe: ['Nightfall'], 'Axe and Mace': ['Nightfall'] };
function varEl() { return document.getElementById('w-var'); }
const variantOf = () => { const t = $('#w-type').value, list = VARIANTS[t] || []; return list.find((x) => x.v === (varEl() ? varEl().value : '')) || null; };
// คืนข้อความปัญหา ถ้าจับคู่ไม่ได้
function compatProblem() {
  if (kind !== 'breath') return null;
  const b = $('#p-name').value.trim(), t = $('#w-type').value, line = $('#w-line').value, va = variantOf();
  if (TYPE_LINES[t] && line && !TYPE_LINES[t].includes(line)) return `${t} มีแต่สาย ${TYPE_LINES[t].join('/')}`;
  if (va && va.line && line && !va.line.includes(line)) return `${va.label} ทำได้เฉพาะสาย ${va.line.join('/')}`;
  if (!b) return null;
  if (va && va.breath && !va.breath.includes(b)) return `${va.label} ใช้ได้กับปราณ ${va.breath.join('/')} เท่านั้น (เลือก ${b} อยู่)`;
  if (TYPE_BREATH[t] && !TYPE_BREATH[t].includes(b)) return `${t} ใช้ได้กับปราณ ${TYPE_BREATH[t].join('/')} เท่านั้น`;
  return null;
}
function showCompat() {
  let w = $('#compat'); const msg = compatProblem();
  if (!w) { w = document.createElement('p'); w.id = 'compat'; w.className = 'compat'; w.setAttribute('role', 'alert'); $('#w-mas').after(w); }
  w.hidden = !msg; w.textContent = msg ? '⚠ ' + msg : '';
  const ok = $('#compat-ok'); if (ok) ok.hidden = !!msg;
}
function buildVariant() {
  const sel = document.createElement('select'); sel.id = 'w-var'; sel.className = 'f';
  const lab = document.createElement('label'); lab.textContent = 'ร่างอาวุธ'; lab.append(sel); lab.hidden = true;
  $('#w-type').closest('label').after(lab);
  const syncOpts = () => { const list = VARIANTS[$('#w-type').value] || []; const cur = sel.value; sel.replaceChildren(...list.map((x) => new Option(x.label, x.v))); sel.value = list.some((x) => x.v === cur) ? cur : ''; };
  syncOpts();
  // ร่างดาบไม่ต้องเลือกเอง: ระบบตั้งตามปราณ แล้วโชว์เป็นป้ายให้รู้
  const info = document.createElement('p'); info.id = 'w-varinfo'; info.className = 'varinfo'; info.hidden = true;
  $('#w-mas').before(info);
  const hide = () => {};
  $('#w-type').addEventListener('change', () => { syncOpts(); hide(); autoPair('type'); redrawAll(); });
  sel.addEventListener('change', () => autoPair('variant'));
  $('#p-name').addEventListener('change', () => autoPair('breath')); $('#p-name').addEventListener('input', () => { showCompat(); });
  document.querySelectorAll('.seg.big button').forEach((b) => b.addEventListener('click', () => { showCompat(); }));
  $('#w-line').addEventListener('change', () => autoPair('line'));
  autoPair('init');
}
// จับคู่ให้อัตโนมัติ: เลือกปราณ -> ตั้งร่างดาบที่คู่กัน / เลือกร่าง -> ตั้งปราณที่คู่กัน
function autoPair(src) {
  const t = $('#w-type').value, list = VARIANTS[t] || [], sel = varEl(), b = $('#p-name').value.trim();
  { const al = TYPE_LINES[t], ln = $('#w-line').value; if (al && ln && !al.includes(ln)) { $('#w-line').value = al[0]; if (src === 'type') toast(t + ' มีแต่สาย ' + al.join('/') + ' ตั้งให้แล้ว'); } }
  let match = null;
  if (sel) {
    match = kind === 'breath' && b ? list.find((x) => x.breath && x.breath.includes(b)) : null;
    const before = sel.value; sel.value = match ? match.v : '';
    if (match && match.line && !match.line.includes($('#w-line').value)) $('#w-line').value = match.line[0];
    if (src === 'breath' && match && before !== match.v && !setBox) toast('ปราณ ' + b + ' ใช้ ' + match.label + ' ให้อัตโนมัติ');
  }
  const info = $('#w-varinfo');
  if (info) {
    info.hidden = !match; info.replaceChildren();
    if (match) { let ic; if (ICONS[match.label]) { ic = new Image(); ic.src = ICONS[match.label]; ic.alt = ''; ic.className = 'vimg'; } else ic = elemIcon(match.v); if (ic) info.append(ic); const t2 = document.createElement('span'); t2.textContent = 'ร่างดาบ: ' + match.label + ' (คู่กับปราณ ' + b + ')' + (match.line ? ' · สาย ' + match.line.join('/') : ''); info.append(t2); }
  }
  redrawAll(); showCompat(); update();
}

// มือถือ: แถบล่างลอย "ส่งออเดอร์" (ใบสั่งทำอยู่ล่างสุดของหน้า)
(function mobileBar() {
  const bar = document.createElement('div'); bar.className = 'mbar';
  const t = document.createElement('span'); t.className = 'mbar-t';
  const b = document.createElement('button'); b.type = 'button'; b.className = 'btn primary'; b.textContent = 'ดูใบสั่งทำ · ส่งออเดอร์';
  b.onclick = () => $('#ticket').scrollIntoView({ behavior: 'smooth', block: 'start' });
  bar.append(t, b); document.body.append(bar);
  const sync = () => { const n = $('#sum').textContent.split('\n').filter((x) => x && x !== 'ยังไม่ได้เลือกอะไร').length; t.textContent = n ? 'เลือกแล้ว ' + n + ' รายการ' : 'ยังไม่ได้เลือก'; };
  new MutationObserver(sync).observe($('#sum'), { childList: true, characterData: true, subtree: true }); sync();
  if ('IntersectionObserver' in window) new IntersectionObserver((es) => { bar.classList.toggle('away', es[0].isIntersecting); }).observe($('#ticket'));
})();

// ===== จัดเซท: สาย + อาวุธ + แร่ ในที่เดียว (ค่าที่เหลือตั้งเป็น End Game ให้อัตโนมัติ) =====
function setDefaults() { // อาวุธ T3+10, ชุดสายเดียวกับอาวุธ T3 เสื้อ +10 (หมวก/กางเกงตามเพดาน), Mastery ตัน
  if (!$('#w-tier').value) $('#w-tier').value = '3'; if ($('#w-plus').value === '') $('#w-plus').value = '10';
  $('#same').checked = true; $('#t-line').value = $('#w-line').value; if (!$('#t-tier').value) $('#t-tier').value = '3'; if ($('#t-plus').value === '') $('#t-plus').value = '10';
  armorSync(); drawChips();
}
function tileBtn(label, iconName, on, onClick, opts = {}) {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'st' + (opts.big ? ' big' : ''); b.setAttribute('aria-pressed', String(on));
  if (opts.off) { b.setAttribute('aria-disabled', 'true'); b.title = opts.off; }
  const ic = icon(label, iconName, false); const t = document.createElement('span'); t.className = 'st-t'; t.textContent = label;
  b.append(ic, t);
  if (opts.sub) { const sm = document.createElement('small'); sm.textContent = opts.sub; t.append(sm); }
  b.onclick = () => { if (opts.off) { toast(opts.off, true); return; } onClick(); };
  return b;
}
let setBox;
function weaponLabel(t) { // ถ้าปราณมีร่างดาบคู่กัน แสดงชื่อร่าง เช่น Tidal Katana
  const b = $('#p-name').value.trim(); const va = kind === 'breath' && b ? (VARIANTS[t] || []).find((x) => x.breath && x.breath.includes(b)) : null;
  return va ? va.label : t;
}
function drawSet() {
  if (!setBox) return;
  const b = $('#p-name').value.trim(), t = $('#w-type').value, line = $('#w-line').value;
  const head = (n, txt) => { const h = document.createElement('p'); h.className = 'st-h'; const i = document.createElement('span'); i.className = 'stepn'; i.textContent = 'ขั้น ' + n; h.append(i, txt); return h; };
  // การ์ดสรุปเซท
  const card = document.createElement('div'); card.className = 'setcard';
  const icons = document.createElement('div'); icons.className = 'sc-icons';
  const wl = t ? weaponLabel(t) : '';
  const parts = [[wl || 'อาวุธ', wl ? (ICONS[wl] ? wl : ICON_OF[t]) : null], [b || 'สาย', ICON_OF[b] || null], [line || 'แร่', line ? line + ' Forged Ingot' : null]];
  parts.forEach(([l, ic], i) => { if (i) { const plus = document.createElement('span'); plus.className = 'sc-plus'; plus.textContent = '+'; icons.append(plus); } const c = icon(l, ic, false); c.classList.add('sc-ic'); if (!ic && !ICONS[l]) c.classList.add('empty'); icons.append(c); });
  const ttl = document.createElement('b'); ttl.className = 'sc-t'; ttl.textContent = [wl, b, line].filter(Boolean).join(' + ') || 'ยังไม่ได้เลือกเซท';
  const sub = document.createElement('small'); sub.className = 'sc-s';
  sub.textContent = line ? `อาวุธ ${line} T${$('#w-tier').value || 3}+${$('#w-plus').value || 10} · ชุด ${$('#t-line').value || line} T${$('#t-tier').value || 3} · Mastery ตันทุกอย่าง` : 'เลือก 3 ขั้นด้านล่าง ที่เหลือร้านจัดเป็น End Game ให้';
  const txt = document.createElement('div'); txt.append(ttl, sub); card.append(icons, txt);
  // ขั้น 1: สาย
  const seg = document.createElement('div'); seg.className = 'seg big';
  for (const [k, l] of [['breath', 'ปราณ (มนุษย์)'], ['demon', 'มนต์อสูร (อสูร)']]) { const x = document.createElement('button'); x.type = 'button'; x.textContent = l; x.setAttribute('aria-pressed', String(kind === k)); x.onclick = () => { if (kind === k) return; kind = k; document.querySelectorAll('.seg.big button[data-k]').forEach((y) => y.setAttribute('aria-pressed', String(y.dataset.k === k))); setPowerList(); $('#p-name').value = ''; autoPair('kind'); drawSet(); }; seg.append(x); }
  const g1 = document.createElement('div'); g1.className = 'st-grid';
  for (const n of kind === 'demon' ? DEMONS : BREATHS) g1.append(tileBtn(n, ICON_OF[n], b === n, () => { $('#p-name').value = n; autoPair('breath'); drawSet(); }));
  // ขั้น 2: อาวุธ
  const g2 = document.createElement('div'); g2.className = 'st-grid';
  for (const w of WEAPONS) { const lab = weaponLabel(w); g2.append(tileBtn(lab, ICONS[lab] ? lab : ICON_OF[w], t === w, () => { $('#w-type').value = w; $('#w-type').dispatchEvent(new Event('change', { bubbles: true })); setDefaults(); drawSet(); })); }
  // ขั้น 3: แร่
  const g3 = document.createElement('div'); g3.className = 'st-grid two';
  const va = variantOf();
  for (const l of LINES) {
    const al = TYPE_LINES[t]; let off = null;
    if (al && !al.includes(l)) off = `${t} ไม่มีสาย ${l}`; else if (va && va.line && !va.line.includes(l)) off = `${va.label} มีแต่สาย ${va.line.join('/')}`;
    g3.append(tileBtn(l, l + ' Forged Ingot', line === l, () => { $('#w-line').value = l; $('#w-line').dispatchEvent(new Event('change', { bubbles: true })); $('#t-line').value = l; setDefaults(); autoPair('line'); drawSet(); }, { big: true, off, sub: off ? 'ไม่มีให้เลือก' : l === 'Nightfall' ? 'หมวก/กางเกงตีได้ถึง +3' : '' }));
  }
  const adv = document.createElement('button'); adv.type = 'button'; adv.className = 'btn advbtn'; adv.textContent = document.body.classList.contains('show-adv') ? 'ซ่อนการปรับละเอียด' : '⚙ ปรับละเอียด (ระดับ / ตีบวก / ชุดแยกชิ้น)';
  adv.onclick = () => { document.body.classList.toggle('show-adv'); drawSet(); if (document.body.classList.contains('show-adv')) document.querySelector('.og.adv').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  setBox.replaceChildren(card, head('1', 'เลือกสาย'), seg, g1, head('2', 'เลือกอาวุธ'), g2, head('3', 'เลือกแร่'), g3, adv);
}
function buildSet() {
  const fs = document.createElement('fieldset'); fs.className = 'og setb';
  const lg = document.createElement('legend'); lg.innerHTML = '<span class="on">1</span>จัดเซทของคุณ';
  setBox = document.createElement('div'); setBox.className = 'setbox';
  fs.append(lg, setBox);
  const first = document.querySelector('#of fieldset.og'); first.parentNode.insertBefore(fs, first);
  $('#p-name').value = ''; setDefaults(); autoPair('init');
  $('#of').addEventListener('change', () => drawSet()); drawSet();
}

// ===== เลือกเซทสำเร็จรูป (ร้านตั้งเซทเองในหน้าแอดมิน แท็บ เซท) =====
let SETS = [];
const gtxt = (w) => (w && w.line ? `${w.line}${w.tier ? ' T' + w.tier : ''}${w.plus != null ? '+' + w.plus : ''}` : '');
function setIcon(st) {
  const k = st.icon && ICONS[st.icon] ? st.icon : st.weapon && ICON_OF[st.weapon.type] && ICONS[ICON_OF[st.weapon.type]] ? ICON_OF[st.weapon.type] : st.power && ICON_OF[st.power.name] ? ICON_OF[st.power.name] : null;
  const f = document.createElement('span'); f.className = 'set-ic';
  if (k && ICONS[k]) { const im = new Image(); im.src = ICONS[k]; im.alt = ''; f.append(im); } else f.textContent = (st.name || '?')[0];
  return f;
}
function miniIcon(name) { const f = document.createElement('span'); f.className = 'mi'; if (name && ICONS[name]) { const im = new Image(); im.src = ICONS[name]; im.alt = ''; f.append(im); } return f; }
function applySet(st) {
  chosenSet = st;
  const w = st.weapon || {}, a = st.armor || {}, pw = st.power || {};
  $('#w-type').value = w.type || ''; $('#w-line').value = w.line || ''; $('#w-tier').value = w.tier != null ? String(w.tier) : ''; $('#w-plus').value = w.plus != null ? String(w.plus) : '';
  kind = pw.kind === 'demon' ? 'demon' : 'breath'; document.querySelectorAll('.seg.big button[data-k]').forEach((y) => y.setAttribute('aria-pressed', String(y.dataset.k === kind))); setPowerList();
  $('#p-name').value = pw.name || '';
  $('#same').checked = true; $('#t-line').value = a.line || w.line || ''; $('#t-tier').value = a.tier != null ? String(a.tier) : ''; $('#t-plus').value = a.plus != null ? String(a.plus) : '';
  armorSync(); drawChips(); if (varEl()) { const list = VARIANTS[$('#w-type').value] || []; varEl().replaceChildren(...list.map((x) => new Option(x.label, x.v))); }
  autoPair('set'); drawSets(); update();
  toast('เลือกเซท ' + st.name + ' แล้ว');
}
function clearSet() {
  chosenSet = null; for (const id of ['#w-type', '#w-line', '#w-tier', '#w-plus', '#p-name', '#t-line', '#t-tier', '#t-plus']) $(id).value = '';
  armorSync(); drawChips(); autoPair('clear'); drawSets(); update();
  document.body.classList.add('show-adv'); $('#brief').scrollIntoView({ behavior: 'smooth', block: 'center' }); toast('เลือกเองด้านล่าง หรือเขียนบรีฟบอกร้านได้เลย');
}
let setsGrid, setsFilter = 'all', setsSeg;
function drawSets() {
  if (!setsGrid) return;
  if (setsSeg) setsSeg.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.f === setsFilter)));
  const cards = SETS.filter((st) => setsFilter === 'all' || (st.power && st.power.kind) === setsFilter || (chosenSet && chosenSet.id === st.id)).map((st) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'setc'; b.setAttribute('aria-pressed', String(chosenSet && chosenSet.id === st.id));
    const top = document.createElement('div'); top.className = 'setc-top';
    const nm = document.createElement('b'); nm.className = 'setc-n'; nm.textContent = st.name;
    const note = document.createElement('small'); note.className = 'setc-note'; note.textContent = st.note || '';
    const nt = document.createElement('div'); nt.append(nm, note); top.append(setIcon(st), nt);
    const ul = document.createElement('ul'); ul.className = 'setc-l';
    const li = (iconName, txt) => { const x = document.createElement('li'); x.append(miniIcon(iconName)); const t = document.createElement('span'); t.textContent = txt; x.append(t); ul.append(x); };
    const w = st.weapon || {}, pw = st.power || {}, a = st.armor || {};
    if (w.type) li(ICON_OF[w.type], `${w.type} ${gtxt(w)}`.trim());
    if (pw.name) li(pw.kind === 'demon' ? ICON_OF[pw.name] : ICON_OF[pw.name], (pw.kind === 'demon' ? 'มนต์อสูร ' : 'ปราณ ') + pw.name);
    if (a.line) li(a.line + ' Mask', 'ชุด ' + gtxt(a));
    li(null, 'Mastery ตันทุกอย่าง');
    const pr = document.createElement('span'); pr.className = 'setc-p'; pr.textContent = st.price || '';
    const pick = document.createElement('span'); pick.className = 'setc-go'; pick.textContent = chosenSet && chosenSet.id === st.id ? '✓ เลือกแล้ว' : 'เลือกเซทนี้';
    const foot = document.createElement('div'); foot.className = 'setc-f'; foot.append(pr, pick);
    b.append(top, ul, foot); b.onclick = () => applySet(st); return b;
  });
  const own = document.createElement('button'); own.type = 'button'; own.className = 'setc own'; own.setAttribute('aria-pressed', String(!chosenSet && document.body.classList.contains('show-adv')));
  own.innerHTML = '<span class="set-ic">✎</span><b class="setc-n">ไม่มีเซทที่ใช่?</b><small class="setc-note">เลือกเองหรือเขียนบรีฟ ร้านประเมินราคาให้</small><span class="setc-go">สั่งแบบอื่น</span>';
  own.onclick = clearSet;
  setsGrid.replaceChildren(...cards, own);
}
async function buildSets() {
  try { const r = await fetch('/api/v1/sets'); SETS = r.ok ? await r.json() : []; } catch (e) { SETS = []; }
  const fs = document.createElement('fieldset'); fs.className = 'og setsf';
  const lg = document.createElement('legend'); lg.innerHTML = '<span class="on">1</span>เลือกเซท';
  const sub = document.createElement('p'); sub.className = 'packs-sub'; sub.textContent = 'กดเซทเดียวจบ ร้านจัดให้ครบตามเซท อยากเพิ่มอะไรเขียนในบรีฟได้';
  setsGrid = document.createElement('div'); setsGrid.className = 'sets';
  setsSeg = document.createElement('div'); setsSeg.className = 'seg big setsseg';
  for (const [f, l] of [['all', 'ทั้งหมด'], ['breath', 'สายปราณ'], ['demon', 'สายอสูร']]) { const x = document.createElement('button'); x.type = 'button'; x.dataset.f = f; x.textContent = l; x.onclick = () => { setsFilter = f; drawSets(); }; setsSeg.append(x); }
  fs.append(lg, sub, setsSeg, setsGrid);
  const first = document.querySelector('#of fieldset.og'); first.parentNode.insertBefore(fs, first);
  for (const id of ['#w-type', '#w-line', '#w-tier', '#w-plus', '#p-name', '#t-line', '#t-tier', '#t-plus']) $(id).value = '';
  armorSync(); drawChips(); autoPair('init'); drawSets(); update();
  // แก้ค่าเองในส่วนปรับละเอียด = ไม่ใช่เซทเดิมแล้ว
  $('#of').addEventListener('change', (e) => { if (chosenSet && e.target && e.target.closest('.og.adv') && e.isTrusted) { chosenSet = Object.assign({}, chosenSet, { name: chosenSet.name + ' (ปรับเอง)' }); update(); } });
}

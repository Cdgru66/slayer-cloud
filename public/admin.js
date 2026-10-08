/* Slayer Fleet — หน้าแอดมิน */
'use strict';
const $ = (s) => document.querySelector(s);
const h = (t, a = {}, ...k) => { const e = document.createElement(t); for (const [x, v] of Object.entries(a)) { if (x.startsWith('aria-') && typeof v === 'boolean') { e.setAttribute(x, String(v)); continue; } if (v == null || v === false) continue; if (x === 'class') e.className = v; else if (x.startsWith('on')) e[x] = v; else e.setAttribute(x, v === true ? '' : v); } for (const c of k.flat()) { if (c == null || c === false) continue; e.append(c.nodeType ? c : document.createTextNode(c)); } return e; };
const fmtDate = (t) => (t ? new Date(t * 1000).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '–');
const ago = (s) => (s == null ? '–' : s < 90 ? Math.round(s) + ' วิ' : s < 5400 ? Math.round(s / 60) + ' นาที' : s < 172800 ? Math.round(s / 3600) + ' ชม.' : Math.round(s / 86400) + ' วัน');
let TOKEN = null, D = null, tab = 'cust', open = new Set(), justPw = {};
try { TOKEN = localStorage.getItem('sf_at'); } catch (e) {}

function toast(msg, bad) { const t = $('#toast'); t.textContent = msg; t.className = 'toast on' + (bad ? ' bad' : ''); clearTimeout(toast.t); toast.t = setTimeout(() => (t.className = 'toast'), 3200); }
async function api(path, opt = {}) {
  const r = await fetch('/api/v1/admin/' + path, { method: opt.method || 'GET', headers: Object.assign({ Authorization: 'Bearer ' + TOKEN }, opt.body ? { 'Content-Type': 'application/json' } : {}), body: opt.body ? JSON.stringify(opt.body) : undefined });
  let j = {}; try { j = await r.json(); } catch (e) {}
  if (r.status === 401) { logout(true); throw new Error(j.error || 'ต้องล็อกอินใหม่'); }
  if (!r.ok) throw new Error(j.error || 'ผิดพลาด ' + r.status);
  return j;
}
async function act(fn, okMsg) { try { const r = await fn(); if (okMsg) toast(okMsg); await load(); return r; } catch (e) { toast(e.message, true); } }
async function copy(text, label) { try { await navigator.clipboard.writeText(text); toast('ก๊อป' + (label || '') + 'แล้ว'); } catch (e) { prompt('ก๊อปข้อความนี้', text); } }

/* ---------- ล็อกอิน ---------- */
$('#login-form').onsubmit = async (e) => {
  e.preventDefault(); $('#login-err').textContent = ''; $('#login-go').disabled = true;
  try {
    const r = await fetch('/api/v1/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pass: $('#login-pass').value }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { $('#login-err').textContent = j.error || 'เข้าสู่ระบบไม่สำเร็จ'; return; }
    TOKEN = j.token; try { localStorage.setItem('sf_at', TOKEN); } catch (x) {}
    $('#login-pass').value = ''; start();
  } catch (x) { $('#login-err').textContent = 'ต่อเซิร์ฟเวอร์ไม่ได้'; } finally { $('#login-go').disabled = false; }
};
function logout(expired) {
  if (!expired && TOKEN) fetch('/api/v1/admin/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN } }).catch(() => {});
  TOKEN = null; try { localStorage.removeItem('sf_at'); } catch (e) {}
  clearInterval(start.t); $('#app').hidden = true; $('#gate').hidden = false;
  if (expired) $('#login-err').textContent = 'หมดเวลาเข้าสู่ระบบ กรุณาเข้าใหม่';
}
$('#logout').onclick = () => logout(false);
document.querySelectorAll('.tabs button').forEach((b) => (b.onclick = () => { tab = b.dataset.tab; document.querySelectorAll('.tabs button').forEach((x) => x.setAttribute('aria-selected', x === b)); document.querySelectorAll('.tabp').forEach((p) => (p.hidden = p.id !== 'tab-' + tab)); render(); }));

async function load() { D = await api('overview'); render(); }
function start() { $('#gate').hidden = true; $('#app').hidden = false; load().catch((e) => toast(e.message, true)); clearInterval(start.t); start.t = setInterval(() => { if (!document.hidden && !document.querySelector('.adm-main input:focus, .adm-main textarea:focus')) load().catch(() => {}); }, 15000); }

/* ---------- แสดงผล ---------- */
function render() {
  if (!D) return;
  $('#ver').textContent = 'v' + D.version;
  $('#c-cust').textContent = D.customers.length;
  const un = D.seen.filter((s) => !s.owner).length;
  $('#c-acc').textContent = D.seen.length + (un ? ' · ' + un + ' ว่าง' : '');
  const nw = (D.orders || []).filter((o) => o.status === 'ใหม่').length;
  $('#c-ord').textContent = nw ? nw + ' ใหม่' : (D.orders || []).length || '';
  ({ cust: renderCust, ord: renderOrd, acc: renderAcc, ops: renderOps, bak: renderBak })[tab]();
}

function statusOf(c) {
  const left = c.expires ? (c.expires - D.serverTime) / 86400 : null;
  if (c.revoked) return ['ถูกระงับ', 'var(--red)'];
  if (left != null && left < 0) return ['หมดอายุ', 'var(--red)'];
  if (left != null && left < 3) return ['เหลือ ' + Math.max(0, Math.ceil(left)) + ' วัน', 'var(--warn)'];
  return ['ใช้งานได้', 'var(--ok)'];
}
const seenNames = () => D.seen.map((s) => s.name);
function accList(id) { const l = h('datalist', { id }); for (const s of D.seen) l.append(h('option', { value: s.name }, s.owner ? 'ของ ' + s.owner.name : 'ยังไม่มีเจ้าของ')); return l; }
function shareText(c, pw) {
  return `ลิงก์ดูไอดี: ${D.base}\nชื่อผู้ใช้: ${c.accounts[0] || '(ชื่อไอดี Roblox ของคุณ)'}\n` + (pw ? `รหัสผ่าน: ${pw}\n` : '') + `ใช้ได้ถึง: ${fmtDate(c.expires)}`;
}

function renderCust() {
  const p = $('#tab-cust');
  const nm = h('input', { class: 'f', placeholder: 'ชื่อลูกค้า (เช่น ชื่อเฟซ)', maxlength: '60' });
  const dy = h('input', { class: 'f', type: 'number', min: '1', max: '3650', value: '30', 'aria-label': 'จำนวนวัน' });
  const ac = h('input', { class: 'f', placeholder: 'ชื่อผู้ใช้ Roblox คั่นด้วย ,', list: 'dl-new' });
  const free = D.seen.filter((s) => !s.owner);
  const add = h('form', { class: 'card addc', onsubmit: async (e) => {
    e.preventDefault();
    const r = await act(() => api('customer', { method: 'POST', body: { name: nm.value, days: Number(dy.value), accounts: ac.value } }), 'เพิ่มลูกค้าแล้ว');
    if (r) { justPw[r.id] = r.password; open.add(r.id); render(); }
  } },
    h('h3', {}, 'เพิ่มลูกค้าใหม่'),
    h('div', { class: 'grid3' }, h('label', {}, 'ชื่อลูกค้า', nm), h('label', {}, 'ใช้งานได้กี่วัน', dy), h('label', {}, 'ไอดีในเกม', ac, accList('dl-new'))),
    free.length ? h('div', { class: 'chips2' }, h('span', { class: 'mu' }, 'ไอดีที่ยังไม่มีเจ้าของ:'), free.slice(0, 20).map((s) => h('button', { type: 'button', class: 'chip2', onclick: () => { const v = ac.value.split(/[\s,]+/).filter(Boolean); if (!v.includes(s.name)) v.push(s.name); ac.value = v.join(', '); } }, '+ ' + s.name))) : null,
    h('button', { class: 'btn primary', type: 'submit' }, 'เพิ่มลูกค้า + สร้างรหัส'));
  const list = D.customers.map((c) => custCard(c));
  p.replaceChildren(add, list.length ? h('div', { class: 'clist' }, list) : h('p', { class: 'empty' }, 'ยังไม่มีลูกค้า เพิ่มคนแรกด้านบน'));
}

function custCard(c) {
  const [st, col] = statusOf(c), isOpen = open.has(c.id), pw = justPw[c.id];
  const head = h('button', { class: 'chead', 'aria-expanded': isOpen, onclick: () => { isOpen ? open.delete(c.id) : open.add(c.id); render(); } },
    h('span', { class: 'cname' }, c.name), h('span', { class: 'pill', style: '--c:' + col }, st),
    h('span', { class: 'cmeta' }, (c.accounts.length ? c.accounts.join(', ') : 'ยังไม่มีไอดี') + ' · ถึง ' + fmtDate(c.expires)));
  if (!isOpen) return h('div', { class: 'card cc' }, head);
  const accIn = h('input', { class: 'f', placeholder: 'เพิ่มไอดี (ชื่อผู้ใช้ Roblox)', list: 'dl-' + c.id });
  const hook = h('input', { class: 'f', placeholder: 'https://discord.com/api/webhooks/...', value: '' });
  return h('div', { class: 'card cc open' }, head,
    pw ? h('div', { class: 'newpw' }, h('p', {}, 'รหัสผ่านของลูกค้าคนนี้ (แสดงครั้งเดียว จดหรือก๊อปส่งเลย):'), h('b', {}, pw),
      h('div', { class: 'rowb' }, h('button', { class: 'btn primary', onclick: () => copy(shareText(c, pw), 'ข้อความส่งลูกค้า') }, 'ก๊อปข้อความส่งลูกค้า'), h('button', { class: 'btn', onclick: () => { delete justPw[c.id]; render(); } }, 'จดแล้ว ซ่อนรหัส'))) : null,
    h('div', { class: 'sec' }, h('h4', {}, 'ไอดีในเกม'),
      h('div', { class: 'chips2' }, c.accounts.length ? c.accounts.map((n) => h('span', { class: 'chip2 on' }, n, h('button', { class: 'x2', 'aria-label': 'เอา ' + n + ' ออก', onclick: () => act(() => api('customer/' + c.id + '/assign', { method: 'POST', body: { remove: [n] } }), 'เอา ' + n + ' ออกแล้ว') }, '×'))) : h('span', { class: 'mu' }, 'ยังไม่มี')),
      h('form', { class: 'rowb', onsubmit: (e) => { e.preventDefault(); act(() => api('customer/' + c.id + '/assign', { method: 'POST', body: { add: accIn.value.split(/[\s,]+/) } }), 'เพิ่มไอดีแล้ว'); } }, accIn, accList('dl-' + c.id), h('button', { class: 'btn', type: 'submit' }, 'เพิ่ม'))),
    h('div', { class: 'sec' }, h('h4', {}, 'อายุการใช้งาน · ถึง ' + fmtDate(c.expires)),
      h('div', { class: 'rowb' }, [7, 30, 90].map((d) => h('button', { class: 'btn', onclick: () => act(() => api('customer/' + c.id + '/renew', { method: 'POST', body: { days: d } }), 'ต่ออายุ ' + d + ' วันแล้ว') }, '+' + d + ' วัน')),
        h('button', { class: 'btn', onclick: () => act(() => api('customer/' + c.id + '/revoke', { method: 'POST', body: { revoked: !c.revoked } }), c.revoked ? 'เปิดใช้งานแล้ว' : 'ระงับแล้ว') }, c.revoked ? 'เปิดใช้งาน' : 'ระงับ'))),
    h('div', { class: 'sec' }, h('h4', {}, 'การเข้าดู'),
      h('div', { class: 'rowb' },
        h('button', { class: 'btn', onclick: () => copy(shareText(c, null), 'ข้อความส่งลูกค้า') }, 'ก๊อปข้อความส่งลูกค้า'),
        h('button', { class: 'btn', onclick: async () => { const r = await act(() => api('customer/' + c.id + '/password', { method: 'POST', body: {} }), 'ตั้งรหัสใหม่แล้ว'); if (r) { justPw[c.id] = r.password; render(); } } }, 'รีเซ็ตรหัสผ่าน'),
        c.link ? h('button', { class: 'btn', onclick: () => copy(c.link, 'ลิงก์ตรง') }, 'ก๊อปลิงก์ตรง (ไม่ต้องล็อกอิน)') : null,
        h('button', { class: 'btn', onclick: () => { if (confirm('ออกลิงก์ใหม่? ลิงก์ตรงเดิมและคนที่ล็อกอินค้างไว้จะเข้าไม่ได้จนกว่าจะล็อกอินใหม่')) act(() => api('customer/' + c.id + '/rotate', { method: 'POST', body: {} }), 'ออกลิงก์ใหม่แล้ว'); } }, 'ตัดการเข้าถึงเดิม'))),
    h('div', { class: 'sec' }, h('h4', {}, 'Discord ของลูกค้า ' + (c.webhook ? '(ตั้งไว้แล้ว)' : '(ยังไม่ตั้ง)')),
      h('p', { class: 'note' }, 'ลูกค้าจะได้สรุปรายวัน เลเวลอัป ของหายาก และเตือนใกล้หมดอายุ เฉพาะไอดีของเขา'),
      h('form', { class: 'rowb', onsubmit: (e) => { e.preventDefault(); act(() => api('customer/' + c.id + '/webhook', { method: 'POST', body: { url: hook.value } }), hook.value ? 'บันทึก Discord แล้ว' : 'ลบ Discord แล้ว'); } }, hook, h('button', { class: 'btn', type: 'submit' }, c.webhook && !hook.value ? 'ลบ' : 'บันทึก'))),
    h('div', { class: 'sec danger' }, h('button', { class: 'btn bad', onclick: () => { if (prompt('ลบลูกค้า "' + c.name + '" ถาวร? พิมพ์ YES เพื่อยืนยัน') === 'YES') { open.delete(c.id); act(() => api('customer/' + c.id, { method: 'DELETE' }), 'ลบแล้ว'); } } }, 'ลบลูกค้า')));
}

const VIA = { facebook: 'Facebook', discord: 'Discord', line: 'LINE', other: 'อื่น ๆ' };
const ST_COL = { 'ใหม่': 'var(--gold)', 'คุยแล้ว': 'var(--steel)', 'รอชำระเงิน': 'var(--warn)', 'กำลังทำ': 'var(--ok)', 'เสร็จแล้ว': 'var(--mu)', 'ยกเลิก': 'var(--red)' };
let ordFilter = 'open';
function renderOrd() {
  const p = $('#tab-ord'), all = D.orders || [];
  const shown = all.filter((o) => ordFilter === 'all' || (ordFilter === 'open' ? !['เสร็จแล้ว', 'ยกเลิก'].includes(o.status) : o.status === ordFilter));
  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'กรองออเดอร์' }, [['open', 'ยังไม่จบ'], ['ใหม่', 'ใหม่'], ['all', 'ทั้งหมด']].map(([v, l]) => h('button', { 'aria-pressed': ordFilter === v, onclick: () => { ordFilter = v; render(); } }, l)));
  const cards = shown.map((o) => {
    const isOpen = open.has(o.id);
    const head = h('button', { class: 'chead', 'aria-expanded': isOpen, onclick: () => { isOpen ? open.delete(o.id) : open.add(o.id); render(); } },
      h('span', { class: 'cname' }, o.id), h('span', { class: 'pill', style: '--c:' + (ST_COL[o.status] || 'var(--mu)') }, o.status),
      h('span', { class: 'cmeta' }, (VIA[o.contact.via] || '') + ' ' + o.contact.handle + ' · ' + new Date(o.time * 1000).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + (o.quote != null ? ' · ' + o.quote.toLocaleString() + ' บาท' : '')));
    if (!isOpen) return h('div', { class: 'card cc' }, head);
    const st = h('select', { class: 'f' }, (D.orderStatuses || []).map((x) => h('option', { value: x, selected: x === o.status }, x)));
    const q = h('input', { class: 'f', type: 'number', min: '0', placeholder: 'ราคาที่เสนอ (บาท)', value: o.quote ?? '' });
    const note = h('textarea', { class: 'f', rows: '2', placeholder: 'โน้ตของร้าน (ลูกค้าไม่เห็น)' }, o.note || '');
    return h('div', { class: 'card cc open' }, head,
      h('div', { class: 'sec' }, h('pre', { class: 'tk-body osum' }, o.summary || '')),
      h('div', { class: 'sec' }, h('h4', {}, 'ติดต่อกลับ'), h('div', { class: 'rowb' }, h('span', { class: 'chip2 on' }, (VIA[o.contact.via] || '') + ': ' + o.contact.handle), h('button', { class: 'btn', onclick: () => copy(o.contact.handle, 'ช่องทางติดต่อ') }, 'ก๊อป'), h('button', { class: 'btn', onclick: () => copy(o.id + '\n' + (o.summary || ''), 'รายละเอียดออเดอร์') }, 'ก๊อปรายละเอียด'))),
      h('form', { class: 'sec ofrm', onsubmit: (e) => { e.preventDefault(); act(() => api('order/' + o.id, { method: 'POST', body: { status: st.value, quote: q.value, note: note.value } }), 'บันทึกออเดอร์แล้ว'); } },
        h('label', {}, 'สถานะ', st), h('label', {}, 'ราคา (บาท)', q), h('label', { class: 'wide' }, 'โน้ต', note), h('button', { class: 'btn primary', type: 'submit' }, 'บันทึก')),
      h('div', { class: 'sec danger' }, h('button', { class: 'btn bad', onclick: () => { if (confirm('ลบออเดอร์ ' + o.id + '?')) { open.delete(o.id); act(() => api('order/' + o.id, { method: 'DELETE' }), 'ลบแล้ว'); } } }, 'ลบออเดอร์')));
  });
  p.replaceChildren(h('div', { class: 'ordbar' }, seg, h('button', { class: 'btn', onclick: () => copy(D.base + '/order', 'ลิงก์หน้าสั่งทำ') }, 'ก๊อปลิงก์หน้าสั่งทำ')),
    cards.length ? h('div', { class: 'clist' }, cards) : h('p', { class: 'empty' }, all.length ? 'ไม่มีออเดอร์ในตัวกรองนี้' : 'ยังไม่มีออเดอร์ ส่งลิงก์หน้าสั่งทำให้ลูกค้าได้เลย'));
}

function renderAcc() {
  const p = $('#tab-acc');
  if (!D.seen.length) { p.replaceChildren(h('p', { class: 'empty' }, 'ยังไม่มีไอดีส่งข้อมูลเข้ามา รัน OWNER-LOADER.lua ในเกมก่อน')); return; }
  const rows = D.seen.slice().sort((a, b) => (a.owner ? 1 : 0) - (b.owner ? 1 : 0) || (a.last ?? 1e9) - (b.last ?? 1e9)).map((s) => {
    const on = s.last != null && s.last < Math.max(90, (s.interval || 300) * 2.5);
    const sel = h('select', { class: 'f', 'aria-label': 'เจ้าของ ' + s.name, onchange: (e) => {
      const to = e.target.value;
      if (to) act(() => api('customer/' + to + '/assign', { method: 'POST', body: { add: [s.name] } }), s.name + ' → ' + e.target.selectedOptions[0].textContent);
      else if (s.owner) act(() => api('customer/' + s.owner.id + '/assign', { method: 'POST', body: { remove: [s.name] } }), 'เอา ' + s.name + ' ออกจากลูกค้าแล้ว');
    } }, h('option', { value: '' }, '— ยังไม่มีเจ้าของ —'), D.customers.map((c) => h('option', { value: c.id, selected: s.owner && s.owner.id === c.id }, c.name)));
    return h('div', { class: 'arow' + (s.owner ? '' : ' free') },
      h('i', { class: 'dot', style: '--c:' + (on ? 'var(--ok)' : 'var(--dim)') }),
      h('div', { class: 'an' }, h('b', {}, s.display || s.name), h('small', {}, '@' + s.name + (s.level ? ' · Lv ' + s.level : ''))),
      h('span', { class: 'mu al' }, on ? 'ออนไลน์' : 'ล่าสุด ' + ago(s.last) + (s.rejoin ? ' · รีจอย ' + s.rejoin.n + ' ครั้ง' : '')),
      sel);
  });
  p.replaceChildren(h('p', { class: 'note' }, 'เลือกเจ้าของจากช่องเลือกได้เลย ไอดีหนึ่งมีเจ้าของได้คนเดียว (ไอดีที่ยังไม่มีเจ้าของอยู่บนสุด)'), h('div', { class: 'card alist' }, rows));
}

function toggle(label, on, cb, hint) { return h('label', { class: 'tg' }, h('input', { type: 'checkbox', checked: on, onchange: (e) => cb(e.target.checked) }), h('span', { class: 'tgk' }), h('span', {}, label, hint ? h('small', {}, hint) : null)); }
function renderOps() {
  const p = $('#tab-ops'), r = D.rejoin, n = D.notify;
  const dc = h('input', { class: 'f', placeholder: r.discord ? '(ตั้งไว้แล้ว ใส่ใหม่เพื่อเปลี่ยน)' : 'https://discord.com/api/webhooks/...' });
  const hour = h('input', { class: 'f', type: 'number', value: n.dailyHour, min: '0', max: '23' });
  const rare = h('textarea', { class: 'f', rows: '3' }, (n.rareList || []).join(', '));
  const setN = (b) => act(() => api('notify', { method: 'POST', body: b }), 'บันทึกแล้ว');
  p.replaceChildren(
    h('div', { class: 'card' }, h('h3', {}, 'Discord ของร้าน'),
      h('p', { class: 'note' }, 'ห้องที่รับแจ้งเตือนทั้งหมด (หลุด/รีจอย ค้าง เลเวลอัป ของหายาก สรุปรายวัน ลูกค้าใกล้หมดอายุ)'),
      h('form', { class: 'rowb', onsubmit: (e) => { e.preventDefault(); act(() => api('rejoin', { method: 'POST', body: { discord: dc.value } }), 'บันทึก Discord แล้ว'); } }, dc, h('button', { class: 'btn', type: 'submit' }, 'บันทึก')),
      h('div', { class: 'rowb' }, h('button', { class: 'btn', onclick: () => act(() => api('notify/test', { method: 'POST', body: {} }), 'ส่งข้อความทดสอบแล้ว ดูในห้อง Discord') }, 'ส่งข้อความทดสอบ'),
        r.discord ? h('button', { class: 'btn', onclick: () => act(() => api('rejoin', { method: 'POST', body: { discord: '' } }), 'ลบ Discord แล้ว') }, 'ลบ') : null)),
    h('div', { class: 'card' }, h('h3', {}, 'แจ้งเตือน'),
      toggle('สรุปรายวัน', n.daily, (v) => setN({ daily: v }), 'ส่งทุกวันตามเวลาที่ตั้ง'),
      h('label', { class: 'inl' }, 'ส่งสรุปตอน', hour, 'นาฬิกา', h('button', { class: 'btn', onclick: () => setN({ dailyHour: Number(hour.value) }) }, 'บันทึก')),
      toggle('เลเวลอัป', n.levelUp, (v) => setN({ levelUp: v })),
      toggle('ได้ของหายาก', n.rare, (v) => setN({ rare: v }), 'ลูกแก้วมนต์อสูรทุกชนิด + รายการด้านล่าง'),
      h('label', { class: 'blk' }, 'รายการของหายาก (คั่นด้วย ,)', rare, h('button', { class: 'btn', onclick: () => setN({ rareList: rare.value.split(',').map((x) => x.trim()).filter(Boolean) }) }, 'บันทึกรายการ')),
      toggle('ไอดีค้าง', n.stuck, (v) => setN({ stuck: v }), 'ออนไลน์แต่ Wen/จำนวนที่ฆ่าไม่ขยับ ' + n.stuckMin + ' นาที'),
      toggle('ลูกค้าใกล้หมดอายุ', n.expiry, (v) => setN({ expiry: v }), 'ก่อนหมด ' + n.expiryDays + ' วัน'),
      toggle('ส่งให้ Discord ของลูกค้าด้วย', n.customers, (v) => setN({ customers: v }), 'เฉพาะลูกค้าที่ตั้ง Discord ไว้ เห็นแค่ไอดีของตัวเอง')));
}

function renderBak() {
  $('#tab-bak').replaceChildren(h('div', { class: 'card' }, h('h3', {}, 'สำรองข้อมูล'),
    h('p', { class: 'note' }, 'ระบบสำรองให้เองตอนเปิดเซิร์ฟเวอร์และทุก 6 ชั่วโมง เก็บย้อนหลังประมาณ 7 วัน การกู้ข้อมูลทำได้จาก admin.bat เมนู 13 บนคอมเซิร์ฟเวอร์ (ต้องปิดเซิร์ฟเวอร์ก่อน)'),
    h('button', { class: 'btn primary', onclick: () => act(() => api('backup', { method: 'POST', body: {} }), 'สำรองแล้ว') }, 'สำรองตอนนี้'),
    h('ul', { class: 'blist' }, D.backups.length ? D.backups.map((b) => h('li', {}, b)) : h('li', { class: 'mu' }, 'ยังไม่มี'))));
}

if (TOKEN) start();

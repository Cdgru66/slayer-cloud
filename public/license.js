/* Fleet — หน้าเช็คคีย์ของผู้ซื้อแอป (/license) */
'use strict';
const $ = (s) => document.querySelector(s);
const h = (t, a = {}, ...k) => { const e = document.createElement(t); for (const [x, v] of Object.entries(a)) { if (v == null || v === false) continue; if (x === 'class') e.className = v; else if (x.startsWith('on')) e[x] = v; else e.setAttribute(x, v === true ? '' : v); } for (const c of k.flat()) { if (c == null || c === false) continue; e.append(c.nodeType ? c : document.createTextNode(c)); } return e; };
const fmtDate = (t) => new Date(t * 1000).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
const ago = (s) => (s < 120 ? 'เมื่อสักครู่' : s < 5400 ? Math.round(s / 60) + ' นาทีที่แล้ว' : s < 172800 ? Math.round(s / 3600) + ' ชม.ที่แล้ว' : Math.round(s / 86400) + ' วันที่แล้ว');
let KEY = '';
try { KEY = sessionStorage.getItem('fl_key') || ''; } catch (e) {}

function toast(msg, bad) { const t = $('#toast'); t.textContent = msg; t.className = 'toast on' + (bad ? ' bad' : ''); clearTimeout(toast.t); toast.t = setTimeout(() => (t.className = 'toast'), 3200); }
async function call(path, body) {
  const r = await fetch('/api/v1/license/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ key: KEY }, body || {})) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.error || 'ผิดพลาด ' + r.status); e.status = r.status; throw e; }
  return j;
}

function show(d) {
  const st = { ok: ['ใช้งานได้', 'var(--ok)'], expired: ['หมดอายุ', 'var(--red)'], revoked: ['ถูกระงับ', 'var(--red)'] }[d.status] || ['–', 'var(--mu)'];
  const left = d.expires ? Math.ceil((d.expires - d.serverTime) / 86400) : null;
  const exp = d.expires ? fmtDate(d.expires) : 'ถาวร';
  const leftTxt = left == null ? 'ไม่มีวันหมด' : left > 0 ? 'เหลือ ' + left + ' วัน' : 'หมดแล้ว';
  const devs = d.devices.length ? d.devices.map((v) => h('div', { class: 'lk-dev' },
    h('div', {}, h('b', {}, v.name || 'PC'), h('small', {}, [v.os, v.ver ? 'v' + v.ver : '', 'ใช้ล่าสุด ' + ago(d.serverTime - v.last)].filter(Boolean).join(' · '))),
    h('button', { class: 'btn', type: 'button', disabled: d.releaseLeft <= 0 ? true : null, onclick: () => release(v) }, 'ถอดเครื่องนี้'))) : [h('p', { class: 'lk-note' }, 'ยังไม่มีเครื่องที่ใช้คีย์นี้ · เปิด FleetLauncher.exe แล้วใส่คีย์ได้เลย')];
  $('#body').replaceChildren(
    h('div', { class: 'lk-card' },
      h('h2', {}, d.label || 'คีย์ของคุณ', h('span', { class: 'pill', style: '--c:' + st[1] }, st[0])),
      h('span', { class: 'lk-key' }, 'FLEET-••••-••••-••••-' + d.hint),
      h('div', { class: 'lk-grid' },
        h('div', { class: 'lk-stat' }, h('small', {}, 'ใช้ได้ถึง'), h('b', {}, exp)),
        h('div', { class: 'lk-stat' }, h('small', {}, 'คงเหลือ'), h('b', { style: left != null && left <= 3 ? 'color:var(--warn)' : null }, leftTxt)),
        h('div', { class: 'lk-stat' }, h('small', {}, 'เครื่องที่ใช้'), h('b', {}, d.devices.length + ' / ' + d.maxDevices)))),
    h('div', { class: 'lk-card' },
      h('h2', {}, 'เครื่องที่ใช้คีย์นี้'),
      devs,
      h('p', { class: 'lk-note' }, 'จะย้ายไปคอมเครื่องใหม่: ถอดเครื่องเก่าออกก่อน แล้วใส่คีย์ในเครื่องใหม่ · ถอดจากหน้านี้ได้วันละ 3 ครั้ง (เหลือ ' + d.releaseLeft + ') · กด "ถอดคีย์" ในแอปเองได้ไม่จำกัด')));
}

async function load() {
  try { show(await call('me')); $('#gate').hidden = true; $('#app').hidden = false; }
  catch (e) {
    if (e.status === 401 || e.status === 403) { KEY = ''; try { sessionStorage.removeItem('fl_key'); } catch (x) {} }
    $('#gate').hidden = false; $('#app').hidden = true; $('#err').textContent = e.message;
  }
}
async function release(v) {
  if (!confirm('ถอด "' + (v.name || 'PC') + '" ออกจากคีย์?\nเครื่องนั้นจะใช้แอปไม่ได้จนกว่าจะใส่คีย์ใหม่')) return;
  try { show(await call('release', { device: v.id })); toast('ถอดเครื่องแล้ว'); } catch (e) { toast(e.message, true); }
}

$('#kf').onsubmit = async (e) => {
  e.preventDefault(); $('#err').textContent = ''; $('#go').disabled = true;
  KEY = $('#key').value.trim();
  try { sessionStorage.setItem('fl_key', KEY); } catch (x) {}
  try { await load(); if (!$('#app').hidden) $('#key').value = ''; } finally { $('#go').disabled = false; }
};
$('#out').onclick = () => { KEY = ''; try { sessionStorage.removeItem('fl_key'); } catch (e) {} $('#app').hidden = true; $('#gate').hidden = false; $('#err').textContent = ''; $('#key').focus(); };
if (KEY) load();

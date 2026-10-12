'use strict';
// ตรวจคีย์ใช้งานในแอปที่ขาย (เปิดใช้เมื่อมีไฟล์ launcher/license.json ซึ่งสร้างตอนแพ็กแอปขายด้วย build-sell.bat เท่านั้น
// ตัวของร้านเองไม่มีไฟล์นี้ → ไม่ต้องใส่คีย์)
//  license.json = { server: "https://<เครื่อง>.ts.net", pub: "<public key จากเซิร์ฟเวอร์ร้าน>" }
//  - ใบอนุญาตที่ได้จากเซิร์ฟเวอร์เซ็นด้วย Ed25519 ผูกกับรหัสเครื่อง (แฮช) ก๊อปไปเครื่องอื่นใช้ไม่ได้
//  - ต่ออายุทุก 6 ชม. · เน็ตหลุดใช้ต่อได้จนใบหมด (≤ 3 วัน) · ร้านระงับ/หมดอายุ → ล็อกในรอบเช็คถัดไป
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const CHECK_MS = 6 * 3600 * 1000;
const KEY_RE = /^[A-Z0-9]{16}$/;

module.exports = function createLicense(o) {
  const { cfgFile, dir, log, protect, unprotect, version } = o;
  let cfg = null;
  try { cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8')); } catch (e) {} // อ่านจากในตัวแอปเท่านั้น (ห้ามให้ตัวแปรระบบชี้ไปไฟล์อื่น = ข้ามคีย์ได้)
  const enabled = !!(cfg && /^https?:\/\/[^\s/]+$/.test(String(cfg.server || '').replace(/\/+$/, '')) && cfg.pub);
  if (!enabled) return { enabled: false, ok: () => true, state: () => ({ enabled: false }), start() {}, activate: async () => ({ ok: true }), deactivate: async () => ({ ok: true }) };

  const SERVER = String(cfg.server).replace(/\/+$/, '');
  let pub; try { pub = crypto.createPublicKey({ key: Buffer.from(cfg.pub, 'base64'), format: 'der', type: 'spki' }); } catch (e) { pub = null; }
  const FILE = path.join(dir, 'license.dat');
  const norm = (k) => String(k || '').toUpperCase().replace(/^FLEET/, '').replace(/[^A-Z0-9]/g, '');
  const pretty = (n) => 'FLEET-' + n.match(/.{4}/g).join('-');

  // รหัสเครื่อง: MachineGuid ของ Windows (ไม่เปลี่ยนจนกว่าจะลง Windows ใหม่) แฮชก่อนส่ง ไม่ส่งค่าจริงออกไป
  function machineId() {
    let raw = '';
    if (process.platform === 'win32') {
      const r = spawnSync('reg', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid', '/reg:64'], { encoding: 'utf8', windowsHide: true });
      const m = r.status === 0 && String(r.stdout || '').match(/MachineGuid\s+REG_SZ\s+([0-9a-f-]+)/i);
      if (m) raw = m[1].toLowerCase();
    } else { try { raw = fs.readFileSync('/etc/machine-id', 'utf8').trim(); } catch (e) {} }
    if (!raw) raw = os.hostname() + '|' + ((os.cpus()[0] || {}).model || '') + '|' + os.totalmem();
    return crypto.createHash('sha256').update('fleet-hw:' + raw).digest('hex');
  }
  const HW = machineId();

  let st = { key: '', lease: '', sig: '', seen: 0 }; // seen = เวลาล่าสุดที่เคยเห็น (กันย้อนนาฬิกาเครื่อง)
  let reason = '', lastCheck = 0, timer = null;
  function readStore() { try { const j = JSON.parse(unprotect(fs.readFileSync(FILE, 'utf8'))); if (j && typeof j === 'object') st = Object.assign(st, j); } catch (e) {} }
  function writeStore() { try { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(FILE, protect(JSON.stringify(st))); } catch (e) { log('บันทึกคีย์ไม่ได้: ' + e.message); } }

  // ตรวจใบอนุญาตในเครื่อง (ไม่ต้องใช้เน็ต)
  function parse() {
    if (!pub || !st.lease || !st.sig) return null;
    try {
      const buf = Buffer.from(st.lease, 'base64');
      if (!crypto.verify(null, buf, pub, Buffer.from(st.sig, 'base64'))) return null;
      const p = JSON.parse(buf.toString('utf8'));
      return p && p.v === 1 && p.hw === HW ? p : null;
    } catch (e) { return null; }
  }
  function valid() {
    const p = parse(), t = Date.now() / 1000;
    if (!p) return false;
    if (st.seen && t < st.seen - 3600) return false; // นาฬิกาเครื่องถูกย้อน
    return t < p.until && (!p.exp || t < p.exp);
  }
  const ok = () => valid();

  async function call(p, body) {
    const r = await fetch(SERVER + p, { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'FleetLauncher/' + (version || '') }, body: JSON.stringify(body), signal: AbortSignal.timeout(12000) });
    let j = {}; try { j = await r.json(); } catch (e) {}
    return { status: r.status, j };
  }
  const device = () => ({ name: os.hostname().slice(0, 40), os: (process.platform === 'win32' ? 'Windows ' : process.platform + ' ') + os.release(), ver: version || '' });

  async function request(key, mode) {
    let r;
    try { r = await call('/api/v1/license/activate', { key, hwid: HW, mode, device: device() }); }
    catch (e) { return { net: true, error: 'ต่อเซิร์ฟเวอร์คีย์ไม่ได้ เช็คอินเทอร์เน็ตแล้วลองใหม่' }; }
    if (r.status === 200 && r.j.lease && r.j.sig) {
      const prev = { lease: st.lease, sig: st.sig };
      Object.assign(st, { key, lease: r.j.lease, sig: r.j.sig, seen: Math.max(st.seen || 0, Date.now() / 1000) });
      if (!valid()) { Object.assign(st, prev); return { error: 'ใบอนุญาตจากเซิร์ฟเวอร์ไม่ถูกต้อง (แอปนี้ไม่ได้มาจากร้านที่ออกคีย์?)' }; }
      writeStore(); reason = ''; return { ok: true };
    }
    return { status: r.status, code: r.j.code || '', error: r.j.error || ('เซิร์ฟเวอร์คีย์ตอบ ' + r.status) };
  }

  async function activate(input) {
    const n = norm(input);
    if (!KEY_RE.test(n)) return { ok: false, error: 'รูปแบบคีย์ไม่ถูกต้อง (FLEET-XXXX-XXXX-XXXX-XXXX)' };
    const r = await request(pretty(n), 'activate');
    if (r.ok) { log('ใส่คีย์สำเร็จ ••••' + n.slice(-4)); lastCheck = Date.now(); return { ok: true, msg: 'ใส่คีย์เรียบร้อย' }; }
    return { ok: false, error: r.error };
  }

  // เช็คกับเซิร์ฟเวอร์ (ตอนเปิดแอป + ทุก 6 ชม.)
  async function refresh() {
    lastCheck = Date.now();
    if (!st.key) return;
    const r = await request(st.key, 'check');
    if (r.ok || r.net) { if (r.net && !valid()) reason = r.error; return; }
    if (r.status === 401 || r.status === 403) { // คีย์ใช้ไม่ได้แล้ว: ล็อกทันที ไม่รอใบหมด
      reason = r.error; log('คีย์ใช้ไม่ได้: ' + r.error);
      st.lease = ''; st.sig = ''; if (r.code === 'invalid' || r.code === 'unbound') st.key = '';
      writeStore();
    }
  }

  async function deactivate() {
    if (st.key) { try { await call('/api/v1/license/release', { key: st.key, hwid: HW }); } catch (e) {} }
    st = { key: '', lease: '', sig: '', seen: st.seen }; writeStore(); reason = '';
    log('ถอดคีย์ออกจากเครื่องนี้แล้ว');
    return { ok: true, msg: 'ถอดคีย์ออกจากเครื่องนี้แล้ว' };
  }

  function state() {
    const p = parse(), good = valid(), t = Date.now() / 1000;
    if (good && t > (st.seen || 0)) { st.seen = t; }
    return { enabled: true, ok: good, reason: good ? '' : (reason || (st.key && p ? 'ใบอนุญาตหมดอายุ ต่อเน็ตเพื่อเช็คคีย์ใหม่' : '')),
      hint: st.key ? '••••' + norm(st.key).slice(-4) : '', label: p ? p.label : '', expires: p && p.exp ? p.exp : null, until: p ? p.until : null,
      dashboard: SERVER + '/license' };
  }

  function start() {
    readStore();
    refresh().catch(() => {});
    clearInterval(timer);
    timer = setInterval(() => { if (Date.now() - lastCheck >= CHECK_MS) refresh().catch(() => {}); if (st.key) writeStore(); }, 15 * 60 * 1000);
    if (timer.unref) timer.unref();
  }

  return { enabled: true, ok, state, start, activate, deactivate, refresh, hw: HW };
};

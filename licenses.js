'use strict';
// คีย์ใช้งาน Fleet Launcher (ขายแอปให้ร้านอื่น)
//  - ร้านออกคีย์ในหน้าแอดมิน แท็บ "คีย์แอป" (กำหนดวัน + จำนวนเครื่อง) → ผู้ซื้อใส่คีย์ในแอป FleetLauncher.exe
//  - แอปผูกคีย์กับเครื่อง (รหัสเครื่องแบบแฮช) แล้วได้ "ใบอนุญาต" ที่เซ็นด้วย Ed25519 อายุ 3 วัน ต่ออายุเองทุก 6 ชม.
//    เน็ตหลุดก็ใช้ต่อได้จนใบหมด · ระงับ/หมดอายุ → แอปล็อกในรอบเช็คถัดไป
//  - ผู้ซื้อดูสถานะ/ย้ายเครื่องเองที่ /license (ใส่คีย์)
//  - เก็บแค่แฮชของคีย์ (เหมือนคีย์ลูกค้าอื่น ๆ) คีย์เต็มแสดงครั้งเดียวตอนออก
// ไฟล์: data/licenses.json, data/license-sign.json (กุญแจเซ็น ห้ามแจก)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // ไม่มี I O 0 1 กันอ่านผิด
const LEASE_SEC = 3 * 86400;
const MAX_DEVICES = 20;
const SELF_RELEASE_PER_DAY = 3;
const HW_RE = /^[0-9a-f]{64}$/;

module.exports = function createLicenses(ctx) {
  const { DATA_DIR, send, readBody, rate, failBlocked, recordFail, now, isAdmin } = ctx;
  const FILE = path.join(DATA_DIR, 'licenses.json');
  const SIGN_FILE = path.join(DATA_DIR, 'license-sign.json');

  const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return d; } };
  const writeJson = (f, j) => { const t = f + '.tmp'; fs.writeFileSync(t, JSON.stringify(j, null, 2)); fs.renameSync(t, f); };

  // ---------- กุญแจเซ็น (สร้างครั้งแรกครั้งเดียว · public key ฝังในแอปที่ขาย) ----------
  let sign = readJson(SIGN_FILE, null);
  if (!sign || !sign.priv || !sign.pub) {
    const kp = crypto.generateKeyPairSync('ed25519');
    sign = { priv: kp.privateKey.export({ type: 'pkcs8', format: 'pem' }), pub: kp.publicKey.export({ type: 'spki', format: 'der' }).toString('base64'), created: Math.floor(now()) };
    try { writeJson(SIGN_FILE, sign); } catch (e) { console.error('บันทึกกุญแจเซ็นคีย์แอปไม่ได้:', e.message); }
  }
  const privKey = crypto.createPrivateKey(sign.priv);

  // ---------- คีย์ ----------
  const norm = (k) => String(k || '').toUpperCase().replace(/^FLEET/, '').replace(/[^A-Z0-9]/g, '');
  const keyHash = (k) => crypto.createHash('sha256').update('fleetlic:' + norm(k)).digest('hex');
  const genKey = () => { let o = ''; for (const b of crypto.randomBytes(16)) o += ALPHA[b & 31]; return 'FLEET-' + o.match(/.{4}/g).join('-'); };
  const load = () => { const j = readJson(FILE, {}); return j && typeof j === 'object' && j.lic ? j : { lic: {} }; };
  const save = (j) => writeJson(FILE, j);
  const find = (j, key) => { const n = norm(key); if (n.length !== 16) return null; const h = keyHash(key); return Object.values(j.lic).find((l) => l.keyHash === h) || null; };
  const statusOf = (l) => (l.revoked ? 'revoked' : l.expires && now() > l.expires ? 'expired' : 'ok');
  const ERR = {
    invalid: [401, 'คีย์ไม่ถูกต้อง'],
    revoked: [403, 'คีย์นี้ถูกระงับ ติดต่อร้านที่ซื้อ'],
    expired: [403, 'คีย์หมดอายุแล้ว ติดต่อร้านเพื่อต่ออายุ'],
    devices: [403, 'คีย์นี้ใช้ครบจำนวนเครื่องแล้ว ย้ายเครื่องได้ที่หน้าเช็คคีย์'],
    unbound: [403, 'เครื่องนี้ถูกถอดออกจากคีย์แล้ว ใส่คีย์ใหม่อีกครั้ง'],
  };
  const fail = (res, code) => send(res, ERR[code][0], { error: ERR[code][1], code });

  function lease(l, hw) {
    const t = Math.floor(now());
    const until = l.expires ? Math.min(l.expires, t + LEASE_SEC) : t + LEASE_SEC;
    const payload = Buffer.from(JSON.stringify({ v: 1, lid: l.id, hw, label: l.label || '', exp: l.expires || 0, iat: t, until }));
    return { lease: payload.toString('base64'), sig: crypto.sign(null, payload, privKey).toString('base64'), until, expires: l.expires || null, label: l.label || '' };
  }
  const pubDevice = (d) => ({ id: d.hw.slice(0, 10), name: d.name, os: d.os, ver: d.ver, first: d.first, last: d.last });
  const pubForBuyer = (l) => ({ label: l.label || '', hint: l.hint, status: statusOf(l), created: l.created, expires: l.expires || null, maxDevices: l.maxDevices,
    devices: (l.devices || []).map(pubDevice), releaseLeft: Math.max(0, SELF_RELEASE_PER_DAY - (l.releases || []).filter((x) => now() - x < 86400).length), serverTime: now() });
  const pubForAdmin = (l) => Object.assign(pubForBuyer(l), { id: l.id, contact: l.contact || '', note: l.note || '', revoked: !!l.revoked });
  const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);

  function body(req, res, cb) {
    readBody(req, res, (b) => {
      let j = {}; if (b) { try { j = JSON.parse(b); } catch (e) { return send(res, 400, { error: 'bad json' }); } }
      try { cb(j && typeof j === 'object' ? j : {}); } catch (e) { if (!res.headersSent) send(res, 400, { error: String(e && e.message || e).slice(0, 200) }); }
    });
  }
  // คีย์ผิดซ้ำ ๆ จาก IP เดียว → ตอบ 429 (กันสุ่มเดาคีย์)
  function withKey(req, res, ip, cb) {
    if (failBlocked(ip) || !rate('lic:' + ip, 40)) return send(res, 429, { error: 'ลองหลายครั้งเกินไป รอ 1 นาทีแล้วลองใหม่' });
    body(req, res, (j) => {
      const db = load(), l = find(db, j.key);
      if (!l) { recordFail(ip); return fail(res, 'invalid'); }
      cb(j, db, l);
    });
  }

  function handle(req, res, url, ip) {
    const p = url.pathname;
    if (p.startsWith('/api/v1/license/')) {
      if (p === '/api/v1/license/pubkey' && req.method === 'GET') { send(res, 200, { pub: sign.pub }); return true; }
      if (req.method !== 'POST') { send(res, 405, { error: 'method' }); return true; }

      // แอปใส่คีย์ (mode "activate") หรือต่ออายุใบอนุญาตทุก 6 ชม. (mode "check")
      if (p === '/api/v1/license/activate') {
        withKey(req, res, ip, (j, db, l) => {
          const hw = String(j.hwid || '');
          if (!HW_RE.test(hw)) return send(res, 400, { error: 'bad device' });
          const st = statusOf(l); if (st !== 'ok') return fail(res, st);
          l.devices = l.devices || [];
          let d = l.devices.find((x) => x.hw === hw);
          const dev = j.device && typeof j.device === 'object' ? j.device : {};
          if (!d) {
            if (j.mode === 'check') return fail(res, 'unbound');
            if (l.devices.length >= l.maxDevices) return fail(res, 'devices');
            d = { hw, first: Math.floor(now()) }; l.devices.push(d);
          }
          Object.assign(d, { name: clean(dev.name, 40) || d.name || 'PC', os: clean(dev.os, 40) || d.os || '', ver: clean(dev.ver, 30) || d.ver || '', last: Math.floor(now()) });
          save(db);
          send(res, 200, Object.assign({ ok: true }, lease(l, hw)));
        });
        return true;
      }
      // หน้า /license: ผู้ซื้อดูสถานะคีย์ของตัวเอง
      if (p === '/api/v1/license/me') { withKey(req, res, ip, (j, db, l) => send(res, 200, pubForBuyer(l))); return true; }
      // ถอดเครื่องออกจากคีย์ (ย้ายเครื่อง) · แอปถอดตัวเองได้ไม่จำกัด (ส่ง hwid ของตัวเอง) · จากหน้าเว็บวันละ 3 ครั้ง
      if (p === '/api/v1/license/release') {
        withKey(req, res, ip, (j, db, l) => {
          l.devices = l.devices || []; l.releases = (l.releases || []).filter((x) => now() - x < 86400);
          const self = HW_RE.test(String(j.hwid || '')) ? l.devices.findIndex((x) => x.hw === j.hwid) : -1;
          const i = self >= 0 ? self : l.devices.findIndex((x) => x.hw.slice(0, 10) === String(j.device || ''));
          if (i < 0) return send(res, 404, { error: 'ไม่เจอเครื่องนี้ในคีย์' });
          if (self < 0) { if (l.releases.length >= SELF_RELEASE_PER_DAY) return send(res, 429, { error: `ย้ายเครื่องได้วันละ ${SELF_RELEASE_PER_DAY} ครั้ง ลองพรุ่งนี้หรือติดต่อร้าน` }); l.releases.push(Math.floor(now())); }
          l.devices.splice(i, 1); save(db);
          send(res, 200, Object.assign({ ok: true }, pubForBuyer(l)));
        });
        return true;
      }
      send(res, 404, { error: 'not found' }); return true;
    }

    // ---------- แอดมิน ----------
    if (p === '/api/v1/admin/licenses' || p.startsWith('/api/v1/admin/license/')) {
      if (!isAdmin(req)) { send(res, 401, { error: 'ต้องล็อกอินแอดมิน' }); return true; }
      if (p === '/api/v1/admin/licenses' && req.method === 'GET') {
        const db = load();
        send(res, 200, { serverTime: now(), pub: sign.pub, licenses: Object.values(db.lic).map(pubForAdmin).sort((a, b) => b.created - a.created) });
        return true;
      }
      if (p === '/api/v1/admin/licenses' && req.method === 'POST') { // ออกคีย์ใหม่
        body(req, res, (j) => {
          const label = clean(j.label, 60); if (!label) throw new Error('ใส่ชื่อผู้ซื้อก่อน');
          const days = Number(j.days || 0), max = Number(j.maxDevices || 1);
          if (!(Number.isInteger(days) && days >= 0 && days <= 3650)) throw new Error('จำนวนวัน 0-3650 (0 = ถาวร)');
          if (!(Number.isInteger(max) && max >= 1 && max <= MAX_DEVICES)) throw new Error(`จำนวนเครื่อง 1-${MAX_DEVICES}`);
          const db = load(), key = genKey(), id = 'L' + crypto.randomBytes(4).toString('hex'), t = Math.floor(now());
          db.lic[id] = { id, keyHash: keyHash(key), hint: norm(key).slice(-4), label, contact: clean(j.contact, 80), note: clean(j.note, 300),
            created: t, expires: days ? t + days * 86400 : null, maxDevices: max, devices: [], releases: [], revoked: false };
          save(db);
          send(res, 200, Object.assign({ key }, pubForAdmin(db.lic[id])));
        });
        return true;
      }
      const m = /^\/api\/v1\/admin\/license\/(L[0-9a-f]{8})$/.exec(p);
      if (!m) { send(res, 404, { error: 'not found' }); return true; }
      const db = load(), l = db.lic[m[1]];
      if (!l) { send(res, 404, { error: 'ไม่มีคีย์นี้' }); return true; }
      if (req.method === 'DELETE') { delete db.lic[m[1]]; save(db); send(res, 200, { ok: true }); return true; }
      if (req.method !== 'POST') { send(res, 405, { error: 'method' }); return true; }
      body(req, res, (j) => {
        const d2 = load(), x = d2.lic[m[1]]; if (!x) throw new Error('ไม่มีคีย์นี้');
        let key;
        if ('addDays' in j) { const d = Number(j.addDays); if (!(Number.isInteger(d) && d > 0 && d <= 3650)) throw new Error('จำนวนวันไม่ถูกต้อง'); x.expires = Math.max(x.expires || 0, Math.floor(now())) + d * 86400; }
        if (j.lifetime === true) x.expires = null;
        if ('revoked' in j) x.revoked = !!j.revoked;
        if ('maxDevices' in j) { const n = Number(j.maxDevices); if (!(Number.isInteger(n) && n >= 1 && n <= MAX_DEVICES)) throw new Error(`จำนวนเครื่อง 1-${MAX_DEVICES}`); x.maxDevices = n; }
        if ('label' in j) { const v = clean(j.label, 60); if (v) x.label = v; }
        if ('contact' in j) x.contact = clean(j.contact, 80);
        if ('note' in j) x.note = clean(j.note, 300);
        if (j.removeDevice) x.devices = (x.devices || []).filter((d) => d.hw.slice(0, 10) !== String(j.removeDevice));
        if (j.resetDevices === true) { x.devices = []; x.releases = []; }
        if (j.rotate === true) { key = genKey(); x.keyHash = keyHash(key); x.hint = norm(key).slice(-4); x.devices = []; } // คีย์เดิมใช้ไม่ได้ทันที แอปที่ใช้อยู่ล็อกในรอบเช็คถัดไป
        save(d2);
        send(res, 200, Object.assign(key ? { key } : {}, pubForAdmin(x)));
      });
      return true;
    }
    return false;
  }

  return { handle, publicKey: () => sign.pub };
};

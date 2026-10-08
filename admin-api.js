'use strict';
// API หน้าแอดมินบนเว็บ (/admin) — จัดการลูกค้าได้จากมือถือ แทน admin.bat
// ความปลอดภัย: รหัสแอดมินตั้งจาก admin.bat เท่านั้น (เก็บแบบแฮช scrypt), ล็อกอินได้โทเคนอายุ 12 ชม. เก็บในหน่วยความจำ
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SESSION_TTL = 12 * 3600 * 1000;
const NAME_RE = /^[A-Za-z0-9_]{3,20}$/;
const WEBHOOK_RE = /^https:\/\/(discord\.com|discordapp\.com|ptb\.discord\.com|canary\.discord\.com)\/api\/webhooks\/\d+\/[\w-]+$/;

module.exports = function createAdmin(ctx) {
  const { DATA_DIR, send, readBody, rate, failBlocked, recordFail, sha, now } = ctx;
  const CUSTOMERS_FILE = path.join(DATA_DIR, 'customers.json');
  const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
  const sessions = new Map(); // sha(token) -> หมดอายุ (ms)
  setInterval(() => { const t = Date.now(); for (const [k, e] of sessions) if (t > e.exp) sessions.delete(k); }, 600000).unref();

  const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return d; } };
  const writeJson = (f, j) => { const t = f + '.tmp'; fs.writeFileSync(t, JSON.stringify(j, null, 2)); fs.renameSync(t, f); };
  const genPass = () => { const a = 'abcdefghjkmnpqrstuvwxyz23456789'; let o = ''; for (const b of crypto.randomBytes(8)) o += a[b % a.length]; return o.slice(0, 4) + '-' + o.slice(4); };
  const hashPass = (pw) => { const salt = crypto.randomBytes(16); return salt.toString('hex') + ':' + crypto.scryptSync(pw, salt, 32).toString('hex'); };
  const checkPass = (pw, stored) => new Promise((resolve) => {
    const [salt, hash] = String(stored || '00:' + '00'.repeat(32)).split(':');
    crypto.scrypt(String(pw), Buffer.from(salt, 'hex'), 32, (err, key) => {
      const want = Buffer.from(hash || '', 'hex');
      resolve(!err && !!stored && want.length === key.length && crypto.timingSafeEqual(want, key));
    });
  });
  const newKey = (p) => p + crypto.randomBytes(24).toString('hex');
  const names = (arr) => (Array.isArray(arr) ? arr : String(arr || '').split(/[\s,]+/)).map((x) => String(x).trim()).filter((x) => NAME_RE.test(x));
  const baseUrl = (req) => {
    const saved = (() => { try { return fs.readFileSync(path.join(DATA_DIR, 'public_url.txt'), 'utf8').trim(); } catch (e) { return ''; } })();
    if (/^https:\/\/[^/\s]+$/.test(saved)) return saved;
    const host = String(req.headers.host || '');
    return (/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host) ? 'http://' : 'https://') + host;
  };
  const publicCustomer = (id, c, req) => ({
    id, name: c.name, created: c.created || null, expires: c.expires || null, revoked: !!c.revoked,
    accounts: c.accounts || [], hasPass: !!c.pass, link: c.view ? baseUrl(req) + '/v#' + c.view : null,
    webhook: c.webhook ? true : false,
  });
  // แก้ไฟล์ลูกค้าแบบอ่าน-แก้-เขียน แล้วให้เซิร์ฟเวอร์อ่านใหม่ทันที
  const mutate = (fn) => { const j = readJson(CUSTOMERS_FILE, {}); const r = fn(j); writeJson(CUSTOMERS_FILE, j); ctx.reloadCustomers(); return r; };

  function isAdmin(req) {
    const m = /^Bearer\s+(sfa_[0-9a-f]{64})$/.exec(req.headers.authorization || '');
    if (!m) return false;
    const e = sessions.get(sha(m[1]));
    if (!e || Date.now() > e.exp) return false;
    // เปลี่ยนรหัสแอดมินแล้ว (admin.bat เมนู 14) -> ทุกเครื่องที่ล็อกอินค้างไว้หลุดหมด
    if (readJson(SETTINGS_FILE, {}).adminHash !== e.h) { sessions.delete(sha(m[1])); return false; }
    return true;
  }

  function json(req, res, cb) {
    readBody(req, res, (body) => {
      let j = {};
      if (body) { try { j = JSON.parse(body); } catch (e) { return send(res, 400, { error: 'bad json' }); } }
      try { cb(j || {}); } catch (e) { send(res, 400, { error: e.message }); }
    });
  }

  // คืน true ถ้าจัดการคำขอนี้แล้ว
  function handle(req, res, url, ip) {
    const p = url.pathname;
    if (!p.startsWith('/api/v1/admin/')) return false;

    if (p === '/api/v1/admin/login' && req.method === 'POST') {
      if (failBlocked(ip) || !rate('adminlogin:' + ip, 8)) { send(res, 429, { error: 'ลองหลายครั้งเกินไป รอ 1 นาที' }); return true; }
      json(req, res, async (j) => {
        const st = readJson(SETTINGS_FILE, {});
        if (!st.adminHash) return send(res, 403, { error: 'ยังไม่ได้ตั้งรหัสแอดมิน: เปิด admin.bat เมนู 14 ก่อน' });
        if (!(await checkPass(j.pass || '', st.adminHash))) { recordFail(ip); return send(res, 401, { error: 'รหัสไม่ถูกต้อง' }); }
        const token = 'sfa_' + crypto.randomBytes(32).toString('hex');
        sessions.set(sha(token), { exp: Date.now() + SESSION_TTL, h: st.adminHash });
        send(res, 200, { token, expiresIn: SESSION_TTL / 1000 });
      });
      return true;
    }
    if (!isAdmin(req)) { recordFail(ip); send(res, 401, { error: 'ต้องล็อกอินแอดมินก่อน' }); return true; }
    if (!rate('admin', 600)) { send(res, 429, { error: 'rate limited' }); return true; }

    if (p === '/api/v1/admin/logout' && req.method === 'POST') {
      const m = /^Bearer\s+(\S+)$/.exec(req.headers.authorization || ''); if (m) sessions.delete(sha(m[1]));
      send(res, 200, { ok: true }); return true;
    }

    if (p === '/api/v1/admin/overview' && req.method === 'GET') {
      ctx.reloadCustomers();
      const all = readJson(CUSTOMERS_FILE, {});
      const owners = new Map();
      for (const [id, c] of Object.entries(all)) for (const n of c.accounts || []) owners.set(n.toLowerCase(), { id, name: c.name });
      const pool = ctx.pool(), t = now();
      const seen = Object.keys(pool).sort().map((n) => {
        const a = pool[n], o = owners.get(n.toLowerCase()), r = ctx.rejoinState(n);
        return { name: n, display: a.s && a.s.display, level: a.s && a.s.level, last: a.s ? Math.round(t - a.s.time) : null,
          interval: a.s && a.s.interval, owner: o || null, rejoin: r && r.n ? { n: r.n, ago: Math.round(t - r.at) } : null };
      });
      const st = readJson(SETTINGS_FILE, {});
      send(res, 200, {
        version: ctx.version, mode: st.mode === 'key' ? 'key' : 'owner', ownerScript: !!st.ownerHash, base: baseUrl(req),
        customers: Object.entries(all).map(([id, c]) => publicCustomer(id, c, req)).sort((a, b) => (a.name || '').localeCompare(b.name || '')),
        seen, rejoin: ctx.rejoinPublic(), notify: ctx.notifyPublic(), backups: ctx.listBackups().slice(0, 15), serverTime: t,
        orders: ctx.orders.list().map((o) => Object.assign({ summary: ctx.orders.summary(o) }, o)), orderStatuses: ctx.orders.STATUSES, sets: ctx.orders.getSets(), defaultSets: ctx.orders.defaultSets(),
      });
      return true;
    }

    if (p === '/api/v1/admin/state' && req.method === 'GET') { // แดชบอร์ดรวมทุกไอดี
      const pool = ctx.pool();
      send(res, 200, { serverTime: now(), expires: null, mode: 'owner', admin: true, accounts: Object.keys(pool).map((n) => ctx.withRejoin(n, pool[n])) });
      return true;
    }

    if (p === '/api/v1/admin/customer' && req.method === 'POST') {
      json(req, res, (j) => {
        const name = String(j.name || '').trim().slice(0, 60);
        if (!name) return send(res, 400, { error: 'ต้องใส่ชื่อลูกค้า' });
        const days = Number(j.days); if (!(days > 0 && days <= 3650)) return send(res, 400, { error: 'จำนวนวันไม่ถูกต้อง' });
        const acc = names(j.accounts);
        const pw = genPass(), view = newKey('sfv_'), device = newKey('sfd_');
        const id = crypto.randomBytes(4).toString('hex'), t = Math.floor(now());
        mutate((all) => {
          for (const n of acc) for (const o of Object.values(all)) o.accounts = (o.accounts || []).filter((x) => x.toLowerCase() !== n.toLowerCase());
          all[id] = { name, created: t, expires: Math.floor(t + days * 86400), maxAccounts: 50, revoked: false,
            deviceHash: sha(device), viewHash: sha(view), view, accounts: acc, pass: hashPass(pw) };
        });
        const c = readJson(CUSTOMERS_FILE, {})[id];
        send(res, 200, Object.assign(publicCustomer(id, c, req), { password: pw }));
      });
      return true;
    }

    const m = /^\/api\/v1\/admin\/customer\/([0-9a-f]{8})(?:\/(assign|renew|revoke|password|rotate|webhook))?$/.exec(p);
    if (m) {
      const id = m[1], act = m[2];
      if (!readJson(CUSTOMERS_FILE, {})[id]) { send(res, 404, { error: 'ไม่พบลูกค้า' }); return true; }
      if (!act && req.method === 'DELETE') { mutate((all) => { delete all[id]; }); send(res, 200, { ok: true }); return true; }
      if (req.method !== 'POST' || !act) { send(res, 405, { error: 'method not allowed' }); return true; }
      json(req, res, (j) => {
        let extra = {};
        mutate((all) => {
          const c = all[id];
          if (act === 'assign') {
            const add = names(j.add), rem = new Set(names(j.remove).map((x) => x.toLowerCase()));
            for (const n of add) for (const [oid, o] of Object.entries(all)) if (oid !== id) o.accounts = (o.accounts || []).filter((x) => x.toLowerCase() !== n.toLowerCase());
            const cur = new Map((c.accounts || []).map((n) => [n.toLowerCase(), n]));
            for (const n of add) cur.set(n.toLowerCase(), n);
            for (const n of rem) cur.delete(n);
            c.accounts = [...cur.values()];
          } else if (act === 'renew') {
            const days = Number(j.days); if (!(days > 0 && days <= 3650)) throw new Error('จำนวนวันไม่ถูกต้อง');
            c.expires = Math.floor(Math.max(c.expires || 0, now()) + days * 86400);
          } else if (act === 'revoke') c.revoked = !!j.revoked;
          else if (act === 'password') {
            const pw = j.pass ? String(j.pass) : genPass();
            if (pw.length < 6 || pw.length > 100) throw new Error('รหัสต้องยาว 6-100 ตัว');
            c.pass = hashPass(pw); extra = { password: pw };
            const v = newKey('sfv_'); c.view = v; c.viewHash = sha(v); // ตั้งรหัสใหม่ = เครื่องที่เคยล็อกอินไว้หลุดหมด
          } else if (act === 'rotate') { const v = newKey('sfv_'); c.view = v; c.viewHash = sha(v); }
          else if (act === 'webhook') {
            const w = String(j.url || '').trim();
            if (w && !WEBHOOK_RE.test(w)) throw new Error('ลิงก์ Discord webhook ไม่ถูกต้อง');
            if (w) c.webhook = w; else delete c.webhook;
          }
        });
        send(res, 200, Object.assign(publicCustomer(id, readJson(CUSTOMERS_FILE, {})[id], req), extra));
      });
      return true;
    }

    if (p === '/api/v1/admin/rejoin' && req.method === 'POST') {
      json(req, res, (j) => { ctx.setRejoin({ discord: String(j.discord || '') }); send(res, 200, ctx.rejoinPublic()); }); // รีจอยตั้งได้จาก admin.bat เท่านั้น เว็บแก้ได้แค่ Discord
      return true;
    }
    if (p === '/api/v1/admin/sets' && req.method === 'POST') {
      json(req, res, (j) => send(res, 200, { sets: ctx.orders.saveSets(j.sets) }));
      return true;
    }
    if (p === '/api/v1/admin/notify' && req.method === 'POST') {
      json(req, res, (j) => { ctx.setNotify(j); send(res, 200, ctx.notifyPublic()); });
      return true;
    }
    if (p === '/api/v1/admin/notify/test' && req.method === 'POST') {
      ctx.notifyTest().then((r) => send(res, r.ok ? 200 : 400, r));
      return true;
    }
    const om = /^\/api\/v1\/admin\/order\/(SF-\d{1,9})$/.exec(p);
    if (om) {
      if (req.method === 'DELETE') { try { ctx.orders.remove(om[1]); send(res, 200, { ok: true }); } catch (e) { send(res, 404, { error: e.message }); } return true; }
      if (req.method === 'POST') { json(req, res, (j) => send(res, 200, ctx.orders.update(om[1], j))); return true; }
    }
    if (p === '/api/v1/admin/backup' && req.method === 'POST') {
      const name = ctx.backupNow('manual');
      send(res, 200, { ok: !!name, name, backups: ctx.listBackups().slice(0, 15) });
      return true;
    }
    send(res, 404, { error: 'not found' });
    return true;
  }

  return { handle, isAdmin, setAdminPass: (pw) => { const st = readJson(SETTINGS_FILE, {}); st.adminHash = hashPass(pw); writeJson(SETTINGS_FILE, st); } };
};

'use strict';
// Slayer Fleet Cloud - เซิร์ฟเวอร์กลางหลายลูกค้า (ไม่มี dependency ใช้ Node 18+)
// รันหลัง reverse proxy ที่ทำ HTTPS (เช่น Caddy) ดู README.txt
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.CLOUD_DATA_DIR || path.join(__dirname, 'data');
const PORT = Number(process.env.PORT) || 8800;
const HOST = process.env.HOST || '127.0.0.1';
const TRUST_PROXY = process.env.TRUST_PROXY === '1';
const PUBLIC_DIR = path.join(__dirname, 'public');
let VERSION = 'dev'; try { VERSION = fs.readFileSync(path.join(__dirname, 'version.txt'), 'utf8').trim(); } catch (e) {}
const CUSTOMERS_FILE = path.join(DATA_DIR, 'customers.json'); // แก้ผ่าน admin.js เท่านั้น
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');   // โหมด + แฮชคีย์ของเจ้าของ (แก้ผ่าน admin.js)
const OWNER = '__owner__';      // ที่เก็บไอดีที่เจ้าของรันเอง (โหมด owner)
const OWNER_MAX_ACCOUNTS = 2000;
const DATA_FILE = path.join(DATA_DIR, 'data.json');           // ข้อมูลไอดีของลูกค้า เซิร์ฟเวอร์เป็นเจ้าของไฟล์นี้
const MAX_BODY = 512 * 1024;
const MAX_BATCH = 100;
const MAX_HIST = 2000;
const DEFAULT_MAX_ACCOUNTS = 50;
const RATE_INGEST_PER_MIN = Number(process.env.RATE_INGEST_PER_MIN) || 120;
const RATE_VIEW_PER_MIN = Number(process.env.RATE_VIEW_PER_MIN) || 300;
const FAIL_PER_MIN = 30;

fs.mkdirSync(DATA_DIR, { recursive: true });

const STATIC = {
  '/v': ['index.html', 'text/html; charset=utf-8'],
  '/style.css': ['style.css', 'text/css; charset=utf-8'],
  '/app.js': ['app.js', 'application/javascript; charset=utf-8'],
  '/admin': ['admin.html', 'text/html; charset=utf-8'],
  '/admin.js': ['admin.js', 'application/javascript; charset=utf-8'],
  '/order': ['order.html', 'text/html; charset=utf-8'],
  '/order.js': ['order.js', 'application/javascript; charset=utf-8'],
};
const CSP = [
  "default-src 'none'", "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com", "img-src 'self' https://*.rbxcdn.com data:",
  "connect-src 'self'", "base-uri 'none'", "form-action 'none'", "frame-ancestors 'none'",
].join('; ');

const now = () => Date.now() / 1000;
const isNum = (v) => typeof v === 'number' && isFinite(v);
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

// ---------- ลูกค้า (อ่านซ้ำเมื่อไฟล์เปลี่ยน) ----------
let cust = { all: {}, byDevice: new Map(), byView: new Map(), mtime: 0, checked: 0 };
// mode: 'owner' = เจ้าของรันสคริปต์ตัวเดียวทุกไอดี แล้วแบ่งไอดีให้ลูกค้าใน admin / 'key' = แต่ละลูกค้ามีสคริปต์+คีย์ของตัวเอง
let settings = { mode: 'owner', ownerHash: null, mtime: 0 };
let accounts = {}; // customerId -> { accountName -> { s, hist } }
try { accounts = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch (e) {}
// เก็บแบบไม่มี prototype: ชื่ออย่าง __proto__ / constructor จะเป็นแค่คีย์ธรรมดา
const bare = (o) => Object.assign(Object.create(null), o && typeof o === 'object' ? o : {});
accounts = bare(accounts); for (const k of Object.keys(accounts)) accounts[k] = bare(accounts[k]);
let dirty = false;
// ไอคอนของไอเทมที่เคยเห็นจากทุกไอดี (ชื่อ -> ลิงก์รูป) ไอดีที่ไม่มีรูปจะได้ใช้รูปจากไอดีอื่น
const ICONS_FILE = path.join(DATA_DIR, 'icons.json');
let icons = {};
try { icons = JSON.parse(fs.readFileSync(path.join(__dirname, 'icons-seed.json'), 'utf8')); } catch (e) {} // ไอคอนตั้งต้นที่มากับโปรแกรม
try { Object.assign(icons, JSON.parse(fs.readFileSync(ICONS_FILE, 'utf8'))); } catch (e) {}
let iconsDirty = false;
const ICON_RE = /^https:\/\/([a-z0-9-]+\.)*rbxcdn\.com\/[^\s"'<>]{1,400}$/i;

function loadCustomers(force) {
  const t = Date.now();
  if (!force && t - cust.checked < 2000) return;
  cust.checked = t;
  try {
    const ss = fs.statSync(SETTINGS_FILE);
    if (ss.mtimeMs !== settings.mtime) {
      const j = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
      settings = { mode: j.mode === 'key' ? 'key' : 'owner', ownerHash: j.ownerHash || null, mtime: ss.mtimeMs };
    }
  } catch (e) {}
  let st;
  try { st = fs.statSync(CUSTOMERS_FILE); } catch (e) { return; }
  if (st.mtimeMs === cust.mtime) return;
  try {
    const j = JSON.parse(fs.readFileSync(CUSTOMERS_FILE, 'utf8'));
    const d = new Map(), v = new Map();
    for (const [id, c] of Object.entries(j)) { d.set(c.deviceHash, id); v.set(c.viewHash, id); }
    cust = { all: j, byDevice: d, byView: v, mtime: st.mtimeMs, checked: t };
    // ลูกค้าที่ถูกลบออก -> ลบข้อมูลของเขาด้วย (ตามสิทธิ์ขอลบข้อมูล)
    for (const id of Object.keys(accounts)) if (id !== OWNER && !j[id]) { delete accounts[id]; dirty = true; }
    for (const c of Object.values(j)) c._set = new Set((c.accounts || []).map((n) => String(n).toLowerCase()));
  } catch (e) { console.error('อ่าน customers.json ไม่ได้:', e.message); }
}

function flush() {
  if (iconsDirty) { iconsDirty = false; try { fs.writeFileSync(ICONS_FILE, JSON.stringify(icons)); } catch (e) {} }
  if (!dirty) return;
  dirty = false;
  try {
    const tmp = DATA_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(accounts));
    fs.renameSync(tmp, DATA_FILE);
  } catch (e) { console.error('บันทึกข้อมูลไม่ได้:', e.message); }
}
setInterval(flush, 30000).unref();

// ---------- สำรองข้อมูลอัตโนมัติ: ทุก 6 ชม. + ตอนเปิดเซิร์ฟเวอร์ เก็บ 28 ชุดล่าสุด (ประมาณ 7 วัน) ----------
const BACKUP_DIR = path.join(DATA_DIR, '..', 'backups');
function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (/token/i.test(e.name)) continue; // ไม่เก็บ token GitHub ไว้ในไฟล์สำรอง
    const a = path.join(src, e.name), b = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(a, b); else if (e.isFile()) fs.copyFileSync(a, b);
  }
}
function backupNow(prefix) {
  try {
    flush();
    const d = new Date(), z = (n) => String(n).padStart(2, '0');
    const name = `${prefix}-${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}${prefix === 'auto' ? '' : z(d.getSeconds())}`;
    copyDir(DATA_DIR, path.join(BACKUP_DIR, name));
    return name;
  } catch (e) { console.error('สำรองข้อมูลไม่สำเร็จ:', e.message); return null; }
}
function listBackups() {
  try { return fs.readdirSync(BACKUP_DIR, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort().reverse(); } catch (e) { return []; }
}
function autoBackup() {
  const name = backupNow('auto');
  if (!name) return;
  try {
    const autos = fs.readdirSync(BACKUP_DIR).filter((n) => n.startsWith('auto-')).sort();
    for (const old of autos.slice(0, Math.max(0, autos.length - 28))) fs.rmSync(path.join(BACKUP_DIR, old), { recursive: true, force: true });
  } catch (e) {}
  console.log('สำรองข้อมูลอัตโนมัติ: backups/' + name);
}
setTimeout(autoBackup, Number(process.env.BACKUP_FIRST_MS) || 60000).unref();
setInterval(autoBackup, 6 * 3600 * 1000).unref();

// ---------- รีจอยอัตโนมัติผ่าน Roblox Account Manager (RAM) ----------
// ตั้งค่าใน data/rejoin.json ผ่าน admin.bat เมนูรีจอย  ไม่มีการเก็บ cookie/รหัส Roblox ใด ๆ ที่นี่ ใช้ RAM เปิดไอดีให้
const REJOIN_FILE = path.join(DATA_DIR, 'rejoin.json');
const REJOIN_LOG = path.join(DATA_DIR, 'rejoin.log');
const DEFAULT_PLACE = 136406881576517; // Slayer 2
let rj = { cfg: {}, mtime: -1 };
const rjState = new Map(); // ชื่อไอดี -> { n: ครั้งที่สั่งเปิด, at: เวลาสั่งล่าสุด, nextAt, alerted }
function rejoinCfg() {
  try {
    const st = fs.statSync(REJOIN_FILE);
    if (st.mtimeMs !== rj.mtime) rj = { cfg: JSON.parse(fs.readFileSync(REJOIN_FILE, 'utf8')), mtime: st.mtimeMs };
  } catch (e) { rj = { cfg: {}, mtime: -1 }; }
  return rj.cfg;
}
function rjLog(line) {
  console.log('[รีจอย] ' + line);
  try { fs.appendFileSync(REJOIN_LOG, new Date().toLocaleString('th-TH') + '  ' + line + '\n'); } catch (e) {}
}
async function discord(cfg, text) {
  if (!/^https:\/\/(discord\.com|discordapp\.com|ptb\.discord\.com|canary\.discord\.com)\/api\/webhooks\/\d+\/[\w-]+$/.test(cfg.discordWebhook || '')) return;
  try {
    await fetch(cfg.discordWebhook, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'Slayer Fleet', content: text }), signal: AbortSignal.timeout(8000) });
  } catch (e) {}
}
async function rejoinTick() {
  loadCustomers();
  const cfg = rejoinCfg();
  if (settings.mode !== 'owner' || (!cfg.enabled && !cfg.discordWebhook)) return;
  const pool = accounts[OWNER] || {}, t = now();
  const after = Math.max(2, Number(cfg.afterMin) || 5) * 60;
  const giveUp = (Number(cfg.giveUpHours) || 12) * 3600;
  const skip = new Set((cfg.exclude || []).map((x) => String(x).toLowerCase()));
  for (const [name, a] of Object.entries(pool)) {
    if (!a.s) continue;
    const silent = t - a.s.time;
    const st = rjState.get(name);
    if (silent < after) { // ออนไลน์อยู่
      if (st && (st.n || st.alerted)) { rjLog(`${name} กลับมาออนไลน์แล้ว`); discord(cfg, `✅ **${name}** กลับมาออนไลน์แล้ว`); }
      rjState.delete(name);
      continue;
    }
    if (silent > giveUp || skip.has(name.toLowerCase())) continue; // เลิกใช้ไอดีนี้แล้ว หรือถูกยกเว้น
    const s2 = st || { n: 0, at: 0, nextAt: 0, alerted: false };
    if (!cfg.enabled) { // โหมดแจ้งเตือนอย่างเดียว
      if (!s2.alerted) { s2.alerted = true; rjState.set(name, s2); rjLog(`${name} ออฟไลน์ ${Math.round(silent / 60)} นาที`); discord(cfg, `⚠️ **${name}** ออฟไลน์ ${Math.round(silent / 60)} นาทีแล้ว`); }
      continue;
    }
    if (t < s2.nextAt) continue;
    s2.n++; s2.at = t; s2.alerted = true;
    s2.nextAt = t + Math.min(60, (Number(cfg.cooldownMin) || 5) * Math.pow(2, s2.n - 1)) * 60; // 5, 10, 20, 40, 60 นาที
    rjState.set(name, s2);
    const port = Number(cfg.port) || 7963, place = Number(cfg.placeId) || DEFAULT_PLACE;
    const u = `http://127.0.0.1:${port}/LaunchAccount?Account=${encodeURIComponent(name)}&PlaceId=${place}` + (cfg.password ? `&Password=${encodeURIComponent(cfg.password)}` : '');
    let ok = false, msg = '';
    try { const r = await fetch(u, { signal: AbortSignal.timeout(15000) }); msg = (await r.text()).trim().slice(0, 120); ok = r.ok; }
    catch (e) { msg = 'ต่อ Roblox Account Manager ไม่ได้ (เปิดโปรแกรมและ Web Server อยู่หรือเปล่า)'; }
    rjLog(`${name} เงียบ ${Math.round(silent / 60)} นาที -> สั่ง RAM เปิดใหม่ (ครั้งที่ ${s2.n}): ${ok ? 'สำเร็จ' : 'ไม่สำเร็จ'} ${msg}`);
    discord(cfg, ok ? `🔄 **${name}** หลุดไป ${Math.round(silent / 60)} นาที กำลังเข้าเกมใหม่ (ครั้งที่ ${s2.n})`
                    : `❌ เปิด **${name}** ใหม่ไม่สำเร็จ: ${msg}`);
    await new Promise((r) => setTimeout(r, Math.max(5, Number(cfg.gapSec) || 20) * 1000)); // เว้นระยะ ไม่เปิดหลายไอดีพร้อมกัน
  }
}
const DISCORD_RE = /^https:\/\/(discord\.com|discordapp\.com|ptb\.discord\.com|canary\.discord\.com)\/api\/webhooks\/\d+\/[\w-]+$/;
function rejoinPublic() {
  const c = rejoinCfg();
  let log = []; try { log = fs.readFileSync(REJOIN_LOG, 'utf8').trim().split('\n').filter(Boolean).slice(-25).reverse(); } catch (e) {}
  return { enabled: !!c.enabled, port: c.port || 7963, hasPassword: !!c.password, afterMin: c.afterMin || 5,
    discord: !!c.discordWebhook, exclude: c.exclude || [], log };
}
function setRejoin(j) {
  let c = {}; try { c = JSON.parse(fs.readFileSync(REJOIN_FILE, 'utf8')); } catch (e) {}
  if ('enabled' in j) c.enabled = !!j.enabled;
  if ('port' in j) { const n = Number(j.port); if (!(n >= 1 && n <= 65535)) throw new Error('พอร์ตไม่ถูกต้อง'); c.port = n; }
  if (typeof j.password === 'string' && j.password !== '') { if (!/^[A-Za-z0-9]{6,}$/.test(j.password)) throw new Error('รหัส RAM ต้องเป็นตัวอักษร/ตัวเลข 6 ตัวขึ้นไป'); c.password = j.password; }
  if (j.clearPassword) delete c.password;
  if ('afterMin' in j) { const n = Number(j.afterMin); if (!(n >= 2 && n <= 120)) throw new Error('นาทีต้องอยู่ระหว่าง 2-120'); c.afterMin = n; }
  if (typeof j.discord === 'string') { const w = j.discord.trim(); if (w && !DISCORD_RE.test(w)) throw new Error('ลิงก์ Discord webhook ไม่ถูกต้อง'); if (w) c.discordWebhook = w; else delete c.discordWebhook; }
  if (Array.isArray(j.exclude)) c.exclude = j.exclude.map(String).filter((x) => /^[A-Za-z0-9_]{3,20}$/.test(x));
  const t = REJOIN_FILE + '.tmp'; fs.writeFileSync(t, JSON.stringify(c, null, 2)); fs.renameSync(t, REJOIN_FILE);
}
let rjBusy = false;
setInterval(() => { if (rjBusy) return; rjBusy = true; rejoinTick().catch((e) => console.error(e)).finally(() => { rjBusy = false; }); },
  Number(process.env.REJOIN_TICK_MS) || 30000).unref();

// ---------- จำกัดอัตรา ----------
const buckets = new Map();
function rate(key, limit) {
  const t = Date.now();
  let b = buckets.get(key);
  if (!b || t > b.reset) { b = { n: 0, reset: t + 60000 }; buckets.set(key, b); }
  return ++b.n <= limit;
}
const fails = new Map();
const failBlocked = (ip) => { const f = fails.get(ip); return !!f && Date.now() < f.reset && f.n >= FAIL_PER_MIN; };
function recordFail(ip) {
  const t = Date.now();
  let f = fails.get(ip);
  if (!f || t > f.reset) { f = { n: 0, reset: t + 60000 }; fails.set(ip, f); }
  f.n++;
}
setInterval(() => { const t = Date.now(); for (const [k, b] of buckets) if (t > b.reset) buckets.delete(k); for (const [k, f] of fails) if (t > f.reset) fails.delete(k); }, 60000).unref();
const clientIp = (req) => TRUST_PROXY
  ? ((req.headers['x-forwarded-for'] || '').split(',').pop().trim() || req.socket.remoteAddress)
  : req.socket.remoteAddress;

// ---------- แจ้งเตือน + สถิติ (notify.js) และหน้าแอดมิน (admin-api.js) ----------
const notify = require('./notify.js')({
  DATA_DIR, now, pool: () => accounts[OWNER] || {}, customers: () => { loadCustomers(); return cust.all; },
  ownerWebhook: () => rejoinCfg().discordWebhook, mode: () => settings.mode,
});
const withRejoin = (n, a) => { const r = rjState.get(n); return r && r.n ? Object.assign({}, a, { rejoin: { at: r.at, n: r.n } }) : a; };

// ---------- ตอบกลับ ----------
function send(res, code, body, type = 'application/json; charset=utf-8', extra = {}) {
  res.writeHead(code, Object.assign({
    'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY',
  }, extra));
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function readBody(req, res, cb) {
  let size = 0, dead = false; const chunks = [];
  req.on('data', (c) => {
    if (dead) return;
    size += c.length;
    if (size > MAX_BODY) { dead = true; res.writeHead(413, { Connection: 'close' }); res.end('{"error":"too large"}'); req.destroy(); return; }
    chunks.push(c);
  });
  req.on('end', () => {
    if (dead) return;
    try { cb(Buffer.concat(chunks).toString('utf8')); } catch (e) {
      console.error('คำขอผิดพลาด:', e && e.stack || e);
      try { if (!res.headersSent) send(res, 500, { error: 'server error' }); else res.destroy(); } catch (_) {}
    }
  });
}

// ---------- ตรวจสิทธิ์ ----------
function authenticate(req, prefix) {
  const m = /^Bearer\s+(\S+)$/.exec(req.headers.authorization || '');
  if (!m || !m[1].startsWith(prefix) || m[1].length > 100) return { code: 401, error: 'invalid key' };
  const h = sha(m[1]);
  const known = () => (prefix === 'sfd_' ? (cust.byDevice.has(h) || h === settings.ownerHash) : cust.byView.has(h));
  if (!known()) loadCustomers(true); // เพิ่งเพิ่มลูกค้า/ออกคีย์ใหม่? อ่านไฟล์ใหม่ทันที (stat อย่างเดียวถ้าไฟล์ไม่เปลี่ยน)
  if (prefix === 'sfd_' && settings.ownerHash && h === settings.ownerHash) {
    if (settings.mode !== 'owner') return { code: 403, error: 'owner mode is off' };
    return { id: OWNER, c: { maxAccounts: OWNER_MAX_ACCOUNTS } };
  }
  const id = (prefix === 'sfd_' ? cust.byDevice : cust.byView).get(h);
  const c = id && cust.all[id];
  if (!c) return { code: 401, error: 'invalid key' };
  if (c.revoked) return { code: 403, error: 'access revoked' };
  if (c.expires && now() > c.expires) return { code: 403, error: 'license expired' };
  if (prefix === 'sfd_' && settings.mode !== 'key') return { code: 403, error: 'customer keys are disabled (owner mode)' };
  return { id, c };
}

// คีย์ผิดซ้ำ ๆ จาก IP เดียว -> ตอบ 429 (ไม่กระทบคำขอที่ใช้คีย์ถูก จึงล็อกลูกค้าจริงไม่ได้)
function authFail(res, ip, a) {
  if (a.code === 401) { if (failBlocked(ip)) return send(res, 429, { error: 'too many failures' }); recordFail(ip); }
  return send(res, a.code, { error: a.error });
}

// ---------- รับข้อมูล ----------
// ทำความสะอาดข้อมูลจากเกม: จำกัดความลึก/จำนวน/ความยาว ตัดคีย์อันตราย (กันเซิร์ฟเวอร์ล่มจากข้อมูลซ้อนลึกหรือใหญ่ผิดปกติ)
const MAX_SNAP = 96 * 1024;
function tidy(v, d) {
  if (v == null || typeof v === 'boolean') return v;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'string') return v.slice(0, 400);
  if (d >= 6 || typeof v !== 'object') return null;
  if (Array.isArray(v)) return v.slice(0, 300).map((x) => tidy(x, d + 1));
  const o = {}; let n = 0;
  for (const k of Object.keys(v)) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype' || k.length > 60) continue;
    if (++n > 120) break;
    o[k] = tidy(v[k], d + 1);
  }
  return o;
}
function ingest(id, c, snap) {
  if (!snap || typeof snap !== 'object') return 'bad json';
  const name = snap.name;
  if (typeof name !== 'string' || !/^[A-Za-z0-9_]{3,20}$/.test(name) || name in Object.prototype || name === '__proto__') return 'bad name'; // ชื่อผู้ใช้ Roblox
  snap = tidy(snap, 0);
  if (JSON.stringify(snap).length > MAX_SNAP) return 'too big';
  const mine = accounts[id] || (accounts[id] = Object.create(null));
  if (!Object.hasOwn(mine, name) && Object.keys(mine).length >= (c.maxAccounts || DEFAULT_MAX_ACCOUNTS)) return 'account limit';
  if (!Array.isArray(snap.items)) snap.items = [];
  snap.items = snap.items.slice(0, 200).filter((i) => i && typeof i.name === 'string' && i.name.length <= 60 && isNum(i.amount));
  for (const i of snap.items) {
    if (typeof i.iconUrl === 'string' && ICON_RE.test(i.iconUrl)) {
      // ไอคอนกลางที่ทุกคนเห็น: ไอดีของร้านเขียนทับได้ ลูกค้า (โหมดคีย์) เพิ่มได้แค่ชื่อที่ยังไม่มีรูป
      if (icons[i.name] !== i.iconUrl && (id === OWNER || !Object.hasOwn(icons, i.name)) && Object.keys(icons).length < 3000) { icons[i.name] = i.iconUrl; iconsDirty = true; }
    } else delete i.iconUrl;
  }
  if (!(isNum(snap.interval) && snap.interval >= 5 && snap.interval <= 3600)) delete snap.interval;
  if (snap.boss && !(typeof snap.boss.name === 'string' && snap.boss.name.length <= 40)) delete snap.boss;
  snap.time = now(); // ใช้เวลาของเซิร์ฟเวอร์เสมอ
  const a = Object.hasOwn(mine, name) ? mine[name] : (mine[name] = { s: null, hist: [] });
  a.s = snap;
  a.hist.push({ t: snap.time, w: isNum(snap.wen) ? snap.wen : 0, k: isNum(snap.progress && snap.progress.kills) ? snap.progress.kills : 0, b: isNum(snap.progress && snap.progress.boss_kills) ? snap.progress.boss_kills : 0 });
  if (a.hist.length > MAX_HIST) a.hist.splice(0, a.hist.length - MAX_HIST);
  try { notify.onSnapshot(id === OWNER, name, a); } catch (e) { console.error('notify:', e.message); }
  dirty = true;
  return null;
}

let scryptBusy = 0;
const orders = require('./orders.js')({ DATA_DIR, rate, send, readBody, now, notifyOwner: notify.postOwner });

const admin = require('./admin-api.js')({
  DATA_DIR, send, readBody, rate, failBlocked, recordFail, sha, now, version: VERSION,
  reloadCustomers: () => loadCustomers(true), pool: () => accounts[OWNER] || {}, rejoinState: (n) => rjState.get(n), withRejoin,
  rejoinPublic, setRejoin, notifyPublic: notify.publicCfg, setNotify: notify.setCfg, notifyTest: notify.test,
  listBackups, backupNow, orders,
});

const server = http.createServer((req, res) => {
  try { handleReq(req, res); } catch (e) {
    console.error('คำขอผิดพลาด:', e && e.stack || e);
    try { if (!res.headersSent) send(res, 500, { error: 'server error' }); else res.destroy(); } catch (_) {}
  }
});
function handleReq(req, res) {
  loadCustomers();
  let url;
  try { url = new URL(String(req.url || '/').replace(/^\/+/, '/'), 'http://x'); } catch (e) { return send(res, 400, { error: 'bad url' }); }
  const ip = clientIp(req);
  const hsts = TRUST_PROXY && req.headers['x-forwarded-proto'] === 'https' ? { 'Strict-Transport-Security': 'max-age=31536000' } : {};

  if (req.method === 'GET' && url.pathname === '/healthz') return send(res, 200, { ok: true, version: VERSION });

  if (req.method === 'POST' && url.pathname === '/api/v1/ingest') {
    const a = authenticate(req, 'sfd_');
    if (a.error) return authFail(res, ip, a);
    if (!rate(a.id + ':i', RATE_INGEST_PER_MIN)) return send(res, 429, { error: 'rate limited' });
    return readBody(req, res, (body) => {
      let j;
      try { j = JSON.parse(body); } catch (e) { return send(res, 400, { error: 'bad json' }); }
      // แอปส่งเป็นชุด {accounts:[...]} / สคริปต์ในเกมส่งตรงทีละไอดี {name:...}
      const list = j && Array.isArray(j.accounts) ? j.accounts : (j && typeof j.name === 'string' ? [j] : []);
      if (list.length > MAX_BATCH) return send(res, 400, { error: 'batch too large' });
      let accepted = 0, rejected = 0; const why = [];
      for (const s of list) { const e = ingest(a.id, a.c, s); if (e) { rejected++; if (why.length < 5) why.push(e); } else accepted++; }
      send(res, 200, { ok: true, accepted, rejected, why, expires: a.c.expires || null });
    });
  }

  // เข้าสู่ระบบด้วยชื่อผู้ใช้ Roblox (ที่เจ้าของกำหนดให้) + รหัสผ่านที่ร้านออกให้ -> ได้คีย์ดูข้อมูลของตัวเอง
  if (req.method === 'POST' && url.pathname === '/api/v1/login') {
    // นับทุกครั้งก่อนคำนวณรหัส (กันยิงพร้อมกันจำนวนมาก) และจำกัดงานคำนวณรหัสที่ทำพร้อมกัน
    if (failBlocked(ip) || !rate('loginip:' + ip, 20)) return send(res, 429, { error: 'ลองผิดหลายครั้งเกินไป รอ 1 นาทีแล้วลองใหม่' });
    if (scryptBusy >= 6) return send(res, 503, { error: 'ระบบยุ่งอยู่ ลองใหม่อีกครั้ง' });
    return readBody(req, res, (body) => {
      let j; try { j = JSON.parse(body); } catch (e) { return send(res, 400, { error: 'bad json' }); }
      const user = String((j && j.user) || '').trim().toLowerCase(), pass = String((j && j.pass) || '');
      const bad = () => { recordFail(ip); send(res, 401, { error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' }); };
      if (!/^[a-z0-9_]{3,20}$/.test(user) || !pass || pass.length > 100) return bad();
      if (!rate('login:' + user + ':' + ip, 10)) return send(res, 429, { error: 'ลองผิดหลายครั้งเกินไป รอ 1 นาทีแล้วลองใหม่' });
      loadCustomers(true);
      const hit = Object.values(cust.all).find((c) => c._set && c._set.has(user) && c.pass);
      const [salt, hash] = hit ? String(hit.pass).split(':') : ['00', '00'.repeat(32)];
      scryptBusy++;
      crypto.scrypt(pass, Buffer.from(salt, 'hex'), 32, (err, key) => { scryptBusy--; // คำนวณเสมอ ไม่ให้เดาได้จากเวลาตอบว่าชื่อนี้มีอยู่
        if (err || !hit) return bad();
        const want = Buffer.from(hash, 'hex');
        if (want.length !== key.length || !crypto.timingSafeEqual(want, key)) return bad();
        if (hit.revoked) return send(res, 403, { error: 'บัญชีนี้ถูกระงับ ติดต่อร้าน' });
        if (hit.expires && now() > hit.expires) return send(res, 403, { error: 'หมดอายุแล้ว ติดต่อร้านเพื่อต่ออายุ' });
        if (!hit.view) return send(res, 403, { error: 'บัญชีนี้ต้องให้ร้านออกคีย์ใหม่ก่อน' });
        send(res, 200, { token: hit.view, name: hit.name });
      });
    });
  }

  if (req.method === 'GET' && url.pathname === '/api/v1/icons') { // ลิงก์รูปไอเทม (ไม่ใช่ข้อมูลส่วนตัว)
    if (!rate('icons:' + ip, 30)) return send(res, 429, { error: 'rate limited' });
    return send(res, 200, icons, 'application/json; charset=utf-8', { 'Cache-Control': 'public, max-age=300' });
  }

  if (orders.handle(req, res, url, ip)) return;
  if (admin.handle(req, res, url, ip)) return;

  if (req.method === 'GET' && url.pathname === '/api/v1/state' && admin.isAdmin(req)) { // แอดมินดูแดชบอร์ดรวมทุกไอดี
    const pool = accounts[OWNER] || {};
    return send(res, 200, { serverTime: now(), expires: null, mode: settings.mode, admin: true, accounts: Object.keys(pool).map((n) => withRejoin(n, pool[n])) });
  }

  if (req.method === 'GET' && url.pathname === '/api/v1/state') {
    const a = authenticate(req, 'sfv_');
    if (a.error) return authFail(res, ip, a);
    if (!rate(a.id + ':v', RATE_VIEW_PER_MIN)) return send(res, 429, { error: 'rate limited' });
    let list;
    if (settings.mode === 'owner') { // เห็นเฉพาะไอดีที่เจ้าของกำหนดให้ลูกค้าคนนี้
      const pool = accounts[OWNER] || {};
      list = Object.keys(pool).filter((n) => a.c._set && a.c._set.has(n.toLowerCase())).map((n) => withRejoin(n, pool[n]));
    } else list = Object.values(accounts[a.id] || {});
    return send(res, 200, { serverTime: now(), expires: a.c.expires || null, mode: settings.mode, accounts: list });
  }

  if (req.method === 'GET' && Object.prototype.hasOwnProperty.call(STATIC, url.pathname)) {
    const [file, type] = STATIC[url.pathname];
    return fs.readFile(path.join(PUBLIC_DIR, file), (e, d) => {
      if (e) return send(res, 500, { error: file + ' not found' });
      send(res, 200, d, type, Object.assign({}, hsts, /\.html$/.test(file) ? { 'Content-Security-Policy': CSP } : {}));
    });
  }

  // สคริปต์ล่าสุดสำหรับตัวโหลดอัตโนมัติ (ไม่มีคีย์ในไฟล์ คีย์อยู่ในตัวโหลดของเจ้าของ) เติมที่อยู่เซิร์ฟเวอร์จากลิงก์ที่เปิดเข้ามา
  if (req.method === 'GET' && url.pathname === '/script.lua') {
    if (!rate('script:' + ip, 30)) return send(res, 429, '-- rate limited', 'text/plain; charset=utf-8');
    const host = String(req.headers.host || '');
    if (!/^[a-z0-9.-]+(:\d+)?$/i.test(host)) return send(res, 400, '-- bad host', 'text/plain; charset=utf-8');
    const proto = TRUST_PROXY && req.headers['x-forwarded-proto'] === 'https' ? 'https' : (/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host) ? 'http' : 'https');
    return fs.readFile(path.join(__dirname, 'script_template.lua'), 'utf8', (e, t) => {
      if (e) return send(res, 500, '-- script_template.lua not found', 'text/plain; charset=utf-8');
      t = t.replace(/local WEB_API_URL = "[^"]*"/, `local WEB_API_URL = "${proto}://${host}/api/v1/ingest"`)
           .replace(/local INTERVAL = \d+/, 'local INTERVAL = 120')
           .replace(/local WEBHOOK_URL = "[^"]*"/, 'local WEBHOOK_URL = ""');
      send(res, 200, t, 'text/plain; charset=utf-8');
    });
  }

  if (req.method === 'GET' && url.pathname === '/') { res.writeHead(302, { Location: '/v', 'Cache-Control': 'no-store' }); return res.end(); }
  send(res, 404, { error: 'not found' });
}

server.listen(PORT, HOST, () => console.log(`Slayer Fleet Cloud v${VERSION} ฟังที่ http://${HOST}:${PORT}\nโฟลเดอร์: ${__dirname}\nข้อมูล: ${DATA_DIR}`));
server.on('error', (e) => { console.error(e.message); process.exit(e.code === 'EADDRINUSE' ? 2 : 1); }); // 2 = มีเซิร์ฟเวอร์เปิดอยู่แล้ว (start-cloud.bat จะไม่เปิดซ้ำ)
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { flush(); process.exit(0); });
// ถ้ามีข้อผิดพลาดที่ไม่คาดคิด: บันทึกข้อมูลแล้วปิด (start-cloud.bat จะเปิดใหม่ให้เองใน 3 วินาที)
process.on('uncaughtException', (e) => { console.error('ข้อผิดพลาดร้ายแรง:', e && e.stack || e); try { flush(); } catch (_) {} process.exit(1); });

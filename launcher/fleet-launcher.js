#!/usr/bin/env node
// Fleet Launcher: เปิด Roblox เข้าเกมให้แต่ละไอดีเอง (ใช้แทน Roblox Account Manager)
//
// ทำงานคู่กับเซิร์ฟเวอร์ Fleet: เซิร์ฟเวอร์เห็นว่าไอดีไหนเงียบเกิน X นาที → เรียก http://127.0.0.1:7963/LaunchAccount
// → โปรแกรมนี้ปิด Roblox ตัวเก่าของไอดีนั้น (ถ้ารู้) → ขอตั๋วเข้าเกมจาก Roblox ด้วย cookie → เปิดเข้าแมพเดิม
//
// ความปลอดภัย
//  - cookie ของแต่ละไอดีเก็บที่ %LOCALAPPDATA%\FleetLauncher\accounts.dat เข้ารหัสด้วย Windows DPAPI (ผูกกับ user ของคอมเครื่องนี้)
//    อยู่นอกโฟลเดอร์ร้าน: ไม่ติดไปกับไฟล์สำรอง ไม่ติดไปกับ zip/GitHub ก๊อปไปเครื่องอื่นเปิดไม่ได้
//  - รับคำสั่งเฉพาะจากเครื่องตัวเอง (127.0.0.1) และต้องมีรหัส (สร้างให้อัตโนมัติ เขียนลง data\rejoin.json ให้เซิร์ฟเวอร์ใช้)
//  - ส่ง cookie ไปที่ roblox.com เท่านั้น ไม่พิมพ์ลงหน้าจอ ไม่เขียนลง log
//
// ใช้งาน: ดับเบิลคลิก launcher.bat (เมนูภาษาไทย)
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const crypto = require('crypto');
const readline = require('readline');
const { spawnSync, spawn } = require('child_process');

const APP = path.join(__dirname, '..');
const DATA_DIR = path.join(APP, 'data');
const REJOIN_FILE = path.join(DATA_DIR, 'rejoin.json');
const STORE_DIR = process.env.FLEET_LAUNCHER_DIR || path.join(process.env.LOCALAPPDATA || os.homedir(), 'FleetLauncher');
const STORE = path.join(STORE_DIR, 'accounts.dat');
const LOG = path.join(STORE_DIR, 'launcher.log');
const PORT = 7963;
const DEFAULT_PLACE = 136406881576517; // Slayer 2
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) FleetLauncher/1.0';
const IS_WIN = process.platform === 'win32';
const TEST_PLAIN = process.env.FLEET_LAUNCHER_TEST === '1'; // ใช้ตอนทดสอบบนเครื่องที่ไม่ใช่ Windows เท่านั้น (ไม่เข้ารหัส)

// ---------- เข้ารหัสด้วย Windows DPAPI (ผ่าน PowerShell, ส่งข้อมูลทาง stdin ไม่ผ่าน command line) ----------
function dpapi(mode, input) {
  if (TEST_PLAIN) return mode === 'protect' ? Buffer.from(input, 'utf8').toString('base64') : Buffer.from(input, 'base64').toString('utf8');
  if (!IS_WIN) throw new Error('โปรแกรมนี้ใช้ได้บน Windows เท่านั้น');
  const ps = mode === 'protect'
    ? "Add-Type -AssemblyName System.Security; $t=[Console]::In.ReadToEnd(); $b=[Text.Encoding]::UTF8.GetBytes($t); [Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect($b,$null,'CurrentUser'))"
    : "Add-Type -AssemblyName System.Security; $t=[Console]::In.ReadToEnd().Trim(); $b=[Convert]::FromBase64String($t); [Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect($b,$null,'CurrentUser'))";
  const r = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], { input, encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
  if (r.status !== 0) throw new Error('เข้ารหัส/ถอดรหัสไม่สำเร็จ: ' + String(r.stderr || '').trim().slice(0, 200));
  return String(r.stdout).trim();
}
function loadAccounts() {
  try { return JSON.parse(dpapi('unprotect', fs.readFileSync(STORE, 'utf8'))); }
  catch (e) { if (e.code === 'ENOENT') return {}; throw new Error('อ่านไฟล์ไอดีไม่ได้ (ต้องใช้ user Windows เดิมที่สร้างไฟล์): ' + e.message); }
}
function saveAccounts(acc) {
  fs.mkdirSync(STORE_DIR, { recursive: true });
  const tmp = STORE + '.tmp';
  fs.writeFileSync(tmp, dpapi('protect', JSON.stringify(acc)));
  fs.renameSync(tmp, STORE);
}
function log(line) {
  const l = new Date().toLocaleString('th-TH') + '  ' + line;
  console.log(l);
  try { fs.mkdirSync(STORE_DIR, { recursive: true }); fs.appendFileSync(LOG, l + '\n'); } catch (e) {}
}

// ---------- คุยกับ Roblox ----------
const cookieHdr = (c) => '.ROBLOSECURITY=' + c;
async function whoAmI(cookie) {
  const r = await fetch('https://users.roblox.com/v1/users/authenticated', { headers: { Cookie: cookieHdr(cookie), 'User-Agent': UA }, signal: AbortSignal.timeout(15000) });
  if (r.status === 401) throw new Error('cookie ใช้ไม่ได้ (หมดอายุหรือล็อกเอาต์ไปแล้ว)');
  if (!r.ok) throw new Error('Roblox ตอบกลับ ' + r.status);
  const j = await r.json();
  return { id: j.id, name: j.name, display: j.displayName };
}
// ขอตั๋วเข้าเกม: ครั้งแรก Roblox ตอบ 403 พร้อม x-csrf-token แล้วค่อยขอซ้ำด้วย token นั้น
async function authTicket(cookie) {
  let csrf = '';
  for (let i = 0; i < 2; i++) {
    const r = await fetch('https://auth.roblox.com/v1/authentication-ticket', {
      method: 'POST', body: '{}',
      headers: { Cookie: cookieHdr(cookie), 'User-Agent': UA, 'Content-Type': 'application/json', Referer: 'https://www.roblox.com/', Origin: 'https://www.roblox.com', 'x-csrf-token': csrf },
      signal: AbortSignal.timeout(15000),
    });
    const t = r.headers.get('rbx-authentication-ticket');
    if (t) return t;
    const nc = r.headers.get('x-csrf-token');
    if (r.status === 403 && nc && !csrf) { csrf = nc; continue; }
    if (r.status === 401) throw new Error('cookie ใช้ไม่ได้แล้ว ต้องใส่ใหม่ (เมนู 1)');
    throw new Error('ขอตั๋วเข้าเกมไม่สำเร็จ (Roblox ตอบ ' + r.status + ')');
  }
  throw new Error('ขอตั๋วเข้าเกมไม่สำเร็จ');
}
function launchUri(ticket, placeId) {
  const bt = String(crypto.randomInt(1e11, 1e12 - 1));
  const pl = `https://assetgame.roblox.com/game/PlaceLauncher.ashx?request=RequestGame&browserTrackerId=${bt}&placeId=${placeId}&isPlayTogetherGame=false&joinAttemptId=${crypto.randomUUID()}&joinAttemptOrigin=PlayButton`;
  return `roblox-player:1+launchmode:play+gameinfo:${ticket}+launchtime:${Date.now()}+placelauncherurl:${encodeURIComponent(pl)}+browsertrackerid:${bt}+robloxLocale:en_us+gameLocale:en_us`;
}

// ---------- จัดการหน้าต่าง Roblox ----------
function robloxPids() {
  if (!IS_WIN) return [];
  const r = spawnSync('tasklist', ['/FI', 'IMAGENAME eq RobloxPlayerBeta.exe', '/FO', 'CSV', '/NH'], { encoding: 'utf8', windowsHide: true });
  return String(r.stdout || '').split(/\r?\n/).map((l) => (l.match(/^"RobloxPlayerBeta\.exe","(\d+)"/) || [])[1]).filter(Boolean).map(Number);
}
const pidOf = new Map(); // ชื่อไอดี (ตัวเล็ก) -> PID ของ Roblox ที่โปรแกรมนี้เปิดให้
function killOld(name) {
  const pid = pidOf.get(name.toLowerCase());
  if (!pid || !IS_WIN) return false;
  if (!robloxPids().includes(pid)) { pidOf.delete(name.toLowerCase()); return false; }
  spawnSync('taskkill', ['/PID', String(pid), '/F'], { windowsHide: true });
  pidOf.delete(name.toLowerCase());
  return true;
}
function openUri(uri) {
  if (TEST_PLAIN) { log('(โหมดทดสอบ: ไม่ได้เปิด Roblox จริง)'); return; }
  if (!IS_WIN) throw new Error('เปิด Roblox ได้บน Windows เท่านั้น');
  spawn('cmd', ['/c', 'start', '""', uri], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
}

const busy = new Set();
async function launch(name, placeId) {
  const acc = loadAccounts();
  const key = Object.keys(acc).find((k) => k.toLowerCase() === String(name).toLowerCase());
  if (!key) throw new Error('ไม่มีไอดี ' + name + ' ในโปรแกรม (เพิ่มที่เมนู 1)');
  if (busy.has(key.toLowerCase())) throw new Error(key + ' กำลังเปิดอยู่แล้ว');
  busy.add(key.toLowerCase());
  try {
    const killed = killOld(key);
    if (killed) { log(`${key}: ปิด Roblox ตัวเก่าแล้ว`); await new Promise((r) => setTimeout(r, 3000)); }
    const before = new Set(robloxPids());
    const ticket = await authTicket(acc[key].cookie);
    openUri(launchUri(ticket, placeId));
    log(`${key}: กำลังเข้าเกม (place ${placeId})`);
    // จำว่า Roblox หน้าต่างใหม่เป็นของไอดีไหน (ไว้ปิดตัวค้างรอบหน้า)
    setTimeout(() => { const nw = robloxPids().filter((p) => !before.has(p)); if (nw.length === 1) pidOf.set(key.toLowerCase(), nw[0]); }, 20000).unref();
    acc[key].lastLaunch = Date.now();
    try { saveAccounts(acc); } catch (e) {}
    return key;
  } finally { setTimeout(() => busy.delete(key.toLowerCase()), 30000).unref(); }
}

// ---------- รับคำสั่งจากเซิร์ฟเวอร์ Fleet (แบบเดียวกับ RAM) ----------
function ensureRejoinCfg() {
  let c = {}; try { c = JSON.parse(fs.readFileSync(REJOIN_FILE, 'utf8')); } catch (e) {}
  let changed = false;
  if (!c.password || !/^[A-Za-z0-9]{16,}$/.test(c.password)) { c.password = crypto.randomBytes(18).toString('base64').replace(/[^A-Za-z0-9]/g, '').slice(0, 24); changed = true; }
  if (c.port !== PORT) { c.port = PORT; changed = true; }
  if (!c.enabled) { c.enabled = true; changed = true; }
  if (changed) { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(REJOIN_FILE, JSON.stringify(c, null, 2)); }
  return c;
}
function safeEq(a, b) { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); }
function serve() {
  const cfg = ensureRejoinCfg();
  const names = Object.keys(loadAccounts());
  const srv = http.createServer(async (req, res) => {
    const send = (code, text) => { res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end(text); };
    try {
      const u = new URL(req.url, 'http://127.0.0.1');
      const pw = rejoinPw();
      if (!pw || !safeEq(u.searchParams.get('Password') || '', pw)) return send(401, 'รหัสไม่ถูกต้อง');
      if (u.pathname === '/GetAccounts') return send(200, Object.keys(loadAccounts()).join(','));
      if (u.pathname === '/LaunchAccount') {
        const name = u.searchParams.get('Account') || '';
        const place = Number(u.searchParams.get('PlaceId')) || DEFAULT_PLACE;
        if (!/^[A-Za-z0-9_]{3,20}$/.test(name) || !(place > 0)) return send(400, 'ข้อมูลไม่ถูกต้อง');
        const k = await launch(name, place);
        return send(200, 'กำลังเปิด ' + k);
      }
      send(404, 'not found');
    } catch (e) { log('ผิดพลาด: ' + e.message); send(500, e.message); }
  });
  srv.on('error', (e) => { console.log(e.code === 'EADDRINUSE' ? `พอร์ต ${PORT} ถูกใช้อยู่ (เปิด Roblox Account Manager หรือหน้าต่างนี้ซ้ำอยู่หรือเปล่า) ปิดตัวอื่นก่อน` : e.message); process.exit(1); });
  srv.listen(PORT, '127.0.0.1', () => {
    console.log(`\n===== Fleet Launcher ทำงานแล้ว (ปิดหน้าต่างนี้ = หยุดรีจอย) =====`);
    console.log(`ไอดีที่รีจอยได้ ${names.length} ตัว: ${names.join(', ') || '(ยังไม่มี เพิ่มที่เมนู 1)'}`);
    console.log(`เซิร์ฟเวอร์ Fleet จะสั่งเปิดไอดีที่เงียบเกิน ${cfg.afterMin || 5} นาทีให้เอง (ตั้งค่าใน data\\rejoin.json แล้ว)\n`);
  });
}
const rejoinPw = () => { try { return JSON.parse(fs.readFileSync(REJOIN_FILE, 'utf8')).password; } catch (e) { return ''; } };

// ---------- เมนู ----------
async function menu() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((r) => rl.question(q, (a) => r(String(a || '').trim())));
  for (;;) {
    let acc = {};
    try { acc = loadAccounts(); } catch (e) { console.log('!! ' + e.message); }
    const names = Object.keys(acc);
    console.log('\n===== Fleet Launcher: รีจอย Roblox อัตโนมัติ =====');
    console.log(`ไอดีในโปรแกรม: ${names.length} ตัว` + (names.length ? ' (' + names.join(', ') + ')' : ''));
    console.log(' 1) เพิ่ม/อัปเดตไอดี (วาง cookie)');
    console.log(' 2) ดูรายชื่อ + เช็คว่า cookie ยังใช้ได้');
    console.log(' 3) ลบไอดี');
    console.log(' 4) ทดสอบเปิดเกม 1 ไอดี');
    console.log(' 5) เริ่มทำงาน (รอเซิร์ฟเวอร์สั่งรีจอย)  ← ใช้ข้อนี้ประจำ');
    console.log(' 0) ออก');
    const k = await ask('เลือก: ');
    try {
      if (k === '1') {
        console.log('\nวิธีเอา cookie: เปิดเบราว์เซอร์แบบไม่ระบุตัวตน → ล็อกอิน roblox.com ด้วยไอดีนั้น → F12 → Application → Cookies → https://www.roblox.com');
        console.log('→ ก๊อปค่าของ .ROBLOSECURITY ทั้งหมด → ปิดหน้าต่างเบราว์เซอร์ทิ้งเลย (ห้ามกด Log out ไม่งั้น cookie ใช้ไม่ได้)');
        console.log('ห้ามส่ง cookie ให้ใคร ใครได้ไปเข้าไอดีได้ทันที');
        const c = (await ask('\nวาง cookie แล้วกด Enter: ')).replace(/^\.ROBLOSECURITY=/, '').replace(/^"|"$/g, '');
        console.clear();
        if (c.length < 100) { console.log('cookie สั้นเกินไป ก๊อปมาไม่ครบหรือเปล่า'); continue; }
        const me = await whoAmI(c);
        const old = Object.keys(acc).find((x) => x.toLowerCase() === me.name.toLowerCase());
        if (old) delete acc[old];
        acc[me.name] = { cookie: c, id: me.id, added: Date.now() };
        saveAccounts(acc);
        console.log(`บันทึก ${me.name} (${me.display}) แล้ว · เข้ารหัสเก็บที่ ${STORE}`);
      } else if (k === '2') {
        for (const n of names) {
          try { const me = await whoAmI(acc[n].cookie); console.log(`  ✓ ${n}  ใช้ได้` + (me.name !== n ? ` (ชื่อในระบบตอนนี้: ${me.name})` : '')); }
          catch (e) { console.log(`  ✗ ${n}  ${e.message}`); }
        }
        if (!names.length) console.log('  (ยังไม่มี)');
      } else if (k === '3') {
        const n = await ask('ชื่อไอดีที่จะลบ: ');
        const key = names.find((x) => x.toLowerCase() === n.toLowerCase());
        if (!key) { console.log('ไม่มีไอดีนี้'); continue; }
        delete acc[key]; saveAccounts(acc); console.log('ลบ ' + key + ' แล้ว');
      } else if (k === '4') {
        const n = await ask('ชื่อไอดี: ');
        const p = Number(await ask(`placeId (Enter = Slayer 2 ${DEFAULT_PLACE}): `)) || DEFAULT_PLACE;
        await launch(n, p);
        console.log('ส่งคำสั่งเปิดเกมแล้ว ดูหน้าต่าง Roblox ที่เปิดขึ้นมา');
      } else if (k === '5') { rl.close(); return serve(); }
      else if (k === '0') { rl.close(); return; }
    } catch (e) { console.log('!! ' + e.message); }
  }
}

if (require.main === module) {
  const a = process.argv[2];
  if (a === 'serve') serve(); else menu();
}
module.exports = { launchUri, authTicket, whoAmI, launch, loadAccounts, saveAccounts, serve };

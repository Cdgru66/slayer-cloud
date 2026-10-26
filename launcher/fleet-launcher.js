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
// ใช้งาน: ดับเบิลคลิก launcher.bat → ทำงานเบื้องหลัง (ไม่มีหน้าต่างดำ) + เปิดหน้าจอควบคุม · กดซ้ำ = เปิดหน้าจอของตัวที่ทำงานอยู่
// launcher.bat console = แบบมีหน้าต่างดำ (ไว้ดูปัญหา) · launcher.bat menu = เมนูตัวอักษร
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const crypto = require('crypto');
const readline = require('readline');
const { spawnSync, spawn, execFile } = require('child_process');

const APP = process.env.FLEET_APP_DIR || path.join(__dirname, '..'); // แอปที่ขาย (โค้ดอยู่ในตัว exe) ตั้ง FLEET_APP_DIR ไปที่โฟลเดอร์ของผู้ใช้
const DATA_DIR = path.join(APP, 'data');
const REJOIN_FILE = path.join(DATA_DIR, 'rejoin.json');
const STORE_DIR = process.env.FLEET_LAUNCHER_DIR || path.join(process.env.LOCALAPPDATA || os.homedir(), 'FleetLauncher');
const STORE = path.join(STORE_DIR, 'accounts.dat');
const LOG = path.join(STORE_DIR, 'launcher.log');
const PORT = 7963;
const DEFAULT_PLACE = 16205713724; // Slayers 2 (หน้าแรกของเกม · แมพย่อยเข้าตรงไม่ได้)
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
const appVersion = () => { for (const f of [path.join(APP, 'version.txt'), path.join(__dirname, 'version.txt')]) { try { return fs.readFileSync(f, 'utf8').trim(); } catch (e) {} } return ''; };
// ---------- คีย์ใช้งาน (เฉพาะแอปที่ขาย: มี launcher/license.json · ตัวของร้านเองไม่ต้องใส่คีย์) ----------
const LIC = require('./license-client.js')({
  cfgFile: path.join(__dirname, 'license.json'), dir: STORE_DIR, log, version: appVersion(),
  protect: (t) => (IS_WIN || TEST_PLAIN ? dpapi('protect', t) : t), unprotect: (t) => (IS_WIN || TEST_PLAIN ? dpapi('unprotect', t) : t),
});
const LOCKED_MSG = 'ต้องใส่คีย์ใช้งานก่อน';

// ---------- คุยกับ Roblox ----------
const cookieHdr = (c) => '.ROBLOSECURITY=' + c;
async function whoAmI(cookie) {
  let r;
  try { r = await fetch('https://users.roblox.com/v1/users/authenticated', { headers: { Cookie: cookieHdr(cookie), 'User-Agent': UA }, signal: AbortSignal.timeout(15000) }); }
  catch (e) { throw new Error('ต่อ Roblox ไม่ได้ (เน็ตหลุดหรือ Roblox ล่ม)'); }
  if (r.status === 401) throw new Error('cookie ใช้ไม่ได้ (หมดอายุหรือล็อกเอาต์ไปแล้ว)');
  if (!r.ok) throw new Error('Roblox ตอบกลับ ' + r.status);
  const j = await r.json();
  return { id: j.id, name: j.name, display: j.displayName };
}
// ขอตั๋วเข้าเกม: ครั้งแรก Roblox ตอบ 403 พร้อม x-csrf-token แล้วค่อยขอซ้ำด้วย token นั้น
async function authTicket(cookie) {
  let csrf = '';
  for (let i = 0; i < 2; i++) {
    let r;
    try {
      r = await fetch('https://auth.roblox.com/v1/authentication-ticket', {
        method: 'POST', body: '{}',
        headers: { Cookie: cookieHdr(cookie), 'User-Agent': UA, 'Content-Type': 'application/json', Referer: 'https://www.roblox.com/', Origin: 'https://www.roblox.com', 'x-csrf-token': csrf },
        signal: AbortSignal.timeout(15000),
      });
    } catch (e) { throw new Error('ต่อ Roblox ไม่ได้ (เน็ตหลุดหรือ Roblox ล่ม) เซิร์ฟเวอร์จะสั่งลองใหม่เอง'); }
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
  const pl = `https://www.roblox.com/Game/PlaceLauncher.ashx?request=RequestGame&browserTrackerId=${bt}&placeId=${placeId}&isPlayTogetherGame=false&joinAttemptId=${crypto.randomUUID()}&joinAttemptOrigin=PlayButton`;
  return `roblox-player:1+launchmode:play+gameinfo:${ticket}+launchtime:${Date.now()}+placelauncherurl:${encodeURIComponent(pl)}+browsertrackerid:${bt}+robloxLocale:en_us+gameLocale:en_us`;
}

// ---------- จัดการหน้าต่าง Roblox ----------
// รายการ Roblox ที่เปิดอยู่ + RAM ที่ใช้ (tasklist ตอบ "ชื่อ","PID","Session","#","123,456 K")
function robloxProcs() {
  if (!IS_WIN) return [];
  const r = spawnSync('tasklist', ['/FI', 'IMAGENAME eq RobloxPlayerBeta.exe', '/FO', 'CSV', '/NH'], { encoding: 'utf8', windowsHide: true });
  return String(r.stdout || '').split(/\r?\n/).map((l) => {
    const m = l.match(/^"RobloxPlayerBeta\.exe","(\d+)"(?:,"[^"]*"){2},"([^"]*)"/i);
    return m ? { pid: Number(m[1]), mb: Math.round(Number(m[2].replace(/[^\d]/g, '')) / 1024) || 0 } : null;
  }).filter(Boolean);
}
const robloxPids = () => robloxProcs().map((p) => p.pid);

// ---------- ประหยัดเครื่อง: คืน RAM / ย่อหน้าต่าง (เรียก Windows API ผ่าน PowerShell แบบไม่บล็อกโปรแกรม) ----------
function runPs(script, timeout) {
  return new Promise((resolve) => {
    if (!IS_WIN) return resolve('');
    execFile('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8', windowsHide: true, timeout: timeout || 30000 }, (e, out) => resolve(e ? '' : String(out || '')));
  });
}
const PS_API = "Add-Type -Namespace FL -Name W -MemberDefinition '[DllImport(\"psapi.dll\")] public static extern bool EmptyWorkingSet(IntPtr h); [DllImport(\"user32.dll\")] public static extern bool ShowWindowAsync(IntPtr h, int c);';";
const trimStat = { at: 0, freedMb: 0, dayKey: '', dayMb: 0, running: false };
// ย้ายหน่วยความจำที่ Roblox ไม่ได้ใช้อยู่ออกจาก RAM (ส่วนที่ต้องใช้ Windows ดึงกลับให้เอง) · ช่วยมากตอน RAM ใกล้เต็ม
async function trimRam() {
  if (trimStat.running) return { ok: false, msg: 'กำลังคืน RAM อยู่' };
  trimStat.running = true;
  try {
    const out = await runPs(PS_API + " $b=0;$a=0; Get-Process RobloxPlayerBeta -ErrorAction SilentlyContinue | ForEach-Object { try { $b+=$_.WorkingSet64; [void][FL.W]::EmptyWorkingSet($_.Handle); $_.Refresh(); $a+=$_.WorkingSet64 } catch {} }; \"$b $a\"");
    const [b, a] = out.trim().split(/\s+/).map(Number);
    const freed = b > 0 && a >= 0 ? Math.max(0, Math.round((b - a) / 1048576)) : 0;
    const day = new Date().toDateString();
    if (trimStat.dayKey !== day) { trimStat.dayKey = day; trimStat.dayMb = 0; }
    Object.assign(trimStat, { at: Date.now(), freedMb: freed }); trimStat.dayMb += freed;
    if (freed > 0) log(`คืน RAM จาก Roblox ได้ ${freed} MB`);
    return { ok: true, msg: IS_WIN ? `คืน RAM ได้ ${freed} MB` : 'คืน RAM ใช้ได้บน Windows เท่านั้น', freed };
  } finally { trimStat.running = false; }
}
function minimizePids(pids) {
  const list = pids.filter((p) => Number.isInteger(p) && p > 0);
  if (!list.length) return Promise.resolve('');
  return runPs(PS_API + ' ' + list.map((p) => `$p=Get-Process -Id ${p} -ErrorAction SilentlyContinue; if($p -and $p.MainWindowHandle -ne 0){[void][FL.W]::ShowWindowAsync($p.MainWindowHandle,6)}`).join('; '));
}

// ---------- รูปโปรไฟล์ Roblox (headshot) · ดึงจาก Roblox เก็บไว้ในหน่วยความจำ 1 ชม. ----------
const avatarCache = new Map(); // ชื่อ (ตัวเล็ก) -> { id, url, at }
let avatarBusy = false;
async function refreshAvatars(known, names) {
  if (avatarBusy) return; avatarBusy = true;
  try {
    const stale = (k) => { const c = avatarCache.get(k); return !c || Date.now() - c.at > 3600e3; };
    const ids = new Map(); // ชื่อ -> id
    for (const [n, id] of Object.entries(known)) if (id && stale(n.toLowerCase())) ids.set(n.toLowerCase(), Number(id));
    const need = names.map((n) => n.toLowerCase()).filter((k) => !ids.has(k) && stale(k) && /^[a-z0-9_]{3,20}$/.test(k)).slice(0, 100);
    if (need.length) {
      const r = await fetch('https://users.roblox.com/v1/usernames/users', { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': UA }, body: JSON.stringify({ usernames: need, excludeBannedUsers: false }), signal: AbortSignal.timeout(10000) });
      if (r.ok) for (const u of ((await r.json()).data || [])) if (u && u.id) ids.set(String(u.requestedUsername || u.name).toLowerCase(), u.id);
      for (const k of need) if (!ids.has(k)) avatarCache.set(k, { id: null, url: null, at: Date.now() });
    }
    const all = [...ids.entries()].slice(0, 100);
    if (!all.length) return;
    const r = await fetch('https://thumbnails.roblox.com/v1/users/avatar-headshot?size=150x150&format=Png&isCircular=false&userIds=' + all.map(([, id]) => id).join(','), { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10000) });
    const urls = new Map();
    if (r.ok) for (const t of ((await r.json()).data || [])) if (t && t.state === 'Completed' && /^https:\/\/[a-z0-9.-]+\.rbxcdn\.com\//.test(t.imageUrl || '')) urls.set(t.targetId, t.imageUrl);
    for (const [k, id] of all) avatarCache.set(k, { id, url: urls.get(id) || null, at: Date.now() });
  } catch (e) { /* ไม่มีเน็ต/Roblox ล่ม: ใช้ตัวอักษรแทนรูปไปก่อน */ } finally { avatarBusy = false; }
}
// ---------- เกมที่บันทึกไว้: ชื่อ + ไอคอนจริงจาก Roblox (เก็บแคชที่ %LOCALAPPDATA%\FleetLauncher\games.json) ----------
const GAMES_DEF = [16205713724, 107778070777162]; // Slayers 2, Steal An Egg
const GAME_CACHE = path.join(STORE_DIR, 'games.json');
let gameCache = {}; try { gameCache = JSON.parse(fs.readFileSync(GAME_CACHE, 'utf8')) || {}; } catch (e) {}
const RBX_IMG = /^https:\/\/[a-z0-9.-]+\.rbxcdn\.com\/[^\s"'<>]{1,400}$/;
async function gameInfo(id, force) {
  const c = gameCache[id];
  if (c && !force && Date.now() - c.at < 24 * 3600e3) return c;
  const get = async (u) => { const r = await fetch(u, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10000) }); if (!r.ok) throw new Error('Roblox ตอบ ' + r.status); return r.json(); };
  const uni = (await get(`https://apis.roblox.com/universes/v1/places/${id}/universe`)).universeId;
  if (!uni) throw new Error('ไม่เจอเกมนี้ใน Roblox (เช็คเลข Place ID)');
  const [g, ic] = await Promise.all([get('https://games.roblox.com/v1/games?universeIds=' + uni).catch(() => ({})), get(`https://thumbnails.roblox.com/v1/games/icons?universeIds=${uni}&returnPolicy=PlaceHolder&size=150x150&format=Png&isCircular=false`).catch(() => ({}))]);
  const name = String(((g.data || [])[0] || {}).name || (c && c.name) || '').slice(0, 60);
  const icon = String(((ic.data || [])[0] || {}).imageUrl || '');
  gameCache[id] = { id, uni, name: name || 'Place ' + id, icon: RBX_IMG.test(icon) ? icon : (c && c.icon) || null, at: Date.now() };
  try { fs.mkdirSync(STORE_DIR, { recursive: true }); fs.writeFileSync(GAME_CACHE, JSON.stringify(gameCache)); } catch (e) {}
  return gameCache[id];
}
const savedGames = (cfg) => { const l = (Array.isArray(cfg.games) ? cfg.games : GAMES_DEF).map(Number).filter((n) => Number.isSafeInteger(n) && n > 0); const cur = Number(cfg.placeId) || DEFAULT_PLACE; if (!l.includes(cur)) l.push(cur); return [...new Set(l)].slice(0, 30); };
let gamesBusy = false;
function refreshGames(ids) { // เบื้องหลัง: เติมชื่อ/ไอคอนที่ยังไม่มีหรือเก่ากว่า 1 วัน
  if (gamesBusy) return; const need = ids.filter((id) => !gameCache[id] || Date.now() - gameCache[id].at > 24 * 3600e3); if (!need.length) return;
  gamesBusy = true; (async () => { for (const id of need) { try { await gameInfo(id); } catch (e) { gameCache[id] = Object.assign({ id, name: null, icon: null }, gameCache[id], { at: Date.now() - 23 * 3600e3 }); } } })().finally(() => { gamesBusy = false; });
}
// ---------- ไอคอน Token / Ore จากเซิร์ฟเวอร์ร้าน (/api/v1/icons) ----------
let iconCache = { at: 0, v: {} };
function itemIcons() {
  if (Date.now() - iconCache.at > 3600e3) {
    iconCache.at = Date.now();
    fetch((LIC.enabled ? LIC.server : FLEET) + '/api/v1/icons', { signal: AbortSignal.timeout(8000) }).then((r) => (r.ok ? r.json() : {})).then((m) => {
      const pick = (n) => (typeof m[n] === 'string' && RBX_IMG.test(m[n]) ? m[n] : null);
      iconCache.v = { token: pick('Ouwigahara Token'), ore: pick('Ore') };
    }).catch(() => { iconCache.at = Date.now() - 3300e3; });
  }
  return iconCache.v;
}
const pidOf = new Map(); // ชื่อไอดี (ตัวเล็ก) -> PID ของ Roblox ที่โปรแกรมนี้เปิดให้
// ปิด Roblox ที่ค้าง (Windows ขึ้น Not Responding) ทุกหน้าต่าง: ค้างแล้วไม่ส่งข้อมูล กิน RAM เปล่า ๆ
function killHung() {
  if (!IS_WIN) return 0;
  const r = spawnSync('taskkill', ['/F', '/FI', 'IMAGENAME eq RobloxPlayerBeta.exe', '/FI', 'STATUS eq NOT RESPONDING'], { encoding: 'utf8', windowsHide: true });
  const n = (String(r.stdout || '').match(/PID \d+/g) || []).length;
  if (n) { log(`ปิด Roblox ที่ค้าง (Not Responding) ${n} หน้าต่าง`); for (const [k, p] of [...pidOf]) if (!robloxPids().includes(p)) pidOf.delete(k); }
  return n;
}
function killOld(name) {
  const pid = pidOf.get(name.toLowerCase());
  if (!pid || !IS_WIN) return false;
  if (!robloxPids().includes(pid)) { pidOf.delete(name.toLowerCase()); return false; }
  spawnSync('taskkill', ['/PID', String(pid), '/F'], { windowsHide: true });
  pidOf.delete(name.toLowerCase());
  return true;
}
// เปิด Roblox ตรงจากคำสั่งที่ Roblox (หรือ Bloxstrap) ลงทะเบียนไว้กับลิงก์ roblox-player: ใน Windows
// (ไม่ผ่าน cmd start: ตัวเดิมส่งชื่อหน้าต่าง "" ผิดรูปแบบ Windows เลยหาไฟล์ไม่เจอแล้วดังเตือน)
function regDefault(key) {
  const r = spawnSync('reg', ['query', key, '/ve'], { encoding: 'utf8', windowsHide: true });
  const m = r.status === 0 && String(r.stdout || '').match(/REG_(?:EXPAND_)?SZ\s+(.+?)\s*$/m);
  return m ? m[1] : '';
}
function splitCmd(s) { const out = [], re = /"([^"]*)"|(\S+)/g; let m; while ((m = re.exec(s))) out.push(m[1] !== undefined ? m[1] : m[2]); return out; }
// หา RobloxPlayerBeta.exe ตัวใหม่สุดในโฟลเดอร์ Versions (เครื่องที่มีหลายเวอร์ชันค้าง เลือกตัวที่อัปเดตล่าสุด)
function newestRobloxExe() {
  const roots = [path.join(process.env.LOCALAPPDATA || '', 'Roblox', 'Versions'), path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Roblox', 'Versions')];
  let best = null;
  for (const r of roots) {
    let dirs = []; try { dirs = fs.readdirSync(r); } catch (e) { continue; }
    for (const d of dirs) {
      const f = path.join(r, d, 'RobloxPlayerBeta.exe');
      try { const t = fs.statSync(f).mtimeMs; if (!best || t > best.t) best = { f, t }; } catch (e) {}
    }
  }
  return best && best.f;
}
function openUri(uri) {
  if (TEST_PLAIN) { log('(โหมดทดสอบ: ไม่ได้เปิด Roblox จริง)'); return; }
  if (!IS_WIN) throw new Error('เปิด Roblox ได้บน Windows เท่านั้น');
  // 1) เปิด Roblox ตัวจริงตรง ๆ (ไม่ผ่านตัวเลือกเวอร์ชันของโปรแกรมอื่นอย่าง Real/Bloxstrap ที่จะเด้งถาม)
  const direct = newestRobloxExe();
  if (direct) {
    const ch = spawn(direct, [uri], { detached: true, stdio: 'ignore' });
    ch.on('error', (e) => log('เปิด Roblox ไม่สำเร็จ: ' + e.message)); ch.unref();
    log('เปิดด้วย Roblox ' + path.basename(path.dirname(direct)));
    return;
  }
  // 2) ไม่เจอ: ใช้โปรแกรมที่ลงทะเบียนกับลิงก์ roblox-player: ไว้
  const tpl = regDefault('HKCU\\Software\\Classes\\roblox-player\\shell\\open\\command') || regDefault('HKCR\\roblox-player\\shell\\open\\command');
  const parts = splitCmd(tpl.replace(/%(\w+)%/g, (x, v) => process.env[v] || x)), exe = parts.shift();
  const onErr = (e) => log('เปิด Roblox ไม่สำเร็จ: ' + e.message);
  if (exe && fs.existsSync(exe)) {
    let used = false;
    const args = parts.map((a) => (a.includes('%1') ? ((used = true), a.replace('%1', uri)) : a));
    if (!used) args.push(uri);
    const ch = spawn(exe, args, { detached: true, stdio: 'ignore' }); ch.on('error', onErr); ch.unref();
    log('เปิดด้วย ' + path.basename(exe));
    return;
  }
  log('ไม่เจอ Roblox ในเครื่อง (ลง Roblox จาก roblox.com/download ก่อน) ลองเปิดผ่าน Windows แทน');
  const ch = spawn('rundll32', ['url.dll,FileProtocolHandler', uri], { detached: true, stdio: 'ignore', windowsHide: true }); ch.on('error', onErr); ch.unref();
}

// เปิด Roblox หลายจอพร้อมกัน: Roblox ยอมให้เปิดได้ทีละตัวถ้าไม่มีใครถือ "ROBLOX_singleton..." ไว้ก่อน
// (แบบเดียวกับ Multi Roblox ของ RAM) · ต้องเริ่มก่อนเปิด Roblox ตัวแรก ถือไว้จนปิดหน้าต่างนี้
let multiOk = null;
function holdMultiRoblox() {
  if (!IS_WIN || TEST_PLAIN) return;
  const ps = "$o=@(); foreach($n in 'ROBLOX_singletonMutex','ROBLOX_singletonEvent'){ $m=New-Object System.Threading.Mutex($false,$n); try{ $o+=$m.WaitOne(0) }catch{ $o+=$true } }; if($o -contains $false){'busy'}else{'ok'}; [Console]::In.ReadToEnd() | Out-Null";
  const ch = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], { stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
  ch.stdout.once('data', (d) => {
    multiOk = String(d).includes('ok');
    log(multiOk ? 'เปิด Roblox หลายจอพร้อมกันได้แล้ว' : 'เปิดหลายจอไม่ได้: มี Roblox หรือโปรแกรมเปิดหลายจออื่น (เช่น Real, Bloxstrap, RAM) ถือไว้อยู่ · ปิดให้หมด (ดูถาดไอคอนมุมขวาล่างด้วย) แล้วเปิด launcher.bat ใหม่ · ยังเปิดได้ทีละจอ');
  });
  ch.on('error', () => {});
}

// ตั้งค่าประหยัดเครื่อง (เก็บใน data/rejoin.json คีย์ perf · เซิร์ฟเวอร์ส่งส่วน "ในเกม" ต่อให้สคริปต์)
const PERF_DEF = { no3d: false, lowGfx: false, fps: 0, except: [], trimMin: 0, minimize: false, staggerSec: 20 };
function perfCfg() { const p = (readRejoin().perf) || {}; return Object.assign({}, PERF_DEF, p, { except: Array.isArray(p.except) ? p.except : [] }); }
const placeOf = () => Number(readRejoin().placeId) || DEFAULT_PLACE;
// โหมดเกม: shared = ทุกไอดีเข้าเกมเดียวกัน · per = ตั้งเกมรายไอดี (ไอดีที่ยังไม่ตั้ง ใช้เกมหลัก)
function placeFor(name) {
  const c = readRejoin(), main = Number(c.placeId) || DEFAULT_PLACE;
  if (c.gameMode !== 'per') return main;
  return Number((c.places || {})[String(name).toLowerCase()]) || main;
}

const busy = new Set();
async function launch(name, placeId) {
  if (!LIC.ok()) throw new Error(LOCKED_MSG);
  const acc = loadAccounts();
  const key = Object.keys(acc).find((k) => k.toLowerCase() === String(name).toLowerCase());
  if (!key) throw new Error('ไม่มีไอดี ' + name + ' ในโปรแกรม (เพิ่มที่เมนู 1)');
  if (busy.has(key.toLowerCase())) throw new Error(key + ' กำลังเปิดอยู่แล้ว');
  busy.add(key.toLowerCase());
  try {
    killHung();
    const killed = killOld(key);
    if (killed) { log(`${key}: ปิด Roblox ตัวเก่าแล้ว`); await new Promise((r) => setTimeout(r, 3000)); }
    const before = new Set(robloxPids());
    const ticket = await authTicket(acc[key].cookie);
    openUri(launchUri(ticket, placeId));
    log(`${key}: กำลังเข้าเกม (place ${placeId})`);
    // จำว่า Roblox หน้าต่างใหม่เป็นของไอดีไหน (ไว้ปิดตัวค้างรอบหน้า)
    setTimeout(() => {
      const nw = robloxPids().filter((p) => !before.has(p));
      if (nw.length === 1) pidOf.set(key.toLowerCase(), nw[0]);
      if (perfCfg().minimize && nw.length) { minimizePids(nw); setTimeout(() => minimizePids(nw), 20000).unref(); } // ย่อหน้าต่างเกมใหม่ (ลองซ้ำเผื่อหน้าต่างยังโหลดไม่เสร็จ)
    }, 20000).unref();
    acc[key].lastLaunch = Date.now();
    try { saveAccounts(acc); } catch (e) {}
    return key;
  } finally { setTimeout(() => busy.delete(key.toLowerCase()), 30000).unref(); }
}

// ---------- เพิ่มไอดี: วาง cookie ได้ทีละหลายบรรทัด ----------
// รับได้ทั้ง "cookie" ล้วน หรือ "user:pass:cookie" ต่อบรรทัด · เก็บเฉพาะ cookie (ชื่อผู้ใช้/รหัสผ่านที่อาจติดมาถูกทิ้ง ไม่บันทึกที่ไหน)
function cookieFromLine(line) {
  const l = String(line).trim(); if (!l) return '';
  const w = l.indexOf('_|WARNING');
  let c = w >= 0 ? l.slice(w) : l.split(':').pop();
  return c.replace(/^\.ROBLOSECURITY=/, '').replace(/^"|"$/g, '').replace(/[;\s"]+$/, '');
}
async function importCookies(text) {
  const lines = text.split(/\r?\n/).map(cookieFromLine).filter(Boolean);
  if (!lines.length) throw new Error('ยังไม่ได้วาง cookie');
  if (lines.length > 200) throw new Error('วางได้ครั้งละไม่เกิน 200 บรรทัด');
  const acc = loadAccounts(), added = [], bad = [];
  for (let i = 0; i < lines.length; i++) {
    const c = lines[i];
    if (c.length < 100) { bad.push(`บรรทัด ${i + 1}: cookie สั้นเกินไป`); continue; }
    try {
      const me = await whoAmI(c);
      for (const k of Object.keys(acc)) if (k.toLowerCase() === me.name.toLowerCase()) delete acc[k];
      acc[me.name] = { cookie: c, id: me.id, added: Date.now() };
      avatarCache.delete(me.name.toLowerCase());
      added.push(me.name); log('เพิ่มไอดี ' + me.name);
    } catch (e) { bad.push(`บรรทัด ${i + 1}: ${e.message}`); }
    if (i < lines.length - 1) await new Promise((r) => setTimeout(r, 400)); // ไม่ยิง Roblox ถี่เกิน
  }
  if (added.length) saveAccounts(acc);
  const msg = (added.length ? `เพิ่ม ${added.length} ไอดีแล้ว` + (added.length <= 3 ? ` (${added.join(', ')})` : '') : 'ไม่ได้เพิ่มไอดี') + (bad.length ? ` · ไม่ผ่าน ${bad.length}` : '');
  return { ok: added.length > 0, msg, added, bad };
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
// ---------- หน้าจอควบคุม (เปิดเป็นหน้าต่างบนคอม เฉพาะเครื่องนี้) ----------
const UI_TOKEN = crypto.randomBytes(24).toString('hex'); // สุ่มใหม่ทุกครั้งที่เปิดโปรแกรม
const FLEET = process.env.FLEET_URL || 'http://127.0.0.1:8800';
let cpuPrev = os.cpus(), cpuPct = 0;
setInterval(() => { const c = os.cpus(); let idle = 0, tot = 0; c.forEach((x, i) => { const p = cpuPrev[i] && cpuPrev[i].times; if (!p) return; for (const k in x.times) tot += x.times[k] - p[k]; idle += x.times.idle - p.idle; }); cpuPct = tot ? Math.round((1 - idle / tot) * 100) : 0; cpuPrev = c; }, 3000).unref();
setInterval(() => { const m = perfCfg().trimMin; if (m > 0 && Date.now() - trimStat.at >= m * 60e3 && robloxPids().length) trimRam(); }, 60e3).unref();
function tail(file, n) { try { return fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).slice(-n).reverse(); } catch (e) { return []; } }
function readRejoin() { try { return JSON.parse(fs.readFileSync(REJOIN_FILE, 'utf8')); } catch (e) { return {}; } }
function writeRejoin(c) { const t = REJOIN_FILE + '.tmp'; fs.writeFileSync(t, JSON.stringify(c, null, 2)); fs.renameSync(t, REJOIN_FILE); }
async function uiState() {
  const acc = loadAccounts(), cfg = readRejoin();
  let fleet = null, fleetErr = '';
  // ตัวขาย: ผู้ซื้อไม่มีเซิร์ฟเวอร์ Fleet (และบนคอมร้าน 127.0.0.1:8800 คือเซิร์ฟเวอร์ของร้าน ห้ามแตะ) → ใช้เปิดเกม/รีจอยด้วยมือได้อย่างเดียว
  let script = null;
  if (LIC.enabled) { // ตัวขาย: ข้อมูลไอดีของคีย์นี้จากเซิร์ฟเวอร์ร้าน (ห้ามแตะเซิร์ฟเวอร์ Fleet ในเครื่อง)
    const r = await LIC.status(perfCfg());
    if (r.v) {
      fleet = { serverTime: r.v.serverTime, afterMin: cfg.afterMin || 5, enabled: !!cfg.enabled, exclude: cfg.exclude || [],
        accounts: (r.v.accounts || []).map((a) => Object.assign({}, a, { last: a.last + Math.round((Date.now() - r.at) / 1000), rejoin: sellRj.get(a.name.toLowerCase()) ? { n: sellRj.get(a.name.toLowerCase()).n, ago: Math.round((Date.now() - sellRj.get(a.name.toLowerCase()).at) / 1000) } : null })) };
      script = { loader: `getgenv().SLAYER_KEY = "${r.v.token}"\nloadstring(game:HttpGet("${LIC.server}/script.lua"))()`, max: r.v.maxAccounts };
    }
    if (r.err) fleetErr = r.err;
  } else try {
    const r = await fetch(FLEET + '/api/v1/launcher/status', { headers: { Authorization: 'Bearer ' + (cfg.password || '') }, signal: AbortSignal.timeout(5000) });
    if (r.ok) { fleet = await r.json(); const pl = fleet.publicLink; if (pl && pl.ok === false) fleetErr = 'ลิงก์สาธารณะ ' + pl.url + ' ใช้ไม่ได้ · สคริปต์ในเกมส่งข้อมูลไม่ได้ จึงหยุดรีจอยไว้ · วิธีแก้: เปิดโปรแกรม Tailscale (ถาดไอคอนมุมขวาล่าง) ให้ล็อกอินอยู่ แล้วดับเบิลคลิก start-funnel.bat'; } else fleetErr = 'เซิร์ฟเวอร์ Fleet ตอบ ' + r.status + (r.status === 401 ? ' · รหัสไม่ตรงกัน: แอปนี้ใช้โฟลเดอร์ ' + APP + ' ต้องเปิด start-cloud.bat จากโฟลเดอร์เดียวกัน (ถ้าเพิ่งเปิดแอป ปิดหน้าต่างเซิร์ฟเวอร์แล้วเปิด start-cloud.bat ใหม่)' : '');
  } catch (e) { fleetErr = 'ต่อเซิร์ฟเวอร์ Fleet ไม่ได้ (เปิด start-cloud.bat อยู่หรือเปล่า)'; }
  const procs = robloxProcs(), pids = procs.map((p) => p.pid), owner = new Map([...pidOf].map(([n, p]) => [p, n]));
  const known = Object.fromEntries(Object.entries(acc).map(([n, a]) => [n, a.id]));
  const names = [...new Set(Object.keys(acc).concat(((fleet && fleet.accounts) || []).map((a) => a.name)))];
  refreshAvatars(known, names); // ทำเบื้องหลัง รอบถัดไปได้รูป
  const avatars = {}; for (const n of names) { const c = avatarCache.get(n.toLowerCase()); if (c && c.url) avatars[n.toLowerCase()] = c.url; }
  return {
    launcher: Object.entries(acc).map(([n, a]) => ({ name: n, id: a.id, lastLaunch: a.lastLaunch || null, window: pidOf.has(n.toLowerCase()) && pids.includes(pidOf.get(n.toLowerCase())), busy: busy.has(n.toLowerCase()) })),
    fleet, fleetErr, avatars, script, icons: itemIcons(),
    games: (() => { const ids = savedGames(cfg); refreshGames(ids); return ids.map((id) => ({ id, name: (gameCache[id] && gameCache[id].name) || null, icon: (gameCache[id] && gameCache[id].icon) || null })); })(), version: appVersion(), license: LIC.enabled ? LIC.state() : null,
    cfg: { eco: !!cfg.eco, enabled: !!cfg.enabled, afterMin: cfg.afterMin || 5, exclude: cfg.exclude || [], placeId: Number(cfg.placeId) || DEFAULT_PLACE, gameMode: cfg.gameMode === 'per' ? 'per' : 'shared', places: cfg.places || {}, perf: perfCfg() },
    sys: { multi: multiOk, cpu: cpuPct, ramUsed: os.totalmem() - os.freemem(), ramTotal: os.totalmem(), roblox: pids.length, win: IS_WIN,
      procs: procs.map((p) => ({ pid: p.pid, mb: p.mb, name: owner.get(p.pid) || null })), trim: { at: trimStat.at || null, freedMb: trimStat.freedMb, todayMb: trimStat.dayKey === new Date().toDateString() ? trimStat.dayMb : 0 } },
    log: tail(LOG, 40).concat(tail(path.join(DATA_DIR, 'rejoin.log'), 40).map((l) => l + '  [เซิร์ฟเวอร์]')).sort().reverse().slice(0, 50),
  };
}
async function uiAction(p, j) {
  const name = typeof j.name === 'string' ? j.name : '';
  if (p === '/ui/rejoin') { await launch(name, placeFor(name)); return { ok: true, msg: 'กำลังเปิด ' + name }; }
  if (p === '/ui/rejoin-offline') {
    const st = await uiState(), have = new Set(st.launcher.map((x) => x.name.toLowerCase())), after = st.cfg.afterMin * 60;
    const off = ((st.fleet && st.fleet.accounts) || []).filter((a) => a.last > after && have.has(a.name.toLowerCase())).map((a) => a.name);
    const gap = perfCfg().staggerSec;
    (async () => { for (const n of off) { try { await launch(n, placeFor(n)); } catch (e) { log(n + ': ' + e.message); } await new Promise((r) => setTimeout(r, gap * 1000)); } })();
    return { ok: true, msg: off.length ? `กำลังเปิดใหม่ ${off.length} ไอดี (ห่างกันตัวละ ${gap} วิ)` : 'ไม่มีไอดีที่หลุดอยู่' };
  }
  if (p === '/ui/trim') return trimRam();
  // ปุ่มเดียวลดแรม: ย่อหน้าต่าง Roblox ทั้งหมด แล้วคืน RAM ทันที
  if (p === '/ui/boost') {
    if (!IS_WIN) return { ok: true, msg: 'ใช้ได้บน Windows เท่านั้น' };
    const ps = robloxPids(); await minimizePids(ps); const r = await trimRam();
    return { ok: true, msg: ps.length ? `ลดแรมแล้ว: ย่อ ${ps.length} หน้าต่าง · คืน RAM ได้ ${r.freed || 0} MB` : 'ไม่มีหน้าต่าง Roblox เปิดอยู่' };
  }
  // โหมดประหยัดสุด: ตั้งทุกอย่างให้กินเครื่องน้อยที่สุด (ปิดแล้วกลับเป็นค่าเดิม)
  if (p === '/ui/eco') {
    const c = readRejoin(), cur = Object.assign({}, PERF_DEF, c.perf || {});
    if (j.on) {
      if (!c.ecoPrev) c.ecoPrev = { no3d: cur.no3d, lowGfx: cur.lowGfx, fps: cur.fps, trimMin: cur.trimMin, minimize: cur.minimize };
      c.perf = Object.assign(cur, { no3d: true, lowGfx: true, fps: 15, trimMin: 10, minimize: true }); c.eco = true;
    } else { c.perf = Object.assign(cur, c.ecoPrev || {}); delete c.ecoPrev; c.eco = false; }
    writeRejoin(c);
    if (j.on && IS_WIN) { const ps = robloxPids(); await minimizePids(ps); trimRam().catch(() => {}); }
    return { ok: true, msg: j.on ? 'เปิดโหมดประหยัดสุดแล้ว · ในเกมมีผลภายใน ~20 วิ' : 'ปิดโหมดประหยัดสุด กลับเป็นค่าเดิมแล้ว' };
  }
  if (p === '/ui/game-add') {
    const m = String(j.place || '').match(/(?:games\/)?(\d{5,20})/), id = m ? Number(m[1]) : 0;
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error('ใส่เลข Place ID หรือวางลิงก์ roblox.com/games/...');
    const g = await gameInfo(id, true).catch((e) => { throw new Error('หาเกมไม่เจอ: ' + e.message); });
    const c = readRejoin(); c.games = savedGames(c); if (!c.games.includes(id)) c.games.push(id); if (j.select) c.placeId = id; writeRejoin(c);
    return { ok: true, msg: 'เพิ่ม ' + g.name + ' แล้ว' };
  }
  if (p === '/ui/game-remove') {
    const id = Number(j.place), c = readRejoin();
    if (id === (Number(c.placeId) || DEFAULT_PLACE)) throw new Error('เกมนี้เลือกใช้อยู่ เลือกเกมอื่นก่อนแล้วค่อยลบ');
    c.games = savedGames(c).filter((x) => x !== id); writeRejoin(c); return { ok: true, msg: 'ลบเกมแล้ว' };
  }
  if (p === '/ui/minimize') { const ps = robloxPids(); await minimizePids(ps); return { ok: true, msg: IS_WIN ? `ย่อหน้าต่าง Roblox ${ps.length} อันแล้ว` : 'ใช้ได้บน Windows เท่านั้น' };
  }
  if (p === '/ui/close') { const k = killOld(name); return { ok: k, msg: k ? 'ปิด Roblox ของ ' + name + ' แล้ว' : 'ไม่รู้ว่าหน้าต่างไหนเป็นของ ' + name + ' (เปิดก่อนโปรแกรมนี้)' }; }
  if (p === '/ui/add') return importCookies(String(j.cookie || ''));
  if (p === '/ui/quit') { log('ปิดโปรแกรมจากหน้าจอควบคุม (หยุดรีจอย)'); setTimeout(() => (EMBED && EMBED.onQuit ? EMBED.onQuit() : process.exit(0)), 400); return { ok: true, msg: 'ปิดโปรแกรมแล้ว' }; }
  if (p === '/ui/remove') { const acc = loadAccounts(), k = Object.keys(acc).find((x) => x.toLowerCase() === name.toLowerCase()); if (!k) throw new Error('ไม่มีไอดีนี้'); delete acc[k]; saveAccounts(acc); log('ลบไอดี ' + k); return { ok: true, msg: 'ลบ ' + k + ' แล้ว' }; }
  if (p === '/ui/check') { const acc = loadAccounts(), out = {}; for (const [n, a] of Object.entries(acc)) { try { await whoAmI(a.cookie); out[n] = 'ok'; } catch (e) { out[n] = e.message; } } return { ok: true, result: out }; }
  if (p === '/ui/settings') {
    const c = readRejoin();
    if ('enabled' in j) c.enabled = !!j.enabled;
    if ('afterMin' in j) { const n = Number(j.afterMin); if (!(n >= 2 && n <= 120)) throw new Error('นาทีต้องอยู่ระหว่าง 2-120'); c.afterMin = n; }
    if ('gameMode' in j) c.gameMode = j.gameMode === 'per' ? 'per' : 'shared';
    if ('accPlace' in j && /^[A-Za-z0-9_]{3,20}$/.test(name)) {
      const n = Number(j.accPlace), m = Object.assign({}, c.places || {});
      if (!j.accPlace) delete m[name.toLowerCase()]; else if (Number.isSafeInteger(n) && n > 0) m[name.toLowerCase()] = n; else throw new Error('Place ID ต้องเป็นตัวเลข');
      c.places = m;
    }
    if ('placeId' in j) { const n = Number(j.placeId); if (!(Number.isSafeInteger(n) && n > 0)) throw new Error('Place ID ต้องเป็นตัวเลข'); c.placeId = n; }
    if (j.perf && typeof j.perf === 'object') {
      const q = j.perf, cur = Object.assign({}, PERF_DEF, c.perf || {}), num = (v, lo, hi, what) => { const n = Number(v); if (!(Number.isInteger(n) && n >= lo && n <= hi)) throw new Error(what + ` ต้องอยู่ระหว่าง ${lo}-${hi}`); return n; };
      for (const k of ['no3d', 'lowGfx', 'minimize']) if (k in q) cur[k] = !!q[k];
      if ('fps' in q) cur.fps = Number(q.fps) === 0 ? 0 : num(q.fps, 5, 240, 'FPS');
      if ('trimMin' in q) cur.trimMin = Number(q.trimMin) === 0 ? 0 : num(q.trimMin, 2, 120, 'นาที');
      if ('staggerSec' in q) cur.staggerSec = num(q.staggerSec, 5, 120, 'วินาที');
      if ('except' in q && /^[A-Za-z0-9_]{3,20}$/.test(name)) { const ex = new Set((cur.except || []).map((x) => x.toLowerCase())); if (q.except) ex.add(name.toLowerCase()); else ex.delete(name.toLowerCase()); cur.except = [...ex]; }
      c.perf = cur;
    }
    if ('auto' in j && /^[A-Za-z0-9_]{3,20}$/.test(name)) { const ex = new Set((c.exclude || []).map((x) => x.toLowerCase())); if (j.auto) ex.delete(name.toLowerCase()); else ex.add(name.toLowerCase()); c.exclude = [...ex]; }
    writeRejoin(c); return { ok: true, msg: 'บันทึกแล้ว' };
  }
  throw new Error('not found');
}
function openWindow(url) {
  if (!IS_WIN) { console.log('เปิดหน้าจอที่: ' + url); return; }
  const edge = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find((f) => fs.existsSync(f));
  // หน้าต่างแอปแยก ใช้โปรไฟล์ Edge ของตัวเอง: ไม่มีส่วนขยาย/แถบแปลภาษา/ป๊อปอัปของ Edge ปกติ และมีไอคอนแยกบน taskbar
  const prof = path.join(STORE_DIR, 'ui-profile');
  if (edge) spawn(edge, ['--app=' + url, '--user-data-dir=' + prof, '--window-size=1360,880', '--no-first-run', '--no-default-browser-check', '--disable-sync',
    '--hide-crash-restore-bubble', '--disable-features=Translate,msEdgeTranslate,msUndersideButton,msEdgeSidebarV2,EdgeShoppingAssistant,msShowSidebar', '--lang=th'], { detached: true, stdio: 'ignore' }).unref();
  else spawn('cmd', ['/c', 'start', '""', url], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
}
// ---------- รีจอยอัตโนมัติของตัวขาย (ผู้ซื้อไม่มีเซิร์ฟเวอร์ Fleet ในเครื่อง: แอปดูสถานะจากเซิร์ฟเวอร์ร้านแล้วเปิดเกมเอง) ----------
const sellRj = new Map(); // ชื่อ -> { n, at, nextAt }
async function sellRejoinTick() {
  if (!LIC.enabled || !LIC.ok()) return;
  const cfg = readRejoin(); if (!cfg.enabled) return;
  const r = await LIC.status(perfCfg()); if (!r.v) return;
  const acc = loadAccounts(), have = new Map(Object.keys(acc).map((k) => [k.toLowerCase(), k]));
  const after = Math.max(2, Number(cfg.afterMin) || 5) * 60, skip = new Set((cfg.exclude || []).map((x) => String(x).toLowerCase()));
  const lag = Math.round((Date.now() - r.at) / 1000), t = Date.now() / 1000;
  for (const a of r.v.accounts || []) {
    const k = a.name.toLowerCase(), silent = Math.min(a.last, a.liveAgo == null ? a.last : a.liveAgo) + lag;
    if (silent < after) { if (sellRj.has(k)) { log(a.name + ' กลับมาออนไลน์แล้ว'); sellRj.delete(k); } continue; }
    if (!have.has(k) || skip.has(k) || busy.has(k) || silent > 12 * 3600) continue;
    const s2 = sellRj.get(k) || { n: 0, at: 0, nextAt: 0 };
    if (t < s2.nextAt) continue;
    s2.n++; s2.at = t; s2.nextAt = t + Math.min(10, 5 * Math.pow(2, s2.n - 1)) * 60; sellRj.set(k, s2);
    log(`${a.name} เงียบ ${Math.round(silent / 60)} นาที -> เปิดเกมใหม่ (ครั้งที่ ${s2.n})`);
    try { await launch(have.get(k), placeFor(have.get(k))); } catch (e) { log(a.name + ': ' + e.message); }
    await new Promise((res) => setTimeout(res, perfCfg().staggerSec * 1000));
  }
}
let sellBusy = false;
setInterval(() => { if (sellBusy) return; sellBusy = true; sellRejoinTick().catch((e) => log('รีจอยอัตโนมัติผิดพลาด: ' + e.message)).finally(() => { sellBusy = false; }); }, 60e3).unref();

// opts.embedded = รันอยู่ในแอป FleetLauncher.exe (Electron): แอปเปิดหน้าต่างเอง ไม่ใช้ Edge และไม่ปิดโปรเซสเองตอนเริ่มไม่สำเร็จ
let EMBED = null;
function serve(opts) {
  EMBED = opts && opts.embedded ? opts : null;
  const cfg = ensureRejoinCfg();
  LIC.start();
  holdMultiRoblox();
  const UI_FILE = path.join(__dirname, 'ui.html');
  const srv = http.createServer(async (req, res) => {
    const send = (code, text, type) => { res.writeHead(code, { 'Content-Type': type || 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer' }); res.end(text); };
    try {
      const u = new URL(req.url, 'http://127.0.0.1');
      // หน้าจอควบคุม: ต้องเปิดจากเครื่องนี้ (Host) + มีโทเคนที่สุ่มตอนเปิดโปรแกรม (กันเว็บอื่นแอบสั่ง)
      if (u.pathname === '/' || u.pathname.startsWith('/ui/')) {
        if (!/^(127\.0\.0\.1|localhost):7963$/.test(req.headers.host || '')) return send(403, 'forbidden');
        if (u.pathname === '/') {
          if (!safeEq(u.searchParams.get('t') || '', UI_TOKEN)) return send(401, 'ดับเบิลคลิก launcher.bat เพื่อเปิดหน้าจอควบคุม');
          return send(200, fs.readFileSync(UI_FILE, 'utf8'), 'text/html; charset=utf-8');
        }
        if (!safeEq(req.headers['x-fleet-token'] || '', UI_TOKEN)) return send(401, '{"error":"unauthorized"}', 'application/json');
        const locked = LIC.enabled && !LIC.ok();
        if (u.pathname === '/ui/state' && req.method === 'GET') return send(200, JSON.stringify(locked ? { locked: true, license: LIC.state(), version: appVersion() } : await uiState()), 'application/json');
        if (req.method !== 'POST') return send(405, '{}', 'application/json');
        let body = ''; for await (const ch of req) { body += ch; if (body.length > 400000) return send(413, '{}', 'application/json'); }
        let j = {}; try { j = JSON.parse(body || '{}'); } catch (e) { return send(400, '{"error":"bad json"}', 'application/json'); }
        // คีย์ใช้งาน: ใส่คีย์ / ถอดคีย์ออกจากเครื่องนี้ · ระหว่างยังไม่มีคีย์ใช้ได้แค่ปุ่มปิดโปรแกรม
        if (u.pathname === '/ui/license') { const r = await LIC.activate(String(j.key || '')); return send(r.ok ? 200 : 400, JSON.stringify(r), 'application/json'); }
        if (u.pathname === '/ui/license-out') return send(200, JSON.stringify(await LIC.deactivate()), 'application/json');
        if (locked && u.pathname !== '/ui/quit') return send(403, JSON.stringify({ ok: false, error: LOCKED_MSG, locked: true }), 'application/json');
        try { return send(200, JSON.stringify(await uiAction(u.pathname, j && typeof j === 'object' ? j : {})), 'application/json'); }
        catch (e) { return send(400, JSON.stringify({ ok: false, error: e.message }), 'application/json'); }
      }
      // คำสั่งจากเซิร์ฟเวอร์ Fleet (แบบเดียวกับ RAM)
      const pw = rejoinPw();
      if (!pw || !safeEq(u.searchParams.get('Password') || '', pw)) return send(401, 'รหัสไม่ถูกต้อง');
      if (u.pathname === '/OpenUI') { if (EMBED && EMBED.onOpenUI) EMBED.onOpenUI(); else openWindow(`http://127.0.0.1:${PORT}/?t=${UI_TOKEN}`); return send(200, 'ok'); } // กด launcher.bat ซ้ำ
      if (u.pathname === '/GetAccounts') return send(200, Object.keys(loadAccounts()).join(','));
      if (u.pathname === '/LaunchAccount') {
        if (!LIC.ok()) return send(403, LOCKED_MSG);
        const name = u.searchParams.get('Account') || '';
        const place = readRejoin().gameMode === 'per' ? placeFor(name) : (Number(u.searchParams.get('PlaceId')) || placeOf());
        if (!/^[A-Za-z0-9_]{3,20}$/.test(name) || !(place > 0)) return send(400, 'ข้อมูลไม่ถูกต้อง');
        const k = await launch(name, place);
        return send(200, 'กำลังเปิด ' + k);
      }
      send(404, 'not found');
    } catch (e) { log('ผิดพลาด: ' + e.message); send(500, e.message); }
  });
  srv.on('error', async (e) => {
    if (EMBED) { log(e.code === 'EADDRINUSE' ? `พอร์ต ${PORT} ถูกใช้อยู่ (ตัวเปิดเกมแบบเก่า หรือ Roblox Account Manager เปิดอยู่)` : 'เริ่มทำงานไม่ได้: ' + e.message); return EMBED.onError && EMBED.onError(e); }
    if (e.code === 'EADDRINUSE') {
      // มีตัวเปิดเกมทำงานอยู่แล้ว: บอกให้ตัวนั้นเปิดหน้าจอแทน แล้วตัวนี้ปิดไป
      try {
        const r = await fetch(`http://127.0.0.1:${PORT}/OpenUI?Password=${encodeURIComponent(rejoinPw())}`, { signal: AbortSignal.timeout(4000) });
        if (r.ok) { console.log('ตัวเปิดเกมทำงานอยู่แล้ว เปิดหน้าจอให้แล้ว'); process.exit(0); }
      } catch (x) {}
      log(`พอร์ต ${PORT} ถูกใช้อยู่ (Roblox Account Manager เปิดอยู่หรือเปล่า) ปิดตัวนั้นก่อน`);
    } else log('เริ่มทำงานไม่ได้: ' + e.message);
    process.exit(1);
  });
  srv.listen(PORT, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${PORT}/?t=${UI_TOKEN}`;
    log('เริ่มทำงาน (เบื้องหลัง) · ปิดได้จากปุ่ม "ปิดโปรแกรม" ในหน้าจอควบคุม');
    console.log(`\n===== Fleet Launcher ทำงานแล้ว =====`);
    console.log(`ไอดีที่รีจอยได้ ${Object.keys(loadAccounts()).length} ตัว · รีจอยเมื่อเงียบเกิน ${cfg.afterMin || 5} นาที`);
    console.log('หน้าจอควบคุมเปิดให้แล้ว (ถ้าปิดไป ก๊อปลิงก์นี้ไปเปิดในเบราว์เซอร์): ' + url + '\n');
    if (EMBED) { if (EMBED.onReady) EMBED.onReady(url); }
    else if (!process.env.FLEET_NO_WINDOW) openWindow(url);
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
  // ทำงานเบื้องหลังไม่มีหน้าต่างดำ: error ที่ไม่คาดคิดเขียนลงบันทึกแทน (ดูในหน้า "บันทึกการทำงาน")
  process.on('uncaughtException', (e) => { log('ผิดพลาด: ' + (e && e.message)); });
  process.on('unhandledRejection', (e) => { log('ผิดพลาด: ' + (e && e.message)); });
  if (a === 'menu') menu(); else serve(); // ปกติเปิดหน้าจอควบคุมเลย · launcher.bat menu = เมนูตัวอักษรแบบเดิม
}
module.exports = { launchUri, authTicket, whoAmI, launch, loadAccounts, saveAccounts, serve, UI_TOKEN };

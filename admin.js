'use strict';
// เครื่องมือแอดมิน (ไม่ต้องหยุดเซิร์ฟเวอร์ ระบบอ่านไฟล์ใหม่เองภายในไม่กี่วินาที)
//   node admin.js mode owner|key           สลับโหมด
//   node admin.js owner-script --url URL   สร้างสคริปต์ของเจ้าของ (โหมด owner, ใช้ตัวเดียวทุกไอดี)
//   node admin.js add "ชื่อลูกค้า" --days 30 [--max 50] [--accounts a,b,c] --url URL
//   node admin.js assign <id> a,b,c        เพิ่มไอดีในเกมให้ลูกค้า     node admin.js unassign <id> a,b
//   node admin.js setpass <id> [--pass รหัส]  ตั้งรหัสผ่านเข้าเว็บของลูกค้า (ไม่ใส่ = สุ่มให้)
//   node admin.js links --url URL          แสดงลิงก์ลูกค้าทุกคน (ใช้ตอนลิงก์เซิร์ฟเวอร์เปลี่ยน)
//   node admin.js rejoin show | set key=value ... | test | log   ตั้งค่ารีจอยอัตโนมัติผ่าน Roblox Account Manager
//   node admin.js backup now | list | restore <ชื่อ>   สำรอง/กู้ข้อมูล (กู้ต้องปิดเซิร์ฟเวอร์ก่อน)
//   node admin.js adminpass [--pass รหัส]   ตั้งรหัสเข้าหน้าแอดมินบนเว็บ (/admin) ไม่ใส่ = สุ่มให้
//   node admin.js seen                     ไอดีที่ส่งข้อมูลเข้ามา และเป็นของใคร
//   node admin.js list | renew <id> --days 30 | revoke <id> | unrevoke <id> | rotate <id> --url URL | remove <id>
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.CLOUD_DATA_DIR || path.join(__dirname, 'data');
const FILE = path.join(DATA_DIR, 'customers.json');
const SETTINGS = path.join(DATA_DIR, 'settings.json');
const SCRIPTS = path.join(DATA_DIR, 'scripts');
fs.mkdirSync(DATA_DIR, { recursive: true });

const [cmd, ...rest] = process.argv.slice(2);
const opt = (n, d) => { const i = rest.indexOf('--' + n); return i >= 0 ? rest[i + 1] : d; };
const pos = rest.filter((a, i) => !a.startsWith('--') && !(i > 0 && rest[i - 1].startsWith('--')));
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return d; } };
const writeJson = (f, j) => { const t = f + '.tmp'; fs.writeFileSync(t, JSON.stringify(j, null, 2)); fs.renameSync(t, f); };
const fmt = (e) => (e ? new Date(e * 1000).toLocaleString('th-TH') : 'ไม่หมดอายุ');
const die = (m) => { console.error(m); process.exit(1); };
const need = (j, id) => { if (!id || !j[id]) die('ไม่พบลูกค้า id: ' + id); return j[id]; };
const baseUrl = () => {
  const b = (opt('url') || process.env.PUBLIC_URL || '').replace(/\/+$/, '');
  if (!b) die('ต้องระบุที่อยู่เซิร์ฟเวอร์: --url https://...');
  return b;
};
const NAME_RE = /^[A-Za-z0-9_]{3,20}$/; // ชื่อผู้ใช้ Roblox
const parseNames = (s) => {
  const out = [], bad = [];
  for (const n of String(s || '').split(/[\s,]+/).filter(Boolean)) (NAME_RE.test(n) ? out : bad).push(n);
  if (bad.length) console.log('ข้ามชื่อที่ไม่ใช่ชื่อผู้ใช้ Roblox: ' + bad.join(', '));
  return out;
};

const settings = readJson(SETTINGS, {});
if (settings.mode !== 'key') settings.mode = 'owner';
const saveSettings = () => writeJson(SETTINGS, settings);
const j = readJson(FILE, {});
const save = () => writeJson(FILE, j);

const newKey = (p) => p + crypto.randomBytes(24).toString('hex');
// รหัสผ่านเข้าเว็บ (ของร้าน ไม่ใช่รหัส Roblox) เก็บแบบแฮช scrypt
const genPass = () => { const a = 'abcdefghjkmnpqrstuvwxyz23456789'; let o = ''; for (const b of crypto.randomBytes(8)) o += a[b % a.length]; return o.slice(0, 4) + '-' + o.slice(4); };
const hashPass = (pw) => { const salt = crypto.randomBytes(16); return salt.toString('hex') + ':' + crypto.scryptSync(pw, salt, 32).toString('hex'); };

function writeScript(fileName, base, deviceKey, interval) {
  let t;
  try { t = fs.readFileSync(path.join(__dirname, 'script_template.lua'), 'utf8'); } catch (e) { return null; }
  t = t.replace(/local WEB_API_URL = "[^"]*"/, `local WEB_API_URL = "${base}/api/v1/ingest"`)
       .replace(/local WEB_API_KEY = "[^"]*"/, `local WEB_API_KEY = "${deviceKey}"`)
       .replace(/local INTERVAL = \d+/, `local INTERVAL = ${interval}`)
       .replace(/local WEBHOOK_URL = "[^"]*"/, 'local WEBHOOK_URL = "" -- (ไม่บังคับ) ใส่ลิงก์ Discord webhook ถ้าอยากได้แจ้งเตือนในดิสคอร์ดด้วย');
  fs.mkdirSync(SCRIPTS, { recursive: true });
  const file = path.join(SCRIPTS, fileName);
  fs.writeFileSync(file, t);
  return file;
}
const removeCustomerScripts = (id) => { try { for (const f of fs.readdirSync(SCRIPTS)) if (f.endsWith('-' + id + '.lua')) fs.unlinkSync(path.join(SCRIPTS, f)); } catch (e) {} };
const reveal = (file) => {
  if (file && process.platform === 'win32') { try { require('child_process').spawn('explorer', ['/select,', file], { detached: true, stdio: 'ignore' }).unref(); } catch (e) {} }
};
const link = (base, c) => (c.view ? `${base}/v#${c.view}` : '(ลูกค้าที่สร้างก่อนอัปเดตนี้ แสดงลิงก์ซ้ำไม่ได้ ใช้ออกคีย์ใหม่หนึ่งครั้ง)');

function showCustomer(id, c, deviceKey) {
  const base = baseUrl();
  console.log(`\nลูกค้า: ${c.name}   id: ${id}`);
  console.log(`หมดอายุ: ${fmt(c.expires)}`);
  if (settings.mode === 'owner') {
    console.log('ไอดีที่ลูกค้าคนนี้เห็น: ' + ((c.accounts || []).join(', ') || '(ยังไม่มี ใช้เมนูกำหนดไอดี)'));
    console.log('\n======== ส่งให้ลูกค้า (ทางแชทส่วนตัว ห้ามโพสต์สาธารณะ) ========');
    console.log('เว็บ: ' + base);
    console.log('เข้าสู่ระบบด้วย: ชื่อผู้ใช้ Roblox ของไอดีเขา (' + ((c.accounts || [])[0] || 'ยังไม่ได้กำหนดไอดี') + ' หรือไอดีอื่นของเขา)');
    if (c._pw) console.log('รหัสผ่าน: ' + c._pw + '   (จดไว้ ระบบเก็บแบบแฮช แสดงซ้ำไม่ได้)');
    console.log('\nหรือส่งลิงก์ตรง (ไม่ต้องล็อกอิน):\n' + link(base, c) + '\n');
    return;
  }
  removeCustomerScripts(id);
  const safe = String(c.name).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 40) || 'customer';
  const file = writeScript(`${safe}-${id}.lua`, base, deviceKey, 60);
  const code = 'SFA1.' + Buffer.from(JSON.stringify({ u: base, k: deviceKey, v: c.view })).toString('base64url');
  console.log(`จำนวนไอดีสูงสุด: ${c.maxAccounts}`);
  console.log('\n======== ส่งให้ลูกค้า 2 อย่าง (ทางแชทส่วนตัว ห้ามโพสต์สาธารณะ) ========');
  console.log('1) ไฟล์สคริปต์ (ลูกค้าวางใน executor แล้วรัน):\n   ' + (file || '(ไม่พบ script_template.lua)'));
  console.log('\n2) ลิงก์ดูข้อมูล (เปิดได้ทั้งมือถือและคอม):\n' + link(base, c));
  console.log('\n(ไม่จำเป็น) รหัสสำหรับลูกค้าที่ใช้แอปบนคอม:\n' + code + '\n');
  reveal(file);
}

if (cmd === 'mode') {
  const m = pos[0];
  if (m !== 'owner' && m !== 'key') die('ใช้: mode owner หรือ mode key');
  settings.mode = m; saveSettings();
  console.log(m === 'owner'
    ? 'เปลี่ยนเป็นโหมดเจ้าของรันเอง: ใช้สคริปต์ของคุณตัวเดียวทุกไอดี แล้วกำหนดไอดีให้ลูกค้าแต่ละคน ลูกค้าดูได้อย่างเดียว'
    : 'เปลี่ยนเป็นโหมดคีย์: ลูกค้าแต่ละคนได้สคริปต์ของตัวเอง ไอดีที่รันด้วยสคริปต์นั้นจะขึ้นในหน้าของเขา');
} else if (cmd === 'owner-script') {
  const base = baseUrl();
  const key = newKey('sfd_');
  const every = Number(opt('interval', 120));
  settings.ownerHash = sha(key); saveSettings();
  const file = writeScript('OWNER-SCRIPT.lua', base, key, every);
  fs.mkdirSync(SCRIPTS, { recursive: true });
  const loader = path.join(SCRIPTS, 'OWNER-LOADER.lua');
  fs.writeFileSync(loader, `-- Slayer Fleet: ตัวโหลดอัตโนมัติ (ดึงสคริปต์เวอร์ชันล่าสุดจากเซิร์ฟเวอร์ทุกครั้งที่รัน) ห้ามส่งให้ใคร\ngetgenv().SLAYER_KEY = "${key}"\nloadstring(game:HttpGet("${base}/script.lua"))()\n`);
  console.log('\nสร้างสคริปต์ของคุณแล้ว (ถ้าเคยสร้างไว้ ตัวเก่าใช้ไม่ได้แล้ว)');
  console.log('แนะนำ: ' + loader);
  console.log('   ตัวโหลดสั้น 3 บรรทัด ดึงสคริปต์ล่าสุดจากเซิร์ฟเวอร์เองทุกครั้ง อัปเดตแล้วไม่ต้องก๊อปใหม่');
  console.log('แบบเต็ม: ' + file);
  console.log('ใช้ตัวเดียวกับทุกไอดี (ใส่ใน auto-execute ได้) ห้ามส่งให้ลูกค้า');
  console.log(`ส่งข้อมูลทุก ${every / 60} นาที\n`);
  reveal(loader);
} else if (cmd === 'add') {
  const name = pos[0]; if (!name) die('ต้องใส่ชื่อลูกค้า');
  const days = Number(opt('days', 30)); if (!isFinite(days)) die('--days ต้องเป็นตัวเลข');
  baseUrl();
  const id = crypto.randomBytes(4).toString('hex');
  const device = newKey('sfd_'), view = newKey('sfv_');
  const t = Math.floor(Date.now() / 1000);
  j[id] = { name, created: t, expires: Math.floor(t + days * 86400), maxAccounts: Number(opt('max', 50)), revoked: false,
    deviceHash: sha(device), viewHash: sha(view), view, accounts: [] };
  const pw = opt('pass') || genPass(); j[id].pass = hashPass(pw);
  const names = parseNames(opt('accounts', ''));
  for (const n of names) for (const o of Object.values(j)) if (o !== j[id]) o.accounts = (o.accounts || []).filter((x) => x.toLowerCase() !== n.toLowerCase());
  j[id].accounts = names;
  save(); showCustomer(id, Object.assign({ _pw: pw }, j[id]), device);
} else if (cmd === 'assign' || cmd === 'unassign') {
  const c = need(j, pos[0]);
  const names = parseNames(pos.slice(1).join(','));
  if (!names.length) die('ต้องใส่ชื่อไอดีในเกม');
  const cur = new Map((c.accounts || []).map((n) => [n.toLowerCase(), n]));
  if (cmd === 'assign') {
    for (const n of names) {
      for (const [oid, o] of Object.entries(j)) {
        if (oid !== pos[0] && (o.accounts || []).some((x) => x.toLowerCase() === n.toLowerCase())) {
          o.accounts = o.accounts.filter((x) => x.toLowerCase() !== n.toLowerCase());
          console.log(`ย้าย ${n} ออกจากลูกค้า ${o.name} (${oid})`); // ไอดีหนึ่งมีเจ้าของได้คนเดียว
        }
      }
      cur.set(n.toLowerCase(), n);
    }
  } else for (const n of names) cur.delete(n.toLowerCase());
  c.accounts = [...cur.values()]; save();
  console.log(`ไอดีของ ${c.name}: ` + (c.accounts.join(', ') || '(ไม่มี)'));
} else if (cmd === 'setpass') {
  const c = need(j, pos[0]);
  const pw = opt('pass') || genPass();
  if (pw.length < 4) die('รหัสผ่านต้องยาวอย่างน้อย 4 ตัว');
  c.pass = hashPass(pw); const v = newKey('sfv_'); c.view = v; c.viewHash = sha(v); save(); // เครื่องที่เคยล็อกอินไว้หลุดหมด
  console.log(`\nรหัสผ่านใหม่ของ ${c.name}: ${pw}`);
  console.log('ล็อกอินด้วยชื่อผู้ใช้ Roblox: ' + ((c.accounts || []).join(', ') || '(ยังไม่ได้กำหนดไอดี ใช้เมนูกำหนดไอดีก่อน)') + '\n');
} else if (cmd === 'rejoin') {
  const RF = path.join(DATA_DIR, 'rejoin.json');
  const cfg = readJson(RF, {});
  const sub = pos[0] || 'show';
  const showCfg = () => {
    console.log('\n===== รีจอยอัตโนมัติ (ผ่าน Roblox Account Manager) =====');
    console.log('สถานะ:            ' + (cfg.enabled ? 'เปิด' : 'ปิด') + (cfg.enabled ? '' : (cfg.discordWebhook ? '  (แจ้งเตือน Discord อย่างเดียว)' : '')));
    console.log('พอร์ต RAM:         ' + (cfg.port || 7963));
    console.log('รหัส Web Server:    ' + (cfg.password ? '(ตั้งไว้แล้ว)' : '(ไม่มี)'));
    console.log('ถือว่าหลุดหลังเงียบ: ' + (cfg.afterMin || 5) + ' นาที');
    console.log('Discord แจ้งเตือน:  ' + (cfg.discordWebhook ? '(ตั้งไว้แล้ว)' : '(ไม่มี)'));
    console.log('ไอดีที่ไม่ต้องรีจอย: ' + ((cfg.exclude || []).join(', ') || '(ไม่มี)'));
  };
  if (sub === 'show') showCfg();
  else if (sub === 'set') {
    for (const kv of pos.slice(1)) {
      const i = kv.indexOf('='); if (i < 0) continue;
      const k = kv.slice(0, i), v = kv.slice(i + 1);
      if (k === 'enabled') cfg.enabled = v === '1' || v === 'true' || v === 'on';
      else if (k === 'port') { if (!/^\d{2,5}$/.test(v)) die('พอร์ตต้องเป็นตัวเลข'); cfg.port = Number(v); }
      else if (k === 'password') { if (v && !/^[A-Za-z0-9]{6,}$/.test(v)) die('รหัส RAM ต้องเป็นตัวอักษร/ตัวเลข 6 ตัวขึ้นไป (ตามกติกาของ RAM)'); cfg.password = v || undefined; }
      else if (k === 'afterMin') { const n = Number(v); if (!(n >= 2 && n <= 120)) die('afterMin ต้องอยู่ระหว่าง 2-120'); cfg.afterMin = n; }
      else if (k === 'discord') { if (v && !/^https:\/\/(discord\.com|discordapp\.com|ptb\.discord\.com|canary\.discord\.com)\/api\/webhooks\/\d+\/[\w-]+$/.test(v)) die('ลิงก์ Discord webhook ไม่ถูกต้อง'); cfg.discordWebhook = v || undefined; }
      else if (k === 'exclude') cfg.exclude = parseNames(v);
      else if (k === 'placeId') { if (!/^\d+$/.test(v)) die('placeId ต้องเป็นตัวเลข'); cfg.placeId = Number(v); }
    }
    writeJson(RF, cfg); console.log('บันทึกแล้ว (เซิร์ฟเวอร์ใช้ค่าใหม่ภายใน 30 วินาที ไม่ต้องรีสตาร์ท)'); showCfg();
  } else if (sub === 'test') {
    const port = cfg.port || 7963;
    const u = `http://127.0.0.1:${port}/GetAccounts` + (cfg.password ? `?Password=${encodeURIComponent(cfg.password)}` : '');
    console.log('\nกำลังทดสอบต่อ Roblox Account Manager ที่พอร์ต ' + port + ' ...');
    fetch(u, { signal: AbortSignal.timeout(8000) }).then(async (r) => {
      const t = (await r.text()).trim();
      if (!r.ok) { console.log(`RAM ตอบกลับ ${r.status}: ${t.slice(0, 150)}`); console.log('เช็คใน RAM: เปิด Web Server, ติ๊ก Allow GetAccounts และ Allow LaunchAccount, รหัสตรงกัน'); process.exit(1); }
      const inRam = new Set(t.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean));
      console.log(`ต่อสำเร็จ RAM มีไอดี ${inRam.size} ตัว`);
      const pool = (readJson(path.join(DATA_DIR, 'data.json'), {}).__owner__) || {};
      const names = Object.keys(pool);
      if (!names.length) { console.log('(ยังไม่มีไอดีส่งข้อมูลเข้ามา จึงยังเทียบชื่อไม่ได้)'); return; }
      const miss = names.filter((n) => !inRam.has(n.toLowerCase()));
      console.log(`ไอดีที่ส่งข้อมูลเข้ามา ${names.length} ตัว รีจอยได้ ${names.length - miss.length} ตัว`);
      if (miss.length) console.log('*** ไม่มีใน RAM (รีจอยไม่ได้): ' + miss.join(', '));
    }).catch(() => { console.log('ต่อไม่ได้: เปิด Roblox Account Manager แล้วหรือยัง และเปิด Web Server ที่พอร์ต ' + port + ' หรือเปล่า'); process.exit(1); });
  } else if (sub === 'log') {
    let t = ''; try { t = fs.readFileSync(path.join(DATA_DIR, 'rejoin.log'), 'utf8'); } catch (e) {}
    const lines = t.trim().split('\n').filter(Boolean);
    console.log(lines.length ? '\n' + lines.slice(-15).join('\n') : 'ยังไม่มีประวัติรีจอย');
  }
} else if (cmd === 'backup') {
  const BK = path.join(DATA_DIR, '..', 'backups');
  const copyDir = (src, dst) => {
    fs.mkdirSync(dst, { recursive: true });
    for (const e of fs.readdirSync(src, { withFileTypes: true })) {
      if (/token/i.test(e.name)) continue; // ไม่เก็บ token GitHub ไว้ในไฟล์สำรอง
    const a = path.join(src, e.name), b = path.join(dst, e.name);
      if (e.isDirectory()) copyDir(a, b); else if (e.isFile()) fs.copyFileSync(a, b);
    }
  };
  const stamp = () => { const d = new Date(), z = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}${z(d.getSeconds())}`; };
  const list = () => { try { return fs.readdirSync(BK, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort().reverse(); } catch (e) { return []; } };
  const describe = (n) => {
    const c = readJson(path.join(BK, n, 'customers.json'), {}), d = readJson(path.join(BK, n, 'data.json'), {});
    const ids = Object.values(d).reduce((t, x) => t + Object.keys(x || {}).length, 0);
    return `${n.padEnd(28)} ลูกค้า ${String(Object.keys(c).length).padStart(3)} คน  ไอดี ${String(ids).padStart(4)} ตัว`;
  };
  const sub = pos[0] || 'list';
  if (sub === 'now') {
    const name = 'manual-' + stamp(); copyDir(DATA_DIR, path.join(BK, name));
    console.log('สำรองแล้ว: backups\\' + name + '\n(ถ้าเซิร์ฟเวอร์เปิดอยู่ ข้อมูลไอดีอาจช้ากว่าจริงไม่เกิน 30 วินาที)');
  } else if (sub === 'list') {
    const l = list();
    if (!l.length) console.log('ยังไม่มีชุดสำรอง');
    else { console.log('\nชุดสำรอง (ใหม่สุดอยู่บน):'); l.slice(0, 40).forEach((n, i) => console.log(String(i + 1).padStart(3) + ') ' + describe(n))); }
  } else if (sub === 'restore') {
    let name = pos[1]; const l = list();
    if (/^\d+$/.test(name || '')) name = l[Number(name) - 1];
    if (!name || !l.includes(name)) die('ไม่พบชุดสำรองนี้ (ดูรายการด้วย backup list)');
    const port = Number(process.env.PORT) || 8800;
    fetch(`http://127.0.0.1:${port}/healthz`, { signal: AbortSignal.timeout(2000) }).then(() => {
      console.log('*** เซิร์ฟเวอร์ยังเปิดอยู่ ปิดหน้าต่าง start-cloud.bat ก่อน แล้วค่อยกู้ (ไม่อย่างนั้นเซิร์ฟเวอร์จะเขียนทับข้อมูลที่กู้) ***');
      process.exit(1);
    }).catch(() => {
      const safety = 'before-restore-' + stamp();
      copyDir(DATA_DIR, path.join(BK, safety));
      copyDir(path.join(BK, name), DATA_DIR);
      console.log(`กู้ข้อมูลจาก ${name} แล้ว\nข้อมูลก่อนกู้ถูกเก็บไว้ที่ backups\\${safety} (เผื่ออยากย้อนกลับ)\nเปิด start-cloud.bat ได้เลย`);
    });
  }
} else if (cmd === 'adminpass') {
  let pw = opt('pass');
  if (!pw) { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'; pw = ''; for (const b of crypto.randomBytes(16)) pw += a[b % a.length]; }
  if (pw.length < 10) die('รหัสแอดมินต้องยาวอย่างน้อย 10 ตัว (หน้าแอดมินเปิดให้คนทั้งเน็ตเข้าถึงได้ ต้องรหัสแข็งแรง)');
  settings.adminHash = hashPass(pw); saveSettings();
  let base = ''; try { base = fs.readFileSync(path.join(DATA_DIR, 'public_url.txt'), 'utf8').trim(); } catch (e) {}
  console.log('\nตั้งรหัสแอดมินแล้ว: ' + pw);
  console.log('เข้าหน้าแอดมินที่: ' + (base || 'https://ลิงก์ของคุณ') + '/admin');
  console.log('จดรหัสไว้ (ระบบเก็บแบบแฮช แสดงซ้ำไม่ได้) ห้ามบอกใคร ใครได้รหัสนี้จัดการร้านได้ทั้งหมด\n');
} else if (cmd === 'links') {
  const base = baseUrl();
  const rows = Object.entries(j);
  if (!rows.length) console.log('ยังไม่มีลูกค้า');
  for (const [id, c] of rows) console.log(`\n${c.name} (${id})${c.revoked ? ' [ถูกระงับ]' : ''}\n${link(base, c)}`);
  console.log('');
} else if (cmd === 'seen') {
  const data = readJson(path.join(DATA_DIR, 'data.json'), {});
  const pool = data.__owner__ || {};
  const owner = new Map();
  for (const [id, c] of Object.entries(j)) for (const n of c.accounts || []) owner.set(n.toLowerCase(), c.name + ' (' + id + ')');
  const names = Object.keys(pool);
  if (!names.length) console.log('ยังไม่มีไอดีส่งข้อมูลเข้ามาด้วยสคริปต์ของคุณ (ไฟล์ข้อมูลอัปเดตทุก 30 วินาที)');
  const t = Date.now() / 1000;
  for (const n of names.sort()) {
    const a = pool[n], ago = a.s ? Math.round((t - a.s.time) / 60) : '?';
    console.log(`${n.padEnd(22)} ส่งล่าสุด ${String(ago).padStart(4)} นาทีก่อน   -> ${owner.get(n.toLowerCase()) || '*** ยังไม่มีเจ้าของ ***'}`);
  }
} else if (cmd === 'list') {
  console.log('โหมดปัจจุบัน: ' + (settings.mode === 'owner' ? 'เจ้าของรันเอง (owner)' : 'คีย์ลูกค้า (key)'));
  const rows = Object.entries(j);
  if (!rows.length) console.log('ยังไม่มีลูกค้า');
  for (const [id, c] of rows) {
    const st = c.revoked ? 'ถูกระงับ' : (c.expires && Date.now() / 1000 > c.expires ? 'หมดอายุ' : 'ใช้งานได้');
    console.log(`${id}  ${st.padEnd(8)}  หมดอายุ ${fmt(c.expires)}  ${c.name}`);
    if (settings.mode === 'owner') console.log(`          ไอดี: ${(c.accounts || []).join(', ') || '(ยังไม่มี)'}`);
  }
} else if (cmd === 'renew') {
  const c = need(j, pos[0]); const days = Number(opt('days', 30));
  c.expires = Math.floor(Math.max(c.expires || 0, Date.now() / 1000) + days * 86400); save();
  console.log('ต่ออายุแล้ว หมดอายุ: ' + fmt(c.expires));
} else if (cmd === 'revoke' || cmd === 'unrevoke') {
  const c = need(j, pos[0]); c.revoked = cmd === 'revoke'; save(); console.log(c.revoked ? 'ระงับแล้ว' : 'เปิดใช้งานอีกครั้งแล้ว');
} else if (cmd === 'rotate') {
  const c = need(j, pos[0]); baseUrl();
  const device = newKey('sfd_'), view = newKey('sfv_');
  c.deviceHash = sha(device); c.viewHash = sha(view); c.view = view; save();
  console.log('ออกคีย์ใหม่แล้ว ลิงก์เก่าใช้ไม่ได้แล้ว');
  showCustomer(pos[0], c, device);
} else if (cmd === 'remove') {
  need(j, pos[0]); delete j[pos[0]]; save(); removeCustomerScripts(pos[0]);
  console.log('ลบแล้ว (โหมดคีย์: ข้อมูลของลูกค้าจะถูกลบโดยเซิร์ฟเวอร์ / โหมดเจ้าของ: ไอดียังอยู่ในระบบของคุณ)');
} else {
  console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 10).join('\n'));
}

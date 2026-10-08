'use strict';
// เมนูจัดการลูกค้าแบบพิมพ์เลือก (เรียก admin.js ให้) ไม่ต้องจำคำสั่ง
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawnSync } = require('child_process');

const DATA_DIR = process.env.CLOUD_DATA_DIR || path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const URL_FILE = path.join(DATA_DIR, 'public_url.txt');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const lines = [];
let waiting = null, closed = false;
rl.on('line', (l) => { if (waiting) { const w = waiting; waiting = null; w(l); } else lines.push(l); });
rl.on('close', () => { closed = true; if (waiting) { const w = waiting; waiting = null; w(null); } });
const ask = (q) => new Promise((res) => {
  process.stdout.write(q);
  if (lines.length) return res(lines.shift());
  if (closed) return res(null);
  waiting = res;
});

function run(args, url) {
  const r = spawnSync(process.execPath, [path.join(__dirname, 'admin.js'), ...args], {
    stdio: 'inherit', env: Object.assign({}, process.env, url ? { PUBLIC_URL: url } : {}),
  });
  return r.status === 0;
}

// หาลิงก์ถาวรจาก Tailscale Funnel (ถ้าติดตั้งและเปิดไว้) จะได้ไม่ต้องพิมพ์ลิงก์เอง
function detectFunnel() {
  const bins = ['tailscale', path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Tailscale', 'tailscale.exe')];
  for (const b of bins) {
    try {
      const st = spawnSync(b, ['funnel', 'status', '--json'], { encoding: 'utf8', timeout: 8000, windowsHide: true });
      if (st.status !== 0 || !/AllowFunnel/.test(st.stdout || '')) continue; // ยังไม่ได้เปิด funnel
      const r = spawnSync(b, ['status', '--json'], { encoding: 'utf8', timeout: 8000, windowsHide: true });
      const dns = r.status === 0 && JSON.parse(r.stdout).Self && JSON.parse(r.stdout).Self.DNSName;
      if (dns && /^[a-z0-9.-]+\.ts\.net\.?$/i.test(dns)) return 'https://' + dns.replace(/\.$/, '');
    } catch (e) {}
  }
  return null;
}

async function getUrl() {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL;
  let saved = '';
  try { saved = fs.readFileSync(URL_FILE, 'utf8').trim(); } catch (e) {}
  const auto = detectFunnel();
  if (auto) {
    if (saved !== auto) {
      console.log('\nเจอลิงก์ถาวรจาก Tailscale: ' + auto);
      const a = ((await ask('ใช้ลิงก์นี้? [Enter = ใช้ / n = ใส่เอง]: ')) || '').trim().toLowerCase();
      if (a !== 'n') { fs.writeFileSync(URL_FILE, auto); return auto; }
    } else { console.log('\nใช้ลิงก์ถาวร: ' + auto); return auto; }
  }
  console.log('\nที่อยู่เซิร์ฟเวอร์ = ลิงก์ https://... ที่ขึ้นในหน้าต่าง start-funnel (ลิงก์ถาวร .ts.net) หรือ cloudflared (.trycloudflare.com)');
  console.log('(ช่องนี้ไม่ใช่ที่สำหรับแชร์ลิงก์ ลิงก์ให้ลูกค้าจะได้หลังกด Enter)');
  console.log('*** ถ้าใช้ http://127.0.0.1 มือถือจะเปิดไม่ได้ (127.0.0.1 บนมือถือหมายถึงตัวมือถือเอง) ***');
  if (saved) console.log('ที่อยู่ที่ใช้ครั้งก่อน: ' + saved + '  (ถ้าเปิดอุโมงค์ใหม่ ลิงก์จะเปลี่ยน ต้องวางใหม่)');
  const a = await ask(saved ? 'ที่อยู่ [กด Enter = ใช้ที่อยู่ครั้งก่อน]: ' : 'ที่อยู่: ');
  if (a === null) return saved || null;
  const u = (a.trim() || saved).replace(/\/+$/, '');
  if (!u) { console.log('ต้องใส่ที่อยู่'); return null; }
  const local = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(u);
  if (!/^https:\/\/[^/\s]+$/.test(u) && !local) {
    console.log('ที่อยู่ไม่ถูกต้อง ต้องเป็น https://... (หรือ http://127.0.0.1:พอร์ต สำหรับทดสอบในเครื่องเท่านั้น)'); return null;
  }
  if (local) console.log('คำเตือน: ใช้ที่อยู่ในเครื่อง ลิงก์ที่ได้ใช้บนมือถือไม่ได้');
  fs.writeFileSync(URL_FILE, u);
  return u;
}

const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const readSettings = () => { try { return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')); } catch (e) { return {}; } };
const askId = async () => {
  run(['list']);
  const id = ((await ask('\nพิมพ์ id ของลูกค้า: ')) || '').trim();
  if (!/^[0-9a-f]{8}$/.test(id)) { console.log('id ไม่ถูกต้อง'); return null; }
  return id;
};

(async () => {
  for (;;) {
    const st = readSettings();
    const owner = st.mode !== 'key';
    console.log('\n===== Slayer Fleet Cloud: จัดการลูกค้า =====');
    console.log('โหมด: ' + (owner ? 'เจ้าของรันเอง (คุณรันสคริปต์ ลูกค้าดูอย่างเดียว)' : 'คีย์ลูกค้า (ลูกค้ารันสคริปต์ของตัวเอง)'));
    if (owner && !st.ownerHash) console.log('>> ยังไม่มีสคริปต์ของคุณ เลือก 5 เพื่อสร้าง');
    console.log(' 1) เพิ่มลูกค้าใหม่');
    console.log(' 2) ดูรายชื่อลูกค้า');
    console.log(' 3) กำหนดไอดีในเกมให้ลูกค้า (เพิ่ม/เอาออก)' + (owner ? '' : '  [เฉพาะโหมดเจ้าของ]'));
    console.log(' 4) ดูไอดีที่กำลังส่งข้อมูล และเป็นของใคร' + (owner ? '' : '  [เฉพาะโหมดเจ้าของ]'));
    console.log(' 5) สร้างสคริปต์ของฉัน (ใช้ตัวเดียวทุกไอดี)' + (owner ? '' : '  [เฉพาะโหมดเจ้าของ]'));
    console.log(' 6) แสดงลิงก์ลูกค้าทุกคน (ใช้เมื่อที่อยู่เซิร์ฟเวอร์เปลี่ยน)');
    console.log(' 7) ต่ออายุ');
    console.log(' 8) ระงับ / เปิดใช้งานอีกครั้ง');
    console.log(' 9) ออกคีย์ใหม่ (ลิงก์หลุด ลิงก์เก่าจะใช้ไม่ได้)');
    console.log(' 10) ลบลูกค้า');
    console.log(' 11) ตั้งรหัสผ่านเข้าเว็บใหม่ (ลูกค้าลืมรหัส)');
    console.log(' 12) รีจอยอัตโนมัติ / แจ้งเตือน Discord');
    console.log(' M) สลับโหมด');
    console.log(' 0) ออก');
    const c = await ask('เลือก: ');
    if (c === null || c.trim() === '0') break;
    const k = c.trim().toUpperCase();
    if (['3', '4', '5'].includes(k) && !owner) { console.log('เมนูนี้ใช้ในโหมดเจ้าของ (กด M เพื่อสลับโหมด)'); continue; }
    if (k === '1') {
      const name = ((await ask('ชื่อลูกค้า (ตั้งเองให้จำได้ เช่น ชื่อเฟซ): ')) || '').trim();
      if (!name) { console.log('ต้องใส่ชื่อ'); continue; }
      const days = ((await ask('ใช้งานได้กี่วัน [30]: ')) || '').trim() || '30';
      if (!/^-?\d+$/.test(days)) { console.log('ต้องเป็นตัวเลข'); continue; }
      const args = ['add', name, '--days', days];
      if (owner) {
        const acc = ((await ask('ชื่อผู้ใช้ Roblox ที่ลูกค้าคนนี้เห็น (หลายไอดีคั่นด้วย , ข้ามได้ไว้เพิ่มทีหลัง): ')) || '').trim();
        if (acc) args.push('--accounts', acc);
      } else {
        const max = ((await ask('จำนวนไอดีสูงสุด [50]: ')) || '').trim() || '50';
        if (!/^\d+$/.test(max)) { console.log('ต้องเป็นตัวเลข'); continue; }
        args.push('--max', max);
      }
      const url = await getUrl(); if (!url) continue;
      run(args, url);
    } else if (k === '2') {
      run(['list']);
    } else if (k === '3') {
      const id = await askId(); if (!id) continue;
      const m = ((await ask('พิมพ์ 1 = เพิ่มไอดี, 2 = เอาไอดีออก: ')) || '').trim();
      if (m !== '1' && m !== '2') { console.log('ไม่ได้เลือก'); continue; }
      const acc = ((await ask('ชื่อผู้ใช้ Roblox (หลายไอดีคั่นด้วย ,): ')) || '').trim();
      if (!acc) { console.log('ต้องใส่ชื่อ'); continue; }
      run([m === '1' ? 'assign' : 'unassign', id, acc]);
    } else if (k === '4') {
      run(['seen']);
    } else if (k === '5') {
      if (st.ownerHash) {
        const sure = ((await ask('มีสคริปต์อยู่แล้ว สร้างใหม่แล้วตัวเก่าจะใช้ไม่ได้ (ต้องเปลี่ยนทุกเครื่อง) พิมพ์ YES เพื่อยืนยัน: ')) || '').trim();
        if (sure !== 'YES') { console.log('ยกเลิก'); continue; }
      }
      const url = await getUrl(); if (!url) continue;
      run(['owner-script'], url);
    } else if (k === '6') {
      const url = await getUrl(); if (!url) continue;
      run(['links'], url);
      if (owner) console.log('ถ้าที่อยู่เซิร์ฟเวอร์เปลี่ยน อย่าลืมเลือก 5 สร้างสคริปต์ของคุณใหม่ด้วย (สคริปต์เก่ายังส่งไปที่อยู่เดิม)');
    } else if (k === '12') {
      run(['rejoin', 'show']);
      console.log('\n 1) ตั้งค่า   2) ทดสอบต่อ RAM   3) ดูประวัติรีจอยล่าสุด   0) กลับ');
      const m = ((await ask('เลือก: ')) || '').trim();
      if (m === '1') {
        const args = ['rejoin', 'set'];
        const en = ((await ask('เปิดรีจอยอัตโนมัติ? (y = เปิด / n = ปิด / Enter = ไม่เปลี่ยน): ')) || '').trim().toLowerCase();
        if (en === 'y' || en === 'n') args.push('enabled=' + (en === 'y' ? 'on' : 'off'));
        const port = ((await ask('พอร์ต Web Server ของ RAM (Enter = ไม่เปลี่ยน, ค่าเริ่มต้น 7963): ')) || '').trim();
        if (port) args.push('port=' + port);
        const pw = ((await ask('รหัส Web Server ของ RAM (Enter = ไม่เปลี่ยน, พิมพ์ - = ลบ): ')) || '').trim();
        if (pw) args.push('password=' + (pw === '-' ? '' : pw));
        const am = ((await ask('ถือว่าหลุดเมื่อไม่มีข้อมูลกี่นาที (Enter = ไม่เปลี่ยน, ค่าเริ่มต้น 5): ')) || '').trim();
        if (am) args.push('afterMin=' + am);
        const dc = ((await ask('ลิงก์ Discord webhook สำหรับแจ้งเตือน (Enter = ไม่เปลี่ยน, - = ลบ): ')) || '').trim();
        if (dc) args.push('discord=' + (dc === '-' ? '' : dc));
        const ex = ((await ask('ไอดีที่ไม่ต้องรีจอย คั่นด้วย , (Enter = ไม่เปลี่ยน, - = ล้าง): ')) || '').trim();
        if (ex) args.push('exclude=' + (ex === '-' ? '' : ex));
        run(args);
      } else if (m === '2') run(['rejoin', 'test']);
      else if (m === '3') run(['rejoin', 'log']);
    } else if (k === '11') {
      const id = await askId(); if (!id) continue;
      const pw = ((await ask('รหัสผ่านใหม่ (กด Enter = สุ่มให้): ')) || '').trim();
      run(pw ? ['setpass', id, '--pass', pw] : ['setpass', id]);
    } else if (['7', '8', '9', '10'].includes(k)) {
      const id = await askId(); if (!id) continue;
      if (k === '7') {
        const days = ((await ask('ต่ออีกกี่วัน [30]: ')) || '').trim() || '30';
        if (!/^\d+$/.test(days)) { console.log('ต้องเป็นตัวเลข'); continue; }
        run(['renew', id, '--days', days]);
      } else if (k === '8') {
        const m = ((await ask('พิมพ์ 1 = ระงับ, 2 = เปิดใช้งานอีกครั้ง: ')) || '').trim();
        if (m === '1') run(['revoke', id]); else if (m === '2') run(['unrevoke', id]); else console.log('ไม่ได้เลือก');
      } else if (k === '9') {
        const url = await getUrl(); if (!url) continue;
        run(['rotate', id], url);
      } else {
        const sure = ((await ask('ลบถาวร พิมพ์ YES เพื่อยืนยัน: ')) || '').trim();
        if (sure === 'YES') run(['remove', id]); else console.log('ยกเลิก');
      }
    } else if (k === 'M') {
      const to = owner ? 'key' : 'owner';
      const sure = ((await ask(`สลับเป็น${to === 'owner' ? 'โหมดเจ้าของรันเอง' : 'โหมดคีย์ลูกค้า'}? สคริปต์ของอีกโหมดจะหยุดรับข้อมูล พิมพ์ YES เพื่อยืนยัน: `)) || '').trim();
      if (sure === 'YES') run(['mode', to]); else console.log('ยกเลิก');
    } else {
      console.log('เลือกเมนูให้ถูก');
    }
  }
  rl.close();
})();

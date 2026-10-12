#!/usr/bin/env node
'use strict';
// แพ็ก Fleet Launcher ตัวขาย (ต้องใส่คีย์) → dist\FleetLauncher-win32-x64\  แล้วบีบเป็น dist\FleetLauncher-sell.zip
// ใช้: build-sell.bat  (หรือ node tools/build-sell.js [https://ลิงก์เซิร์ฟเวอร์ร้าน])
//  - ลิงก์เซิร์ฟเวอร์: อาร์กิวเมนต์ หรือ data\public_url.txt (ลิงก์ Tailscale Funnel ของร้าน)
//  - public key: data\license-sign.json (เซิร์ฟเวอร์สร้างให้ตอนเปิดครั้งแรก) · private key ไม่ติดไปในแอป
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const STAGE = path.join(DIST, 'sell-src');
const die = (m) => { console.error('\n[ผิดพลาด] ' + m + '\n'); process.exit(1); };

let server = String(process.argv[2] || '').trim();
if (!server) { try { server = fs.readFileSync(path.join(ROOT, 'data', 'public_url.txt'), 'utf8').trim(); } catch (e) {} }
server = server.replace(/\/+$/, '');
if (!/^https:\/\/[^\s/]+$/.test(server)) die('ไม่รู้ลิงก์เซิร์ฟเวอร์ร้าน (ต้องเป็น https://...)\nใส่ลิงก์ Tailscale Funnel ไว้ใน data\\public_url.txt หรือพิมพ์ตามหลัง: build-sell.bat https://เครื่อง.tailnet.ts.net');

let sign;
try { sign = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'license-sign.json'), 'utf8')); } catch (e) {}
if (!sign || !sign.pub) die('ยังไม่มีกุญแจคีย์แอป: เปิดเซิร์ฟเวอร์ (start-cloud.bat) เวอร์ชันใหม่ 1 ครั้งก่อน');

// เตรียมโฟลเดอร์แพ็ก: desktop\* + launcher (เฉพาะไฟล์ที่ใช้) + license.json
fs.rmSync(STAGE, { recursive: true, force: true });
fs.mkdirSync(path.join(STAGE, 'launcher'), { recursive: true });
for (const f of fs.readdirSync(path.join(ROOT, 'desktop'))) if (!/^node_modules$/.test(f)) fs.cpSync(path.join(ROOT, 'desktop', f), path.join(STAGE, f), { recursive: true });
for (const f of ['fleet-launcher.js', 'license-client.js', 'ui.html']) fs.copyFileSync(path.join(ROOT, 'launcher', f), path.join(STAGE, 'launcher', f));
fs.copyFileSync(path.join(ROOT, 'version.txt'), path.join(STAGE, 'launcher', 'version.txt'));
fs.writeFileSync(path.join(STAGE, 'launcher', 'license.json'), JSON.stringify({ server, pub: sign.pub }, null, 2));
console.log('เซิร์ฟเวอร์คีย์: ' + server);

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const args = ['--yes', '@electron/packager@18.3.6', STAGE, 'FleetLauncher', '--platform=win32', '--arch=x64', '--electron-version=33.2.1',
  '--icon=' + path.join(ROOT, 'desktop', 'icon.ico'), '--asar', '--overwrite', '--out=' + DIST];
console.log('กำลังแพ็ก (ครั้งแรกโหลด Electron ~100MB อาจนานหลายนาที)...');
const r = spawnSync(npx, args, { stdio: 'inherit', cwd: ROOT, shell: process.platform === 'win32' });
if (r.status !== 0) die('แพ็กไม่สำเร็จ (ดูข้อความด้านบน)');
fs.rmSync(STAGE, { recursive: true, force: true });

const out = path.join(DIST, 'FleetLauncher-win32-x64');
if (process.platform === 'win32') {
  const zip = path.join(DIST, 'FleetLauncher-sell.zip');
  try { fs.rmSync(zip, { force: true }); } catch (e) {}
  spawnSync('powershell', ['-NoProfile', '-Command', `Compress-Archive -Path '${out}\\*' -DestinationPath '${zip}' -Force`], { stdio: 'inherit' });
  console.log('\nเสร็จแล้ว: ' + zip + '\nส่ง zip นี้ให้ผู้ซื้อ · แตกไฟล์แล้วเปิด FleetLauncher.exe → ใส่คีย์ที่ออกจากหน้าแอดมิน แท็บ "คีย์แอป"');
} else console.log('\nเสร็จแล้ว: ' + out);

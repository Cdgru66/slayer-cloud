// Fleet Launcher (แอปเดสก์ท็อป): ห่อ launcher/fleet-launcher.js ด้วย Electron
// - หน้าต่างแอปจริง ไม่ผ่าน Edge, ไม่ต้องลง Node.js, มีไอคอนบน taskbar + ถาดไอคอนมุมขวาล่าง
// - ปิดหน้าต่าง = ซ่อนไปถาด (รีจอยทำงานต่อ) · ออกจริงจากเมนูถาด หรือปุ่ม "ปิดโปรแกรม" ในแอป
// - โค้ดตัวเปิดเกมอ่านจากโฟลเดอร์ร้าน (โฟลเดอร์แม่ที่มี launcher\fleet-launcher.js) จึงอัปเดตผ่าน update.bat ได้ตามปกติ
'use strict';
const { app, BrowserWindow, Tray, Menu, nativeImage, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

if (!app.requestSingleInstanceLock()) { app.quit(); return; }
app.setAppUserModelId('th.fleet.launcher');
Menu.setApplicationMenu(null);

const ICON = path.join(__dirname, process.platform === 'win32' ? 'icon.ico' : 'icon.png');
let win = null, tray = null, uiUrl = null, quitting = false, hintShown = false;

// หาโค้ดตัวเปิดเกม:
//  1) แอปที่ขาย (แพ็กด้วย build-sell.bat): โค้ดอยู่ในตัวแอป resources\app\launcher → ข้อมูลเก็บที่ %LOCALAPPDATA%\FleetLauncher\app
//  2) ตัวของร้าน: ไล่ขึ้นจากโฟลเดอร์ของ .exe (เช่น slayer-cloud\FleetLauncher\FleetLauncher.exe → slayer-cloud\launcher)
function findLauncher() {
  const own = path.join(__dirname, 'launcher', 'fleet-launcher.js');
  if (fs.existsSync(own)) {
    const dir = path.join(process.env.LOCALAPPDATA || app.getPath('userData'), 'FleetLauncher', 'app');
    try { fs.mkdirSync(path.join(dir, 'data'), { recursive: true }); } catch (e) {}
    process.env.FLEET_APP_DIR = dir;
    return own;
  }
  const starts = [path.dirname(process.execPath), process.cwd(), path.join(__dirname, '..')];
  for (const s of starts) {
    let d = s;
    for (let i = 0; i < 4; i++) {
      const f = path.join(d, 'launcher', 'fleet-launcher.js');
      if (fs.existsSync(f)) return f;
      const up = path.dirname(d); if (up === d) break; d = up;
    }
  }
  return null;
}

function showWindow() {
  if (!uiUrl) return;
  if (!win || win.isDestroyed()) createWindow();
  if (win.isMinimized()) win.restore();
  win.show(); win.focus();
}

function createWindow() {
  win = new BrowserWindow({
    width: 1360, height: 880, minWidth: 920, minHeight: 600,
    show: false, backgroundColor: '#110a0c', title: 'Fleet Launcher', icon: ICON,
    titleBarStyle: 'hidden', titleBarOverlay: { color: '#110a0c', symbolColor: '#b3a79d', height: 52 },
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false, devTools: !app.isPackaged },
  });
  win.loadURL(uiUrl + '&app=1');
  win.once('ready-to-show', () => win.show());
  // อยู่แต่ในหน้าจอควบคุม: ลิงก์ภายนอกเปิดในเบราว์เซอร์ปกติ
  const inApp = (u) => u.startsWith('http://127.0.0.1:7963/');
  win.webContents.on('will-navigate', (e, u) => { if (!inApp(u)) { e.preventDefault(); if (/^https:\/\//.test(u)) shell.openExternal(u); } });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  // ไม่ให้รีโหลด/เปิด DevTools ในตัวจริง (รีโหลดแล้วโทเคนหาย หน้าจะว่าง)
  win.webContents.on('before-input-event', (e, i) => {
    const k = String(i.key || '').toLowerCase();
    if (k === 'f5' || (i.control && k === 'r') || (app.isPackaged && (k === 'f12' || (i.control && i.shift && k === 'i')))) e.preventDefault();
  });
  win.on('close', (e) => {
    if (quitting) return;
    e.preventDefault(); win.hide();
    if (!hintShown && tray && process.platform === 'win32') {
      hintShown = true;
      tray.displayBalloon({ iconType: 'info', title: 'Fleet Launcher ยังทำงานอยู่', content: 'รีจอยต่อเบื้องหลัง · คลิกไอคอนที่ถาดเพื่อเปิด หรือคลิกขวาเพื่อออก' });
    }
  });
}

function quitAll() { quitting = true; if (tray) tray.destroy(); app.exit(0); }

function createTray() {
  tray = new Tray(nativeImage.createFromPath(ICON));
  tray.setToolTip('Fleet Launcher');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'เปิด Fleet Launcher', click: showWindow },
    { type: 'separator' },
    { label: 'ออก (หยุดรีจอย)', click: quitAll },
  ]));
  tray.on('click', showWindow);
}

app.on('second-instance', showWindow);
app.on('window-all-closed', () => {}); // อยู่ที่ถาดต่อ
app.on('before-quit', () => { quitting = true; });

app.whenReady().then(() => {
  const file = findLauncher();
  if (!file) {
    dialog.showErrorBox('Fleet Launcher', 'ไม่เจอโฟลเดอร์ร้าน\n\nวางโฟลเดอร์ FleetLauncher ไว้ข้างใน slayer-cloud (โฟลเดอร์เดียวกับ launcher.bat) แล้วเปิดใหม่');
    return app.exit(1);
  }
  let L;
  try { L = require(file); }
  catch (e) { dialog.showErrorBox('Fleet Launcher', 'โหลดตัวเปิดเกมไม่สำเร็จ:\n' + e.message); return app.exit(1); }
  process.on('uncaughtException', (e) => { try { console.error(e); } catch (x) {} });
  createTray();
  L.serve({
    embedded: true,
    onReady: (url) => { uiUrl = url; showWindow(); },
    onOpenUI: showWindow,
    onQuit: quitAll,
    onError: (e) => {
      dialog.showErrorBox('Fleet Launcher', e.code === 'EADDRINUSE'
        ? 'มีตัวเปิดเกมอีกตัวทำงานอยู่ (แบบเก่าที่เปิดจาก launcher.bat หรือ Roblox Account Manager)\n\nปิดตัวนั้นก่อน แล้วเปิด Fleet Launcher ใหม่'
        : 'เริ่มทำงานไม่ได้: ' + e.message);
      quitAll();
    },
  });
});

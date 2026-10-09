# Slayer Fleet Cloud — คู่มือโปรเจกต์ (อ่านก่อนเริ่มงานในแชทใหม่)

ระบบร้านรับฟาร์ม/รับทำไอดีเกม Roblox: สคริปต์ในเกมส่งข้อมูลขึ้นเซิร์ฟเวอร์ (คอมเจ้าของร้าน)
→ ลูกค้าดูความคืบหน้าแบบเรียลไทม์ผ่านเว็บ, ร้านจัดการทุกอย่างในหน้าแอดมิน
เจ้าของ: Cdgru66 (คนไทย สื่อสารภาษาไทย ชอบความง่าย สวย เรียลไทม์) · repo ส่วนตัว `Cdgru66/slayer-cloud`

## โครงสร้าง (Node 18+ ไม่มี dependency)
| ไฟล์ | หน้าที่ |
|---|---|
| `server.js` | HTTP server หลัก: รับข้อมูลจากเกม (`/api/v1/ingest`, คีย์ `sfd_`), ส่งข้อมูลให้ลูกค้า (`/api/v1/state`, คีย์ `sfv_`), login ลูกค้า, ไฟล์หน้าเว็บ, สำรองข้อมูลทุก 6 ชม., รีจอยผ่าน Roblox Account Manager, `/script.lua` (สคริปต์ล่าสุดให้ตัวโหลด) |
| `admin-api.js` | API หน้าแอดมิน (`/api/v1/admin/*`, session `sfa_`): ลูกค้า, ไอดี, ออเดอร์, เซท, เป้าหมาย, แจ้งเตือน, สำรองข้อมูล |
| `orders.js` | ฟอร์มสั่งทำ (`/api/v1/order`), เซทสำเร็จรูป (`/api/v1/sets`, `data/sets.json`), เป้าหมาย/ความคืบหน้า (`data/goals.json`, ประวัติไว้คำนวณความเร็ว+วันเสร็จ) |
| `notify.js` | แจ้งเตือน Discord (เลเวลอัป ของหายาก ค้าง สรุปรายวัน ออเดอร์ใหม่) |
| `admin.js` / `admin-menu.js` / `admin.bat` | เมนูจัดการบนคอม (ตั้งรหัสแอดมิน=เมนู 14, สร้างตัวโหลด=เมนู 5, รีจอย=12, สำรอง=13) |
| `public/index.html` + `app.js` | แดชบอร์ดลูกค้า `/v` (และ `/v#admin` = ภาพรวมฟาร์มของแอดมิน) |
| `public/admin.html` + `admin.js` | หน้าแอดมิน `/admin` |
| `public/order.html` + `order.js` | หน้าสั่งทำ `/order` (เลือกเซท → ตระกูล → บรีฟ → ติดต่อ, QR `public/pay-qr.jpg`) |
| `script_template.lua` | สคริปต์ในเกม (เสิร์ฟผ่าน `/script.lua`): ส่งข้อมูลเต็มทุก 120 วิ + ข้อมูลสด (บอส/Wen/แร่/Mastery/อาวุธในมือ) ทุก 20 วิ |
| `tools/scan_*.lua` | สคริปต์สแกนหาข้อมูลในเกม (ใช้ตอนเริ่มเกมใหม่/หาไอคอน) |
| `icons-seed.json` | ไอคอนไอเทม/บอส (ชื่อ → ลิงก์ tr.rbxcdn.com) |
| `update.bat` / `update.ps1` | อัปเดตจาก GitHub (ถ้าติด SSL ใช้ zip ใน Downloads แทน) |
| `data/` | ข้อมูลร้าน (ไม่อยู่ใน git): customers, settings, orders, sets, goals, accounts, icons |

## การทำงานกับเจ้าของร้าน
- ส่งงาน: แก้โค้ด → bump `version.txt` (รูปแบบ `YYYY.MM.DD-N`) → commit/push → ทำ zip ส่งในแชท
- เจ้าของอัปเดต: บันทึก zip ลง Downloads → `update.bat` → `y` → Ctrl+F5 · ถ้าแก้สคริปต์ในเกม ต้องรัน OWNER-LOADER ใหม่
- เช็คเวอร์ชัน: `http://127.0.0.1:8800/healthz`
- ลิงก์สาธารณะ: Tailscale Funnel (`tailscale funnel --bg 8800`) → `https://<เครื่อง>.<tailnet>.ts.net`
- ห้ามรับรหัส Roblox/cookie ผ่านเว็บ, ห้ามปิดการตรวจ TLS, token GitHub ห้ามวางในแชท
- ทดสอบทุกครั้งด้วยสำเนาในโฟลเดอร์ชั่วคราว + Playwright (คอม 1280px + มือถือ 390px)

## กฎเฉพาะเกม Slayer 2 (ค้นพบจากการสแกน)
- ข้อมูลผู้เล่น: `ReplicatedStorage.Player_Service.Data.<ชื่อ>.slots.Slot<n>` (Inventory.Inventory, Powers, Progression, Wen ฯลฯ) · เลเวล: `PlayerTitles.Progress.level`
- **Mastery**: `MasteryProgressionList.<ชื่อ>.Current/Goal` เป็น **EXP ในเลเวล** · **เลเวล = Goal ÷ 30** (ตรงกับ "Lv" บนแถบล่างจอ `MasteryHolder.Actual.<ชื่อ>...CurrentValue`) · ตันที่ Lv 400
- Katana ใช้ Mastery `Sword` · **Gauntlet ใช้ Mastery `Fist` แต่นับเมื่อมี Gauntlet แล้วเท่านั้น**
- ร่างดาบตามปราณ: Thundercloud=Thunder, Tidal=Water, Tornadic=Wind, Volcanic=Flame, Insect Katana=Insect (Firstlight เท่านั้น)
- Sickles / Scythe / Axe and Mace มีแต่สาย Nightfall · อาวุธอื่นมีทั้ง Nightfall และ Firstlight
- ชุด Nightfall: หมวกกับกางเกงตีบวกได้สูงสุด +3 (เสื้อ +10)
- ปราณที่มีในเกมตอนนี้: Water, Flame, Thunder, Wind, Insect, Stone, Sound, Serpent (ยังไม่มี Mist/Beast/Moon/Sun)
- มนต์อสูร (Orb): Blood Manipulation, Cryokinesis, Pyrokinesis(ไอคอน "Pyrokenesis Orb"), Shockwave, Reaper, Dream, Tamari, Obi Manipulation
- ไอคอนบอส: มินิแมพ `PinsHolder.Bosses.<ชื่อ>.Plate.Icon` (เก็บเป็น `boss:<ชื่อ>`) · ไอคอนไอเทมในกระเป๋า: `ActualHolder.<ชื่อ>.Img`
- เซทเริ่มต้น: Akaza, Douma + เสาหลัก (Giyu, Rengoku, Sanemi, Shinobu, Tengen, Gyomei, Obanai)

## ถ้าจะทำเกม/แมพใหม่
1. ใช้ `tools/scan_deep.lua` (สะสมผลหลายรอบ) + `scan_mastery2.lua` + `scan_inventory.lua` ในเกมใหม่ หาว่าข้อมูลอยู่ตรงไหน
2. แก้เฉพาะส่วนอ่านข้อมูลใน `script_template.lua` (getData/getSlot/collect/ส่วนข้อมูลสด) + ชื่อของ/สกุลเงินใน `public/app.js` (ORE, COINS, ข้อความ)
3. แก้รายการอาวุธ/ปราณ/กฎจับคู่ใน `public/order.js` (WEAPONS, BREATHS, DEMONS, VARIANTS, TYPE_LINES, PLUS_CAP) และ `public/admin.js` (S_*)
4. ส่วนเซิร์ฟเวอร์/แอดมิน/ออเดอร์/เป้าหมาย/แจ้งเตือน ใช้ได้เลยไม่ต้องแก้

'use strict';
// ฟอร์มสั่ง "รับทำไอดี End Game" (หน้า /order) — ใครก็ส่งได้ ไม่ต้องล็อกอิน จึงกันสแปมและจำกัดความยาวทุกช่อง
const fs = require('fs');
const path = require('path');

const STATUSES = ['ใหม่', 'คุยแล้ว', 'รอชำระเงิน', 'กำลังทำ', 'เสร็จแล้ว', 'ยกเลิก'];
const str = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
const strML = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').trim().slice(0, max); // อนุญาตขึ้นบรรทัดใหม่
const int = (v, lo, hi) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : null; };

// ข้อความจากคนนอกที่จะส่งเข้า Discord: ปิดลิงก์แฝงและตัวจัดรูปแบบ
const md = (t) => String(t).replace(/https?:\/\//gi, (m) => m.replace('://', ':\u200b//')).replace(/([\\[\]()*_~`|>#@<])/g, '\\$1');

module.exports = function createOrders(ctx) {
  const FILE = path.join(ctx.DATA_DIR, 'orders.json');
  let orders = []; try { orders = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (e) {}
  const save = () => { const t = FILE + '.tmp'; fs.writeFileSync(t, JSON.stringify(orders, null, 1)); fs.renameSync(t, FILE); };

  function clean(j) {
    const LINES_OK = ['', 'Nightfall', 'Firstlight'];
    const gear = (g, cap3) => { if (!g || typeof g !== 'object') return null; const line = LINES_OK.includes(g.line) ? g.line : ''; const blank = (v) => v == null || v === ''; let plus = blank(g.plus) ? null : int(g.plus, 0, 10); if (cap3 && line === 'Nightfall' && plus != null) plus = Math.min(plus, 3); return { line, tier: blank(g.tier) ? null : int(g.tier, 1, 3), plus }; };
    const o = {
      roblox: str(j.roblox, 20).replace(/[^A-Za-z0-9_]/g, ''),
      pack: (() => { const n = str(j.pack, 60); const base = n.replace(/ \(ปรับเอง\)$/, ''); const hit = sets.find((x) => x.name === base); return !n ? '' : hit ? n : 'ลูกค้าพิมพ์เอง: ' + n.slice(0, 40); })(),
      clan: str(j.clan, 40),
      weapon: j.weapon && typeof j.weapon === 'object' ? Object.assign(gear(j.weapon), { type: str(j.weapon.type, 40), variant: str(j.weapon.variant, 30), mastery: int(j.weapon.mastery, 0, 9999) }) : null,
      power: j.power && typeof j.power === 'object' ? { kind: j.power.kind === 'demon' ? 'demon' : 'breath', name: str(j.power.name, 40), mastery: int(j.power.mastery, 0, 9999) } : null,
      top: gear(j.top), bottom: gear(j.bottom, true), hat: gear(j.hat, true),
      title: str(j.title, 40), level: int(j.level, 0, 9999),
      brief: strML(j.brief, 1500),
      contact: { via: ['facebook', 'discord', 'line', 'other'].includes(j.contact && j.contact.via) ? j.contact.via : 'other', handle: str(j.contact && j.contact.handle, 100) },
    };
    if (!o.contact.handle) throw new Error('กรุณาใส่ช่องทางติดต่อกลับ');
    if (!o.clan && !(o.weapon && o.weapon.type) && !(o.power && o.power.name) && !o.brief) throw new Error('กรุณาเลือกอย่างน้อย 1 อย่างที่อยากให้ทำ หรือเขียนบรีฟ');
    return o;
  }
  const summary = (o) => {
    const g = (x) => (x && x.line ? `${x.line}${x.tier ? ' T' + x.tier : ''}${x.plus ? '+' + x.plus : ''}` : '');
    const L = [];
    if (o.pack) L.push('เซท: ' + o.pack);
    if (o.clan) L.push('ตระกูล: ' + o.clan);
    if (o.weapon && o.weapon.type) L.push(`อาวุธ: ${o.weapon.variant ? o.weapon.variant + ' ' : ''}${o.weapon.type} ${g(o.weapon)}`.trim() + (o.weapon.mastery ? ` (ฟาร์มให้จน Mastery ${o.weapon.mastery})` : ''));
    if (o.power && o.power.name) L.push(`${o.power.kind === 'demon' ? 'มนต์อสูร' : 'ปราณ'}: ${o.power.name}` + (o.power.mastery ? ` (ฟาร์มให้จน Mastery ${o.power.mastery})` : ''));
    if (g(o.top) && g(o.top) === g(o.bottom)) L.push('เสื้อ, กางเกง: ' + g(o.top));
    else { if (g(o.top)) L.push('เสื้อ: ' + g(o.top)); if (g(o.bottom)) L.push('กางเกง: ' + g(o.bottom)); }
    if (g(o.hat) && g(o.hat) !== g(o.bottom)) L.push('หมวก: ' + g(o.hat)); else if (g(o.hat)) L[L.length - 1] = L[L.length - 1].replace('กางเกง', 'กางเกง, หมวก');
    if (o.title) L.push('ฉายา: ' + o.title);
    if (o.level) L.push('เลเวล: ' + o.level);
    if (o.roblox) L.push('ไอดี Roblox: ' + o.roblox);
    if (o.brief) L.push('บรีฟเพิ่มเติม: ' + o.brief);
    return L.join('\n');
  };

  // ===== เซทสำเร็จรูป (ร้านตั้งเองในหน้าแอดมิน แท็บ เซท) =====
  const SETS_FILE = path.join(ctx.DATA_DIR, 'sets.json');
  const DEFAULT_SETS = [
   {
    "id": "akaza",
    "name": "Akaza",
    "icon": "boss:Akazo",
    "price": "เริ่มต้น 200 บาท",
    "note": "อสูรข้างขึ้นที่ 3 · หมัดหนักแรงกระแทก",
    "weapon": {
     "type": "Gauntlet",
     "line": "Nightfall",
     "tier": 3,
     "plus": 10
    },
    "power": {
     "kind": "demon",
     "name": "Shockwave"
    },
    "armor": {
     "line": "Nightfall",
     "tier": 3,
     "plus": 10
    }
   },
   {
    "id": "douma",
    "name": "Douma",
    "icon": "boss:Domae",
    "price": "เริ่มต้น 200 บาท",
    "note": "อสูรข้างขึ้นที่ 2 · พัดน้ำแข็ง",
    "weapon": {
     "type": "War Fans",
     "line": "Firstlight",
     "tier": 3,
     "plus": 10
    },
    "power": {
     "kind": "demon",
     "name": "Cryokinesis"
    },
    "armor": {
     "line": "Firstlight",
     "tier": 3,
     "plus": 10
    }
   },
   {
    "id": "giyu",
    "name": "Giyu",
    "icon": "boss:Giyen",
    "price": "เริ่มต้น 200 บาท",
    "note": "เสาหลักวารี · Tidal Katana",
    "weapon": {
     "type": "Katana",
     "line": "Firstlight",
     "tier": 3,
     "plus": 10
    },
    "power": {
     "kind": "breath",
     "name": "Water"
    },
    "armor": {
     "line": "Firstlight",
     "tier": 3,
     "plus": 10
    }
   },
   {
    "id": "rengoku",
    "name": "Rengoku",
    "icon": "boss:Rengu",
    "price": "เริ่มต้น 200 บาท",
    "note": "เสาหลักเพลิง · Volcanic Katana",
    "weapon": {
     "type": "Katana",
     "line": "Nightfall",
     "tier": 3,
     "plus": 10
    },
    "power": {
     "kind": "breath",
     "name": "Flame"
    },
    "armor": {
     "line": "Nightfall",
     "tier": 3,
     "plus": 10
    }
   },
   {
    "id": "sanemi",
    "name": "Sanemi",
    "icon": "boss:Saneri",
    "price": "เริ่มต้น 200 บาท",
    "note": "เสาหลักวายุ · Tornadic Katana",
    "weapon": {
     "type": "Katana",
     "line": "Nightfall",
     "tier": 3,
     "plus": 10
    },
    "power": {
     "kind": "breath",
     "name": "Wind"
    },
    "armor": {
     "line": "Nightfall",
     "tier": 3,
     "plus": 10
    }
   },
   {
    "id": "shinobu",
    "name": "Shinobu",
    "icon": "boss:Shinora",
    "price": "เริ่มต้น 200 บาท",
    "note": "เสาหลักแมลง · Insect Katana",
    "weapon": {
     "type": "Katana",
     "line": "Firstlight",
     "tier": 3,
     "plus": 10
    },
    "power": {
     "kind": "breath",
     "name": "Insect"
    },
    "armor": {
     "line": "Firstlight",
     "tier": 3,
     "plus": 10
    }
   },
   {
    "id": "tengen",
    "name": "Tengen",
    "icon": "boss:Tengai",
    "price": "เริ่มต้น 200 บาท",
    "note": "เสาหลักเสียง",
    "weapon": {
     "type": "Katana",
     "line": "Firstlight",
     "tier": 3,
     "plus": 10
    },
    "power": {
     "kind": "breath",
     "name": "Sound"
    },
    "armor": {
     "line": "Firstlight",
     "tier": 3,
     "plus": 10
    }
   },
   {
    "id": "gyomei",
    "name": "Gyomei",
    "icon": "boss:Gyorei",
    "price": "เริ่มต้น 200 บาท",
    "note": "เสาหลักศิลา · ขวานกับลูกตุ้ม",
    "weapon": {
     "type": "Axe and Mace",
     "line": "Nightfall",
     "tier": 3,
     "plus": 10
    },
    "power": {
     "kind": "breath",
     "name": "Stone"
    },
    "armor": {
     "line": "Nightfall",
     "tier": 3,
     "plus": 10
    }
   },
   {
    "id": "obanai",
    "name": "Obanai",
    "icon": "boss:Obari",
    "price": "เริ่มต้น 200 บาท",
    "note": "เสาหลักอสรพิษ",
    "weapon": {
     "type": "Katana",
     "line": "Nightfall",
     "tier": 3,
     "plus": 10
    },
    "power": {
     "kind": "breath",
     "name": "Serpent"
    },
    "armor": {
     "line": "Nightfall",
     "tier": 3,
     "plus": 10
    }
   }
  ];
  let sets = DEFAULT_SETS; try { const x = JSON.parse(fs.readFileSync(SETS_FILE, 'utf8')); if (Array.isArray(x)) sets = x; } catch (e) {}
  const gearS = (g) => (g && typeof g === 'object' ? { type: str(g.type, 40), line: str(g.line, 30), tier: int(g.tier, 0, 9), plus: int(g.plus, 0, 30) } : null);
  function cleanSet(x, i) {
    if (!x || typeof x !== 'object') throw new Error('ข้อมูลเซทไม่ถูกต้อง');
    const name = str(x.name, 40); if (!name) throw new Error('เซทที่ ' + (i + 1) + ' ยังไม่มีชื่อ');
    return { id: (str(x.id, 40).replace(/[^a-z0-9_-]/gi, '') || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30) || 'set' + i) + '',
      name, icon: str(x.icon, 80), price: str(x.price, 40), note: str(x.note, 120), hidden: !!x.hidden,
      weapon: gearS(x.weapon), power: x.power && typeof x.power === 'object' ? { kind: x.power.kind === 'demon' ? 'demon' : 'breath', name: str(x.power.name, 40) } : null,
      armor: gearS(x.armor) };
  }

  // ===== เป้าหมายของไอดี (ผูกกับออเดอร์) ใช้คำนวณ % ความคืบหน้าแบบเรียลไทม์ =====
  const GOALS_FILE = path.join(ctx.DATA_DIR, 'goals.json');
  let goals = Object.create(null); try { Object.assign(goals, JSON.parse(fs.readFileSync(GOALS_FILE, 'utf8'))); } catch (e) {}
  let goalsDirty = false; setInterval(() => { if (goalsDirty) { goalsDirty = false; try { saveGoals(); } catch (e) {} } }, 60000).unref();
  // แก้เป้าหมายเก่าที่เคยจับ Gauntlet ไปคู่กับ Fist (หมัดเปล่า) ผิด
  for (const g of Object.values(goals)) for (const it of (g && g.items) || []) if (it.k === 'mastery' && /gauntlet/i.test(it.label || '') && !it.need) { it.key = 'Fist'; it.need = 'Gauntlet'; g.hist = []; goalsDirty = true; }
  const saveGoals = () => { const t = GOALS_FILE + '.tmp'; fs.writeFileSync(t, JSON.stringify(goals, null, 1)); fs.renameSync(t, GOALS_FILE); };
  const gkey = (n) => String(n || '').toLowerCase();
  function cleanGoal(j) {
    const items = (Array.isArray(j.items) ? j.items : []).slice(0, 20).map((x) => {
      const k = ['mastery', 'level', 'manual'].includes(x && x.k) ? x.k : 'manual';
      return { k, label: str(x.label, 80), key: str(x.key, 40), need: str(x.need, 40), target: k === 'manual' ? null : int(x.target, 1, 100000), done: !!x.done };
    }).filter((x) => x.label || x.key);
    return { title: str(j.title, 80), order: str(j.order, 20), items, created: Math.floor(ctx.now()) };
  }
  // สร้างเป้าหมายจากออเดอร์: Mastery ของอาวุธและพลัง (จับคู่กับชื่อใน Mastery ของไอดี) + รายการให้ติ๊กเอง
  function goalFromOrder(o, masteryKeys) {
    const find = (...names) => { for (const n of names) { if (!n) continue; const k = masteryKeys.find((m) => m.toLowerCase() === n.toLowerCase()) || masteryKeys.find((m) => m.toLowerCase().includes(n.toLowerCase()) || n.toLowerCase().includes(m.toLowerCase())); if (k) return k; } return names.find(Boolean) || ''; };
    const items = [];
    if (o.weapon && o.weapon.type) items.push({ k: 'mastery', label: 'Mastery ' + o.weapon.type, key: find(o.weapon.type, o.weapon.type === 'Katana' ? 'Sword' : '', o.weapon.type === 'Gauntlet' ? 'Fist' : ''), target: 400, need: o.weapon.type });
    if (o.power && o.power.name) items.push({ k: 'mastery', label: 'Mastery ' + o.power.name, key: find(o.power.name), target: 400 });
    const g = (x) => (x && x.line ? `${x.line}${x.tier ? ' T' + x.tier : ''}${x.plus != null ? '+' + x.plus : ''}` : '');
    if (o.weapon && o.weapon.type) items.push({ k: 'manual', label: `ได้อาวุธ ${o.weapon.variant ? o.weapon.variant + ' ' : ''}${o.weapon.type} ${g(o.weapon)}`.trim() });
    if (o.top && o.top.line) items.push({ k: 'manual', label: 'ได้ชุด ' + g(o.top) + (o.bottom && o.bottom.plus != null && o.bottom.plus !== o.top.plus ? ' (หมวก/กางเกง +' + o.bottom.plus + ')' : '') });
    if (o.clan) items.push({ k: 'manual', label: 'ตระกูล ' + o.clan });
    return cleanGoal({ title: o.pack ? 'เซท ' + o.pack : 'ออเดอร์ ' + o.id, order: o.id, items });
  }

  function handle(req, res, url, ip) {
    if (url.pathname === '/api/v1/sets' && req.method === 'GET') {
      if (!ctx.rate('sets:' + ip, 60)) { ctx.send(res, 429, { error: 'rate limited' }); return true; }
      ctx.send(res, 200, sets.filter((x) => !x.hidden)); return true;
    }
    if (url.pathname !== '/api/v1/order' || req.method !== 'POST') return false;
    if (!ctx.rate('order:' + ip, 3) || !ctx.rate('orders', 300)) {
      ctx.send(res, 429, { error: 'ส่งบ่อยเกินไป รอสักครู่แล้วลองใหม่' }); return true;
    }
    ctx.readBody(req, res, (body) => {
      let j; try { j = JSON.parse(body); } catch (e) { return ctx.send(res, 400, { error: 'ข้อมูลไม่ถูกต้อง' }); }
      if (!j || typeof j !== 'object') return ctx.send(res, 400, { error: 'ข้อมูลไม่ถูกต้อง' });
      if (j.website) return ctx.send(res, 200, { ok: true, id: 'SF-0000' }); // ช่องดักบอท (คนจริงมองไม่เห็นช่องนี้)
      let o; try { o = clean(j); } catch (e) { return ctx.send(res, 400, { error: e.message }); }
      const id = 'SF-' + String((orders.reduce((m, x) => Math.max(m, Number(String(x.id).slice(3)) || 0), 1000)) + 1);
      const rec = Object.assign({ id, time: Math.floor(ctx.now()), status: 'ใหม่', quote: null, note: '' }, o);
      orders.unshift(rec);
      if (orders.length > 2000) { // เก่าเกินเก็บไว้ในไฟล์สำรอง ไม่ทิ้ง
        const old = orders.splice(2000);
        try { const af = path.join(ctx.DATA_DIR, 'orders-archive.jsonl'); let big = false; try { big = fs.statSync(af).size > 50 * 1024 * 1024; } catch (e) {} if (big) fs.renameSync(af, af + '.' + Date.now() + '.old'); fs.appendFileSync(af, old.map((x) => JSON.stringify(x)).join('\n') + '\n'); } catch (e) {}
      }
      try { save(); } catch (e) { return ctx.send(res, 500, { error: 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง' }); }
      if (!ctx.rate('order-discord', 10)) { if (ctx.rate('order-discord-flood', 1)) ctx.notifyOwner({ content: '⚠ มีออเดอร์เข้ามาถี่ผิดปกติ ดูที่หน้าแอดมิน แท็บ ออเดอร์' }); return ctx.send(res, 200, { ok: true, id }); }
      ctx.notifyOwner({ embeds: [{ title: `🛒 ออเดอร์ใหม่ ${id}`, description: md(summary(rec)).slice(0, 3500), color: 0xe2b65c,
        fields: [{ name: 'ติดต่อกลับ', value: md(`${rec.contact.via}: ${rec.contact.handle}`).slice(0, 1000) }], timestamp: new Date().toISOString() }] });
      ctx.send(res, 200, { ok: true, id });
    });
    return true;
  }

  return {
    handle, summary, STATUSES,
    goalOf: (name) => goals[gkey(name)] || null,
    // บันทึกประวัติความคืบหน้า (ใช้คำนวณความเร็วและวันที่คาดว่าเสร็จ) ทุกครั้งที่ค่าเปลี่ยน อย่างน้อยห่างกัน 60 วิ เก็บ 1500 จุด
    trackGoal: (name, s) => {
      const g = goals[gkey(name)]; if (!g || !s) return;
      if (!g.lvMode) { g.lvMode = 1; g.hist = []; } // ประวัติเดิมเก็บเป็น EXP ล้างครั้งเดียว
      const mlv = (x) => { if (!x) return 0; const lv = Number.isFinite(x.lv) ? x.lv : Math.round((Number(x.goal) || 0) / 30); const fr = x.goal > 0 ? Math.min(1, Math.max(0, x.current / x.goal)) : 0; return Math.min(400, Math.round((lv + (lv >= 400 ? 0 : fr)) * 100) / 100); };
      const owns = (n) => !n || (typeof s.holding === 'string' && s.holding.toLowerCase().includes(n.toLowerCase())) || (s.items || []).some((i) => i && typeof i.name === 'string' && i.name.toLowerCase().includes(n.toLowerCase()));
      const m = s.mastery || {}, v = g.items.map((it) => (it.k === 'mastery' ? (owns(it.need) ? mlv(m[it.key]) : 0) : it.k === 'level' ? Number(s.level) || 0 : it.done ? 1 : 0));
      const h = g.hist || (g.hist = []), last = h[h.length - 1], t = Math.floor(ctx.now());
      const same = last && last.v.length === v.length && last.v.every((x, i) => x === v[i]);
      if (last && (t - last.t < 60 || (same && t - last.t < 1800))) return;
      h.push({ t, v }); if (h.length > 1500) h.splice(0, h.length - 1500);
      goalsDirty = true;
    },
    allGoals: () => goals,
    setGoal: (name, j) => { if (!/^[A-Za-z0-9_]{3,20}$/.test(name)) throw new Error('ชื่อไอดีไม่ถูกต้อง'); const old = goals[gkey(name)]; goals[gkey(name)] = cleanGoal(j); if (old && old.hist && old.items.length === goals[gkey(name)].items.length) goals[gkey(name)].hist = old.hist; if (old && old.order && !goals[gkey(name)].order) goals[gkey(name)].order = old.order; if (old && old.created) goals[gkey(name)].created = old.created; saveGoals(); return goals[gkey(name)]; },
    delGoal: (name) => { delete goals[gkey(name)]; saveGoals(); let ch = false; for (const o of orders) if (o.account && gkey(o.account) === gkey(name)) { delete o.account; ch = true; } if (ch) save(); },
    goalFromSet: (setId, name, masteryKeys) => { // เริ่มติดตามจากเซท (ลูกค้าที่ไม่มีออเดอร์ในเว็บ)
      if (!/^[A-Za-z0-9_]{3,20}$/.test(name)) throw new Error('ชื่อไอดีไม่ถูกต้อง');
      const st = sets.find((x) => x.id === setId); if (!st) throw new Error('ไม่พบเซทนี้');
      const a = st.armor || null, nf = a && a.line === 'Nightfall';
      const o = { pack: st.name, weapon: st.weapon, power: st.power, top: a, bottom: a && nf && a.plus > 3 ? Object.assign({}, a, { plus: 3 }) : a };
      const g = goalFromOrder(o, masteryKeys || []); g.order = '';
      const old = goals[gkey(name)]; if (old && old.order) g.order = old.order;
      goals[gkey(name)] = g; saveGoals(); return g;
    },
    linkOrder: (id, name, masteryKeys) => { if (!/^[A-Za-z0-9_]{3,20}$/.test(name)) throw new Error('ชื่อไอดีไม่ถูกต้อง'); const o = orders.find((x) => x.id === id); if (!o) throw new Error('ไม่พบออเดอร์'); goals[gkey(name)] = goalFromOrder(o, masteryKeys || []); o.account = name; save(); saveGoals(); return goals[gkey(name)]; },
    getSets: () => sets, defaultSets: () => DEFAULT_SETS,
    saveSets: (arr) => { if (!Array.isArray(arr) || arr.length > 40) throw new Error('จำนวนเซทไม่ถูกต้อง (สูงสุด 40)'); const next = arr.map(cleanSet); const t = SETS_FILE + '.tmp'; fs.writeFileSync(t, JSON.stringify(next, null, 1)); fs.renameSync(t, SETS_FILE); sets = next; return sets; },
    list: () => orders.slice(0, 1000),
    update: (id, j) => {
      const o = orders.find((x) => x.id === id); if (!o) throw new Error('ไม่พบออเดอร์');
      if ('status' in j) { if (!STATUSES.includes(j.status)) throw new Error('สถานะไม่ถูกต้อง'); o.status = j.status; }
      if ('quote' in j) { const q = j.quote === '' || j.quote == null ? null : int(j.quote, 0, 10000000); o.quote = q; }
      if ('note' in j) o.note = strML(j.note, 1000);
      save(); return o;
    },
    remove: (id) => { const n = orders.length; orders = orders.filter((x) => x.id !== id); if (orders.length === n) throw new Error('ไม่พบออเดอร์'); save(); },
  };
};

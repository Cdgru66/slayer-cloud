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
    const gear = (g) => (g && typeof g === 'object' ? { line: str(g.line, 30), tier: int(g.tier, 0, 9), plus: int(g.plus, 0, 30) } : null);
    const o = {
      roblox: str(j.roblox, 20).replace(/[^A-Za-z0-9_]/g, ''),
      pack: str(j.pack, 40),
      clan: str(j.clan, 40),
      weapon: j.weapon && typeof j.weapon === 'object' ? Object.assign(gear(j.weapon), { type: str(j.weapon.type, 40), variant: str(j.weapon.variant, 30), mastery: int(j.weapon.mastery, 0, 9999) }) : null,
      power: j.power && typeof j.power === 'object' ? { kind: j.power.kind === 'demon' ? 'demon' : 'breath', name: str(j.power.name, 40), mastery: int(j.power.mastery, 0, 9999) } : null,
      top: gear(j.top), bottom: gear(j.bottom), hat: gear(j.hat),
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
    if (o.pack) L.push('แพ็กเกจ: ' + o.pack);
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
    "id": "gyutaro",
    "name": "Gyutaro",
    "icon": "boss:Gyutai",
    "price": "เริ่มต้น 200 บาท",
    "note": "อสูรข้างขึ้นที่ 6 · เคียวโลหิต",
    "weapon": {
     "type": "Sickles",
     "line": "Nightfall",
     "tier": 3,
     "plus": 10
    },
    "power": {
     "kind": "demon",
     "name": "Blood Manipulation"
    },
    "armor": {
     "line": "Nightfall",
     "tier": 3,
     "plus": 10
    }
   },
   {
    "id": "daki",
    "name": "Daki",
    "icon": "Obi Manipulation Orb",
    "price": "เริ่มต้น 200 บาท",
    "note": "อสูรข้างขึ้นที่ 6 · สายโอบิ",
    "weapon": {
     "type": "Bladed Wagasa",
     "line": "Firstlight",
     "tier": 3,
     "plus": 10
    },
    "power": {
     "kind": "demon",
     "name": "Obi Manipulation"
    },
    "armor": {
     "line": "Firstlight",
     "tier": 3,
     "plus": 10
    }
   },
   {
    "id": "enmu",
    "name": "Enmu",
    "icon": "boss:Enru",
    "price": "เริ่มต้น 200 บาท",
    "note": "อสูรข้างแรมที่ 1 · มนต์ความฝัน",
    "weapon": {
     "type": "Tanto",
     "line": "Firstlight",
     "tier": 3,
     "plus": 10
    },
    "power": {
     "kind": "demon",
     "name": "Dream"
    },
    "armor": {
     "line": "Firstlight",
     "tier": 3,
     "plus": 10
    }
   },
   {
    "id": "nezuko",
    "name": "Nezuko",
    "icon": "boss:Nezura",
    "price": "เริ่มต้น 200 บาท",
    "note": "อสูรสายเพลิงโลหิต · เตะหมัดหนัก",
    "weapon": {
     "type": "Gauntlet",
     "line": "Firstlight",
     "tier": 3,
     "plus": 10
    },
    "power": {
     "kind": "demon",
     "name": "Pyrokinesis"
    },
    "armor": {
     "line": "Firstlight",
     "tier": 3,
     "plus": 10
    }
   },
   {
    "id": "tamayo",
    "name": "Tamayo",
    "icon": "Tamari Orb",
    "price": "เริ่มต้น 200 บาท",
    "note": "อสูรสายมนต์โลหิตสนับสนุน",
    "weapon": {
     "type": "Tanto",
     "line": "Nightfall",
     "tier": 3,
     "plus": 10
    },
    "power": {
     "kind": "demon",
     "name": "Tamari"
    },
    "armor": {
     "line": "Nightfall",
     "tier": 3,
     "plus": 10
    }
   },
   {
    "id": "tanjiro",
    "name": "Tanjiro",
    "icon": "Tidal Katana",
    "price": "เริ่มต้น 200 บาท",
    "note": "ปราณวารี · Tidal Katana",
    "weapon": {
     "type": "Katana",
     "line": "Nightfall",
     "tier": 3,
     "plus": 10
    },
    "power": {
     "kind": "breath",
     "name": "Water"
    },
    "armor": {
     "line": "Nightfall",
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
    "id": "zenitsu",
    "name": "Zenitsu",
    "icon": "boss:Zentaro",
    "price": "เริ่มต้น 200 บาท",
    "note": "ปราณอัสนี · Thundercloud Katana",
    "weapon": {
     "type": "Katana",
     "line": "Nightfall",
     "tier": 3,
     "plus": 10
    },
    "power": {
     "kind": "breath",
     "name": "Thunder"
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
   },
   {
    "id": "muichiro",
    "name": "Muichiro",
    "icon": "Mist Kumo Sodenashi",
    "price": "เริ่มต้น 200 บาท",
    "note": "เสาหลักหมอก",
    "weapon": {
     "type": "Katana",
     "line": "Firstlight",
     "tier": 3,
     "plus": 10
    },
    "power": {
     "kind": "breath",
     "name": "Mist"
    },
    "armor": {
     "line": "Firstlight",
     "tier": 3,
     "plus": 10
    }
   },
   {
    "id": "inosuke",
    "name": "Inosuke",
    "icon": "Beast Core",
    "price": "เริ่มต้น 200 บาท",
    "note": "ปราณสัตว์ร้าย",
    "weapon": {
     "type": "Katana",
     "line": "Nightfall",
     "tier": 3,
     "plus": 10
    },
    "power": {
     "kind": "breath",
     "name": "Beast"
    },
    "armor": {
     "line": "Nightfall",
     "tier": 3,
     "plus": 10
    }
   },
   {
    "id": "kokushibo",
    "name": "Kokushibo",
    "icon": "Moonlit Kata-Aki",
    "price": "เริ่มต้น 200 บาท",
    "note": "อสูรข้างขึ้นที่ 1 · ปราณจันทรา",
    "weapon": {
     "type": "Katana",
     "line": "Nightfall",
     "tier": 3,
     "plus": 10
    },
    "power": {
     "kind": "breath",
     "name": "Moon"
    },
    "armor": {
     "line": "Nightfall",
     "tier": 3,
     "plus": 10
    }
   },
   {
    "id": "yoriichi",
    "name": "Yoriichi",
    "icon": "Firstlight Katana",
    "price": "เริ่มต้น 200 บาท",
    "note": "ปราณตะวัน · ต้นกำเนิดปราณ",
    "weapon": {
     "type": "Katana",
     "line": "Firstlight",
     "tier": 3,
     "plus": 10
    },
    "power": {
     "kind": "breath",
     "name": "Sun"
    },
    "armor": {
     "line": "Firstlight",
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

  function handle(req, res, url, ip) {
    if (url.pathname === '/api/v1/sets' && req.method === 'GET') {
      if (!ctx.rate('sets:' + ip, 60)) { ctx.send(res, 429, { error: 'rate limited' }); return true; }
      ctx.send(res, 200, sets.filter((x) => !x.hidden)); return true;
    }
    if (url.pathname !== '/api/v1/order' || req.method !== 'POST') return false;
    if (!ctx.rate('order:' + ip, 3) || !ctx.rate('orders', 30)) {
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
        try { fs.appendFileSync(path.join(ctx.DATA_DIR, 'orders-archive.jsonl'), old.map((x) => JSON.stringify(x)).join('\n') + '\n'); } catch (e) {}
      }
      try { save(); } catch (e) { return ctx.send(res, 500, { error: 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง' }); }
      ctx.notifyOwner({ embeds: [{ title: `🛒 ออเดอร์ใหม่ ${id}`, description: md(summary(rec)).slice(0, 3500), color: 0xe2b65c,
        fields: [{ name: 'ติดต่อกลับ', value: md(`${rec.contact.via}: ${rec.contact.handle}`).slice(0, 1000) }], timestamp: new Date().toISOString() }] });
      ctx.send(res, 200, { ok: true, id });
    });
    return true;
  }

  return {
    handle, summary, STATUSES,
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

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
      weapon: j.weapon && typeof j.weapon === 'object' ? Object.assign(gear(j.weapon), { type: str(j.weapon.type, 40), mastery: int(j.weapon.mastery, 0, 9999) }) : null,
      power: j.power && typeof j.power === 'object' ? { kind: j.power.kind === 'demon' ? 'demon' : 'breath', name: str(j.power.name, 40), mastery: int(j.power.mastery, 0, 9999) } : null,
      top: gear(j.top), bottom: gear(j.bottom),
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
    if (o.weapon && o.weapon.type) L.push(`อาวุธ: ${o.weapon.type} ${g(o.weapon)}`.trim() + (o.weapon.mastery ? ` (ฟาร์มให้จน Mastery ${o.weapon.mastery})` : ''));
    if (o.power && o.power.name) L.push(`${o.power.kind === 'demon' ? 'มนต์อสูร' : 'ปราณ'}: ${o.power.name}` + (o.power.mastery ? ` (ฟาร์มให้จน Mastery ${o.power.mastery})` : ''));
    if (g(o.top) && g(o.top) === g(o.bottom)) L.push('เสื้อ, กางเกง: ' + g(o.top));
    else { if (g(o.top)) L.push('เสื้อ: ' + g(o.top)); if (g(o.bottom)) L.push('กางเกง: ' + g(o.bottom)); }
    if (o.title) L.push('ฉายา: ' + o.title);
    if (o.level) L.push('เลเวล: ' + o.level);
    if (o.roblox) L.push('ไอดี Roblox: ' + o.roblox);
    if (o.brief) L.push('บรีฟเพิ่มเติม: ' + o.brief);
    return L.join('\n');
  };

  function handle(req, res, url, ip) {
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

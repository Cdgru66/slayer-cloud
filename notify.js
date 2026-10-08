'use strict';
// สถิติรายวัน + แจ้งเตือน Discord
//  - สถิติ: เก็บค่าต้นวัน/ปลายวันของ Wen, kills, boss kills, เลเวล ต่อไอดี (30 วันล่าสุด) ไว้ใน a.days ให้หน้าเว็บวาดกราฟ
//  - แจ้งเตือน: สรุปรายวัน, เลเวลอัป, ได้ของหายาก, ไอดีค้าง, ลูกค้าใกล้หมดอายุ
//    ส่งเข้า Discord ของเจ้าของ (ตั้งในหน้าแอดมิน/เมนูรีจอย) และ Discord ของลูกค้าแต่ละคน (ถ้าตั้งไว้)
const fs = require('fs');
const path = require('path');

const DISCORD_RE = /^https:\/\/(discord\.com|discordapp\.com|ptb\.discord\.com|canary\.discord\.com)\/api\/webhooks\/\d+\/[\w-]+$/;
const DEFAULT_RARE = ['Mythic Refinement Ore', 'Firstlight Star Ore', 'Golden Tentacle', 'Frozen Heart'];
const RARE_CATS = ['Evil Art Orbs'];
const KEEP_DAYS = 30;

module.exports = function createNotify(ctx) {
  const { DATA_DIR, now } = ctx;
  const CFG_FILE = path.join(DATA_DIR, 'notify.json');
  const STATE_FILE = path.join(DATA_DIR, 'notify-state.json');
  const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return d; } };
  const writeJson = (f, j) => { const t = f + '.tmp'; fs.writeFileSync(t, JSON.stringify(j, null, 2)); fs.renameSync(t, f); };
  const defaults = { daily: true, dailyHour: 9, levelUp: true, rare: true, rareList: DEFAULT_RARE, stuck: true, stuckMin: 15, expiry: true, expiryDays: 3, customers: true };
  let cfg = Object.assign({}, defaults, readJson(CFG_FILE, {}));
  const state = Object.assign({ lastDaily: '', stuckAlerted: {}, expiryAlerted: {} }, readJson(STATE_FILE, {}));
  const saveState = () => { try { writeJson(STATE_FILE, state); } catch (e) {} };
  const prev = new Map(); // ชื่อไอดี -> { level, items: {ชื่อของ: จำนวน} }

  const dayKey = (t) => { const d = new Date(t * 1000), z = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; };
  const fmt = (n) => Math.round(n || 0).toLocaleString('en-US');
  const ownerOf = (name) => {
    const n = name.toLowerCase();
    for (const [id, c] of Object.entries(ctx.customers() || {})) if ((c.accounts || []).some((x) => x.toLowerCase() === n)) return Object.assign({ id }, c);
    return null;
  };
  const isRare = (it) => (cfg.rareList || []).includes(it.name) || (it.cat && RARE_CATS.includes(it.cat));

  // ---------- ส่ง Discord (คิวทีละข้อความ ไม่ชนลิมิตของ Discord) ----------
  const queue = []; let sending = false;
  function post(url, payload) {
    if (!DISCORD_RE.test(url || '')) return;
    queue.push({ url, payload });
    if (queue.length > 200) queue.splice(0, queue.length - 200);
    pump();
  }
  async function pump() {
    if (sending) return; sending = true;
    while (queue.length) {
      const { url, payload } = queue.shift();
      try {
        const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ username: 'Slayer Fleet' }, payload)), signal: AbortSignal.timeout(10000) });
        if (r.status === 429) { const j = await r.json().catch(() => ({})); await new Promise((res) => setTimeout(res, Math.min(30000, (j.retry_after || 2) * 1000))); queue.unshift({ url, payload }); continue; }
      } catch (e) {}
      await new Promise((res) => setTimeout(res, 1200));
    }
    sending = false;
  }
  const embed = (title, desc, color, fields) => ({ embeds: [{ title, description: desc, color, fields, timestamp: new Date().toISOString(), footer: { text: 'Slayer Fleet' } }] });
  // ส่งให้เจ้าของ และลูกค้าเจ้าของไอดี (ถ้ามี webhook และเปิดให้ลูกค้าได้รับ)
  function emit(accountName, payload, toCustomer = true) {
    post(ctx.ownerWebhook(), payload);
    if (toCustomer && cfg.customers && accountName) { const c = ownerOf(accountName); if (c && c.webhook && !c.revoked) post(c.webhook, payload); }
  }

  // ---------- เมื่อได้ข้อมูลใหม่ของไอดี ----------
  function onSnapshot(isOwnerPool, name, a) {
    const s = a.s; if (!s) return;
    // สถิติรายวัน
    const key = dayKey(s.time), w = Number(s.wen) || 0, p = s.progress || {};
    a.days = a.days || {};
    const d = a.days[key] || (a.days[key] = { w0: w, k0: p.kills || 0, b0: p.boss_kills || 0, l0: s.level || 0 });
    Object.assign(d, { w1: w, k1: p.kills || 0, b1: p.boss_kills || 0, l1: s.level || 0, t: s.time });
    const keys = Object.keys(a.days).sort(); for (const k of keys.slice(0, Math.max(0, keys.length - KEEP_DAYS))) delete a.days[k];
    if (!isOwnerPool) return;

    // แจ้งเตือนเหตุการณ์ (เทียบกับรอบก่อน ครั้งแรกที่เห็นไอดีจะไม่แจ้ง)
    const items = {}; for (const it of s.items || []) items[it.name] = it.amount;
    const pv = prev.get(name);
    prev.set(name, { level: s.level, items });
    if (!pv) return;
    const who = s.display && s.display !== name ? `${s.display} (@${name})` : name;
    if (cfg.levelUp && s.level > (pv.level || 0) && pv.level) {
      emit(name, embed(`⬆️ เลเวลอัป: ${who}`, `เลเวล **${pv.level} → ${s.level}**`, 0xe2b65c));
    }
    if (cfg.rare) {
      const got = (s.items || []).filter((it) => isRare(it) && it.amount > (pv.items[it.name] || 0));
      if (got.length) emit(name, embed(`💎 ได้ของหายาก: ${who}`, got.map((it) => `**${it.name}** +${fmt(it.amount - (pv.items[it.name] || 0))} (มี ${fmt(it.amount)})`).join('\n'), 0x9db8c9));
    }
  }

  // ---------- ตรวจเป็นระยะ: ค้าง / สรุปรายวัน / ใกล้หมดอายุ ----------
  function tick() {
    if (ctx.mode() !== 'owner') return;
    const t = now(), pool = ctx.pool();
    if (cfg.stuck) {
      for (const [name, a] of Object.entries(pool)) {
        if (!a.s) continue;
        const iv = a.s.interval || 300;
        if (t - a.s.time > Math.max(90, iv * 2.5)) { delete state.stuckAlerted[name]; continue; } // ออฟไลน์ (รีจอยดูแล)
        const win = (cfg.stuckMin || 15) * 60, h = (a.hist || []).filter((x) => x.t >= t - win);
        const stuck = h.length >= 3 && h[h.length - 1].t - h[0].t >= win * 0.8 && h.every((x) => x.w === h[0].w && x.k === h[0].k);
        if (stuck && !state.stuckAlerted[name]) { state.stuckAlerted[name] = t; saveState(); emit(name, embed(`⏸️ ไอดีค้าง: ${name}`, `Wen และจำนวนที่ฆ่าไม่ขยับมา ${cfg.stuckMin || 15} นาที (ยังออนไลน์อยู่) ลองเช็คในเกม`, 0xe9a24a), false); }
        if (!stuck && state.stuckAlerted[name]) { delete state.stuckAlerted[name]; saveState(); }
      }
    }
    const nowD = new Date(t * 1000), today = dayKey(t);
    if (nowD.getHours() >= (cfg.dailyHour ?? 9) && state.lastDaily !== today) {
      state.lastDaily = today; saveState();
      const y = dayKey(t - 86400);
      if (cfg.daily) dailySummary(y, pool);
      if (cfg.expiry) expiryCheck(t);
    }
  }
  function summarize(names, pool, y) {
    const rows = []; let tw = 0, tb = 0;
    for (const n of names) {
      const d = pool[n] && pool[n].days && pool[n].days[y]; if (!d) continue;
      const gw = (d.w1 || 0) - (d.w0 || 0), gb = (d.b1 || 0) - (d.b0 || 0), gl = (d.l1 || 0) - (d.l0 || 0);
      tw += gw; tb += gb;
      rows.push(`**${n}**  Wen ${gw >= 0 ? '+' : ''}${fmt(gw)} · บอส ${fmt(gb)}${gl > 0 ? ` · เลเวล +${gl} (${d.l1})` : ''}`);
    }
    return { rows, tw, tb };
  }
  function dailySummary(y, pool) {
    const all = summarize(Object.keys(pool), pool, y);
    if (all.rows.length) post(ctx.ownerWebhook(), embed(`📊 สรุปวันที่ ${y}`, all.rows.slice(0, 40).join('\n'), 0x5fd0a0,
      [{ name: 'Wen รวม', value: (all.tw >= 0 ? '+' : '') + fmt(all.tw), inline: true }, { name: 'บอสรวม', value: fmt(all.tb), inline: true }, { name: 'ไอดี', value: String(all.rows.length), inline: true }]));
    if (!cfg.customers) return;
    for (const c of Object.values(ctx.customers() || {})) {
      if (!c.webhook || c.revoked) continue;
      const mine = Object.keys(pool).filter((n) => (c.accounts || []).some((x) => x.toLowerCase() === n.toLowerCase()));
      const r = summarize(mine, pool, y);
      if (r.rows.length) post(c.webhook, embed(`📊 สรุปวันที่ ${y}`, r.rows.join('\n'), 0x5fd0a0,
        [{ name: 'Wen รวม', value: (r.tw >= 0 ? '+' : '') + fmt(r.tw), inline: true }, { name: 'บอสรวม', value: fmt(r.tb), inline: true }]));
    }
  }
  function expiryCheck(t) {
    const days = cfg.expiryDays || 3;
    for (const [id, c] of Object.entries(ctx.customers() || {})) {
      if (c.revoked || !c.expires) continue;
      const left = (c.expires - t) / 86400;
      if (left > days || left < -1) continue;
      const tag = id + ':' + c.expires; if (state.expiryAlerted[tag]) continue;
      state.expiryAlerted[tag] = t; saveState();
      const when = new Date(c.expires * 1000).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
      post(ctx.ownerWebhook(), embed(left > 0 ? `⏳ ลูกค้าใกล้หมดอายุ: ${c.name}` : `⌛ ลูกค้าหมดอายุแล้ว: ${c.name}`, `หมดอายุ ${when}`, 0xd8432c));
      if (cfg.customers && c.webhook && left > 0) post(c.webhook, embed('⏳ บริการใกล้หมดอายุ', `บริการของคุณจะหมดอายุ ${when} ติดต่อร้านเพื่อต่ออายุ`, 0xd8432c));
    }
  }
  setInterval(() => { try { tick(); } catch (e) { console.error('notify tick:', e.message); } }, Number(process.env.NOTIFY_TICK_MS) || 60000).unref();

  return {
    onSnapshot, tick,
    postOwner: (payload) => post(ctx.ownerWebhook(), Object.assign({}, payload)),
    publicCfg: () => Object.assign({}, cfg, { ownerWebhook: !!ctx.ownerWebhook() }),
    setCfg: (j) => {
      const c = Object.assign({}, cfg);
      for (const k of ['daily', 'levelUp', 'rare', 'stuck', 'expiry', 'customers']) if (k in j) c[k] = !!j[k];
      if ('dailyHour' in j) { const n = Number(j.dailyHour); if (!(n >= 0 && n <= 23)) throw new Error('ชั่วโมงต้องอยู่ระหว่าง 0-23'); c.dailyHour = n; }
      if ('stuckMin' in j) { const n = Number(j.stuckMin); if (!(n >= 5 && n <= 240)) throw new Error('นาทีค้างต้องอยู่ระหว่าง 5-240'); c.stuckMin = n; }
      if ('expiryDays' in j) { const n = Number(j.expiryDays); if (!(n >= 1 && n <= 30)) throw new Error('วันต้องอยู่ระหว่าง 1-30'); c.expiryDays = n; }
      if (Array.isArray(j.rareList)) c.rareList = j.rareList.map((x) => String(x).trim()).filter((x) => x && x.length <= 60).slice(0, 100);
      cfg = c; writeJson(CFG_FILE, cfg);
    },
    test: async () => {
      const url = ctx.ownerWebhook();
      if (!DISCORD_RE.test(url || '')) return { ok: false, error: 'ยังไม่ได้ตั้ง Discord webhook ของร้าน' };
      try {
        const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ username: 'Slayer Fleet' }, embed('✅ ทดสอบแจ้งเตือน', 'Slayer Fleet ส่งแจ้งเตือนเข้าห้องนี้ได้แล้ว', 0x5fd0a0))), signal: AbortSignal.timeout(10000) });
        return r.ok ? { ok: true } : { ok: false, error: 'Discord ตอบกลับ ' + r.status };
      } catch (e) { return { ok: false, error: 'ส่งไม่ได้: ' + e.message }; }
    },
  };
};

const THRESH=900; // เงียบเกิน 900 วิ = ออฟไลน์ (ถ้าสคริปต์ไม่ได้บอกรอบส่ง)
const ORE=['Ore','Refinement Ore'],COINS=['Coin','Coin Stack','Coin Pile'],COIN_TH={'Coin':'เหรียญ','Coin Stack':'กองเหรียญ','Coin Pile':'ถุงเหรียญ'};
const A=new Map(),ICONS={};let demo=true,timer,poll,live=false,DS=[],flt='all',q='',open=null;
const $=s=>document.querySelector(s),now=()=>Date.now()/1000;
const h=(t,a={},...k)=>{const e=document.createElement(t);for(const[x,v]of Object.entries(a)){if(x==='class')e.className=v;else if(x.startsWith('on'))e[x]=v;else e.setAttribute(x,v)}for(const c of k.flat()){if(c==null||c===false)continue;e.append(c.nodeType?c:document.createTextNode(c))}return e};
const cm=n=>n==null?'–':Math.abs(n)>=1e6?(n/1e6).toFixed(2)+'M':Math.abs(n)>=1e3?(n/1e3).toFixed(1)+'K':String(Math.round(n));
const ago=s=>s<90?Math.round(s)+' วิ':s<5400?Math.round(s/60)+' นาที':Math.round(s/3600)+' ชม.';
const ST={on:['ออนไลน์','var(--ok)'],stuck:['ค้าง','var(--warn)'],off:['ออฟไลน์','var(--mu)']};
/* ไอคอนสำรองของ 5 อย่างหลัก (ใช้เมื่อยังไม่มีรูปจากเกม) */
const G={
 'Ore':'<svg viewBox="0 0 32 32"><defs><linearGradient id="sfg-go" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c9dbe6"/><stop offset="1" stop-color="#4f6575"/></linearGradient></defs><path d="M6 20 10 9l9-4 8 7-2 11-11 4z" fill="url(#sfg-go)"/><path d="M10 9l5 8 12-5M15 17l-1 10M15 17 6 20" stroke="#24323c" stroke-width="1" fill="none" opacity=".55"/></svg>',
 'Refinement Ore':'<svg viewBox="0 0 32 32"><defs><linearGradient id="sfg-gr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8f3fa"/><stop offset="1" stop-color="#6f93ab"/></linearGradient></defs><path d="M16 3l8 8-8 18-8-18z" fill="url(#sfg-gr)"/><path d="M8 11h16M16 3l-3 8 3 18 3-18z" stroke="#2c4250" stroke-width=".9" fill="none" opacity=".5"/></svg>',
 'Coin':'<svg viewBox="0 0 32 32"><defs><radialGradient id="sfg-gc" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fbe7b0"/><stop offset=".6" stop-color="#e2b65c"/><stop offset="1" stop-color="#8f6c2c"/></radialGradient></defs><circle cx="16" cy="16" r="12" fill="url(#sfg-gc)"/><circle cx="16" cy="16" r="9" fill="none" stroke="#8f6c2c" stroke-width="1"/><rect x="13" y="13" width="6" height="6" rx=".8" fill="#2a1a0c"/></svg>',
 'Coin Stack':'<svg viewBox="0 0 32 32"><defs><linearGradient id="sfg-gs" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9a722e"/><stop offset=".5" stop-color="#f1cf7e"/><stop offset="1" stop-color="#9a722e"/></linearGradient></defs><g fill="url(#sfg-gs)" stroke="#6b4d1c" stroke-width=".8"><path d="M6 22v4c0 1.7 4.5 3 10 3s10-1.3 10-3v-4"/><ellipse cx="16" cy="22" rx="10" ry="3"/><path d="M6 16v4c0 1.7 4.5 3 10 3s10-1.3 10-3v-4"/><ellipse cx="16" cy="16" rx="10" ry="3"/><path d="M6 10v4c0 1.7 4.5 3 10 3s10-1.3 10-3v-4"/><ellipse cx="16" cy="10" rx="10" ry="3"/></g></svg>',
 'Coin Pile':'<svg viewBox="0 0 32 32"><defs><radialGradient id="sfg-gp" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#f4d58c"/><stop offset="1" stop-color="#8a5f22"/></radialGradient></defs><path d="M12 8c-1-2 1-4 4-4s5 2 4 4z" fill="#8a5f22"/><path d="M11 9h10c5 4 7 8 7 12 0 5-5 7-12 7S4 26 4 21c0-4 2-8 7-12z" fill="url(#sfg-gp)"/><path d="M11 9h10" stroke="#5a3c12" stroke-width="2" stroke-linecap="round"/><circle cx="16" cy="19" r="4" fill="none" stroke="#5a3c12" stroke-width="1.2" opacity=".7"/><rect x="14.6" y="17.6" width="2.8" height="2.8" fill="#5a3c12" opacity=".7"/></svg>'};
function glyph(n,z){const sp=h('span',{class:'ic gl',style:`width:${z}px;height:${z}px`});sp.innerHTML=G[n];return sp}
function ico(n,u,z=20){if((!u||!/^https:/.test(u))&&G[n])return glyph(n,z);const hue=[...n].reduce((a,c)=>a+c.charCodeAt(0),0)%360,f=()=>h('span',{class:'ic',style:`width:${z}px;height:${z}px;background:hsl(${hue} 35% 24%);font-size:${Math.round(z*.45)}px;border-radius:${Math.round(z*.25)}px`},n[0]||'?');if(!u||!/^https:/.test(u))return f();const i=h('img',{class:'ic',src:u,alt:'',width:z,height:z,referrerpolicy:'no-referrer',style:`border-radius:${Math.round(z*.25)}px`});i.onerror=()=>i.replaceWith(f());return i}
function upsert(s){let a=A.get(s.name);if(!a){a={hist:[]};A.set(s.name,a)}a.s=s;const l=a.hist[a.hist.length-1];if(!l||l.t!==s.time){a.hist.push({t:s.time,w:s.wen||0,k:(s.progress&&s.progress.kills)||0,b:(s.progress&&s.progress.boss_kills)||0});if(a.hist.length>400)a.hist.shift()}}
function lim(a){const i=a.s.interval;return i?Math.max(90,i*2.5):THRESH}
function stat(a){if(now()-a.s.time>lim(a))return'off';const i=a.s.interval||300,W=Math.max(1200,i*6),p=a.hist.filter(x=>x.t>=now()-W);return p.length>=3&&p[p.length-1].t-p[0].t>=Math.max(600,i*3)&&p.every(x=>x.w===p[0].w&&x.k===p[0].k)?'stuck':'on'}
function rate(a){const p=a.hist.filter(x=>x.t>=now()-3600);if(p.length<2)return null;const f=p[0],l=p[p.length-1],d=l.t-f.t;return d<120?null:(l.w-f.w)/(d/3600)}
/* นับถอยหลังรอบอัปเดต + บอส */
const mmss=x=>{x=Math.max(0,Math.round(x));return Math.floor(x/60)+':'+String(x%60).padStart(2,'0')};
const nextIn=a=>a.s.time+(a.s.interval||300)-now();
function cdText(a,st){if(st==='off'){if(a.rejoin&&now()-a.rejoin.at<600)return'กำลังเข้าเกมใหม่…'+(a.rejoin.n>1?' (ครั้งที่ '+a.rejoin.n+')':'');return'ออฟไลน์ '+ago(now()-a.s.time)}const l=nextIn(a);return l>0?'อีก '+mmss(l):l>-30?'กำลังอัปเดต…':'ไม่มีข้อมูลใหม่ '+mmss(-l)}
function bossRate(a){const p=a.hist.filter(x=>x.t>=now()-3600&&x.b!=null);if(p.length<2)return null;return Math.max(0,p[p.length-1].b-p[0].b)}
function power(s){if(s.demonArt)return h('span',{class:'pw demon',title:'Demon Art (มนต์อสูรโลหิต)'},h('b',{},'鬼'),s.demonArt);if(s.breathing)return h('span',{class:'pw',title:'Breathing'},h('b',{},'息'),s.breathing);return null}
function fight(s,st,big){if(!s.boss||st==='off')return null;return h('span',{class:'fight'+(big?' big':''),title:'บอสที่อยู่ใกล้ตัวละครที่สุดตอนส่งข้อมูล'},h('i',{class:'sw','aria-hidden':'true'}),'กำลังสู้ ',h('b',{},s.boss.name),s.boss.hp!=null?h('span',{class:'hp'},h('i',{style:`width:${Math.max(0,Math.min(100,s.boss.hp))}%`})):null)}
function tickCd(){document.querySelectorAll('[data-cd]').forEach(el=>{const a=A.get(el.dataset.cd);if(!a)return;const st=stat(a);el.textContent=cdText(a,st);el.classList.toggle('late',st!=='off'&&nextIn(a)<=-30);el.classList.toggle('rj',st==='off'&&!!a.rejoin&&now()-a.rejoin.at<600)});
 const on=[...A.values()].filter(a=>stat(a)!=='off');const el=$('#t-next');if(!el)return;
 if(!on.length){el.textContent='';return}const iv=Math.min(...on.map(a=>a.s.interval||300)),l=Math.min(...on.map(nextIn));
 el.replaceChildren(h('i',{class:'live'+(l<=0?(l>-30?' busy':' late'):'')}),l>0?'อัปเดตทุก '+Math.round(iv/60)+' นาที · รอบถัดไปใน '+mmss(l):l>-30?'กำลังรับข้อมูลรอบใหม่…':'ยังไม่ได้รับข้อมูลรอบใหม่ (เลยมา '+mmss(-l)+')')}
setInterval(tickCd,1000);
const amt=(a,n)=>(a.s.items.find(i=>i.name===n)||{}).amount||0;
const iconOf=it=>it&&(it.iconUrl||ICONS[it.name]);
const itm=(a,n)=>a.s.items.find(i=>i.name===n);
const full=n=>n==null?'–':Math.round(n).toLocaleString('en-US');
function bar(r){return h('div',{class:'bar'},h('i',{style:`width:${Math.max(0,Math.min(1,r))*100}%`}))}

/* ---------- ข้อมูลตัวอย่าง ---------- */
const NAMES=['Cullipoper22535','Mincepaetz7297','Blopcoco22','Bryanzen884','Covertail51','Cubmoon3320','Cuyrox191','Dashiel7788','Emberkit42','Frostgale906','Gyoreiii77','Hanabi2201','Inosukex14','Zenitsuv88'];
function mk(i){const r=Math.random,n=x=>Math.round(r()*x),it=(a,b)=>({name:a,amount:b,delta:0});
return{name:NAMES[i],display:NAMES[i].replace(/\d+$/,''),userId:1e9+i,time:now(),interval:120,boss:i%3?{name:['Akazo','Gyorei','Zuko','Enru','Rengu'][i%5],hp:20+n(80),dist:30}:undefined,level:[225,225,225,225,225,225,191,59,225,225,191,225,200,225][i],slayerRank:'Mizunoto',demonRank:'Thrall',clan:['Tomioka','Kamado','Agatsuma'][i%3],race:i%4===1?'Demon':'Human',breathing:i%4===1?undefined:['Water','Flame','Thunder'][i%3],demonArt:i%4===1?['Blood Whip','Frost Lotus','Thread Weaver'][i%3]:undefined,fightingStyle:i%2?'Gauntlet':undefined,wen:200000+n(600000),expCurrent:n(13500),expGoal:13500,skillPoints:n(30),reputation:-n(9000),stamina:700,hp:1801,maxHp:1801,progress:{kills:n(4000),boss_kills:n(1200),deaths:n(900),chests:n(800),quests:n(460),tower_floor:n(60)},mastery:{Water:{current:3940,goal:5220},Sword:{current:1931,goal:6990},Fist:{current:90,goal:270},Spear:{current:1033,goal:1980}},items:[it('Ore',n(30)),it('Refinement Ore',n(8000)),it('Coin',n(40)),it('Coin Stack',n(8)),it('Coin Pile',n(6)),it('Metal Scraps',n(5000)),it('Silk Thread',n(5000)),it('Beast Core',n(60)),it('Demon Horns',n(50)),it('Health Potion',n(250)),{...it('Water Katana',1),equipped:i%2===0},it('Cutlass',1),{...it('Masquerade Mask',1),equipped:true},it('Kasumi Yukata',2),{...it('Prayer of wind Necklace',1),equipped:true},it('Nightfall Scythe Schematic',1),it('Demonic Lantern',n(3))]}}
function seed(){A.clear();DS=NAMES.map((_,i)=>mk(i));DS.forEach((s,i)=>{s._m=i<8?'on':i===10?'stuck':'off';const b=s.wen;const ph=Math.random()*110;for(let k=30;k>=0;k--)upsert({...s,time:now()-ph-k*120-(s._m==='off'?3600:0),wen:s._m==='on'?b-k*180:b,progress:{...s.progress,boss_kills:s.progress.boss_kills-(s._m==='on'?k:0)}});s.time=now()-ph})}
function tick(){DS.forEach(s=>{if(s._m==='off'||now()-s.time<s.interval)return;s.progress.boss_kills++;if(s._m==='on'){s.wen+=5+Math.random()*5|0;const d=Math.random()*30|0;s.items[1].amount+=d;s.items[1].delta=d}s.time=now();upsert({...s})});render()}
function startDemo(){demo=true;clearInterval(poll);seed();clearInterval(timer);timer=setInterval(tick,5000);$('#mode').textContent='โหมดตัวอย่าง: ข้อมูลสุ่มเพื่อดูหน้าตา';render()}

/* ---------- ข้อมูลจริง ---------- */
function ingest(d){if(!d||typeof d!=='object')return;
 if(Array.isArray(d.items)&&(d.name||d.userId)){if(demo){demo=false;clearInterval(timer);A.clear();$('#mode').textContent='ข้อมูลจริงจากไฟล์'}upsert(d)}
 else if(Array.isArray(d.items)&&d.count!=null)d.items.forEach(e=>{if(e.name&&e.iconUrl)ICONS[e.name]=e.iconUrl})}
async function readFiles(fs){for(const f of fs){try{ingest(JSON.parse(await f.text()))}catch(e){alert(f.name+': อ่านไฟล์ไม่ได้ (ไม่ใช่ JSON ที่สคริปต์สร้าง)')}}render()}
$('#bf').onchange=e=>readFiles(e.target.files);
addEventListener('dragover',e=>e.preventDefault());addEventListener('drop',e=>{e.preventDefault();readFiles(e.dataTransfer.files)});
$('#bw').onclick=async()=>{if(!window.showDirectoryPicker){alert('ฟีเจอร์นี้ใช้ได้ใน Chrome หรือ Edge บนคอม');return}
 try{const dir=await showDirectoryPicker(),seen={};
 const loop=async()=>{for await(const[n,hd]of dir.entries()){if(hd.kind!=='file'||!/^(slayer_export.*|slayer_icons)\.json$/.test(n))continue;const f=await hd.getFile();if(seen[n]===f.lastModified)continue;seen[n]=f.lastModified;try{ingest(JSON.parse(await f.text()))}catch(e){}}render()};
 await loop();setInterval(loop,3000);$('#mode').textContent='เฝ้าโฟลเดอร์ทุก 3 วินาที'}catch(e){}};
$('#bd').onclick=startDemo;

/* ---------- แสดงผล ---------- */
function resRow(name,label,total,url,z,cls){return h('div',{class:'ri'+(cls?' '+cls:'')},ico(name,url,z),h('span',{class:'nm'},label),h('span',{class:'v',title:full(total)},cm(total)))}
function lvSeal(s){const L=s.level;return h('div',{class:'lv'+(L>=225?' max':''),title:'เลเวล '+(L??'–')},h('small',{},'Lv'),h('b',{},L??'–'))}
function render(){
 const L=[...A.values()].map(a=>({a,st:stat(a)})),c={all:L.length,on:0,stuck:0,off:0};L.forEach(x=>c[x.st]++);
 for(const k in c)$('#n-'+k).textContent=c[k];
 const sum=f=>L.reduce((t,x)=>t+(f(x.a)||0),0),firstIcon=n=>{for(const x of L){const u=iconOf(itm(x.a,n));if(u)return u}return ICONS[n]};
 $('#t-on').textContent=(c.on+c.stuck)+' / '+c.all;
 const tw=sum(a=>a.s.wen);$('#t-wen').textContent=cm(tw);$('#t-wen').title=full(tw)+' Wen';
 const tr=L.reduce((t,x)=>t+(x.st==='on'?rate(x.a)||0:0),0);$('#t-rate').textContent=(tr>0?'+':'')+cm(tr);
 $('#t-ore').replaceChildren(...ORE.map(n=>resRow(n,n==='Ore'?'Ore':'Refinement Ore',sum(a=>amt(a,n)),firstIcon(n),40)));
 $('#t-coin').replaceChildren(...COINS.map(n=>resRow(n,COIN_TH[n],sum(a=>amt(a,n)),firstIcon(n),30,'sm')));
 const o={on:0,stuck:1,off:2};L.sort((x,y)=>o[x.st]-o[y.st]||(y.a.s.wen||0)-(x.a.s.wen||0)||x.a.s.name.localeCompare(y.a.s.name));
 $('#strip').replaceChildren(h('span',{},'สถานะแต่ละไอดี'),...L.map(x=>h('i',{class:'tk '+x.st,title:x.a.s.name+' : '+ST[x.st][0]})));
 const F=L.filter(x=>(flt==='all'||x.st===flt)&&(x.a.s.name+(x.a.s.display||'')).toLowerCase().includes(q));
 if(!F.length){$('#tb').replaceChildren(h('p',{class:'empty'},L.length?'ไม่มีไอดีที่ตรงกับตัวกรองนี้':'ยังไม่มีไอดี ข้อมูลจะขึ้นที่นี่ทันทีที่สคริปต์ส่งเข้ามา'));drawer();return}
 $('#tb').replaceChildren(...F.map(({a,st})=>{const s=a.s,r=rate(a),e=s.expGoal?s.expCurrent/s.expGoal:0;
  const coinEls=COINS.map(n=>{const it=itm(a,n);return it?h('span',{title:COIN_TH[n]+' '+full(it.amount)},ico(n,iconOf(it),20),cm(it.amount)):null}).filter(Boolean);
  const oreV=amt(a,'Ore'),refV=amt(a,'Refinement Ore'),coinT=COINS.reduce((t,n)=>t+amt(a,n),0);
  return h('div',{class:'row'+(st==='off'?' off':''),tabindex:'0',role:'button','aria-label':(s.display||s.name)+' เลเวล '+(s.level??'–'),onclick:()=>show(s.name),onkeydown:ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();show(s.name)}}},
   lvSeal(s),
   h('div',{class:'who'},h('div',{class:'nm'},h('i',{class:'dot',style:'--c:'+ST[st][1],title:ST[st][0]}),s.display||s.name),h('div',{class:'us'},s.name,power(s),fight(s,st)),h('div',{class:'exp',title:'EXP '+Math.round(e*100)+'%'},h('i',{style:`width:${Math.max(0,Math.min(1,e))*100}%`}))),
   h('div',{class:'c wen-c',title:full(s.wen)+' Wen'},cm(s.wen)),
   h('div',{class:'c ore-c',title:full(oreV)},cm(oreV)),
   h('div',{class:'c ore-c ref-c',title:full(refV)},cm(refV)),
   h('div',{class:'c cn'},coinEls.length?coinEls:h('span',{class:'mu'},'–')),
   h('div',{class:'c rt '+(r>0?'up':'mu')},r==null?'–':(r>0?'+':'')+cm(r)),
   h('div',{class:'c ago','data-cd':s.name},cdText(a,st)),
   h('div',{class:'mstats'},h('span',{class:'o'},'Ore ',h('b',{},cm(oreV))),h('span',{class:'o'},'Refinement ',h('b',{},cm(refV))),h('span',{class:'g'},'ถุงเงิน ',h('b',{},cm(coinT))),r>0?h('span',{},h('b',{class:'up'},'+'+cm(r)+'/ชม.')):null,h('span',{class:'cdm','data-cd':s.name},cdText(a,st))))}));
 tickCd();
 drawer()}
/* ---------- กระเป๋า (แยกหมวด) ---------- */
const CATS=[
 ['เงิน',n=>/^Coin( Stack| Pile)?$/.test(n)],
 ['แร่และวัตถุดิบ',n=>/\b(Ore|Ingot|Scraps?|Thread|Core|Horns?|Fang|Claw|Essence|Shard|Crystal|Material)\b/i.test(n)],
 ['ยาและของใช้',n=>/\b(Potion|Lantern|Elixir|Scroll|Food|Bait|Key|Box|Chest|Clan Skills)\b/i.test(n)],
 ['สูตรคราฟต์',n=>/Schematic/i.test(n)],
 ['อาวุธ',n=>/\b(Katana|Sword|Cutlass|Scythe|Sickles?|Fans?|Spear|Gauntlets?|Axe|Blade|Combat|Whip|Bow|Hammer|Nichirin)\b/i.test(n)],
 ['ชุดและเครื่องประดับ',()=>true]];
function bag(s){const its=(s.items||[]).filter(i=>i.amount>0);if(!its.length)return[h('h3',{},'กระเป๋า'),h('p',{class:'mu',style:'font-size:13px'},'ยังไม่มีข้อมูลกระเป๋า')];
 const g=CATS.map(c=>({t:c[0],f:c[1],l:[]}));for(const it of its)g.find(c=>c.f(it.name)).l.push(it);
 const out=[h('h3',{},'กระเป๋า · '+its.length+' ชนิด')];
 for(const c of g){if(!c.l.length)continue;c.l.sort((a,b)=>(b.equipped?1:0)-(a.equipped?1:0)||b.amount-a.amount||a.name.localeCompare(b.name));
  out.push(h('div',{class:'bagc'},h('p',{class:'bagt'},c.t,h('span',{},c.l.length)),h('div',{class:'ig'},c.l.map(it=>h('div',{class:'it'+(it.equipped?' eq':'')},ico(it.name,iconOf(it),30),h('span',{class:'itn',title:it.name},it.name,it.equipped?h('em',{},'ใส่อยู่'):null),h('b',{title:full(it.amount)},(it.amount>1||!it.equipped?'x'+cm(it.amount):'')),it.delta?h('i',{class:'dl '+(it.delta>0?'up':'dn')},(it.delta>0?'+':'')+it.delta):null)))))}
 return out}
function show(n){open=n;drawer();$('#dr').classList.add('open');$('#scrim').classList.add('on')}
function hide(){open=null;$('#dr').classList.remove('open');if(!$('#cl').classList.contains('open'))$('#scrim').classList.remove('on')}
addEventListener('keydown',e=>{if(e.key==='Escape')hide()});
function drawer(){const a=A.get(open),d=$('#dr');if(!a){if(open)hide();return}
 const s=a.s,st=stat(a),p=s.progress||{},r=rate(a),kv=(l,v)=>h('div',{},l,h('b',{},v));
 const res=(list,lab,z,cls)=>list.map(n=>{const it=itm(a,n);return h('div',{class:'ri'+(cls?' '+cls:'')},ico(n,iconOf(it),z),h('span',{class:'nm'},lab(n)),h('span',{class:'v',title:full(it&&it.amount)},cm(it?it.amount:0)))});
 const e=s.expGoal?s.expCurrent/s.expGoal:0;
 d.replaceChildren(h('button',{class:'btn x',onclick:hide,'aria-label':'ปิด'},'ปิด'),
  h('div',{class:'dh'},lvSeal(s),h('div',{},h('h2',{},s.display||s.name),h('p',{class:'us'},s.name+(s.userId?'  ·  ID '+s.userId:'')))),
  h('p',{style:'margin-top:14px'},h('span',{class:'pill',style:'--c:'+ST[st][1]},h('i',{class:'dot',style:'--c:'+ST[st][1]}),ST[st][0]+' · อัปเดตเมื่อ '+ago(now()-s.time)+'ที่แล้ว'),' ',h('span',{class:'pill cdp','data-cd':s.name,style:'--c:var(--mu)'},cdText(a,st))),
  fight(s,st,true)?h('div',{class:'dfight'},fight(s,st,true),(()=>{const b=bossRate(a);return b!=null?h('span',{class:'mu'},'ล้มบอส '+b+' ตัวใน 1 ชม.ล่าสุด'):null})()):null,
  h('div',{class:'dvault'},
   h('div',{class:'dwen'},h('p',{class:'lbl',style:'color:#c9a96b'},'Wen'),h('p',{class:'big',title:full(s.wen)},full(s.wen)),h('p',{class:'lbl',style:'color:#c9a96b'},r==null?'กำลังเก็บข้อมูลอัตรา':h('span',{class:r>0?'up':'mu'},(r>0?'+':'')+cm(r)+' ต่อชั่วโมง'))),
   h('div',{class:'dpair'},
    h('div',{class:'ore'},h('p',{class:'lbl'},'Ore'),h('div',{class:'res',style:'grid-template-columns:1fr'},res(ORE,n=>n==='Ore'?'Ore':'Refinement',30,'sm'))),
    h('div',{class:'coins'},h('p',{class:'lbl'},'ถุงเงิน'),h('div',{class:'res',style:'grid-template-columns:1fr'},res(COINS,n=>COIN_TH[n],26,'sm'))))),
  h('h3',{},'เลเวล '+(s.level??'–')+' · EXP '+full(s.expCurrent)+' / '+full(s.expGoal)),h('div',{class:'bar'},h('i',{style:`width:${Math.max(0,Math.min(1,e))*100}%`})),
  h('h3',{},'ตัวละคร'),h('div',{class:'kv'},kv('Race',s.race||'–'),kv('Clan',s.clan||'–'),kv('Demon Art',s.demonArt||'–'),kv('Breathing',s.breathing||'–'),kv('Fighting Style',s.fightingStyle||'–'),kv('Slayer / Demon',(s.slayerRank||'–')+' / '+(s.demonRank||'–')),kv('Skill Points',s.skillPoints??'–'),kv('Kills',cm(p.kills)),kv('Boss kills',cm(p.boss_kills)),kv('Deaths',cm(p.deaths)),kv('Tower',p.tower_floor!=null?'ชั้น '+p.tower_floor:'–')),
  ...(Object.keys(s.mastery||{}).length?[h('h3',{},'Mastery'),h('div',{class:'mg'},Object.entries(s.mastery).sort((x,y)=>(y[1].goal?y[1].current/y[1].goal:0)-(x[1].goal?x[1].current/x[1].goal:0)).map(([k,m])=>{const r=m.goal?Math.max(0,Math.min(1,m.current/m.goal)):0,mx=m.goal&&m.current>=m.goal;return h('div',{class:'mc'+(mx?' max':''),title:Math.round(r*100)+'%'},h('div',{class:'mh'},h('span',{class:'mn'},k),mx?h('span',{class:'mx'},'MAX'):h('span',{class:'mp'},Math.round(r*100)+'%')),h('div',{class:'mv'},h('b',{},full(m.current)),h('span',{},' / '+full(m.goal))),h('div',{class:'mb'},h('i',{style:`width:${r*100}%`})))}))]:[]),
  ...bag(s))}
document.querySelectorAll('.fl').forEach(b=>b.onclick=()=>{flt=b.dataset.f;document.querySelectorAll('.fl').forEach(x=>x.setAttribute('aria-pressed',x===b));render()});
$('#q').oninput=e=>{q=e.target.value.toLowerCase();render()};
setInterval(()=>{if(!demo)render()},10000);
/* ---------- โหมดเซิร์ฟเวอร์ ---------- */
const VIEW=location.pathname==='/v';let VTOKEN=null;
if(VIEW){const hs=location.hash.slice(1);if(/^sfv_[0-9a-f]{48}$/.test(hs))VTOKEN=hs;
 try{if(VTOKEN)localStorage.setItem('sf_vt',VTOKEN);else{const t=localStorage.getItem('sf_vt');if(/^sfv_[0-9a-f]{48}$/.test(t||''))VTOKEN=t}}catch(e){}
 if(hs)history.replaceState(null,'','/v');
 document.querySelectorAll('.src>.btn').forEach(b=>b.style.display='none')}
async function pull(){try{const r=await fetch(VIEW?'/api/v1/state':'/api/state',{cache:'no-store',headers:VIEW?{Authorization:'Bearer '+VTOKEN}:{}});
 if(!r.ok){if(VIEW&&(r.status===401||r.status===403)){let m='';try{m=(await r.json()).error}catch(e){}A.clear();render();gate(r.status===401?'เซสชันหมดอายุหรือร้านออกคีย์ใหม่ กรุณาเข้าสู่ระบบอีกครั้ง':m==='license expired'?'หมดอายุแล้ว ติดต่อร้านเพื่อต่ออายุ':m==='access revoked'?'บัญชีนี้ถูกระงับ ติดต่อร้าน':'ใช้งานไม่ได้: '+m);return}throw 0}const d=await r.json();
 if(VIEW&&d.expires){const l=$('#lic');l.hidden=false;l.textContent='ใช้งานได้ถึง '+new Date(d.expires*1000).toLocaleDateString('th-TH',{day:'numeric',month:'long',year:'numeric'})}
 const off=d.serverTime-now();A.clear();for(const a of d.accounts){if(a&&a.s){a.s.time-=off;a.hist.forEach(x=>x.t-=off);if(a.rejoin)a.rejoin.at-=off;A.set(a.s.name,a)}}
 a_ok();render()}catch(e){$('#mode').textContent='ต่อเซิร์ฟเวอร์ไม่ได้ (ปิดอยู่หรือเปล่า)'}}
function a_ok(){$('#mode').textContent=A.size?'ข้อมูลสดจากสคริปต์ · '+A.size+' ไอดี':(VIEW?'ยังไม่มีข้อมูลไอดีของคุณ (ผู้ดูแลยังไม่ได้เริ่มรัน หรือยังไม่ได้เพิ่มไอดีให้)':'รอข้อมูลจากสคริปต์... วางสคริปต์ใน executor แล้วรัน')}
/* ---------- เข้าสู่ระบบ (หน้าลูกค้า) ---------- */
function gate(msg){clearInterval(poll);VTOKEN=null;try{localStorage.removeItem('sf_vt')}catch(e){}$('#gate').hidden=false;$('#login-err').textContent=msg||'';setTimeout(()=>$('#login-user').focus(),50)}
$('#login-form').onsubmit=async e=>{e.preventDefault();const b=$('#login-go');b.disabled=true;$('#login-err').textContent='';
 try{const r=await fetch('/api/v1/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user:$('#login-user').value,pass:$('#login-pass').value})});let j={};try{j=await r.json()}catch(x){}
  if(!r.ok){$('#login-err').textContent=j.error||'เข้าสู่ระบบไม่สำเร็จ';return}
  VTOKEN=j.token;try{localStorage.setItem('sf_vt',VTOKEN)}catch(x){}$('#login-pass').value='';$('#gate').hidden=true;$('#lo').hidden=false;goLive()}
 catch(x){$('#login-err').textContent='ต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง'}finally{b.disabled=false}};
$('#lo').onclick=()=>{A.clear();render();$('#lic').hidden=true;$('#lo').hidden=true;gate('')};
async function goLive(){if(VIEW){if(!VTOKEN){demo=false;clearInterval(timer);A.clear();render();gate('');return true}$('#lo').hidden=false;live=true;demo=false;clearInterval(timer);A.clear();clearInterval(poll);await pull();poll=setInterval(pull,3000);return true}
 try{const r=await fetch('/api/state',{cache:'no-store'});if(!r.ok)return false}catch(e){return false}
 live=true;demo=false;clearInterval(timer);A.clear();await pull();poll=setInterval(pull,3000);return true}
$('#bc').onclick=async()=>{if(!live){alert('ปุ่มนี้ใช้ได้เมื่อเปิดแดชบอร์ดผ่านเซิร์ฟเวอร์ (node server.js) แล้วเข้า http://127.0.0.1:8787');return}
 try{const t=await(await fetch('/script.lua')).text();await navigator.clipboard.writeText(t);const o=$('#bc').textContent;$('#bc').textContent='ก๊อปแล้ว วางใน executor ได้เลย';setTimeout(()=>$('#bc').textContent=o,2500)}catch(e){alert('ก๊อปไม่สำเร็จ: เปิดลิงก์ /script.lua แล้วก๊อปเอง')}};
/* ---------- ดูบนมือถือ (ส่งขึ้นเซิร์ฟเวอร์กลาง) ---------- */
let clTimer=null;
async function renderCloud(){const d=$('#cl');let st={connected:false};
 try{st=await(await fetch('/api/cloud',{cache:'no-store'})).json()}catch(e){d.replaceChildren(h('p',{class:'mu'},'ต่อแอปไม่ได้'));return}
 const close=h('button',{class:'btn x',onclick:hideCloud,'aria-label':'ปิด'},'ปิด');
 if(!st.connected){
  const ta=h('textarea',{rows:'4',placeholder:'วางรหัสเปิดใช้งาน (ขึ้นต้นด้วย SFA1.)',spellcheck:'false','aria-label':'รหัสเปิดใช้งาน'}),msg=h('p',{class:'note',style:'color:var(--red)'});
  const go=h('button',{class:'btn',onclick:async()=>{msg.textContent='';
   try{const r=await fetch('/api/cloud',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:ta.value})});const j=await r.json();if(!r.ok){msg.textContent=j.error||'เชื่อมต่อไม่สำเร็จ';return}renderCloud()}catch(e){msg.textContent='เชื่อมต่อไม่สำเร็จ'}}},'เชื่อมต่อ');
  d.replaceChildren(close,h('h2',{},'ดูบนมือถือ'),h('p',{class:'note'},'ขอรหัสเปิดใช้งานจากผู้ดูแล แล้ววางด้านล่าง จะได้ลิงก์เปิดดูข้อมูลของคุณบนมือถือหรือคอมเครื่องอื่นได้แบบสด'),h('div',{style:'margin-top:14px'},ta),h('div',{class:'rowb'},go),msg,
   h('p',{class:'note'},'ข้อมูลที่ส่งขึ้นเซิร์ฟเวอร์: ชื่อไอดี เลเวล Wen สถิติ และจำนวนของในคลัง ไม่มีรหัสผ่านหรือ cookie'));return}
 const age=st.lastOk?st.serverTime-st.lastOk:null,ok=!st.lastError&&age!=null&&age<120,c=st.lastError?'var(--red)':ok?'var(--ok)':'var(--warn)';
 const lnk=h('input',{class:'f',readonly:'',value:st.viewLink,'aria-label':'ลิงก์ดูบนมือถือ'});
 const cp=h('button',{class:'btn',onclick:async()=>{try{await navigator.clipboard.writeText(st.viewLink);cp.textContent='ก๊อปแล้ว';setTimeout(()=>cp.textContent='ก๊อปลิงก์',2000)}catch(e){lnk.select()}}},'ก๊อปลิงก์');
 const off=h('button',{class:'btn',onclick:async()=>{if(!confirm('ตัดการเชื่อมต่อ? ลิงก์เดิมยังใช้ได้จนกว่าผู้ดูแลจะยกเลิก'))return;await fetch('/api/cloud',{method:'DELETE'});renderCloud()}},'ตัดการเชื่อมต่อ');
 d.replaceChildren(close,h('h2',{},'ดูบนมือถือ'),
  h('p',{style:'margin-top:10px'},h('span',{class:'pill',style:'--c:'+c},h('i',{class:'dot',style:'--c:'+c}),st.lastError||(ok?'ส่งข้อมูลอยู่':st.queued?'รอส่งข้อมูล...':'เชื่อมต่อแล้ว รอข้อมูลจากสคริปต์'))),
  h('div',{class:'kv',style:'margin-top:14px'},h('div',{},'ส่งล่าสุด',h('b',{},age==null?'–':ago(age)+'ที่แล้ว')),h('div',{},'หมดอายุ',h('b',{},st.expires?new Date(st.expires*1000).toLocaleDateString('th-TH'):'–'))),
  h('h3',{},'ลิงก์ดูบนมือถือ (ใครมีลิงก์นี้ก็ดูข้อมูลของคุณได้ อย่าแชร์)'),lnk,h('div',{class:'rowb'},cp,off),
  h('p',{class:'note'},'เปิดลิงก์บนมือถือแล้วเพิ่มลงหน้าจอหลักได้ เซิร์ฟเวอร์: '+st.url))}
function showCloud(){$('#cl').classList.add('open');$('#scrim').classList.add('on');renderCloud();clearInterval(clTimer);clTimer=setInterval(renderCloud,5000)}
function hideCloud(){$('#cl').classList.remove('open');clearInterval(clTimer);if(!$('#dr').classList.contains('open'))$('#scrim').classList.remove('on')}
$('#scrim').onclick=()=>{hide();hideCloud()};
$('#bm').onclick=showCloud;
addEventListener('keydown',e=>{if(e.key==='Escape')hideCloud()});
goLive().then(ok=>{if(!ok)startDemo()});

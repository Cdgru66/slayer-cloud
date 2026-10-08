const THRESH=900; // เงียบเกิน 900 วิ = ออฟไลน์ (ถ้าสคริปต์ไม่ได้บอกรอบส่ง)
const ORE=['Ore','Refinement Ore'],COINS=['Coin','Coin Stack','Coin Pile','Coin Pouch'],COIN_TH={'Coin':'เหรียญ','Coin Stack':'ตั้งเหรียญ','Coin Pile':'กองเหรียญ','Coin Pouch':'ถุงเงิน'};
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
 'Coin Pouch':'<svg viewBox="0 0 32 32"><defs><radialGradient id="sfg-gp" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#f4d58c"/><stop offset="1" stop-color="#8a5f22"/></radialGradient></defs><path d="M12 8c-1-2 1-4 4-4s5 2 4 4z" fill="#8a5f22"/><path d="M11 9h10c5 4 7 8 7 12 0 5-5 7-12 7S4 26 4 21c0-4 2-8 7-12z" fill="url(#sfg-gp)"/><path d="M11 9h10" stroke="#5a3c12" stroke-width="2" stroke-linecap="round"/><circle cx="16" cy="19" r="4" fill="none" stroke="#5a3c12" stroke-width="1.2" opacity=".7"/><rect x="14.6" y="17.6" width="2.8" height="2.8" fill="#5a3c12" opacity=".7"/></svg>',
 'Coin Pile':'<svg viewBox="0 0 32 32"><defs><radialGradient id="sfg-gl" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fbe7b0"/><stop offset=".6" stop-color="#e2b65c"/><stop offset="1" stop-color="#8f6c2c"/></radialGradient></defs><g fill="url(#sfg-gl)" stroke="#6b4d1c" stroke-width=".7"><ellipse cx="9" cy="24" rx="6" ry="2.6"/><ellipse cx="22" cy="25" rx="6" ry="2.6"/><ellipse cx="16" cy="21" rx="6" ry="2.6"/><ellipse cx="11" cy="17" rx="5.5" ry="2.4"/><ellipse cx="20" cy="16" rx="5.5" ry="2.4"/><ellipse cx="16" cy="11" rx="5" ry="2.2"/></g></svg>'};
function glyph(n,z){const sp=h('span',{class:'ic gl',style:`width:${z}px;height:${z}px`});sp.innerHTML=G[n];return sp}
function ico(n,u,z=20){if((!u||!/^https:/.test(u))&&G[n])return glyph(n,z);const hue=[...n].reduce((a,c)=>a+c.charCodeAt(0),0)%360,f=()=>h('span',{class:'ic',style:`width:${z}px;height:${z}px;background:hsl(${hue} 35% 24%);font-size:${Math.round(z*.45)}px;border-radius:${Math.round(z*.25)}px`},n[0]||'?');if(!u||!/^https:/.test(u))return f();const i=h('img',{class:'ic',src:u,alt:'',width:z,height:z,referrerpolicy:'no-referrer',style:`border-radius:${Math.round(z*.25)}px`});i.onerror=()=>i.replaceWith(f());return i}
function upsert(s){let a=A.get(s.name);if(!a){a={hist:[]};A.set(s.name,a)}a.s=s;if(s.days)a.days=s.days;const l=a.hist[a.hist.length-1];if(!l||l.t!==s.time){a.hist.push({o:(s.items.find(i=>i.name==='Ore')||{}).amount||0,t:s.time,w:s.wen||0,k:(s.progress&&s.progress.kills)||0,b:(s.progress&&s.progress.boss_kills)||0});if(a.hist.length>400)a.hist.shift()}}
function lim(a){const i=a.s.interval;return i?Math.max(90,i*2.5):THRESH}
function stat(a){if(now()-a.s.time>lim(a))return'off';const i=a.s.interval||300,W=Math.max(1200,i*6),p=a.hist.filter(x=>x.t>=now()-W);return p.length>=3&&p[p.length-1].t-p[0].t>=Math.max(600,i*3)&&p.every(x=>x.w===p[0].w&&x.k===p[0].k)?'stuck':'on'}
function rate(a){const p=a.hist.filter(x=>x.t>=now()-3600);if(p.length<2)return null;const f=p[0],l=p[p.length-1],d=l.t-f.t;return d<120?null:(l.w-f.w)/(d/3600)}
/* นับถอยหลังรอบอัปเดต + บอส */
const mmss=x=>{x=Math.max(0,Math.round(x));return Math.floor(x/60)+':'+String(x%60).padStart(2,'0')};
const nextIn=a=>a.s.time+(a.s.interval||300)-now();
function cdText(a,st){if(st==='off'){if(a.rejoin&&now()-a.rejoin.at<600)return'กำลังเข้าเกมใหม่…'+(a.rejoin.n>1?' (ครั้งที่ '+a.rejoin.n+')':'');return'ออฟไลน์ '+ago(now()-a.s.time)}const l=nextIn(a);return l>0?'อีก '+mmss(l):l>-30?'กำลังอัปเดต…':'ไม่มีข้อมูลใหม่ '+mmss(-l)}
// แร่ที่ได้ต่อชั่วโมง (นับเฉพาะตอนเพิ่ม ไม่หักตอนเอาไปใช้)
// ตัวเลขวิ่งขึ้นนุ่ม ๆ เวลาค่าเปลี่ยน
function tween(el,v){const from=el._v;el._v=v;el.title=full(v)+' Wen';if(from==null||from===v||matchMedia('(prefers-reduced-motion: reduce)').matches){el.textContent=cm(v);return}
 const t0=performance.now(),D=900;cancelAnimationFrame(el._r);el.classList.add('bump');const st=t=>{const k=Math.min(1,(t-t0)/D),e=1-Math.pow(1-k,3);el.textContent=cm(from+(v-from)*e);if(k<1)el._r=requestAnimationFrame(st);else el.classList.remove('bump')};el._r=requestAnimationFrame(st)}
function oreRate(a){const p=a.hist.filter(x=>x.t>=now()-3600&&x.o!=null);if(p.length<2)return null;const d=p[p.length-1].t-p[0].t;if(d<120)return null;let g=0;for(let i=1;i<p.length;i++)g+=Math.max(0,p[i].o-p[i-1].o);return g/(d/3600)}
const isLive=s=>s.liveAt!=null&&now()-s.liveAt<50;
// ไอคอนบอส (หน้ากากอสูรสร้างจากชื่อ แต่ละตัวไม่ซ้ำ)
function bossPic(name,z){const u=ICONS['boss:'+name];if(u){const im=new Image(z,z);im.src=u;im.alt='';im.className='bossic';return im}return bossIcon(name,z)}
const BOSS_NAME={"TaiChiTrainee": "Tai Chi Trainee Suzume", "WindTrainee": "Wind Trainee", "MotherBear": "Mother Bear", "InsectTrainee": "Insect Trainee", "SoryuTrainee": "Soryu Trainee Goki", "SoundTrainee": "Sound Trainee", "FlameTrainee": "Flame Trainee", "StoneTrainee": "Stone Trainee", "SerpentTrainee": "Serpent Trainee", "ThunderTrainee": "Thunder Trainee", "ReaperTrainee": "Reaper Trainee Kuzan", "WaterTrainee": "Water Trainee Sabito"};
const bossName=n=>BOSS_NAME[n]||n;
function bossIcon(name,z){let k=0;for(const c of name)k=(k*33+c.charCodeAt(0))>>>0;const hue=[0,350,20,280,200,140][k%6],horn=k>>3&1,eye=k>>4&1,NS='http://www.w3.org/2000/svg';
 const svg=document.createElementNS(NS,'svg');svg.setAttribute('viewBox','-50 -50 100 100');svg.setAttribute('width',z);svg.setAttribute('height',z);svg.setAttribute('aria-hidden','true');svg.classList.add('bossic');
 const el=(t,a)=>{const e=document.createElementNS(NS,t);for(const q in a)e.setAttribute(q,a[q]);svg.append(e);return e};
 el('circle',{r:47,fill:`hsl(${hue} 55% 18%)`,stroke:`hsl(${hue} 70% 55%)`,'stroke-width':3});
 if(horn){el('path',{d:'M-24 -26 L-34 -46 L-14 -32Z',fill:'#e8d9b0'});el('path',{d:'M24 -26 L34 -46 L14 -32Z',fill:'#e8d9b0'})}else el('path',{d:'M0 -30 L-7 -46 L7 -46Z',fill:'#e8d9b0'});
 el('path',{d:'M-30 -18 Q0 -36 30 -18 Q34 14 0 36 Q-34 14 -30 -18Z',fill:`hsl(${hue} 65% 42%)`});
 const ey=eye?{d:'M-21 -6 L-7 -2 L-21 2Z'}:{d:'M-22 -4 Q-14 -10 -6 -4 Q-14 0 -22 -4Z'};el('path',{...ey,fill:'#ffe08a'});el('path',{d:ey.d,fill:'#ffe08a',transform:'scale(-1 1)'});
 el('path',{d:'M-12 16 L-6 22 L0 16 L6 22 L12 16',fill:'none',stroke:'#f4ead0','stroke-width':2.5,'stroke-linejoin':'round'});return svg}
function bossRate(a){const p=a.hist.filter(x=>x.t>=now()-3600&&x.b!=null);if(p.length<2)return null;return Math.max(0,p[p.length-1].b-p[0].b)}
// ไอคอนพลังจากในเกม: มนต์อสูร = Orb ของสายนั้น, ปราณ = ดาบ/ชุดของสายนั้น (ไม่มีรูปค่อยใช้ตัวอักษร 鬼/息)
const ORB_ALIAS={Pyrokinesis:'Pyrokenesis'},BREATH_ICON={Water:'Water Katana',Flame:'Flame Katana',Thunder:'Thunder Katana',Wind:'Wind Katana',Insect:'Insect Katana',Stone:'Stone Haori',Sound:'Sound Katanas',Mist:'Mist Kumo Sodenashi',Serpent:'Serpent Katana',Beast:'Beast Core',Moon:'Moonlit Kata-Aki'};
function pwIcon(name,demon,glyph){const key=demon?(ORB_ALIAS[name]||name)+' Orb':BREATH_ICON[name]||name+' Katana',u=ICONS[key];
 if(u){const im=new Image(18,18);im.src=u;im.alt='';im.className='pwi';im.onerror=()=>im.replaceWith(h('b',{},glyph));return im}return h('b',{},glyph)}
function power(s){if(s.demonArt)return h('span',{class:'pw demon',title:'Demon Art (มนต์อสูรโลหิต)'},pwIcon(s.demonArt,true,'鬼'),s.demonArt);if(s.breathing)return h('span',{class:'pw',title:'Breathing'},pwIcon(s.breathing,false,'息'),s.breathing);return null}
function fight(s,st,big){if(!s.boss||st==='off')return null;return h('span',{class:'fight'+(big?' big':''),title:'บอสที่อยู่ใกล้ตัวละครที่สุด'},bossPic(s.boss.name,big?30:18),isLive(s)?h('span',{class:'livetag'},'LIVE'):null,'กำลังสู้ ',h('b',{},bossName(s.boss.name)),s.boss.hp!=null?h('span',{class:'hp'},h('i',{style:`width:${Math.max(0,Math.min(100,s.boss.hp))}%`})):null)}
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
return{name:NAMES[i],display:NAMES[i].replace(/\d+$/,''),userId:1e9+i,time:now(),interval:120,boss:i%3?{name:['Akazo','Gyorei','Zuko','Enru','Rengu'][i%5],hp:20+n(80),dist:30}:undefined,level:[225,225,225,225,225,225,191,59,225,225,191,225,200,225][i],slayerRank:'Mizunoto',demonRank:'Thrall',clan:['Tomioka','Kamado','Agatsuma'][i%3],race:i%4===1?'Demon':'Human',breathing:i%4===1?undefined:['Water','Flame','Thunder'][i%3],demonArt:i%4===1?['Blood Whip','Frost Lotus','Thread Weaver'][i%3]:undefined,fightingStyle:i%2?'Gauntlet':undefined,wen:200000+n(600000),expCurrent:n(13500),expGoal:13500,skillPoints:n(30),reputation:-n(9000),stamina:700,hp:1801,maxHp:1801,progress:{kills:n(4000),boss_kills:n(1200),deaths:n(900),chests:n(800),quests:n(460),tower_floor:n(60)},mastery:{Water:{current:3940,goal:5220},Sword:{current:1931,goal:6990},Fist:{current:90,goal:270},Spear:{current:1033,goal:1980}},items:[it('Ore',n(30)),it('Refinement Ore',n(8000)),it('Coin',n(40)),it('Coin Stack',n(8)),it('Coin Pile',n(6)),it('Coin Pouch',n(4)),it('Metal Scraps',n(5000)),it('Silk Thread',n(5000)),it('Beast Core',n(60)),it('Demon Horns',n(50)),it('Health Potion',n(250)),{...it('Water Katana',1),equipped:i%2===0},it('Cutlass',1),{...it('Masquerade Mask',1),equipped:true},it('Kasumi Yukata',2),{...it('Prayer of wind Necklace',1),equipped:true},it('Nightfall Scythe Schematic',1),it('Demonic Lantern',n(3))]}}
function seed(){A.clear();DS=NAMES.map((_,i)=>mk(i));DS.forEach((s,i)=>{s.days={};for(let k=13;k>=0;k--){const g=40000+Math.random()*90000*(i%3+1)|0;s.days[dkey(now()-k*86400)]={w0:0,w1:k===0?g*.4|0:g,b0:0,b1:(Math.random()*60|0),k0:0,k1:(Math.random()*900|0),l0:0,l1:k%5===0?1:0}}});DS.forEach((s,i)=>{s._m=i<8?'on':i===10?'stuck':'off';const b=s.wen;const ph=Math.random()*110;for(let k=30;k>=0;k--)upsert({...s,days:s.days,time:now()-ph-k*120-(s._m==='off'?3600:0),wen:s._m==='on'?b-k*180:b,progress:{...s.progress,boss_kills:s.progress.boss_kills-(s._m==='on'?k:0)}});s.time=now()-ph});
 {const g0=A.get(NAMES[0]),g1=A.get(NAMES[1]);if(g0)g0.goal={title:'เซท Giyu',items:[{k:'mastery',label:'Mastery Katana',key:'Sword',target:6990},{k:'mastery',label:'Mastery Water',key:'Water',target:5220},{k:'manual',label:'ได้อาวุธ Tidal Katana Nightfall T3+10',done:true},{k:'manual',label:'ได้ชุด Nightfall T3+10',done:false}]};if(g1)g1.goal={title:'เซท Akaza',items:[{k:'mastery',label:'Mastery Gauntlet',key:'Fist',target:270},{k:'level',label:'เลเวล',target:225},{k:'manual',label:'ตระกูล Kamado',done:true}]}}}
function tick(){DS.forEach(s=>{if(s._m==='off'||now()-s.time<s.interval)return;s.progress.boss_kills++;if(s._m==='on'){s.liveAt=now();s.items[0].amount+=Math.random()*3|0;s.wen+=5+Math.random()*5|0;const d=Math.random()*30|0;s.items[1].amount+=d;s.items[1].delta=d}s.time=now();upsert({...s})});render()}
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
// ===== ความคืบหน้าตามเป้าหมายของออเดอร์ (คำนวณจากข้อมูลสดของไอดี) =====
const curOf=(it,s)=>it.k==='mastery'?Number((s.mastery||{})[it.key]&&s.mastery[it.key].current)||0:it.k==='level'?Number(s.level)||0:it.done?1:0;
const fracOf=(it,v)=>it.k==='manual'?(v?1:0):Math.max(0,Math.min(1,v/(it.target||(it.k==='mastery'?400:1))));
const pctOfVals=(items,vals)=>items.length?items.reduce((t,it,i)=>t+fracOf(it,vals[i]),0)/items.length*100:0;
const r1=x=>Math.floor(x*10)/10;
function goalParts(a){const g=a.goal;if(!g||!g.items||!g.items.length)return null;const s=a.s,st=goalStats(a);
 return g.items.map((it,i)=>{const cur=curOf(it,s);if(it.k==='manual')return{label:it.label,f:it.done?1:0,txt:it.done?'เสร็จแล้ว':'กำลังทำ',manual:true};
  const t=it.target||(it.k==='mastery'?400:1),x=st&&st.items[i];
  return{label:it.label||(it.k==='level'?'เลเวล':'Mastery '+it.key),cur,t,f:fracOf(it,cur),txt:cm(Math.min(cur,t))+' / '+cm(t),rate:x&&x.rate,eta:x&&x.eta}})}
function goalPct(a){const g=a.goal;if(!g||!g.items||!g.items.length)return null;return r1(pctOfVals(g.items,g.items.map(it=>curOf(it,a.s))))}
const dur=h=>{if(!(h>0))return'';if(h<1)return'~'+Math.max(1,Math.round(h*60))+' นาที';if(h<48){const H=Math.floor(h),M=Math.round((h-H)*60);return'~'+H+' ชม.'+(M?' '+M+' นาที':'')}const D=Math.floor(h/24),H=Math.round(h-D*24);return'~'+D+' วัน'+(H?' '+H+' ชม.':'')};
const agoT=sec=>sec<60?'เมื่อสักครู่':sec<3600?Math.round(sec/60)+' นาทีที่แล้ว':sec<86400?Math.round(sec/3600)+' ชม.ที่แล้ว':Math.round(sec/86400)+' วันที่แล้ว';
// ความเร็ว + เวลาที่คาดว่าเสร็จ จากประวัติของเป้าหมาย
function goalStats(a){const g=a.goal;if(!g||!g.items)return null;const H=(g.hist||[]).slice(),T=now(),items=g.items,curV=items.map(it=>curOf(it,a.s));
 H.push({t:T,v:curV});if(H.length<2)return{items:items.map(()=>null),pctHr:null,eta:null,last:null,series:[]};
 const win=x=>{const from=T-x;let k=H.findIndex(p=>p.t>=from);if(k<0)k=H.length-1;if(k>0&&T-H[k].t<x*0.5)k=Math.max(0,k-1);return H[k]};
 const base=win(6*3600),hrs=Math.max(1/60,(T-base.t)/3600);
 const it2=items.map((it,i)=>{if(it.k==='manual')return null;const t=it.target||(it.k==='mastery'?400:1),cur=curV[i],d=cur-(base.v[i]||0),rate=d>0?d/hrs:0;return{rate,eta:cur>=t?0:rate>0?(t-cur)/rate:null}});
 const farm=it2.filter(Boolean),eta=farm.length&&farm.every(x=>x.eta!=null)?Math.max(...farm.map(x=>x.eta)):null;
 const b1=win(3600),pctNow=pctOfVals(items,curV),pctHr=pctNow-pctOfVals(items,b1.v);
 let last=null;for(let k=H.length-1;k>0&&!last;k--){const A=H[k-1].v,B=H[k].v;for(let i=0;i<items.length;i++)if((B[i]||0)!==(A[i]||0)){last={label:items[i].k==='manual'?items[i].label:(items[i].label||items[i].key),d:(B[i]||0)-(A[i]||0),manual:items[i].k==='manual',t:H[k].t};break}}
 return{items:it2,pctHr,eta,last,series:H.map(p=>[p.t,pctOfVals(items,p.v)])}}
const prevPct=new Map();
function ring(pct,z,key){const NS='http://www.w3.org/2000/svg',r=(z-8)/2,c=2*Math.PI*r,svg=document.createElementNS(NS,'svg');svg.setAttribute('viewBox',`0 0 ${z} ${z}`);svg.setAttribute('width',z);svg.setAttribute('height',z);svg.classList.add('ring');
 const mk=(cls)=>{const e=document.createElementNS(NS,'circle');e.setAttribute('cx',z/2);e.setAttribute('cy',z/2);e.setAttribute('r',r);e.setAttribute('class',cls);svg.append(e);return e};
 mk('rb');const f=mk('rf');f.setAttribute('stroke-dasharray',c);const t=document.createElementNS(NS,'text');t.setAttribute('x','50%');t.setAttribute('y','50%');t.setAttribute('class','rt');svg.append(t);
 const set=p=>{f.setAttribute('stroke-dashoffset',c*(1-p/100));t.textContent=r1(p).toFixed(1)+'%'};
 const from=key!=null?prevPct.get(key):null;if(key!=null)prevPct.set(key,pct);
 if(from==null||Math.abs(from-pct)<0.05||matchMedia('(prefers-reduced-motion: reduce)').matches)set(pct);
 else{set(from);const t0=performance.now();const step=n=>{const k=Math.min(1,(n-t0)/1200),e=1-Math.pow(1-k,3);set(from+(pct-from)*e);if(k<1)requestAnimationFrame(step);else svg.classList.add('bump')};requestAnimationFrame(step)}
 return svg}
function goalList(a,compact){const p=goalParts(a)||[];return h('ul',{class:'goall'+(compact?' c':'')},p.map(x=>h('li',{class:x.f>=1?'done':''},h('span',{class:'gk'},x.f>=1?'✓':x.manual?'○':''),h('span',{class:'gn'},x.label),h('span',{class:'gv'},x.txt),
  x.manual?null:h('span',{class:'gb'},h('i',{style:`width:${(x.f*100).toFixed(1)}%`})),
  !x.manual&&x.f<1?h('span',{class:'gr'},x.rate>0?['+'+(x.rate>=10?Math.round(x.rate):x.rate.toFixed(1))+' / ชม.',x.eta?' · อีก '+dur(x.eta):'']:'รอข้อมูลความเร็ว…'):null)))}
function goalMeta(a){const st=goalStats(a),pct=goalPct(a);if(!st)return null;const out=[];
 if(pct>=100)out.push(h('span',{class:'gm ok'},'ครบทุกเป้าหมายแล้ว 🎉'));
 else{out.push(h('span',{class:'gm'+(st.pctHr>0?' up':'')},st.pctHr>0?'▲ +'+st.pctHr.toFixed(1)+'% ใน 1 ชม.ล่าสุด':'กำลังเก็บข้อมูลความเร็ว'));
  if(st.eta!=null)out.push(h('span',{class:'gm eta'},'⏱ คาดว่าฟาร์มครบใน '+(st.eta>0?dur(st.eta):'ไม่นาน')))}
 if(st.last)out.push(h('span',{class:'gm last'},'ล่าสุด: '+st.last.label+(st.last.manual?(st.last.d>0?' ✓ เสร็จแล้ว':''):' '+(st.last.d>0?'+':'')+cm(st.last.d))+' · '+agoT(now()-st.last.t)));
 return h('div',{class:'gmeta'},out)}
function spark(a,w,hh){const st=goalStats(a);if(!st||st.series.length<3)return null;const S=st.series,t0=S[0][0],t1=S[S.length-1][0]||t0+1,NS='http://www.w3.org/2000/svg',svg=document.createElementNS(NS,'svg');
 svg.setAttribute('viewBox',`0 0 ${w} ${hh}`);svg.setAttribute('class','gspark');svg.setAttribute('role','img');svg.setAttribute('aria-label','กราฟความคืบหน้าจาก '+r1(S[0][1])+'% เป็น '+r1(S[S.length-1][1])+'%');
 const x=t=>4+(t-t0)/Math.max(1,t1-t0)*(w-8),y=p=>hh-4-p/100*(hh-8);
 const pl=document.createElementNS(NS,'polyline');pl.setAttribute('points',S.map(p=>x(p[0]).toFixed(1)+','+y(p[1]).toFixed(1)).join(' '));pl.setAttribute('class','sl');svg.append(pl);
 const c=document.createElementNS(NS,'circle');c.setAttribute('cx',x(S[S.length-1][0]));c.setAttribute('cy',y(S[S.length-1][1]));c.setAttribute('r',4);c.setAttribute('class','sd');svg.append(c);return svg}
function renderGoals(L){const box=$('#goals');if(!box)return;const G=L.filter(x=>x.a.goal&&x.a.goal.items&&x.a.goal.items.length);box.hidden=!G.length;if(!G.length){box.replaceChildren();return}
 box.replaceChildren(h('div',{class:'gh'},h('h2',{},'ความคืบหน้าออเดอร์'),h('span',{class:'mu'},'อัปเดตสดจากในเกม')),h('div',{class:'gcards'},G.map(({a,st})=>{const s=a.s,pct=goalPct(a);
  return h('div',{class:'gcard'+(pct>=100?' fin':''),role:'button',tabindex:'0',onclick:()=>show(s.name),onkeydown:e=>{if(e.key==='Enter'){show(s.name)}}},
   h('div',{class:'gc-top'},ring(pct,96,'c:'+s.name),h('div',{class:'gc-t'},h('small',{class:'mu'},a.goal.title||'เป้าหมาย'),h('b',{},s.display||s.name),h('span',{class:'gc-st'},h('i',{class:'dot',style:'--c:'+ST[st][1]}),pct>=100?'เสร็จแล้ว 🎉':ST[st][0]),fight(s,st))),
   goalMeta(a),goalList(a,true),h('span',{class:'gc-more'},'ดูรายละเอียดไอดี ›'))})))}
function render(){
 const L=[...A.values()].map(a=>({a,st:stat(a)})),c={all:L.length,on:0,stuck:0,off:0};L.forEach(x=>c[x.st]++);
 for(const k in c)$('#n-'+k).textContent=c[k];
 renderGoals(L);
 const sum=f=>L.reduce((t,x)=>t+(f(x.a)||0),0),firstIcon=n=>{for(const x of L){const u=iconOf(itm(x.a,n));if(u)return u}return ICONS[n]};
 $('#t-on').textContent=(c.on+c.stuck)+' / '+c.all;
 const tw=sum(a=>a.s.wen);tween($('#t-wen'),tw);$('#t-wen').title=full(tw)+' Wen';
 const tr=L.reduce((t,x)=>t+(x.st==='on'?rate(x.a)||0:0),0);$('#t-rate').textContent=(tr>0?'+':'')+cm(tr);
 const tk=dkey(now()),tdy=L.reduce((t,x)=>{const d=x.a.days&&x.a.days[tk];return t+(d?(d.w1||0)-(d.w0||0):0)},0);$('#t-today').textContent=(tdy>=0?'+':'')+cm(tdy);
 {const orr=L.reduce((t,x)=>t+(x.st==='on'?oreRate(x.a)||0:0),0),el=$('#t-orate');if(el)el.textContent=orr>0?'+'+cm(orr)+' Ore ต่อชั่วโมง':'กำลังเก็บข้อมูลแร่ต่อชั่วโมง'}
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
   h('div',{class:'who'},h('div',{class:'nm'},h('i',{class:'dot',style:'--c:'+ST[st][1],title:ST[st][0]}),s.display||s.name),h('div',{class:'us'},s.name,power(s),fight(s,st),(()=>{const gp=goalPct(a);return gp==null?null:h('span',{class:'gpill',title:'ความคืบหน้าตามออเดอร์'},'เป้าหมาย '+gp.toFixed(1)+'%')})()),h('div',{class:'exp',title:'EXP '+Math.round(e*100)+'%'},h('i',{style:`width:${Math.max(0,Math.min(1,e))*100}%`}))),
   h('div',{class:'c wen-c',title:full(s.wen)+' Wen'},cm(s.wen)),
   h('div',{class:'c ore-c',title:full(oreV)},cm(oreV),(()=>{const q=oreRate(a);return q>0?h('small',{class:'orr'},'+'+cm(q)+'/ชม.'):null})()),
   h('div',{class:'c ore-c ref-c',title:full(refV)},cm(refV)),
   h('div',{class:'c cn'},coinEls.length?coinEls:h('span',{class:'mu'},'–')),
   h('div',{class:'c rt '+(r>0?'up':'mu')},r==null?'–':(r>0?'+':'')+cm(r)),
   h('div',{class:'c ago','data-cd':s.name},cdText(a,st)),
   h('div',{class:'mstats'},h('span',{class:'o'},'Ore ',h('b',{},cm(oreV))),h('span',{class:'o'},'Refinement ',h('b',{},cm(refV))),h('span',{class:'g'},'ถุงเงิน ',h('b',{},cm(coinT))),r>0?h('span',{},h('b',{class:'up'},'+'+cm(r)+'/ชม.')):null,h('span',{class:'cdm','data-cd':s.name},cdText(a,st))))}));
 tickCd();
 drawer()}
/* ---------- กระเป๋า (แยกหมวด) ---------- */
const CATS=[
 ['เงิน',n=>/^Coin( Stack| Pile| Pouch)?$/.test(n)],
 ['แร่และวัตถุดิบ',n=>/\b(Ore|Ingot|Scraps?|Thread|Core|Horns?|Fang|Claw|Essence|Shard|Crystal|Material)\b/i.test(n)],
 ['ยาและของใช้',n=>/\b(Potion|Lantern|Elixir|Scroll|Food|Bait|Key|Box|Chest|Clan Skills)\b/i.test(n)],
 ['สูตรคราฟต์',n=>/Schematic/i.test(n)],
 ['อาวุธ',n=>/\b(Katana|Sword|Cutlass|Scythe|Sickles?|Fans?|Spear|Gauntlets?|Axe|Blade|Combat|Whip|Bow|Hammer|Nichirin)\b/i.test(n)],
 ['ชุดและเครื่องประดับ',()=>true]];
const CAT_TH={Materials:'แร่และวัตถุดิบ',Potions:'ยาและของใช้',Schematics:'สูตรคราฟต์',Weapons:'อาวุธ','Evil Art Orbs':'ลูกแก้วมนต์อสูร',Fishing:'ของจากการตกปลา','Quest Items':'ของเควสต์',Head:'ชุดและเครื่องประดับ',Face:'ชุดและเครื่องประดับ',Neck:'ชุดและเครื่องประดับ',Ear:'ชุดและเครื่องประดับ',Waist:'ชุดและเครื่องประดับ',Haori:'ชุดและเครื่องประดับ',Outfits:'ชุดและเครื่องประดับ'};
const CAT_ORDER=['เงิน','แร่และวัตถุดิบ','ยาและของใช้','อาวุธ','ลูกแก้วมนต์อสูร','สูตรคราฟต์','ของจากการตกปลา','ของเควสต์','ชุดและเครื่องประดับ'];
function catOf(it){if(/^Coin( Stack| Pile| Pouch)?$/.test(it.name))return'เงิน';if(it.cat&&CAT_TH[it.cat])return CAT_TH[it.cat];if(it.cat)return it.cat;const c=CATS.find(c=>c[1](it.name));return c?c[0]:'ชุดและเครื่องประดับ'}
function bag(s){const its=(s.items||[]).filter(i=>i.amount>0);if(!its.length)return[h('h3',{},'กระเป๋า'),h('p',{class:'mu',style:'font-size:13px'},'ยังไม่มีข้อมูลกระเป๋า')];
 const gm=new Map();for(const it of its){const t=catOf(it);if(!gm.has(t))gm.set(t,{t,l:[]});gm.get(t).l.push(it)}const g=[...gm.values()].sort((a,b)=>{const x=CAT_ORDER.indexOf(a.t),y=CAT_ORDER.indexOf(b.t);return(x<0?99:x)-(y<0?99:y)});
 const out=[h('h3',{},'กระเป๋า · '+its.length+' ชนิด')];
 for(const c of g){if(!c.l.length)continue;c.l.sort((a,b)=>(b.equipped?1:0)-(a.equipped?1:0)||b.amount-a.amount||a.name.localeCompare(b.name));
  out.push(h('div',{class:'bagc'},h('p',{class:'bagt'},c.t,h('span',{},c.l.length)),h('div',{class:'ig'},c.l.map(it=>h('div',{class:'it'+(it.equipped?' eq':'')},ico(it.name,iconOf(it),30),h('span',{class:'itn',title:it.name},it.name,it.equipped?h('em',{},'ใส่อยู่'):null),h('b',{title:full(it.amount)},(it.amount>1||!it.equipped?'x'+cm(it.amount):'')),it.delta?h('i',{class:'dl '+(it.delta>0?'up':'dn')},(it.delta>0?'+':'')+it.delta):null)))))}
 return out}
/* ---------- สถิติ + กราฟ (ซีรีส์เดียว: ทองเข้ม #b8893a ผ่านเกณฑ์บนพื้นมืด) ---------- */
const SVGNS='http://www.w3.org/2000/svg',CH='#b8893a';
const sv=(t,a={})=>{const e=document.createElementNS(SVGNS,t);for(const k in a)e.setAttribute(k,a[k]);return e};
const dkey=t=>{const d=new Date(t*1000),z=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate())};
const dshort=k=>{const[y,m,d]=k.split('-');return Number(d)+'/'+Number(m)};
function nice(max){if(max<=0)return 1;const p=Math.pow(10,Math.floor(Math.log10(max))),f=max/p;return([1,1.2,1.5,2,2.5,3,4,5,6,8,10].find(x=>x>=f*1.05)||10)*p}
function tipBox(){const t=h('div',{class:'ctip',role:'status'});t.hidden=true;return t}
function lineChart(pts,W){ // pts: [{t,v}]
 const H=150,L=44,R=10,T=10,B=24,w=W-L-R,hh=H-T-B,wrap=h('div',{class:'chart'}),svg=sv('svg',{width:W,height:H,viewBox:`0 0 ${W} ${H}`,role:'img','aria-label':'กราฟ Wen ตามเวลา'}),tip=tipBox();
 if(pts.length<2){wrap.append(h('p',{class:'mu cempty'},'ยังมีข้อมูลไม่พอวาดกราฟ (ต้องมีอย่างน้อย 2 รอบ)'));return wrap}
 const t0=pts[0].t,t1=pts[pts.length-1].t,vs=pts.map(p=>p.v),lo=Math.min(...vs),hi=Math.max(...vs),pad=(hi-lo)*.1||Math.max(1,hi*.01),y0=lo-pad,y1=hi+pad;
 const X=t=>L+(t1===t0?0:(t-t0)/(t1-t0)*w),Y=v=>T+hh-(v-y0)/(y1-y0)*hh;
 for(let i=0;i<=3;i++){const v=y0+(y1-y0)*i/3,y=Y(v);svg.append(sv('line',{x1:L,x2:W-R,y1:y,y2:y,class:'cgrid'}));const tx=sv('text',{x:L-6,y:y+4,'text-anchor':'end',class:'cax'});tx.textContent=cm(v);svg.append(tx)}
 const span=t1-t0;for(let i=0;i<=3;i++){const t=t0+span*i/3,tx=sv('text',{x:X(t),y:H-6,'text-anchor':i===0?'start':i===3?'end':'middle',class:'cax'});const d=new Date(t*1000);tx.textContent=span>86400*1.5?d.getDate()+'/'+(d.getMonth()+1)+' '+String(d.getHours()).padStart(2,'0')+':00':String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');svg.append(tx)}
 const dl=pts.map((p,i)=>(i?'L':'M')+X(p.t).toFixed(1)+' '+Y(p.v).toFixed(1)).join(' ');
 svg.append(sv('path',{d:dl+` L${X(t1)} ${T+hh} L${X(t0)} ${T+hh} Z`,fill:CH,'fill-opacity':.12}));
 svg.append(sv('path',{d:dl,fill:'none',stroke:CH,'stroke-width':2,'stroke-linejoin':'round','stroke-linecap':'round'}));
 const last=pts[pts.length-1];svg.append(sv('circle',{cx:X(last.t),cy:Y(last.v),r:4,fill:CH,stroke:'#1a1114','stroke-width':2}));
 const hx=sv('line',{y1:T,y2:T+hh,class:'cx'}),hd=sv('circle',{r:4,fill:CH,stroke:'#1a1114','stroke-width':2});hx.style.display=hd.style.display='none';svg.append(hx,hd);
 const hit=sv('rect',{x:L,y:T,width:w,height:hh,fill:'transparent',tabindex:0,'aria-label':'เลื่อนเพื่อดูค่า (ปุ่มลูกศรซ้ายขวา)'});svg.append(hit);
 let cur=pts.length-1;
 const show=i=>{cur=Math.max(0,Math.min(pts.length-1,i));const p=pts[cur],x=X(p.t),y=Y(p.v);hx.setAttribute('x1',x);hx.setAttribute('x2',x);hd.setAttribute('cx',x);hd.setAttribute('cy',y);hx.style.display=hd.style.display='';
  tip.replaceChildren(h('b',{},full(p.v)+' Wen'),h('span',{},new Date(p.t*1000).toLocaleString('th-TH',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})));tip.hidden=false;tip.style.left=(x>W/2?Math.max(0,x-158):x+12)+'px';tip.style.top='8px'};
 const hide=()=>{hx.style.display=hd.style.display='none';tip.hidden=true};
 hit.onpointermove=e=>{const r=svg.getBoundingClientRect(),t=t0+(e.clientX-r.left-L)/w*(t1-t0);let b=0;for(let i=1;i<pts.length;i++)if(Math.abs(pts[i].t-t)<Math.abs(pts[b].t-t))b=i;show(b)};
 hit.onpointerleave=hide;hit.onfocus=()=>show(cur);hit.onblur=hide;
 hit.onkeydown=e=>{if(e.key==='ArrowLeft'){show(cur-1);e.preventDefault()}if(e.key==='ArrowRight'){show(cur+1);e.preventDefault()}};
 wrap.append(svg,tip);return wrap}
function barChart(rows,W){ // rows: [{k,v}]
 const H=150,L=44,R=6,T=16,B=24,w=W-L-R,hh=H-T-B,wrap=h('div',{class:'chart'}),svg=sv('svg',{width:W,height:H,viewBox:`0 0 ${W} ${H}`,role:'img','aria-label':'กราฟ Wen ที่ได้ต่อวัน'}),tip=tipBox();
 if(!rows.length){wrap.append(h('p',{class:'mu cempty'},'ยังไม่มีข้อมูลรายวัน'));return wrap}
 const mx=nice(Math.max(1,...rows.map(r=>r.v))),bw=w/rows.length,Y=v=>T+hh-Math.max(0,v)/mx*hh;
 for(let i=0;i<=2;i++){const v=mx*i/2,y=Y(v);svg.append(sv('line',{x1:L,x2:W-R,y1:y,y2:y,class:'cgrid'}));const tx=sv('text',{x:L-6,y:y+4,'text-anchor':'end',class:'cax'});tx.textContent=cm(v);svg.append(tx)}
 rows.forEach((r,i)=>{const x=L+i*bw+1,bwi=Math.max(2,bw-2),y=Y(r.v),hgt=T+hh-y,rad=Math.min(4,bwi/2,hgt);
  const g=sv('g',{class:'cbar',tabindex:0,'aria-label':dshort(r.k)+': '+full(r.v)+' Wen'});
  if(hgt>0)g.append(sv('path',{d:`M${x} ${T+hh} V${y+rad} Q${x} ${y} ${x+rad} ${y} H${x+bwi-rad} Q${x+bwi} ${y} ${x+bwi} ${y+rad} V${T+hh} Z`,fill:CH,'fill-opacity':i===rows.length-1?1:.75}));
  g.append(sv('rect',{x:x-1,y:T,width:bw,height:hh,fill:'transparent'}));
  if(rows.length<=14||i%2===rows.length%2){const tx=sv('text',{x:x+bwi/2,y:H-6,'text-anchor':'middle',class:'cax'});tx.textContent=dshort(r.k);g.append(tx)}
  if(i===rows.length-1&&r.v>0){const tv=sv('text',{x:x+bwi/2,y:Math.max(10,y-4),'text-anchor':'middle',class:'cval'});tv.textContent=cm(r.v);g.append(tv)}
  const sh=()=>{tip.replaceChildren(h('b',{},(r.v>=0?'+':'')+full(r.v)+' Wen'),h('span',{},'วันที่ '+dshort(r.k)+(r.b?` · บอส ${r.b}`:''))); tip.hidden=false;tip.style.left=(x>W/2?Math.max(0,x-150):x+bwi+6)+'px';tip.style.top='4px';g.classList.add('on')};
  const hd=()=>{tip.hidden=true;g.classList.remove('on')};
  g.onpointerenter=sh;g.onpointerleave=hd;g.onfocus=sh;g.onblur=hd;svg.append(g)});
 wrap.append(svg,tip);return wrap}
let chartRange=86400,showTable=false;
function statsSection(a){
 const s=a.s,W=Math.max(260,Math.min(420,($('#dr').clientWidth||420)-48)),days=a.days||{},keys=Object.keys(days).sort(),today=dkey(now()),td=days[today];
 const g=d=>d?{w:(d.w1||0)-(d.w0||0),b:(d.b1||0)-(d.b0||0),k:(d.k1||0)-(d.k0||0),l:(d.l1||0)-(d.l0||0)}:null,tg=g(td);
 const tile=(l,v,c)=>h('div',{class:'st'},h('span',{},l),h('b',{class:c||''},v));
 const pts=(a.hist||[]).filter(x=>x.t>=now()-chartRange).map(x=>({t:x.t,v:x.w}));
 const rows=keys.slice(-14).map(k=>{const x=g(days[k]);return{k,v:x.w,b:x.b,l:x.l,kk:x.k}});
 const seg=h('div',{class:'seg',role:'group','aria-label':'ช่วงเวลา'},[[86400,'24 ชม.'],[3*86400,'3 วัน']].map(([v,l])=>h('button',{'aria-pressed':chartRange===v,onclick:()=>{chartRange=v;drawer()}},l)));
 return[h('h3',{},'วันนี้'),h('div',{class:'sts'},tile('Wen',tg?(tg.w>=0?'+':'')+cm(tg.w):'–','gold'),tile('บอส',tg?'+'+tg.b:'–'),tile('ฆ่า',tg?'+'+cm(tg.k):'–'),tile('เลเวล',tg&&tg.l?'+'+tg.l:'–')),
  h('div',{class:'chh'},h('h3',{},'Wen ตามเวลา'),seg),lineChart(pts,W),
  h('div',{class:'chh'},h('h3',{},'Wen ที่ได้ต่อวัน'),h('button',{class:'lnk',onclick:()=>{showTable=!showTable;drawer()}},showTable?'ซ่อนตาราง':'ดูเป็นตาราง')),
  showTable?h('table',{class:'dtab'},h('thead',{},h('tr',{},h('th',{},'วันที่'),h('th',{},'Wen'),h('th',{},'บอส'),h('th',{},'ฆ่า'),h('th',{},'เลเวล'))),h('tbody',{},rows.slice().reverse().map(r=>h('tr',{},h('td',{},dshort(r.k)),h('td',{},(r.v>=0?'+':'')+full(r.v)),h('td',{},String(r.b)),h('td',{},full(r.kk)),h('td',{},r.l?'+'+r.l:'–'))))):barChart(rows,W)]}
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
  a.goal&&goalParts(a)?h('div',{class:'dgoal'},h('div',{class:'gc-top'},ring(goalPct(a),80,'d:'+s.name),h('div',{},h('small',{class:'mu'},a.goal.title||'เป้าหมาย'),h('b',{},'ความคืบหน้า '+goalPct(a).toFixed(1)+'%'))),goalMeta(a),spark(a,320,64),goalList(a,false)):null,
  fight(s,st,true)?h('div',{class:'dfight'},fight(s,st,true),(()=>{const b=bossRate(a),q=oreRate(a);return h('span',{class:'mu'},[b!=null?'ล้มบอส '+b+' ตัว/ชม.':null,q!=null?'แร่ +'+cm(q)+'/ชม.':null].filter(Boolean).join(' · '))})()):null,
  h('div',{class:'dvault'},
   h('div',{class:'dwen'},h('p',{class:'lbl',style:'color:#c9a96b'},'Wen'),h('p',{class:'big',title:full(s.wen)},full(s.wen)),h('p',{class:'lbl',style:'color:#c9a96b'},r==null?'กำลังเก็บข้อมูลอัตรา':h('span',{class:r>0?'up':'mu'},(r>0?'+':'')+cm(r)+' ต่อชั่วโมง'))),
   h('div',{class:'dpair'},
    h('div',{class:'ore'},h('p',{class:'lbl'},'Ore'),h('div',{class:'res',style:'grid-template-columns:1fr'},res(ORE,n=>n==='Ore'?'Ore':'Refinement',30,'sm'))),
    h('div',{class:'coins'},h('p',{class:'lbl'},'ถุงเงิน'),h('div',{class:'res',style:'grid-template-columns:1fr'},res(COINS,n=>COIN_TH[n],26,'sm'))))),
  ...statsSection(a),
  h('h3',{},'เลเวล '+(s.level??'–')+' · EXP '+full(s.expCurrent)+' / '+full(s.expGoal)),h('div',{class:'bar'},h('i',{style:`width:${Math.max(0,Math.min(1,e))*100}%`})),
  h('h3',{},'ตัวละคร'),h('div',{class:'kv'},kv('Race',s.race||'–'),kv('Clan',s.clan||'–'),kv('Demon Art',s.demonArt||'–'),kv('Breathing',s.breathing||'–'),kv('Fighting Style',s.fightingStyle||'–'),kv('Slayer / Demon',(s.slayerRank||'–')+' / '+(s.demonRank||'–')),kv('Skill Points',s.skillPoints??'–'),kv('Kills',cm(p.kills)),kv('Boss kills',cm(p.boss_kills)),kv('Deaths',cm(p.deaths)),kv('Tower',p.tower_floor!=null?'ชั้น '+p.tower_floor:'–')),
  ...(Object.keys(s.mastery||{}).length?[h('h3',{},'Mastery'),h('div',{class:'mg'},Object.entries(s.mastery).sort((x,y)=>(y[1].goal?y[1].current/y[1].goal:0)-(x[1].goal?x[1].current/x[1].goal:0)).map(([k,m])=>{const r=m.goal?Math.max(0,Math.min(1,m.current/m.goal)):0,mx=m.goal&&m.current>=m.goal;return h('div',{class:'mc'+(mx?' max':''),title:Math.round(r*100)+'%'},h('div',{class:'mh'},h('span',{class:'mn'},k),mx?h('span',{class:'mx'},'MAX'):h('span',{class:'mp'},Math.round(r*100)+'%')),h('div',{class:'mv'},h('b',{},full(m.current)),h('span',{},' / '+full(m.goal))),h('div',{class:'mb'},h('i',{style:`width:${r*100}%`})))}))]:[]),
  ...bag(s))}
document.querySelectorAll('.fl').forEach(b=>b.onclick=()=>{flt=b.dataset.f;document.querySelectorAll('.fl').forEach(x=>x.setAttribute('aria-pressed',x===b));render()});
$('#q').oninput=e=>{q=e.target.value.toLowerCase();render()};
setInterval(()=>{if(!demo)render()},10000);
/* ---------- โหมดเซิร์ฟเวอร์ ---------- */
const VIEW=location.pathname==='/v';let VTOKEN=null;
let ADMINV=false;
// โหมดแอดมิน: แถบเมนูเดียวกับหน้า /admin กดสลับในแท็บเดิม
function adminNav(){if(document.querySelector('.tabs.anav'))return;const n=document.createElement('nav');n.className='tabs anav';n.setAttribute('aria-label','เมนูแอดมิน');
 for(const[h,l]of[['','ภาพรวมฟาร์ม'],['cust','ลูกค้า'],['ord','ออเดอร์'],['acc','ไอดี'],['ops','แจ้งเตือน'],['bak','สำรองข้อมูล']]){const a=document.createElement('a');a.className='tab-link';a.textContent=l;if(h)a.href='/admin#'+h;else a.setAttribute('aria-current','page');n.append(a)}
 const m=document.querySelector('main');m.insertBefore(n,m.firstChild)}
if(VIEW){const hs=location.hash.slice(1);if(/^sfv_[0-9a-f]{48}$/.test(hs))VTOKEN=hs;
 if(hs==='admin'){try{const t=localStorage.getItem('sf_at');if(/^sfa_[0-9a-f]{64}$/.test(t||'')){VTOKEN=t;ADMINV=true}}catch(e){}if(!ADMINV)location.replace('/admin')}
 try{if(ADMINV){}else if(VTOKEN)localStorage.setItem('sf_vt',VTOKEN);else{const t=localStorage.getItem('sf_vt');if(/^sfv_[0-9a-f]{48}$/.test(t||''))VTOKEN=t}}catch(e){}
 if(hs&&!ADMINV)history.replaceState(null,'','/v');
 document.querySelectorAll('.src>.btn').forEach(b=>b.style.display='none')}
async function pull(){try{const r=await fetch(VIEW?'/api/v1/state':'/api/state',{cache:'no-store',headers:VIEW?{Authorization:'Bearer '+VTOKEN}:{}});
 if(!r.ok){if(ADMINV&&r.status===401){location.replace('/admin');return}if(VIEW&&(r.status===401||r.status===403)){let m='';try{m=(await r.json()).error}catch(e){}A.clear();render();gate(r.status===401?'เซสชันหมดอายุหรือร้านออกคีย์ใหม่ กรุณาเข้าสู่ระบบอีกครั้ง':m==='license expired'?'หมดอายุแล้ว ติดต่อร้านเพื่อต่ออายุ':m==='access revoked'?'บัญชีนี้ถูกระงับ ติดต่อร้าน':'ใช้งานไม่ได้: '+m);return}throw 0}const d=await r.json();
 if(VIEW&&d.expires){const l=$('#lic');l.hidden=false;l.textContent='ใช้งานได้ถึง '+new Date(d.expires*1000).toLocaleDateString('th-TH',{day:'numeric',month:'long',year:'numeric'})}
 const off=d.serverTime-now();A.clear();for(const a of d.accounts){if(a&&a.s){a.s.time-=off;if(a.s.liveAt)a.s.liveAt-=off;a.hist.forEach(x=>x.t-=off);if(a.rejoin)a.rejoin.at-=off;A.set(a.s.name,a)}}
 a_ok();render()}catch(e){$('#mode').textContent='ต่อเซิร์ฟเวอร์ไม่ได้ (ปิดอยู่หรือเปล่า)'}}
function a_ok(){$('#mode').textContent=A.size?'ข้อมูลสดจากสคริปต์ · '+A.size+' ไอดี':(ADMINV?'ยังไม่มีไอดีส่งข้อมูลเข้ามา รัน OWNER-LOADER ในเกม แล้วกด F9 ดูว่าส่งสำเร็จไหม':VIEW?'ยังไม่มีข้อมูลไอดีของคุณ (ผู้ดูแลยังไม่ได้เริ่มรัน หรือยังไม่ได้เพิ่มไอดีให้)':'รอข้อมูลจากสคริปต์... วางสคริปต์ใน executor แล้วรัน')}
/* ---------- เข้าสู่ระบบ (หน้าลูกค้า) ---------- */
function gate(msg){clearInterval(poll);VTOKEN=null;try{localStorage.removeItem('sf_vt')}catch(e){}$('#gate').hidden=false;$('#login-err').textContent=msg||'';setTimeout(()=>$('#login-user').focus(),50)}
$('#login-form').onsubmit=async e=>{e.preventDefault();const b=$('#login-go');b.disabled=true;$('#login-err').textContent='';
 try{const r=await fetch('/api/v1/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user:$('#login-user').value,pass:$('#login-pass').value})});let j={};try{j=await r.json()}catch(x){}
  if(!r.ok){$('#login-err').textContent=j.error||'เข้าสู่ระบบไม่สำเร็จ';return}
  VTOKEN=j.token;try{localStorage.setItem('sf_vt',VTOKEN)}catch(x){}$('#login-pass').value='';$('#gate').hidden=true;$('#lo').hidden=false;goLive()}
 catch(x){$('#login-err').textContent='ต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง'}finally{b.disabled=false}};
$('#lo').onclick=()=>{A.clear();render();$('#lic').hidden=true;$('#lo').hidden=true;gate('')};
async function goLive(){if(VIEW){if(!VTOKEN){demo=false;clearInterval(timer);A.clear();render();gate('');return true}$('#lo').hidden=ADMINV;if(ADMINV){$('h1').textContent='ภาพรวมฟาร์ม';adminNav()}live=true;demo=false;clearInterval(timer);A.clear();clearInterval(poll);await pull();poll=setInterval(pull,3000);return true}
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
/* ไอคอนรวมจากทุกไอดี (เซิร์ฟเวอร์จำไว้) */
async function loadIcons(){try{const r=await fetch('/api/v1/icons');if(!r.ok)return;const m=await r.json();for(const k in m)if(typeof m[k]==='string'&&/^https:/.test(m[k]))ICONS[k]=m[k];render()}catch(e){}}
loadIcons();setInterval(loadIcons,300000);
goLive().then(ok=>{if(!ok)startDemo()});

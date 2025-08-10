// ===== Patent OX PRO — patched main.js =====
// Improvements:
// 1) Cache-busting fetch + robust packs.json fallback
// 2) Always compose 본문+단서 into a single sentence when available
// 3) Stronger topic diversity + repeat avoidance
// 4) Feedback shows full law name + article ref in note

// Small utils
const ch = (a)=>a[Math.floor(Math.random()*a.length)];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

// Cache-busting fetch
async function fetchJSON(u){
  const bust = (u.includes('?')?'&':'?') + 'v=' + Date.now();
  const r = await fetch(u + bust, { cache: 'no-store' });
  if(!r.ok) throw new Error('HTTP '+r.status+' @ '+u);
  return r.json();
}

// packs.json loader: prefer root packs.json if it has packs>0, else fallback to data/packs.json
async function loadPacksListing(){
  try{
    const root = await fetchJSON('./packs.json');
    if (Array.isArray(root.packs) && root.packs.length > 0) return root;
  }catch(e){ /* ignore */ }
  return await fetchJSON('./data/packs.json');
}

// DOM refs
const $ = (q)=>document.querySelector(q);
const setSizeEl = $('#setSize');
const setSizeVal = $('#setSizeVal');
const trapLevelEl = $('#trapLevel');
const trapLevelVal = $('#trapLevelVal');
const diffSel = $('#diffSel');
const modeSel = $('#modeSel');
const autoGenEl = $('#autoGen');
const statement = $('#statement');
const progress = $('#progress');
const feedback = $('#feedback');
const scoreBox = $('#scoreBox');
const versionBox = $('#versionBox');

// Options
const defaultSetSize = 24;
let SET_SIZE = +localStorage.getItem('setSize') || defaultSetSize;
let TRAP_LEVEL = +localStorage.getItem('trapLevel') || 3;
let DIFF = localStorage.getItem('diff') || 'high';
let MODE = localStorage.getItem('mode') || 'mix';
let AUTO_GEN = localStorage.getItem('autoGen') === 'true';

if(setSizeEl){ setSizeEl.value = SET_SIZE; setSizeVal.textContent = SET_SIZE; }
if(trapLevelEl){ trapLevelEl.value = TRAP_LEVEL; trapLevelVal.textContent = TRAP_LEVEL; }
if(diffSel){ diffSel.value = DIFF; }
if(modeSel){ modeSel.value = MODE; }
if(autoGenEl){ autoGenEl.checked = AUTO_GEN; }

if(setSizeEl) setSizeEl.oninput = e=>{ SET_SIZE=+e.target.value; localStorage.setItem('setSize', SET_SIZE); setSizeVal.textContent=SET_SIZE; };
if(trapLevelEl) trapLevelEl.oninput = e=>{ TRAP_LEVEL=+e.target.value; localStorage.setItem('trapLevel', TRAP_LEVEL); trapLevelVal.textContent=TRAP_LEVEL; };
if(diffSel) diffSel.onchange = e=>{ DIFF=e.target.value; localStorage.setItem('diff', DIFF); };
if(modeSel) modeSel.onchange = e=>{ MODE=e.target.value; localStorage.setItem('mode', MODE); pickNewSet(true); render(); };
if(autoGenEl) autoGenEl.onchange = e=>{ AUTO_GEN=e.target.checked; localStorage.setItem('autoGen', AUTO_GEN); };

if($('#newSetBtn')) $('#newSetBtn').onclick=()=>{ pickNewSet(true); render(); };
if($('#resetBtn')) $('#resetBtn').onclick=()=>{ localStorage.clear(); recent=[]; correct=0; tried=0; freq={}; pickNewSet(true); render(); };
if($('#syncBtn')) $('#syncBtn').onclick=()=>{ syncRemote().then(()=>{ pickNewSet(true); render(); }); };
if($('#btnO')) $('#btnO').onclick=()=>answer(true);
if($('#btnX')) $('#btnX').onclick=()=>answer(false);
if($('#fabGen')) $('#fabGen').onclick=()=>{ pickNewSet(true); render(); };

// Banks
let STATUTES=[], ENF=[], CASES=[];
let quiz=[]; let idx=0, correct=0, tried=0; let waiting=false;
let lastSync = localStorage.getItem('lastSync')||'';
let recent = JSON.parse(localStorage.getItem('recentTexts')||'[]');
const NO_REPEAT = 300; // prevent repeats across last 300 items

function topicKey(f){ return (f.cat||'') + '::' + (f.law||''); }
let freq = JSON.parse(localStorage.getItem('topicFreq')||'{}');
function bumpFreq(key){ freq[key]=(freq[key]||0)+1; localStorage.setItem('topicFreq', JSON.stringify(freq)); }
function topicWeight(key){ const c=freq[key]||0; return 1/Math.pow(1+c, 1.5); }

function getTrapSlice(level, traps){ const n=traps?.length||0; if(n===0) return []; if(level>=3) return traps; if(level==2) return traps.slice(0, Math.max(3, Math.ceil(n*2/3))); return traps.slice(0, Math.max(2, Math.ceil(n/2))); }

function numericSwap(text, pairs){ const p = pairs[Math.floor(Math.random()*pairs.length)]; return text.replaceAll('{{숫자}}', p.n).replaceAll('{{단위}}', p.u||''); }
function basisSwap(text){ const bases=['송달일','발송일','공고일','접수일','통지일']; return text.replaceAll('{{기산}}', bases[Math.floor(Math.random()*bases.length)]); }
function whoSwap(text){ const who=['누구든지','이해관계인','권리자','출원인','대리인']; return text.replaceAll('{{주체}}', who[Math.floor(Math.random()*who.length)]); }
function boolFlip(text){ const neg=['아니다','아닐 수도 있다','항상은 아니다']; return text.replaceAll('{{부정}}', neg[Math.floor(Math.random()*neg.length)]); }
function maybePrefix(t){ const p=['','원칙적으로, ','다만, ']; return p[Math.floor(Math.random()*p.length)] + t; }

function composeFull(f){
  const parts = [];
  if (f.main) parts.push(String(f.main).trim().replace(/[.]+$/,''));
  if (f.proviso) parts.push(String(f.proviso).trim().replace(/[.]+$/,''));
  return parts.length ? parts.join(', ') + '.' : null;
}

function notRecent(q){ return !recent.includes(q.text); }
function pushRecent(t){ recent.push(t); if(recent.length>NO_REPEAT) recent = recent.slice(-NO_REPEAT); localStorage.setItem('recentTexts', JSON.stringify(recent)); }

function poolByMode(){
  if(MODE==='statute') return STATUTES;
  if(MODE==='enf') return ENF;
  if(MODE==='case') return CASES;
  return [...STATUTES, ...ENF, ...CASES];
}

function categoryBalancedPick(bank, n){
  const cats=['본문','시행령','판례']; let pick=[];
  if(MODE==='mix'){
    for(const cat of cats){ const arr = bank.filter(x=>x.cat===cat); if(arr.length) pick.push(arr[Math.floor(Math.random()*arr.length)]); }
  }
  const rest = bank.filter(x=>!pick.includes(x));
  const scored = rest.map(it=>({it, score: Math.random()*topicWeight(topicKey(it))})).sort((a,b)=>b.score-a.score).map(x=>x.it);
  while(pick.length<n && scored.length) pick.push(scored.shift());
  return pick.slice(0,n);
}

function toQuestion(f){
  const useTruth = Math.random() < 0.5;
  const full = composeFull(f);
  let text;
  if (full) {
    text = full; // 본문+단서 결합형 우선
  } else {
    // Data already in complete-sentence truths/traps
    let t = useTruth ? ch(f.truths||['']) : ch(getTrapSlice(TRAP_LEVEL, f.traps||[]));
    if(typeof t==='function') t=t();
    if(t?.includes?.('{{숫자}}')) t = numericSwap(t, [{n:'30',u:'일'},{n:'3',u:'개월'},{n:'1',u:'년'}]);
    if(t?.includes?.('{{기산}}')) t = basisSwap(t);
    if(t?.includes?.('{{주체}}')) t = whoSwap(t);
    if(t?.includes?.('{{부정}}')) t = boolFlip(t);
    text = maybePrefix(t||'');
  }
  return { text, answer: useTruth, law: f.law, link: f.link||'#', note: f.note||'', cat: f.cat||'본문' };
}

function pickNewSet(force=false){
  const bank = poolByMode();
  if(bank.length===0){ if(statement) statement.textContent='데이터가 없습니다. [동기화]를 눌러 주세요.'; return; }
  const size = clamp(SET_SIZE, 6, 50);
  let base = categoryBalancedPick(bank, Math.min(size, bank.length));
  let draft = base.map(toQuestion).filter(notRecent);
  if(draft.length < Math.min(size, base.length)){
    const more = bank.sort(()=>Math.random()-0.5).map(toQuestion).filter(notRecent);
    draft = draft.concat(more).slice(0, Math.min(size, bank.length));
  }
  if(force && JSON.stringify(draft.map(q=>q.text))===JSON.stringify((quiz||[]).map(q=>q.text))) return pickNewSet(false);
  quiz = draft; idx=0; correct=0; tried=0; waiting=false; render();
}

function render(){
  const q = quiz[idx];
  if(statement) statement.textContent = q? q.text : '문제가 없습니다. [동기화] 또는 [새 세트]를 눌러 주세요.';
  if(progress) progress.textContent = q? `문항 ${idx+1} / ${quiz.length} · ${q?q.cat:''}` : '';
  if(scoreBox) scoreBox.textContent = `정답 ${correct} / 시도 ${tried}`;
  if(feedback){ feedback.style.display='none'; feedback.className='feedback'; feedback.innerHTML=''; }
  if($('#btnO')) $('#btnO').classList.remove('disabled'); 
  if($('#btnX')) $('#btnX').classList.remove('disabled');
  waiting=false;
}

function showFeedback(ok, q){
  if(!feedback) return;
  feedback.className='feedback ' + (ok?'correct':'wrong');
  const right = q.answer?'O':'X';
  const lawRef = q.note ? ` — <em>${q.note}</em>` : '';
  feedback.innerHTML = (ok?'<strong>정답!</strong>':'<strong>오답.</strong> 정답은 <b>'+right+'</b>입니다.')
    + `<br><span>${q.law||''}</span>${lawRef}`
    + (q.link && q.link!=='#' ? ` — <a class="src" href="${q.link}" target="_blank" rel="noreferrer">근거 보기</a>` : '');
  feedback.style.display='block';
  const btn=document.createElement('button'); btn.id='confirmBtn'; btn.textContent='확인'; btn.className='btn'; btn.style.marginTop='10px';
  btn.onclick=()=>next(); feedback.appendChild(btn);
}

function answer(userO){
  if(waiting) return; const q = quiz[idx]; if(!q) return;
  tried++; const ok = (userO===q.answer); if(ok) correct++;
  showFeedback(ok, q); pushRecent(q.text);
  bumpFreq(topicKey(q));
  waiting=true; if($('#btnO')) $('#btnO').classList.add('disabled'); if($('#btnX')) $('#btnX').classList.add('disabled');
}

function next(){ idx=(idx+1)%quiz.length; render(); }

function versionText(){ return "조문 기준: 2025-07-22 반영 | 빌드: UI-FINAL | 동기화: " + (lastSync? lastSync.replace('T',' ').slice(0,19):'미실행'); }
if(versionBox) versionBox.textContent = versionText();

async function syncRemote(){
  try{
    const listing = await loadPacksListing();
    const packs = Array.isArray(listing.packs)? listing.packs : [];
    let s=[], e=[], c=[];
    for(const p of packs){
      const path = p.file.includes('/')? p.file : ('./data/' + p.file);
      const data = await fetchJSON(path);
      const arr = Array.isArray(data)? data : (Array.isArray(data.items)? data.items : []);
      for(const it of arr){
        const cat = it.cat || '본문';
        if(cat==='본문') s.push(it);
        else if(cat==='시행령') e.push(it);
        else if(cat==='판례') c.push(it);
        else s.push({...it, cat:'본문'});
      }
    }
    STATUTES = s; ENF = e; CASES = c;
    lastSync = new Date().toISOString(); localStorage.setItem('lastSync', lastSync);
    alert('동기화 완료! 본문 '+STATUTES.length+' · 시행령 '+ENF.length+' · 판례 '+CASES.length+' 항목');
  }catch(err){
    alert('동기화 실패: ' + err.message);
  }
}

// boot
if('serviceWorker' in navigator){ window.addEventListener('load', ()=> navigator.serviceWorker.register('./sw.js')); }
(async function(){
  try{ await syncRemote(); }catch{}
  if (AUTO_GEN) pickNewSet(true); else pickNewSet(false);
})();

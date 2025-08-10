// Core state
const ch = (a)=>a[Math.floor(Math.random()*a.length)];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

// Transform helpers
function numericSwap(text, pairs){ const p = ch(pairs); return text.replaceAll('{{숫자}}', p.n).replaceAll('{{단위}}', p.u||''); }
function basisSwap(text){ return text.replaceAll('{{기산}}', ch(['송달일','발송일','공고일','접수일','통지일'])); }
function whoSwap(text){ return text.replaceAll('{{주체}}', ch(['누구든지','이해관계인','권리자','출원인','대리인'])); }
function boolFlip(text){ return text.replaceAll('{{부정}}', ch(['아니다','아닐 수도 있다','항상은 아니다'])); }
function maybePrefix(t){ return ch(['', '원칙적으로, ', '다만, '])+t; }

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

setSizeEl.value = SET_SIZE; setSizeVal.textContent = SET_SIZE;
trapLevelEl.value = TRAP_LEVEL; trapLevelVal.textContent = TRAP_LEVEL;
diffSel.value = DIFF; modeSel.value = MODE; autoGenEl.checked = AUTO_GEN;

setSizeEl.oninput = e=>{ SET_SIZE=+e.target.value; localStorage.setItem('setSize', SET_SIZE); setSizeVal.textContent=SET_SIZE; };
trapLevelEl.oninput = e=>{ TRAP_LEVEL=+e.target.value; localStorage.setItem('trapLevel', TRAP_LEVEL); trapLevelVal.textContent=TRAP_LEVEL; };
diffSel.onchange = e=>{ DIFF=e.target.value; localStorage.setItem('diff', DIFF); };
modeSel.onchange = e=>{ MODE=e.target.value; localStorage.setItem('mode', MODE); pickNewSet(true); render(); };
autoGenEl.onchange = e=>{ AUTO_GEN=e.target.checked; localStorage.setItem('autoGen', AUTO_GEN); };

$('#newSetBtn').onclick=()=>{ pickNewSet(true); render(); };
$('#resetBtn').onclick=()=>{ localStorage.clear(); recent=[]; correct=0; tried=0; freq={}; pickNewSet(true); render(); };
$('#syncBtn').onclick=()=>{ syncRemote().then(()=>{ pickNewSet(true); render(); }); };
$('#btnO').onclick=()=>answer(true);
$('#btnX').onclick=()=>answer(false);
$('#fabGen').onclick=()=>{ pickNewSet(true); render(); };

// Banks
let STATUTES=[], ENF=[], CASES=[];
let quiz=[]; let idx=0, correct=0, tried=0; let waiting=false;
let lastSync = localStorage.getItem('lastSync')||'';
let recent = JSON.parse(localStorage.getItem('recentTexts')||'[]');
const NO_REPEAT = 150;

// Topic anti-repeat
function topicKey(f){ return (f.cat||'') + '::' + (f.law||''); }
let freq = JSON.parse(localStorage.getItem('topicFreq')||'{}');
function bumpFreq(key){ freq[key]=(freq[key]||0)+1; localStorage.setItem('topicFreq', JSON.stringify(freq)); }
function topicWeight(key){ const c=freq[key]||0; return 1/(1+c); }

function getTrapSlice(level, traps){ const n=traps?.length||0; if(n===0) return []; if(level>=3) return traps; if(level==2) return traps.slice(0, Math.max(3, Math.ceil(n*2/3))); return traps.slice(0, Math.max(2, Math.ceil(n/2))); }

function toQuestion(f){
  const useTruth = Math.random()<0.5;
  let text = useTruth ? ch(f.truths) : (()=>{
    let t = ch(getTrapSlice(TRAP_LEVEL, f.traps||[]));
    if(typeof t==='function') t=t();
    if(t?.includes('{{숫자}}')) t = numericSwap(t, [{n:'30',u:'일'},{n:'2',u:'개월'},{n:'3',u:'개월'},{n:'1',u:'년'}]);
    if(t?.includes('{{기산}}')) t = basisSwap(t);
    if(t?.includes('{{주체}}')) t = whoSwap(t);
    if(t?.includes('{{부정}}')) t = boolFlip(t);
    return maybePrefix(t||'');
  })();
  return { text, answer: useTruth, law: f.law, link: f.link||'#', note: f.note||'', cat: f.cat||'본문' };
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

function pickNewSet(force=false){
  const bank = poolByMode();
  if(bank.length===0){ statement.textContent='데이터가 없습니다. [동기화]를 눌러 주세요.'; return; }
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
  statement.textContent = q? q.text : '문제가 없습니다. [동기화] 또는 [새 세트]를 눌러 주세요.';
  progress.textContent = q? `문항 ${idx+1} / ${quiz.length} · ${q?q.cat:''}` : '';
  scoreBox.textContent = `정답 ${correct} / 시도 ${tried}`;
  feedback.style.display='none'; feedback.className='feedback'; feedback.innerHTML='';
  $('#btnO').classList.remove('disabled'); $('#btnX').classList.remove('disabled');
  waiting=false;
}

function showFeedback(ok, q){
  feedback.className='feedback ' + (ok?'correct':'wrong');
  const right = q.answer?'O':'X';
  feedback.innerHTML = (ok?'<strong>정답!</strong>':'<strong>오답.</strong> 정답은 <b>'+right+'</b>입니다.')
    + `<br><span>${q.law}</span>` + (q.link && q.link!=='#' ? ` — <a class="src" href="${q.link}" target="_blank" rel="noreferrer">근거 보기</a>` : '')
    + (q.note? `<br>${q.note}` : '');
  feedback.style.display='block';
  const btn = document.createElement('button'); btn.id='confirmBtn'; btn.textContent='확인';
  btn.className='btn'; btn.style.marginTop='10px';
  btn.onclick=()=>next(); feedback.appendChild(btn);
}

function answer(userO){
  if(waiting) return; const q = quiz[idx]; if(!q) return;
  tried++; const ok = (userO===q.answer); if(ok) correct++;
  showFeedback(ok, q); pushRecent(q.text);
  bumpFreq(topicKey(q));
  waiting=true; $('#btnO').classList.add('disabled'); $('#btnX').classList.add('disabled');
}

function next(){ idx=(idx+1)%quiz.length; render(); }

function versionText(){ return "조문 기준: 2025-07-22 반영 | 빌드: UI-FINAL | 동기화: " + (lastSync? lastSync.replace('T',' ').slice(0,19):'미실행'); }
versionBox.textContent = versionText();

// Multi-pack loader (root packs.json 우선, 없으면 data/packs.json)
async function fetchJSON(u){ const r = await fetch(u + '?v=' + Date.now()); if(!r.ok) throw new Error('네트워크 오류'); return r.json(); }
async function loadPacksListing(){
  try { return await fetchJSON('./packs.json'); }
  catch { return await fetchJSON('./data/packs.json'); }
}
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
    alert('동기화 완료! 총 본문 '+STATUTES.length+' · 시행령 '+ENF.length+' · 판례 '+CASES.length+' 항목');
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

(() => {
  const $ = sel => document.querySelector(sel);
  const packListEl = $("#packList");
  const quizSection = $("#quizSection");
  const packSection = $("#packSection");
  const questionEl = $("#question");
  const metaEl = $("#meta");
  const afterEl = $("#after");
  const resultEl = $("#result");
  const explainBtn = $("#btn-explain");
  const nextBtn = $("#btn-next");
  const hideBtn = $("#btn-hide");
  const btnO = $("#btn-o");
  const btnX = $("#btn-x");
  const btnNew = $("#btn-new");
  const explainDialog = $("#explainDialog");
  const explainBody = $("#explainBody");
  const dlgClose = $("#dlgClose");

  let currentPack = null;
  let questions = [];
  let idx = -1;
  const hiddenSet = new Set(JSON.parse(localStorage.getItem("hiddenQuestionIds")||"[]"));

  function saveHidden() {
    localStorage.setItem("hiddenQuestionIds", JSON.stringify([...hiddenSet]));
  }

  function renderPacks() {
    packListEl.innerHTML = "";
    (window.PACKS||[]).forEach(p => {
      const b = document.createElement("button");
      b.className = "pack";
      b.textContent = p.name;
      b.title = p.description || p.id;
      b.onclick = async () => {
        document.querySelectorAll(".pack").forEach(x => x.classList.remove("selected"));
        b.classList.add("selected");
        await selectPack(p);
      };
      packListEl.appendChild(b);
    });
  }

  async function selectPack(pack) {
    currentPack = pack;
    packSection.classList.add("hidden");
    quizSection.classList.remove("hidden");
    await loadQuestions(pack.data);
    newQuestion();
  }

  async function loadQuestions(url) {
    const res = await fetch(url, {cache: "no-store"});
    if (!res.ok) throw new Error("문제 데이터를 불러올 수 없습니다: "+res.status);
    const data = await res.json();
    questions = (data.questions || data).filter(q => !hiddenSet.has(q.id));
    if (!questions.length) throw new Error("표시할 문제가 없습니다. hidden 목록을 초기화하세요.");
  }

  function pickRandomIndex() {
    if (!questions.length) return -1;
    return Math.floor(Math.random() * questions.length);
  }

  function show(q) {
    metaEl.textContent = `[${q.article_no}${q.clause ? " "+q.clause : ""}] ${q.article_title || ""}`.trim();
    questionEl.textContent = (q.presented || "").trim() + "\n\n(O/X)";
    afterEl.classList.add("hidden");
    resultEl.textContent = "";
  }

  function newQuestion() {
    idx = pickRandomIndex();
    if (idx < 0) return;
    show(questions[idx]);
  }

  function answer(isO) {
    const q = questions[idx];
    if (!q) return;
    const correct = (q.answer || "X").toUpperCase();
    const user = isO ? "O" : "X";
    const ok = (user === correct);
    resultEl.textContent = ok ? "정답입니다." : `오답입니다. 정답은 ${correct} 입니다.`;
    resultEl.style.color = ok ? "var(--ok)" : "var(--danger)";
    afterEl.classList.remove("hidden");
  }

  function showExplain() {
    const q = questions[idx];
    if (!q) return;
    const ref = q.explain_popup_ref || {};
    const full = q.full_text || "";
    const notes = Array.isArray(q.trap_notes) ? q.trap_notes.join(" · ") : (q.trap_notes||"");
    const body = [];
    body.push(`출처: ${ref.source||"Casenote"} / ${ref.law||""} ${ref.article||""}`.trim());
    if (full) {
      body.push("\n— 조문 원문 —\n"+full.trim());
    } else {
      body.push("\n— 조문 원문 —\n데이터 파일의 full_text 필드에 원문 전체를 넣으면 여기 표시됩니다.");
    }
    if (notes) {
      body.push("\n— 트랩 포인트 —\n"+notes);
    }
    explainBody.textContent = body.join("\n");
    explainDialog.showModal();
  }

  function hideForever() {
    const q = questions[idx];
    if (!q) return;
    hiddenSet.add(q.id);
    saveHidden();
    questions.splice(idx,1);
    if (!questions.length) {
      alert("숨김 문제로 인해 표시할 문제가 없습니다. 초기화 페이지에서 복구하세요.");
      return;
    }
    newQuestion();
  }

  // Events
  btnO.addEventListener("click", () => answer(true));
  btnX.addEventListener("click", () => answer(false));
  nextBtn.addEventListener("click", newQuestion);
  explainBtn.addEventListener("click", showExplain);
  hideBtn.addEventListener("click", hideForever);
  btnNew.addEventListener("click", newQuestion);
  dlgClose.addEventListener("click", () => explainDialog.close());

  renderPacks();
})();
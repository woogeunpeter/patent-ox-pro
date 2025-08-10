
/* import_json_patch.js — enable JSON file import */
(function(){
  // Create hidden file input
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json';
  input.style.display = 'none';
  document.body.appendChild(input);

  function handleFile(file){
    const reader = new FileReader();
    reader.onload = () => {
      try{
        const data = JSON.parse(reader.result);
        if (!Array.isArray(data)) throw new Error("JSON 최상위는 배열이어야 합니다.");
        // Basic shape check (optional)
        // if (!data.every(x => x && typeof x === 'object' && 'questionText' in x)) {
        //   throw new Error("문항 형식이 올바르지 않습니다.");
        // }
        items = data;
        if (typeof save === 'function') save(items);
        if (typeof render === 'function') render();
        alert(`불러오기 완료: ${items.length}문항`);
      } catch(e){
        alert("JSON 파싱 실패: " + e.message);
      }
    };
    reader.onerror = () => alert("파일을 읽는 중 오류가 발생했습니다.");
    reader.readAsText(file, 'utf-8');
  }

  input.addEventListener('change', (ev)=>{
    const file = ev.target.files && ev.target.files[0];
    if (file) handleFile(file);
    // reset so same file can be re-selected later
    input.value = "";
  });

  const btn = document.getElementById('btnImport');
  if (btn){
    // Replace default click: normal click → file picker, Alt-click → legacy prompt
    const legacy = btn.onclick; // keep original
    btn.addEventListener('click', (ev)=>{
      if (ev.altKey && typeof legacy === 'function'){
        // legacy paste-import
        legacy.call(btn, ev);
      } else {
        // file picker import
        input.click();
      }
    }, true);
    // Update button label (optional)
    btn.textContent = 'JSON 가져오기(파일)';
    btn.title = '일반 클릭: 파일 선택 · Alt+클릭: 붙여넣기';
  }

  // Drag & Drop support (optional)
  window.addEventListener('dragover', (e)=>{ e.preventDefault(); });
  window.addEventListener('drop', (e)=>{
    e.preventDefault();
    const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (file && /json$/i.test(file.name)) handleFile(file);
  });
})();

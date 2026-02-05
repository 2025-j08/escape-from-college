// Simple typewriter that loads text from data/texts.json (1文字ずつ、高速表示)
(async function(){
  const textEl = document.getElementById('text');
  const textbox = document.getElementById('textbox');
  let texts = ['KD専門学校に入学して、3年という月日が経ってしまった。']; // fallback
  const speed = 25; // ミリ秒（1文字あたり） — 高速に表示

  let currentIndex = 0;
  let chars = [];
  let idx = 0;
  let timer = null;

  async function loadTexts(){
    // Resolve data path relative to the current document so it works
    // when the HTML is served from root or from docs/.
    const candidate = new URL('../data/texts.json', document.baseURI).href;
    try{
      const res = await fetch(candidate);
      if (!res.ok) throw new Error('fetch failed');
      const j = await res.json();
      if (Array.isArray(j.texts) && j.texts.length > 0) texts = j.texts.map(String);
      return;
    }catch(e){
      // fetch may fail when opening the HTML via file:// — attempt to read inline JSON in the page
      try{
        const script = document.getElementById('texts');
        if (script && script.textContent){
          const j = JSON.parse(script.textContent);
          if (Array.isArray(j.texts) && j.texts.length > 0) texts = j.texts.map(String);
          return;
        }
      }catch(inner){
        console.warn('Could not parse inline texts JSON.', inner);
      }
      console.warn('Could not load ../data/texts.json, using fallback text.', e);
    }
  }

  function startTyping(index){
    clearTimer();
    currentIndex = index;
    const fullText = texts[currentIndex] || '';
    chars = Array.from(fullText);
    idx = 0;
    textEl.textContent = '';
    removeCaret();
    if (chars.length === 0) addCaret();
    else type();
  }

  function type(){
    if (idx >= chars.length){
      addCaret();
      timer = null;
      return;
    }
    textEl.textContent += chars[idx];
    idx++;
    timer = setTimeout(type, speed);
  }

  function addCaret(){
    removeCaret();
    const span = document.createElement('span');
    span.className = 'caret';
    textEl.appendChild(span);
  }

  function removeCaret(){
    const c = textEl.querySelector('.caret');
    if (c) c.remove();
  }

  function revealAll(){
    if (timer) { clearTimeout(timer); timer = null }
    textEl.textContent = (texts[currentIndex] || '');
    addCaret();
  }

  function clearTimer(){
    if (timer){ clearTimeout(timer); timer = null }
  }

  function advance(){
    if (timer) { // currently typing -> reveal
      revealAll();
      return;
    }
    // move to next text if exists
    if (currentIndex + 1 < texts.length){
      startTyping(currentIndex + 1);
    } else {
      // finished all texts — keep last text displayed (could add callback)
      addCaret();
    }
  }

  // click to skip/type faster or advance
  textbox.addEventListener('click', ()=>{ advance(); });

  // Enter key to advance (also ignore when typing in input fields)
  window.addEventListener('keydown', (e)=>{
    if (e.key === 'Enter'){
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;
      e.preventDefault();
      advance();
    }
  });

  // start after DOM loaded: load JSON then start first text
  window.addEventListener('load', async ()=>{
    await loadTexts();
    startTyping(0);
  });
})();

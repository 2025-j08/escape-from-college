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
      if (Array.isArray(j.texts) && j.texts.length > 0) texts = j.texts;
      return;
    }catch(e){
      // fetch may fail when opening the HTML via file:// — attempt to read inline JSON in the page
      try{
        const script = document.getElementById('texts');
        if (script && script.textContent){
            const j = JSON.parse(script.textContent);
            if (Array.isArray(j.texts) && j.texts.length > 0) texts = j.texts;
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
    const entry = texts[currentIndex];

    // handle command entries
    if (entry && typeof entry === 'object'){
      if (entry.cmd === 'bg'){
        // Clear visible text immediately so previous line doesn't remain during transition
        clearTimer();
        removeCaret();
        textEl.textContent = '';
        changeBackground(entry.src, !!entry.transition).then(()=>{
          // advance to next after changing background with a 2s delay
          setTimeout(()=>{
            if (currentIndex + 1 < texts.length) startTyping(currentIndex + 1);
          }, 2000);
        });
        return;
      }
      if (entry.cmd === 'wait'){
        // show caret (or keep current text) and wait specified ms then advance
        removeCaret();
        timer = setTimeout(()=>{
          timer = null;
          if (currentIndex + 1 < texts.length) startTyping(currentIndex + 1);
        }, entry.ms || 1000);
        return;
      }
      // unknown command -> skip
      if (currentIndex + 1 < texts.length) { startTyping(currentIndex + 1); }
      return;
    }

    const fullText = String(entry || '');
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
    const entry = texts[currentIndex];
    if (entry && typeof entry === 'object'){
      // if currently waiting, skip to the next
      if (entry.cmd === 'wait'){
        if (currentIndex + 1 < texts.length) startTyping(currentIndex + 1);
        return;
      }
      // other command - just advance
      if (currentIndex + 1 < texts.length) startTyping(currentIndex + 1);
      return;
    }
    textEl.textContent = (texts[currentIndex] || '');
    addCaret();
  }

  function clearTimer(){
    if (timer){ clearTimeout(timer); timer = null }
  }

  function advance(){
    const entry = texts[currentIndex];
    if (timer) { // currently typing or waiting -> reveal/skip
      revealAll();
      return;
    }
    // if current entry is a command, just advance
    if (entry && typeof entry === 'object'){
      if (entry.cmd === 'wait'){
        // not waiting now (timer null) -> just start next
        if (currentIndex + 1 < texts.length) startTyping(currentIndex + 1);
        return;
      }
      if (currentIndex + 1 < texts.length) startTyping(currentIndex + 1);
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

  function changeBackground(src, transition = true){
    return new Promise((resolve)=>{
      const url = new URL(src, document.baseURI).href;
      const bg = document.querySelector('.bg');
      if (!transition || !bg){
        if (bg) bg.style.backgroundImage = `url("${url}")`;
        resolve();
        return;
      }

      const overlay = document.createElement('div');
      overlay.className = 'bg-overlay';
      overlay.style.backgroundImage = `url("${url}")`;
      document.body.appendChild(overlay);
      // force reflow then fade in
      void overlay.offsetWidth;
      overlay.style.opacity = '1';

      let called = false;
      const finish = ()=>{ if (called) return; called = true; setTimeout(()=>{
        if (bg) bg.style.backgroundImage = `url("${url}")`;
        // fade out overlay
        overlay.style.opacity = '0';
        setTimeout(()=>{ overlay.remove(); resolve(); }, 300);
      }, 0); };

      overlay.addEventListener('transitionend', finish);
      // safety timeout
      setTimeout(finish, 800);
    });
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

// Novel game engine with text and scene management
(async function(){
  const textEl = document.getElementById('text');
  const textbox = document.getElementById('textbox');
  const directionsContainer = document.getElementById('directions');
  const searchBtn = document.getElementById('search-btn');
  const skipBtn = document.getElementById('skip-btn');
  const curtainBtn = document.getElementById('curtain-btn');
  const passwordBtn = document.getElementById('password-btn');
  const passwordModal = document.getElementById('password-modal');
  const passwordDigits = Array.from(document.querySelectorAll('#password-modal .password-digit'));
  const passwordError = document.getElementById('password-error');
  const passwordSubmitBtn = document.getElementById('password-submit');
  const passwordCancelBtn = document.getElementById('password-cancel');
  const finalPasswordBtn = document.getElementById('finalPassword-btn');
  const finalPasswordModal = document.getElementById('finalPassword-modal');
  const finalPasswordDigits = Array.from(document.querySelectorAll('#finalPassword-modal .password-digit'));
  const finalPasswordError = document.getElementById('finalPassword-error');
  const finalPasswordSubmitBtn = document.getElementById('finalPassword-submit');
  const finalPasswordCancelBtn = document.getElementById('finalPassword-cancel');
  const messageBtn = document.getElementById('message-btn');
  const messageModal = document.getElementById('message-modal');
  const messageText = document.getElementById('message-text');

  // Global game state
  const gGameState = {
    mode: 'text', // 'text' or 'scene'
    cleared: false, // PCギミッククリア状態
    currentScene: null,
    sceneData: null,
    texts: [],
    currentIndex: 0,
    isSearchMode: false, // 虫眼鏡モード（背景フィルターなし）
    visitedScenes: new Set(), // 訪問済みシーンを記録
    showPasswordAfterText: false,
    showCurtainAfterText: false,
    showFinalPasswordAfterText: false, // 最終パスワード表示フラグ
    showSearchBtnAfterText: false, // 虫眼鏡ボタン表示フラグ（2回目以降用）
    showDirectionsAfterText: false, // 方向ボタン表示フラグ（初回訪問時用）
    messageShownText: '', // メッセージで表示するテキスト
    messageModalOpen: false, // メッセージモーダルが開いているか
    sceneTextPages: [], // 配列形式のシーンテキストページ
    currentTextPageIndex: 0 // 現在表示中のページインデックス
  };

  let chars = [];
  let idx = 0;
  let timer = null;
  let sceneFullText = '';
  let isSceneTyping = false;
  const speed = 25; // ミリ秒（1文字あたり）

  async function loadChapter(chapterName){
    // Load chapter JSON file by name (e.g., 'prologue', 'chapter1')
    const candidate = new URL(`data/${chapterName}.json`, document.baseURI).href;
    try{
      const res = await fetch(candidate);
      if (!res.ok) throw new Error('fetch failed');
      const j = await res.json();
      if (Array.isArray(j.texts) && j.texts.length > 0) gGameState.texts = j.texts;
      return;
    }catch(e){
      // fetch may fail when opening the HTML via file:// 
      // Try to read from inline JSON embedded in HTML with chapter-specific ID
      const scriptId = `${chapterName}-texts`;
      try{
        const script = document.getElementById(scriptId);
        if (script && script.textContent){
            const j = JSON.parse(script.textContent);
            if (Array.isArray(j.texts) && j.texts.length > 0) {
              gGameState.texts = j.texts;
              console.info(`Loaded ${chapterName} from inline JSON (file:// mode).`);
              return;
            }
        }
      }catch(inner){
        console.warn(`Could not parse inline ${scriptId} JSON.`, inner);
      }
      console.warn(`Could not load data/${chapterName}.json. Inline fallback also failed.`, e);
    }
  }

  async function loadSceneData(chapterName){
    // Load scene-based chapter (e.g., chapter2)
    const candidate = new URL(`data/${chapterName}.json`, document.baseURI).href;
    try{
      const res = await fetch(candidate);
      if (!res.ok) throw new Error('fetch failed');
      gGameState.sceneData = await res.json();
      return gGameState.sceneData;
    }catch(e){
      // Fallback to inline JSON from script tags
      const scriptId = `${chapterName}-texts`;
      try{
        const script = document.getElementById(scriptId);
        if (script && script.textContent){
          gGameState.sceneData = JSON.parse(script.textContent);
          console.info(`Loaded ${chapterName} scenes from inline JSON (file:// mode).`);
          return gGameState.sceneData;
        }
      }catch(inner){
        console.warn(`Could not parse inline ${scriptId} JSON.`, inner);
      }
      console.warn(`Could not load data/${chapterName}.json. Inline fallback also failed.`, e);
      return null;
    }
  }

  function updateBackgroundFilter(){
    // Update background brightness filter based on search mode
    const bg = document.querySelector('.bg');
    if (bg){
      if (gGameState.isSearchMode){
        bg.style.filter = 'brightness(1)'; // Full brightness
      } else {
        bg.style.filter = 'brightness(0.4)'; // Dark filter
      }
    }
  }

  async function changeScene(sceneName){
    if (gGameState.cleared){
      const clearedSceneMap = {
        'room-front': 'room-front-on',
        'room-tv': 'room-tv-on'
      };
      if (clearedSceneMap[sceneName]){
        sceneName = clearedSceneMap[sceneName];
      }
    }

    if (!gGameState.sceneData || !gGameState.sceneData.scenes[sceneName]){
      console.warn(`Scene '${sceneName}' not found.`);
      return;
    }

    gGameState.currentScene = sceneName;
    const scene = gGameState.sceneData.scenes[sceneName];
    
    // Check if this is the first visit to this scene
    const isFirstVisit = !gGameState.visitedScenes.has(sceneName);
    if (isFirstVisit) {
      gGameState.visitedScenes.add(sceneName);
    }

    // Skip window-curtain on subsequent visits and go directly to window-hint
    if (sceneName === 'window-curtain' && !isFirstVisit){
      await changeScene('window-hint');
      return;
    }

    // Change background with transition effect (but not for escape scene to avoid darkening)
    if (scene.bg){
      const useTransition = sceneName !== 'escape';
      await changeBackground(scene.bg, useTransition);
    }

    // Special handling for escape scene (final victory screen)
    if (sceneName === 'escape'){
      // Remove dark filter to show escape image at full brightness
      const bg = document.querySelector('.bg');
      if (bg){
        bg.style.filter = 'brightness(1)';
      }
      // Hide all UI elements
      if (textbox) textbox.style.display = 'none';
      if (directionsContainer) directionsContainer.style.display = 'none';
      if (searchBtn) searchBtn.style.display = 'none';
      if (skipBtn) skipBtn.style.display = 'none';
      if (passwordBtn) passwordBtn.style.display = 'none';
      if (finalPasswordBtn) finalPasswordBtn.style.display = 'none';
      if (curtainBtn) curtainBtn.style.display = 'none';
      if (messageBtn) {
        messageBtn.classList.remove('visible');
        messageBtn.classList.remove('active');
      }
      return; // Exit early, no text processing needed
    }

    // Display scene text based on visit count
    let displayText = '';
    if (scene.alwaysShowText) {
      // Exception: always show text (use firstVisitText on first visit, text on subsequent visits)
      if (isFirstVisit && scene.firstVisitText) {
        displayText = scene.firstVisitText;
      } else if (scene.text) {
        displayText = scene.text;
      }
    } else if (isFirstVisit && scene.firstVisitText) {
      // Normal case: show firstVisitText only on first visit
      displayText = scene.firstVisitText;
    } else if (scene.text) {
      // Fallback to regular text if no firstVisitText
      displayText = scene.text;
    }
    
    // Handle array-based text (multiple pages)
    if (Array.isArray(displayText) && displayText.length > 0) {
      gGameState.sceneTextPages = displayText;
      gGameState.currentTextPageIndex = 0;
      startSceneTyping(displayText[0]);
    } else if (displayText && displayText.trim() !== ''){
      gGameState.sceneTextPages = [];
      gGameState.currentTextPageIndex = 0;
      startSceneTyping(displayText);
    } else {
      gGameState.sceneTextPages = [];
      gGameState.currentTextPageIndex = 0;
      textEl.textContent = '';
      removeCaret();
    }
    
    // Show/hide textbox based on whether there is text to display
    const hasDisplayText = Array.isArray(displayText) ? displayText.length > 0 : (displayText && displayText.trim() !== '');
    if (hasDisplayText){
      if (textbox) textbox.style.display = 'flex';
    } else {
      if (textbox) textbox.style.display = 'none';
    }

    // Update direction buttons
    updateDirectionButtons(scene.directions || {});
    
    // Show search button in scene mode (but hide for door-open scene)
    if (searchBtn) {
      if (sceneName === 'door-open') {
        searchBtn.style.display = 'none';
      } else {
        searchBtn.style.display = 'flex';
      }
    }
    
    // Hide skip button in scene mode
    if (skipBtn) skipBtn.style.display = 'none';
    
    // Handle curtain button for window-curtain scene
    gGameState.showCurtainAfterText = false;
    if (scene.action === 'curtain'){
      const hasText = Array.isArray(displayText) ? displayText.length > 0 : (displayText && displayText.trim() !== '');
      if (isFirstVisit && hasText){
        if (curtainBtn) curtainBtn.style.display = 'none';
        gGameState.showCurtainAfterText = true;
      } else {
        if (curtainBtn) curtainBtn.style.display = 'block';
      }
      if (directionsContainer) directionsContainer.style.display = 'none';
      if (searchBtn) searchBtn.style.display = 'none';
    } else if (scene.action === 'finalPassword'){
      // Handle final password button for display-zoomin-on scene (show after text on all visits)
      const hasText = Array.isArray(displayText) ? displayText.length > 0 : (displayText && displayText.trim() !== '');
      if (hasText){
        if (finalPasswordBtn) finalPasswordBtn.style.display = 'none';
        gGameState.showFinalPasswordAfterText = true;
        // Show search button after text on 2nd+ visit
        if (!isFirstVisit){
          gGameState.showSearchBtnAfterText = true;
        }
        // Hide direction buttons initially on first visit (show after text)
        if (isFirstVisit){
          if (directionsContainer) directionsContainer.style.display = 'none';
          gGameState.showDirectionsAfterText = true;
        } else {
          if (directionsContainer) directionsContainer.style.display = 'flex';
        }
      } else {
        if (finalPasswordBtn) finalPasswordBtn.style.display = 'block';
        if (directionsContainer) directionsContainer.style.display = 'flex';
      }
      // Show search button only on 2nd+ visit to show hint (window with text overlay)
      if (searchBtn) {
        if (!isFirstVisit && hasText) {
          searchBtn.style.display = 'flex';
        } else {
          searchBtn.style.display = 'none';
        }
      }
    } else {
      if (curtainBtn) curtainBtn.style.display = 'none';
      if (finalPasswordBtn) finalPasswordBtn.style.display = 'none';
      // Re-show direction buttons and search button for normal scenes (but not door-open)
      if (directionsContainer) directionsContainer.style.display = 'flex';
      if (searchBtn) {
        if (sceneName !== 'door-open') {
          searchBtn.style.display = 'flex';
        }
      }
    }
    
    // Handle password button for display-zoomin scene (only when not cleared)
    const shouldShowPassword = (sceneName === 'display-zoomin' && !gGameState.cleared);
    gGameState.showPasswordAfterText = false;
    if (shouldShowPassword){
      const hasText = Array.isArray(displayText) ? displayText.length > 0 : (displayText && displayText.trim() !== '');
      if (isFirstVisit && hasText){
        if (passwordBtn) passwordBtn.style.display = 'none';
        gGameState.showPasswordAfterText = true;
      } else {
        if (passwordBtn) passwordBtn.style.display = 'block';
      }
    } else {
      if (passwordBtn) passwordBtn.style.display = 'none';
    }
    
    // Handle message bubble button for scenes with firstVisitText
    // Show only on subsequent visits (to replay the first-visit text)
    // But hide if scene uses alwaysShowText (text is always displayed)
    if (!scene.alwaysShowText && !isFirstVisit && scene.firstVisitText){
      gGameState.messageShownText = scene.firstVisitText;
      if (messageBtn) {
        messageBtn.classList.add('visible');
        messageBtn.classList.remove('active');
      }
    } else {
      gGameState.messageShownText = '';
      if (messageBtn) {
        messageBtn.classList.remove('visible');
        messageBtn.classList.remove('active');
      }
    }
    
    // Reset search mode when changing scenes
    gGameState.isSearchMode = false;
    updateBackgroundFilter();
    if (searchBtn) searchBtn.classList.remove('active');
  }

  function updateDirectionButtons(directions){
    const buttons = document.querySelectorAll('.dir-btn');
    buttons.forEach(btn => {
      const dir = btn.dataset.direction;
      if (directions[dir]){
        btn.disabled = false;
        btn.style.display = 'flex';
      } else {
        btn.disabled = true;
        btn.style.display = 'none';
      }
    });
  }

  function resolveNextScene(directionData){
    // directionData can be a string (scene name) or an object with default/cleared states or next property
    if (typeof directionData === 'string'){
      return directionData;
    }
    if (typeof directionData === 'object'){
      // Check for next property first
      if (directionData.next){
        return directionData.next;
      }
      // Then check for default/cleared states
      if (directionData.default){
        return gGameState.cleared ? (directionData.cleared || directionData.default) : directionData.default;
      }
    }
    return null;
  }

  function startTyping(index){
    clearTimer();
    gGameState.currentIndex = index;
    const entry = gGameState.texts[gGameState.currentIndex];

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
            if (gGameState.currentIndex + 1 < gGameState.texts.length) startTyping(gGameState.currentIndex + 1);
          }, 2000);
        });
        return;
      }
      if (entry.cmd === 'wait'){
        // show caret (or keep current text) and wait specified ms then advance
        removeCaret();
        timer = setTimeout(()=>{
          timer = null;
          if (gGameState.currentIndex + 1 < gGameState.texts.length) startTyping(gGameState.currentIndex + 1);
        }, entry.ms || 1000);
        return;
      }
      if (entry.cmd === 'nextChapter'){
        // Load next chapter and start from beginning
        clearTimer();
        removeCaret();
        textEl.textContent = '';
        const nextChapterName = entry.chapter || 'chapter1';
        (async ()=>{
          if (nextChapterName === 'chapter2'){
            // Switch to scene mode
            await loadSceneData('chapter2');
            gGameState.mode = 'scene';
            // Hide textbox in scene mode
            if (textbox) textbox.style.display = 'none';
            if (directionsContainer) directionsContainer.style.display = 'flex';
            if (skipBtn) skipBtn.style.display = 'none';
            await changeScene('room-front');
          } else {
            // Remain in text mode
            gGameState.mode = 'text';
            // Show textbox for text mode
            if (textbox) textbox.style.display = 'flex';
            // Hide all direction buttons in text mode
            document.querySelectorAll('.dir-btn').forEach(btn => {
              btn.disabled = true;
              btn.style.display = 'none';
            });
            // Show skip button in text mode
            if (skipBtn) skipBtn.style.display = 'block';
            await loadChapter(nextChapterName);
            startTyping(0);
          }
        })();
        return;
      }
      // unknown command -> skip
      if (gGameState.currentIndex + 1 < gGameState.texts.length) { startTyping(gGameState.currentIndex + 1); }
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
      isSceneTyping = false;
      
      // Only show buttons after the last page of array text is displayed
      const isLastPage = gGameState.sceneTextPages.length === 0 || 
                         gGameState.currentTextPageIndex >= gGameState.sceneTextPages.length - 1;
      
      if (isLastPage && gGameState.mode === 'scene' && gGameState.showPasswordAfterText){
        if (passwordBtn) passwordBtn.style.display = 'block';
        gGameState.showPasswordAfterText = false;
      }
      if (isLastPage && gGameState.mode === 'scene' && gGameState.showCurtainAfterText){
        if (curtainBtn) curtainBtn.style.display = 'block';
        gGameState.showCurtainAfterText = false;
      }
      if (isLastPage && gGameState.mode === 'scene' && gGameState.showFinalPasswordAfterText){
        if (finalPasswordBtn) finalPasswordBtn.style.display = 'block';
        gGameState.showFinalPasswordAfterText = false;
      }
      if (isLastPage && gGameState.mode === 'scene' && gGameState.showDirectionsAfterText){
        if (directionsContainer) directionsContainer.style.display = 'flex';
        gGameState.showDirectionsAfterText = false;
      }
      if (isLastPage && gGameState.mode === 'scene' && gGameState.showSearchBtnAfterText){
        // Don't show search button on door-open or escape scene
        if (gGameState.currentScene !== 'door-open' && gGameState.currentScene !== 'escape'){
          if (searchBtn) searchBtn.style.display = 'flex';
        }
        gGameState.showSearchBtnAfterText = false;
      }
      return;
    }
    textEl.textContent += chars[idx];
    idx++;
    timer = setTimeout(type, speed);
  }

  function startSceneTyping(fullText){
    clearTimer();
    isSceneTyping = true;
    sceneFullText = String(fullText || '');
    chars = Array.from(sceneFullText);
    idx = 0;
    textEl.textContent = '';
    removeCaret();
    if (chars.length === 0) {
      addCaret();
      isSceneTyping = false;
    } else {
      type();
    }
  }

  function revealSceneAll(){
    if (timer) { clearTimeout(timer); timer = null; }
    textEl.textContent = sceneFullText || '';
    removeCaret();
    addCaret();
    isSceneTyping = false;
    
    // Only show buttons after the last page of array text is displayed
    const isLastPage = gGameState.sceneTextPages.length === 0 || 
                       gGameState.currentTextPageIndex >= gGameState.sceneTextPages.length - 1;
    
    if (isLastPage && gGameState.mode === 'scene' && gGameState.showPasswordAfterText){
      if (passwordBtn) passwordBtn.style.display = 'block';
      gGameState.showPasswordAfterText = false;
    }
    if (isLastPage && gGameState.mode === 'scene' && gGameState.showCurtainAfterText){
      if (curtainBtn) curtainBtn.style.display = 'block';
      gGameState.showCurtainAfterText = false;
    }
    if (isLastPage && gGameState.mode === 'scene' && gGameState.showFinalPasswordAfterText){
      if (finalPasswordBtn) finalPasswordBtn.style.display = 'block';
      gGameState.showFinalPasswordAfterText = false;
    }
    if (isLastPage && gGameState.mode === 'scene' && gGameState.showDirectionsAfterText){
      if (directionsContainer) directionsContainer.style.display = 'flex';
      gGameState.showDirectionsAfterText = false;
    }
    if (isLastPage && gGameState.mode === 'scene' && gGameState.showSearchBtnAfterText){
      // Don't show search button on door-open or escape scene
      if (gGameState.currentScene !== 'door-open' && gGameState.currentScene !== 'escape'){
        if (searchBtn) searchBtn.style.display = 'flex';
      }
      gGameState.showSearchBtnAfterText = false;
    }
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
    const entry = gGameState.texts[gGameState.currentIndex];
    if (entry && typeof entry === 'object'){
      // if currently waiting, skip to the next
      if (entry.cmd === 'wait'){
        if (gGameState.currentIndex + 1 < gGameState.texts.length) startTyping(gGameState.currentIndex + 1);
        return;
      }
      // if nextChapter command, execute it immediately
      if (entry.cmd === 'nextChapter'){
        startTyping(gGameState.currentIndex); // re-trigger to execute the command
        return;
      }
      // other command - just advance
      if (gGameState.currentIndex + 1 < gGameState.texts.length) startTyping(gGameState.currentIndex + 1);
      return;
    }
    textEl.textContent = (gGameState.texts[gGameState.currentIndex] || '');
    addCaret();
  }

  function clearTimer(){
    if (timer){ clearTimeout(timer); timer = null }
  }

  function advance(){
    const entry = gGameState.texts[gGameState.currentIndex];
    if (timer) { // currently typing or waiting -> reveal/skip
      revealAll();
      return;
    }
    // if current entry is a command, just advance
    if (entry && typeof entry === 'object'){
      if (entry.cmd === 'wait'){
        // not waiting now (timer null) -> just start next
        if (gGameState.currentIndex + 1 < gGameState.texts.length) startTyping(gGameState.currentIndex + 1);
        return;
      }
      if (entry.cmd === 'nextChapter'){
        // Execute chapter transition
        startTyping(gGameState.currentIndex);
        return;
      }
      if (gGameState.currentIndex + 1 < gGameState.texts.length) startTyping(gGameState.currentIndex + 1);
      return;
    }
    // move to next text if exists
    if (gGameState.currentIndex + 1 < gGameState.texts.length){
      startTyping(gGameState.currentIndex + 1);
    } else {
      // finished all texts — keep last text displayed (could add callback)
      addCaret();
    }
  }

  async function skipToEnd(){
    // Skip from start to playable scene (room-front in chapter2)
    if (timer) { clearTimeout(timer); timer = null }
    
    // Clear text and caret
    removeCaret();
    textEl.textContent = '';
    
    // Load chapter2 scene data and switch to scene mode
    await loadSceneData('chapter2');
    gGameState.mode = 'scene';
    
    // Hide skip button (no longer needed in scene mode)
    if (skipBtn) skipBtn.style.display = 'none';
    
    // Hide textbox in scene mode (will be shown again if scene has text)
    if (textbox) textbox.style.display = 'none';
    
    // Show direction buttons for scene navigation
    if (directionsContainer) directionsContainer.style.display = 'flex';
    
    // Start at room-front scene
    await changeScene('room-front');
  }

  // Animate background brightening effect for escape scene
  function animateBrighten(){
    return new Promise((resolve)=>{
      const bg = document.querySelector('.bg');
      if (!bg){
        resolve();
        return;
      }

      const duration = 800; // animation duration in ms
      const startTime = performance.now();
      const startBrightness = 0.4; // current brightness (dark)
      const endBrightness = 1; // target brightness (full)

      const animate = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const brightness = startBrightness + (endBrightness - startBrightness) * progress;
        bg.style.filter = `brightness(${brightness})`;

        if (progress < 1){
          requestAnimationFrame(animate);
        } else {
          resolve();
        }
      };

      requestAnimationFrame(animate);
    });
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
  textbox.addEventListener('click', ()=>{ 
    if (gGameState.mode === 'text'){
      advance();
      return;
    }
    if (gGameState.mode === 'scene'){
      if (isSceneTyping){
        // Skip typing animation and show full current page
        revealSceneAll();
      } else if (gGameState.sceneTextPages.length > 0 && gGameState.currentTextPageIndex < gGameState.sceneTextPages.length - 1){
        // Advance to next page in array
        gGameState.currentTextPageIndex++;
        startSceneTyping(gGameState.sceneTextPages[gGameState.currentTextPageIndex]);
      }
    }
  });

  // Enter key to advance (also ignore when typing in input fields)
  window.addEventListener('keydown', (e)=>{
    if (e.key === 'Enter'){
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;
      e.preventDefault();
      if (gGameState.mode === 'text') {
        advance();
      } else if (gGameState.mode === 'scene'){
        if (isSceneTyping){
          // Skip typing animation and show full current page
          revealSceneAll();
        } else if (gGameState.sceneTextPages.length > 0 && gGameState.currentTextPageIndex < gGameState.sceneTextPages.length - 1){
          // Advance to next page in array
          gGameState.currentTextPageIndex++;
          startSceneTyping(gGameState.sceneTextPages[gGameState.currentTextPageIndex]);
        }
      }
    }
  });

  // Direction button handlers for scene mode
  function setupDirectionButtons(){
    document.querySelectorAll('.dir-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const dir = e.target.closest('button').getAttribute('data-direction');
        if (!gGameState.sceneData || !gGameState.currentScene) return;
        
        const scene = gGameState.sceneData.scenes[gGameState.currentScene];
        if (!scene || !scene.directions) return;
        
        const directionData = scene.directions[dir];
        if (!directionData) return;
        
        // Hide all UI elements immediately before transition
        if (directionsContainer) directionsContainer.style.display = 'none';
        if (searchBtn) searchBtn.style.display = 'none';
        if (textbox) textbox.style.display = 'none';
        if (passwordBtn) passwordBtn.style.display = 'none';
        if (finalPasswordBtn) finalPasswordBtn.style.display = 'none';
        if (messageBtn) {
          messageBtn.classList.remove('visible');
          messageBtn.classList.remove('active');
        }
        if (messageModal) messageModal.style.display = 'none';
        gGameState.messageModalOpen = false;
        textEl.textContent = '';
        
        // Handle action objects (focus, escape)
        if (typeof directionData === 'object' && directionData.action){
          if (directionData.action === 'focus'){
            // Show text, wait, transition
            textEl.textContent = directionData.text || '';
            const waitMs = directionData.wait || 1000;
            const nextScene = resolveNextScene(directionData.next);
            timer = setTimeout(async () => {
              timer = null;
              if (nextScene && typeof nextScene === 'string'){
                await changeScene(nextScene);
              }
            }, waitMs);
            return;
          } else if (directionData.action === 'escape'){
            // End game - Show victory screen with escape.png
            const backgroundEl = document.getElementById('background');
            if (backgroundEl) {
              backgroundEl.style.backgroundImage = 'url(asset/images/escape.png)';
              backgroundEl.style.backgroundColor = '';
            }
            
            // Hide textbox since the image contains the victory message
            if (textbox) textbox.style.display = 'none';
            return;
          }
        }
        
        // Otherwise, navigate to next scene
        const nextScene = resolveNextScene(directionData);
        if (nextScene && typeof nextScene === 'string'){
          // Special handling for escape scene - animate brightening and ensure brightness is maintained
          if (nextScene === 'escape'){
            // Set brightness filter to max BEFORE the scene change
            const bg = document.querySelector('.bg');
            if (bg){
              bg.style.filter = 'brightness(1) !important';
            }
            await animateBrighten();
          }
          await changeScene(nextScene);
        }
      });
    });
  }

  // Search button handler to toggle full background view
  if (searchBtn){
    searchBtn.addEventListener('click', () => {
      gGameState.isSearchMode = !gGameState.isSearchMode;
      updateBackgroundFilter();
      
      // Toggle active class for visual feedback
      if (gGameState.isSearchMode){
        searchBtn.classList.add('active');
      } else {
        searchBtn.classList.remove('active');
      }
      
      // Special handling for display-zoomin scene (first password)
      if (gGameState.currentScene === 'display-zoomin'){
        if (gGameState.isSearchMode){
          // Search mode ON: hide UI and password button
          if (textbox) textbox.style.display = 'none';
          if (directionsContainer) directionsContainer.style.display = 'none';
          if (passwordBtn) passwordBtn.style.display = 'none';
        } else {
          // Search mode OFF: show UI (but not textbox)
          if (directionsContainer) directionsContainer.style.display = 'flex';
          // Only show passwordBtn if all text has been displayed (not currently typing)
          const isAllTextDisplayed = !isSceneTyping && 
            (gGameState.sceneTextPages.length === 0 || 
             gGameState.currentTextPageIndex >= gGameState.sceneTextPages.length - 1);
          if (passwordBtn) {
            passwordBtn.style.display = isAllTextDisplayed ? 'block' : 'none';
          }
        }
        return;
      }
      
      // Special handling for display-zoomin-on scene (final password)
      if (gGameState.currentScene === 'display-zoomin-on'){
        if (gGameState.isSearchMode){
          // Search mode ON: hide UI
          if (textbox) textbox.style.display = 'none';
          if (directionsContainer) directionsContainer.style.display = 'none';
          if (finalPasswordBtn) finalPasswordBtn.style.display = 'none';
        } else {
          // Search mode OFF: show UI
          if (textbox) textbox.style.display = 'flex';
          if (directionsContainer) directionsContainer.style.display = 'flex';
          // Only show finalPasswordBtn if all text has been displayed (not currently typing)
          const isAllTextDisplayed = !isSceneTyping && 
            (gGameState.sceneTextPages.length === 0 || 
             gGameState.currentTextPageIndex >= gGameState.sceneTextPages.length - 1);
          if (finalPasswordBtn) {
            finalPasswordBtn.style.display = isAllTextDisplayed ? 'block' : 'none';
          }
        }
        return;
      }
      
      // Default search mode behavior for other scenes
      // Hide/show textbox and direction buttons in search mode
      if (gGameState.isSearchMode){
        // Search mode ON: hide UI and all action buttons
        if (textbox) textbox.style.display = 'none';
        if (directionsContainer) directionsContainer.style.display = 'none';
        if (passwordBtn) passwordBtn.style.display = 'none';
        if (curtainBtn) curtainBtn.style.display = 'none';
        if (finalPasswordBtn) finalPasswordBtn.style.display = 'none';
      } else {
        // Search mode OFF: show UI
        // Only show textbox if current scene has text to display
        if (gGameState.sceneData && gGameState.currentScene){
          const scene = gGameState.sceneData.scenes[gGameState.currentScene];
          if (scene) {
            const isFirstVisit = !gGameState.visitedScenes.has(gGameState.currentScene);
            let displayText = '';
            if (scene.alwaysShowText) {
              if (isFirstVisit && scene.firstVisitText) {
                displayText = scene.firstVisitText;
              } else if (scene.text) {
                displayText = scene.text;
              }
            } else if (isFirstVisit && scene.firstVisitText) {
              displayText = scene.firstVisitText;
            } else if (scene.text) {
              displayText = scene.text;
            }
            
            if (displayText && displayText.trim() !== ''){
              if (textbox) textbox.style.display = 'flex';
            } else {
              if (textbox) textbox.style.display = 'none';
            }
          }
        }
        if (directionsContainer) directionsContainer.style.display = 'flex';
        // Re-enable direction buttons based on current scene
        if (gGameState.sceneData && gGameState.currentScene){
          const scene = gGameState.sceneData.scenes[gGameState.currentScene];
          if (scene){
            updateDirectionButtons(scene.directions || {});
          }
        }
      }
    });
  }

  // Skip button handler to skip to end of current chapter
  if (skipBtn){
    skipBtn.addEventListener('click', async () => {
      if (gGameState.mode === 'text'){
        await skipToEnd();
      }
    });
  }

  // Curtain button handler for window-curtain scene
  if (curtainBtn){
    curtainBtn.addEventListener('click', async () => {
      if (gGameState.currentScene === 'window-curtain'){
        // Hide UI elements before transition to prevent flash
        if (textbox) textbox.style.display = 'none';
        if (curtainBtn) curtainBtn.style.display = 'none';
        if (passwordBtn) passwordBtn.style.display = 'none';
        textEl.textContent = '';
        await changeScene('window-hint');
      }
    });
  }

  // Password button handler for display-zoomin scene
  if (passwordBtn){
    passwordBtn.addEventListener('click', () => {
      if (passwordModal) passwordModal.style.display = 'flex';
      // Clear previous inputs and errors
      passwordDigits.forEach(input => input.value = '');
      if (passwordError) passwordError.textContent = '';
      if (passwordSubmitBtn) passwordSubmitBtn.disabled = true;
      // Focus first digit
      if (passwordDigits[0]) passwordDigits[0].focus();
    });
  }

  // Password modal cancel button
  if (passwordCancelBtn){
    passwordCancelBtn.addEventListener('click', () => {
      if (passwordModal) passwordModal.style.display = 'none';
    });
  }

  // Password digit input handlers - auto-advance to next field
  passwordDigits.forEach((input, index) => {
    input.addEventListener('input', (e) => {
      const value = e.target.value;
      // Only allow single digit
      if (value.length > 1) {
        e.target.value = value.slice(-1);
      }
      // Auto-focus next field if digit entered
      if (e.target.value.length === 1 && index < passwordDigits.length - 1) {
        passwordDigits[index + 1].focus();
      }
      // Check if all fields filled
      const allFilled = Array.from(passwordDigits).every(inp => inp.value.length === 1);
      if (passwordSubmitBtn) passwordSubmitBtn.disabled = !allFilled;
    });

    input.addEventListener('keydown', (e) => {
      // Auto-focus previous field on backspace if current field is empty
      if (e.key === 'Backspace' && input.value === '' && index > 0) {
        passwordDigits[index - 1].focus();
      }
    });
  });

  // Password submit button handler
  if (passwordSubmitBtn){
    passwordSubmitBtn.addEventListener('click', async () => {
      const enteredPassword = Array.from(passwordDigits).map(inp => inp.value).join('');
      const correctPassword = '633574';
      
      if (enteredPassword === correctPassword) {
        // Correct password!
        gGameState.cleared = true;
        if (passwordModal) passwordModal.style.display = 'none';
        if (passwordBtn) passwordBtn.style.display = 'none';
        // Clear text before transition to prevent flash
        if (textbox) textbox.style.display = 'none';
        textEl.textContent = '';
        // Transition to cleared scene
        await changeScene('display-zoomin-on');
      } else {
        // Incorrect password
        if (passwordError) passwordError.textContent = 'パスワードが間違っています';
        // Clear inputs
        passwordDigits.forEach(input => input.value = '');
        if (passwordSubmitBtn) passwordSubmitBtn.disabled = true;
        // Focus first digit
        if (passwordDigits[0]) passwordDigits[0].focus();
      }
    });
  }

  // Final Password button handler for display-zoomin-on scene (2nd+ visit)
  if (finalPasswordBtn){
    finalPasswordBtn.addEventListener('click', () => {
      if (finalPasswordModal) finalPasswordModal.style.display = 'flex';
      // Clear previous inputs and errors
      finalPasswordDigits.forEach(input => input.value = '');
      if (finalPasswordError) finalPasswordError.textContent = '';
      if (finalPasswordSubmitBtn) finalPasswordSubmitBtn.disabled = true;
      // Focus first digit
      if (finalPasswordDigits[0]) finalPasswordDigits[0].focus();
    });
  }

  // Final Password modal cancel button
  if (finalPasswordCancelBtn){
    finalPasswordCancelBtn.addEventListener('click', () => {
      if (finalPasswordModal) finalPasswordModal.style.display = 'none';
    });
  }

  // Final Password digit input handlers - auto-advance to next field
  finalPasswordDigits.forEach((input, index) => {
    input.addEventListener('input', (e) => {
      const value = e.target.value;
      // Only allow single digit
      if (value.length > 1) {
        e.target.value = value.slice(-1);
      }
      // Auto-focus next field if digit entered
      if (e.target.value.length === 1 && index < finalPasswordDigits.length - 1) {
        finalPasswordDigits[index + 1].focus();
      }
      // Check if all fields filled
      const allFilled = Array.from(finalPasswordDigits).every(inp => inp.value.length === 1);
      if (finalPasswordSubmitBtn) finalPasswordSubmitBtn.disabled = !allFilled;
    });

    input.addEventListener('keydown', (e) => {
      // Auto-focus previous field on backspace if current field is empty
      if (e.key === 'Backspace' && input.value === '' && index > 0) {
        finalPasswordDigits[index - 1].focus();
      }
    });
  });

  // Final Password submit button handler
  if (finalPasswordSubmitBtn){
    finalPasswordSubmitBtn.addEventListener('click', async () => {
      const enteredPassword = Array.from(finalPasswordDigits).map(inp => inp.value).join('');
      const correctPassword = '8753';
      
      if (enteredPassword === correctPassword) {
        // Correct password - go to door-open scene
        console.log('[DEBUG] Final password correct! Transitioning to door-open scene.');
        if (finalPasswordModal) finalPasswordModal.style.display = 'none';
        if (finalPasswordBtn) finalPasswordBtn.style.display = 'none';
        // Hide search button and keep it hidden for this scene and beyond
        if (searchBtn) searchBtn.style.display = 'none';
        // Clear text before transition
        if (textbox) textbox.style.display = 'none';
        textEl.textContent = '';
        // For now, transition to door-open scene
        await changeScene('door-open');
      } else {
        // Incorrect password
        if (finalPasswordError) finalPasswordError.textContent = 'パスワードが間違っています';
        // Clear inputs
        finalPasswordDigits.forEach(input => input.value = '');
        if (finalPasswordSubmitBtn) finalPasswordSubmitBtn.disabled = true;
        // Focus first digit
        if (finalPasswordDigits[0]) finalPasswordDigits[0].focus();
      }
    });
  }

  // Message button handler - toggle message modal
  if (messageBtn){
    messageBtn.addEventListener('click', () => {
      gGameState.messageModalOpen = !gGameState.messageModalOpen;
      if (gGameState.messageModalOpen){
        // Open message modal
        if (messageModal) messageModal.style.display = 'flex';
        // Handle array text by joining with double newlines
        const displayText = Array.isArray(gGameState.messageShownText) 
          ? gGameState.messageShownText.join('\n\n')
          : gGameState.messageShownText;
        if (messageText) messageText.textContent = displayText;
        if (messageBtn) messageBtn.classList.add('active');
        // Hide direction buttons and search button while message is open
        if (directionsContainer) directionsContainer.style.display = 'none';
        if (searchBtn) searchBtn.style.display = 'none';
      } else {
        // Close message modal
        if (messageModal) messageModal.style.display = 'none';
        if (messageBtn) messageBtn.classList.remove('active');
        // Show direction buttons and search button again (based on scene)
        if (gGameState.sceneData && gGameState.currentScene){
          const scene = gGameState.sceneData.scenes[gGameState.currentScene];
          if (scene){
            if (scene.action === 'finalPassword'){
              // For display-zoomin-on: show search button, direction buttons, and final password button (only if text complete)
              if (directionsContainer) directionsContainer.style.display = 'flex';
              if (searchBtn) searchBtn.style.display = 'flex';
              // Only show finalPasswordBtn if all text has been displayed (not currently typing)
              const isAllTextDisplayed = !isSceneTyping && 
                (gGameState.sceneTextPages.length === 0 || 
                 gGameState.currentTextPageIndex >= gGameState.sceneTextPages.length - 1);
              if (finalPasswordBtn) {
                finalPasswordBtn.style.display = isAllTextDisplayed ? 'block' : 'none';
              }
            } else if (!scene.action){
              // For other scenes: only show if no special action
              if (directionsContainer) directionsContainer.style.display = 'flex';
              if (searchBtn) searchBtn.style.display = 'flex';
            }
          }
        }
      }
    });
  }

  // Message modal close on click
  if (messageModal){
    messageModal.addEventListener('click', () => {
      gGameState.messageModalOpen = false;
      if (messageModal) messageModal.style.display = 'none';
      if (messageBtn) messageBtn.classList.remove('active');
      // Show direction buttons and search button again (based on scene)
      if (gGameState.sceneData && gGameState.currentScene){
        const scene = gGameState.sceneData.scenes[gGameState.currentScene];
        if (scene){
          if (scene.action === 'finalPassword'){
            // For display-zoomin-on: show search button, direction buttons, and final password button (only if text complete)
            if (directionsContainer) directionsContainer.style.display = 'flex';
            if (searchBtn) searchBtn.style.display = 'flex';
            // Only show finalPasswordBtn if all text has been displayed (not currently typing)
            const isAllTextDisplayed = !isSceneTyping && 
              (gGameState.sceneTextPages.length === 0 || 
               gGameState.currentTextPageIndex >= gGameState.sceneTextPages.length - 1);
            if (finalPasswordBtn) {
              finalPasswordBtn.style.display = isAllTextDisplayed ? 'block' : 'none';
            }
          } else if (!scene.action){
            // For other scenes: only show if no special action
            if (directionsContainer) directionsContainer.style.display = 'flex';
            if (searchBtn) searchBtn.style.display = 'flex';
          }
        }
      }
    });
  }

  // start after DOM loaded: load prologue chapter then start first text
  window.addEventListener('load', async ()=>{
    // Hide direction buttons initially (only show in scene mode)
    if (directionsContainer) directionsContainer.style.display = 'none';
    // Hide search button initially (only show in scene mode)
    if (searchBtn) searchBtn.style.display = 'none';
    // Show skip button initially (show in text mode)
    if (skipBtn) skipBtn.style.display = 'block';
    // Hide curtain button initially
    if (curtainBtn) curtainBtn.style.display = 'none';
    // Hide password button initially
    if (passwordBtn) passwordBtn.style.display = 'none';
    // Hide password modal initially
    if (passwordModal) passwordModal.style.display = 'none';
    // Hide message button initially
    if (messageBtn) messageBtn.classList.remove('visible');
    // Hide message modal initially
    if (messageModal) messageModal.style.display = 'none';
    // Hide all direction buttons initially (individual buttons controlled by updateDirectionButtons)
    document.querySelectorAll('.dir-btn').forEach(btn => {
      btn.disabled = true;
      btn.style.display = 'none';
    });
    // Setup direction button handlers (buttons will be enabled/disabled based on scene)
    setupDirectionButtons();
    // Load and display prologue
    gGameState.mode = 'text';
    // Show textbox for text mode
    if (textbox) textbox.style.display = 'flex';
    await loadChapter('prologue');
    startTyping(0);
  });
})();

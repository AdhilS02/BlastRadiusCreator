(function(){
  'use strict';
  // Settings
  const BASE = (window.APP_BASE || '/');
  const GIFS_DIR = BASE + 'Sprite/SpriteGifs/';
  const WORDS_PATH = BASE + 'Sprite/SpriteWords.json';
  const GIFS_MANIFEST = BASE + 'Sprite/SpriteGifs.json';

  // DOM refs (initialized in initDom)
  let container, img, bubble, bubbleText;

  function initDom(){
    if (container && document.getElementById('spriteAssistant')) return; // already initialized
    container = document.createElement('div');
    container.id = 'spriteAssistant';
    Object.assign(container.style, { position: 'fixed', left: '12px', bottom: '28px', zIndex: '2000', pointerEvents: 'none' });

    img = document.createElement('img');
    img.alt = 'Assistant';
    // Bigger sprite + soft drop shadow
    Object.assign(img.style, { display: 'block', width: '128px', height: '128px', objectFit: 'contain', pointerEvents: 'auto', filter: 'drop-shadow(0 8px 14px rgba(0,0,0,0.50))' });

    bubble = document.createElement('div');
    bubble.id = 'spriteSpeech';
    // Bigger bubble, widened to hold ~4 words before wrapping
    Object.assign(bubble.style, {
      position: 'absolute', left: '160px', bottom: '90px',
      minWidth: '24ch', maxWidth: '60ch',
      background: 'rgba(255,255,255,0.95)', border: '1px solid #e5e7eb', borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,.12)', color: '#111827',
      fontFamily: "'Poppins', system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
      fontSize: '16px', lineHeight: '1.3', padding: '12px 14px', display: 'none',
      whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'anywhere'
    });

    bubbleText = document.createElement('div');
    bubble.appendChild(bubbleText);
    container.appendChild(img);
    container.appendChild(bubble);
    document.body.appendChild(container);
  }

  const fallbackGifNames = ['1.gif','2.gif','3.gif','4.gif','5.gif'];
  let gifNames = null;
  let lastGifUrl = null;

  function pickRandom(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

  async function resolveGifNames(){
    if (Array.isArray(window.SPRITE_GIF_NAMES) && window.SPRITE_GIF_NAMES.length) { gifNames = window.SPRITE_GIF_NAMES.slice(); return; }
    try { const res = await fetch(GIFS_MANIFEST, { cache: 'no-cache' }); if (res.ok) { const list = await res.json(); if (Array.isArray(list) && list.length) { gifNames = list; return; } } } catch { }
    gifNames = fallbackGifNames;
  }

  function setRandomGif(){
    const list = (gifNames && gifNames.length) ? gifNames : fallbackGifNames;
    const shuffled = list.slice().sort(()=>Math.random()-.5);
    let idx = 0;
    function tryNext(){
      if(idx >= shuffled.length){
        console.warn('No sprite GIFs could be loaded from', GIFS_DIR, 'names tried:', list);
        img.removeAttribute('src');
        img.alt = 'Sprite not found';
        // Placeholder emoji scaled to sprite size + soft shadow
        const ph = document.createElement('div');
        ph.textContent = '🙂';
        ph.style.fontSize = '80px'; ph.style.lineHeight = '128px'; ph.style.width='128px'; ph.style.height='128px'; ph.style.textAlign='center'; ph.style.userSelect='none';
        ph.style.boxShadow = '0 8px 14px rgba(0,0,0,0.28)';
        container.replaceChild(ph, img);
        lastGifUrl = null;
        return;
      }
      const name = shuffled[idx++];
      const url = name.startsWith('http') ? name : (GIFS_DIR + name);
      const test = new Image();
      test.onload = () => { img.src = url; lastGifUrl = url; };
      test.onerror = () => { console.warn('Sprite GIF missing:', url); tryNext(); };
      test.src = url;
    }
    tryNext();
  }

  // Change to a different random GIF (avoid repeating the last if possible)
  function changeGifRandomDifferent(){
    const list = (gifNames && gifNames.length) ? gifNames : fallbackGifNames;
    const candidates = list.slice().map(n => n.startsWith('http') ? n : (GIFS_DIR + n));
    let pool = candidates.filter(u => u !== lastGifUrl);
    if (!pool.length) pool = candidates.slice();
    // shuffle pool
    for(let i = pool.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i+1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    let idx = 0;
    function tryNext(){
      if(idx >= pool.length){ return; }
      const url = pool[idx++];
      const test = new Image();
      test.onload = () => { img.src = url; lastGifUrl = url; };
      test.onerror = () => { tryNext(); };
      test.src = url;
    }
    tryNext();
  }

  function normalizeKey(s){ return (s || '').trim().replace(/\s+/g, ' ').toLowerCase(); }

  let wordsIndex = {};
  let wordsReady = false;
  async function loadWords(){
    try {
      const res = await fetch(WORDS_PATH, { cache: 'no-cache' });
      if(!res.ok) throw new Error('Failed to load SpriteWords.json');
      const data = await res.json();
      const src = (data && data.keywords) || {};
      const idx = {};
      for(const k in src){ if(!Object.prototype.hasOwnProperty.call(src, k)) continue; const norm = normalizeKey(k); const arr = Array.isArray(src[k]) ? src[k] : [String(src[k])]; if(!idx[norm]) idx[norm] = []; idx[norm].push(...arr); }
      wordsIndex = idx;
    } catch (e) { console.warn('Sprite words unavailable', e); wordsIndex = {}; }
    finally { wordsReady = true; }
  }

  const queue = []; let showing = false;
  function showBubbleAsync(text, ms=3500){ return new Promise(resolve => { bubbleText.textContent = text; bubble.style.display = 'block'; bubble.style.opacity = '0'; bubble.animate([{opacity:0, transform:'translateY(6px)'},{opacity:1, transform:'translateY(0)'}], {duration:180, easing:'ease-out', fill:'forwards'}); const timer = setTimeout(()=>{ bubble.animate([{opacity:1},{opacity:0}], {duration:200, easing:'ease-in', fill:'forwards'}).onfinish = ()=>{ bubble.style.display='none'; resolve(); }; }, ms); bubble.onclick = () => { clearTimeout(timer); bubble.style.display='none'; resolve(); }; }); }
  async function processQueue(){ if(showing) return; showing = true; try { while(queue.length){ const msg = queue.shift(); await showBubbleAsync(msg); } } finally { showing = false; } }
  function enqueueBubble(msg){ queue.push(msg); processQueue(); }

  const seenRoots = new Set();
  const chosenForRoot = new Map();

  function collectRootKeys(){ const ta = document.getElementById('inputText'); const keys = []; if(!ta) return keys; const lines = (ta.value||'').split(/\r?\n/); const occLocal = new Map(); for(const raw of lines){ const trimmed = raw.trim(); if(trimmed.length === 0) continue; let indent = 0; for(let i=0;i<raw.length;i++){ if(raw[i]===' ') indent++; else if(raw[i]==='\t') indent+=4; else break; } if(indent !== 0) continue; const norm = normalizeKey(raw); const count = (occLocal.get(norm) || 0) + 1; occLocal.set(norm, count); keys.push({ key: `${norm}#${count}`, norm }); } return keys; }

  function handleRootsChange(){
    const roots = collectRootKeys();
    if(!roots.length) return;
    let changedGifThisPass = false;
    for(const r of roots){
      if(seenRoots.has(r.key)) continue;
      const phrases = wordsIndex[r.norm];
      if(phrases && phrases.length){ const phrase = pickRandom(phrases); chosenForRoot.set(r.key, phrase); enqueueBubble(phrase); }
      if(wordsReady) seenRoots.add(r.key);
      if(!changedGifThisPass){ changeGifRandomDifferent(); changedGifThisPass = true; }
    }
  }

  async function wire(){
    try{
      initDom();
      await resolveGifNames();
      setRandomGif();
      await loadWords();
      const ta = document.getElementById('inputText');
      if(ta){ ta.addEventListener('input', () => { try { handleRootsChange(); } catch(e){ console.error('spriteAssistant handleRootsChange failed', e); } }); }
      const origRender = window.renderDiagramSafe;
      if(typeof origRender === 'function'){
        window.renderDiagramSafe = function(){ try { origRender(); } finally { try { handleRootsChange(); } catch(e){ console.error('spriteAssistant post-render failed', e); } } };
      }
      handleRootsChange();
    } catch(e){
      console.error('spriteAssistant init failed', e);
    }
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
})();
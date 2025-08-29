(function(){
  'use strict';
  const btn = document.getElementById('btnTutorial');
  if(!btn) return;

  function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }
  function setCaret(el, pos){ try{ el.focus(); el.setSelectionRange(pos, pos); }catch{} }

  async function typeText(el, text, delay){
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    let v = el.value;
    // remove selection
    v = v.slice(0, start) + v.slice(end);
    el.value = v;
    setCaret(el, start);
    for(let i=0;i<text.length;i++){
      const cur = el.selectionStart ?? el.value.length;
      el.value = el.value.slice(0, cur) + text[i] + el.value.slice(cur);
      setCaret(el, cur+1);
      window.justTyped = true; window.renderDiagramSafe && window.renderDiagramSafe(); window.justTyped = false;
      await sleep(delay);
    }
  }

  function showToast(msg, duration=2400){
    return new Promise(resolve => {
      const div = document.createElement('div');
      div.className = 'position-fixed top-0 start-50 translate-middle-x mt-3 alert alert-info shadow';
      div.style.zIndex = '2000';
      div.style.maxWidth = '90%';
      div.style.whiteSpace = 'pre-line';
      div.textContent = msg;
      document.body.appendChild(div);
      const timer = setTimeout(() => { try { div.remove(); } catch {} resolve(); }, duration);
      // If user clicks the toast, dismiss immediately
      div.addEventListener('click', () => { clearTimeout(timer); try { div.remove(); } catch {} resolve(); }, { once: true });
    });
  }

  // Prevent user edits during tutorial
  let tutorialActive = false;
  const blockInputHandlers = [];
  function lockUserInput(active){
    const input = document.getElementById('inputText');
    if(!input) return;
    if(active){
      tutorialActive = true;
      input.readOnly = true;
      input.classList.add('pe-none'); // prevent pointer events
      const prevent = (e) => { e.preventDefault(); e.stopPropagation(); };
      const events = ['keydown','keypress','input','paste','cut','drop','mousedown'];
      events.forEach(ev => { input.addEventListener(ev, prevent, true); blockInputHandlers.push({ ev, prevent }); });
    } else {
      tutorialActive = false;
      input.readOnly = false;
      input.classList.remove('pe-none');
      blockInputHandlers.forEach(({ev, prevent}) => input.removeEventListener(ev, prevent, true));
      blockInputHandlers.length = 0;
    }
  }

  // Simulate dragging a node by dispatching mouse events
  async function simulateDrag(nodeId, dx, dy, steps=16, stepDelay=16){
    const g = document.getElementById(`node-${nodeId}`);
    if(!g) return;
    const startX = Math.floor(window.innerWidth/2);
    const startY = Math.floor(window.innerHeight/2);
    const md = new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: startX, clientY: startY, button: 0 });
    g.dispatchEvent(md);
    for(let i=1;i<=steps;i++){
      const mx = startX + Math.round((dx*i)/steps);
      const my = startY + Math.round((dy*i)/steps);
      const mm = new MouseEvent('mousemove', { bubbles: true, cancelable: true, clientX: mx, clientY: my, buttons: 1 });
      window.dispatchEvent(mm);
      await sleep(stepDelay);
    }
    const mu = new MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX: startX+dx, clientY: startY+dy, button: 0 });
    window.dispatchEvent(mu);
    window.justTyped = true; window.renderDiagramSafe && window.renderDiagramSafe(); window.justTyped = false;
  }

  async function runTutorial(){
    const input = document.getElementById('inputText');
    if(!input){ await showToast('Open the main page to run the tutorial.'); return; }

    lockUserInput(true);
    try{
      // Start fresh
      input.focus();
      input.value = '';
      setCaret(input, 0);
      window.renderDiagramSafe && window.renderDiagramSafe();

      await showToast("Let's start by typing a parent:");
      await typeText(input, 'bubble 1', 80);

      await showToast('Press Enter to go to a new line, then press Tab to create a child.');
      // Simulate Enter + Tab + type child
      {
        const cur = input.selectionStart ?? input.value.length;
        input.value = input.value.slice(0, cur) + '\n' + input.value.slice(cur);
        setCaret(input, cur+1);
        window.justTyped = true; window.renderDiagramSafe && window.renderDiagramSafe(); window.justTyped = false;
        await sleep(180);
        const cur2 = input.selectionStart ?? input.value.length;
        input.value = input.value.slice(0, cur2) + '\t' + input.value.slice(cur2);
        setCaret(input, cur2 + 1);
        await typeText(input, 'child 1', 70);
      }

      await showToast('Enter then Tab again creates another child.');
      {
        const cur = input.selectionStart ?? input.value.length;
        input.value = input.value.slice(0, cur) + '\n' + input.value.slice(cur);
        setCaret(input, cur+1);
        window.justTyped = true; window.renderDiagramSafe && window.renderDiagramSafe(); window.justTyped = false;
        await sleep(180);
        const cur2 = input.selectionStart ?? input.value.length;
        input.value = input.value.slice(0, cur2) + '\t' + input.value.slice(cur2);
        setCaret(input, cur2 + 1);
        await typeText(input, 'child 2', 70);
      }

      await showToast('Press Enter twice to start a new parent.');
      {
        const cur = input.selectionStart ?? input.value.length;
        input.value = input.value.slice(0, cur) + '\n\n' + input.value.slice(cur);
        setCaret(input, cur + 2);
        window.justTyped = true; window.renderDiagramSafe && window.renderDiagramSafe(); window.justTyped = false;
        await typeText(input, 'bubble 2', 80);
      }

      // New step: demonstrate moving nodes
      await showToast('You can also drag nodes to reposition them. Watch this...');
      // Allow render to catch up
      await sleep(300);
      // Try to move first root (0:0) and its first child (0:1) if available
      await simulateDrag('0:0', 140, 0, 14, 14);
      await simulateDrag('0:1', 40, 90, 12, 14);

      await showToast('Tutorial finished!');
    } finally {
      lockUserInput(false);
    }
  }

  btn.addEventListener('click', () => { runTutorial().catch(console.error); });
})();
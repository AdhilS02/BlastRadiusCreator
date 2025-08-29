(function () {
  'use strict';
  const container = document.getElementById('splitContainer');
  const left = document.getElementById('leftPane');
  const resizer = document.getElementById('splitResizer');
  const input = document.getElementById('inputText');

  if (!container || !left || !resizer || !input) return;

  // Expose flag for right pane typing animation
  window.justTyped = false;

  const getBounds = () => container.getBoundingClientRect();
  const clamp = (val, min, max) => Math.max(min, Math.min(val, max));
  const minWidth = 200; // px
  const maxRatio = 0.9; // left pane will not exceed 90% of container
  const resizerWidth = () => (resizer.offsetWidth || 6);

  const init = () => {
    const rect = getBounds();
    const initial = clamp(rect.width * 0.4, minWidth, rect.width * maxRatio);
    container.style.gridTemplateColumns = `${initial}px ${resizerWidth()}px 1fr`;
    window.renderDiagramSafe && window.renderDiagramSafe();
  };

  const setWidthFromClientX = (clientX) => {
    const rect = getBounds();
    const maxWidth = rect.width * maxRatio;
    const newWidth = clamp(clientX - rect.left, minWidth, maxWidth);
    container.style.gridTemplateColumns = `${newWidth}px ${resizerWidth()}px 1fr`;
  };

  // Mouse drag for split
  resizer.addEventListener('mousedown', (e) => {
    e.preventDefault();
    document.body.classList.add('is-resizing');
    function onMove(ev) { setWidthFromClientX(ev.clientX); }
    function onUp() { document.body.classList.remove('is-resizing'); window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  });

  // Keyboard resize
  resizer.addEventListener('keydown', (e) => {
    const rect = getBounds();
    const step = (e.shiftKey ? 50 : 10);
    const current = left.getBoundingClientRect().width;
    const newWidth = (delta) => clamp(current + delta, minWidth, rect.width * maxRatio);
    if (e.key === 'ArrowLeft') { e.preventDefault(); container.style.gridTemplateColumns = `${newWidth(-step)}px ${resizerWidth()}px 1fr`; }
    else if (e.key === 'ArrowRight') { e.preventDefault(); container.style.gridTemplateColumns = `${newWidth(step)}px ${resizerWidth()}px 1fr`; }
  });

  // Textarea helpers: tab indent/outdent + auto-indent on enter
  const TAB_CH = '\t';
  input.addEventListener('keydown', (e) => {
    const value = input.value;
    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? 0;

    const getLineStart = (idx) => { let i = idx; while (i > 0 && value[i - 1] !== '\n') i--; return i; };
    const getLineEnd = (idx) => { let i = idx; while (i < value.length && value[i] !== '\n') i++; return i; };

    if (e.key === 'Tab') {
      e.preventDefault();
      const isMultiLine = value.slice(start, end).includes('\n');
      if (!isMultiLine && start === end) {
        if (e.shiftKey) {
          const ls = getLineStart(start);
          const prefix = value.slice(ls, ls + 1);
          let removeCount = 0;
          if (prefix === '\t') removeCount = 1; else {
            const spaces = value.slice(ls, ls + 8);
            const m = spaces.match(/^\s+/);
            if (m) removeCount = Math.min(m[0].replace(/\t/g, '    ').length, 4);
          }
          if (removeCount > 0) {
            const newVal = value.slice(0, ls) + value.slice(ls + removeCount);
            input.value = newVal; const delta = -removeCount; const newPos = Math.max(ls, start + delta); input.setSelectionRange(newPos, newPos);
          }
        } else {
          const newVal = value.slice(0, start) + TAB_CH + value.slice(end);
          input.value = newVal; const pos = start + 1; input.setSelectionRange(pos, pos);
        }
      } else {
        const ls = getLineStart(start);
        const le = getLineEnd(end);
        const block = value.slice(ls, le);
        const lines = block.split('\n');
        let changed = 0;
        if (e.shiftKey) {
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith('\t')) { lines[i] = lines[i].slice(1); changed -= 1; }
            else if (lines[i].startsWith('    ')) { lines[i] = lines[i].slice(4); changed -= 4; }
            else if (lines[i].startsWith(' ')) { const m = lines[i].match(/^ +/); const c = Math.min(m[0].length, 4); lines[i] = lines[i].slice(c); changed -= c; }
          }
        } else {
          for (let i = 0; i < lines.length; i++) { lines[i] = TAB_CH + lines[i]; changed += 1; }
        }
        const newBlock = lines.join('\n');
        const newVal = value.slice(0, ls) + newBlock + value.slice(le);
        input.value = newVal;
        const newStart = ls; const newEnd = start + changed + (end - start);
        input.setSelectionRange(newStart, Math.max(newStart, newEnd));
      }
      window.renderDiagramSafe && window.renderDiagramSafe();
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      let ls = start; while (ls > 0 && value[ls - 1] !== '\n') ls--;
      // Determine if current line is blank (only whitespace)
      let le = start; while (le < value.length && value[le] !== '\n') le++;
      const currentLine = value.slice(ls, le);
      const isBlankLine = currentLine.trim().length === 0;

      // Only carry indent if current line has non-whitespace content
      let i = ls; let leading = '';
      if (!isBlankLine) {
        while (i < value.length && (value[i] === ' ' || value[i] === '\t')) { leading += value[i]; i++; }
      } else {
        leading = '';
      }

      const before = value.slice(0, start); const after = value.slice(end); const insert = '\n' + leading;
      input.value = before + insert + after; const newPos = before.length + insert.length; input.setSelectionRange(newPos, newPos);
      window.renderDiagramSafe && window.renderDiagramSafe();
      return;
    }
  });

  // Re-render on input and flag justTyped for the pulse
  input.addEventListener('input', () => { window.justTyped = true; window.renderDiagramSafe && window.renderDiagramSafe(); window.justTyped = false; });

  window.addEventListener('resize', init);
  window.addEventListener('load', init);
  init();
})();

(function () {
  'use strict';
  const input = document.getElementById('inputText');
  const diagramArea = document.getElementById('diagramArea');
  const rightPane = document.getElementById('rightPane');
  const btnExportSvg = document.getElementById('btnExportSvg');
  const btnExportPng = document.getElementById('btnExportPng');
  if (!diagramArea || !input) return;

  const HAS_D3_FORCE = typeof window.d3 !== 'undefined' && d3.forceSimulation;

  // ========================
  // Shared helpers (layout/color/text)
  // ========================
  const TAB_WIDTH = 4; const BASE_RADIUS = 40; const RADIUS_STEP = 8; const MIN_RADIUS = 16;
  const X_STEP = 150; const Y_STEP = 90; const LEFT_MARGIN = 60; const TOP_MARGIN = 50; const RIGHT_MARGIN = 60; const GROUP_GAP = 80;
  const FONT_SIZE = 14; const FONT_FAMILY = "'Poppins', ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial"; const FONT_WEIGHT = 600; const TEXT_PADDING = 10; const LINE_HEIGHT = Math.round(FONT_SIZE * 1.2);
  const BASE_PARENT_COLORS = ['#ef4444', '#3b82f6', '#16a34a', '#eab308', '#f97316', '#7c3aed']; const rootBaseColorMap = new Map();

  function pickRandomBaseColor() { const idx = Math.floor(Math.random() * BASE_PARENT_COLORS.length); return BASE_PARENT_COLORS[idx]; }
  function hexToRgb(hex) { const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex); if (!m) throw new Error(`Invalid color: ${hex}`); return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }; }
  function rgbToHex(r, g, b) { const h = (v) => v.toString(16).padStart(2, '0'); return `#${h(r)}${h(g)}${h(b)}`; }
  function lighten(hex, t) { const { r, g, b } = hexToRgb(hex); const nr = Math.max(0, Math.min(255, Math.round(r + (255 - r) * t))); const ng = Math.max(0, Math.min(255, Math.round(g + (255 - g) * t))); const nb = Math.max(0, Math.min(255, Math.round(b + (255 - b) * t))); return rgbToHex(nr, ng, nb); }
  function darken(hex, t) { const { r, g, b } = hexToRgb(hex); const nr = Math.max(0, Math.min(255, Math.round(r * (1 - t)))); const ng = Math.max(0, Math.min(255, Math.round(g * (1 - t)))); const nb = Math.max(0, Math.min(255, Math.round(b * (1 - t)))); return rgbToHex(nr, ng, nb); }
  const MAX_RADIUS = 100;
  let measureSvg = null; function ensureMeasureSvg() { if (measureSvg) return; measureSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); measureSvg.setAttribute('width', '1'); measureSvg.setAttribute('height', '1'); measureSvg.style.position = 'absolute'; measureSvg.style.left = '-9999px'; measureSvg.style.top = '-9999px'; document.body.appendChild(measureSvg); }
  function measureText(text) { ensureMeasureSvg(); const t = document.createElementNS('http://www.w3.org/2000/svg', 'text'); t.setAttribute('x', '0'); t.setAttribute('y', '0'); t.setAttribute('font-size', String(FONT_SIZE)); t.setAttribute('font-family', FONT_FAMILY); t.setAttribute('font-weight', String(FONT_WEIGHT)); t.setAttribute('paint-order', 'stroke'); t.setAttribute('stroke', '#000'); t.setAttribute('stroke-width', '2'); t.setAttribute('fill', '#fff'); t.textContent = text; measureSvg.appendChild(t); const bbox = t.getBBox(); measureSvg.removeChild(t); return { width: bbox.width || 0, height: bbox.height || 0 }; }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }
  function countIndentSpaces(rawLine) { let spaces = 0; for (let i = 0; i < rawLine.length; i++) { const ch = rawLine[i]; if (ch === ' ') spaces += 1; else if (ch === '\t') spaces += TAB_WIDTH; else break; } return spaces; }
  function splitIntoGroups(text) { const lines = text.split(/\r?\n/); const groups = []; let current = []; let blankRun = 0; for (const raw of lines) { const isBlank = raw.trim().length === 0; if (isBlank) { blankRun++; if (blankRun >= 2) { if (current.length > 0) groups.push(current), current = []; } } else { blankRun = 0; current.push(raw); } } if (current.length > 0) groups.push(current); return groups; }
  function parseGroup(rawLines) { const items = []; let indentStack = []; let levelStack = []; for (const raw of rawLines) { const trimmed = raw.trim(); if (!trimmed) continue; const s = countIndentSpaces(raw); if (items.length === 0) { indentStack = [s]; levelStack = [0]; items.push({ text: trimmed, level: 0 }); continue; } let topIndent = indentStack[indentStack.length - 1]; let topLevel = levelStack[levelStack.length - 1]; if (s > topIndent) { indentStack.push(s); levelStack.push(topLevel + 1); items.push({ text: trimmed, level: topLevel + 1 }); } else if (s === topIndent) { items.push({ text: trimmed, level: topLevel }); } else { while (indentStack.length > 1 && indentStack[indentStack.length - 1] > s) { indentStack.pop(); levelStack.pop(); } topIndent = indentStack[indentStack.length - 1]; topLevel = levelStack[levelStack.length - 1]; if (s > topIndent) { indentStack.push(s); levelStack.push(topLevel + 1); items.push({ text: trimmed, level: topLevel + 1 }); } else { items.push({ text: trimmed, level: topLevel }); } } } return items; }
  function measureWidth(text) { return measureText(text).width || 0; }
  function wrapTextToWidth(text, maxWidth) { const words = text.split(/\s+/).filter(w => w.length > 0); const lines = []; let current = ''; const ensureFits = (frag) => measureWidth(frag) <= maxWidth; function breakWord(word) { let chunk = ''; const pieces = []; for (let i = 0; i < word.length; i++) { const next = chunk + word[i]; if (!ensureFits(next)) { if (chunk.length > 0) pieces.push(chunk); chunk = word[i]; if (!ensureFits(chunk) && chunk.length === 1) { break; } } else { chunk = next; } } if (chunk.length > 0) pieces.push(chunk); return pieces; } for (const w of words) { if (current.length === 0) { if (ensureFits(w)) current = w; else { const parts = breakWord(w); if (parts.length === 0) continue; current = parts.shift(); for (const p of parts) { lines.push(current); current = p; } } } else { const candidate = current + ' ' + w; if (ensureFits(candidate)) current = candidate; else { lines.push(current); if (ensureFits(w)) current = w; else { const parts = breakWord(w); if (parts.length === 0) { current = ''; continue; } current = parts.shift(); for (const p of parts) { lines.push(current); current = p; } } } } } if (current.length > 0) lines.push(current); let maxW = 0; for (const ln of lines) maxW = Math.max(maxW, measureWidth(ln)); return { lines, maxW, height: Math.max(1, lines.length) * LINE_HEIGHT }; }
  function layoutForCircle(text, baseR) { let allowedW = Math.max(40, 2 * (MAX_RADIUS - TEXT_PADDING)); let wrapped = wrapTextToWidth(text, allowedW); let fitR = Math.hypot(wrapped.maxW / 2, wrapped.height / 2) + TEXT_PADDING; let attempts = 0; while (fitR > MAX_RADIUS && attempts < 8) { allowedW = Math.max(30, allowedW * 0.85); wrapped = wrapTextToWidth(text, allowedW); fitR = Math.hypot(wrapped.maxW / 2, wrapped.height / 2) + TEXT_PADDING; attempts++; } const r = Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, Math.max(baseR, fitR))); return { r, lines: wrapped.lines, maxW: wrapped.maxW, totalH: wrapped.height }; }

  // ========================
  // Drag + state
  // ========================
  const nodeOffsets = new Map(); let lastNodes = []; const childrenMap = new Map(); let prevIds = new Set();
  const scrollGuard = { allowReset: false }; const dragState = { active: false, ids: [], startX: 0, startY: 0, startOffsets: new Map() };

  function startDrag(id, evt) {
    if (!((evt.button === 0) || (evt.buttons === 1))) return;
    evt.preventDefault(); evt.stopPropagation();
    const node = lastNodes.find(n => n.id === id); if (!node) return;
    dragState.active = true; dragState.startX = evt.clientX; dragState.startY = evt.clientY;
    let ids = [id]; if (childrenMap.has(id)) { const stack = [...childrenMap.get(id)]; while (stack.length) { const cid = stack.pop(); ids.push(cid); const kids = childrenMap.get(cid); if (kids && kids.length) stack.push(...kids); } }
    dragState.ids = ids; dragState.startOffsets = new Map(ids.map(k => [k, nodeOffsets.get(k) || { dx: 0, dy: 0 }]));

    window.addEventListener('mousemove', onDragMove);
    window.addEventListener('mouseup', onDragEnd);
    window.addEventListener('blur', onDragEnd);
    window.addEventListener('mouseleave', onDragEnd);
  }
  function onDragMove(evt) { if (!dragState.active) return; if (typeof evt.buttons === 'number' && (evt.buttons & 1) === 0) { onDragEnd(); return; } evt.preventDefault(); const dx = evt.clientX - dragState.startX; const dy = evt.clientY - dragState.startY; dragState.ids.forEach(id => { const start = dragState.startOffsets.get(id) || { dx: 0, dy: 0 }; nodeOffsets.set(id, { dx: start.dx + dx, dy: start.dy + dy }); }); window.renderDiagramSafe(); }
  function onDragEnd() { if (!dragState.active) return; dragState.active = false; dragState.ids = []; dragState.startOffsets.clear(); scrollGuard.allowReset = false; window.removeEventListener('mousemove', onDragMove); window.removeEventListener('mouseup', onDragEnd); window.removeEventListener('blur', onDragEnd); window.removeEventListener('mouseleave', onDragEnd); }

  function caretAddress(text, caretIndex) { const lines = text.split(/\r?\n/); let before = text.slice(0, caretIndex); let caretLine = 0; for (let i = 0; i < before.length; i++) if (before[i] === '\n') caretLine++; let gi = 0, idx = 0, blankRun = 0; for (let i = 0; i < lines.length; i++) { const isBlank = lines[i].trim().length === 0; if (i === caretLine) return { gi, idx, isBlank }; if (isBlank) { blankRun++; if (blankRun >= 2) { gi++; idx = 0; } } else { blankRun = 0; idx++; } } return { gi: 0, idx: 0, isBlank: true }; }

  function hash32(str) { let h = 2166136261 >>> 0; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rand01FromId(id) { const h = hash32(id); return (h & 0xfffffff) / 0x10000000; }

  // Gentle repel for overlaps (global)
  function relaxAllWithForce(nodes, width, height) {
    if (!HAS_D3_FORCE) return; if (nodes.length === 0) return; if (dragState.active) return;
    const simNodes = nodes.map(n => { const off = nodeOffsets.get(n.id) || { dx: 0, dy: 0 }; const tx = n.baseX + off.dx; const ty = n.baseY + off.dy; return { id: n.id, x: n.x, y: n.y, r: n.r, tx, ty, anchor: n.parent ? 0.25 : 0.6 }; });
    const padding = 8; const collision = d3.forceCollide().radius(d => d.r + padding).iterations(2);
    const forceX = d3.forceX(d => d.tx).strength(d => d.anchor); const forceY = d3.forceY(d => d.ty).strength(d => d.anchor);
    const sim = d3.forceSimulation(simNodes).alpha(1).alphaDecay(0.25).force('x', forceX).force('y', forceY).force('collide', collision).stop();
    for (let i = 0; i < 18; i++) sim.tick();
    simNodes.forEach(d => { d.x = Math.max(d.r + 4, Math.min(width - d.r - 4, d.x)); d.y = Math.max(d.r + 4, Math.min(height - d.r - 4, d.y)); const base = nodes.find(n => n.id === d.id); const desiredDx = d.x - base.baseX; const desiredDy = d.y - base.baseY; nodeOffsets.set(d.id, { dx: desiredDx, dy: desiredDy }); });
  }

  function inlinePoppinsCss(){
    // Inline @font-face for Poppins 300/600/700 using Google Fonts css URLs
    const css = `@font-face{font-family:'Poppins';font-style:normal;font-weight:300;font-display:swap;src:url(https://fonts.gstatic.com/s/poppins/v20/pxiByp8kv8JHgFVrLDz8Z1xlEA.woff2) format('woff2')}@font-face{font-family:'Poppins';font-style:normal;font-weight:600;font-display:swap;src:url(https://fonts.gstatic.com/s/poppins/v20/pxiByp8kv8JHgFVrLEj6Z1xlEA.woff2) format('woff2')}@font-face{font-family:'Poppins';font-style:normal;font-weight:700;font-display:swap;src:url(https://fonts.gstatic.com/s/poppins/v20/pxiByp8kv8JHgFVrLEjYZ1xlEA.woff2) format('woff2')}`;
    return `<style type="text/css">${css}</style>`;
  }

  function cloneSvgWithFonts(svg){
    const serializer = new XMLSerializer();
    let src = serializer.serializeToString(svg);
    // Inject font-face at the top just after opening <svg>
    src = src.replace(/<svg[^>]*>/, (m) => `${m}${inlinePoppinsCss()}`);
    return src;
  }

  function exportSvg(svgEl) { const src = cloneSvgWithFonts(svgEl); const blob = new Blob([src], { type: 'image/svg+xml;charset=utf-8' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'diagram.svg'; a.click(); URL.revokeObjectURL(url); }

  async function exportPng(svgEl) {
    if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch {} }
    const src = cloneSvgWithFonts(svgEl);
    const svgBlob = new Blob([src], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);

    const img = new Image(); img.crossOrigin = 'anonymous';
    const w = svgEl.viewBox.baseVal && svgEl.viewBox.baseVal.width ? svgEl.viewBox.baseVal.width : svgEl.width.baseVal.value;
    const h = svgEl.viewBox.baseVal && svgEl.viewBox.baseVal.height ? svgEl.viewBox.baseVal.height : svgEl.height.baseVal.value;
    const canvas = document.createElement('canvas'); canvas.width = w * 2; canvas.height = h * 2; const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    img.onload = function () {
      ctx.setTransform(2, 0, 0, 2, 0, 0);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'diagram.png'; a.click(); URL.revokeObjectURL(url); URL.revokeObjectURL(svgUrl); }, 'image/png');
    };
    img.onerror = function (e) { console.error('PNG export failed', e); URL.revokeObjectURL(svgUrl); };
    img.src = svgUrl;
  }

  function buildAndRenderSvg(allNodes, edges, widthNeeded, heightNeeded) {
    clear(diagramArea);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', String(widthNeeded)); svg.setAttribute('height', String(heightNeeded)); svg.setAttribute('viewBox', `0 0 ${widthNeeded} ${heightNeeded}`); svg.style.display = 'block';

    // Add defs for a soft drop shadow
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    filter.setAttribute('id', 'nodeShadow');
    filter.setAttribute('x', '-50%'); filter.setAttribute('y', '-50%'); filter.setAttribute('width', '200%'); filter.setAttribute('height', '200%');
    const feDrop = document.createElementNS('http://www.w3.org/2000/svg', 'feDropShadow');
    feDrop.setAttribute('dx', '0'); feDrop.setAttribute('dy', '3'); feDrop.setAttribute('stdDeviation', '3');
    feDrop.setAttribute('flood-color', '#000000'); feDrop.setAttribute('flood-opacity', '0.25');
    filter.appendChild(feDrop); defs.appendChild(filter); svg.appendChild(defs);

    // Edges
    edges.forEach(e => { const line = document.createElementNS('http://www.w3.org/2000/svg', 'line'); line.setAttribute('x1', String(e.from.x)); line.setAttribute('y1', String(e.from.y)); line.setAttribute('x2', String(e.to.x)); line.setAttribute('y2', String(e.to.y)); line.setAttribute('stroke', '#94a3b8'); line.setAttribute('stroke-width', '2'); svg.appendChild(line); });

    // Nodes
    allNodes.forEach(n => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g'); g.id = `node-${n.id}`; g.style.cursor = 'move';
      g.addEventListener('mousedown', (ev) => startDrag(n.id, ev));

      const ig = document.createElementNS('http://www.w3.org/2000/svg', 'g'); ig.id = `nodeInner-${n.id}`; ig.style.transformBox = 'fill-box'; ig.style.transformOrigin = 'center';
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); circle.setAttribute('cx', String(n.x)); circle.setAttribute('cy', String(n.y)); circle.setAttribute('r', String(n.r)); circle.setAttribute('fill', n.fill); circle.setAttribute('stroke', n.stroke); circle.setAttribute('stroke-width', '2');
      // Apply soft shadow
      circle.setAttribute('filter', 'url(#nodeShadow)');
      ig.appendChild(circle);
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text'); label.setAttribute('text-anchor', 'middle'); label.setAttribute('dominant-baseline', 'middle'); label.setAttribute('fill', '#fff'); label.setAttribute('stroke', '#000'); label.setAttribute('stroke-width', '2'); label.setAttribute('paint-order', 'stroke'); label.setAttribute('font-size', String(FONT_SIZE)); label.setAttribute('font-family', FONT_FAMILY); label.setAttribute('font-weight', String(FONT_WEIGHT));
      const startY = n.y - ((n.lines.length - 1) * LINE_HEIGHT) / 2; n.lines.forEach((ln, i) => { const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan'); tspan.setAttribute('x', String(n.x)); tspan.setAttribute('y', String(startY + i * LINE_HEIGHT)); tspan.appendChild(document.createTextNode(ln)); label.appendChild(tspan); }); ig.appendChild(label);
      g.appendChild(ig); svg.appendChild(g);
    });

    diagramArea.appendChild(svg);

    // Wire export
    if (btnExportSvg) btnExportSvg.onclick = () => exportSvg(svg);
    if (btnExportPng) btnExportPng.onclick = () => exportPng(svg);
  }

  function relaxAllWithForceWrapper(nodes, width, height) { try { relaxAllWithForce(nodes, width, height); } catch { } }

  function renderDiagramCore() {
    const text = input.value || '';
    const groupsRaw = splitIntoGroups(text); const groups = groupsRaw.map(parseGroup).filter(g => g.length > 0);
    clear(diagramArea);
    if (groups.length === 0) { const p = document.createElement('p'); p.textContent = 'Type on the left to see bubbles here...'; p.className = 'text-muted'; diagramArea.appendChild(p); prevIds = new Set(); return; }

    let accY = 0; const allNodes = []; const edges = [];
    childrenMap.clear();

    groups.forEach((items, gi) => {
      const groupNodes = items.map((it, idx) => { const baseR = Math.max(MIN_RADIUS, BASE_RADIUS - it.level * RADIUS_STEP); const layout = layoutForCircle(it.text, baseR); const r = layout.r; const baseX = LEFT_MARGIN + it.level * X_STEP; const baseY = TOP_MARGIN + accY + idx * Y_STEP; const id = `${gi}:${idx}`; const off = nodeOffsets.get(id) || { dx: 0, dy: 0 }; const x = baseX + off.dx; const y = baseY + off.dy; return { ...it, id, gi, idx, x, y, r, lines: layout.lines, baseX, baseY };
      });
      for (let i = 0; i < groupNodes.length; i++) {
        const child = groupNodes[i];
        let parentIndex = -1; for (let j = i - 1; j >= 0; j--) { if (groupNodes[j].level < child.level) { parentIndex = j; break; } }
        if (parentIndex !== -1) {
          const parent = groupNodes[parentIndex]; edges.push({ from: parent, to: child }); if (!childrenMap.has(parent.id)) childrenMap.set(parent.id, []); childrenMap.get(parent.id).push(child.id); child.rootId = parent.rootId; child.parent = parent;
        } else {
          child.rootId = child.id; child.parent = null; if (!rootBaseColorMap.has(child.rootId)) rootBaseColorMap.set(child.rootId, pickRandomBaseColor());
        }
      }

      // Assign colors based on root color and node depth
      for (let i = 0; i < groupNodes.length; i++) { const n = groupNodes[i]; const base = rootBaseColorMap.get(n.rootId) || '#3b82f6'; const depth = n.level; const t = Math.min(0.8, depth * 0.25); n.fill = lighten(base, t); n.stroke = darken(base, 0.2); }

      allNodes.push(...groupNodes); accY += items.length * Y_STEP + GROUP_GAP;
    });

    const widthNeeded = Math.max(diagramArea.clientWidth || 600, (allNodes.reduce((m, n) => Math.max(m, n.x + n.r), 0) + RIGHT_MARGIN));
    const heightNeeded = Math.max(diagramArea.clientHeight || 400, (allNodes.reduce((m, n) => Math.max(m, n.y + n.r), 0) + TOP_MARGIN));

    relaxAllWithForceWrapper(allNodes, widthNeeded, heightNeeded);

    allNodes.forEach(n => { const off = nodeOffsets.get(n.id) || { dx: 0, dy: 0 }; n.x = n.baseX + off.dx; n.y = n.baseY + off.dy; });

    lastNodes = allNodes;

    buildAndRenderSvg(allNodes, edges, widthNeeded, heightNeeded);

    prevIds = new Set(allNodes.map(n => n.id));
  }

  window.renderDiagramSafe = function () { const scrollEl = rightPane || diagramArea || document.scrollingElement || document.documentElement; const prevTop = scrollEl ? scrollEl.scrollTop : 0; try { renderDiagramCore(); } catch (err) { console.error('Diagram render failed:', err); clear(diagramArea); const pre = document.createElement('pre'); pre.className = 'text-danger'; pre.textContent = String(err); diagramArea.appendChild(pre); } finally { if (scrollEl && !(dragState.active && scrollGuard.allowReset)) { scrollEl.scrollTop = prevTop; } } };

  window.addEventListener('resize', window.renderDiagramSafe);
  if (document.fonts && document.fonts.ready) { document.fonts.ready.then(window.renderDiagramSafe).catch(() => { }); }
  window.renderDiagramSafe();
})();

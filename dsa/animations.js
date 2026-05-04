/* ─── Drawing Utilities ─────────────────────────────────────────────────────── */
const C = {
  BG:      '#0b0f1a',
  SURFACE: '#111827',
  CELL:    '#1a2235',
  BORDER:  '#2a3f5f',
  TEXT:    '#e2e8f0',
  TEXT2:   '#94a3b8',
  TEXT3:   '#64748b',
  INDIGO:  '#6366f1',
  CYAN:    '#06b6d4',
  GREEN:   '#22c55e',
  AMBER:   '#f59e0b',
  RED:     '#ef4444',
  VIOLET:  '#8b5cf6',
  ORANGE:  '#f97316',
};

function roundRect(ctx, x, y, w, h, r = 8) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawCell(ctx, x, y, w, h, text, { bg = C.CELL, border = C.BORDER, color = C.TEXT, fontSize = 18, r = 8 } = {}) {
  ctx.fillStyle = bg;
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.strokeStyle = border;
  ctx.lineWidth = 1.5;
  roundRect(ctx, x, y, w, h, r);
  ctx.stroke();
  if (text !== null && text !== undefined) {
    ctx.fillStyle = color;
    ctx.font = `bold ${fontSize}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(text), x + w / 2, y + h / 2);
  }
}

function drawLabel(ctx, text, x, y, { color = C.TEXT3, fontSize = 12, align = 'center' } = {}) {
  ctx.fillStyle = color;
  ctx.font = `${fontSize}px monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

function drawPointerArrow(ctx, cx, tipY, label, color, pointUp = true) {
  const arrowLen = 10;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (pointUp) {
    ctx.moveTo(cx, tipY);
    ctx.lineTo(cx, tipY + arrowLen + 4);
  } else {
    ctx.moveTo(cx, tipY);
    ctx.lineTo(cx, tipY - arrowLen - 4);
  }
  ctx.stroke();
  ctx.beginPath();
  if (pointUp) {
    ctx.moveTo(cx, tipY);
    ctx.lineTo(cx - 5, tipY + arrowLen);
    ctx.lineTo(cx + 5, tipY + arrowLen);
  } else {
    ctx.moveTo(cx, tipY);
    ctx.lineTo(cx - 5, tipY - arrowLen);
    ctx.lineTo(cx + 5, tipY - arrowLen);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = color;
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = pointUp ? 'bottom' : 'top';
  ctx.fillText(label, cx, pointUp ? tipY + arrowLen + 18 : tipY - arrowLen - 18);
}

function infoBox(ctx, x, y, label, value, { labelColor = C.TEXT3, valueColor = C.AMBER } = {}) {
  ctx.font = '12px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = labelColor;
  ctx.fillText(label, x, y);
  ctx.fillStyle = valueColor;
  ctx.font = 'bold 12px monospace';
  ctx.fillText(value, x + ctx.measureText(label).width + 4, y);
}

function clearCanvas(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = C.BG;
  ctx.fillRect(0, 0, w, h);
}

/* ─── Array drawing helper ──────────────────────────────────────────────────── */
function drawArray(ctx, arr, cx, cy, cellW, cellH, highlights = {}) {
  const gap = 4;
  const total = arr.length * cellW + (arr.length - 1) * gap;
  const startX = cx - total / 2;

  arr.forEach((val, i) => {
    const x = startX + i * (cellW + gap);
    const h = highlights[i] || {};
    drawCell(ctx, x, cy, cellW, cellH, val, {
      bg: h.bg || C.CELL,
      border: h.border || C.BORDER,
      color: h.color || C.TEXT,
      fontSize: 16,
    });
    drawLabel(ctx, i, x + cellW / 2, cy + cellH + 14, { fontSize: 11 });
  });

  return { startX, gap, cellW, cellH, cy };
}

function cellCenterX(layout, i) {
  return layout.startX + i * (layout.cellW + layout.gap) + layout.cellW / 2;
}

/* ─── Step generator helpers ────────────────────────────────────────────────── */
function makeStep(drawFn, desc) {
  return { draw: drawFn, desc };
}

/* ════════════════════════════════════════════════════════════════════════════
   1.  Sliding Window — Max Sum Subarray of Size K
   ════════════════════════════════════════════════════════════════════════════ */
function genSWMaxSum() {
  const arr = [2, 1, 5, 1, 3, 2];
  const k = 3;
  const steps = [];

  function draw(state) {
    return (ctx, W, H) => {
      clearCanvas(ctx, W, H);
      const layout = drawArray(ctx, arr, W / 2, H / 2 - 30, 52, 44, state.hl);

      // window bracket
      if (state.ws !== null) {
        const x1 = cellCenterX(layout, state.ws) - 26;
        const x2 = cellCenterX(layout, state.we) + 26;
        const by = H / 2 - 30 - 8, bh = 60;
        ctx.strokeStyle = C.AMBER;
        ctx.lineWidth = 2;
        ctx.strokeRect(x1, by, x2 - x1, bh);
      }

      // pointers
      if (state.ws !== null) {
        drawPointerArrow(ctx, cellCenterX(layout, state.ws), H / 2 + 22, 'start', C.GREEN, false);
        drawPointerArrow(ctx, cellCenterX(layout, state.we), H / 2 + 22, 'end', C.CYAN, false);
      }

      infoBox(ctx, 16, 22, 'windowSum: ', state.sum, { valueColor: C.CYAN });
      infoBox(ctx, 16, 42, 'maxSum:    ', state.max, { valueColor: C.GREEN });
    };
  }

  steps.push(makeStep(draw({ hl: {}, ws: null, we: null, sum: 0, max: 0 }),
    `Array = [${arr}], k = ${k}. We'll slide a window of size ${k} to find the maximum sum.`));

  // build initial window
  let sum = 0;
  for (let i = 0; i < k; i++) {
    sum += arr[i];
    const hl = {};
    for (let j = 0; j <= i; j++) hl[j] = { bg: '#1e3a5f', border: C.INDIGO, color: C.TEXT };
    steps.push(makeStep(draw({ hl, ws: 0, we: i, sum, max: 0 }),
      `Build initial window: adding arr[${i}] = ${arr[i]}. Window sum = ${sum}.`));
  }

  let maxSum = sum;
  steps.push(makeStep(draw({
    hl: { 0: { bg: '#1e3a5f', border: C.INDIGO }, 1: { bg: '#1e3a5f', border: C.INDIGO }, 2: { bg: '#1e3a5f', border: C.INDIGO } },
    ws: 0, we: k - 1, sum, max: maxSum
  }), `First window [${arr.slice(0, k)}] = ${sum}. This is our initial maxSum.`));

  // slide
  for (let end = k; end < arr.length; end++) {
    const start = end - k + 1;
    sum += arr[end];
    const hlAdd = {};
    for (let j = start - 1; j <= end; j++) hlAdd[j] = { bg: '#1e3a5f', border: C.INDIGO };
    hlAdd[end] = { bg: '#14532d', border: C.GREEN, color: C.GREEN };
    hlAdd[start - 1] = { bg: '#450a0a', border: C.RED, color: C.RED };
    steps.push(makeStep(draw({ hl: hlAdd, ws: start - 1, we: end, sum, max: maxSum }),
      `Slide: + arr[${end}] = ${arr[end]}, – arr[${start - 1}] = ${arr[start - 1]}.`));

    sum -= arr[start - 1];
    maxSum = Math.max(maxSum, sum);
    const hlSlid = {};
    for (let j = start; j <= end; j++) hlSlid[j] = { bg: '#1e3a5f', border: C.INDIGO };
    steps.push(makeStep(draw({ hl: hlSlid, ws: start, we: end, sum, max: maxSum }),
      `Window [${arr.slice(start, end + 1)}] sum = ${sum}. maxSum = ${maxSum}.`));
  }

  steps.push(makeStep(draw({ hl: {}, ws: null, we: null, sum, max: maxSum }),
    `✓ Done! Maximum sum subarray of size ${k} = ${maxSum}.`));

  return steps;
}

/* ════════════════════════════════════════════════════════════════════════════
   1b. Sliding Window — Longest No Repeat
   ════════════════════════════════════════════════════════════════════════════ */
function genSWNoRepeat() {
  const s = 'abcabcbb'.split('');
  const steps = [];

  function draw(state) {
    return (ctx, W, H) => {
      clearCanvas(ctx, W, H);
      const cellW = 46, cellH = 44;
      const layout = drawArray(ctx, s, W / 2, H / 2 - 30, cellW, cellH, state.hl);

      if (state.ws !== null && state.we !== null && state.ws <= state.we) {
        const x1 = cellCenterX(layout, state.ws) - cellW / 2 - 3;
        const x2 = cellCenterX(layout, state.we) + cellW / 2 + 3;
        const by = H / 2 - 30 - 7;
        ctx.strokeStyle = C.INDIGO;
        ctx.lineWidth = 2;
        ctx.strokeRect(x1, by, x2 - x1, cellH + 14);
      }

      infoBox(ctx, 16, 22, 'window: ', state.we !== null ? `"${s.slice(state.ws, state.we + 1).join('')}"` : '""', { valueColor: C.CYAN });
      infoBox(ctx, 16, 42, 'maxLen: ', state.max, { valueColor: C.GREEN });
    };
  }

  steps.push(makeStep(draw({ hl: {}, ws: 0, we: null, max: 0 }),
    `String: "${s.join('')}". We'll grow a window until we see a duplicate, then shrink from the left.`));

  const freq = {};
  let ws = 0, maxLen = 0;
  for (let we = 0; we < s.length; we++) {
    const ch = s[we];
    freq[ch] = (freq[ch] || 0) + 1;
    const hl = {};
    for (let j = ws; j <= we; j++) hl[j] = { bg: '#1e3a5f', border: C.INDIGO };
    hl[we] = { bg: freq[ch] > 1 ? '#450a0a' : '#14532d', border: freq[ch] > 1 ? C.RED : C.GREEN };
    steps.push(makeStep(draw({ hl, ws, we, max: maxLen }),
      `Add '${ch}'. Freq['${ch}'] = ${freq[ch]}${freq[ch] > 1 ? ' → duplicate! Shrink left.' : '.'}`));

    while (freq[ch] > 1) {
      freq[s[ws]]--;
      ws++;
      const hl2 = {};
      for (let j = ws; j <= we; j++) hl2[j] = { bg: '#1e3a5f', border: C.INDIGO };
      steps.push(makeStep(draw({ hl: hl2, ws, we, max: maxLen }),
        `Shrink: remove '${s[ws - 1]}'. Window = "${s.slice(ws, we + 1).join('')}".`));
    }

    maxLen = Math.max(maxLen, we - ws + 1);
    steps.push(makeStep(draw({
      hl: Object.fromEntries(Array.from({ length: we - ws + 1 }, (_, i) => [ws + i, { bg: '#1e3a5f', border: C.INDIGO }])),
      ws, we, max: maxLen
    }), `No duplicate. Window length = ${we - ws + 1}. maxLen = ${maxLen}.`));
  }

  steps.push(makeStep(draw({ hl: {}, ws: null, we: null, max: maxLen }),
    `✓ Done! Longest substring without repeating characters = ${maxLen}.`));

  return steps;
}

/* ════════════════════════════════════════════════════════════════════════════
   2.  Two Pointers — Two Sum Sorted
   ════════════════════════════════════════════════════════════════════════════ */
function genTPTwoSum() {
  const arr = [2, 7, 11, 15];
  const target = 9;
  const steps = [];

  function draw(state) {
    return (ctx, W, H) => {
      clearCanvas(ctx, W, H);
      const hl = {};
      if (state.l !== null) hl[state.l] = { bg: '#14532d', border: C.GREEN };
      if (state.r !== null) hl[state.r] = { bg: '#1e3a5f', border: C.CYAN };
      if (state.found) {
        hl[state.l] = { bg: '#14532d', border: C.GREEN };
        hl[state.r] = { bg: '#14532d', border: C.GREEN };
      }
      const layout = drawArray(ctx, arr, W / 2, H / 2 - 26, 54, 44, hl);

      if (state.l !== null) drawPointerArrow(ctx, cellCenterX(layout, state.l), H / 2 + 26, 'L', C.GREEN, false);
      if (state.r !== null) drawPointerArrow(ctx, cellCenterX(layout, state.r), H / 2 + 26, 'R', C.CYAN, false);

      infoBox(ctx, 16, 22, 'target: ', target, { valueColor: C.AMBER });
      if (state.sum !== null) infoBox(ctx, 16, 42, 'L + R = ', state.sum, { valueColor: state.found ? C.GREEN : (state.sum < target ? C.RED : C.AMBER) });
    };
  }

  steps.push(makeStep(draw({ l: 0, r: arr.length - 1, sum: null, found: false }),
    `Sorted array: [${arr}], target = ${target}. Place left pointer at start, right at end.`));

  let l = 0, r = arr.length - 1;
  while (l < r) {
    const sum = arr[l] + arr[r];
    steps.push(makeStep(draw({ l, r, sum, found: sum === target }),
      `arr[${l}] + arr[${r}] = ${arr[l]} + ${arr[r]} = ${sum}. ${sum === target ? `✓ Found! Return [${l + 1}, ${r + 1}].` : sum < target ? `Sum < target (${target}) → move left right.` : `Sum > target (${target}) → move right left.`}`));
    if (sum === target) break;
    if (sum < target) l++;
    else r--;
  }

  return steps;
}

/* ════════════════════════════════════════════════════════════════════════════
   2b. Two Pointers — Container with Most Water
   ════════════════════════════════════════════════════════════════════════════ */
function genTPContainer() {
  const height = [1, 8, 6, 2, 5, 4, 8, 3, 7];
  const steps = [];

  function draw(state) {
    return (ctx, W, H) => {
      clearCanvas(ctx, W, H);
      const n = height.length;
      const barW = Math.floor((W - 40) / n) - 4;
      const maxH = Math.max(...height);
      const scaleY = (H - 100) / maxH;
      const startX = 20;

      height.forEach((h, i) => {
        const bh = h * scaleY;
        const x = startX + i * (barW + 4);
        const y = H - 50 - bh;
        let bg = '#1a2235', border = '#2a3f5f';
        if (i === state.l) { bg = '#14532d'; border = C.GREEN; }
        if (i === state.r) { bg = '#1e3a5f'; border = C.CYAN; }
        ctx.fillStyle = bg;
        ctx.fillRect(x, y, barW, bh);
        ctx.strokeStyle = border;
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, barW, bh);
        drawLabel(ctx, h, x + barW / 2, y - 10, { fontSize: 11 });
        drawLabel(ctx, i, x + barW / 2, H - 35, { fontSize: 10 });
      });

      // water fill between l and r
      if (state.l !== null && state.r !== null) {
        const lx = startX + state.l * (barW + 4);
        const rx = startX + state.r * (barW + 4) + barW;
        const waterH = Math.min(height[state.l], height[state.r]) * scaleY;
        ctx.fillStyle = 'rgba(6,182,212,0.18)';
        ctx.fillRect(lx, H - 50 - waterH, rx - lx, waterH);
        ctx.strokeStyle = 'rgba(6,182,212,0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(lx, H - 50 - waterH, rx - lx, waterH);
      }

      infoBox(ctx, 16, 20, 'area: ', state.area, { valueColor: C.CYAN });
      infoBox(ctx, 16, 38, 'max:  ', state.max, { valueColor: C.GREEN });
    };
  }

  steps.push(makeStep(draw({ l: 0, r: height.length - 1, area: 0, max: 0 }),
    `Heights: [${height}]. Start with widest container: L=0, R=${height.length - 1}.`));

  let l = 0, r = height.length - 1, maxW = 0;
  while (l < r) {
    const area = Math.min(height[l], height[r]) * (r - l);
    maxW = Math.max(maxW, area);
    const shorter = height[l] < height[r] ? 'left' : 'right';
    steps.push(makeStep(draw({ l, r, area, max: maxW }),
      `Area = min(${height[l]},${height[r]}) × ${r - l} = ${area}. maxArea = ${maxW}. Move ${shorter} pointer inward.`));
    if (height[l] < height[r]) l++;
    else r--;
  }

  steps.push(makeStep(draw({ l, r, area: 0, max: maxW }),
    `✓ Done! Maximum water = ${maxW}.`));

  return steps;
}

/* ════════════════════════════════════════════════════════════════════════════
   3.  Fast & Slow — Cycle Detection
   ════════════════════════════════════════════════════════════════════════════ */
function genFSCycle() {
  const nodes = [3, 2, 0, -4, 9, 7];
  const next  = [1, 2, 3,  4, 5, 1]; // 7 → back to node at index 1 (cycle)
  const steps = [];
  const N = nodes.length;

  function draw(state) {
    return (ctx, W, H) => {
      clearCanvas(ctx, W, H);
      const cx = W / 2, cy = H / 2 - 10;
      const R = Math.min(W, H) * 0.32;
      const r = 22;

      const positions = nodes.map((_, i) => ({
        x: cx + R * Math.cos((2 * Math.PI * i) / N - Math.PI / 2),
        y: cy + R * Math.sin((2 * Math.PI * i) / N - Math.PI / 2),
      }));

      // draw edges
      nodes.forEach((_, i) => {
        const nx = next[i];
        const from = positions[i];
        const to   = positions[nx];
        ctx.strokeStyle = '#2a3f5f';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
        // arrowhead
        const angle = Math.atan2(to.y - from.y, to.x - from.x);
        const ax = to.x - r * Math.cos(angle), ay = to.y - r * Math.sin(angle);
        ctx.fillStyle = '#2a3f5f';
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax - 8 * Math.cos(angle - .4), ay - 8 * Math.sin(angle - .4));
        ctx.lineTo(ax - 8 * Math.cos(angle + .4), ay - 8 * Math.sin(angle + .4));
        ctx.closePath();
        ctx.fill();
      });

      // draw nodes
      positions.forEach((p, i) => {
        let bg = C.CELL, border = C.BORDER;
        if (state.slow === i && state.fast === i && state.slow !== null) { bg = '#7c3aed'; border = C.VIOLET; }
        else if (state.slow === i) { bg = '#14532d'; border = C.GREEN; }
        else if (state.fast === i) { bg = '#1e3a5f'; border = C.CYAN; }
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = border;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = C.TEXT;
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(nodes[i], p.x, p.y);
      });

      // legend
      infoBox(ctx, 16, H - 50, '🟢 slow = node ', state.slow !== null ? nodes[state.slow] : '-', { valueColor: C.GREEN });
      infoBox(ctx, 16, H - 32, '🔵 fast = node ', state.fast !== null ? nodes[state.fast] : '-', { valueColor: C.CYAN });
    };
  }

  steps.push(makeStep(draw({ slow: null, fast: null }),
    `Linked list with a cycle (node 7 points back to node 2). Floyd's tortoise and hare.`));
  steps.push(makeStep(draw({ slow: 0, fast: 0 }),
    `Initialize: slow = fast = head (node ${nodes[0]}).`));

  let slow = 0, fast = 0;
  for (let iter = 0; iter < 12; iter++) {
    slow = next[slow];
    fast = next[next[fast]];
    if (slow === fast) {
      steps.push(makeStep(draw({ slow, fast }),
        `🎯 Cycle detected! slow and fast both at node ${nodes[slow]}. A cycle exists.`));
      break;
    }
    steps.push(makeStep(draw({ slow, fast }),
      `Step ${iter + 1}: slow → ${nodes[slow]},  fast → ${nodes[fast]}. Not yet equal.`));
  }

  return steps;
}

/* ════════════════════════════════════════════════════════════════════════════
   3b. Fast & Slow — Middle of Linked List
   ════════════════════════════════════════════════════════════════════════════ */
function genFSMiddle() {
  const vals = [1, 2, 3, 4, 5];
  const steps = [];
  const n = vals.length;

  function draw(state) {
    return (ctx, W, H) => {
      clearCanvas(ctx, W, H);
      const cellW = 50, cellH = 44, gap = 30;
      const total = n * cellW + (n - 1) * gap;
      const startX = (W - total) / 2;
      const cy = H / 2 - 20;

      // draw arrows between cells
      for (let i = 0; i < n - 1; i++) {
        const x1 = startX + i * (cellW + gap) + cellW;
        const x2 = startX + (i + 1) * (cellW + gap);
        ctx.strokeStyle = C.BORDER;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x1 + 4, cy + cellH / 2);
        ctx.lineTo(x2 - 4, cy + cellH / 2);
        ctx.stroke();
        // arrowhead
        ctx.fillStyle = C.BORDER;
        ctx.beginPath();
        ctx.moveTo(x2 - 4, cy + cellH / 2);
        ctx.lineTo(x2 - 11, cy + cellH / 2 - 5);
        ctx.lineTo(x2 - 11, cy + cellH / 2 + 5);
        ctx.closePath();
        ctx.fill();
      }

      // draw cells
      vals.forEach((v, i) => {
        const x = startX + i * (cellW + gap);
        let bg = C.CELL, border = C.BORDER;
        if (state.slow === i && state.fast === i) { bg = '#7c3aed'; border = C.VIOLET; }
        else if (state.slow === i) { bg = '#14532d'; border = C.GREEN; }
        else if (state.fast === i) { bg = '#1e3a5f'; border = C.CYAN; }
        if (state.done && state.slow === i) { bg = '#b45309'; border = C.AMBER; }
        drawCell(ctx, x, cy, cellW, cellH, v, { bg, border, fontSize: 18 });
      });

      // pointer labels below
      vals.forEach((_, i) => {
        const x = startX + i * (cellW + gap) + cellW / 2;
        if (state.slow === i && state.fast === i && !state.done) drawLabel(ctx, 'S/F', x, cy + cellH + 18, { color: C.VIOLET, fontSize: 11 });
        else if (state.slow === i && !state.done) drawLabel(ctx, 'slow', x, cy + cellH + 18, { color: C.GREEN, fontSize: 11 });
        else if (state.fast === i && !state.done) drawLabel(ctx, 'fast', x, cy + cellH + 18, { color: C.CYAN, fontSize: 11 });
        if (state.done && state.slow === i) drawLabel(ctx, 'middle', x, cy + cellH + 18, { color: C.AMBER, fontSize: 11 });
      });
    };
  }

  steps.push(makeStep(draw({ slow: 0, fast: 0, done: false }),
    `Linked list: [${vals.join(' → ')}]. Both pointers start at head.`));

  let slow = 0, fast = 0;
  while (fast < n - 1 && fast + 1 < n - 1) {
    slow++;
    fast = Math.min(fast + 2, n - 1);
    steps.push(makeStep(draw({ slow, fast, done: false }),
      `slow → ${vals[slow]},  fast → ${vals[fast]}. fast still has room to move.`));
  }

  // last step: fast reached end
  if (fast < n - 1) {
    fast++;
    steps.push(makeStep(draw({ slow, fast, done: false }),
      `fast reaches end. slow is at ${vals[slow]}.`));
  }

  steps.push(makeStep(draw({ slow, fast, done: true }),
    `✓ fast = null (or last). slow = ${vals[slow]} is the middle node.`));

  return steps;
}

/* ════════════════════════════════════════════════════════════════════════════
   4.  Binary Search
   ════════════════════════════════════════════════════════════════════════════ */
function genBSClassic() {
  const arr = [-1, 0, 3, 5, 9, 12];
  const target = 9;
  const steps = [];

  function draw(state) {
    return (ctx, W, H) => {
      clearCanvas(ctx, W, H);
      const hl = {};
      arr.forEach((_, i) => {
        if (i < state.l || i > state.r) hl[i] = { bg: '#0f172a', border: '#1e2d45', color: C.TEXT3 };
      });
      if (state.mid !== null) hl[state.mid] = { bg: '#1e3a5f', border: C.INDIGO };
      if (state.found !== null) hl[state.found] = { bg: '#14532d', border: C.GREEN };

      const layout = drawArray(ctx, arr, W / 2, H / 2 - 30, 56, 44, hl);

      if (state.l !== null && state.l <= state.r) drawPointerArrow(ctx, cellCenterX(layout, state.l), H / 2 + 22, 'L', C.GREEN, false);
      if (state.r !== null && state.l <= state.r) drawPointerArrow(ctx, cellCenterX(layout, state.r), H / 2 + 22, 'R', C.RED, false);
      if (state.mid !== null) drawPointerArrow(ctx, cellCenterX(layout, state.mid), H / 2 - 30 - 20, 'mid', C.INDIGO, true);

      infoBox(ctx, 16, 22, 'target: ', target, { valueColor: C.AMBER });
    };
  }

  steps.push(makeStep(draw({ l: 0, r: arr.length - 1, mid: null, found: null }),
    `Sorted array: [${arr}]. Find target = ${target}. Set L=0, R=${arr.length - 1}.`));

  let l = 0, r = arr.length - 1;
  while (l <= r) {
    const mid = l + Math.floor((r - l) / 2);
    steps.push(makeStep(draw({ l, r, mid, found: null }),
      `mid = ${mid}. arr[${mid}] = ${arr[mid]}. ${arr[mid] === target ? 'Found!' : arr[mid] < target ? `${arr[mid]} < ${target} → search right half.` : `${arr[mid]} > ${target} → search left half.`}`));
    if (arr[mid] === target) {
      steps.push(makeStep(draw({ l: mid, r: mid, mid, found: mid }),
        `✓ Found! arr[${mid}] = ${target}. Return index ${mid}.`));
      break;
    }
    if (arr[mid] < target) l = mid + 1;
    else r = mid - 1;
    if (l > r) {
      steps.push(makeStep(draw({ l, r, mid: null, found: null }),
        `L > R. Target not found. Return -1.`));
    }
  }

  return steps;
}

/* ════════════════════════════════════════════════════════════════════════════
   5.  Merge Intervals
   ════════════════════════════════════════════════════════════════════════════ */
function genMIMerge() {
  const intervals = [[1, 3], [2, 6], [8, 10], [15, 18]];
  const steps = [];
  const scale = 20, offsetX = 40, barH = 28, gap = 36;

  function draw(state) {
    return (ctx, W, H) => {
      clearCanvas(ctx, W, H);
      const baseY = H - 120;

      // title
      drawLabel(ctx, 'Input intervals', W / 2, 22, { color: C.TEXT2, fontSize: 13, align: 'center' });

      intervals.forEach(([s, e], i) => {
        const x1 = offsetX + s * scale, x2 = offsetX + e * scale;
        const y = baseY - i * (barH + gap / 2) - barH;
        const active = state.cur !== null && i === state.cur;
        const done   = state.done && i === 0;
        ctx.fillStyle = active ? 'rgba(99,102,241,.35)' : 'rgba(30,58,95,.5)';
        ctx.fillRect(x1, y, x2 - x1, barH);
        ctx.strokeStyle = active ? C.INDIGO : C.BORDER;
        ctx.lineWidth = 2;
        ctx.strokeRect(x1, y, x2 - x1, barH);
        drawLabel(ctx, `[${s},${e}]`, x1 + (x2 - x1) / 2, y + barH / 2, { fontSize: 12 });
      });

      // merged output
      if (state.merged.length) {
        drawLabel(ctx, 'Merged so far', W / 2, baseY + 30, { color: C.GREEN, fontSize: 12, align: 'center' });
        state.merged.forEach(([s, e], i) => {
          const x1 = offsetX + s * scale, x2 = offsetX + e * scale;
          const y = baseY + 50 + i * (barH + 6);
          ctx.fillStyle = 'rgba(34,197,94,.2)';
          ctx.fillRect(x1, y, x2 - x1, barH);
          ctx.strokeStyle = C.GREEN;
          ctx.lineWidth = 2;
          ctx.strokeRect(x1, y, x2 - x1, barH);
          drawLabel(ctx, `[${s},${e}]`, x1 + (x2 - x1) / 2, y + barH / 2, { fontSize: 12 });
        });
      }
    };
  }

  steps.push(makeStep(draw({ cur: null, merged: [] }),
    `Input: ${JSON.stringify(intervals)}. First, sort by start time.`));
  steps.push(makeStep(draw({ cur: 0, merged: [[1, 3]] }),
    `Start with first interval [1,3]. Add to merged.`));

  const merged = [[1, 3]];
  for (let i = 1; i < intervals.length; i++) {
    const [s, e] = intervals[i];
    const last = merged[merged.length - 1];
    steps.push(makeStep(draw({ cur: i, merged: merged.map(m => [...m]) }),
      `Next interval [${s},${e}]. Current last merged = [${last}]. Does ${s} ≤ ${last[1]}?`));
    if (s <= last[1]) {
      last[1] = Math.max(last[1], e);
      steps.push(makeStep(draw({ cur: i, merged: merged.map(m => [...m]) }),
        `Yes! Overlap. Extend last merged to [${last}].`));
    } else {
      merged.push([s, e]);
      steps.push(makeStep(draw({ cur: i, merged: merged.map(m => [...m]) }),
        `No overlap. Add [${s},${e}] as new interval.`));
    }
  }

  steps.push(makeStep(draw({ cur: null, merged: merged.map(m => [...m]), done: true }),
    `✓ Done! Merged intervals: ${JSON.stringify(merged)}.`));

  return steps;
}

/* ════════════════════════════════════════════════════════════════════════════
   6.  Tree BFS — Level Order
   ════════════════════════════════════════════════════════════════════════════ */
function genBFSLevel() {
  // Tree: [3,9,20,null,null,15,7]
  const tree = {
    val: 3, id: 0,
    left: { val: 9, id: 1, left: null, right: null },
    right: {
      val: 20, id: 2,
      left: { val: 15, id: 3, left: null, right: null },
      right: { val: 7, id: 4, left: null, right: null }
    }
  };
  const steps = [];
  const nodePos = {};

  function calcPositions(node, x, y, spread) {
    if (!node) return;
    nodePos[node.id] = { x, y };
    calcPositions(node.left,  x - spread, y + 70, spread / 2);
    calcPositions(node.right, x + spread, y + 70, spread / 2);
  }

  function draw(state) {
    return (ctx, W, H) => {
      clearCanvas(ctx, W, H);
      calcPositions(tree, W / 2, 50, 100);

      function drawEdges(node) {
        if (!node) return;
        if (node.left) {
          const p = nodePos[node.id], c = nodePos[node.left.id];
          ctx.strokeStyle = C.BORDER; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(p.x, p.y + 22); ctx.lineTo(c.x, c.y - 22); ctx.stroke();
          drawEdges(node.left);
        }
        if (node.right) {
          const p = nodePos[node.id], c = nodePos[node.right.id];
          ctx.strokeStyle = C.BORDER; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(p.x, p.y + 22); ctx.lineTo(c.x, c.y - 22); ctx.stroke();
          drawEdges(node.right);
        }
      }

      function drawNodes(node) {
        if (!node) return;
        const p = nodePos[node.id];
        let bg = C.CELL, border = C.BORDER;
        if (state.visited.has(node.id)) { bg = '#14532d'; border = C.GREEN; }
        if (state.current === node.id) { bg = '#1e3a5f'; border = C.INDIGO; }
        if (state.inQueue.has(node.id) && !state.visited.has(node.id) && state.current !== node.id) { bg = '#1e3a5f'; border = C.AMBER; }
        ctx.fillStyle = bg;
        ctx.beginPath(); ctx.arc(p.x, p.y, 22, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = border; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.x, p.y, 22, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = C.TEXT;
        ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(node.val, p.x, p.y);
        drawNodes(node.left); drawNodes(node.right);
      }

      drawEdges(tree); drawNodes(tree);

      // queue display
      const queueY = H - 55;
      drawLabel(ctx, 'Queue:', 16, queueY, { align: 'left', fontSize: 12, color: C.TEXT2 });
      state.queue.forEach((v, i) => {
        drawCell(ctx, 80 + i * 42, queueY - 16, 38, 30, v, { fontSize: 14, bg: '#1e2d45' });
      });

      // levels
      drawLabel(ctx, `Result: ${JSON.stringify(state.levels)}`, W / 2, H - 20, { fontSize: 12, color: C.GREEN, align: 'center' });
    };
  }

  const empty = { visited: new Set(), inQueue: new Set([tree.id]), current: null, queue: [3], levels: [] };
  steps.push(makeStep(draw(empty), `BFS level-order traversal. Start: queue = [${tree.val}].`));

  const visited = new Set();
  const inQueue = new Set([tree.id]);
  const queue = [tree];
  const levels = [];

  while (queue.length) {
    const levelSize = queue.length;
    const level = [];
    for (let i = 0; i < levelSize; i++) {
      const node = queue.shift();
      visited.add(node.id);
      inQueue.delete(node.id);
      level.push(node.val);
      steps.push(makeStep(draw({
        visited: new Set(visited), inQueue: new Set(inQueue), current: node.id,
        queue: queue.map(n => n.val), levels: [...levels]
      }), `Process node ${node.val}. Add children to queue.`));

      if (node.left)  { queue.push(node.left);  inQueue.add(node.left.id); }
      if (node.right) { queue.push(node.right); inQueue.add(node.right.id); }
    }
    levels.push(level);
    steps.push(makeStep(draw({
      visited: new Set(visited), inQueue: new Set(inQueue), current: null,
      queue: queue.map(n => n.val), levels: [...levels]
    }), `Level done → [${level}]. Result so far: ${JSON.stringify(levels)}.`));
  }

  steps.push(makeStep(draw({ visited, inQueue: new Set(), current: null, queue: [], levels }),
    `✓ Done! Level-order: ${JSON.stringify(levels)}.`));

  return steps;
}

/* ════════════════════════════════════════════════════════════════════════════
   7.  Tree DFS — Max Depth
   ════════════════════════════════════════════════════════════════════════════ */
function genDFSDepth() {
  const tree = {
    val: 3, id: 0,
    left: { val: 9, id: 1, left: null, right: null },
    right: {
      val: 20, id: 2,
      left: { val: 15, id: 3, left: null, right: null },
      right: { val: 7, id: 4, left: null, right: null }
    }
  };
  const steps = [];
  const pos = {};
  function cp(node, x, y, s) {
    if (!node) return;
    pos[node.id] = { x, y };
    cp(node.left, x - s, y + 70, s / 2);
    cp(node.right, x + s, y + 70, s / 2);
  }

  function draw(state) {
    return (ctx, W, H) => {
      clearCanvas(ctx, W, H);
      cp(tree, W / 2, 50, 100);
      function de(n) {
        if (!n) return;
        [n.left, n.right].filter(Boolean).forEach(c => {
          const p = pos[n.id], q = pos[c.id];
          ctx.strokeStyle = state.path.has(n.id) && state.path.has(c.id) ? C.INDIGO : C.BORDER;
          ctx.lineWidth = state.path.has(n.id) && state.path.has(c.id) ? 2.5 : 1.5;
          ctx.beginPath(); ctx.moveTo(p.x, p.y + 22); ctx.lineTo(q.x, q.y - 22); ctx.stroke();
          de(c);
        });
      }
      function dn(n) {
        if (!n) return;
        const p = pos[n.id];
        let bg = C.CELL, border = C.BORDER;
        if (n.id === state.current) { bg = '#1e3a5f'; border = C.INDIGO; }
        else if (state.done.has(n.id)) { bg = '#0f2b4a'; border = C.TEXT3; }
        ctx.fillStyle = bg;
        ctx.beginPath(); ctx.arc(p.x, p.y, 22, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = border; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.x, p.y, 22, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = C.TEXT; ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(n.val, p.x, p.y);
        if (state.returns[n.id] !== undefined) {
          ctx.fillStyle = C.AMBER; ctx.font = '11px monospace';
          ctx.fillText('→' + state.returns[n.id], p.x, p.y + 33);
        }
        dn(n.left); dn(n.right);
      }
      de(tree); dn(tree);
      infoBox(ctx, 16, H - 28, 'maxDepth: ', state.result, { valueColor: C.GREEN });
    };
  }

  const returns = {};
  steps.push(makeStep(draw({ current: null, done: new Set(), path: new Set(), returns: {}, result: '?' }),
    `DFS to find max depth. depth(node) = 1 + max(depth(left), depth(right)).`));

  function dfs(node, path, steps2) {
    if (!node) return 0;
    path.add(node.id);
    steps2.push(makeStep(draw({ current: node.id, done: new Set(), path: new Set(path), returns: { ...returns }, result: '?' }),
      `Visit node ${node.val}. Recurse into left child.`));

    const l = dfs(node.left, path, steps2);
    returns[node.left ? node.left.id : -1] = l;
    steps2.push(makeStep(draw({ current: node.id, done: new Set(), path: new Set(path), returns: { ...returns }, result: '?' }),
      `Left depth = ${l}. Now recurse into right child.`));

    const r = dfs(node.right, path, steps2);
    if (node.right) returns[node.right.id] = r;
    const res = 1 + Math.max(l, r);
    returns[node.id] = res;
    steps2.push(makeStep(draw({ current: node.id, done: new Set(), path: new Set(path), returns: { ...returns }, result: node.id === 0 ? res : '?' }),
      `Node ${node.val}: 1 + max(${l}, ${r}) = ${res}. Return ${res}.`));

    path.delete(node.id);
    return res;
  }

  const pathSet = new Set();
  const result = dfs(tree, pathSet, steps);
  steps.push(makeStep(draw({ current: null, done: new Set(), path: new Set(), returns: { ...returns }, result }),
    `✓ Done! Maximum depth of the tree = ${result}.`));

  return steps;
}

/* ════════════════════════════════════════════════════════════════════════════
   8.  DP — Climbing Stairs
   ════════════════════════════════════════════════════════════════════════════ */
function genDPStairs() {
  const n = 6;
  const steps = [];

  function draw(state) {
    return (ctx, W, H) => {
      clearCanvas(ctx, W, H);
      const cellW = 52, cellH = 40, startX = 40, dpY = H - 80;

      // draw stair shape
      const stairW = 28, stairH = 22;
      for (let i = 1; i <= n; i++) {
        const x = 30 + (i - 1) * stairW * 1.5;
        const y = H / 2 - i * stairH + stairH;
        ctx.fillStyle = state.filled >= i ? 'rgba(34,197,94,.25)' : 'rgba(30,58,95,.5)';
        ctx.strokeStyle = state.filled >= i ? C.GREEN : C.BORDER;
        ctx.lineWidth = 1.5;
        ctx.fillRect(x, y, stairW * 1.5, stairH);
        ctx.strokeRect(x, y, stairW * 1.5, stairH);
        ctx.fillStyle = state.filled >= i ? C.GREEN : C.TEXT2;
        ctx.font = `bold 11px monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(i, x + stairW * 0.75, y + stairH / 2);
      }

      // dp table
      drawLabel(ctx, 'dp table:', 16, dpY - 22, { align: 'left', fontSize: 11, color: C.TEXT2 });
      for (let i = 1; i <= n; i++) {
        const x = startX + (i - 1) * (cellW + 4);
        drawCell(ctx, x, dpY, cellW, cellH, i, { bg: '#111827', border: C.BORDER, fontSize: 13 });
        const val = state.dp[i];
        drawCell(ctx, x, dpY + cellH + 2, cellW, cellH, val !== undefined ? val : '?', {
          bg: val !== undefined ? (i === state.cur ? '#1e3a5f' : '#0f2b4a') : C.CELL,
          border: i === state.cur ? C.INDIGO : C.BORDER,
          color: val !== undefined ? C.GREEN : C.TEXT3,
          fontSize: 16,
        });
      }
    };
  }

  steps.push(makeStep(draw({ dp: {}, cur: null, filled: 0 }),
    `n = ${n}. How many ways to reach step ${n} using 1 or 2 steps at a time?`));

  const dp = {};
  dp[1] = 1; dp[2] = 2;
  steps.push(makeStep(draw({ dp: { ...dp }, cur: 1, filled: 1 }),
    `Base: dp[1] = 1 (only one way: step 1 at a time).`));
  steps.push(makeStep(draw({ dp: { ...dp }, cur: 2, filled: 2 }),
    `Base: dp[2] = 2 (ways: [1,1] or [2]).`));

  for (let i = 3; i <= n; i++) {
    dp[i] = dp[i - 1] + dp[i - 2];
    steps.push(makeStep(draw({ dp: { ...dp }, cur: i, filled: i }),
      `dp[${i}] = dp[${i - 1}] + dp[${i - 2}] = ${dp[i - 1]} + ${dp[i - 2]} = ${dp[i]}.`));
  }

  steps.push(makeStep(draw({ dp: { ...dp }, cur: null, filled: n }),
    `✓ Done! dp[${n}] = ${dp[n]} distinct ways to climb ${n} stairs.`));

  return steps;
}

/* ════════════════════════════════════════════════════════════════════════════
   8b. DP — Coin Change
   ════════════════════════════════════════════════════════════════════════════ */
function genDPCoins() {
  const coins = [1, 5, 6];
  const amount = 11;
  const steps = [];
  const dp = new Array(amount + 1).fill(Infinity);
  dp[0] = 0;

  function draw(state) {
    return (ctx, W, H) => {
      clearCanvas(ctx, W, H);
      const cellW = Math.floor((W - 32) / (amount + 1)) - 2;
      const cellH = 40;
      const startX = 16;
      const tableY = H / 2 - 20;

      drawLabel(ctx, `coins = [${coins}]`, W / 2, 22, { align: 'center', fontSize: 13, color: C.TEXT2 });
      drawLabel(ctx, 'amount index:', startX, tableY - 18, { align: 'left', fontSize: 11 });
      drawLabel(ctx, 'dp[a]:', startX, tableY + cellH + 28, { align: 'left', fontSize: 11 });

      for (let a = 0; a <= amount; a++) {
        const x = startX + a * (cellW + 2);
        drawCell(ctx, x, tableY, cellW, cellH, a, { bg: '#111827', border: C.BORDER, fontSize: 11 });
        const val = state.dp[a];
        const cur = a === state.cur;
        drawCell(ctx, x, tableY + cellH + 10, cellW, cellH, val === Infinity ? '∞' : val, {
          bg: val === Infinity ? C.CELL : (cur ? '#1e3a5f' : '#0f2b4a'),
          border: cur ? C.INDIGO : (val === Infinity ? C.BORDER : C.TEXT3),
          color: val === Infinity ? C.TEXT3 : (cur ? C.TEXT : C.GREEN),
          fontSize: 12,
        });
      }

      if (state.coin !== null && state.cur !== null) {
        infoBox(ctx, 16, H - 35, `Trying coin ${state.coin}: dp[${state.cur}] = min(dp[${state.cur}], 1+dp[${state.cur - state.coin}])`, '', {});
      }
      if (state.done) infoBox(ctx, 16, H - 35, `Answer: dp[${amount}] = `, state.dp[amount], { valueColor: C.GREEN });
    };
  }

  steps.push(makeStep(draw({ dp: [...dp], cur: null, coin: null, done: false }),
    `coins = [${coins}], amount = ${amount}. Initialize dp[0]=0, rest=∞.`));

  for (let a = 1; a <= amount; a++) {
    for (const coin of coins) {
      if (coin <= a && dp[a - coin] !== Infinity) {
        const newVal = 1 + dp[a - coin];
        if (newVal < dp[a]) {
          dp[a] = newVal;
          steps.push(makeStep(draw({ dp: [...dp], cur: a, coin, done: false }),
            `dp[${a}] = min(dp[${a}], 1+dp[${a - coin}]) = min(prev, 1+${dp[a - coin] + 1 - 1}) = ${dp[a]}.`));
        }
      }
    }
  }

  steps.push(makeStep(draw({ dp: [...dp], cur: amount, coin: null, done: true }),
    `✓ Done! Minimum coins for amount ${amount} = dp[${amount}] = ${dp[amount]}.`));

  return steps;
}

/* ════════════════════════════════════════════════════════════════════════════
   9.  Backtracking — Permutations
   ════════════════════════════════════════════════════════════════════════════ */
function genBTPerms() {
  const nums = [1, 2, 3];
  const steps = [];
  const results = [];

  function draw(state) {
    return (ctx, W, H) => {
      clearCanvas(ctx, W, H);
      const cellW = 36, cellH = 36, gap = 4;

      // current path
      drawLabel(ctx, 'Current path:', 16, 28, { align: 'left', fontSize: 12, color: C.TEXT2 });
      state.path.forEach((v, i) => {
        drawCell(ctx, 16 + i * (cellW + gap), 40, cellW, cellH, v, { bg: '#1e3a5f', border: C.INDIGO, fontSize: 16 });
      });
      if (state.path.length === 0) drawLabel(ctx, '(empty)', 80, 58, { fontSize: 12, color: C.TEXT3 });

      // remaining
      drawLabel(ctx, 'Remaining:', 16, 94, { align: 'left', fontSize: 12, color: C.TEXT2 });
      state.remaining.forEach((v, i) => {
        drawCell(ctx, 16 + i * (cellW + gap), 106, cellW, cellH, v, { fontSize: 16 });
      });
      if (state.remaining.length === 0) drawLabel(ctx, '(none — add to results)', 80, 124, { fontSize: 12, color: C.GREEN });

      // results so far
      drawLabel(ctx, `Results (${state.results.length}):`, 16, 160, { align: 'left', fontSize: 12, color: C.GREEN });
      state.results.forEach((r, ri) => {
        r.forEach((v, vi) => {
          drawCell(ctx, 16 + vi * (cellW + gap), 172 + ri * (cellH + gap), cellW, cellH, v, {
            bg: '#0f2b4a', border: C.TEXT3, fontSize: 14,
          });
        });
      });
    };
  }

  steps.push(makeStep(draw({ path: [], remaining: [...nums], results: [] }),
    `Find all permutations of [${nums}]. At each step, pick any remaining number.`));

  function backtrack(path, remaining) {
    if (remaining.length === 0) {
      results.push([...path]);
      steps.push(makeStep(draw({ path: [...path], remaining: [], results: results.map(r => [...r]) }),
        `Path complete! [${path}] is a permutation. Backtrack.`));
      return;
    }
    for (let i = 0; i < remaining.length; i++) {
      path.push(remaining[i]);
      const newRem = [...remaining.slice(0, i), ...remaining.slice(i + 1)];
      steps.push(makeStep(draw({ path: [...path], remaining: newRem, results: results.map(r => [...r]) }),
        `Choose ${remaining[i]}. Path = [${path}]. Remaining = [${newRem}].`));
      backtrack(path, newRem);
      path.pop();
      steps.push(makeStep(draw({ path: [...path], remaining, results: results.map(r => [...r]) }),
        `Backtrack: remove ${remaining[i]}. Try next choice.`));
    }
  }

  backtrack([], [...nums]);
  steps.push(makeStep(draw({ path: [], remaining: [], results: results.map(r => [...r]) }),
    `✓ Done! All ${results.length} permutations: ${results.map(r => `[${r}]`).join(', ')}.`));

  return steps;
}

/* ════════════════════════════════════════════════════════════════════════════
   10. Graph — Number of Islands
   ════════════════════════════════════════════════════════════════════════════ */
function genGraphIslands() {
  const grid = [
    ['1','1','0','0','0'],
    ['1','1','0','0','0'],
    ['0','0','1','0','0'],
    ['0','0','0','1','1'],
  ];
  const steps = [];
  const rows = grid.length, cols = grid[0].length;
  const state = grid.map(r => [...r]);
  let count = 0;

  function draw(st) {
    return (ctx, W, H) => {
      clearCanvas(ctx, W, H);
      const cellW = 52, cellH = 44, gap = 4;
      const total = cols * cellW + (cols - 1) * gap;
      const startX = (W - total) / 2, startY = (H - (rows * cellH + (rows - 1) * gap)) / 2;

      st.grid.forEach((row, r) => {
        row.forEach((cell, c) => {
          const x = startX + c * (cellW + gap);
          const y = startY + r * (cellH + gap);
          let bg = C.BG, border = C.BORDER, textC = C.TEXT3, text = cell;
          if (cell === '1') { bg = 'rgba(34,197,94,.2)'; border = C.GREEN; textC = C.GREEN; text = '1'; }
          if (cell === 'V') { bg = 'rgba(99,102,241,.3)'; border = C.INDIGO; textC = C.INDIGO; text = '✓'; }
          if (r === st.cr && c === st.cc && cell !== 'V') { bg = '#1e3a5f'; border = C.CYAN; textC = C.CYAN; }
          drawCell(ctx, x, y, cellW, cellH, text, { bg, border, color: textC, fontSize: 20, r: 6 });
        });
      });

      infoBox(ctx, 16, H - 28, 'Islands found: ', st.count, { valueColor: C.AMBER });
    };
  }

  steps.push(makeStep(draw({ grid: state.map(r => [...r]), cr: null, cc: null, count: 0 }),
    `5×4 grid. 1=land, 0=water. Count connected land components.`));

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (state[r][c] === '1') {
        count++;
        steps.push(makeStep(draw({ grid: state.map(r2 => [...r2]), cr: r, cc: c, count }),
          `Found unvisited land at (${r},${c}). Island #${count}. Start DFS to mark connected cells.`));

        const stack = [[r, c]];
        while (stack.length) {
          const [nr, nc] = stack.pop();
          if (nr < 0 || nr >= rows || nc < 0 || nc >= cols || state[nr][nc] !== '1') continue;
          state[nr][nc] = 'V';
          steps.push(makeStep(draw({ grid: state.map(r2 => [...r2]), cr: nr, cc: nc, count }),
            `Mark (${nr},${nc}) as visited. Explore its neighbors.`));
          stack.push([nr+1,nc],[nr-1,nc],[nr,nc+1],[nr,nc-1]);
        }
      }
    }
  }

  steps.push(makeStep(draw({ grid: state.map(r => [...r]), cr: null, cc: null, count }),
    `✓ Done! Number of islands = ${count}.`));

  return steps;
}

/* ════════════════════════════════════════════════════════════════════════════
   11. Stack — Valid Parentheses
   ════════════════════════════════════════════════════════════════════════════ */
function genStackParens() {
  const s = '([{}])';
  const steps = [];

  function draw(state) {
    return (ctx, W, H) => {
      clearCanvas(ctx, W, H);
      const cellW = 44, cellH = 44, gap = 4;

      // string
      drawLabel(ctx, 'Input string:', 16, 28, { align: 'left', fontSize: 12, color: C.TEXT2 });
      s.split('').forEach((ch, i) => {
        const x = 16 + i * (cellW + gap);
        let bg = C.CELL, border = C.BORDER;
        if (i < state.idx) { bg = '#0f172a'; border = '#1e2d45'; }
        if (i === state.idx) { bg = state.match ? '#14532d' : (state.err ? '#450a0a' : '#1e3a5f'); border = state.match ? C.GREEN : (state.err ? C.RED : C.INDIGO); }
        drawCell(ctx, x, 40, cellW, cellH, ch, { bg, border, fontSize: 22 });
      });

      // stack
      const stackX = W - 120, stackBaseY = H - 60;
      drawLabel(ctx, 'Stack:', stackX, stackBaseY - state.stack.length * 46 - 18, { align: 'left', fontSize: 12, color: C.TEXT2 });
      state.stack.forEach((ch, i) => {
        drawCell(ctx, stackX, stackBaseY - (i + 1) * (cellH + gap), 56, cellH, ch, { bg: '#1e3a5f', border: C.INDIGO, fontSize: 20 });
      });
      ctx.strokeStyle = C.BORDER; ctx.lineWidth = 1.5;
      ctx.strokeRect(stackX - 2, stackBaseY - 300, 60, 300);

      // result
      if (state.done) {
        const ok = state.stack.length === 0 && !state.err;
        drawLabel(ctx, ok ? '✓ VALID' : '✗ INVALID', W / 2, H - 28, {
          align: 'center', fontSize: 16, color: ok ? C.GREEN : C.RED
        });
      }
    };
  }

  const match = { ')': '(', ']': '[', '}': '{' };
  const opens = new Set('([{');
  const stack = [];
  let err = false;

  steps.push(makeStep(draw({ idx: -1, stack: [], match: false, err: false, done: false }),
    `Input: "${s}". For each char: push if open bracket, pop and check if close bracket.`));

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (opens.has(ch)) {
      stack.push(ch);
      steps.push(makeStep(draw({ idx: i, stack: [...stack], match: false, err: false, done: false }),
        `'${ch}' is an opening bracket → push to stack. Stack: [${stack}].`));
    } else {
      const top = stack.pop();
      const ok = top === match[ch];
      if (!ok) err = true;
      steps.push(makeStep(draw({ idx: i, stack: [...stack], match: ok, err: !ok, done: false }),
        ok ? `'${ch}' matches '${top}' at top of stack → pop. Stack: [${stack}].`
           : `'${ch}' does NOT match '${top}' → INVALID!`));
    }
  }

  steps.push(makeStep(draw({ idx: s.length, stack: [...stack], match: false, err, done: true }),
    stack.length === 0 && !err ? `Stack is empty → all brackets matched → ✓ VALID!` : `Stack not empty or mismatch → ✗ INVALID!`));

  return steps;
}

/* ════════════════════════════════════════════════════════════════════════════
   12. Heap — Kth Largest
   ════════════════════════════════════════════════════════════════════════════ */
function genHeapKth() {
  const nums = [3, 2, 1, 5, 6, 4];
  const k = 2;
  const steps = [];

  function draw(state) {
    return (ctx, W, H) => {
      clearCanvas(ctx, W, H);

      // input array
      drawLabel(ctx, 'Input:', 16, 28, { align: 'left', fontSize: 12, color: C.TEXT2 });
      const hl = {};
      if (state.cur !== null) hl[state.cur] = { bg: '#1e3a5f', border: C.INDIGO };
      if (state.popped !== null) hl[state.popped] = { bg: '#450a0a', border: C.RED };
      drawArray(ctx, nums, W / 2, 40, 48, 40, hl);

      // min-heap display
      drawLabel(ctx, `Min-Heap (size ≤ ${k}):`, 16, 110, { align: 'left', fontSize: 12, color: C.TEXT2 });
      const heapY = 126;
      state.heap.forEach((v, i) => {
        drawCell(ctx, 16 + i * 52, heapY, 48, 40, v, {
          bg: i === 0 ? '#7c1d1d' : '#1a2235',
          border: i === 0 ? C.RED : C.BORDER,
          fontSize: 18,
        });
      });
      if (state.heap.length === 0) drawLabel(ctx, '(empty)', 80, 146, { fontSize: 12, color: C.TEXT3 });
      if (state.heap.length > 0) drawLabel(ctx, 'min ↑', 16 + 24, heapY + 44, { fontSize: 11, color: C.RED });

      infoBox(ctx, 16, H - 28, `k = ${k}. Answer (heap[0]): `, state.ans, { valueColor: C.GREEN });
    };
  }

  steps.push(makeStep(draw({ heap: [], cur: null, popped: null, ans: '?' }),
    `nums = [${nums}], k = ${k}. Keep a min-heap of size k → top = kth largest.`));

  const heap = [];
  function heapPush(v) {
    heap.push(v);
    heap.sort((a, b) => a - b);
  }
  function heapPop() {
    return heap.shift();
  }

  nums.forEach((num, i) => {
    heapPush(num);
    steps.push(makeStep(draw({ heap: [...heap], cur: i, popped: null, ans: heap.length >= k ? heap[0] : '?' }),
      `Push ${num}. Heap = [${heap}] (sorted as min-heap).`));
    if (heap.length > k) {
      const removed = heapPop();
      steps.push(makeStep(draw({ heap: [...heap], cur: null, popped: i, ans: heap[0] }),
        `Heap size > ${k}. Pop minimum = ${removed}. Keep only ${k} largest. Heap = [${heap}].`));
    }
  });

  steps.push(makeStep(draw({ heap: [...heap], cur: null, popped: null, ans: heap[0] }),
    `✓ Done! The ${k}th largest element = heap[0] = ${heap[0]}.`));

  return steps;
}

/* ════════════════════════════════════════════════════════════════════════════
   Registry
   ════════════════════════════════════════════════════════════════════════════ */
const AnimationRegistry = {
  'sw-max-sum':      genSWMaxSum,
  'sw-no-repeat':    genSWNoRepeat,
  'tp-two-sum':      genTPTwoSum,
  'tp-container':    genTPContainer,
  'fs-cycle':        genFSCycle,
  'fs-middle':       genFSMiddle,
  'bs-classic':      genBSClassic,
  'mi-merge':        genMIMerge,
  'bfs-level':       genBFSLevel,
  'dfs-depth':       genDFSDepth,
  'dp-stairs':       genDPStairs,
  'dp-coins':        genDPCoins,
  'bt-perms':        genBTPerms,
  'graph-islands':   genGraphIslands,
  'stack-parens':    genStackParens,
  'heap-kth':        genHeapKth,
};

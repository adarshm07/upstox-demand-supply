/* ─── State ─────────────────────────────────────────────────────────────────── */
let currentPattern = null;
let currentProblem = null;
let currentProblemIndex = 0;
let currentPatternIndex = 0;

let animSteps = [];
let animStep  = 0;
let animTimer = null;
let animPlaying = false;
const SPEED_MAP = [1200, 800, 500, 300, 150]; // ms per step at speed 1-5

const solved = new Set(JSON.parse(localStorage.getItem('dsa-solved') || '[]'));

/* ─── Helpers ───────────────────────────────────────────────────────────────── */
const $ = id => document.getElementById(id);

function saveSolved() {
  localStorage.setItem('dsa-solved', JSON.stringify([...solved]));
}

function totalProblems() {
  return PATTERNS.reduce((s, p) => s + p.problems.length, 0);
}

function updateProgress() {
  const pct = Math.round((solved.size / totalProblems()) * 100);
  $('progress-fill').style.width = pct + '%';
  $('progress-label').textContent = `${solved.size} / ${totalProblems()} solved`;
}

function diffClass(d) {
  return d === 'Easy' ? 'easy' : d === 'Medium' ? 'medium' : 'hard';
}

/* ─── Syntax Highlighter ────────────────────────────────────────────────────── */
function highlight(code, lang) {
  const jsKw   = /\b(function|return|let|const|var|if|else|for|while|of|in|new|class|import|export|default|null|undefined|true|false|this|typeof|instanceof|break|continue|throw|try|catch|finally|from|async|await|switch|case)\b/g;
  const pyKw   = /\b(def|return|if|elif|else|for|while|in|not|and|or|is|True|False|None|import|from|class|lambda|yield|with|as|raise|try|except|finally|pass|break|continue|global|nonlocal)\b/g;
  const fns    = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*(?=\()/g;
  const nums   = /\b(\d+\.?\d*)\b/g;
  const strs   = /(["'`])((?:\\.|(?!\1)[^\\])*)\1/g;
  const cmtsJS = /(\/\/.*$)/gm;
  const cmtsPY = /(#.*$)/gm;
  const builtins = /\b(Math|Array|Object|String|Number|Boolean|JSON|console|Map|Set|deque|Counter|heapq|collections|int|str|list|dict|range|len|max|min|sum|abs|print|append|pop|push|shift|split|join|sort|filter|map|reduce)\b/g;

  let h = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  h = h.replace(strs, (_, q, inner) => `<span class="tok-str">${q}${inner}${q}</span>`);
  h = lang === 'python'
      ? h.replace(cmtsPY, m => `<span class="tok-cmt">${m}</span>`)
      : h.replace(cmtsJS, m => `<span class="tok-cmt">${m}</span>`);
  h = lang === 'python'
      ? h.replace(pyKw, m => `<span class="tok-kw">${m}</span>`)
      : h.replace(jsKw, m => `<span class="tok-kw">${m}</span>`);
  h = h.replace(fns, (_, fn) => `<span class="tok-fn">${fn}</span>(`);
  h = h.replace(nums, m => `<span class="tok-num">${m}</span>`);
  h = h.replace(builtins, m => `<span class="tok-builtin">${m}</span>`);

  return h;
}

/* ─── Sidebar ───────────────────────────────────────────────────────────────── */
function buildSidebar() {
  const nav = $('pattern-nav');
  nav.innerHTML = '';

  PATTERNS.forEach((pattern, pi) => {
    const section = document.createElement('div');
    section.className = 'pattern-section';
    section.id = `ps-${pattern.id}`;

    const heading = document.createElement('div');
    heading.className = 'pattern-heading';
    heading.innerHTML = `
      <span class="ph-icon" style="background:${pattern.bg};color:${pattern.color}">${pattern.icon}</span>
      <span class="ph-name">${pattern.name}</span>
      <span class="ph-count">${pattern.problems.length}</span>
      <span class="ph-arrow" id="arrow-${pattern.id}">›</span>
    `;
    heading.addEventListener('click', () => togglePattern(pattern.id));

    const list = document.createElement('div');
    list.className = 'problem-list';
    list.id = `pl-${pattern.id}`;

    pattern.problems.forEach((p, pi2) => {
      const item = document.createElement('div');
      item.className = 'problem-item';
      item.id = `item-${p.id}`;
      item.innerHTML = `
        <span class="pi-dot ${solved.has(p.id) ? 'solved' : ''}"></span>
        <span class="pi-name">${p.title}</span>
        <span class="pi-diff ${diffClass(p.difficulty)}">${p.difficulty[0]}</span>
      `;
      item.addEventListener('click', () => openProblem(pi, pi2));
      list.appendChild(item);
    });

    section.appendChild(heading);
    section.appendChild(list);
    nav.appendChild(section);
  });
}

function togglePattern(id) {
  const list  = $(`pl-${id}`);
  const arrow = $(`arrow-${id}`);
  const open  = list.classList.contains('open');
  list.classList.toggle('open', !open);
  arrow.classList.toggle('open', !open);
  PATTERNS.forEach(p => {
    if (p.id !== id) {
      $(`pl-${p.id}`).classList.remove('open');
      $(`arrow-${p.id}`).classList.remove('open');
    }
  });
}

/* ─── Welcome Grid ──────────────────────────────────────────────────────────── */
function buildGrid() {
  const grid = $('pattern-grid');
  grid.innerHTML = '';
  PATTERNS.forEach((pattern, pi) => {
    const card = document.createElement('div');
    card.className = 'pattern-card';
    const solvedCount = pattern.problems.filter(p => solved.has(p.id)).length;
    card.innerHTML = `
      <div class="pc-icon-wrap" style="background:${pattern.bg}">
        <span style="color:${pattern.color};font-size:22px">${pattern.icon}</span>
      </div>
      <div class="pc-name">${pattern.name}</div>
      <div class="pc-desc">${pattern.description}</div>
      <div class="pc-count">${solvedCount}/${pattern.problems.length} solved</div>
      <div class="pc-bar" style="background:${pattern.bg}">
        <div style="height:100%;width:${(solvedCount/pattern.problems.length)*100}%;background:${pattern.color};border-radius:2px"></div>
      </div>
    `;
    card.addEventListener('click', () => {
      openProblem(pi, 0);
    });
    grid.appendChild(card);
  });
}

/* ─── Open Problem ──────────────────────────────────────────────────────────── */
function openProblem(pi, probIdx) {
  currentPatternIndex = pi;
  currentProblemIndex = probIdx;
  currentPattern = PATTERNS[pi];
  currentProblem = currentPattern.problems[probIdx];

  // show problem view, hide welcome
  $('welcome').classList.add('hidden');
  $('problem-view').classList.remove('hidden');

  // expand sidebar pattern
  togglePattern(currentPattern.id);

  // highlight sidebar item
  document.querySelectorAll('.problem-item').forEach(el => el.classList.remove('active'));
  const item = $(`item-${currentProblem.id}`);
  if (item) { item.classList.add('active'); item.scrollIntoView({ block: 'nearest' }); }

  // populate header
  $('pv-pattern').textContent = currentPattern.name;
  $('pv-pattern').style.background = currentPattern.bg;
  $('pv-pattern').style.color = currentPattern.color;
  $('pv-title').textContent = currentProblem.title;
  $('pv-difficulty').textContent = currentProblem.difficulty;
  $('pv-difficulty').className = `badge ${diffClass(currentProblem.difficulty)}`;
  $('pv-time').textContent  = `⏱ ${currentProblem.timeComplexity}`;
  $('pv-space').textContent = `💾 ${currentProblem.spaceComplexity}`;

  // navigation
  const allProbs = currentPattern.problems;
  $('pv-counter').textContent = `${probIdx + 1} / ${allProbs.length}`;
  $('btn-prev').disabled = probIdx === 0;
  $('btn-next').disabled = probIdx === allProbs.length - 1;

  // description & approach
  $('pv-description').innerHTML = currentProblem.description;
  $('pv-approach').innerHTML    = currentProblem.approach;

  // solved button
  const btnSolved = $('btn-solved');
  if (solved.has(currentProblem.id)) {
    btnSolved.textContent = '✓ Solved!';
    btnSolved.classList.add('solved');
  } else {
    btnSolved.textContent = 'Mark as Solved ✓';
    btnSolved.classList.remove('solved');
  }

  // code
  setLang('javascript');

  // animation
  resetAnimation();
  loadAnimation();
}

/* ─── Code Display ──────────────────────────────────────────────────────────── */
let currentLang = 'javascript';
function setLang(lang) {
  currentLang = lang;
  document.querySelectorAll('.lang-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });
  const code = currentProblem.solutions[lang] || '';
  $('code-block').innerHTML = highlight(code, lang);
}

/* ─── Animation ─────────────────────────────────────────────────────────────── */
let canvas, ctx, canvasW, canvasH;

function initCanvas() {
  canvas = $('anim-canvas');
  const wrap = canvas.parentElement;
  const dpr = window.devicePixelRatio || 1;
  canvasW = wrap.clientWidth;
  canvasH = wrap.clientHeight;
  canvas.width  = canvasW * dpr;
  canvas.height = canvasH * dpr;
  canvas.style.width  = canvasW + 'px';
  canvas.style.height = canvasH + 'px';
  ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
}

function loadAnimation() {
  const animId = currentProblem.animId;
  if (!animId || !AnimationRegistry[animId]) {
    $('canvas-placeholder').style.display = 'flex';
    $('canvas-placeholder').textContent = 'No animation for this problem yet.';
    animSteps = [];
    updateStepUI();
    return;
  }
  $('canvas-placeholder').style.display = 'none';
  initCanvas();
  animSteps = AnimationRegistry[animId]();
  animStep  = 0;
  renderStep(0);
  updateStepUI();
}

function renderStep(i) {
  if (!animSteps.length || !ctx) return;
  const step = animSteps[i];
  if (!step) return;
  step.draw(ctx, canvasW, canvasH);
  $('step-desc').textContent = step.desc;
  $('step-badge').textContent = `${i + 1} / ${animSteps.length}`;
}

function updateStepUI() {
  $('step-badge').textContent = animSteps.length ? `${animStep + 1} / ${animSteps.length}` : '0 / 0';
}

function resetAnimation() {
  stopPlay();
  animStep = 0;
  animSteps = [];
  $('step-desc').textContent = 'Select a step to see what the algorithm is doing.';
  $('step-badge').textContent = '0 / 0';
  $('ctrl-play').textContent = '▶ Play';
  $('ctrl-play').classList.remove('playing');
}

function stepForward() {
  if (animStep < animSteps.length - 1) {
    animStep++;
    renderStep(animStep);
  } else {
    stopPlay();
  }
}

function stepBack() {
  if (animStep > 0) {
    animStep--;
    renderStep(animStep);
  }
}

function startPlay() {
  if (!animSteps.length) return;
  animPlaying = true;
  $('ctrl-play').textContent = '⏸ Pause';
  $('ctrl-play').classList.add('playing');
  const speed = parseInt($('speed-range').value, 10);
  const ms = SPEED_MAP[speed - 1] || 500;
  animTimer = setInterval(() => {
    if (animStep >= animSteps.length - 1) {
      stopPlay();
    } else {
      stepForward();
    }
  }, ms);
}

function stopPlay() {
  clearInterval(animTimer);
  animPlaying = false;
  $('ctrl-play').textContent = '▶ Play';
  $('ctrl-play').classList.remove('playing');
}

/* ─── Event Listeners ───────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  buildSidebar();
  buildGrid();
  updateProgress();

  // Back button
  $('btn-back').addEventListener('click', () => {
    stopPlay();
    $('problem-view').classList.add('hidden');
    $('welcome').classList.remove('hidden');
    buildGrid(); // refresh solved counts
  });

  // Prev / Next problem
  $('btn-prev').addEventListener('click', () => {
    if (currentProblemIndex > 0) openProblem(currentPatternIndex, currentProblemIndex - 1);
  });
  $('btn-next').addEventListener('click', () => {
    const pat = PATTERNS[currentPatternIndex];
    if (currentProblemIndex < pat.problems.length - 1) openProblem(currentPatternIndex, currentProblemIndex + 1);
  });

  // Animation controls
  $('ctrl-reset').addEventListener('click', () => {
    stopPlay();
    animStep = 0;
    renderStep(0);
  });
  $('ctrl-prev-step').addEventListener('click', () => { stopPlay(); stepBack(); });
  $('ctrl-play').addEventListener('click', () => { animPlaying ? stopPlay() : startPlay(); });
  $('ctrl-next-step').addEventListener('click', () => { stopPlay(); stepForward(); });
  $('ctrl-end').addEventListener('click', () => {
    stopPlay();
    animStep = animSteps.length - 1;
    renderStep(animStep);
  });

  $('speed-range').addEventListener('input', e => {
    $('speed-val').textContent = e.target.value + '×';
    if (animPlaying) { stopPlay(); startPlay(); }
  });

  // Language tabs
  document.querySelectorAll('.lang-tab').forEach(btn => {
    btn.addEventListener('click', () => setLang(btn.dataset.lang));
  });

  // Solved button
  $('btn-solved').addEventListener('click', () => {
    if (!currentProblem) return;
    if (solved.has(currentProblem.id)) {
      solved.delete(currentProblem.id);
      $('btn-solved').textContent = 'Mark as Solved ✓';
      $('btn-solved').classList.remove('solved');
    } else {
      solved.add(currentProblem.id);
      $('btn-solved').textContent = '✓ Solved!';
      $('btn-solved').classList.add('solved');
    }
    saveSolved();
    updateProgress();
    buildSidebar();
    // re-highlight active item
    document.querySelectorAll('.problem-item').forEach(el => el.classList.remove('active'));
    const item = $(`item-${currentProblem.id}`);
    if (item) item.classList.add('active');
  });

  // Search
  $('search-input').addEventListener('input', e => {
    const q = e.target.value.toLowerCase().trim();
    PATTERNS.forEach(pattern => {
      let anyVisible = false;
      pattern.problems.forEach(p => {
        const item = $(`item-${p.id}`);
        if (!item) return;
        const match = !q || p.title.toLowerCase().includes(q) || pattern.name.toLowerCase().includes(q);
        item.style.display = match ? '' : 'none';
        if (match) anyVisible = true;
      });
      const section = $(`ps-${pattern.id}`);
      if (section) section.style.display = anyVisible ? '' : 'none';
      if (q && anyVisible) {
        $(`pl-${pattern.id}`).classList.add('open');
        $(`arrow-${pattern.id}`).classList.add('open');
      }
    });
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (!currentProblem) return;
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 'ArrowRight' || e.key === 'n') { stopPlay(); stepForward(); }
    if (e.key === 'ArrowLeft'  || e.key === 'p') { stopPlay(); stepBack(); }
    if (e.key === ' ') { e.preventDefault(); animPlaying ? stopPlay() : startPlay(); }
    if (e.key === 'r') { stopPlay(); animStep = 0; renderStep(0); }
  });

  // Resize: re-init canvas
  window.addEventListener('resize', () => {
    if (currentProblem && animSteps.length) {
      initCanvas();
      renderStep(animStep);
    }
  });
});

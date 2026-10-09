// BREWL espresso control — the panel's brain. Three dials, three recipes, one shot.
//
//   1. fit: pick the layout (desk, wide, phone), scale the panel to the screen, size what is drawn in pixels
//   2. the dials: temperature (heat arc, marker, states, steam), pressure, grind
//   3. the recipes: the copper switch that glides all three dials to a recipe
//   4. the shot: PULL SHOT plays a simulated extraction (sim.js) — graph, cup, timer, verdict — and STOP cuts it
//   5. one frame loop that runs only while something moves
//   6. window.__brew, the test hook
import { Dial } from './dial.js';
import { Graph } from './graph.js';
import { Cup } from './cup.js';
import { RECIPES, simulate, sampleAt, verdict } from './sim.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const calm = matchMedia('(prefers-reduced-motion: reduce)');

const stage = $('.stage'), panel = $('.brewl');
const tempEl = $('.dial--temp'), arcCanvas = $('.arc', tempEl), arcCtx = arcCanvas.getContext('2d');
const graph = new Graph($('.graph'));
const cup = new Cup($('.cup'));
const timer = $('.timer'), pull = $('.pull'), pullA = $('.pull-a'), progress = $('.pull-progress');
const result = $('.result'), announce = $('#announce');

let scale = 1, layout = 'desk';
const state = { recipe: 'espresso', shot: null, last: null };

// ================================================================================================================
// 1 · FIT — the panel keeps its design size and is scaled as a whole; each layout has its own design size
// ================================================================================================================
const DESIGN = { desk: [1160, 886], wide: [1400, 640] };
const PHONE = { w: 390, minH: 700, maxH: 900, fixed: 64 + 102 + 132 + 54 + 64 + 18, gaps: 5 };

function fit() {
  const vw = document.documentElement.clientWidth, vh = window.innerHeight;
  const next = vw < 700 ? 'phone' : vh < 560 && vw / vh > 1.5 ? 'wide' : 'desk';
  let w, h;
  if (next === 'phone') {
    scale = Math.min(vw / PHONE.w, vh / PHONE.minH, 1.6);
    w = PHONE.w; h = Math.min(PHONE.maxH, Math.floor(vh / scale));
    // the dial takes what the column leaves, up to the concept's size; anything left over opens the gaps
    const room = h - PHONE.fixed - PHONE.gaps * 12;
    const d = clamp(room, 170, 316);
    const gap = 12 + Math.max(0, room - d) / PHONE.gaps;
    stage.style.setProperty('--pd', d);
    stage.style.setProperty('--gap', `${gap.toFixed(1)}px`);
    stage.style.setProperty('--band', ((vh - h * scale) / 2 + 64 * scale).toFixed(1));
  } else {
    [w, h] = DESIGN[next];
    const m = next === 'wide' ? 8 : clamp(Math.min(vw, vh) * 0.035, 12, 40);
    scale = Math.min((vw - m * 2) / w, (vh - m * 2) / h, 1.4);
  }
  layout = next;
  stage.dataset.layout = layout;
  stage.style.setProperty('--w', w); stage.style.setProperty('--h', h); stage.style.setProperty('--s', scale.toFixed(4));
  plateShape(w);
  for (const d of dials) ticks(d);
  sizeArc();
  graph.resize(scale);
  cup.frameFor(layout);
  thumb(false);
  for (const d of dials) { d.dirty = true; d.frame(performance.now()); }
  stage.classList.add('ready');
}

// the name plate: a graphite band with a tab hanging from its middle, a copper lip along its lower edge
function plateShape(W) {
  if (layout === 'phone') return;
  const cs = getComputedStyle(stage), H = parseFloat(cs.getPropertyValue('--plate-h')), T = parseFloat(cs.getPropertyValue('--tab-h'));
  const r = 22, cx = W / 2, tw = layout === 'wide' ? 400 : 452, a = cx - tw / 2, b = cx + tw / 2, e = 54;
  const svg = $('.plate-shape');
  svg.setAttribute('viewBox', `0 0 ${W} ${H + T}`);
  const tab = `L${b} ${H} C${b - 26} ${H} ${b - 28} ${H + T} ${b - e} ${H + T} L${a + e} ${H + T} C${a + 28} ${H + T} ${a + 26} ${H} ${a} ${H}`;
  $('.plate-body', svg).setAttribute('d', `M0 ${H} L0 ${r} Q0 0 ${r} 0 L${W - r} 0 Q${W} 0 ${W} ${r} L${W} ${H} ${tab} Z`);
  $('.plate-lip', svg).setAttribute('d', `M0 ${H - 1} L${a} ${H - 1} C${a + 26} ${H - 1} ${a + 28} ${H + T - 1} ${a + e} ${H + T - 1} L${b - e} ${H + T - 1} C${b - 28} ${H + T - 1} ${b - 26} ${H - 1} ${b} ${H - 1} L${W} ${H - 1}`);
}

// ================================================================================================================
// 2 · THE DIALS
// ================================================================================================================
// heat: the arc is a thermometer — every point on it is coloured by the temperature it stands for
const HEAT = [[85, [63, 120, 255]], [87.5, [80, 175, 255]], [90, [178, 222, 255]], [91.5, [255, 214, 170]], [93, [255, 154, 74]], [95, [255, 106, 43]], [96.5, [255, 59, 47]], [98, [226, 24, 43]]];
function heat(t) {
  for (let i = 1; i < HEAT.length; i++) if (t <= HEAT[i][0]) {
    const [t0, a] = HEAT[i - 1], [t1, b] = HEAT[i], k = clamp((t - t0) / (t1 - t0), 0, 1);
    return a.map((v, j) => Math.round(v + (b[j] - v) * k));
  }
  return HEAT[HEAT.length - 1][1];
}
const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

const fmtT = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
const tempState = (v) => (v >= 96 ? 'hot' : v < 90 ? 'idle' : 'ready');
const STATE_WORD = { idle: 'below brewing range', ready: 'ready', hot: 'too hot' };

const temp = new Dial(tempEl, {
  min: 85, max: 98, step: 0.5, big: 2, value: 93,
  text: (v) => `${fmtT(v)} °C, ${STATE_WORD[tempState(v)]}`,
  faceRadius: () => +getComputedStyle(tempEl).getPropertyValue('--kn'),
  draw: drawTemp, onInput: changed, onCommit: turning,
});
const pressure = new Dial($('[data-dial="pressure"]'), {
  min: 6, max: 12, step: 0.5, big: 1, value: 9,
  text: (v) => `${fmtT(v)} bar`,
  faceRadius: () => 0.74,
  draw: drawKnob, onInput: changed, onCommit: turning,
});
const grind = new Dial($('[data-dial="grind"]'), {
  min: 1, max: 30, step: 1, big: 5, value: 14,
  text: (v) => `${v}, ${v <= 9 ? 'fine' : v >= 21 ? 'coarse' : 'medium'}`,
  faceRadius: () => 0.74,
  draw: drawKnob, onInput: changed, onCommit: turning,
});
const dials = [temp, pressure, grind];

// the scale's ticks: one SVG per dial, rebuilt when the layout changes its size; the ones up to the value are darker
const TICKS = { temp: [0.25, 1], pressure: [0.25, 1], grind: [0.5, 5] };
function ticks(d) {
  const svg = $('.ticks', d.el), key = d.el.dataset.dial, [every, major] = TICKS[key];
  const D = parseFloat(getComputedStyle(d.el).getPropertyValue('--d')) || 100, c = D / 2;
  const [r0, r1, rm] = key === 'temp' ? [0.468, 0.497, 0.452] : [0.445, 0.497, 0.42];
  svg.setAttribute('viewBox', `0 0 ${D} ${D}`);
  d.D = D;
  let out = '';
  const n = Math.round((d.max - d.min) / every);
  for (let i = 0; i <= n; i++) {
    const v = d.min + i * every, a = ((d.angle(v) - 90) * Math.PI) / 180, isMajor = Math.abs(v / major - Math.round(v / major)) < 1e-6;
    const ra = (isMajor ? rm : r0) * D, rb = r1 * D;
    out += `<line data-v="${v}" class="${isMajor ? 'major' : ''}" x1="${(c + Math.cos(a) * ra).toFixed(1)}" y1="${(c + Math.sin(a) * ra).toFixed(1)}" x2="${(c + Math.cos(a) * rb).toFixed(1)}" y2="${(c + Math.sin(a) * rb).toFixed(1)}" stroke-width="1.5"/>`;
  }
  svg.innerHTML = out;
  d.tickEls = [...svg.children];
  d.tickOn = -1;
}
function lightTicks(d, v) {
  const n = d.tickEls.filter((t) => +t.dataset.v <= v + 1e-6).length;
  if (n === d.tickOn) return;
  d.tickEls.forEach((t, i) => t.classList.toggle('on', i < n));
  d.tickOn = n;
}

// the arc canvas: as many pixels as the bezel has on screen
function sizeArc() {
  const r = parseFloat(getComputedStyle(tempEl).getPropertyValue('--d')) * parseFloat(getComputedStyle(tempEl).getPropertyValue('--bz'));
  const px = Math.round(r * scale * Math.min(devicePixelRatio || 1, 3));
  arcCanvas.width = arcCanvas.height = px;
  temp.arcSize = r; temp.lastArc = null;
}

function drawTemp(v, angle, d) {
  // the arc, only when the drawn value moved by a visible amount
  if (d.lastArc === null || Math.abs(d.lastArc - v) > 0.004) { d.lastArc = v; paintArc(v); }
  const R = d.arcSize * (layout === 'phone' ? 0.44 : 0.45);
  $('.marker:not(.ghost)', d.el).style.transform = `rotate(${angle.toFixed(2)}deg) translateY(${-R}px)`;
  d.markR = R;
  const shown = d.turning ? d.snap(v) : d.value;
  if (shown !== d.lastText) { d.lastText = shown; $('.num', d.el).textContent = fmtT(shown); }
  lightTicks(d, v);
  const s = tempState(d.value);
  if (panel.dataset.tempState !== s) panel.dataset.tempState = s;
  chip();
}

function paintArc(v) {
  const c = arcCtx, px = arcCanvas.width, k = px / temp.arcSize, size = temp.arcSize, mid = size / 2;
  const R = size * (layout === 'phone' ? 0.44 : 0.45), W = size * (layout === 'phone' ? 0.05 : 0.044);
  const start = (135 * Math.PI) / 180, sweep = (270 * Math.PI) / 180, q = (v - temp.min) / (temp.max - temp.min);
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, px, px);
  c.setTransform(k, 0, 0, k, 0, 0);
  // the thermometer gradient, once per paint: 270° of the circle carry the scale, the rest wraps to its start
  const g = c.createConicGradient(start, mid, mid);
  for (let i = 0; i <= 20; i++) g.addColorStop((i / 20) * 0.75, rgb(heat(temp.min + (i / 20) * (temp.max - temp.min))));
  g.addColorStop(0.97, rgb(heat(temp.max))); g.addColorStop(0.985, rgb(heat(temp.min)));
  c.lineCap = 'round';
  // the groove the light runs in, and the rest of the scale, faint
  c.strokeStyle = 'rgba(0,0,0,0.55)'; c.lineWidth = W + 6; c.beginPath(); c.arc(mid, mid, R, start, start + sweep); c.stroke();
  c.strokeStyle = g; c.globalAlpha = 0.07; c.lineWidth = W * 2.2; c.beginPath(); c.arc(mid, mid, R, start, start + sweep); c.stroke();
  c.globalAlpha = 0.3; c.lineWidth = W * 0.75; c.beginPath(); c.arc(mid, mid, R, start, start + sweep); c.stroke();
  // the lit part: a wide haze, a softer glow, the core, and a hot white thread down its middle
  const end = start + Math.max(0.001, q) * sweep;
  for (const [a, w] of [[0.1, W * 3.2], [0.22, W * 1.9], [1, W]]) { c.globalAlpha = a; c.lineWidth = w; c.beginPath(); c.arc(mid, mid, R, start, end); c.stroke(); }
  c.globalAlpha = 0.45; c.strokeStyle = '#FFFFFF'; c.lineWidth = W * 0.28; c.beginPath(); c.arc(mid, mid, R, start, end); c.stroke();
  c.globalAlpha = 1;
}

function drawKnob(v, angle, d) {
  $('.knurl-spin', d.el).style.transform = `rotate(${(angle * 1.5).toFixed(2)}deg)`;
  const D = d.D || 176;
  $('.notch', d.el).style.transform = `rotate(${angle.toFixed(2)}deg) translateY(${(-D * 0.25).toFixed(1)}px)`;
  const shown = d.turning ? d.snap(v) : d.value;
  if (shown !== d.lastText) { d.lastText = shown; $('.num', d.el).textContent = fmtT(shown); }
  lightTicks(d, v);
}
// the temperature knob's knurled ring turns too
const tempKnurl = $('.knurl-spin', tempEl);
const tempDraw = temp.draw;
temp.draw = (v, a, d) => { tempDraw(v, a, d); tempKnurl.style.transform = `rotate(${(a * 1.5).toFixed(2)}deg)`; };

// the chip under the temperature: the recipe at a glance, or the warning
function chip() {
  const el = $('.face-chip', tempEl);
  const text = tempState(temp.value) === 'hot' ? 'Too hot' : `${fmtT(pressure.value)} bar · ${Math.round(preview().end)} s`;
  if (el.textContent !== text) el.textContent = text;
}

// any dial moved: the preview shot changes, the last verdict no longer applies
let previewCache = null;
function preview() {
  const key = `${temp.value}|${pressure.value}|${grind.value}|${state.recipe}`;
  if (!previewCache || previewCache.key !== key) previewCache = { key, trace: simulate(settings(), RECIPES[state.recipe]) };
  return previewCache.trace;
}
const settings = () => ({ temp: temp.value, pressure: pressure.value, grind: grind.value });
let previewDirty = true;
// (during a shot the new dials wait for the next one; after a shot, the first change clears the cup and the graph)
function changed() { if (!state.shot) { previewDirty = true; clearLast(); } kick(); }
function clearLast() {
  if (!state.last) return;
  state.last = null; hideResult();
  graph.setLive(null, 0); cup.set(0, 0, 0, false); timer.textContent = lastTimer = '00:00';
  progress.style.transform = 'scaleX(0)';
}
function turning(phase) { if (phase === 'start') ghosts.on = true; kick(); }

// the turning trail: two faded markers follow the real one with a lag (component.jpg, "Turning")
const ghosts = { on: false, a1: null, a2: null, els: [$('.marker.g1', tempEl), $('.marker.g2', tempEl)] };
function ghostFrame() {
  const a = temp.angle();
  if (ghosts.a1 === null) ghosts.a1 = ghosts.a2 = a;
  ghosts.a1 += (a - ghosts.a1) * 0.3; ghosts.a2 += (ghosts.a1 - ghosts.a2) * 0.3;
  const R = temp.markR || 140;
  ghosts.els[0].style.transform = `rotate(${ghosts.a1.toFixed(2)}deg) translateY(${-R}px)`;
  ghosts.els[1].style.transform = `rotate(${ghosts.a2.toFixed(2)}deg) translateY(${-R}px)`;
  const settled = Math.abs(a - ghosts.a2) < 0.05;
  if (!temp.turning && settled) ghosts.on = false;
  return ghosts.on;
}

// ================================================================================================================
// 3 · THE RECIPES
// ================================================================================================================
const presetEls = $$('.preset'), thumbEl = $('.presets-thumb');
function thumb(animate = true) {
  const b = presetEls.find((p) => p.dataset.recipe === state.recipe);
  if (!animate) thumbEl.style.transition = 'none';
  thumbEl.style.width = `${b.offsetWidth}px`;
  thumbEl.style.transform = `translateX(${b.offsetLeft}px)`;
  if (!animate) { thumbEl.offsetWidth; thumbEl.style.transition = ''; }
}
function choose(name, focus = false) {
  const r = RECIPES[name];
  state.recipe = name;
  for (const p of presetEls) { const on = p.dataset.recipe === name; p.setAttribute('aria-checked', on); p.tabIndex = on ? 0 : -1; if (on && focus) p.focus(); }
  thumb(true);
  temp.to(r.temp, 650); pressure.to(r.pressure, 600); grind.to(r.grind, 700);
  if (!state.shot) { previewDirty = true; clearLast(); }
  kick();
}
for (const p of presetEls) {
  p.addEventListener('click', () => choose(p.dataset.recipe));
  p.addEventListener('keydown', (e) => {
    const i = presetEls.indexOf(p), d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!d) return;
    e.preventDefault();
    choose(presetEls[(i + d + presetEls.length) % presetEls.length].dataset.recipe, true);
  });
}

// ================================================================================================================
// 4 · THE SHOT
// ================================================================================================================
let speed = 1;
function startShot() {
  const recipe = RECIPES[state.recipe], s = settings();
  const trace = simulate(s, recipe);
  state.shot = { trace, recipe, settings: s, t0: performance.now(), t: 0, ideal: simulate(recipe, recipe).end };
  hideResult();
  pull.classList.add('is-running'); pullA.textContent = 'Stop'; pull.setAttribute('aria-label', 'Stop shot');
  graph.setPreview(trace);
  say(`Pulling ${recipe.label.toLowerCase()}: ${recipe.yield} grams at ${fmtT(s.pressure)} bar.`);
  kick();
}
function shotFrame(now) {
  const sh = state.shot;
  sh.t = Math.min(sh.trace.end, ((now - sh.t0) / 1000) * speed);
  showShot(sh.trace, sh.t, true, sh.recipe.yield);
  if (sh.t >= sh.trace.end) finish(sh.trace.choked ? 'choked' : 'done');
  return !!state.shot;
}
// one moment of a shot on every readout: the graph, the cup, the timer, the numbers, the button's progress line
let lastTimer = '';
function showShot(trace, t, pouring, target) {
  const v = sampleAt(trace, t);
  graph.setLive(trace, t);
  cup.set(v.w, v.f, t, pouring && t < trace.end);
  const tm = `00:${String(Math.floor(t)).padStart(2, '0')}`;
  if (tm !== lastTimer) { lastTimer = tm; timer.textContent = tm; }
  readout(v);
  progress.style.transform = `scaleX(${clamp(v.w / target, 0, 1).toFixed(4)})`;
}
const rdP = $('.rd-p'), rdF = $('.rd-f'), rdW = $('.rd-w');
let lastRead = '';
function readout(v) {
  const k = `${v.p.toFixed(1)}|${v.f.toFixed(1)}|${v.w.toFixed(1)}`;
  if (k === lastRead) return;
  lastRead = k;
  rdP.textContent = `${v.p.toFixed(1)} bar`; rdF.textContent = `${v.f.toFixed(1)} g/s`; rdW.textContent = `${v.w.toFixed(1)} g`;
}
function finish(how) {
  const sh = state.shot; if (!sh) return;
  const v = sampleAt(sh.trace, sh.t);
  const res = verdict(sh.settings, sh.recipe, sh.t, v.w, sh.ideal, how);
  state.last = { ...res, time: sh.t, grams: v.w, recipe: state.recipe };
  state.shot = null;
  showShot(sh.trace, sh.t, false, sh.recipe.yield);
  pull.classList.remove('is-running'); pullA.textContent = 'Pull'; pull.removeAttribute('aria-label');
  result.dataset.kind = res.kind;
  $('.result-title').textContent = res.title;
  $('.result-advice').textContent = `${res.advice}${res.ratio ? ` Ratio ${res.ratio}.` : ''}`;
  result.classList.add('on');
  $('#graph-desc').textContent = `Last shot: ${res.title}. ${res.advice}`;
}
function hideResult() { result.classList.remove('on'); }
function say(text) { announce.textContent = ''; requestAnimationFrame(() => { announce.textContent = text; }); }

pull.addEventListener('click', () => (state.shot ? finish('stopped') : startShot()));
pull.addEventListener('pointerdown', () => pull.classList.add('is-pressed'));
for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) pull.addEventListener(ev, () => pull.classList.remove('is-pressed'));

// ================================================================================================================
// 5 · THE FRAME LOOP — runs while a dial glides, the trail settles or a shot pours; sleeps otherwise
// ================================================================================================================
let raf = 0;
function kick() { if (!raf) raf = requestAnimationFrame(frame); }
function frame(now) {
  raf = 0;
  let more = false;
  for (const d of dials) more = d.frame(now) || more;
  if (ghosts.on) more = ghostFrame() || more;
  if (previewDirty && !state.shot) {
    previewDirty = false;
    const tr = preview();
    graph.setPreview(tr);
    if (!state.last) { graph.setLive(null, 0); cup.set(0, 0, 0, false); }
    $('#graph-desc').textContent = `Extraction graph. These dials pull ${RECIPES[state.recipe].yield} grams in about ${Math.round(tr.end)} seconds at ${fmtT(pressure.value)} bar.`;
    chip();
  }
  if (state.shot) more = shotFrame(now) || more;
  if (more) kick();
}

// ================================================================================================================
// 6 · START, AND THE TEST HOOK
// ================================================================================================================
const ready = document.fonts.ready.then(() => { fit(); thumb(false); kick(); });
addEventListener('resize', () => { fit(); kick(); });
calm.addEventListener?.('change', () => kick());
for (const p of presetEls) p.tabIndex = p.getAttribute('aria-checked') === 'true' ? 0 : -1;

window.__brew = {
  ready,
  state: () => ({
    layout, scale, recipe: state.recipe, temp: temp.value, pressure: pressure.value, grind: grind.value,
    tempState: tempState(temp.value), predicted: Math.round(preview().end * 10) / 10,
    shot: state.shot ? { t: state.shot.t, grams: sampleAt(state.shot.trace, state.shot.t).w, end: state.shot.trace.end } : null,
    last: state.last,
  }),
  set: ({ temp: t, pressure: p, grind: g }, ms = 0) => { if (t != null) temp.to(t, ms); if (p != null) pressure.to(p, ms); if (g != null) grind.to(g, ms); kick(); },
  preset: (name) => choose(name),
  pull: () => { if (!state.shot) startShot(); },
  stop: () => { if (state.shot) finish('stopped'); },
  set speed(v) { speed = v; }, get speed() { return speed; },
  // freeze a shot at t seconds (for stills): the graph, cup and timer show that moment of the shot these dials pull
  at: (t) => {
    if (state.shot) finish('stopped');
    const recipe = RECIPES[state.recipe], trace = simulate(settings(), recipe);
    graph.setPreview(trace);
    showShot(trace, Math.min(t, trace.end), true, recipe.yield);
    state.last = { kind: 'frozen' };
    return { end: trace.end };
  },
  dials: { temp, pressure, grind },
};

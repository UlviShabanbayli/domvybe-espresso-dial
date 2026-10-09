// The extraction graph: pressure (blue) and flow (orange) against time, on dark glass.
// One canvas. The grid and the preview (the shot these dials will pull, drawn faint) are painted once into a cached
// bitmap whenever the dials change; a frame of a live shot is that bitmap plus the live curves up to the playhead,
// each curve drawn three times (a wide faint stroke, a narrower one, a bright core) for the glow — no canvas blur.
// The axis words and the playhead are HTML on top, moved with transforms.

const P_MAX = 12;            // bar at the top of the plot
const PAD_X = 22;            // left/right inset of the plot, design px

export class Graph {
  constructor(el) {
    this.el = el;
    this.canvas = el.querySelector('.graph-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.axis = el.querySelector('.graph-axis');
    this.head = el.querySelector('.playhead');
    this.headTime = el.querySelector('.ph-time');
    this.dotP = el.querySelector('.ph-p');
    this.dotF = el.querySelector('.ph-f');
    this.cache = document.createElement('canvas');
    this.preview = null; this.live = null; this.liveT = 0;
  }

  // the plot's box in design px, and the canvas's pixels for the panel's scale and the screen's density
  resize(scale) {
    const cs = getComputedStyle(this.el);
    this.w = this.el.offsetWidth; this.h = this.el.offsetHeight;
    this.top = parseFloat(cs.getPropertyValue('--plot-top')) || 50;
    this.bottom = parseFloat(cs.getPropertyValue('--plot-bottom')) || 44;
    this.k = scale * Math.min(devicePixelRatio || 1, 3);
    for (const c of [this.canvas, this.cache]) { c.width = Math.round(this.w * this.k); c.height = Math.round(this.h * this.k); }
    if (this.preview) this.setPreview(this.preview);
  }

  x(t) { return PAD_X + (t / this.end) * (this.w - PAD_X * 2); }
  yP(p) { return this.h - this.bottom - (p / P_MAX) * (this.h - this.top - this.bottom); }
  yF(f) { return this.h - this.bottom - (f / this.fMax) * (this.h - this.top - this.bottom); }

  // the shot these dials will pull: sets the time axis and paints the grid and the faint preview into the cache
  setPreview(trace) {
    this.preview = trace;
    this.end = Math.max(8, Math.ceil(trace.end));
    this.fMax = Math.max(3, Math.max(...trace.samples.map((s) => s.f)) * 1.15);
    this.#labels();
    const g = this.cache.getContext('2d'), k = this.k;
    g.setTransform(k, 0, 0, k, 0, 0);
    g.clearRect(0, 0, this.w, this.h);
    // grid: a column every 6 s, four rows
    g.lineWidth = 1; g.strokeStyle = 'rgba(255,255,255,0.1)';
    g.beginPath();
    for (let t = 0; t <= this.end + 0.01; t += 6) { const x = Math.round(this.x(t)) + 0.5; g.moveTo(x, this.top - 8); g.lineTo(x, this.h - this.bottom); }
    const x1 = Math.round(this.x(this.end)) + 0.5; g.moveTo(x1, this.top - 8); g.lineTo(x1, this.h - this.bottom);
    for (let i = 0; i <= 4; i++) { const y = Math.round(this.top + (i / 4) * (this.h - this.top - this.bottom)) + 0.5; g.moveTo(PAD_X, y); g.lineTo(this.w - PAD_X, y); }
    g.stroke();
    // the preview: thin and faint, so the live shot reads as filling it in
    g.globalAlpha = 0.3; g.lineWidth = 1.6;
    this.#curve(g, trace, this.end + 1, 'p', '#6EC3FF');
    this.#curve(g, trace, this.end + 1, 'f', '#FFB070');
    g.globalAlpha = 1;
    this.draw();
  }

  // the live shot up to time t (null clears it)
  setLive(trace, t) { this.live = trace; this.liveT = t; this.draw(); }

  draw() {
    const c = this.ctx, k = this.k;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    c.drawImage(this.cache, 0, 0);
    if (!this.live) { this.head.classList.remove('on'); return; }
    c.setTransform(k, 0, 0, k, 0, 0);
    c.lineJoin = 'round'; c.lineCap = 'round';
    const u = Math.min(1, Math.max(0.55, this.w / 700));      // the glow's width follows the graph's size
    for (const [key, color, core] of [['p', '#6EC3FF', '#D8F0FF'], ['f', '#FFB070', '#FFE6CC']]) {
      c.globalAlpha = 0.1; c.lineWidth = 10 * u; this.#curve(c, this.live, this.liveT, key, color);
      c.globalAlpha = 0.22; c.lineWidth = 5 * u; this.#curve(c, this.live, this.liveT, key, color);
      c.globalAlpha = 1; c.lineWidth = 2.4 * Math.max(0.75, u); this.#curve(c, this.live, this.liveT, key, core);
    }
    c.globalAlpha = 1;
    this.#playhead();
  }

  #curve(c, trace, upTo, key, color) {
    const s = trace.samples, y = key === 'p' ? (v) => this.yP(v) : (v) => this.yF(v);
    c.strokeStyle = color;
    c.beginPath();
    c.moveTo(this.x(0), y(s[0][key]));
    let i = 1;
    for (; i < s.length && s[i].t <= upTo; i += 2) c.lineTo(this.x(s[i].t), y(s[i][key]));
    const last = s[Math.min(i, s.length - 1)];
    if (last.t <= upTo + 0.1) c.lineTo(this.x(Math.min(last.t, upTo)), y(last[key]));
    c.stroke();
  }

  #playhead() {
    const s = this.live.samples, i = Math.min(s.length - 1, Math.max(0, Math.round(this.liveT / 0.05))), v = s[i];
    const x = this.x(Math.min(this.liveT, this.end));
    this.head.classList.add('on');
    this.head.style.transform = `translateX(${x.toFixed(2)}px)`;
    this.dotP.style.transform = `translateY(${this.yP(v.p).toFixed(2)}px)`;
    this.dotF.style.transform = `translateY(${this.yF(v.f).toFixed(2)}px)`;
    const sec = Math.floor(this.liveT);
    if (sec !== this.lastSec) {
      this.lastSec = sec;
      this.headTime.textContent = `${sec}s`;
      // hide an axis word the playhead's own time would sit on
      for (const sp of this.axis.children) sp.classList.toggle('hide', Math.abs(+sp.dataset.x - x) < 34);
    }
  }

  // the time axis: 0, every 12 s, and the end
  #labels() {
    const marks = [0];
    for (let t = 12; t < this.end * 0.9; t += 12) marks.push(t);
    marks.push(this.end);
    this.axis.innerHTML = marks.map((t, i) => {
      const x = this.x(t);
      return `<span class="${i === 0 ? 'first' : ''}" data-x="${x}" style="left:${i === 0 ? PAD_X - 4 : x}px">${t === 0 ? '0' : t + 's'}</span>`;
    }).join('');
    this.lastSec = -1;
  }
}

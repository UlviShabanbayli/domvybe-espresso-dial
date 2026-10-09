// A rotary dial that is a real slider. It owns one number and three ways to change it:
//   turn      drag anywhere on the knob and it follows your hand round (relative, like a real knob); the angle is
//             measured from the dial's centre, and a small dead zone at the centre ignores the jitter there
//   jump      press on the scale outside the knob and the value jumps to that angle, then follows the drag (absolute)
//   nudge     wheel, arrow keys (one detent), PageUp/PageDown (a big step), Home/End
// The number has detents (`step`): while you turn, the shown value is pulled softly towards the nearest detent, so
// the knob feels notched; on release it settles onto it. Preset changes glide there (`to(value)`).
// The dial does not draw itself: `draw(shown, angle)` is the owner's (app.js), called at most once a frame.

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const calm = matchMedia('(prefers-reduced-motion: reduce)');

export class Dial {
  constructor(el, { min, max, step, big, value, sweep = 270, text, draw, onInput, onCommit, faceRadius }) {
    Object.assign(this, { el, min, max, step, big, sweep, text, draw, onInput, onCommit, faceRadius });
    this.value = value;          // the committed value, always on a detent
    this.raw = value;            // where the hand is, between detents while turning
    this.shown = value;          // what is drawn (eases towards value when animating)
    this.from = value; this.t0 = 0; this.dur = 0;
    this.turning = false; this.dirty = true;
    el.setAttribute('aria-valuemin', min); el.setAttribute('aria-valuemax', max);
    this.#aria();
    this.#bind();
  }

  // the angle for a value, in degrees, 0 at twelve o'clock, clockwise; the scale runs from −sweep/2 to +sweep/2
  angle(v = this.shown) { return ((v - this.min) / (this.max - this.min) - 0.5) * this.sweep; }
  snap(v) { return clamp(Math.round((v - this.min) / this.step) * this.step + this.min, this.min, this.max); }

  // glide to a value (presets, keys, release); `ms` 0 jumps
  to(v, ms = 520) {
    v = this.snap(v);
    const changed = v !== this.value;
    this.value = this.raw = v;
    if (calm.matches || ms === 0) { this.shown = v; this.dur = 0; }
    else { this.from = this.shown; this.t0 = performance.now(); this.dur = ms; }
    this.dirty = true;
    this.#aria();
    if (changed) this.onInput?.(v);
    return changed;
  }

  // one frame: advance the glide, draw if anything moved; returns true while it still needs frames
  frame(now) {
    if (this.dur) {
      const k = clamp((now - this.t0) / this.dur, 0, 1), e = 1 - Math.pow(1 - k, 3);
      this.shown = this.from + (this.value - this.from) * e;
      if (k >= 1) { this.dur = 0; this.shown = this.value; }
      this.dirty = true;
    }
    if (this.dirty) { this.dirty = false; this.draw(this.shown, this.angle(), this); }
    return this.dur > 0;
  }

  #aria() {
    this.el.setAttribute('aria-valuenow', this.value);
    this.el.setAttribute('aria-valuetext', this.text(this.value));
  }

  // where the pointer is, from the dial's centre: its angle (0 at twelve, clockwise) and distance as a fraction of the radius
  #polar(e) {
    const r = this.el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const dx = e.clientX - cx, dy = e.clientY - cy;
    return { a: (Math.atan2(dx, -dy) * 180) / Math.PI, d: Math.hypot(dx, dy) / (r.width / 2) };
  }

  #fromAngle(a) {
    // an angle on the scale to a value; the dead band at the bottom goes to the nearer end
    const half = this.sweep / 2;
    if (a > half || a < -half) a = a > 0 ? half : -half;
    return this.min + ((a + half) / this.sweep) * (this.max - this.min);
  }

  #set(raw) {
    this.raw = clamp(raw, this.min, this.max);
    const v = this.snap(this.raw);
    // the soft detent: between notches the knob lags a little behind the hand, then catches up at the next one
    this.shown = v + (this.raw - v) * 0.35;
    this.dur = 0; this.dirty = true;
    if (v !== this.value) {
      this.value = v; this.#aria(); this.onInput?.(v);
      if (this.pointerType === 'touch') navigator.vibrate?.(3);
    }
  }

  #bind() {
    const el = this.el;
    let last = 0, id = null;
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || id !== null) return;
      id = e.pointerId; this.pointerType = e.pointerType;
      el.setPointerCapture(id);
      el.focus({ preventScroll: true });
      const p = this.#polar(e);
      last = p.a;
      this.turning = true; el.classList.add('is-turning'); this.onCommit?.('start');
      // pressed on the scale, outside the knob: jump to that angle
      if (p.d > this.faceRadius()) this.#set(this.#fromAngle(p.a));
      e.preventDefault();
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return;
      const p = this.#polar(e);
      if (p.d < 0.12) { last = p.a; return; }          // too near the centre: the angle is noise there
      let da = p.a - last; last = p.a;
      if (da > 180) da -= 360; if (da < -180) da += 360;
      this.#set(this.raw + (da / this.sweep) * (this.max - this.min));
    });
    const end = (e) => {
      if (e.pointerId !== id) return;
      id = null; this.turning = false; el.classList.remove('is-turning');
      this.to(this.value, 160);
      this.onCommit?.('end');
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);

    // the wheel: a mouse wheel's notch is one detent; a trackpad's small deltas add up to one every 40 px
    let acc = 0;
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      const dy = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY;
      let n;
      if (Math.abs(dy) >= 30) { n = Math.sign(dy); acc = 0; }
      else { acc += dy; n = Math.trunc(acc / 40); acc -= n * 40; }
      if (!n) return;
      this.to(this.value - n * this.step, 180);
      this.onCommit?.('nudge');
    }, { passive: false });

    el.addEventListener('keydown', (e) => {
      const k = e.key, s = this.step, b = this.big;
      const next = { ArrowUp: this.value + s, ArrowRight: this.value + s, ArrowDown: this.value - s, ArrowLeft: this.value - s,
        PageUp: this.value + b, PageDown: this.value - b, Home: this.min, End: this.max }[k];
      if (next === undefined) return;
      e.preventDefault();
      this.to(next, 200);
      this.onCommit?.('nudge');
    });
  }
}

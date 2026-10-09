// The cup under the spout: a glass espresso cup on a dark counter, a chrome spout above it.
// One SVG, drawn once. A frame moves five things: the coffee's level, the crema on top of it, the surface ellipse,
// the stream from the spout (its width follows the flow) and a falling drop when the flow is only a trickle.
// The scene is 320 × 204; the phone shows a crop of it around the cup (viewBox).

const NS = 'http://www.w3.org/2000/svg';
const RIM = 58, BASE = 172, TOP_L = 98, TOP_R = 202, BOT_L = 108, BOT_R = 192;   // the cup's inside, scene px
const SPOUT = 38, CX = 150;                                                        // where the stream leaves the spout
const FULL = 66;                                                                   // grams that fill the cup to the rim
const calm = matchMedia('(prefers-reduced-motion: reduce)');

const SCENE = `
<defs>
  <linearGradient id="cup-coffee" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3B1E0E"/><stop offset=".5" stop-color="#1E0D05"/><stop offset="1" stop-color="#0D0603"/></linearGradient>
  <linearGradient id="cup-crema" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E2A666"/><stop offset=".6" stop-color="#B9773C"/><stop offset="1" stop-color="#6E3A16"/></linearGradient>
  <radialGradient id="cup-top" cx=".45" cy=".4" r=".7"><stop offset="0" stop-color="#F0BE84"/><stop offset=".55" stop-color="#C98A4A"/><stop offset="1" stop-color="#8A4F22"/></radialGradient>
  <linearGradient id="cup-stream" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5A2A0E"/><stop offset=".4" stop-color="#C47C3C"/><stop offset=".6" stop-color="#E0A060"/><stop offset="1" stop-color="#5A2A0E"/></linearGradient>
  <linearGradient id="cup-chrome" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5C5C5C"/><stop offset=".3" stop-color="#F2F2F2"/><stop offset=".5" stop-color="#9C9C9C"/><stop offset=".75" stop-color="#E0E0E0"/><stop offset="1" stop-color="#4A4A4A"/></linearGradient>
  <linearGradient id="cup-glass" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".12" stop-color="#fff" stop-opacity=".05"/><stop offset=".85" stop-color="#fff" stop-opacity=".03"/><stop offset="1" stop-color="#fff" stop-opacity=".18"/></linearGradient>
  <radialGradient id="cup-shadow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#000" stop-opacity=".7"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
  <radialGradient id="cup-glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FF9A4A" stop-opacity=".22"/><stop offset="1" stop-color="#FF9A4A" stop-opacity="0"/></radialGradient>
  <clipPath id="cup-inside"><path d="M${TOP_L} ${RIM} L${TOP_R} ${RIM} L${BOT_R} ${BASE - 8} Q${BOT_R - 1} ${BASE} ${BOT_R - 9} ${BASE} L${BOT_L + 9} ${BASE} Q${BOT_L + 1} ${BASE} ${BOT_L} ${BASE - 8} Z"/></clipPath>
</defs>
<ellipse cx="${CX}" cy="${BASE + 10}" rx="74" ry="9" fill="url(#cup-shadow)"/>
<ellipse class="cup-glow" cx="${CX}" cy="${BASE - 30}" rx="90" ry="60" fill="url(#cup-glow)" opacity="0"/>
<!-- the spout: a chrome body coming down from the top, a short nozzle -->
<rect x="${CX - 13}" y="-4" width="26" height="22" rx="3" fill="url(#cup-chrome)"/>
<rect x="${CX - 16}" y="16" width="32" height="7" rx="2" fill="url(#cup-chrome)"/>
<path d="M${CX - 7} 23 L${CX + 7} 23 L${CX + 4} ${SPOUT} L${CX - 4} ${SPOUT} Z" fill="url(#cup-chrome)"/>
<!-- the back wall of the glass, the coffee, the front glass -->
<path d="M${TOP_L - 3} ${RIM - 2} L${TOP_R + 3} ${RIM - 2} L${BOT_R + 3} ${BASE - 6} Q${BOT_R + 2} ${BASE + 3} ${BOT_R - 9} ${BASE + 3} L${BOT_L + 9} ${BASE + 3} Q${BOT_L - 2} ${BASE + 3} ${BOT_L - 3} ${BASE - 6} Z" fill="rgba(255,255,255,0.04)"/>
<g clip-path="url(#cup-inside)">
  <rect class="cup-coffee" x="${TOP_L - 4}" y="${BASE}" width="${TOP_R - TOP_L + 8}" height="0" fill="url(#cup-coffee)"/>
  <rect class="cup-crema" x="${TOP_L - 4}" y="${BASE}" width="${TOP_R - TOP_L + 8}" height="0" fill="url(#cup-crema)"/>
</g>
<ellipse class="cup-surface" cx="${CX}" cy="${BASE}" rx="0" ry="5" fill="url(#cup-top)" opacity="0"/>
<rect class="cup-stream" x="${CX}" y="${SPOUT}" width="0" height="0" rx="1.2" fill="url(#cup-stream)"/>
<circle class="cup-drop" cx="${CX}" cy="${SPOUT + 4}" r="2.2" fill="#B87436" opacity="0"/>
<!-- glass: thick base, walls, rim, handle, reflections -->
<path d="M${BOT_L - 3} ${BASE - 2} Q${BOT_L - 2} ${BASE + 10} ${BOT_L + 10} ${BASE + 10} L${BOT_R - 10} ${BASE + 10} Q${BOT_R + 2} ${BASE + 10} ${BOT_R + 3} ${BASE - 2}" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.35)" stroke-width="1.2"/>
<path d="M${TOP_L - 3} ${RIM - 2} L${BOT_L - 3} ${BASE - 2} M${TOP_R + 3} ${RIM - 2} L${BOT_R + 3} ${BASE - 2}" stroke="rgba(255,255,255,0.42)" stroke-width="2" fill="none" stroke-linecap="round"/>
<path d="M${TOP_L - 3} ${RIM - 2} L${TOP_R + 3} ${RIM - 2} L${BOT_R + 3} ${BASE - 2} L${BOT_L - 3} ${BASE - 2} Z" fill="url(#cup-glass)"/>
<ellipse cx="${CX}" cy="${RIM - 2}" rx="${(TOP_R - TOP_L) / 2 + 3}" ry="6" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="1.6"/>
<path d="M${TOP_R + 1} ${RIM + 16} C${TOP_R + 34} ${RIM + 8} ${TOP_R + 40} ${RIM + 62} ${BOT_R + 4} ${RIM + 76}" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="8" stroke-linecap="round"/>
<path d="M${TOP_R + 1} ${RIM + 16} C${TOP_R + 34} ${RIM + 8} ${TOP_R + 40} ${RIM + 62} ${BOT_R + 4} ${RIM + 76}" fill="none" stroke="rgba(20,14,10,0.9)" stroke-width="4" stroke-linecap="round"/>
<path d="M${TOP_L + 6} ${RIM + 8} L${BOT_L + 5} ${BASE - 14}" stroke="rgba(255,255,255,0.5)" stroke-width="3" stroke-linecap="round"/>
<path d="M${TOP_L + 14} ${RIM + 10} L${BOT_L + 12} ${BASE - 40}" stroke="rgba(255,255,255,0.16)" stroke-width="6" stroke-linecap="round"/>
<path d="M${TOP_R - 8} ${RIM + 10} L${BOT_R - 6} ${BASE - 18}" stroke="rgba(255,255,255,0.14)" stroke-width="2" stroke-linecap="round"/>
`;

export class Cup {
  constructor(el) {
    this.el = el;
    this.svg = el.querySelector('.cup-svg');
    this.svg.innerHTML = SCENE;
    const q = (s) => this.svg.querySelector(s);
    this.coffee = q('.cup-coffee'); this.crema = q('.cup-crema'); this.surface = q('.cup-surface');
    this.stream = q('.cup-stream'); this.drop = q('.cup-drop'); this.glow = q('.cup-glow');
    this.last = '';
  }

  // the desk shows the whole scene; the phone's narrow box shows the cup and spout only
  frameFor(layout) { this.svg.setAttribute('viewBox', layout === 'phone' ? '82 0 156 196' : '22 2 282 180'); }

  // grams in the cup, the flow now (g/s), the shot's clock (s, for the stream's wobble), and whether it is pouring
  set(grams, flow, t, pouring) {
    const level = Math.min(1, grams / FULL), h = level * (BASE - RIM - 4);
    const top = BASE - h;
    const crema = Math.min(h, 2.5 + Math.min(grams, 30) * 0.42);
    // the inside narrows towards the base: the surface ellipse is as wide as the cup at its height
    const half = ((BOT_R - BOT_L) + ((TOP_R - TOP_L) - (BOT_R - BOT_L)) * ((BASE - top) / (BASE - RIM))) / 2;
    const wob = calm.matches ? 0 : Math.sin(t * 23) * 0.25 + Math.sin(t * 9.7) * 0.2;
    const w = flow > 0.04 && pouring ? Math.min(4.6, 0.8 + flow * 1.55) + wob : 0;
    const dropOn = pouring && flow > 0.002 && flow <= 0.12;
    const dropY = SPOUT + 4 + ((t * 2.4) % 1) * (top - SPOUT - 6);
    const key = `${top.toFixed(2)}|${w.toFixed(2)}|${dropOn ? dropY.toFixed(1) : ''}`;
    if (key === this.last) return;
    this.last = key;
    this.coffee.setAttribute('y', top.toFixed(2)); this.coffee.setAttribute('height', h.toFixed(2));
    this.crema.setAttribute('y', top.toFixed(2)); this.crema.setAttribute('height', crema.toFixed(2));
    this.surface.setAttribute('cy', top.toFixed(2)); this.surface.setAttribute('rx', Math.max(0, half - 1).toFixed(2));
    this.surface.setAttribute('ry', (Math.min(5.5, 1 + h * 0.4)).toFixed(2));
    this.surface.setAttribute('opacity', h > 0.5 ? '1' : '0');
    this.stream.setAttribute('x', (CX - w / 2).toFixed(2)); this.stream.setAttribute('width', Math.max(0, w).toFixed(2));
    this.stream.setAttribute('height', w > 0 ? (top - SPOUT + 2).toFixed(2) : '0');
    this.drop.setAttribute('opacity', dropOn ? '1' : '0');
    if (dropOn) this.drop.setAttribute('cy', dropY.toFixed(1));
    this.glow.setAttribute('opacity', (level * 1.6).toFixed(2));
  }
}

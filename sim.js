// The extraction model — a small, deterministic physics sketch of one espresso shot, in plain numbers.
// No DOM here: app.js asks for a whole shot up front (a trace) and plays it back, so the graph's preview, the live
// curves, the cup, the timer and the verdict all read the same samples. Change a dial and the preview is re-run.
//
// What it models (simple, but each effect points the right way):
//   pump      a soft pre-infusion through 3 bar, a ramp to the set pressure, a lever-style decline as the cup fills
//   puck      grind sets its resistance (finer = slower); it saturates before the first drop, then slowly erodes
//   water     hotter water is a little thinner and flows a touch faster
//   verdict   time against the recipe's time, and temperature against its temperature → sour, balanced or bitter

export const DOSE = 18;           // grams of ground coffee in the basket, the same for every recipe
export const DT = 0.05;           // seconds per sample
export const MAX_TIME = 60;       // a choked shot is cut off here

// the three recipes the preset buttons load (their dials, and the cup they aim for)
export const RECIPES = {
  ristretto: { label: 'Ristretto', temp: 92, pressure: 9, grind: 10, yield: 20, time: 18, pre: 1.5 },
  espresso:  { label: 'Espresso',  temp: 93, pressure: 9, grind: 14, yield: 36, time: 28, pre: 4 },
  lungo:     { label: 'Lungo',     temp: 94, pressure: 8, grind: 18, yield: 60, time: 40, pre: 5 },
};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// the puck's resistance for a grind setting (1 = powder, 30 = coarse): every step finer adds ~6 %
const resistance = (grind) => 6.1 * Math.exp(0.05 * (14 - grind));

// one shot, sample by sample: { t, p (bar), f (g/s into the cup), w (g in the cup) }[] plus how it ended
export function simulate({ temp, pressure, grind }, recipe) {
  const R0 = resistance(grind), soak = 7 * Math.pow(R0 / 6.1, 0.35);
  const thin = 1 + (temp - 93) * 0.012;
  const s = [{ t: 0, p: 0, f: 0, w: 0 }];
  let t = 0, p = 0, f = 0, w = 0, wet = 0, first = null;
  while (t < MAX_TIME) {
    t += DT;
    // the pump: a soft rise through 3 bar of pre-infusion (as long as the recipe asks), up to the set pressure, then a
    // gentle decline over the second half of the cup (the classic lever profile)
    const pre = recipe.pre;
    const target = 3 * smooth(0, pre + 0.6, t) + (pressure - 3) * smooth(pre * 0.6, pre + 3.5, t);
    const pump = target * (1 - 0.3 * smooth(0.5, 1, w / recipe.yield));
    p += (pump - p) * (DT / 0.35);
    // the puck soaks up water first; the first drop falls when it is wet through
    if (wet < 1) { wet += (p * DT) / soak; if (wet >= 1) first = t; }
    const erode = 1 - 0.3 * smooth(first ?? t, (first ?? t) + 22, t);
    const want = wet >= 1 ? (p / (R0 * erode)) * thin : 0;
    f += (want - f) * (DT / 0.9);
    w += f * DT;
    s.push({ t: +t.toFixed(3), p, f, w });
    if (w >= recipe.yield) break;
  }
  const last = s[s.length - 1];
  return { samples: s, end: last.t, yield: Math.min(last.w, recipe.yield), firstDrop: first, choked: last.w < recipe.yield };
}

// the sample at time t (linear between neighbours), for the playhead
export function sampleAt(trace, t) {
  const s = trace.samples, i = clamp(Math.floor(t / DT), 0, s.length - 1), a = s[i], b = s[Math.min(i + 1, s.length - 1)];
  const k = clamp((t - a.t) / DT, 0, 1);
  return { t, p: a.p + (b.p - a.p) * k, f: a.f + (b.f - a.f) * k, w: a.w + (b.w - a.w) * k };
}

// how the cup will taste: + is over-extracted (bitter), − is under-extracted (sour). `ideal` is how long this recipe
// runs on its own dials (simulate(recipe, recipe).end): faster than that = too coarse, slower = too fine.
// The advice names the dial that is furthest off: temperature, pressure (2 bar or more away), else the grind.
export function verdict({ temp, pressure }, recipe, time, grams, ideal = recipe.time, how = 'done') {
  const head = `${Math.round(grams)} g in ${Math.round(time)} s`;
  const ratio = `1:${(grams / DOSE).toFixed(1)}`;
  if (how === 'stopped') return { kind: 'stopped', score: 0, ratio, title: `${head} · stopped`, advice: 'Stopped by hand. Pull again for the full cup.' };
  if (how === 'choked') return { kind: 'over', score: 9, ratio, title: `${head} · choked`, advice: 'The puck choked. Grind much coarser.' };
  const timeScore = (time - ideal) / (ideal * 0.16);
  const tempScore = (temp - recipe.temp) / 2.5;
  const score = timeScore + tempScore;
  const off = pressure - recipe.pressure;
  const by = Math.abs(tempScore) > Math.abs(timeScore) ? 'temp' : Math.abs(off) >= 2 && Math.sign(off) === -Math.sign(timeScore) ? 'pressure' : 'grind';
  if (score > 1) return { kind: 'over', score, ratio, title: `${head} · over-extracted`,
    advice: 'Bitter and dry. ' + { temp: 'Lower the temperature.', pressure: 'Raise the pressure.', grind: 'Grind coarser.' }[by] };
  if (score < -1) return { kind: 'under', score, ratio, title: `${head} · under-extracted`,
    advice: 'Sour and thin. ' + { temp: 'Raise the temperature.', pressure: 'Lower the pressure.', grind: 'Grind finer.' }[by] };
  return { kind: 'balanced', score, ratio, title: `${head} · balanced`, advice: 'Sweet and syrupy. Keep this recipe.' };
}

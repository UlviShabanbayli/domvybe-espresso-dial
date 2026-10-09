# Espresso machine controls — UI component

**[Live demo](https://domvybe.com/components/espresso-dial/)** · [Step-by-step tutorial](https://domvybe.com/library/espresso-dial/) · [Download the ZIP](https://github.com/UlviShabanbayli/domvybe-espresso-dial/releases/latest/download/espresso-dial-source.zip)

An espresso machine panel: turn real rotary dials for temperature, pressure and grind, pick a recipe, pull the shot and watch the pressure graph draw as the cup fills, with a verdict at the end.

Open `index.html` through any local static server (for example `python3 -m http.server`) and try it with a mouse,
a finger or the keyboard. Plain HTML, CSS and JavaScript; no build step, no libraries.

- `index.html` — the component and its stage
- `style.css` — the look (colours are variables at the top)
- `dial.js` — a rotary dial that is a real slider: drag round it, tap the scale, the wheel and the keys
- `sim.js` — the shot model: pre-infusion, pressure, flow, the puck and the verdict
- `graph.js` — the extraction graph: pressure and flow drawn live on one canvas
- `cup.js` — the glass cup and the spout in SVG: the stream, the crema and the level
- `app.js` — the panel: fit and scale, the dials' drawing, the temperature states, the recipes and the shot

BREWL is a made-up machine. The shot is a model, not a measurement: the grind, pressure and temperature decide the
flow, the time and the verdict; the three recipes (temperature, pressure, grind, yield) are `RECIPES` in `sim.js`.

It respects `prefers-reduced-motion`. Made by Ulvi (Code with Ulvi) · domvybe.com

## Licence

MIT — see [LICENSE](LICENSE). Use it in your own projects, commercial ones included.

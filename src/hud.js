const $ = (id) => document.getElementById(id);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const NS = 'http://www.w3.org/2000/svg';
const el = (name, attrs = {}) => { const n = document.createElementNS(NS, name); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); return n; };

// A power-up icon from its module: colour circle plus glyph path or label. Built with DOM calls, never innerHTML.
export function pickupIcon(def) {
  const svg = el('svg', { viewBox: '0 0 28 28' });
  svg.append(el('circle', { cx: 14, cy: 14, r: 14, fill: def.color }));
  if (def.glyph) svg.append(el('path', def.stroke ? { d: def.glyph, fill: 'none', stroke: '#fff', 'stroke-width': 3.6 } : { d: def.glyph, fill: '#fff' }));
  else if (def.label) { const t = el('text', { x: 14, y: 19, 'text-anchor': 'middle', fill: '#fff', 'font-size': 14, 'font-weight': 900 }); t.textContent = def.label; svg.append(t); }
  return svg;
}

// A pickup's display name: the module's `name`, or the last part of its id in capitals.
export const pickupName = (def) => def.name ?? def.id.replace(/^.*\//, '').toUpperCase();

export function createHud() {
  let onPause = () => {};
  let paused = false, toastT = 0;
  $('pause').onclick = () => onPause();
  $('overlay').onclick = () => paused && onPause();
  const chips = $('powerups');

  return {
    show(on) {
      $('hud').hidden = !on;
      if (!on) { chips.replaceChildren(); chips.dataset.key = ''; clearTimeout(toastT); $('card').hidden = true; $('card').replaceChildren(); }
    },
    // Two seconds of icon, name and blurb at the bottom of the screen; a new pickup replaces it. Community strings: textContent only.
    toast(def) {
      const c = $('card'), t = document.createElement('div'), words = document.createElement('div');
      t.className = 'toast';
      words.append(Object.assign(document.createElement('b'), { textContent: pickupName(def) }));
      if (def.blurb) words.append(Object.assign(document.createElement('small'), { textContent: def.blurb }));
      t.append(pickupIcon(def), words);
      c.replaceChildren(t); c.hidden = false;
      clearTimeout(toastT);
      toastT = setTimeout(() => { c.hidden = true; c.replaceChildren(); }, 2000);
    },
    onPause(fn) { onPause = fn; },
    update(run, level, registry) {
      $('jugs').textContent = run.jugs;
      $('progress').hidden = level.length_m === null;
      if (level.length_m) $('progress').firstElementChild.style.width = `${Math.min(100, (run.z / level.length_m) * 100)}%`;
      const key = Object.keys(run.effects).join(',');
      if (key !== chips.dataset.key) {
        chips.dataset.key = key;
        chips.replaceChildren(...Object.keys(run.effects).map((id) => {
          const c = document.createElement('div'); c.className = 'chip'; c.dataset.id = id;
          c.append(pickupIcon(registry.pickup[id]), Object.assign(document.createElement('span'), { className: 'secs' }));
          return c;
        }));
      }
      for (const c of chips.children) { const e = run.effects[c.dataset.id]; c.lastElementChild.textContent = e && Number.isFinite(e.t) ? Math.ceil(e.t) : ''; }
    },
    setPaused(on) { paused = on; $('overlay').textContent = on ? 'Paused · tap or press Esc' : ''; $('overlay').hidden = !on; },
    flash() { const h = $('hud'); h.classList.remove('hit'); void h.offsetWidth; h.classList.add('hit'); },
    async ring() { const r = $('ring'); r.classList.remove('go'); void r.offsetWidth; r.classList.add('go'); await wait(600); },
    async banner(text, ms = 1200) { const o = $('overlay'); o.textContent = text; o.hidden = false; await wait(ms); o.hidden = true; },
    async card(text, ms = 3000, sub = '') {
      const c = $('card');
      const b = document.createElement('div'); b.className = 'banner'; b.textContent = text;
      if (sub) { const s = document.createElement('small'); s.textContent = sub; b.append(s); }
      c.replaceChildren(b); c.hidden = false; await wait(ms); c.hidden = true; c.replaceChildren();
    },
  };
}

import * as THREE from 'three';
import * as gfx from './gfx.js';
import { generate, normalizeLevel, rng, sectionAt } from './generator.js';
import { laneX, obstacleBox, updateObstacle, reach } from './rules.js';
import { safeCall } from './registry.js';

const CHUNK = 120;  // metres built at a time (a multiple of ROW_GAP)
const AHEAD = 200;  // keep this much street built ahead of the player
const BEHIND = 15;  // drop things this far behind
export const ROAD_HALF = 4.5;

// The default street: road, sidewalks, lane dashes and plain toon blocks. A theme may replace it with createChunk.
export function defaultChunk(g, { z0, length, lanes, rng: r, theme }) {
  const grp = g.group(g.box(ROAD_HALF * 2, 0.1, length, g.palette.road, 0, -0.05, z0 + length / 2));
  for (const side of [-1, 1]) grp.add(g.box(3, 0.25, length, g.palette.sidewalk, side * (ROAD_HALF + 1.5), 0.125, z0 + length / 2));
  for (let z = z0; z < z0 + length; z += 6) for (const x of [lanes.width / 2, -lanes.width / 2]) grp.add(g.box(0.12, 0.02, 3, g.palette.lane, x, 0.01, z + 1.5));
  const b = theme.buildings;
  for (const side of [-1, 1]) for (let z = z0; z < z0 + length;) {
    // The last block stops at the chunk end: a block running past the seam overlapped the next chunk's first block and the
    // shared faces z-fought as the camera moved (the "brown band" flicker). A remainder under 3 m is left empty.
    const depth = Math.min(8 + r() * 6, z0 + length - z), h = b.minH + r() * (b.maxH - b.minH);
    if (depth < 3) break;
    grp.add(g.box(10, h, depth - 0.5, b.colors[Math.floor(r() * b.colors.length)], side * (ROAD_HALF + 8), h / 2, z + depth / 2));
    z += depth;
  }
  return grp;
}

export function createWorld(scene, level, { registry, rules, seed, end }) {
  const norm = normalizeLevel(level);
  const r = rng(seed), rs = rng(seed ^ 0x9e3779b9); // scenery has its own rng so it never shifts the street
  const root = new THREE.Group();
  scene.add(root);
  const live = { obstacles: [], pickups: [] };
  const chunks = [];
  const lanes = { count: 3, width: rules.laneWidth, roadHalf: ROAD_HALF };
  let builtTo = 0;
  const drop = (obj) => { root.remove(obj); gfx.dispose(obj); };
  const dropView = (item, label) => { if (item.view.dispose) safeCall(`${label} ${item.id} dispose`, () => item.view.dispose()); drop(item.view.object); };
  const fallbackView = () => ({ object: gfx.box(1, 1, 1, '#ff00ff') }); // a loud pink block instead of a crash

  function build() {
    const length = Math.min(CHUNK, end - builtTo); // the last chunk stops exactly at `end`, so no street runs past the finish line
    const { obstacles, pickups } = generate(norm, r, builtTo, builtTo + length, registry, rules);
    for (const o of obstacles) {
      o.def = registry.obstacle[o.id];
      o.view = safeCall(`obstacle ${o.id} createView`, () => o.def.createView(gfx, o), null) ?? fallbackView();
      o.view.object.position.set(laneX(o.lane, rules), 0, o.z);
      root.add(o.view.object);
      live.obstacles.push(o);
    }
    for (const p of pickups) {
      p.def = registry.pickup[p.id];
      p.view = safeCall(`pickup ${p.id} createView`, () => (p.def.createView ? p.def.createView(gfx) : { object: gfx.orb(p.def) }), null) ?? fallbackView();
      p.view.object.position.set(laneX(p.lane, rules), 0, p.z);
      root.add(p.view.object);
      live.pickups.push(p);
    }
    const section = sectionAt(norm, builtTo);
    const themeDef = registry.theme[section.theme.id];
    const theme = { ...themeDef, ...section.theme };
    const args = { z0: builtTo, length, lanes, rng: rs, theme };
    const g = safeCall(`theme ${theme.id} createChunk`, () => (themeDef.createChunk ? themeDef.createChunk(gfx, args) : defaultChunk(gfx, args)), null) ?? new THREE.Group();
    root.add(g);
    chunks.push({ z: builtTo, g });
    builtTo += length;
  }

  function update(run, dt) {
    while (builtTo < Math.min(end, run.z + AHEAD)) build();
    const behind = run.z - BEHIND;
    for (const list of [live.obstacles, live.pickups]) {
      for (let i = list.length - 1; i >= 0; i--) if (list[i].z < behind) { dropView(list[i], list === live.obstacles ? 'obstacle' : 'pickup'); list.splice(i, 1); }
    }
    while (chunks.length && chunks[0].z + CHUNK < behind) drop(chunks.shift().g);
    for (const o of live.obstacles) {
      updateObstacle(o, o.def, run, dt);
      if (o.x !== undefined) o.view.object.position.x = o.x;
      const active = obstacleBox(o, o.def, run.time, rules) !== null;
      if (o.view.update) safeCall(`obstacle ${o.id} update`, () => o.view.update(o, run, dt, active));
    }
    const pull = reach(run);
    for (const p of live.pickups) {
      p.view.object.rotation.y = run.time * 3;
      if (pull > 0 && p.z - run.z < pull) p.view.object.position.x += (run.x - p.view.object.position.x) * 0.2;
      if (p.view.update) safeCall(`pickup ${p.id} update`, () => p.view.update(p, run, dt));
    }
  }

  const skyAt = (z) => {
    const s = sectionAt(norm, z), t = registry.theme[s.theme.id];
    return { sky: s.theme.sky ?? t.sky, fog: s.theme.fog ?? t.fog };
  };
  function removePickup(p) { live.pickups.splice(live.pickups.indexOf(p), 1); dropView(p, 'pickup'); }
  function dispose() {
    for (const o of live.obstacles) if (o.view.dispose) safeCall(`obstacle ${o.id} dispose`, () => o.view.dispose());
    for (const p of live.pickups) if (p.view.dispose) safeCall(`pickup ${p.id} dispose`, () => p.view.dispose());
    scene.remove(root); gfx.dispose(root);
  }

  return { live, update, removePickup, skyAt, dispose };
}

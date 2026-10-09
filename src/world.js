import * as THREE from 'three';
import * as gfx from './gfx.js';
import { generate, normalizeLevel, rng, sectionAt, curveSegments, cameraAt } from './generator.js';
import { laneX, obstacleBox, updateObstacle, pull } from './rules.js';
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

export function createWorld(scene, level, { registry, rules, seed, end, speedFrom = rules.speed.start }) {
  const norm = normalizeLevel(level);
  const r = rng(seed), rs = rng(seed ^ 0x9e3779b9); // scenery has its own rng so it never shifts the street
  const gen = { lastRow: -Infinity, speedFrom, propEnd: -Infinity }; // the generator's memory across chunks
  const root = new THREE.Group();
  scene.add(root);
  const live = { obstacles: [], pickups: [], props: [] };
  const chunks = [];
  const lanes = { count: 3, width: rules.laneWidth, roadHalf: ROAD_HALF };
  let builtTo = 0;
  const drop = (obj) => { root.remove(obj); gfx.dispose(obj); };
  const dropView = (item, label) => { if (item.view.dispose) safeCall(`${label} ${item.id} dispose`, () => item.view.dispose()); drop(item.view.object); };
  const fallbackView = () => ({ object: gfx.box(1, 1, 1, '#ff00ff') }); // a loud pink block instead of a crash

  function build() {
    const length = Math.min(CHUNK, end - builtTo); // the last chunk stops exactly at `end`, so no street runs past the finish line
    const { obstacles, pickups, props } = generate(norm, r, builtTo, builtTo + length, registry, rules, gen);
    for (const o of obstacles) {
      o.def = registry.obstacle[o.id];
      o.view = safeCall(`obstacle ${o.id} createView`, () => o.def.createView(gfx, o), null) ?? fallbackView();
      o.view.object.position.set(laneX(o.lane, rules), 0, o.z);
      root.add(gfx.bend(o.view.object));
      live.obstacles.push(o);
    }
    for (const p of pickups) {
      p.def = registry.pickup[p.id];
      p.view = safeCall(`pickup ${p.id} createView`, () => (p.def.createView ? p.def.createView(gfx) : { object: gfx.orb(p.def) }), null) ?? fallbackView();
      p.view.object.position.set(laneX(p.lane, rules), 0, p.z);
      root.add(gfx.bend(p.view.object));
      live.pickups.push(p);
    }
    for (const p of props) {
      p.def = registry.prop[p.id];
      p.view = safeCall(`prop ${p.id} createView`, () => p.def.createView(gfx, { z: p.z, length: p.length, lanes }), null) ?? fallbackView();
      p.view.object.position.set(0, 0, p.z);
      root.add(gfx.bend(p.view.object));
      live.props.push(p);
    }
    const section = sectionAt(norm, builtTo);
    const themeDef = registry.theme[section.theme.id];
    const theme = { ...themeDef, ...section.theme };
    const args = { z0: builtTo, length, lanes, rng: rs, theme };
    const g = safeCall(`theme ${theme.id} createChunk`, () => (themeDef.createChunk ? themeDef.createChunk(gfx, args) : defaultChunk(gfx, args)), null) ?? new THREE.Group();
    root.add(gfx.bend(g));
    chunks.push({ z: builtTo, g });
    builtTo += length;
  }

  function update(run, dt) {
    while (builtTo < Math.min(end, run.z + AHEAD)) build();
    const behind = run.z - BEHIND;
    for (const list of [live.obstacles, live.pickups, live.props]) { // a prop stays until its far end is behind
      for (let i = list.length - 1; i >= 0; i--) if (list[i].z + (list[i].length ?? 0) < behind) { dropView(list[i], list === live.obstacles ? 'obstacle' : list === live.pickups ? 'pickup' : 'prop'); list.splice(i, 1); }
    }
    while (chunks.length && chunks[0].z + CHUNK < behind) drop(chunks.shift().g);
    for (const o of live.obstacles) {
      updateObstacle(o, o.def, run, dt);
      if (o.x !== undefined) o.view.object.position.x = o.x;
      const active = obstacleBox(o, o.def, run.time, rules) !== null;
      if (o.view.update) safeCall(`obstacle ${o.id} update`, () => o.view.update(o, run, dt, active));
    }
    for (const p of live.pickups) {
      p.view.object.rotation.y = run.time * 3;
      pull(run, p, dt);
      if (p.x !== undefined) p.view.object.position.set(p.x, 0, p.z);
      if (p.view.update) safeCall(`pickup ${p.id} update`, () => p.view.update(p, run, dt));
    }
    for (const p of live.props) if (p.view.update) safeCall(`prop ${p.id} update`, () => p.view.update(p, run, dt));
    gfx.setBend({ origin: run.z, segments: curveSegments(norm, run.z, builtTo, seed) }); // every stretch the built street lies in, so nothing pops when it enters view; nothing eases, the street is the anchor
  }

  const skyAt = (z) => {
    const s = sectionAt(norm, z), t = registry.theme[s.theme.id];
    return { sky: s.theme.sky ?? t.sky, fog: s.theme.fog ?? t.fog };
  };
  function removePickup(p) { live.pickups.splice(live.pickups.indexOf(p), 1); dropView(p, 'pickup'); }
  function dispose() {
    gfx.setBend();
    for (const o of live.obstacles) if (o.view.dispose) safeCall(`obstacle ${o.id} dispose`, () => o.view.dispose());
    for (const p of live.pickups) if (p.view.dispose) safeCall(`pickup ${p.id} dispose`, () => p.view.dispose());
    for (const p of live.props) if (p.view.dispose) safeCall(`prop ${p.id} dispose`, () => p.view.dispose());
    scene.remove(root); gfx.dispose(root);
  }

  return { live, update, removePickup, skyAt, cameraAt: (z) => cameraAt(norm, z), dispose };
}

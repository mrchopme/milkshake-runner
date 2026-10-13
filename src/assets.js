import { TextureLoader, SRGBColorSpace } from 'three';

// Files a content or pack module lists in `assets`, loaded once before play so views stay synchronous (spec §3).
// Every node of a loaded scene is flagged userData.shared: every copy uses its geometry and materials, so gfx.dispose
// leaves them alone. Skinned scenes (sub-project 3) will need SkeletonUtils.clone instead of clone().
const cache = new Map(); // path under public/ -> loaded scene or texture

const share = (o) => { if (o) o.userData.shared = true; };
// Flags every node and every part a copy shares (geometry, materials, their textures), so gfx.dispose leaves them alone
// even when a module rebuilds them into its own meshes (an InstancedMesh over a model's geometry).
export function adopt(path, value) {
  if (value.isTexture) share(value);
  else value.traverse((n) => {
    share(n); share(n.geometry);
    for (const m of [].concat(n.material ?? [])) { share(m); for (const v of Object.values(m)) if (v?.isTexture) share(v); }
  });
  cache.set(path, value);
}

let gltf; // one loader, built on first use, so Node tests and low-fi sessions never load it
async function loadGlb(url) {
  if (!gltf) {
    const [{ GLTFLoader }, { MeshoptDecoder }] = await Promise.all([import('three/addons/loaders/GLTFLoader.js'), import('three/addons/libs/meshopt_decoder.module.js')]);
    gltf = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  }
  return (await gltf.loadAsync(url)).scene;
}

let images;
async function loadImage(url) {
  images ??= new TextureLoader();
  const t = await images.loadAsync(url);
  t.colorSpace = SRGBColorSpace;
  return t;
}
// import.meta.env exists only under Vite, so it is read only when a file loads (Node tests always pass a loader).
const load = (p) => (/\.(?:webp|png)$/.test(p) ? loadImage : loadGlb)(`${import.meta.env.BASE_URL}${p}`);

// Never rejects: a file that fails is reported and left out, so the module that needs it falls back to the pink block.
export async function preload(paths, loader = load) {
  await Promise.all([...new Set(paths)].filter((p) => !cache.has(p)).map(async (p) => {
    try { adopt(p, await loader(p)); } catch (err) { console.warn(`asset ${p} failed to load:`, err); }
  }));
}

// Every file a level needs, from what its JSON names (round 2 spec §7): section themes, obstacles, power-ups and the default
// jug, props, placements, its character and its ending, and the files of any next level its ending declares (a `level` param),
// so a transition carries on without a load. Pure, so Node tests it; the generator only ever draws from these lists.
export function levelAssets(level, registry, levels = {}) {
  const ids = { theme: new Set(), obstacle: new Set(), pickup: new Set(['jug']), prop: new Set(), character: new Set([level.character?.id ?? 'milkshake']), ending: new Set([level.ending?.id ?? 'finish']) };
  for (const s of [level, ...(level.sections ?? [])]) {
    if (s.theme?.id) ids.theme.add(s.theme.id);
    for (const id of Object.keys(s.obstacles ?? {})) ids.obstacle.add(id);
    for (const id of s.jugs?.powerups ?? []) ids.pickup.add(id);
    for (const id of Object.keys(s.props?.ids ?? {})) ids.prop.add(id);
    for (const p of s.placements ?? []) ids[p.kind]?.add(p.id);
  }
  const own = Object.entries(ids).flatMap(([kind, set]) => [...set].flatMap((id) => registry[kind]?.[id]?.assets ?? []));
  const ending = registry.ending?.[level.ending?.id ?? 'finish'];
  const next = Object.entries(ending?.params ?? {}).filter(([, s]) => s.type === 'level').map(([k, s]) => levels[level.ending?.params?.[k] ?? s.default]);
  return [...new Set([...own, ...next.flatMap((l) => (l ? levelAssets(l, registry) : []))])]; // one step ahead, so a loop of levels stops
}

// A level's start waits on its files. A start during the menu's own load waits for it, then loads its own; a second start
// while one is pending is dropped (a double click on LOADING…), as is a second menu load. `busy` hears LOADING… on and off.
export function gateLoads(load = preload, busy = () => {}) {
  let menuLoad = null, starting = false;
  const settle = () => { if (!menuLoad && !starting) busy(false); };
  return async (paths, { start = true } = {}) => {
    if (starting || (!start && menuLoad)) return false;
    busy(true);
    if (!start) {
      menuLoad = load(paths);
      try { await menuLoad; return true; } finally { menuLoad = null; settle(); }
    }
    starting = true;
    try { if (menuLoad) await menuLoad; await load(paths); return true; } finally { starting = false; settle(); }
  };
}

export function asset(path) {
  const scene = cache.get(path);
  if (scene?.isTexture) throw new Error(`asset "${path}" is an image: use gfx.texture`);
  if (!scene) throw new Error(`asset "${path}" is not loaded: list it in the module's assets`);
  return scene.clone(); // shares geometry and materials; userData (the shared flag) is copied
}

// A preloaded image: one texture every user shares (the caller may set wrap and repeat once, for everyone).
export function texture(path) {
  const t = cache.get(path);
  if (!t?.isTexture) throw new Error(`texture "${path}" is not loaded: list it in the module's assets`);
  return t;
}

// Frees every cached file not in `keep` (the next level's set), so GPU memory follows the level. Call it only after the
// previous world is disposed: nothing still drawn may use a freed file.
export function release(keep) {
  const k = new Set(keep);
  for (const [path, v] of cache) {
    if (k.has(path)) continue;
    cache.delete(path);
    if (v.isTexture) { v.dispose(); continue; }
    v.traverse((n) => {
      n.geometry?.dispose();
      for (const m of [].concat(n.material ?? [])) { for (const x of Object.values(m)) if (x?.isTexture) x.dispose(); m.dispose(); }
    });
  }
}

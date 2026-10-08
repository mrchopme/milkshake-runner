// Files a content or pack module lists in `assets`, loaded once before play so views stay synchronous (spec §3).
// Every node of a loaded scene is flagged userData.shared: every copy uses its geometry and materials, so gfx.dispose
// leaves them alone. Skinned scenes (sub-project 3) will need SkeletonUtils.clone instead of clone().
const cache = new Map(); // path under public/ -> loaded scene

export function adopt(path, scene) {
  scene.traverse((n) => { n.userData.shared = true; });
  cache.set(path, scene);
}

let gltf; // one loader, built on first use, so Node tests and low-fi sessions never load it
async function loadGlb(url) {
  if (!gltf) {
    const [{ GLTFLoader }, { MeshoptDecoder }] = await Promise.all([import('three/addons/loaders/GLTFLoader.js'), import('three/addons/libs/meshopt_decoder.module.js')]);
    gltf = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  }
  return (await gltf.loadAsync(url)).scene;
}

// Never rejects: a file that fails is reported and left out, so the module that needs it falls back to the pink block.
export async function preload(paths, load = (p) => loadGlb(`${import.meta.env.BASE_URL}${p}`)) {
  await Promise.all([...new Set(paths)].filter((p) => !cache.has(p)).map(async (p) => {
    try { adopt(p, await load(p)); } catch (err) { console.warn(`asset ${p} failed to load:`, err); }
  }));
}

export function asset(path) {
  const scene = cache.get(path);
  if (!scene) throw new Error(`asset "${path}" is not loaded: list it in the module's assets`);
  return scene.clone(); // shares geometry and materials; userData (the shared flag) is copied
}

// Knobs for skinning the Tripo mesh, in the GLB's own frame: y from -0.5 to 0.5 is 0 to 1.9 m, +x is the muzzle, z is left-right.
// Measured on 2026-10-08 (v4 spec §3); if the GLB is ever regenerated, measure again.
export const SKIN = {
  crotch: -0.445, crotchBand: 0.03,   // the legs are separate below this height; the band blends them into the hips
  armZ: 0.165, armBand: 0.03,         // the arm nubs sit outboard of the flank from here; the band blends the shoulder in
  shoulder: 0.06, shoulderBand: 0.07, // arm weight fades out above this height
  neck: 0.19, neckBand: 0.08,         // head weight fades in above this height
};
const BONES = { hips: [-0.02, -0.4, 0], head: [-0.05, 0.22, 0], armL: [-0.04, 0.07, 0.16], armR: [-0.04, 0.07, -0.16], legL: [-0.04, SKIN.crotch, 0.1], legR: [-0.04, SKIN.crotch, -0.1] };
const LEG_SWING = 0.7, ARM_SWING = 0.7, HEAD_SWING = 0.08; // radians at the stride's peak; tuned in the manual pass

// Weights for a vertex at height y and side z: [hips, head, armL, armR, legL, legR], summing to 1. Pure, so Node can test it.
export function skinWeights(y, z, K = SKIN) {
  const sm = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  const leg = 1 - sm(K.crotch - K.crotchBand / 2, K.crotch + K.crotchBand / 2, y), left = sm(-0.02, 0.02, z);
  const arm = sm(K.armZ, K.armZ + K.armBand, Math.abs(z)) * (1 - sm(K.shoulder, K.shoulder + K.shoulderBand, y)) * (1 - leg);
  const w = [0, sm(K.neck, K.neck + K.neckBand, y), z > 0 ? arm : 0, z > 0 ? 0 : arm, leg * left, leg * (1 - left)];
  w[0] = Math.max(0, 1 - w[1] - w[2] - w[3] - w[4] - w[5]);
  const sum = w.reduce((s, v) => s + v, 0);
  return w.map((v) => v / sum);
}

export default {
  kind: 'character', id: 'milkshake', height: 1.9, width: 1.0, model: 'milkshake.glb', yaw: -Math.PI / 2,

  async createView(gfx) {
    const P = gfx.palette;
    const root = gfx.group(gfx.blobShadow(0.55));
    const shadow = root.children[0];
    const body = gfx.group();
    root.add(body);
    let model, arms = [], legs = [], head = null, limbAxis = 'x';
    try {
      const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
      const gltf = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}${this.model}`);
      ({ model, arms, legs, head, limbAxis } = fitModel(gfx.three, gltf.scene, this)); // one assignment: a model that breaks half way leaves nothing behind
    } catch {
      ({ model, arms, legs } = shapeCow(gfx)); // no GLB yet, or a bad one: the shape-built cow
    }
    body.add(model);

    // Dust: six puffs pooled under the hooves, one per footfall while on the ground. They hold their place on the road as Milkshake runs on, changes lane or jumps.
    const puffs = gfx.group();
    root.add(puffs);
    const pool = Array.from({ length: 6 }, () => {
      const m = new gfx.three.Mesh(new gfx.three.SphereGeometry(0.18, 8, 6), new gfx.three.MeshBasicMaterial({ color: P.spot, transparent: true, opacity: 0.5, depthWrite: false }));
      m.visible = false; puffs.add(m); return m;
    });
    let lastStride = 0, nextPuff = 0;

    const BASE = 12; // m/s the v1 stride was tuned at
    const pose = (time, { sliding = false, over = false, lean = 0, airborne = false, speed = BASE } = {}) => {
      const k = speed / BASE;                                       // 1 at the old pace, 2 at 24 m/s
      const stride = airborne || sliding || over ? 0 : Math.sin(time * 14 * k);
      body.position.y = Math.abs(stride) * Math.min(0.14, 0.08 * k);
      body.scale.y = sliding ? 0.5 : 1;
      body.rotation.z = lean + stride * 0.03 * Math.max(0, k - 1);  // a little roll per stride once it is running hard
      body.rotation.x = over ? 0.9 : sliding ? -0.3 : Math.max(0, 0.1 * (k - 1)); // forward lean grows with speed
      legs.forEach((l, i) => (l.rotation[limbAxis] = stride * LEG_SWING * (i ? 1 : -1)));
      arms.forEach((a, i) => (a.rotation[limbAxis] = stride * ARM_SWING * (i ? -1 : 1)));
      if (head) head.rotation.z = -HEAD_SWING * stride;             // a counter-nod against the stride
      return stride;
    };
    return {
      object: root,
      pose,
      update(run) {
        root.position.set(run.x, run.y, run.z);
        shadow.position.y = -run.y + 0.01; // the shadow stays on the road while Milkshake jumps
        const stride = pose(run.time, { sliding: run.slideT > 0, over: run.over, lean: ((1 - run.lane) * run.rules.laneWidth - run.x) * 0.12, airborne: run.y > 0, speed: run.speed ?? BASE });
        if (run.y === 0 && run.slideT === 0 && !run.over && stride !== 0 && Math.sign(stride) !== Math.sign(lastStride)) {
          const p = pool[nextPuff++ % pool.length];
          p.visible = true; p.userData.born = run.time; p.userData.x = run.x + (nextPuff % 2 ? 0.18 : -0.18); p.userData.z = run.z - 0.4; // where it landed, in world space
        }
        lastStride = stride;
        for (const p of pool) if (p.visible) {
          const age = run.time - p.userData.born;
          if (age > 0.35) { p.visible = false; continue; }
          p.position.set(p.userData.x - run.x, 0.1 - run.y, p.userData.z - run.z); // a child of the root, so world x and y are held by countering the root
          p.scale.setScalar(0.6 + age * 3);
          p.material.opacity = 0.5 * (1 - age / 0.35);
        }
      },
      dispose() { pool.forEach((p) => p.material.dispose()); gfx.dispose(root); },
    };
  },
};

// Skins the loaded scene's mesh, swaps its material for the toon one, yaws it and fits it to the character's height. It returns
// what createView needs, or throws, so a scene that breaks half way is thrown away whole; exported so Node can test the GLB path.
export function fitModel(THREE, model, def) {
  let arms = [], legs = [], head = null, limbAxis = 'x';
  const mesh = model.getObjectByProperty('isMesh', true);
  if (mesh) { ({ arms, legs, head } = skin(THREE, mesh)); limbAxis = 'z'; } // the bones swing about the GLB's left-right axis
  // The generated GLB ships a metallic PBR material, which three.js renders near-black without an environment map;
  // the toon material with the same colour map matches the rest of the street.
  model.traverse((n) => { if (n.isMesh) n.material = new THREE.MeshToonMaterial({ map: n.material.map, color: n.material.color }); });
  model.rotation.y = def.yaw;
  const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
  model.scale.setScalar(def.height / size.y);
  model.position.y -= new THREE.Box3().setFromObject(model).min.y;
  return { model, arms, legs, head, limbAxis };
}

// Six bones placed from the mesh's shape (BONES) and weights from skinWeights; a SkinnedMesh takes the mesh's place in its parent.
// The bones are children of the skinned mesh, so three.js's attached bind mode keeps the skin on the model wherever the root moves.
function skin(THREE, mesh) {
  const g = mesh.geometry, pos = g.attributes.position, n = pos.count;
  const joints = new Uint16Array(n * 4), weights = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const w = skinWeights(pos.getY(i), pos.getZ(i));
    const top = [0, 1, 2, 3, 4, 5].sort((a, b) => w[b] - w[a]).slice(0, 4), sum = top.reduce((s, k) => s + w[k], 0);
    top.forEach((k, j) => { joints[i * 4 + j] = k; weights[i * 4 + j] = w[k] / sum; });
  }
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(joints, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
  const hips = new THREE.Bone(); hips.position.fromArray(BONES.hips);
  const child = (p) => { const b = new THREE.Bone(); b.position.fromArray(p).sub(hips.position); hips.add(b); return b; };
  const head = child(BONES.head), armL = child(BONES.armL), armR = child(BONES.armR), legL = child(BONES.legL), legR = child(BONES.legR);
  const skinned = new THREE.SkinnedMesh(g, mesh.material); // deliberately without the node's own transform: the bones and weights live in geometry space, and the shipped GLB's node carries only a 19.5° yaw (v3's three-quarter stance)
  skinned.add(hips);
  skinned.bind(new THREE.Skeleton([hips, head, armL, armR, legL, legR]));
  mesh.parent.add(skinned); mesh.parent.remove(mesh);
  return { arms: [armL, armR], legs: [legL, legR], head };
}

function shapeCow(gfx) {
  const P = gfx.palette;
  const model = gfx.group(gfx.roundedBox(0.66, 1.6, 0.5, 0.2, P.cowWhite, 0, 1.1));
  const spot = (x, y, z, r = 0.12) => model.add(gfx.sphere(r, P.spot, x, y, z));
  spot(0.22, 1.7, -0.22); spot(-0.2, 1.25, -0.24); spot(0.1, 0.7, -0.24, 0.1); spot(-0.25, 1.75, 0.2, 0.09); spot(0.24, 1.0, 0.22, 0.11);
  const muzzle = gfx.sphere(0.2, P.lavender, 0, 1.45, 0.28); muzzle.scale.set(1.4, 0.9, 0.8); model.add(muzzle);
  for (const s of [-1, 1]) {
    model.add(gfx.sphere(0.045, P.eye, s * 0.13, 1.68, 0.26));
    const ear = gfx.sphere(0.12, P.cowWhite, s * 0.46, 1.8, 0); ear.scale.set(1.6, 0.7, 0.5); model.add(ear);
    const inner = gfx.sphere(0.08, P.lavender, s * 0.46, 1.8, 0.05); inner.scale.set(1.3, 0.5, 0.3); model.add(inner);
    model.add(gfx.cone(0.06, 0.2, P.lavender, s * 0.18, 2.0));
  }
  model.add(gfx.sphere(0.12, P.lavender, 0, 0.75, 0.27));
  const limb = (x, y, len, tipColor) => {
    const pivot = gfx.group(); pivot.position.set(x, y, 0); model.add(pivot);
    pivot.add(gfx.capsule(0.09, len, P.cowWhite, 0, -len / 2 - 0.05));
    if (tipColor) pivot.add(gfx.sphere(0.09, tipColor, 0, -len - 0.1));
    return pivot;
  };
  const arms = [limb(-0.42, 1.3, 0.4, P.lavender), limb(0.42, 1.3, 0.4, P.lavender)];
  const legs = [limb(-0.16, 0.42, 0.28, P.eye), limb(0.16, 0.42, 0.28, P.eye)];
  const tail = gfx.capsule(0.03, 0.3, P.cowWhite, 0.05, 0.75, -0.3); tail.rotation.x = 0.9; model.add(tail);
  model.add(gfx.sphere(0.07, P.lavender, 0.08, 0.6, -0.42));
  return { model, arms, legs };
}

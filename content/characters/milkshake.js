export default {
  kind: 'character', id: 'milkshake', height: 1.9, width: 1.0, model: 'milkshake.glb', yaw: -Math.PI / 2,

  async createView(gfx) {
    const P = gfx.palette;
    const root = gfx.group(gfx.blobShadow(0.55));
    const shadow = root.children[0];
    const body = gfx.group();
    root.add(body);
    let model, arms = [], legs = [];
    try {
      const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
      const gltf = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}${this.model}`);
      model = gltf.scene;
      // The generated GLB ships a metallic PBR material, which three.js renders near-black without an environment map;
      // the toon material with the same colour map matches the rest of the street.
      model.traverse((n) => { if (n.isMesh) n.material = new gfx.three.MeshToonMaterial({ map: n.material.map, color: n.material.color }); });
      model.rotation.y = this.yaw;
      const size = new gfx.three.Box3().setFromObject(model).getSize(new gfx.three.Vector3());
      model.scale.setScalar(this.height / size.y);
      model.position.y -= new gfx.three.Box3().setFromObject(model).min.y;
    } catch {
      ({ model, arms, legs } = shapeCow(gfx)); // no GLB yet, or a bad one: the shape-built cow
    }
    body.add(model);

    // Dust: six puffs pooled under the hooves, one per footfall while on the ground. They stay on the road as Milkshake runs on.
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
      legs.forEach((l, i) => (l.rotation.x = stride * 0.7 * (i ? 1 : -1)));
      arms.forEach((a, i) => (a.rotation.x = stride * 0.7 * (i ? -1 : 1)));
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
          p.visible = true; p.userData.born = run.time; p.userData.z = run.z - 0.4;
          p.position.set(nextPuff % 2 ? 0.18 : -0.18, 0.1, 0);
        }
        lastStride = stride;
        for (const p of pool) if (p.visible) {
          const age = run.time - p.userData.born;
          if (age > 0.35) { p.visible = false; continue; }
          p.position.z = p.userData.z - run.z;
          p.scale.setScalar(0.6 + age * 3);
          p.material.opacity = 0.5 * (1 - age / 0.35);
        }
      },
      dispose() { pool.forEach((p) => p.material.dispose()); gfx.dispose(root); },
    };
  },
};

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

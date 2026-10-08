import * as THREE from 'three';

export const CAMERA = { height: 3.6, distance: 6.5, fov: 60 }; // the chase camera; a section may override within the validator's ranges
export const SPEED_BASE = 12;    // m/s below which the view does not widen
export const FOV_PER_MS = 0.6;   // degrees of extra field of view per m/s over SPEED_BASE
const CAMERA_EASE = 0.2;         // seconds; overrides are 92% of the way in half a second
const STREAKS = 14, STREAK_FROM = 16, STREAK_FULL = 30; // streaks fade in between these speeds (m/s)

// Where the chase camera sits for a run. Pure, so it is testable: `cam` is a section's override, `speed` widens the view.
export function cameraFor(run, cam = {}, speed = 0) {
  const height = cam.height ?? CAMERA.height, distance = cam.distance ?? CAMERA.distance;
  return {
    x: run.x * 0.6, y: height + run.y * 0.3, z: run.z - distance,
    lookX: run.x * 0.8, lookY: 1.2, lookZ: run.z + 12,
    fov: (cam.fov ?? CAMERA.fov) + Math.max(0, speed - SPEED_BASE) * FOV_PER_MS,
  };
}

// Eases the live camera values toward a section's override, and the speed that widens the view toward the run's,
// so a level that opens at a carried speed widens over half a second instead of popping on its first frame. Pass dt = Infinity to snap.
export function easeCamera(live, cam = {}, speed = 0, dt = 1 / 60) {
  const a = 1 - Math.exp(-dt / CAMERA_EASE);
  for (const k of ['height', 'distance', 'fov']) live[k] += ((cam[k] ?? CAMERA[k]) - live[k]) * a;
  live.speed += (speed - live.speed) * a;
  return live;
}

// The streaks' opacity for a frame at `speed`. A snap (dt = Infinity) is a still, and a still has no motion lines.
export const streakOpacity = (speed, dt = 1 / 60) => Number.isFinite(dt) ? Math.max(0, Math.min(0.6, ((speed - STREAK_FROM) / (STREAK_FULL - STREAK_FROM)) * 0.6)) : 0;

export function createEngine(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 400);
  // Sun from above, behind the camera and a little to the right, so faces toward the camera are lit
  // and side faces take the one shade tone the style sheet shows.
  const sun = new THREE.DirectionalLight('#ffffff', 2.2);
  scene.add(sun, sun.target, new THREE.HemisphereLight('#ffffff', '#55556a', 1.2));

  // Speed streaks: thin bars parented to the camera, above and beside the lanes, fading in with speed.
  const streakMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false });
  const streaks = new THREE.Group();
  for (let i = 0; i < STREAKS; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 1.5 + Math.random() * 2), streakMat);
    const side = i % 2 ? 1 : -1, x = side * (1.5 + Math.random() * 2.5), y = i % 3 ? 0.5 + Math.random() * 2 : 2 + Math.random() * 1.5;
    m.position.set(x, y, -4 - Math.random() * 14);
    streaks.add(m);
  }
  camera.add(streaks);
  scene.add(camera);

  const live = { ...CAMERA, speed: 0 }; // the eased camera values
  let portrait = false;
  const render = () => renderer.render(scene, camera);
  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    portrait = w < h; // portrait needs a wider view to see all 3 lanes
    camera.fov = cameraFor({ x: 0, y: 0, z: 0 }, live, live.speed).fov + (portrait ? 15 : 0); // the view follow() last set, so a resize after a run keeps its width
    camera.updateProjectionMatrix();
    render();
  }
  addEventListener('resize', resize);
  resize();

  return {
    scene, camera, renderer, render,
    setSky(theme) {
      const sky = new THREE.Color(theme.sky);
      scene.background = sky;
      const far = 260 - theme.fog * 160;
      scene.fog = new THREE.Fog(sky, far * 0.3, far);
    },
    // `cam` is the active section's override ({ height?, distance?, fov? }); dt eases toward it. Pass dt = Infinity to snap: the overrides land, the felt speed is the run's, the streaks go out.
    follow(run, cam = {}, dt = 1 / 60) {
      const { speed } = easeCamera(live, cam, run.speed ?? 0, dt);
      const c = cameraFor(run, live, speed);
      camera.position.set(c.x, c.y, c.z);
      camera.lookAt(c.lookX, c.lookY, c.lookZ);
      const fov = c.fov + (portrait ? 15 : 0);
      if (Math.abs(fov - camera.fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
      sun.position.set(run.x - 6, 16, run.z - 12);
      sun.target.position.set(run.x, 0, run.z);
      streakMat.opacity = streakOpacity(speed, dt);
      if (streakMat.opacity > 0) for (const s of streaks.children) { s.position.z += speed * dt * 2; if (s.position.z > -2) s.position.z = -18 - Math.random() * 4; }
    },
  };
}

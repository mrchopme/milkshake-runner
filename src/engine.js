import * as THREE from 'three';

export function createEngine(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 400);
  // Sun from above, behind the camera and a little to the right, so faces toward the camera are lit
  // and side faces take the one shade tone the style sheet shows.
  const sun = new THREE.DirectionalLight('#ffffff', 2.2);
  scene.add(sun, sun.target, new THREE.HemisphereLight('#ffffff', '#55556a', 1.2));

  const render = () => renderer.render(scene, camera);
  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.fov = w < h ? 75 : 60; // portrait needs a wider view to see all 3 lanes
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
    follow(run) {
      camera.position.set(run.x * 0.6, 3.6 + run.y * 0.3, run.z - 6.5);
      camera.lookAt(run.x * 0.8, 1.2, run.z + 12);
      sun.position.set(run.x - 6, 16, run.z - 12);
      sun.target.position.set(run.x, 0, run.z);
    },
  };
}

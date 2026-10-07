// src/main.js (temporary: replaced in Task 6)
import * as THREE from 'three';
import { createEngine } from './engine.js';

const engine = createEngine(document.getElementById('game'));
engine.setSky({ sky: '#9fd3f5', fog: 0.3 });
const cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshToonMaterial({ color: '#b9a6e8' }));
cube.position.set(0, 1, 4);
engine.scene.add(cube);
engine.follow({ x: 0, y: 0, z: 0 });
(function loop() { cube.rotation.y += 0.02; engine.render(); requestAnimationFrame(loop); })();

// The checks the four HiFi pickup overlays share (test/hifi-{jug,magnet,shield,x2}.test.js): a stand-in for the generated model under
// the overlay's file, two views, and what the brief asks of them. Not a *.test.js file, so `node --test test/*.test.js` skips it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as gfx from '../src/gfx.js';
import { adopt } from '../src/assets.js';

const T = gfx.three;
const ORB = new T.Vector3(0, 0.9, 0), RADIUS = 0.4; // the shipped orb: a 0.8 m sphere centred 0.9 m above the road

export const paintOf = (view) => { let p; view.object.traverse((n) => { if (n.isMesh && n.material.isMeshPhysicalMaterial) p = n.material; }); return p; };

// geometry: a stand-in for the model's shape and bounds (task-23-models.md). The mesh sits off-centre and below the origin, as generators leave it.
export function checkPickup(id, overlay, geometry, { glows = false } = {}) {
  const orm = new T.Texture({}), body = new T.Mesh(geometry, new T.MeshStandardMaterial({ map: new T.Texture({}), metalness: 1, roughness: 1, metalnessMap: orm, roughnessMap: orm }));
  body.position.set(0.3, -0.2, 0.5);
  adopt(`hifi/${id}.glb`, new T.Group().add(body));

  test(`the HiFi ${id} lists its model and fills the shipped orb's 0.8 m sphere, centred on its lane at y 0.9`, () => {
    assert.deepEqual(overlay.assets, [`hifi/${id}.glb`]);
    const view = overlay.createView(gfx), model = view.object.children.at(-1), v = new T.Vector3();
    view.object.updateMatrixWorld(true);
    let far = 0; // the farthest vertex: the model's own bounding sphere, not its box's corners
    model.traverse((n) => { if (n.isMesh) for (let i = 0; i < n.geometry.attributes.position.count; i++) far = Math.max(far, v.fromBufferAttribute(n.geometry.attributes.position, i).applyMatrix4(n.matrixWorld).distanceTo(ORB)); });
    const mid = new T.Box3().setFromObject(model).getCenter(new T.Vector3());
    assert.ok(Math.abs(far - RADIUS) < 1e-6, `farthest vertex ${far.toFixed(4)} m from the orb's centre, wanted ${RADIUS}`);
    assert.ok(mid.distanceTo(ORB) < 1e-6, `centred at ${mid.toArray().map((c) => c.toFixed(3))}`);
  });

  test(`the HiFi ${id} turns its front (+x) toward the player (-z); the world spins the group, so the yaw sits on the model`, () => {
    const view = overlay.createView(gfx), model = view.object.children.at(-1);
    view.object.updateMatrixWorld(true);
    const front = new T.Vector3(1, 0, 0).transformDirection(model.matrixWorld);
    assert.ok(front.distanceTo(new T.Vector3(0, 0, -1)) < 1e-9, `front points ${front.toArray().map((c) => c.toFixed(2))}`);
    assert.equal(view.object.rotation.y, 0, 'the group is left to the world\'s spin');
  });

  test(`every HiFi ${id} shares one glossy paint without Tripo's random metal`, () => {
    const a = overlay.createView(gfx), b = overlay.createView(gfx), p = paintOf(a);
    // re-pinned from 1 / 0.15 and the shared 0.85 env (Caedon, board 29 pick 4): the full coat blew the jug out into a white column
    assert.ok(p?.clearcoat === 0.3 && p.clearcoatRoughness === 0.4, `a satin clearcoat (${p?.clearcoat}, ${p?.clearcoatRoughness})`);
    assert.equal(p.userData.reflect, 0.3, 'reflections below the look\'s shared knob');
    assert.equal(p, paintOf(b), 'every copy shares one paint material');
    assert.ok(p.metalness === 0 && p.metalnessMap === null, 'no metal');
    assert.ok(p.roughnessMap === orm, 'the roughness map stays');
    assert.equal(p.emissiveMap !== null, glows, glows ? 'the milk glows through an emissive map' : 'no glow unless the brief says so');
    assert.equal(a.object.children.length, 2, 'a ground shadow and the model: no plates over it');
  });
}

export default {
  kind: 'character', id: 'milkshake', height: 1.9, width: 1.0, model: 'milkshake.glb', yaw: 0,
  async createView(gfx) {
    const object = gfx.group(gfx.box(0.66, 1.6, 0.5, gfx.palette.cowWhite, 0, 1.1));
    return { object, update(run) { object.position.set(run.x, run.y, run.z); }, pose() {}, dispose() {} };
  },
};

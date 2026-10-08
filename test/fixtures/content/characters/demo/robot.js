export default {
  kind: 'character', id: 'demo/robot', height: 2.0, width: 0.9, model: null,
  async createView(gfx) {
    const root = gfx.group(gfx.blobShadow(0.5));
    const shadow = root.children[0];
    const body = gfx.group(gfx.box(0.7, 0.9, 0.5, '#9aa3ad', 0, 0.95), gfx.box(0.5, 0.5, 0.5, '#c9d1d9', 0, 1.7), gfx.box(0.3, 0.1, 0.05, '#2fd67b', 0, 1.75, 0.26));
    for (const s of [-1, 1]) body.add(gfx.box(0.2, 0.5, 0.2, '#6b7480', s * 0.2, 0.25), gfx.box(0.15, 0.7, 0.15, '#6b7480', s * 0.45, 1.0));
    root.add(body);
    const pose = (time, { sliding = false, over = false } = {}) => {
      body.scale.y = sliding ? 0.5 : 1;
      body.rotation.x = over ? 0.9 : 0;
      body.position.y = Math.abs(Math.sin(time * 14)) * 0.06;
    };
    return {
      object: root, pose,
      update(run) { root.position.set(run.x, run.y, run.z); shadow.position.y = -run.y + 0.01; pose(run.time, { sliding: run.slideT > 0, over: run.over }); },
      dispose() { gfx.dispose(root); },
    };
  },
};

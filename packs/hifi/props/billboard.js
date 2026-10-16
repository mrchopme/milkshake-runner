// HiFi billboard: nothing (Task 32, Caedon's board 23 pick, 2026-10-15: "As prototyped"; the style frames have no sidewalk
// billboard, and the city's own framed posters stand in for it, lib/signs.js). The low-fi prop (content/props/billboard.js) and
// the levels' prop rates are untouched; this only re-skins it as an empty group.
export default {
  kind: 'prop', id: 'billboard',
  createView(gfx) { return { object: gfx.group() }; },
};

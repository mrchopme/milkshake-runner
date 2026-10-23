// HiFi railings: nothing. The shipped levels place this prop only on bridge sections (content/themes/bridge.js), and the HiFi
// bridge chunk draws its own steel railings on the walkway edges (lib/bridge.js); the shipped rails at x ±5.0 would stand on the
// walkway's kerb, a second line inside them (Task 32 lane C6 review). ponytail: a level that puts railings off the bridge gets none
// under HiFi; pass the section's theme in the prop's args (src/world.js) if one ever does.
export default {
  kind: 'prop', id: 'railings',
  createView(gfx) { return { object: gfx.group() }; },
};

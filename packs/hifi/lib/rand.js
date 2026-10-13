import { rng } from '../../../src/generator.js';
// One chunk, one generator, seeded from a single draw of the scenery stream: a chunk's city never depends on how many
// numbers the chunk before it used, and the same level seed always builds the same city.
export const chunkRng = (scenery) => rng(Math.floor(scenery() * 2 ** 32));
// A stable draw in [0, n) from a number, for a view that must pick the same thing every time it is built (a billboard's poster,
// from its z): no stream to advance, so it never depends on build order.
export const pickBy = (key, n) => Math.floor(rng(Math.round(key))() * n);

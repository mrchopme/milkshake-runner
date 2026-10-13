import { rng } from '../../../src/generator.js';
// One chunk, one generator, seeded from a single draw of the scenery stream: a chunk's city never depends on how many
// numbers the chunk before it used, and the same level seed always builds the same city.
export const chunkRng = (scenery) => rng(Math.floor(scenery() * 2 ** 32));

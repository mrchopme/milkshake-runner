import x2 from '../packs/hifi/pickups/x2.js';
import * as gfx from '../src/gfx.js';
import { checkPickup } from './hifi-pickups.js';

// the token: a round disc 0.352 m thick along x, 0.98 m across (task-23-models.md); its farthest vertex is inside its box's corners
checkPickup('x2', x2, new gfx.three.CylinderGeometry(0.49, 0.49, 0.352, 32).rotateZ(Math.PI / 2));

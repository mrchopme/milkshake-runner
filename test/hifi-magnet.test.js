import magnet from '../packs/hifi/pickups/magnet.js';
import * as gfx from '../src/gfx.js';
import { checkPickup } from './hifi-pickups.js';

// the horseshoe: 0.26 x 0.98 x 0.97 m, flat along x (task-23-models.md)
checkPickup('magnet', magnet, new gfx.three.BoxGeometry(0.26, 0.98, 0.97));

// src/rules.js (stub; Task 4 writes the real module and keeps these two exports)
export const DEFAULT_RULES = {
  laneWidth: 2.5, laneTime: 0.15, gravity: -30, jumpSpeed: 9, fastFall: -15, slideTime: 0.6, slideHeight: 0.8, grace: 1,
  speed: { start: 12, end: 20, cap: 28, ramp: 0.004 },
};
export const RULE_RANGES = {
  laneWidth: [1.5, 4], laneTime: [0.05, 0.5], gravity: [-60, -10], jumpSpeed: [5, 15], fastFall: [-40, -5], slideTime: [0.3, 2], slideHeight: [0.4, 1.5], grace: [0, 3],
  speed: { start: [4, 40], end: [4, 40], cap: [4, 60], ramp: [0, 0.05] },
};
export function resolveRules(overrides = {}) {
  return { ...DEFAULT_RULES, ...overrides, speed: { ...DEFAULT_RULES.speed, ...(overrides.speed ?? {}) } };
}
export const jumpHeight = (rules) => rules.jumpSpeed ** 2 / (2 * -rules.gravity);

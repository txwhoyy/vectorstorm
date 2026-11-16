// A small seeded random generator (mulberry32). The game never calls Math.random for anything
// that affects play, so a seed fully determines a run: the screenshot scenes and any replay of a
// run see the same waves, spawns and drops.

export function createRandom(seed) {
  let state = seed >>> 0;

  function next() {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return {
    next,
    /** A float in [min, max). */
    range(min, max) {
      return min + next() * (max - min);
    },
    /** An integer in [min, max], both ends included. */
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    /** True with probability p. */
    chance(p) {
      return next() < p;
    },
    /** One element of a non-empty array. */
    pick(items) {
      return items[Math.floor(next() * items.length)];
    },
    /** A direction in radians, uniform around the circle. */
    angle() {
      return next() * Math.PI * 2;
    },
  };
}

// Seeded randomness: the same seed always builds the same valley, trees and rings,
// so a screenshot staged with ?seed=N is the same frame every time it is taken.
export function createRandom(seed) {
  let state = seed >>> 0;
  if (state === 0) state = 0x9e3779b9;
  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    range(min, max) {
      return min + next() * (max - min);
    },
    int(min, max) {
      return Math.floor(this.range(min, max + 1));
    },
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },
  };
}

// Smooth value noise over the plane, built from a seeded grid so terrain is stable.
export function createNoise(random, cell = 260) {
  const grid = new Map();
  function gridValue(ix, iz) {
    const key = ix + ':' + iz;
    let value = grid.get(key);
    if (value === undefined) {
      value = random.next();
      grid.set(key, value);
    }
    return value;
  }
  function smooth(t) {
    return t * t * (3 - 2 * t);
  }
  return function noise(x, z) {
    const gx = x / cell;
    const gz = z / cell;
    const ix = Math.floor(gx);
    const iz = Math.floor(gz);
    const fx = smooth(gx - ix);
    const fz = smooth(gz - iz);
    const a = gridValue(ix, iz);
    const b = gridValue(ix + 1, iz);
    const c = gridValue(ix, iz + 1);
    const d = gridValue(ix + 1, iz + 1);
    return (a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz) * 2 - 1;
  };
}

// mulberry32 -- the estate's standard seeded PRNG, byte-for-byte the same as
// the projects.slippylabs.com tools use, so a seed means the same thing in a
// tool, a game and a Python port. (Porting to Python: the whole right-hand side
// of the second line reads the OLD t; see the tool-as-oracle notes.)

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rnd() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A string to a 32-bit seed (FNV-1a), for seeds people can type. */
export function hashSeed(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export const range = (rnd, lo, hi) => lo + (hi - lo) * rnd();
export const pick = (rnd, arr) => arr[Math.floor(rnd() * arr.length)];

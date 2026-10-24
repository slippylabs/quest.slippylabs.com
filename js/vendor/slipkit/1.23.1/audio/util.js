// The four helpers SlipDAW's instruments and effects (instruments.js,
// effects.js, lifted from daw.slippylabs.com when it was archived) need,
// kept here so the copies are byte-for-byte the DAW's apart from this import.

/** Deterministic PRNG (mulberry32). Seeded noise keeps offline renders reproducible. */
export function makeRng(seed = 0x5eed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

export function createNoiseBuffer(ctx, seconds = 2, seed = 1337) {
  const rng = makeRng(seed);
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = rng() * 2 - 1;
  return buf;
}

// The helpers SlipDAW's instruments and effects (instruments.js,
// effects.js, lifted from daw.slippylabs.com when it was archived) need.
// The copies were byte-for-byte the DAW's apart from this import until
// v1.56.2, which added releaseWhenDone() after every note's connect.

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

/**
 * Take a finished note out of the graph: once every source in `srcs` has
 * ended, disconnect `tails` (the nodes joined to a shared output). Stopping a
 * source does not do it -- the chain after it stays connected, and is pulled
 * every render quantum, until GC happens to collect it. A busy song left
 * thousands connected (Hellstorm's music at 80% of a core, then dropouts).
 */
export function releaseWhenDone(srcs, ...tails) {
  let left = srcs.length;
  const done = () => { if (--left <= 0) for (const t of tails) { try { t.disconnect(); } catch { /* already gone */ } } };
  if (!left) done();
  for (const s of srcs) s.addEventListener('ended', done, { once: true });
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

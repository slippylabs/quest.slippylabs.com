// Music theory the composer needs, and nothing else: scales, diatonic chords,
// voice leading. Pitches are MIDI note numbers (60 = middle C); scale degrees
// are 0-based (degree 0 = the tonic).
//
// Pure, so tools/music.mjs can hold every song to it under node.

export const SCALES = {
  ionian: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  // Minor with a raised 7th: the leading tone that makes V-i pull home.
  harmonic: [0, 2, 3, 5, 7, 8, 11],
  // Phrygian dominant: the "desert / ancient" sound (harmonic minor's 5th mode).
  phrygdom: [0, 1, 4, 5, 7, 8, 10],
};

/** Modes whose tonic triad is minor (the progression tables differ). */
export const MINOR_MODES = new Set(['dorian', 'phrygian', 'aeolian', 'harmonic']);

export const NOTE_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
export const noteName = (m) => `${NOTE_NAMES[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`;
export const midiToFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

/** The pitch class set of a key (root 0-11 + mode), for "is this note in key". */
export function keySet(root, mode) {
  return new Set(SCALES[mode].map((s) => (root + s) % 12));
}

/** Degree (any integer, may run past an octave either way) to MIDI, in a key whose tonic is `tonic` (MIDI). */
export function degreeToMidi(tonic, mode, degree) {
  const sc = SCALES[mode];
  const oct = Math.floor(degree / 7);
  const d = ((degree % 7) + 7) % 7;
  return tonic + oct * 12 + sc[d];
}

/** MIDI to the nearest scale degree at or below it (the inverse of degreeToMidi for in-key notes). */
export function midiToDegree(tonic, mode, midi) {
  const sc = SCALES[mode];
  const rel = midi - tonic;
  const oct = Math.floor(rel / 12);
  const pc = ((rel % 12) + 12) % 12;
  let d = 0;
  for (let i = 0; i < 7; i++) if (sc[i] <= pc) d = i;
  return oct * 7 + d;
}

/**
 * A diatonic chord on a degree: its pitch classes (root first) and quality.
 * `size` 3 = triad, 4 = seventh. Built by stacking scale thirds, so the
 * quality falls out of the mode (ii is minor in major, ii-dim in minor).
 * `borrow`: 'V' makes a minor key's v major (the harmonic-minor dominant).
 */
export function chordOn(root, mode, degree, size = 3, { borrow = null } = {}) {
  let m = mode;
  if (borrow === 'V' && MINOR_MODES.has(mode) && ((degree % 7) + 7) % 7 === 4) m = 'harmonic';
  const pcs = [];
  for (let i = 0; i < size; i++) pcs.push((root + SCALES[m][((degree + 2 * i) % 7 + 7) % 7]) % 12);
  const third = (pcs[1] - pcs[0] + 12) % 12;
  const fifth = (pcs[2] - pcs[0] + 12) % 12;
  const quality = third === 4 ? (fifth === 8 ? 'aug' : 'maj') : fifth === 6 ? 'dim' : 'min';
  return { degree: ((degree % 7) + 7) % 7, pcs, quality, root: pcs[0], borrowed: m !== mode };
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
export function chordLabel(ch) {
  const r = ROMAN[ch.degree];
  const base = ch.quality === 'maj' || ch.quality === 'aug' ? r : r.toLowerCase();
  return base + (ch.quality === 'dim' ? '°' : ch.quality === 'aug' ? '+' : '') + (ch.pcs.length > 3 ? '7' : '');
}

/** The pitch in [lo, hi] with pitch class `pc` nearest `target`. */
export function nearestPc(pc, target, lo = 0, hi = 127) {
  let best = null;
  for (let m = lo; m <= hi; m++) {
    if (((m % 12) + 12) % 12 !== pc) continue;
    if (best === null || Math.abs(m - target) < Math.abs(best - target)) best = m;
  }
  return best ?? Math.max(lo, Math.min(hi, target));
}

/**
 * Voice a chord near the previous voicing (smallest total movement), inside
 * [lo, hi]: every inversion and spread of the chord tones in range is tried.
 * This is the difference between a pad that glides and one that jumps an
 * octave on every change.
 */
export function voiceLead(pcs, prev, lo, hi, notes = 3) {
  const tones = pcs.slice(0, Math.max(notes, 3));
  const cands = [];
  // Close voicings starting on every chord tone, every octave that fits.
  for (let start = lo; start <= hi; start++) {
    const pc0 = ((start % 12) + 12) % 12;
    const i0 = tones.indexOf(pc0);
    if (i0 < 0) continue;
    const v = [start];
    let cur = start;
    for (let k = 1; k < notes; k++) {
      const pc = tones[(i0 + k) % tones.length];
      let n = cur + 1;
      while (((n % 12) + 12) % 12 !== pc) n++;
      v.push(n); cur = n;
    }
    if (cur <= hi) cands.push(v);
  }
  if (!cands.length) return tones.map((pc) => nearestPc(pc, (lo + hi) >> 1, lo, hi)).sort((a, b) => a - b);
  if (!prev || !prev.length) {
    const mid = (lo + hi) / 2;
    cands.sort((a, b) => Math.abs(a[0] + a[a.length - 1] - 2 * mid) - Math.abs(b[0] + b[b.length - 1] - 2 * mid));
    return cands[0];
  }
  const cost = (v) => {
    let c = 0;
    for (let i = 0; i < v.length; i++) c += Math.abs(v[i] - prev[Math.min(i, prev.length - 1)]);
    return c;
  };
  let best = cands[0], bc = cost(best);
  for (const v of cands) { const c = cost(v); if (c < bc) { best = v; bc = c; } }
  return best;
}

/** Functional class of a degree: tonic, subdominant, dominant. */
export const FUNCTION_OF = ['T', 'S', 'T', 'S', 'D', 'T', 'D'];

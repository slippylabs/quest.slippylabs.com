// The composer: a style (styles.js) and a seed in, a SONG out -- every note of
// every track, in beats. Pure and seeded, so a seed is the same song in the
// studio, in a game and under node, and tools/music.mjs can hold every song
// to the rules a listener would hear broken.
//
//   const song = compose('march', 7);              // pass 0: intro, A, B, A, bridge, B
//   const next = compose('march', 7, { pass: 1 }); // the same tunes, developed differently
//
// What makes it music rather than notes from a scale:
//   * FORM. Sections (intro / A / B / bridge) with their own chord progressions
//     and their own melodies; A comes back, B comes back, the last chorus can
//     lift a key. A pass is 1-2 minutes, and the next pass keeps every theme
//     but re-rolls the development (ornaments, sequences, fills, who sits out),
//     so a loop never plays the same 8 bars twice in a row.
//   * THEMES. Each section's melody is a 2-bar motif, stated, answered,
//     sequenced and cadenced (a period), not a random walk. Strong beats land
//     on chord tones, weak beats pass between them, phrases end home.
//   * HARMONY that moves: progressions from the pools a mode is known for,
//     sevenths by style, the harmonic-minor V so a minor key can cadence, and
//     voice-led comping so pads glide instead of jumping.
//   * ARRANGEMENT. Every track has an intensity tier (the player adds and
//     removes them live) and a set of sections it plays in.
//
// A song: { style, seed, pass, bpm, swing, swingUnit, tonic, mode, bars, beats,
//           sections: [{ kind, bar, bars, shift, chords: [{ beat, beats, label, degree, pcs }] }],
//           tracks: [{ id, role, inst, gain, pan, tier, rev, dly, notes: [{ t, d, p, v }] }], fx }
// t / d in beats from the start of the pass, p MIDI (a drum note is a SlipDAW
// drum pitch), v velocity 1..127.

import { mulberry32, hashSeed } from '../rng.js';
import { SCALES, MINOR_MODES, chordOn, chordLabel, degreeToMidi, voiceLead, nearestPc } from './theory.js';
import { STYLES, GROOVES, FILLS } from './styles.js';
import { DRUM } from './instruments.js';

const SPB = 16; // 16th steps per bar (4/4)
// Instruments that sound a power chord from one note (root + fifth + octave
// below). A comp track on one writes the root alone: writing [root, fifth] as
// well played the fifth twice and a ninth on top -- 6 saws a hit, not 3.
const SELF_VOICED = new Set(['power']);
// Its level: the two notes it replaces summed to +4.1 dB over one (their
// doubled fifth added in phase), not the +3 an even split gives -- measured
// solo on bullethell, punk and kaiju, so the guitar sits where it did.
const SELF_VOICED_SPLIT = 0.775;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length) % arr.length];
const wpick = (rng, pairs) => {
  const tot = pairs.reduce((s, [, w]) => s + w, 0);
  let r = rng() * tot;
  for (const [v, w] of pairs) { r -= w; if (r <= 0) return v; }
  return pairs[pairs.length - 1][0];
};

// Progression pools by mode (degrees). Proven shapes, not a Markov chain:
// the pools are what makes a dorian vamp sound dorian.
const PROGS = {
  major: [[0, 4, 5, 3], [0, 5, 3, 4], [0, 3, 4, 4], [5, 3, 0, 4], [0, 3, 0, 4], [0, 2, 3, 4], [0, 5, 1, 4], [0, 3, 5, 4], [3, 4, 0, 0], [0, 4, 3, 4]],
  minor: [[0, 5, 2, 6], [0, 6, 5, 6], [0, 3, 4, 0], [0, 5, 3, 4], [0, 3, 6, 2], [5, 6, 0, 0], [0, 6, 5, 4], [0, 2, 6, 3], [0, 3, 0, 4], [5, 3, 0, 4]],
  dorian: [[0, 3, 0, 3], [0, 6, 3, 0], [0, 1, 0, 6], [0, 3, 6, 0], [0, 2, 3, 6], [0, 4, 3, 0]],
  mixolydian: [[0, 6, 3, 0], [0, 6, 0, 3], [0, 3, 6, 0], [0, 4, 6, 3], [0, 6, 3, 4]],
  phrygian: [[0, 1, 0, 6], [0, 1, 6, 0], [0, 6, 5, 1], [0, 3, 1, 0], [0, 5, 6, 1]],
  phrygdom: [[0, 1, 0, 1], [0, 6, 1, 0], [0, 3, 1, 0], [0, 1, 6, 1]],
  lydian: [[0, 1, 0, 1], [0, 1, 6, 0], [0, 1, 4, 0], [0, 6, 1, 0], [0, 4, 1, 0]],
};
const poolFor = (mode) => (mode === 'ionian' ? PROGS.major : mode === 'aeolian' || mode === 'harmonic' ? PROGS.minor : PROGS[mode]);
// Chords are built from the mode itself, except harmonic minor, whose own
// triads include an augmented III: it is aeolian with the V borrowed.
const chordMode = (mode) => (mode === 'harmonic' ? 'aeolian' : mode);
const hasDominant = (mode) => mode === 'ionian' || mode === 'aeolian' || mode === 'harmonic' || mode === 'dorian' || mode === 'mixolydian';

// Rhythm cells: one beat each. x = a note starts, - = the last note holds, . = rest.
const CELLS = {
  lyrical: ['x---', 'x-x-', 'x--x', 'x---', 'x-xx', '----', 'x-x-', 'x...'],
  busy: ['xxxx', 'x-xx', 'xx-x', 'x-x-', 'xxx-', 'x.xx', 'x-x-'],
  riff: ['x-x.', 'xx.x', '.x.x', 'x.xx', 'x--x', 'x.x.', 'x-.x'],
  march: ['x--x', 'x-x-', 'x---', 'xxx-', 'x-xx', 'x--x'],
  sparse: ['x---', '----', 'x---', '....', 'x-x-', '----'],
};
const ENDS = { lyrical: ['x---', '----'], busy: ['x---', 'x-x-'], riff: ['x...', 'x-..'], march: ['x---', 'x-..'], sparse: ['----', '....'] };

function makeMotif(rng, kind, leap) {
  const cells = CELLS[kind] || CELLS.lyrical;
  const beats = [];
  // First beat starts a note (a motif that opens on a rest has no head);
  // the last beat is a long or closing cell, so two motifs read as two phrases.
  beats.push(pick(rng, cells.filter((c) => c[0] === 'x')));
  for (let b = 1; b < 7; b++) beats.push(pick(rng, cells));
  beats.push(pick(rng, ENDS[kind] || ENDS.lyrical));
  const str = beats.join('');
  const onsets = [];
  for (let s = 0; s < str.length; s++) {
    if (str[s] !== 'x') continue;
    let len = 1;
    while (s + len < str.length && str[s + len] === '-') len++;
    onsets.push({ s, len });
  }
  // Contour: arch, rise, fall or wave -- the shape the steps lean toward.
  const shape = pick(rng, ['arch', 'arch', 'rise', 'fall', 'wave']);
  const steps = [];
  for (let i = 1; i < onsets.length; i++) {
    const f = i / onsets.length;
    const bias = shape === 'arch' ? (f < 0.55 ? 0.35 : -0.35) : shape === 'rise' ? 0.3 : shape === 'fall' ? -0.3 : Math.sin(f * Math.PI * 3) * 0.4;
    const r = rng();
    let mag = r < 0.08 ? 0 : r < 1 - leap ? 1 : 2 + Math.floor(rng() * 3);
    const up = rng() < 0.5 + bias;
    steps.push(mag === 0 ? 0 : up ? mag : -mag);
  }
  // A motif needs an AMBITUS: one that never strays four steps from where it
  // started is a trill, not a tune. Widen the climb into its high point.
  for (let guard = 0; guard < 4; guard++) {
    let pos = 0, lo = 0, hi = 0, hiAt = -1;
    steps.forEach((st, i) => { pos += st; if (pos > hi) { hi = pos; hiAt = i; } lo = Math.min(lo, pos); });
    if (hi - lo >= 4 || !steps.length) break;
    const i = hiAt >= 0 ? hiAt : steps.findIndex((x) => x > 0);
    if (i >= 0) steps[i] += 2; else steps[0] = 3;
  }
  return { onsets, steps, shape };
}

/** A motif with its intervals turned upside down (the bridge's theme is the verse's, inverted). */
const invertMotif = (m) => ({ ...m, steps: m.steps.map((s) => -s) });

/** Its rhythm thinned: notes merged pairwise into longer ones. */
function augmentMotif(m) {
  const onsets = [];
  for (let i = 0; i < m.onsets.length; i += 2) {
    const a = m.onsets[i], b = m.onsets[i + 1];
    onsets.push({ s: a.s, len: b ? b.s + b.len - a.s : a.len });
  }
  const steps = [];
  for (let i = 0; i + 2 < m.steps.length + 1; i += 2) steps.push((m.steps[i] || 0) + (m.steps[i + 1] || 0));
  return { onsets, steps: steps.slice(0, Math.max(0, onsets.length - 1)), shape: m.shape };
}

const PENTA_MAJOR = new Set([0, 1, 2, 4, 5]);
const PENTA_MINOR = new Set([0, 2, 3, 4, 6]);

export function resolveStyle(style) {
  if (typeof style === 'string') {
    const s = STYLES[style];
    if (!s) throw new Error(`no music style "${style}"`);
    return { id: style, ...s };
  }
  return { id: style.id || 'custom', ...style };
}

/** Compose one pass of a song. */
export function compose(styleIn, seedIn = 1, { pass = 0, bpm: bpmOver = null, mode: modeOver = null, tonic: tonicOver = null } = {}) {
  const style = resolveStyle(styleIn);
  const seed = typeof seedIn === 'string' ? hashSeed(seedIn) : seedIn >>> 0;
  // THEME rng: everything that makes this song this song (key, tempo, chords,
  // motifs). DEV rng: how this pass develops them. Separate streams, so pass 3
  // keeps pass 0's tunes.
  const theme = mulberry32((seed ^ hashSeed(style.id)) >>> 0);
  const dev = mulberry32((seed + Math.imul(pass + 1, 0x9e3779b1)) >>> 0);

  const bpm = bpmOver ?? Math.round(style.bpm[0] + theme() * (style.bpm[1] - style.bpm[0]));
  const mode = modeOver ?? wpick(theme, style.modes);
  const tonic = tonicOver ?? (style.tonic[0] + Math.floor(theme() * (style.tonic[1] - style.tonic[0] + 1)));
  const minor = MINOR_MODES.has(mode);
  const cMode = chordMode(mode);
  const swing = style.swing || 0;

  // ---- progressions, one per section kind, fixed for the song
  const pool = poolFor(mode);
  const used = new Set();
  const takeProg = () => {
    let p, tries = 0;
    do { p = pick(theme, pool); tries++; } while (used.has(p) && tries < 12);
    used.add(p);
    return p.slice();
  };
  const progA = takeProg();
  const progB = takeProg();
  let progC = takeProg();
  // The bridge sets up the return: it leaves home and ends on the dominant.
  if (progC[0] === 0) progC = [progC[1], progC[2], progC[3], progC[0]];
  progC[3] = hasDominant(mode) ? 4 : progC[3] === 0 ? pick(theme, [1, 6]) : progC[3];
  const halfCadenceA = hasDominant(mode) && theme() < 0.5;
  // Every theme decision is drawn HERE, in a fixed order, before the form is
  // known: pass 0 has an intro and pass 1 does not, and a lazily drawn choice
  // would shift every later draw (pass 1 would get different chords).
  const sizeOf = {}, borrowFor = {};
  for (const k of ['intro', 'A', 'B', 'bridge']) {
    borrowFor[k] = mode === 'harmonic' || theme() < (style.borrowV || 0);
    for (let d = 0; d < 7; d++) sizeOf[`${k}:${d}`] = theme() < (style.sevenths || 0) ? 4 : 3;
  }
  const chordSize = (key) => sizeOf[key];
  const borrowV = (key) => borrowFor[key];
  const introBass = theme() < 0.6;
  const introComp = pick(theme, style.tracks.filter((t) => t.role === 'comp' && t.pattern !== 'pad').map((t) => t.id).concat(['none']));
  // Where each phrase of a section starts, relative to the section's centre
  // (degrees): a period that climbs, answers lower, then comes home.
  const anchors = {};
  for (const k of ['intro', 'A', 'B', 'bridge']) anchors[k] = [0, pick(theme, [2, -2, 3, 1]), pick(theme, [1, -1, 2]), pick(theme, [-1, 0, 2])];

  const mkChord = (deg, key) => chordOn(tonic, cMode, deg, chordSize(`${key}:${deg}`), { borrow: minor && borrowV(key) ? 'V' : null });

  // ---- motifs
  const leadSpec = style.lead || { rhythm: 'lyrical', leap: 0.3, artic: 0.85 };
  const motifA = makeMotif(theme, leadSpec.rhythm, leadSpec.leap ?? 0.3);
  const motifB = makeMotif(theme, leadSpec.rhythm === 'sparse' ? 'lyrical' : leadSpec.rhythm, leadSpec.leap ?? 0.3);
  const motifC = theme() < 0.5 ? invertMotif(motifA) : augmentMotif(motifB);
  const motifI = augmentMotif(motifA);
  const riffShape = Array.from({ length: 8 }, () => pick(theme, [0, 0, 0, 4, 7, 0, 2, -1, 4]));
  const riffRests = Array.from({ length: 8 }, (_, i) => i > 0 && theme() < 0.18);
  const arpOrder = pick(theme, ['up', 'updown', 'down', 'pinky']);
  const funkBass = pick(theme, ['r..g..o.r.fr.o..', 'r.g.o..rr..fo.g.', 'r..or..gr.o..fo.', 'r..r.or.g.r.o.f.']);
  const stabShape = pick(theme, ['..x...x...x...x.', '..x..x....x..x..', 'x..x..x...x..x..', '..x...x..x..x...']);

  // ---- form
  const form = (pass > 0 ? style.form.filter(([k]) => k !== 'intro') : style.form).map(([kind, bars]) => ({ kind, bars }));
  const lastB = form.map((f) => f.kind).lastIndexOf('B');
  let bar = 0;
  const sections = form.map((f, i) => {
    const prog = f.kind === 'B' ? progB : f.kind === 'bridge' ? progC : f.kind === 'intro' ? progA : progA;
    const per = style.chordRate || 1;
    const nChords = Math.max(1, Math.round(f.bars * per));
    const span = (f.bars * 4) / nChords; // beats per chord
    const chords = [];
    for (let c = 0; c < nChords; c++) {
      let deg = prog[c % prog.length];
      const lastOfSection = c === nChords - 1;
      if (f.kind === 'A' && lastOfSection && halfCadenceA) deg = 4;
      const ch = mkChord(deg, f.kind);
      chords.push({ beat: bar * 4 + c * span, beats: span, degree: ch.degree, pcs: ch.pcs, quality: ch.quality, borrowed: ch.borrowed, label: chordLabel(ch) });
    }
    const s = { kind: f.kind, bar, bars: f.bars, shift: i === lastB && style.lift && form.filter((x) => x.kind === 'B').length > 1 ? style.lift : 0, chords };
    bar += f.bars;
    return s;
  });
  const totalBars = bar;
  const chordAtBeat = (b) => {
    for (const s of sections) for (const c of s.chords) if (b >= c.beat - 1e-9 && b < c.beat + c.beats - 1e-9) return { c, s };
    const s = sections[sections.length - 1];
    return { c: s.chords[s.chords.length - 1], s };
  };

  // ---- arrangement: which tracks play in which section, for this pass
  const sitOut = new Map(); // section index -> track id
  sections.forEach((s, i) => {
    if (pass > 0 && s.kind === 'A' && dev() < 0.4) {
      const comps = style.tracks.filter((t) => t.role === 'comp');
      if (comps.length > 1) sitOut.set(i, pick(dev, comps).id);
    }
  });
  const plays = (t, s, i) => {
    if (sitOut.get(i) === t.id) return false;
    if (t.in && !t.in.includes(s.kind)) return false;
    if (s.kind === 'intro') {
      if (t.role === 'lead' || t.role === 'counter') return false;
      if (t.role === 'bass') return introBass;
      if (t.role === 'comp') return t.pattern === 'pad' || t.pattern === 'bell' || t.id === introComp;
    }
    if (!t.in && t.role === 'counter') return s.kind === 'B';
    return true;
  };

  // Lead notes are remembered per section so the counter-melody can answer them.
  function melodyMode(ch) { return ch.borrowed ? 'harmonic' : cMode; }
  function degMidi(d, ch, shift) { return degreeToMidi(tonic, melodyMode(ch), d) + shift; }
  const chordDegs = (ch) => {
    const out = [ch.degree, ch.degree + 2, ch.degree + 4];
    if (ch.pcs.length > 3) out.push(ch.degree + 6);
    return out.map((x) => ((x % 7) + 7) % 7);
  };
  const pentaOk = (d) => !leadSpec.penta || (minor ? PENTA_MINOR : PENTA_MAJOR).has(((d % 7) + 7) % 7);
  function snap(d, ch, wantChord) {
    const cd = chordDegs(ch);
    for (let r = 0; r <= 3; r++) {
      for (const dd of r === 0 ? [d] : [d + r, d - r]) {
        const m = ((dd % 7) + 7) % 7;
        if ((!wantChord || cd.includes(m)) && pentaOk(dd)) return dd;
      }
    }
    for (let r = 0; r <= 3; r++) for (const dd of [d + r, d - r]) if (pentaOk(dd)) return dd;
    return d;
  }
  // Degree whose pitch sits nearest a MIDI target.
  function degreeNear(midi, ch) {
    let best = 0, bd = 1e9;
    for (let d = -14; d < 50; d++) { const m = degMidi(d, ch, 0); const dist = Math.abs(m - midi); if (dist < bd) { bd = dist; best = d; } }
    return best;
  }

  const leadBySection = new Map();
  function leadNotes(t, s, si, out) {
    const [lo, hi] = t.range;
    const motif = s.kind === 'B' ? motifB : s.kind === 'bridge' ? motifC : s.kind === 'intro' ? motifI : motifA;
    const windows = Math.max(1, Math.floor(s.bars / 2));
    const artic = leadSpec.artic ?? 0.85;
    const target = s.kind === 'B' ? lo + (hi - lo) * 0.55 : s.kind === 'bridge' ? lo + (hi - lo) * 0.38 : lo + (hi - lo) * 0.42;
    const mine = [];
    let prev = null, prevM = null;
    const seqAmt = pick(dev, [1, -1, 2, 0]);
    for (let w = 0; w < windows; w++) {
      const w0 = s.bar * 4 + w * 8; // beats
      const lastWindow = w === windows - 1;
      const role = windows >= 4 ? ['state', 'answer', 'sequence', 'cadence'][w % 4] : windows === 2 ? ['state', 'cadence'][w] : 'cadence';
      const { c: ch0 } = chordAtBeat(w0);
      const centre = degreeNear(target, ch0);
      let start = centre + anchors[s.kind][w % 4];
      if (role === 'sequence') start = (mine.find((n) => n.w === w - 2)?.d0 ?? centre) + seqAmt;
      let onsets = motif.onsets, steps = motif.steps.slice();
      // Answer: same rhythm, new tail. Cadence: first bar kept, the second
      // bar is one long note home. Dev rolls ornaments on later passes.
      if (role === 'answer' || (pass > 0 && dev() < 0.3)) {
        const keep = Math.max(1, Math.floor(steps.length * 0.5));
        for (let k = keep; k < steps.length; k++) steps[k] = pick(dev, [-2, -1, -1, 0, 1, 1, 2]);
      }
      if (role === 'cadence') {
        const firstBar = onsets.filter((o) => o.s < 16);
        onsets = [...firstBar.map((o) => ({ s: o.s, len: Math.min(o.len, 16 - o.s) })), { s: 16, len: lastWindow ? 16 : 12 }];
        steps = steps.slice(0, onsets.length - 1);
      }
      if (pass > 0 && role !== 'cadence' && dev() < 0.35) {
        // An ornament: split one long note into two (a neighbour tone).
        const idx = onsets.findIndex((o) => o.len >= 4);
        if (idx >= 0) {
          const o = onsets[idx];
          const half = Math.floor(o.len / 2);
          onsets = [...onsets.slice(0, idx), { s: o.s, len: half }, { s: o.s + half, len: o.len - half }, ...onsets.slice(idx + 1)];
          const nb = pick(dev, [1, -1]);
          steps = [...steps.slice(0, idx), nb, (steps[idx] ?? 0) - nb, ...steps.slice(idx + 1)].slice(0, onsets.length - 1);
        }
      }
      let d = start, run = 0, flip = 1;
      for (let k = 0; k < onsets.length; k++) {
        const o = onsets[k];
        const beat = w0 + o.s / 4;
        const { c: ch } = chordAtBeat(beat);
        const strong = o.s % 8 === 0 || o.len >= 6;
        let st = 0;
        if (k > 0) {
          st = steps[k - 1] ?? 0;
          // A third repeat of one pitch moves instead: a melody, not a drone.
          if (st === 0 && run >= 2) st = dev() < 0.5 ? 1 : -1;
          d = prev + flip * st;
        }
        d = snap(d, ch, strong);
        let m = degMidi(d, ch, 0);
        // Out of range: the contour BOUNCES off the edge (the rest of the
        // phrase runs the other way) instead of folding an octave, which
        // pinned melodies against the ceiling, trilling between two notes.
        if ((m > hi || m < lo) && k > 0 && st) {
          flip = -flip;
          d = snap(prev + flip * st, ch, strong); m = degMidi(d, ch, 0);
        }
        while (m > hi) { d -= 7; m = degMidi(d, ch, 0); }
        while (m < lo) { d += 7; m = degMidi(d, ch, 0); }
        let len = o.len;
        const isLast = k === onsets.length - 1;
        if (role === 'cadence' && isLast) {
          // Home: the tonic if the chord is the tonic, else the chord's root.
          const homeDeg = ch.degree === 0 ? 0 : ch.degree;
          let best = d, bd = 99;
          for (let dd = d - 4; dd <= d + 4; dd++) if (((dd % 7) + 7) % 7 === homeDeg && Math.abs(dd - d) < bd) { const mm = degMidi(dd, ch, 0); if (mm >= lo && mm <= hi) { best = dd; bd = Math.abs(dd - d); } }
          d = best; m = degMidi(d, ch, 0);
        }
        // Snapping can pull a moved note back onto the last pitch; a third
        // repeat looks for the nearest other allowed pitch instead.
        if (prevM !== null && m === prevM && run >= 2 && !(role === 'cadence' && isLast)) {
          for (const dd of [d + 1, d - 1, d + 2, d - 2]) {
            const sd = snap(dd, ch, false), sm = degMidi(sd, ch, 0);
            if (sm !== prevM && sm >= lo && sm <= hi) { d = sd; m = sm; break; }
          }
        }
        const accent = o.s % 16 === 0 ? 100 : o.s % 4 === 0 ? 90 : 76;
        const v = clamp(Math.round(accent + (dev() - 0.5) * 16), 30, 127);
        const n = { t: beat, d: Math.max(0.2, (len / 4) * (isLast ? 0.95 : artic)), p: m + s.shift, v };
        if (prevM !== null && m === prevM) run++; else run = 0;
        prevM = m;
        out.push(n);
        mine.push({ ...n, d0: d, w, sAbs: (beat - s.bar * 4) * 4, len });
        prev = d;
      }
    }
    leadBySection.set(si, mine);
  }

  function counterNotes(t, s, out) {
    const [lo, hi] = t.range;
    const si = sections.indexOf(s);
    const lead = leadBySection.get(si) || [];
    if (t.kind === 'harmony' && lead.length) {
      const leadMid = (style.tracks.find((x) => x.role === 'lead')?.range || [60, 80]).reduce((a, b) => a + b) / 2;
      const dir = (lo + hi) / 2 > leadMid ? 2 : -2;
      for (const n of lead) {
        if (n.len < 2) continue;
        const { c: ch } = chordAtBeat(n.t);
        let d = n.d0 + dir;
        let m = degMidi(d, ch, 0);
        while (m > hi) { d -= 7; m = degMidi(d, ch, 0); }
        while (m < lo) { d += 7; m = degMidi(d, ch, 0); }
        out.push({ t: n.t, d: n.d, p: m + s.shift, v: Math.max(30, n.v - 14) });
      }
      return;
    }
    // Answer: fill the lead's rests with a short figure; with no rests (or no
    // lead), hold a chord tone per bar under it.
    const sounding = new Uint8Array(s.bars * SPB);
    for (const n of lead) for (let k = Math.round(n.sAbs); k < Math.min(sounding.length, Math.round(n.sAbs + n.len)); k++) sounding[k] = 1;
    let placed = 0;
    for (let st = 0; st < sounding.length;) {
      if (sounding[st]) { st++; continue; }
      let g = st; while (g < sounding.length && !sounding[g]) g++;
      const gap = g - st;
      if (gap >= 4 && lead.length) {
        const beat = s.bar * 4 + st / 4;
        const { c: ch } = chordAtBeat(beat);
        let d = degreeNear((lo + hi) / 2, ch);
        d = snap(d, ch, true);
        const count = Math.min(4, Math.floor(gap / 2));
        const dirn = dev() < 0.5 ? 1 : -1;
        for (let k = 0; k < count; k++) {
          const bt = beat + k * 0.5;
          const { c: ck } = chordAtBeat(bt);
          const dd = snap(d + k * dirn, ck, k === 0 || k === count - 1);
          let m = degMidi(dd, ck, 0);
          while (m > hi) m -= 12; while (m < lo) m += 12;
          out.push({ t: bt, d: k === count - 1 ? Math.min(gap / 4 - k * 0.5, 1.5) * 0.9 : 0.42, p: m + s.shift, v: clamp(Math.round(70 + (dev() - 0.5) * 14), 30, 127) });
          placed++;
        }
      }
      st = g;
    }
    if (!placed) {
      for (let b = 0; b < s.bars; b++) {
        const beat = (s.bar + b) * 4;
        const { c: ch } = chordAtBeat(beat);
        const pc = ch.pcs[b % 2 === 0 ? 1 : 2];
        out.push({ t: beat, d: 3.8, p: nearestPc(pc, (lo + hi) / 2, lo, hi) + s.shift, v: 60 });
      }
    }
  }

  function bassNotes(t, s, out) {
    const [lo, hi] = t.range;
    const pat = t.pattern || 'half';
    const rootOf = (ch) => nearestPc(ch.pcs[0], tonic + 2, Math.max(lo, tonic - 6), Math.min(hi, tonic + 8));
    const push = (beat, d, p, v) => out.push({ t: beat, d, p: clamp(p, lo - 12, hi) + s.shift, v: clamp(Math.round(v + (dev() - 0.5) * 10), 20, 127) });
    s.chords.forEach((ch, ci) => {
      const r = rootOf(ch);
      const fifth = r + 7 <= hi ? r + 7 : r - 5;
      const next = s.chords[ci + 1] || (sections[sections.indexOf(s) + 1]?.chords[0]) || ch;
      const nr = rootOf(next);
      const b0 = ch.beat, nb = ch.beats;
      const bars = Math.max(1, Math.round(nb / 4));
      if (pat === 'pedal') {
        const tp = nearestPc(tonic % 12, tonic, lo, hi);
        for (let k = 0; k < nb; k += 8) push(b0 + k, Math.min(8, nb - k) * 0.95, k % 16 === 8 && dev() < 0.3 ? tp + 7 : tp, 80);
        return;
      }
      for (let br = 0; br < bars; br++) {
        const B0 = b0 + br * 4;
        const lastBar = br === bars - 1;
        if (pat === 'whole') push(B0, 3.8, r, 90);
        else if (pat === 'half') { push(B0, 1.9, r, 95); push(B0 + 2, 1.9, dev() < 0.6 ? fifth : r, 80); }
        else if (pat === 'march') { push(B0, 0.8, r, 100); push(B0 + 2, 0.8, fifth, 85); if (dev() < 0.25) push(B0 + 3.5, 0.4, r + (nr > r ? -1 : 1), 70); }
        else if (pat === 'eighths') {
          for (let k = 0; k < 8; k++) {
            const approach = lastBar && k === 7 && nr !== r && dev() < 0.6;
            push(B0 + k * 0.5, 0.42, approach ? nr + (nr > r ? -2 : 2) : r, k % 2 === 0 ? 100 : 80);
          }
        } else if (pat === 'octave') {
          for (let k = 0; k < 8; k++) push(B0 + k * 0.5, 0.4, k % 2 ? r + 12 : r, k % 2 ? 78 : 100);
        } else if (pat === 'gallop') {
          const g = 'x.xxx.xxx.xxx.xx';
          for (let k = 0; k < 16; k++) if (g[k] === 'x') push(B0 + k / 4, 0.22, lastBar && k >= 12 && dev() < 0.4 ? fifth : r, k % 4 === 0 ? 105 : 82);
        } else if (pat === 'walk') {
          const tones = [r, nearestPc(ch.pcs[1], r + 4, r, r + 12), nearestPc(ch.pcs[2], r + 7, r, r + 12)];
          const w = [tones[0], pick(dev, tones.slice(1)), pick(dev, tones), lastBar ? nr + (dev() < 0.5 ? -1 : 1) : pick(dev, tones)];
          w.forEach((p, k) => push(B0 + k, 0.9, p, k === 0 ? 96 : 80));
        } else if (pat === 'funk') {
          for (let k = 0; k < 16; k++) {
            const c = funkBass[k];
            if (c === '.') continue;
            const p = c === 'o' ? r + 12 : c === 'f' ? fifth : r;
            push(B0 + k / 4, c === 'g' ? 0.12 : 0.22, p, c === 'g' ? 45 : k % 4 === 0 ? 105 : 88);
          }
        } else if (pat === 'offbeat') {
          for (let k = 0; k < 4; k++) push(B0 + k + 0.5, 0.4, r, 95);
        } else if (pat === 'riff') {
          for (let k = 0; k < 8; k++) {
            if (riffRests[k]) continue;
            const off = riffShape[k];
            const p = off === 0 ? r : off === 7 ? r + 12 : off === 4 ? fifth : nearestPc((ch.pcs[0] + (SCALES[cMode][((ch.degree + off) % 7 + 7) % 7] - SCALES[cMode][ch.degree] + 12)) % 12, r + off * 1.7, lo, hi);
            push(B0 + k * 0.5, 0.4, p, k % 2 === 0 ? 100 : 82);
          }
        } else push(B0, 3.8, r, 90);
      }
    });
  }

  const voicings = new Map();
  function compNotes(t, s, out) {
    const [lo, hi] = t.range;
    const pat = t.pattern || 'pad';
    let prev = voicings.get(t.id) || null;
    // `cut`: pitches drawn but not written (a self-voiced power chord's upper
    // notes). The draw still happens, so every later note keeps its velocity.
    let cut = null;
    const push = (beat, d, p, v) => {
      const n = { t: beat, d, p: p + s.shift, v: clamp(Math.round(v + (dev() - 0.5) * 10), 20, 127) };
      if (!cut || !cut.has(p)) out.push(n);
    };
    s.chords.forEach((ch) => {
      let v;
      if (t.power) {
        const r = nearestPc(ch.pcs[0], (lo + hi) / 2 - 4, lo, hi - 7);
        v = t.notes >= 3 ? [r, r + 7, r + 12] : [r, r + 7];
        cut = SELF_VOICED.has(t.inst) ? new Set(v.slice(1)) : null;
      } else {
        v = voiceLead(ch.pcs, prev, lo, hi, t.notes || 3);
      }
      prev = v;
      const b0 = ch.beat, nb = ch.beats;
      if (pat === 'pad') {
        for (let k = 0; k < nb; k += 8) v.forEach((p) => push(b0 + k, Math.min(8, nb - k) - 0.05, p, 70));
      } else if (pat === 'arp8' || pat === 'arp16') {
        const stepB = pat === 'arp8' ? 0.5 : 0.25;
        let up = [...v, ...v.map((p) => p + 12)].filter((p) => p <= hi);
        if (up.length < 3) up = v;
        const seq = arpOrder === 'up' ? up : arpOrder === 'down' ? [...up].reverse() : arpOrder === 'updown' ? [...up, ...up.slice(1, -1).reverse()] : up.flatMap((p, i) => (i ? [p, up[0]] : [p]));
        for (let k = 0; k * stepB < nb - 1e-9; k++) push(b0 + k * stepB, stepB * 0.9, seq[k % seq.length], k % (pat === 'arp8' ? 2 : 4) === 0 ? 88 : 70);
      } else if (pat === 'pulse8') {
        for (let k = 0; k < nb * 2; k++) v.forEach((p) => push(b0 + k * 0.5, 0.36, p, k % 2 === 0 ? 92 : 74));
      } else if (pat === 'stab') {
        for (let br = 0; br < nb / 4; br++) for (let k = 0; k < 16; k++) if (stabShape[k] === 'x') v.forEach((p) => push(b0 + br * 4 + k / 4, 0.22, p, 84));
      } else if (pat === 'chords4') {
        for (let k = 0; k < nb; k++) v.forEach((p) => push(b0 + k, 0.7, p, k % 2 === 0 ? 88 : 72));
      } else if (pat === 'oompah') {
        for (let k = 1; k < nb; k += 2) v.forEach((p) => push(b0 + k, 0.5, p, 78));
      } else if (pat === 'strum') {
        for (let br = 0; br < nb / 4; br++) {
          for (const [at, len, vel] of [[0, 1.4, 92], [1.5, 0.5, 70], [2, 1.9, 84]]) {
            v.forEach((p, i) => push(b0 + br * 4 + at + i * 0.035, len, p, vel - i * 4));
          }
        }
      } else if (pat === 'alberti') {
        const a = [v[0], v[v.length - 1], v[1] ?? v[0], v[v.length - 1]];
        for (let k = 0; k < nb * 2; k++) push(b0 + k * 0.5, 0.45, a[k % 4], k % 4 === 0 ? 86 : 68);
      } else if (pat === 'bell') {
        for (let br = 0; br < Math.max(1, nb / 4); br++) {
          const n = 1 + Math.floor(dev() * 3);
          for (let k = 0; k < n; k++) {
            const at = Math.floor(dev() * 8) * 0.5;
            push(b0 + br * 4 + at, 2.5, nearestPc(pick(dev, ch.pcs), lo + dev() * (hi - lo), lo, hi), 60 + Math.floor(dev() * 25));
          }
        }
      }
    });
    voicings.set(t.id, prev);
  }

  function drumNotes(t, s, si, out) {
    const gName = (style.grooves || {})[s.kind];
    if (!gName) return;
    const g = GROOVES[gName];
    const lanes = t.lanes.split('');
    const isLastSection = si === sections.length - 1;
    for (let b = 0; b < s.bars; b++) {
      const B0 = (s.bar + b) * 4;
      const lastBar = b === s.bars - 1;
      const fill = lastBar && (!isLastSection || true) && s.bars >= 4 ? pick(dev, FILLS) : null;
      for (const lane of lanes) {
        let pat = (g[lane] || '').padEnd(16, '.');
        if (fill && fill[lane] !== undefined && (lane === 'k' || lane === 's' || lane === 'p')) {
          const f = fill[lane].padEnd(16 - fill.from, '.');
          if (lane !== 'p' || fill.p) pat = pat.slice(0, fill.from) + f;
        }
        // A section's first bar gets a crash (the ride, hit hard) on the one.
        if (b === 0 && s.kind !== 'intro' && (lane === 'r' || (lane === 'h' && !lanes.includes('r')))) {
          out.push({ t: B0, d: 0.25, p: DRUM.r, v: 118 });
        }
        for (let k = 0; k < 16; k++) {
          const c = pat[k];
          if (c === '.' || c === undefined) continue;
          if (b === 0 && k === 0 && s.kind !== 'intro' && (lane === 'r')) continue;
          if (c === 'g' && dev() < 0.2) continue;
          let v = c === 'x' ? 110 : c === 'o' ? 82 : 38;
          v = clamp(Math.round(v + (dev() - 0.5) * 18), 20, 127);
          out.push({ t: B0 + k / 4, d: 0.25, p: DRUM[lane], v });
        }
      }
    }
  }

  // ---- realise each track
  const tracks = style.tracks.map((t) => {
    const notes = [];
    sections.forEach((s, i) => {
      if (!plays(t, s, i)) return;
      if (t.role === 'lead') leadNotes(t, s, i, notes);
      else if (t.role === 'counter') counterNotes(t, s, notes);
      else if (t.role === 'bass') bassNotes(t, s, notes);
      else if (t.role === 'comp') compNotes(t, s, notes);
      else if (t.role === 'drums') drumNotes(t, s, i, notes);
    });
    notes.sort((a, b) => a.t - b.t || a.p - b.p);
    return { id: t.id, role: t.role, inst: t.inst, gain: t.role === 'comp' ? (t.gain * 1.6) / Math.sqrt(t.power ? (SELF_VOICED.has(t.inst) ? SELF_VOICED_SPLIT : 2) : t.notes || 3) : t.gain, pan: t.pan || 0, tier: t.tier || 0, rev: t.rev || 0, dly: t.dly || 0, notes };
  });

  return {
    style: style.id, name: style.name, seed, pass, bpm, swing, swingUnit: style.swingUnit || 8,
    tonic, mode, bars: totalBars, beats: totalBars * 4, sections, tracks, fx: style.fx || {},
  };
}

/**
 * A short phrase for a moment: 'win', 'lose', 'levelup', 'boss', 'start'.
 * In the song's key and on its instruments, so it belongs to the score.
 * Returns { beats, tracks } -- the same track shape as a song.
 */
export function composeStinger(song, kind = 'win') {
  const style = resolveStyle(song.style in STYLES ? song.style : 'chiptune');
  const lead = style.tracks.find((t) => t.role === 'lead');
  const comp = style.tracks.find((t) => t.role === 'comp' && t.pattern !== 'bell') || style.tracks.find((t) => t.role === 'comp');
  const drums = style.tracks.find((t) => t.role === 'drums');
  const [lo, hi] = lead.range;
  const md = kind === 'lose' ? 'aeolian' : MINOR_MODES.has(song.mode) && kind !== 'win' && kind !== 'levelup' ? chordMode(song.mode) : kind === 'boss' ? 'phrygian' : 'ionian';
  const base = song.tonic + 12 * Math.max(1, Math.round((lo - song.tonic) / 12));
  const deg = (d) => degreeToMidi(base, md, d);
  const L = [], Cn = [], Dn = [];
  let beats = 4;
  if (kind === 'win' || kind === 'start') {
    [0, 2, 4].forEach((d, i) => L.push({ t: i * 0.33, d: 0.3, p: deg(d), v: 100 }));
    L.push({ t: 1, d: 2.5, p: deg(7), v: 110 });
    chordOn(song.tonic, 'ionian', 0).pcs.forEach((pc) => Cn.push({ t: 1, d: 2.6, p: nearestPc(pc, (comp.range[0] + comp.range[1]) / 2, comp.range[0], comp.range[1]), v: 90 }));
    Dn.push({ t: 0.5, d: 0.2, p: DRUM.s, v: 70 }, { t: 0.67, d: 0.2, p: DRUM.s, v: 80 }, { t: 0.83, d: 0.2, p: DRUM.s, v: 90 }, { t: 1, d: 0.2, p: DRUM.k, v: 115 }, { t: 1, d: 0.2, p: DRUM.r, v: 120 });
  } else if (kind === 'levelup') {
    [0, 2, 4, 7, 9, 11, 14].forEach((d, i) => L.push({ t: i * 0.18, d: i === 6 ? 1.4 : 0.17, p: deg(d) > hi + 12 ? deg(d) - 12 : deg(d), v: 92 + i * 3 }));
    beats = 2.5;
    Dn.push({ t: 1.08, d: 0.2, p: DRUM.r, v: 110 });
  } else if (kind === 'lose') {
    [4, 3, 2, 1].forEach((d, i) => L.push({ t: i * 0.6, d: 0.55, p: deg(d), v: 92 - i * 6 }));
    L.push({ t: 2.4, d: 2, p: deg(0), v: 80 });
    chordOn(song.tonic, 'aeolian', 0).pcs.forEach((pc) => Cn.push({ t: 2.4, d: 2.2, p: nearestPc(pc, (comp.range[0] + comp.range[1]) / 2, comp.range[0], comp.range[1]), v: 70 }));
    beats = 5;
  } else if (kind === 'boss') {
    const r = nearestPc(song.tonic % 12, comp.range[0] + 2, comp.range[0], comp.range[1]);
    [[0, r], [0.75, r], [1.5, r + 1], [3, r]].forEach(([t, p], i) => {
      Cn.push({ t, d: i === 3 ? 2.5 : 0.6, p, v: 115 }, { t, d: i === 3 ? 2.5 : 0.6, p: p + 7, v: 100 });
      Dn.push({ t, d: 0.2, p: DRUM.k, v: 120 });
    });
    Dn.push({ t: 3, d: 0.2, p: DRUM.r, v: 120 });
    L.push({ t: 3, d: 2.4, p: deg(0) + 12 > hi ? deg(0) : deg(0) + 12, v: 100 });
    beats = 5.5;
  }
  return {
    beats, bpm: song.bpm, tracks: [
      { id: 'st-lead', role: 'lead', inst: lead.inst, gain: lead.gain * 1.1, pan: 0, tier: 0, rev: lead.rev || 0.2, dly: 0, notes: L },
      { id: 'st-comp', role: 'comp', inst: comp.inst, gain: comp.gain, pan: 0, tier: 0, rev: comp.rev || 0.2, dly: 0, notes: Cn },
      ...(drums ? [{ id: 'st-drums', role: 'drums', inst: drums.inst, gain: drums.gain, pan: 0, tier: 0, rev: 0.15, dly: 0, notes: Dn }] : []),
    ],
  };
}

/** Where intensity 0..1 puts each tier: tier n plays at intensity >= TIER_AT[n]. */
export const TIER_AT = [0, 0.25, 0.5, 0.8];
export const tierOn = (tier, intensity) => intensity >= (TIER_AT[tier] ?? 1) - 1e-9;

/** One-line description of a song, for a UI or a log. */
export function describeSong(song) {
  const key = `${['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'][song.tonic % 12]} ${song.mode}`;
  const secs = Math.round(song.beats * 60 / song.bpm);
  return `${song.name || song.style} #${song.seed}${song.pass ? ` pass ${song.pass}` : ''}: ${key}, ${song.bpm} bpm, ${song.bars} bars (${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}), ` +
    song.sections.map((s) => `${s.kind}[${s.chords.map((c) => c.label).join(' ')}]${s.shift ? `+${s.shift}` : ''}`).join(' ');
}

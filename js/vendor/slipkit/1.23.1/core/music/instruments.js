// The music's instruments, as data. kit/audio/voices.js turns an entry into
// WebAudio nodes; the composer only ever names them, so a style is checkable
// under node and a game can swap a timbre without touching the composer.
//
//   synth: { osc: [{ wave, semis?, cents?, gain? }], noise?: gain,
//            filter: { type, f, q, env?: { from, time }, track? },
//            amp: { a, d, s, r }  (seconds; s = sustain level 0..1),
//            vib?: { rate, cents, delay }, level }
//   fm:    { ratio, index, modDecay, amp: { a, d, s, r }, level }
//   pluck: { decay, brightness, level }        Karplus-Strong (SlipDAW's)
//   kit:   '<SlipDAW drum kit id>', level      trap 808 909 606 acoustic lofi techno breakbeat
//
// filter.f is Hz at middle C; `track` (0..1) moves it with the note, so a
// low bass is not drowned in its own top end and a high lead stays bright.
// env.from multiplies f at the note's start and glides to f over env.time:
// a from > 1 is a pluck/pluck-bass "pew", a from < 1 a brass swell.

const S = (osc, filter, amp, extra = {}) => ({ synth: { osc, filter, amp, level: 0.8, ...extra } });
const o = (wave, gain = 1, extra = {}) => ({ wave, gain, ...extra });

export const INSTRUMENTS = {
  // ---- leads
  horn: S([o('sawtooth'), o('square', 0.3, { cents: 6 })], { type: 'lowpass', f: 1300, q: 1.6, env: { from: 0.55, time: 0.16 }, track: 0.6 }, { a: 0.05, d: 0.25, s: 0.8, r: 0.18 }, { vib: { rate: 5, cents: 9, delay: 0.25 }, group: 'Brass' }),
  brass: S([o('sawtooth'), o('sawtooth', 0.6, { cents: -9 })], { type: 'lowpass', f: 1800, q: 2.4, env: { from: 0.5, time: 0.12 }, track: 0.5 }, { a: 0.03, d: 0.2, s: 0.75, r: 0.14 }, { group: 'Brass' }),
  flute: S([o('sine'), o('triangle', 0.25, { semis: 12 })], { type: 'lowpass', f: 3600, q: 0.5, track: 0.8 }, { a: 0.06, d: 0.2, s: 0.85, r: 0.16 }, { noise: 0.025, vib: { rate: 5.4, cents: 14, delay: 0.18 }, group: 'Wind' }),
  reed: S([o('square'), o('sawtooth', 0.3)], { type: 'lowpass', f: 1500, q: 1.1, track: 0.7 }, { a: 0.03, d: 0.15, s: 0.8, r: 0.12 }, { vib: { rate: 5.8, cents: 10, delay: 0.2 }, group: 'Wind' }),
  sawLead: S([o('sawtooth'), o('sawtooth', 0.7, { cents: 10 })], { type: 'lowpass', f: 2600, q: 3, env: { from: 2, time: 0.12 }, track: 0.6 }, { a: 0.008, d: 0.2, s: 0.7, r: 0.16 }, { vib: { rate: 6, cents: 12, delay: 0.3 }, group: 'Synth' }),
  softLead: S([o('triangle'), o('sawtooth', 0.25, { cents: 5 })], { type: 'lowpass', f: 2200, q: 0.8, track: 0.7 }, { a: 0.02, d: 0.3, s: 0.65, r: 0.25 }, { vib: { rate: 5, cents: 8, delay: 0.25 }, group: 'Synth' }),
  acid: S([o('sawtooth')], { type: 'lowpass', f: 700, q: 11, env: { from: 4.5, time: 0.14 }, track: 0.4 }, { a: 0.004, d: 0.12, s: 0.55, r: 0.06 }, { group: 'Synth' }),
  chipSquare: S([o('square')], { type: 'lowpass', f: 9000, q: 0.3, track: 0 }, { a: 0.002, d: 0.08, s: 0.65, r: 0.03 }, { vib: { rate: 7, cents: 18, delay: 0.22 }, level: 0.55, group: 'Chip' }),
  chipPulse: S([o('square'), o('square', 0.6, { cents: 1200 * Math.log2(1.0035) })], { type: 'highpass', f: 220, q: 0.4, track: 0 }, { a: 0.002, d: 0.06, s: 0.5, r: 0.03 }, { level: 0.45, group: 'Chip' }),
  chipTri: S([o('triangle')], { type: 'lowpass', f: 12000, q: 0.2, track: 0 }, { a: 0.002, d: 0.05, s: 0.9, r: 0.03 }, { level: 0.9, group: 'Chip' }),
  organ: S([o('sine'), o('sine', 0.5, { semis: 12 }), o('sine', 0.3, { semis: 19 }), o('sine', 0.22, { semis: 24 })], { type: 'lowpass', f: 6000, q: 0.4, track: 0.3 }, { a: 0.006, d: 0.05, s: 1, r: 0.08 }, { vib: { rate: 6.6, cents: 6, delay: 0 }, group: 'Keys' }),
  // ---- keys and plucked
  ep: { fm: { ratio: 1, index: 160, modDecay: 0.6, amp: { a: 0.004, d: 1.2, s: 0.25, r: 0.3 }, level: 0.75 }, group: 'Keys' },
  bell: { fm: { ratio: 3.5, index: 380, modDecay: 0.9, amp: { a: 0.002, d: 1.6, s: 0.08, r: 0.9 }, level: 0.42 }, group: 'Keys' },
  marimba: { fm: { ratio: 4, index: 260, modDecay: 0.08, amp: { a: 0.002, d: 0.35, s: 0.0, r: 0.2 }, level: 0.8 }, group: 'Keys' },
  glock: { fm: { ratio: 7, index: 200, modDecay: 0.15, amp: { a: 0.001, d: 0.9, s: 0.0, r: 0.5 }, level: 0.35 }, group: 'Keys' },
  harp: { pluck: { decay: 0.997, brightness: 0.55, level: 0.75 }, group: 'Plucked' },
  lute: { pluck: { decay: 0.994, brightness: 0.7, level: 0.75 }, group: 'Plucked' },
  clav: { pluck: { decay: 0.985, brightness: 0.95, level: 0.7 }, group: 'Plucked' },
  pizz: { pluck: { decay: 0.98, brightness: 0.35, level: 0.95 }, group: 'Plucked' },
  synthPluck: S([o('sawtooth'), o('square', 0.4, { cents: 7 })], { type: 'lowpass', f: 900, q: 4, env: { from: 6, time: 0.18 }, track: 0.5 }, { a: 0.002, d: 0.22, s: 0.0, r: 0.15 }, { group: 'Synth' }),
  // ---- pads
  strings: S([o('sawtooth'), o('sawtooth', 0.8, { cents: 11 }), o('sawtooth', 0.8, { cents: -11 })], { type: 'lowpass', f: 1900, q: 0.6, track: 0.4 }, { a: 0.35, d: 0.6, s: 0.85, r: 0.6 }, { vib: { rate: 4.6, cents: 6, delay: 0.4 }, level: 0.5, group: 'Pad' }),
  choir: S([o('triangle'), o('sawtooth', 0.35, { cents: 8 }), o('triangle', 0.5, { cents: -8 })], { type: 'bandpass', f: 1100, q: 0.9, track: 0.5 }, { a: 0.5, d: 0.5, s: 0.9, r: 0.8 }, { vib: { rate: 4.2, cents: 7, delay: 0.3 }, level: 0.75, group: 'Pad' }),
  warmPad: S([o('triangle'), o('triangle', 0.6, { cents: 9 }), o('sawtooth', 0.2, { cents: -9 })], { type: 'lowpass', f: 1500, q: 0.6, track: 0.3 }, { a: 0.6, d: 0.8, s: 0.85, r: 1.0 }, { level: 0.55, group: 'Pad' }),
  darkPad: S([o('sawtooth'), o('sawtooth', 0.8, { cents: 14 }), o('sine', 0.6, { semis: -12 })], { type: 'lowpass', f: 650, q: 1.4, track: 0.2 }, { a: 1.2, d: 1, s: 0.8, r: 1.6 }, { level: 0.5, group: 'Pad' }),
  glassPad: S([o('sine'), o('sine', 0.4, { semis: 12, cents: 4 }), o('triangle', 0.2, { semis: 19 })], { type: 'lowpass', f: 5000, q: 0.5, track: 0.2 }, { a: 0.8, d: 1, s: 0.8, r: 1.4 }, { vib: { rate: 0.4, cents: 9, delay: 0 }, level: 0.5, group: 'Pad' }),
  supersaw: S([o('sawtooth'), o('sawtooth', 0.6, { cents: 14 }), o('sawtooth', 0.6, { cents: -14 }), o('sawtooth', 0.35, { cents: 27 }), o('sawtooth', 0.35, { cents: -27 })], { type: 'lowpass', f: 3200, q: 0.9, track: 0.3 }, { a: 0.08, d: 0.4, s: 0.8, r: 0.45 }, { level: 0.32, group: 'Pad' }),
  power: S([o('sawtooth'), o('sawtooth', 0.7, { semis: 7 }), o('sawtooth', 0.5, { semis: -12 })], { type: 'lowpass', f: 2400, q: 1.2, track: 0.2 }, { a: 0.004, d: 0.2, s: 0.75, r: 0.08 }, { level: 0.45, drive: 6, group: 'Guitar' }),
  // ---- bass
  subBass: S([o('sine'), o('triangle', 0.3)], { type: 'lowpass', f: 900, q: 0.7, track: 0.3 }, { a: 0.006, d: 0.3, s: 0.85, r: 0.1 }, { group: 'Bass' }),
  synthBass: S([o('sawtooth'), o('square', 0.5, { semis: -12 })], { type: 'lowpass', f: 420, q: 5, env: { from: 3.2, time: 0.12 }, track: 0.5 }, { a: 0.003, d: 0.18, s: 0.6, r: 0.06 }, { group: 'Bass' }),
  pickBass: S([o('square', 0.6), o('triangle')], { type: 'lowpass', f: 700, q: 1.4, env: { from: 2.2, time: 0.08 }, track: 0.5 }, { a: 0.003, d: 0.25, s: 0.55, r: 0.07 }, { group: 'Bass' }),
  distBass: S([o('sawtooth'), o('sawtooth', 0.8, { cents: 8 })], { type: 'lowpass', f: 650, q: 2, env: { from: 2, time: 0.06 }, track: 0.4 }, { a: 0.003, d: 0.12, s: 0.8, r: 0.05 }, { drive: 4, group: 'Bass' }),
  chipBass: S([o('triangle')], { type: 'lowpass', f: 9000, q: 0.2, track: 0 }, { a: 0.002, d: 0.05, s: 1, r: 0.02 }, { level: 1, group: 'Chip' }),
  // ---- drum kits (SlipDAW's synthesized kits)
  kitAcoustic: { kit: 'acoustic', level: 0.9, group: 'Drums' },
  kitRock: { kit: 'breakbeat', level: 0.9, group: 'Drums' },
  kit808: { kit: '808', level: 0.9, group: 'Drums' },
  kit909: { kit: '909', level: 0.85, group: 'Drums' },
  kit606: { kit: '606', level: 0.9, group: 'Drums' },
  kitLofi: { kit: 'lofi', level: 0.9, group: 'Drums' },
  kitTechno: { kit: 'techno', level: 0.85, group: 'Drums' },
  kitTrap: { kit: 'trap', level: 0.85, group: 'Drums' },
};

export const INSTRUMENT_NAMES = Object.keys(INSTRUMENTS);
export const instrumentKind = (id) => {
  const i = INSTRUMENTS[id];
  return !i ? null : i.synth ? 'synth' : i.fm ? 'fm' : i.pluck ? 'pluck' : i.kit ? 'kit' : null;
};

/** SlipDAW drum-kit voice pitches (instruments.js DRUM_VOICES). */
export const DRUM = { k: 36, s: 38, c: 39, h: 42, o: 46, r: 51, p: 48 };

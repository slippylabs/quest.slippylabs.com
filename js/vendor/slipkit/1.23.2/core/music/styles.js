// Music styles: what makes a march a march and a chiptune a chiptune, as
// data the composer (compose.js) reads. A style never holds notes -- it holds
// the RULES a seed rolls notes from, so one style is endless different songs
// that all belong to the same game.
//
// A style:
//   bpm [lo, hi]        modes [[mode, weight]]   tonic [lo, hi] (MIDI of the key's root, bass octave)
//   swing 0..0.5 (of an 8th, or a 16th with swingUnit 16)
//   chordRate           chords per bar (0.5 = one chord every two bars)
//   sevenths 0..1       chance a chord is a 7th     borrowV 0..1  minor key's v made major
//   lift                semitones the last chorus climbs (0 = none)
//   form                [[section, bars]]; sections: intro A B bridge (A/B repeat with variation)
//   lead                { rhythm: lyrical|busy|riff|sparse|march, leap 0..1, artic 0..1, penta? }
//   tracks              [{ id, role, inst, range, gain, pan, tier, rev, dly, in?, pattern?, ... }]
//     role lead|counter|bass|comp|drums.  tier: the intensity it enters at
//     (0 always, 1 >= .25, 2 >= .5, 3 >= .8 -- boss).  in: the sections it plays in.
//     drums: lanes 'ks'|'h'|'p'... from the groove: k kick, s snare, c clap,
//     h closed hat, o open hat, r ride, p perc.
//   grooves             { intro, A, B, bridge } -> GROOVES key (null = no drums)
//   fx                  { reverb: { size, decay, tone, wet }, delay: { beats, fb } | null }

export const GROOVES = {
  // 16 steps a bar: x accent, o normal, g ghost, . rest
  rock: { k: 'x.....o.x.o.....', s: '....x.......x...', h: 'o.o.o.o.o.o.o.o.' },
  rockB: { k: 'x.....o.x.o...o.', s: '....x.......x..g', r: 'x.o.x.o.x.o.x.o.' },
  half: { k: 'x.........o.....', s: '........x.......', h: 'o.o.o.o.o.o.o.o.' },
  halfSoft: { k: 'x.........o.....', s: '........o.......', h: 'o...o...o...o...' },
  punk: { k: 'x...o...x.o.o...', s: '....x.......x...', h: 'o.o.o.o.o.o.o.o.' },
  punkB: { k: 'x.o.x.o.x.o.x.o.', s: '..x...x...x...x.', r: 'x.o.x.o.x.o.x.o.' },
  floor: { k: 'x...x...x...x...', c: '....x.......x...', o: '..o...o...o...o.' },
  floorB: { k: 'x...x...x...x...', c: '....x.......x...', o: '..o...o...o...o.', h: 'gogogogogogogogo' },
  disco: { k: 'x...x...x...x...', s: '....x.......x...', h: 'o.o.o.o.o.o.o.o.', o: '..o...o...o...o.' },
  funk: { k: 'x.....x...x..o..', s: '....x..g.g..x..g', h: 'xoxoxoxoxoxoxoxo' },
  funkB: { k: 'x.....x.x.x..o..', s: '....x..g.g..x.gg', h: 'xoxoxoxoxoxoxoxo', o: '..............o.' },
  lofi: { k: 'x......ox.o.....', s: '....x.......x..g', h: 'o.go.go.o.go.go.' },
  lofiB: { k: 'x......ox.o...o.', s: '....x..g....x..g', h: 'o.go.go.o.go.go.', p: '......o.......o.' },
  march: { k: 'x.......x.......', s: 'o..go.g.o..go.go', p: '' },
  marchB: { k: 'x.......x...o...', s: 'o.gox.g.o.gox.go', r: 'x...o...x...o...' },
  metal: { k: 'xoxoxoxoxoxoxoxo', s: '....x.......x...', r: 'x.o.x.o.x.o.x.o.' },
  metalVerse: { k: 'x.o.x.oox.o.x.oo', s: '....x.......x...', h: 'o.o.o.o.o.o.o.o.' },
  trap: { k: 'x......x..x.....', s: '........x.......', h: 'o.o.o.o.oooo.o.o' },
  tribal: { k: 'x..o..x...o..o..', p: 'o.oo.o.oo.o.oo.o', h: '..g...g...g...g.' },
  tribalB: { k: 'x..o..x.x.o..o..', p: 'oooo.oo.oooo.oo.', s: '....o.......o...', h: 'g.g.g.g.g.g.g.g.' },
  stomp: { k: 'x.x.....x.x.....', c: '....x.......x...', h: 'o.o.o.o.o.o.o.o.' },
  stompB: { k: 'x.x...o.x.x...o.', c: '....x.......x...', r: 'x.o.x.o.x.o.x.o.' },
  chip: { k: 'x.......x.x.....', s: '....x.......x...', h: 'o.o.o.o.o.o.o.o.' },
  chipB: { k: 'x...o...x.x.o...', s: '....x.......x.o.', h: 'oooooooooooooooo' },
  shuffle: { k: 'x.....o.x.......', s: '....x.......x...', h: 'o..oo..oo..oo..o' },
  sleigh: { k: 'x.......x.......', s: '....o.......o...', h: 'oooooooooooooooo' },
  pulse: { k: 'x...............', p: '........o.......' },
  waltzish: { k: 'x.......o.......', s: '....o.......o...', h: 'o.o.o.o.o.o.o.o.' },
};

// Fills for the last bar of a section. Each lane replaces the bar from `from`.
export const FILLS = [
  { from: 8, k: 'x.......', s: '..o.o.oo', p: '' },
  { from: 12, k: 'x...', s: 'oooo', p: '' },
  { from: 8, k: 'x...x...', s: 'o.ooo.oo', p: '' },
  { from: 8, k: 'x.......', s: '....oooo', p: 'oo.o....' },
  { from: 4, k: 'x...x...x...', s: 'o..o..o.oooo', p: '' },
  { from: 12, k: 'x.x.', s: '.o.o', p: '' },
];

const L = (id, inst, range, gain, extra = {}) => ({ id, role: 'lead', inst, range, gain, pan: 0, tier: 0, rev: 0.25, dly: 0, ...extra });
const C = (id, pattern, inst, range, gain, extra = {}) => ({ id, role: 'comp', pattern, inst, range, gain, pan: 0, tier: 0, rev: 0.25, notes: 3, ...extra });
const B = (pattern, inst, gain, extra = {}) => ({ id: 'bass', role: 'bass', pattern, inst, range: [28, 52], gain, pan: 0, tier: 0, rev: 0.05, ...extra });
const D = (id, lanes, inst, gain, extra = {}) => ({ id, role: 'drums', lanes, inst, gain, pan: 0, tier: 1, rev: 0.12, ...extra });
const CT = (id, kind, inst, range, gain, extra = {}) => ({ id, role: 'counter', kind, inst, range, gain, pan: 0, tier: 2, rev: 0.3, in: ['B'], ...extra });

const FORM = [['intro', 4], ['A', 8], ['B', 8], ['A', 8], ['bridge', 8], ['B', 8]];
const FORM_SHORT = [['intro', 2], ['A', 8], ['B', 8], ['A', 8], ['B', 8], ['bridge', 4]];
const FORM_AMBIENT = [['A', 8], ['B', 8], ['A', 8], ['bridge', 8]];

export const STYLES = {
  march: {
    name: 'Fantasy March', for: 'kingsgate', blurb: 'Brass melody over strings and harp, a snare march, timpani on the downbeats.',
    bpm: [92, 108], modes: [['aeolian', 3], ['dorian', 1], ['ionian', 2]], tonic: [43, 50], swing: 0,
    chordRate: 1, sevenths: 0.05, borrowV: 0.8, lift: 0, form: FORM,
    lead: { rhythm: 'march', leap: 0.35, artic: 0.85 },
    tracks: [
      L('lead', 'horn', [60, 79], 0.7, { rev: 0.35, in: ['A', 'B', 'bridge'] }),
      CT('counter', 'harmony', 'flute', [67, 86], 0.3, { pan: 0.3 }),
      C('pad', 'pad', 'strings', [50, 70], 0.26, { rev: 0.45, pan: -0.15 }),
      C('harp', 'alberti', 'harp', [55, 79], 0.3, { tier: 1, pan: 0.25, in: ['A', 'B', 'bridge'] }),
      B('march', 'pizz', 0.42),
      D('drums', 'ks', 'kitAcoustic', 0.22, { tier: 0 }),
      D('cym', 'r', 'kitAcoustic', 0.14, { tier: 2 }),
    ],
    grooves: { intro: 'halfSoft', A: 'march', B: 'marchB', bridge: 'halfSoft' },
    fx: { reverb: { size: 3.2, decay: 2.6, tone: 6500, wet: 0.26 }, delay: null },
  },
  bullethell: {
    name: 'Bullet Hell Metal', for: 'hellstorm', blurb: 'Galloping distorted bass, power chords, a screaming saw lead, double kick.',
    bpm: [144, 164], modes: [['phrygian', 2], ['aeolian', 2], ['harmonic', 2]], tonic: [38, 45], swing: 0,
    chordRate: 1, sevenths: 0, borrowV: 0.5, lift: 1, form: FORM_SHORT,
    lead: { rhythm: 'busy', leap: 0.4, artic: 0.8 },
    tracks: [
      L('lead', 'sawLead', [62, 84], 0.7, { dly: 0.18, rev: 0.2, tier: 1, in: ['A', 'B', 'bridge'] }),
      CT('counter', 'harmony', 'sawLead', [58, 79], 0.3, { pan: -0.3, tier: 3 }),
      C('gtr', 'pulse8', 'power', [40, 60], 0.32, { notes: 2, power: true, rev: 0.1, pan: 0.2 }),
      C('pad', 'pad', 'darkPad', [50, 70], 0.26, { tier: 0, in: ['intro', 'bridge', 'B'] }),
      B('gallop', 'distBass', 0.42),
      D('drums', 'ks', 'kitRock', 0.16, { tier: 1 }),
      D('cym', 'hr', 'kitRock', 0.11, { tier: 2 }),
    ],
    grooves: { intro: 'half', A: 'metalVerse', B: 'metal', bridge: 'half' },
    fx: { reverb: { size: 1.6, decay: 2.2, tone: 5000, wet: 0.16 }, delay: { beats: 0.75, fb: 0.28 } },
  },
  kaiju: {
    name: 'Monster Rock', for: 'kaiju', blurb: 'Surf-rock riffs in phrygian dominant, organ stabs, a stomping backbeat.',
    bpm: [116, 132], modes: [['phrygdom', 2], ['mixolydian', 1], ['dorian', 1]], tonic: [40, 46], swing: 0,
    chordRate: 1, sevenths: 0.1, borrowV: 0.6, lift: 2, form: FORM,
    lead: { rhythm: 'riff', leap: 0.3, artic: 0.7 },
    tracks: [
      L('lead', 'reed', [60, 79], 0.7, { dly: 0.12, in: ['A', 'B', 'bridge'] }),
      CT('counter', 'answer', 'brass', [55, 74], 0.3, { pan: 0.3, tier: 2, in: ['B', 'A'] }),
      C('organ', 'stab', 'organ', [55, 74], 0.32, { tier: 1, pan: -0.25 }),
      C('gtr', 'chords4', 'power', [43, 62], 0.32, { notes: 2, power: true, tier: 0 }),
      B('riff', 'pickBass', 0.42),
      D('drums', 'ks', 'kitRock', 0.22, { tier: 0 }),
      D('hats', 'hr', 'kitRock', 0.14, { tier: 1 }),
    ],
    grooves: { intro: 'half', A: 'rock', B: 'rockB', bridge: 'shuffle' },
    fx: { reverb: { size: 2, decay: 2.4, tone: 6000, wet: 0.2 }, delay: { beats: 0.5, fb: 0.22 } },
  },
  dungeon: {
    name: 'Dungeon Ambience', for: 'deepdark', blurb: 'Slow dark pads, a low pedal, a lonely flute and far-off bells. No drums until it gets bad.',
    bpm: [58, 70], modes: [['harmonic', 2], ['phrygian', 2], ['aeolian', 1]], tonic: [36, 43], swing: 0,
    chordRate: 0.5, sevenths: 0.15, borrowV: 0.7, lift: 0, form: FORM_AMBIENT,
    lead: { rhythm: 'sparse', leap: 0.25, artic: 1 },
    tracks: [
      L('lead', 'flute', [62, 79], 0.7, { rev: 0.6, dly: 0.25, tier: 1 }),
      C('pad', 'pad', 'darkPad', [45, 67], 0.26, { rev: 0.55, notes: 3 }),
      C('choir', 'pad', 'choir', [57, 74], 0.26, { rev: 0.6, tier: 2, in: ['B', 'bridge'] }),
      C('bells', 'bell', 'bell', [72, 91], 0.22, { rev: 0.7, tier: 0, pan: 0.35 }),
      B('pedal', 'subBass', 0.42),
      D('drums', 'kp', 'kitAcoustic', 0.22, { tier: 3 }),
    ],
    grooves: { intro: null, A: 'pulse', B: 'tribal', bridge: 'pulse' },
    fx: { reverb: { size: 5.5, decay: 2.2, tone: 4000, wet: 0.42 }, delay: { beats: 1.5, fb: 0.4 } },
  },
  tribal: {
    name: 'Tribal Drums', for: 'primordia', blurb: 'Pan flute in pentatonic, marimba arpeggios, toms and shakers.',
    bpm: [92, 108], modes: [['dorian', 2], ['mixolydian', 1], ['aeolian', 1]], tonic: [40, 47], swing: 0.12,
    chordRate: 0.5, sevenths: 0, borrowV: 0, lift: 0, form: FORM,
    lead: { rhythm: 'lyrical', leap: 0.35, artic: 0.9, penta: true },
    tracks: [
      L('lead', 'flute', [64, 84], 0.7, { rev: 0.4, dly: 0.15, in: ['A', 'B', 'bridge'] }),
      CT('counter', 'answer', 'marimba', [64, 84], 0.3, { pan: -0.3, in: ['B', 'bridge'] }),
      C('mar', 'arp8', 'marimba', [52, 76], 0.3, { pan: 0.25 }),
      C('pad', 'pad', 'warmPad', [48, 67], 0.26, { rev: 0.5, tier: 1 }),
      B('half', 'subBass', 0.42),
      D('drums', 'kps', 'kitAcoustic', 0.22, { tier: 0 }),
      D('shk', 'h', 'kitAcoustic', 0.14, { tier: 2 }),
    ],
    grooves: { intro: 'tribal', A: 'tribal', B: 'tribalB', bridge: 'tribal' },
    fx: { reverb: { size: 2.6, decay: 2.4, tone: 6000, wet: 0.24 }, delay: { beats: 0.75, fb: 0.25 } },
  },
  tidepool: {
    name: 'Tide Pool', for: 'primordia', blurb: 'Glassy lydian pads and bells, a slow sine bass, nothing that hits.',
    bpm: [66, 80], modes: [['lydian', 2], ['ionian', 1]], tonic: [41, 48], swing: 0,
    chordRate: 0.5, sevenths: 0.4, borrowV: 0, lift: 0, form: FORM_AMBIENT,
    lead: { rhythm: 'sparse', leap: 0.55, artic: 1 },
    tracks: [
      L('lead', 'glock', [72, 91], 0.7, { rev: 0.6, dly: 0.3 }),
      C('pad', 'pad', 'glassPad', [52, 74], 0.26, { rev: 0.6, notes: 4 }),
      C('arp', 'arp8', 'ep', [60, 84], 0.3, { tier: 1, rev: 0.45, pan: -0.3 }),
      B('pedal', 'subBass', 0.42),
      D('drums', 'p', 'kitLofi', 0.14, { tier: 2 }),
    ],
    grooves: { intro: null, A: 'pulse', B: 'pulse', bridge: null },
    fx: { reverb: { size: 5, decay: 2, tone: 7000, wet: 0.45 }, delay: { beats: 1, fb: 0.45 } },
  },
  lofi: {
    name: 'Lo-fi House', for: 'sliplife', blurb: 'Swung lo-fi beats, seventh chords on an electric piano, a soft lead.',
    bpm: [76, 88], modes: [['dorian', 2], ['ionian', 2], ['aeolian', 1]], tonic: [40, 47], swing: 0.28,
    chordRate: 1, sevenths: 0.9, borrowV: 0.3, lift: 0, form: FORM,
    lead: { rhythm: 'lyrical', leap: 0.3, artic: 0.8 },
    tracks: [
      L('lead', 'softLead', [62, 81], 0.7, { rev: 0.35, dly: 0.2, tier: 1, in: ['A', 'B'] }),
      CT('counter', 'answer', 'bell', [69, 88], 0.3, { pan: 0.35 }),
      C('keys', 'stab', 'ep', [52, 72], 0.32, { notes: 4, rev: 0.3 }),
      C('pad', 'pad', 'warmPad', [50, 70], 0.26, { notes: 4, tier: 2, rev: 0.5 }),
      B('walk', 'subBass', 0.42),
      D('drums', 'ks', 'kitLofi', 0.22, { tier: 0 }),
      D('hats', 'hp', 'kitLofi', 0.14, { tier: 0 }),
    ],
    grooves: { intro: 'halfSoft', A: 'lofi', B: 'lofiB', bridge: 'halfSoft' },
    fx: { reverb: { size: 2, decay: 2.5, tone: 4500, wet: 0.22 }, delay: { beats: 0.75, fb: 0.3 } },
  },
  lounge: {
    name: 'Velvet Lounge', for: 'sliplife', blurb: 'Jazzy deep house: organ stabs, octave bass, a four-on-the-floor kick.',
    bpm: [112, 122], modes: [['dorian', 2], ['aeolian', 1], ['mixolydian', 1]], tonic: [40, 46], swing: 0.1,
    chordRate: 0.5, sevenths: 0.85, borrowV: 0.2, lift: 0, form: FORM,
    lead: { rhythm: 'riff', leap: 0.25, artic: 0.6 },
    tracks: [
      L('lead', 'ep', [62, 81], 0.7, { rev: 0.3, dly: 0.2, tier: 1, in: ['A', 'B'] }),
      C('organ', 'stab', 'organ', [55, 74], 0.32, { notes: 4, pan: -0.2 }),
      C('pad', 'pad', 'strings', [52, 72], 0.26, { notes: 4, tier: 2, rev: 0.45 }),
      B('octave', 'synthBass', 0.42),
      D('drums', 'kc', 'kit909', 0.22, { tier: 0 }),
      D('hats', 'ho', 'kit909', 0.14, { tier: 1 }),
    ],
    grooves: { intro: 'pulse', A: 'floor', B: 'floorB', bridge: 'pulse' },
    fx: { reverb: { size: 2.2, decay: 2.5, tone: 5500, wet: 0.2 }, delay: { beats: 0.75, fb: 0.32 } },
  },
  party: {
    name: 'Party Funk', for: 'stars', blurb: 'Bouncy funk: slap-ish bass, clav stabs, brass hits and a bright square lead.',
    bpm: [110, 124], modes: [['mixolydian', 2], ['ionian', 2], ['dorian', 1]], tonic: [40, 47], swing: 0.08,
    chordRate: 1, sevenths: 0.5, borrowV: 0.3, lift: 1, form: FORM,
    lead: { rhythm: 'busy', leap: 0.35, artic: 0.6 },
    tracks: [
      L('lead', 'chipSquare', [64, 84], 0.7, { rev: 0.2, dly: 0.12, in: ['A', 'B', 'bridge'] }),
      CT('counter', 'answer', 'brass', [58, 77], 0.3, { pan: 0.25, tier: 1, in: ['B', 'A'] }),
      C('clav', 'stab', 'clav', [55, 74], 0.32, { pan: -0.25 }),
      C('pad', 'pad', 'organ', [52, 70], 0.26, { tier: 2, in: ['B', 'bridge'] }),
      B('funk', 'synthBass', 0.42),
      D('drums', 'ks', 'kitAcoustic', 0.22, { tier: 0 }),
      D('hats', 'ho', 'kitAcoustic', 0.14, { tier: 1 }),
    ],
    grooves: { intro: 'disco', A: 'funk', B: 'funkB', bridge: 'disco' },
    fx: { reverb: { size: 1.5, decay: 2.6, tone: 7000, wet: 0.15 }, delay: { beats: 0.5, fb: 0.2 } },
  },
  synthwave: {
    name: 'Synthwave', for: 'race', blurb: 'Night-drive outrun: supersaw pads, a 16th pluck arp, octave bass, gated snare.',
    bpm: [100, 116], modes: [['aeolian', 3], ['dorian', 1]], tonic: [40, 47], swing: 0,
    chordRate: 1, sevenths: 0.15, borrowV: 0.1, lift: 2, form: FORM,
    lead: { rhythm: 'lyrical', leap: 0.35, artic: 0.9 },
    tracks: [
      L('lead', 'sawLead', [62, 84], 0.7, { dly: 0.3, rev: 0.3, in: ['A', 'B', 'bridge'] }),
      CT('counter', 'harmony', 'softLead', [57, 77], 0.3, { pan: -0.3 }),
      C('pad', 'pad', 'supersaw', [52, 72], 0.26, { rev: 0.45 }),
      C('arp', 'arp16', 'synthPluck', [57, 81], 0.28, { tier: 1, dlyS: 0.2, pan: 0.25 }),
      B('octave', 'synthBass', 0.42),
      D('drums', 'ks', 'kit808', 0.22, { tier: 0 }),
      D('hats', 'h', 'kit808', 0.14, { tier: 1 }),
    ],
    grooves: { intro: 'halfSoft', A: 'rock', B: 'rockB', bridge: 'half' },
    fx: { reverb: { size: 2.8, decay: 2.2, tone: 6000, wet: 0.24 }, delay: { beats: 0.75, fb: 0.35 } },
  },
  punk: {
    name: 'Skate Punk', for: 'skate', blurb: 'Fast power chords, driving eighth-note bass, a punk beat that never sits down.',
    bpm: [164, 184], modes: [['ionian', 2], ['mixolydian', 2], ['aeolian', 1]], tonic: [40, 47], swing: 0,
    chordRate: 1, sevenths: 0, borrowV: 0.3, lift: 0, form: FORM_SHORT,
    lead: { rhythm: 'riff', leap: 0.3, artic: 0.8 },
    tracks: [
      L('lead', 'sawLead', [62, 81], 0.7, { rev: 0.15, in: ['B', 'bridge'] }),
      C('gtr', 'pulse8', 'power', [40, 60], 0.32, { notes: 2, power: true, rev: 0.08, pan: -0.2 }),
      C('gtr2', 'chords4', 'power', [47, 67], 0.32, { notes: 2, power: true, tier: 2, pan: 0.3 }),
      B('eighths', 'pickBass', 0.42),
      D('drums', 'ks', 'kitRock', 0.22, { tier: 0 }),
      D('cym', 'hr', 'kitRock', 0.14, { tier: 1 }),
    ],
    grooves: { intro: 'half', A: 'punk', B: 'punkB', bridge: 'half' },
    fx: { reverb: { size: 1.2, decay: 2.5, tone: 6000, wet: 0.12 }, delay: null },
  },
  anthem: {
    name: 'Stadium Anthem', for: 'soccer', blurb: 'Stomp-clap, a big brass tune, supersaw chords and a key change into the last chorus.',
    bpm: [118, 128], modes: [['ionian', 3], ['mixolydian', 1]], tonic: [40, 47], swing: 0,
    chordRate: 1, sevenths: 0, borrowV: 0, lift: 2, form: FORM,
    lead: { rhythm: 'march', leap: 0.3, artic: 0.85 },
    tracks: [
      L('lead', 'brass', [60, 79], 0.7, { rev: 0.3, in: ['A', 'B'] }),
      CT('counter', 'harmony', 'horn', [55, 74], 0.3, { pan: 0.25 }),
      C('pad', 'pad', 'supersaw', [52, 72], 0.26, { rev: 0.4 }),
      C('piano', 'chords4', 'ep', [48, 70], 0.32, { tier: 1, pan: -0.2 }),
      B('eighths', 'pickBass', 0.42),
      D('drums', 'kc', 'kitAcoustic', 0.22, { tier: 0 }),
      D('cym', 'hr', 'kitAcoustic', 0.14, { tier: 1 }),
    ],
    grooves: { intro: 'stomp', A: 'stomp', B: 'stompB', bridge: 'half' },
    fx: { reverb: { size: 3, decay: 2.2, tone: 6000, wet: 0.24 }, delay: null },
  },
  techno: {
    name: 'Arena Techno', for: 'arena', blurb: 'A squelching acid line, dark stabs, offbeat bass and a relentless kick.',
    bpm: [128, 138], modes: [['phrygian', 2], ['aeolian', 2]], tonic: [38, 45], swing: 0,
    chordRate: 0.5, sevenths: 0.2, borrowV: 0, lift: 0, form: [['intro', 4], ['A', 8], ['B', 8], ['A', 8], ['bridge', 8], ['B', 8]],
    lead: { rhythm: 'riff', leap: 0.2, artic: 0.5 },
    tracks: [
      L('lead', 'acid', [48, 67], 0.7, { rev: 0.15, dly: 0.2, tier: 1 }),
      C('stab', 'stab', 'darkPad', [52, 70], 0.32, { tier: 2, rev: 0.4 }),
      C('pad', 'pad', 'darkPad', [45, 64], 0.26, { rev: 0.5 }),
      B('offbeat', 'synthBass', 0.42),
      D('drums', 'kc', 'kitTechno', 0.22, { tier: 0 }),
      D('hats', 'ho', 'kitTechno', 0.14, { tier: 1 }),
    ],
    grooves: { intro: 'floor', A: 'floor', B: 'floorB', bridge: 'pulse' },
    fx: { reverb: { size: 2.4, decay: 2.4, tone: 5000, wet: 0.2 }, delay: { beats: 0.75, fb: 0.4 } },
  },
  chiptune: {
    name: 'Chiptune Action', for: '2d', blurb: 'NES-style: two square channels, a triangle bass, fast arpeggios, noise drums.',
    bpm: [138, 160], modes: [['aeolian', 2], ['ionian', 2], ['dorian', 1]], tonic: [40, 47], swing: 0,
    chordRate: 1, sevenths: 0, borrowV: 0.6, lift: 1, form: FORM_SHORT,
    lead: { rhythm: 'busy', leap: 0.4, artic: 0.75 },
    tracks: [
      L('lead', 'chipSquare', [64, 86], 0.7, { rev: 0.08, in: ['A', 'B', 'bridge'] }),
      CT('counter', 'harmony', 'chipPulse', [57, 79], 0.3, { pan: -0.2, tier: 1 }),
      C('arp', 'arp16', 'chipPulse', [55, 79], 0.28, { pan: 0.2 }),
      B('octave', 'chipBass', 0.42),
      D('drums', 'ks', 'kit606', 0.22, { tier: 0 }),
      D('hats', 'h', 'kit606', 0.14, { tier: 1 }),
    ],
    grooves: { intro: 'chip', A: 'chip', B: 'chipB', bridge: 'half' },
    fx: { reverb: { size: 0.8, decay: 3, tone: 8000, wet: 0.08 }, delay: null },
  },
  puzzle: {
    name: 'Chip Puzzle', for: '2d', blurb: 'Calm chiptune: a triangle melody, Alberti arpeggios, a light shuffle.',
    bpm: [100, 116], modes: [['ionian', 2], ['lydian', 1], ['dorian', 1]], tonic: [41, 48], swing: 0.15,
    chordRate: 1, sevenths: 0.2, borrowV: 0, lift: 0, form: FORM,
    lead: { rhythm: 'lyrical', leap: 0.3, artic: 0.7 },
    tracks: [
      L('lead', 'chipTri', [64, 84], 0.7, { rev: 0.12, in: ['A', 'B', 'bridge'] }),
      CT('counter', 'answer', 'chipSquare', [64, 84], 0.3, { pan: 0.3 }),
      C('alb', 'alberti', 'chipPulse', [55, 76], 0.3, { pan: -0.2 }),
      B('half', 'chipBass', 0.42),
      D('drums', 'ks', 'kit606', 0.22, { tier: 1 }),
      D('hats', 'h', 'kit606', 0.14, { tier: 1 }),
    ],
    grooves: { intro: null, A: 'shuffle', B: 'chip', bridge: 'halfSoft' },
    fx: { reverb: { size: 1, decay: 3, tone: 8000, wet: 0.1 }, delay: null },
  },
  adventure: {
    name: 'RPG Adventure', for: 'quest', blurb: 'Lute strums, a recorder tune, strings, light hand drums.',
    bpm: [86, 100], modes: [['dorian', 2], ['aeolian', 1], ['ionian', 2], ['mixolydian', 1]], tonic: [41, 48], swing: 0.1,
    chordRate: 1, sevenths: 0.05, borrowV: 0.5, lift: 0, form: FORM,
    lead: { rhythm: 'lyrical', leap: 0.35, artic: 0.85 },
    tracks: [
      L('lead', 'flute', [64, 84], 0.7, { rev: 0.35, in: ['A', 'B', 'bridge'] }),
      CT('counter', 'answer', 'reed', [57, 76], 0.3, { pan: -0.3 }),
      C('lute', 'strum', 'lute', [50, 72], 0.32, { pan: 0.2 }),
      C('pad', 'pad', 'strings', [48, 69], 0.26, { tier: 1, rev: 0.45 }),
      B('half', 'pizz', 0.42),
      D('drums', 'kps', 'kitAcoustic', 0.22, { tier: 1 }),
      D('tamb', 'h', 'kitAcoustic', 0.14, { tier: 2 }),
    ],
    grooves: { intro: null, A: 'tribal', B: 'waltzish', bridge: 'halfSoft' },
    fx: { reverb: { size: 2.6, decay: 2.5, tone: 6000, wet: 0.24 }, delay: null },
  },
  ballpark: {
    name: 'Ballpark Organ', for: 'slugger', blurb: 'Stadium organ tunes over an oom-pah bass and a shuffle.',
    bpm: [120, 138], modes: [['ionian', 3], ['mixolydian', 1]], tonic: [41, 48], swing: 0.2,
    chordRate: 1, sevenths: 0.3, borrowV: 0, lift: 1, form: FORM_SHORT,
    lead: { rhythm: 'busy', leap: 0.4, artic: 0.7 },
    tracks: [
      L('lead', 'organ', [62, 84], 0.7, { rev: 0.35, in: ['A', 'B', 'bridge'] }),
      C('comp', 'oompah', 'organ', [52, 72], 0.32, { pan: -0.2 }),
      B('march', 'pickBass', 0.42),
      D('drums', 'ks', 'kitAcoustic', 0.22, { tier: 1 }),
      D('hats', 'h', 'kitAcoustic', 0.14, { tier: 1 }),
    ],
    grooves: { intro: null, A: 'shuffle', B: 'rockB', bridge: 'shuffle' },
    fx: { reverb: { size: 3.2, decay: 2.2, tone: 5000, wet: 0.3 }, delay: null },
  },
  sleigh: {
    name: 'Winter Sleigh', for: 'skihill', blurb: 'Glockenspiel tune, pizzicato strings, sleigh-bell sixteenths.',
    bpm: [128, 146], modes: [['ionian', 3], ['lydian', 1], ['aeolian', 1]], tonic: [41, 48], swing: 0.08,
    chordRate: 1, sevenths: 0.15, borrowV: 0.3, lift: 1, form: FORM_SHORT,
    lead: { rhythm: 'march', leap: 0.4, artic: 0.7 },
    tracks: [
      L('lead', 'glock', [67, 88], 0.7, { rev: 0.35, in: ['A', 'B', 'bridge'] }),
      CT('counter', 'harmony', 'flute', [62, 81], 0.3, { pan: 0.3 }),
      C('pizz', 'alberti', 'pizz', [52, 74], 0.3, { pan: -0.2 }),
      C('pad', 'pad', 'strings', [52, 72], 0.26, { tier: 1, rev: 0.45 }),
      B('march', 'pizz', 0.42),
      D('drums', 'ks', 'kitAcoustic', 0.22, { tier: 1 }),
      D('bells', 'h', 'kitAcoustic', 0.14, { tier: 0 }),
    ],
    grooves: { intro: 'sleigh', A: 'sleigh', B: 'rock', bridge: 'sleigh' },
    fx: { reverb: { size: 2.4, decay: 2.4, tone: 7000, wet: 0.22 }, delay: null },
  },
};

export const STYLE_NAMES = Object.keys(STYLES);

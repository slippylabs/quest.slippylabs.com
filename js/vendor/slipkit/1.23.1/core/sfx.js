// Generated sound as DATA: every one-shot and every continuous voice the games
// built by hand (Slipstream's engine and impacts, Skate Park's board, Slip
// Soccer's crowd, Deepdark's crypt), as tables a player (kit/audio/sfx.js)
// turns into WebAudio nodes. No audio files anywhere, for the reason the art is
// procedural: nothing to host, license or wait for.
//
// Pure (no AudioContext, no DOM), so tools/sfx.mjs checks every preset under
// node and a game's server could name sounds without loading the player.
//
// A ONE-SHOT is a list of layers:
//   { t: 'tone',  wave: sine|triangle|square|sawtooth, f, to?, dur, gain, attack?, delay? }
//   { t: 'noise', filter: lowpass|highpass|bandpass, f, to?, q?, dur, gain, attack?, delay?, soft? }
// `f` / `to` are Hz (`to` = the frequency it slides to; omitted = holds). Any
// number may instead be [lo, hi], read at the call's `amt` (0..1): that is how
// one preset covers a tap and a slam. `when: x` keeps a layer only at amt >= x
// (a bigger line plays more of the arpeggio). `soft` noise is the one-pole
// low-passed rumble the racer and the skater use; plain noise is white.
//
// A VOICE is a small node graph that runs continuously and is steered with
// set(params) -- never retriggered per frame, which clicks:
//   nodes: { name: { osc: wave, f, detune? } | { noise: 'soft'|'white' }
//                  | { filter: type, f, q } | { gain: g } | { pan: true } }
//   links: [[from, to], ...]  to = a node, `node.param` (an LFO), or 'out'
//   targets(p) -> { 'node.param': value }  -- pure, so the mix is testable

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, t) => a + (b - a) * t;

// ---- one-shots ------------------------------------------------------------

const T = (wave, f, to, dur, gain, extra = {}) => ({ t: 'tone', wave, f, ...(to == null ? {} : { to }), dur, gain, ...extra });
const N = (filter, f, dur, gain, extra = {}) => ({ t: 'noise', filter, f, dur, gain, q: 1, ...extra });
const semis = (root, steps, dur, gain, wave, gap, extra = {}) => steps.map((s, i) => T(wave, root * 2 ** (s / 12), null, dur, gain, { delay: i * gap, ...extra }));

export const SFX_PRESETS = {
  // ---- Slipstream (race): impacts and the race's cues. amt = how hard.
  crash: { group: 'Vehicle', from: 'race', layers: [
    N('bandpass', 520, [0.07, 0.13], [0.06, 0.5], { q: 0.6, soft: true }),
    T('triangle', [127, 180], 48, 0.16, [0.05, 0.39]),
    N('highpass', 2600, 0.22, [0.02, 0.15], { q: 0.8, soft: true }),
  ] },
  scrape: { group: 'Vehicle', from: 'race', layers: [N('bandpass', 2200, 0.2, [0.02, 0.14], { q: 1.4, soft: true })] },
  carLand: { group: 'Vehicle', from: 'race', layers: [
    N('lowpass', [680, 1120], 0.1, [0.04, 0.26], { q: 0.9, soft: true }),
    T('triangle', 96, 50, 0.12, [0.04, 0.26]),
  ] },
  spikeStrip: { group: 'Vehicle', from: 'race', layers: [
    N('highpass', 3400, 0.08, 0.3, { q: 0.9, soft: true }), N('bandpass', 2400, 0.55, 0.16, { q: 0.7, soft: true }),
    T('sawtooth', 300, 90, 0.5, 0.08),
  ] },
  nitro: { group: 'Vehicle', from: 'race', layers: [N('highpass', 2200, 0.1, 0.26, { q: 0.7, soft: true }), T('sawtooth', 160, 420, 0.3, 0.1)] },
  handbrake: { group: 'Vehicle', from: 'race', layers: [
    ...[0, 1, 2, 3].map((i) => N('bandpass', 2400 + i * 180, 0.012, 0.1, { q: 6, soft: true, delay: i * 0.012 })),
    T('square', 150, 90, 0.05, 0.06, { delay: 0.035 }),
  ] },
  // Louder than the originals' 0.12: rendered and measured, a 45 ms burst through
  // a narrow band peaked at 0.007 -- there, but nobody would hear it.
  gearShift: { group: 'Vehicle', from: 'race', layers: [N('bandpass', [1500, 2000], 0.045, 0.3, { q: 1.6, soft: true })] },
  horn: { group: 'Vehicle', from: 'race', layers: [T('square', 392, null, 0.26, 0.14), T('square', 494, null, 0.26, 0.1)] },
  countBeep: { group: 'Race', from: 'race', layers: [T('square', 440, null, 0.14, 0.2)] },
  countGo: { group: 'Race', from: 'race', layers: [T('square', 880, null, 0.34, 0.26), T('square', 1320, null, 0.3, 0.1, { delay: 0.02 })] },
  lap: { group: 'Race', from: 'race', layers: semis(523.25, [0, 7], 0.2, 0.14, 'triangle', 0.075) },
  finish: { group: 'Race', from: 'race', layers: semis(523.25, [0, 4, 7, 12], 0.2, 0.14, 'triangle', 0.075) },
  busted: { group: 'Race', from: 'race', layers: [
    T('sawtooth', 440, 110, 0.7, 0.2), T('triangle', 700, 1200, 0.22, 0.1, { delay: 0.05 }), N('lowpass', 1200, 0.5, 0.18, { q: 0.7, soft: true }),
  ] },
  escaped: { group: 'Race', from: 'race', layers: [T('triangle', 392, null, 0.18, 0.14), T('triangle', 587.33, null, 0.26, 0.14, { delay: 0.1 })] },
  heatUp: { group: 'Race', from: 'race', layers: [T('square', 300, 520, 0.22, 0.16)] },

  // ---- Skate Park: the board. amt = charge / force / line size.
  ollie: { group: 'Skate', from: 'skate', layers: [
    N('highpass', [1400, 1100], [0.075, 0.095], [0.3, 0.52], { soft: true }),
    T('triangle', [150, 190], 60, 0.1, [0.16, 0.26], { attack: 0.008 }),
  ] },
  boardLand: { group: 'Skate', from: 'skate', layers: [
    N('lowpass', [870, 1400], 0.1, [0.05, 0.31], { q: 0.9, soft: true }),
    T('triangle', 110, 55, 0.11, [0.05, 0.28], { attack: 0.008 }),
  ] },
  sketchyLand: { group: 'Skate', from: 'skate', layers: [
    N('lowpass', 1100, 0.1, 0.2, { q: 0.9, soft: true }), T('triangle', 110, 55, 0.11, 0.18, { attack: 0.008 }),
    N('bandpass', 2600, 0.26, 0.1, { q: 1.2, soft: true }),
  ] },
  bail: { group: 'Skate', from: 'skate', layers: [
    N('lowpass', 1500, 0.5, 0.34, { q: 0.7, soft: true }), T('sawtooth', 220, 70, 0.42, 0.16, { attack: 0.008 }),
    N('bandpass', 3200, 0.28, 0.12, { q: 0.9, soft: true }),
  ] },
  kickflip: { group: 'Skate', from: 'skate', layers: [N('bandpass', 1500, 0.17, 0.16, { q: 0.9, soft: true })] },
  grab: { group: 'Skate', from: 'skate', layers: [T('sine', 420, 300, 0.16, 0.08, { attack: 0.008 })] },
  bank: { group: 'Skate', from: 'skate', layers: semis(440, [0, 4, 7, 12], 0.2, 0.13, 'triangle', 0.065, { attack: 0.008 }).map((l, i) => (i >= 2 ? { ...l, when: i === 2 ? 0.3 : 0.7 } : l)) },
  pushOff: { group: 'Skate', from: 'skate', layers: [N('bandpass', 520, 0.18, 0.16, { q: 0.8, soft: true })] },
  railHit: { group: 'Skate', from: 'skate', layers: [N('highpass', 2600, 0.09, 0.26, { q: 1.4, soft: true })] },
  ledgeHit: { group: 'Skate', from: 'skate', layers: [N('highpass', 1200, 0.09, 0.26, { q: 1.4, soft: true })] },
  respawn: { group: 'Skate', from: 'skate', layers: [T('sine', 300, 620, 0.18, 0.12, { attack: 0.008 })] },

  // ---- Slip Soccer: the ball and the referee. amt = pace.
  kick: { group: 'Ball', from: 'soccer', layers: [
    T('sine', [140, 200], [63, 90], 0.09, [0.25, 0.6]),
    N('bandpass', [900, 2500], 0.06, [0.18, 0.48], { q: 1.2 }),
  ] },
  shot: { group: 'Ball', from: 'soccer', layers: [
    T('sine', [95, 135], [33, 47], 0.16, [0.4, 0.7]),
    N('highpass', 2600, 0.05, [0.25, 0.5]),
    N('bandpass', [1200, 2600], 0.09, [0.25, 0.5]),
    N('bandpass', 650, 0.9, [0.08, 0.18], { q: 0.7, attack: 0.12, delay: 0.05 }),
  ] },
  bounce: { group: 'Ball', from: 'soccer', layers: [T('sine', 95, 57, 0.07, [0.04, 0.25])] },
  post: { group: 'Ball', from: 'soccer', layers: [T('triangle', 1320, null, 0.45, 0.22), T('sine', 1985, null, 0.3, 0.1), N('highpass', 3000, 0.05, 0.15)] },
  net: { group: 'Ball', from: 'soccer', layers: [N('bandpass', 2400, 0.35, [0.1, 0.35], { q: 0.8, attack: 0.02 })] },
  board: { group: 'Ball', from: 'soccer', layers: [
    T('sine', 72, 50, 0.12, [0.18, 0.48]), N('lowpass', [500, 1000], 0.09, [0.12, 0.37]),
    N('highpass', 3500, 0.18, 0.05, { delay: 0.01, when: 0.5 }),
  ] },
  tackle: { group: 'Ball', from: 'soccer', layers: [N('lowpass', 600, 0.12, 0.3)] },
  whistle: { group: 'Ball', from: 'soccer', layers: [T('square', 2950, null, 0.22, 0.06, { attack: 0.01 }), T('sine', 3080, null, 0.22, 0.08, { attack: 0.01 })] },
  whistleLong: { group: 'Ball', from: 'soccer', layers: [0, 0.42, 0.84].flatMap((d) => [T('square', 2950, null, 0.34, 0.06, { attack: 0.01, delay: d }), T('sine', 3080, null, 0.34, 0.08, { attack: 0.01, delay: d })]) },
  goal: { group: 'Ball', from: 'soccer', layers: [
    N('bandpass', 900, 2.6, 0.5, { q: 0.5, attack: 0.15 }), N('bandpass', 2200, 2.0, 0.25, { q: 0.9, attack: 0.25 }),
    ...[0, 1, 2].map((i) => T('triangle', 523 + i * 131, null, 0.5, 0.07, { delay: i * 0.12 })),
  ] },
  save: { group: 'Ball', from: 'soccer', layers: [N('bandpass', 500, 1.1, 0.3, { q: 1.4, attack: 0.08 })] },

  // ---- Deepdark: the crypt. Positional by nature (pass `pos`).
  swing: { group: 'Melee', from: 'deepdark', layers: [N('bandpass', 1400, 0.2, 0.35, { q: 2, to: 300 })] },
  bowLoose: { group: 'Melee', from: 'deepdark', layers: [T('triangle', 220, 90, 0.14, 0.3), N('bandpass', 3000, 0.05, 0.15)] },
  hit: { group: 'Melee', from: 'deepdark', layers: [N('lowpass', 600, 0.08, 0.5), T('sine', 140, 55, 0.12, 0.4)] },
  hurt: { group: 'Melee', from: 'deepdark', layers: [T('square', 120, 60, 0.25, 0.18), N('lowpass', 400, 0.15, 0.3)] },
  kill: { group: 'Melee', from: 'deepdark', layers: [N('lowpass', 900, 0.35, 0.45, { to: 120 }), T('sawtooth', 180, 40, 0.4, 0.12)] },
  coins: { group: 'Dungeon', from: 'deepdark', layers: [1320, 1660, 2090].map((f, i) => T('square', f, f * 1.01, 0.09, 0.08, { delay: i * 0.06 })) },
  door: { group: 'Dungeon', from: 'deepdark', layers: [T('sawtooth', 110, 160, 0.5, 0.08, { attack: 0.05 }), T('triangle', 80, 70, 0.35, 0.15, { delay: 0.35 })] },
  unlock: { group: 'Dungeon', from: 'deepdark', layers: [T('square', 900, 620, 0.06, 0.12), T('triangle', 140, 90, 0.18, 0.3, { delay: 0.07 })] },
  stoneGrind: { group: 'Dungeon', from: 'deepdark', layers: [N('lowpass', 260, 2.2, 0.4, { to: 140, q: 4 }), T('sawtooth', 48, 40, 2.2, 0.12, { attack: 0.2 })] },
  lid: { group: 'Dungeon', from: 'deepdark', layers: [N('bandpass', 500, 0.9, 0.3, { to: 260, q: 2 })] },
  chest: { group: 'Dungeon', from: 'deepdark', layers: [T('sawtooth', 80, 150, 0.45, 0.1), ...[1320, 1660, 2090].map((f, i) => T('square', f, f * 1.01, 0.09, 0.08, { delay: i * 0.06 }))] },
  portal: { group: 'Dungeon', from: 'deepdark', layers: [T('sine', 180, 520, 1.4, 0.25, { attack: 0.3 }), T('sine', 270, 780, 1.4, 0.12, { attack: 0.3 })] },
  step: { group: 'Dungeon', from: 'deepdark', layers: [N('lowpass', [350, 500], 0.06, 0.3, { soft: true })] },   // 0.09 of white noise measured near silent
  torchOut: { group: 'Dungeon', from: 'deepdark', layers: [N('bandpass', 2000, 0.3, 0.2, { to: 600 })] },
  torchLit: { group: 'Dungeon', from: 'deepdark', layers: [N('bandpass', 600, 0.35, 0.25, { to: 2400 })] },
  crackle: { group: 'Dungeon', from: 'deepdark', layers: [N('bandpass', [1200, 3700], [0.03, 0.08], [0.1, 0.2], { q: 2 })] },   // the torch's pops; play every 0.05-0.3 s
  growl: { group: 'Monster', from: 'deepdark', layers: [T('sawtooth', 70, 55, 0.45, 0.22, { attack: 0.05 }), N('lowpass', 300, 0.4, 0.15)] },
  bolt: { group: 'Monster', from: 'deepdark', layers: [T('square', 700, 250, 0.25, 0.12), N('bandpass', 2500, 0.2, 0.1, { to: 800 })] },
  bossDown: { group: 'Monster', from: 'deepdark', layers: [T('sawtooth', 90, 30, 1.6, 0.35), N('lowpass', 500, 1.5, 0.5, { to: 50 })] },
  swarmClose: { group: 'Monster', from: 'deepdark', layers: [T('sawtooth', 45, 38, 1.2, 0.15, { attack: 0.3 })] },
  drink: { group: 'Player', from: 'deepdark', layers: [T('sine', 320, 220, 0.12, 0.25), T('sine', 300, 200, 0.12, 0.25, { delay: 0.18 })] },
  death: { group: 'Player', from: 'deepdark', layers: [T('sawtooth', 200, 40, 1.2, 0.25), N('lowpass', 800, 1.2, 0.4, { to: 60 })] },
  extract: { group: 'Player', from: 'deepdark', layers: [523, 659, 784, 1046].map((f, i) => T('sine', f, null, 0.35, 0.18, { delay: i * 0.12 })) },
  secondWind: { group: 'Player', from: 'deepdark', layers: [T('triangle', 260, 620, 0.5, 0.25)] },
  shadowstep: { group: 'Player', from: 'deepdark', layers: [N('highpass', 4000, 0.8, 0.25, { to: 300 })] },
  arcaneBolt: { group: 'Player', from: 'deepdark', layers: [880, 1175, 1480].map((f, i) => T('square', f, f / 3, 0.25, 0.1, { delay: i * 0.04 })) },
  sanctuary: { group: 'Player', from: 'deepdark', layers: [440, 554, 659].map((f) => T('sine', f, null, 1.2, 0.12, { attack: 0.25 })) },
  ping: { group: 'UI', from: 'deepdark', layers: [T('triangle', 1320, null, 0.07, 0.16), T('triangle', 1760, null, 0.09, 0.12, { delay: 0.07 })] },
  call: { group: 'UI', from: 'deepdark', layers: [T('sine', 520, 660, 0.12, 0.12), T('sine', 660, 880, 0.14, 0.1, { delay: 0.1 })] },
  ui: { group: 'UI', from: 'race', layers: [T('triangle', 660, null, 0.05, 0.05)] },
  click: { group: 'UI', from: 'soccer', layers: [T('triangle', 880, null, 0.06, 0.12)] },
  switchMan: { group: 'UI', from: 'soccer', layers: [T('triangle', 660, 990, 0.05, 0.07)] },

  // ---- the studio's own: what a generated game and the Shooter mode fire.
  jump: { group: 'Player', from: 'studio', layers: [T('triangle', 260, 520, 0.14, 0.16), N('lowpass', 900, 0.06, 0.08)] },
  footstep: { group: 'Player', from: 'studio', layers: [N('lowpass', [320, 520], 0.07, [0.07, 0.14], { soft: true }), T('sine', 90, 60, 0.05, 0.05)] },
  heal: { group: 'Player', from: 'studio', layers: semis(523.25, [0, 4, 7], 0.22, 0.1, 'sine', 0.06) },
  checkpoint: { group: 'Player', from: 'studio', layers: semis(659.25, [0, 7, 12], 0.18, 0.13, 'triangle', 0.07) },
  win: { group: 'Player', from: 'studio', layers: [...semis(523.25, [0, 4, 7, 12, 16], 0.3, 0.13, 'triangle', 0.09), N('bandpass', 2400, 0.6, 0.05, { q: 0.6, delay: 0.36 })] },
  lose: { group: 'Player', from: 'studio', layers: [T('sawtooth', 330, 110, 0.6, 0.14), T('triangle', 220, 70, 0.7, 0.12, { delay: 0.12 })] },
  gunshot: { group: 'Weapon', from: 'studio', layers: [
    N('highpass', 1800, 0.05, [0.3, 0.45], { q: 0.7 }), N('bandpass', 700, [0.12, 0.2], [0.25, 0.4], { q: 0.8, soft: true }),
    T('triangle', 150, 50, 0.1, 0.25),
  ] },
  shotgun: { group: 'Weapon', from: 'studio', layers: [
    N('highpass', 1200, 0.07, 0.4, { q: 0.6 }), N('lowpass', 900, 0.32, 0.45, { q: 0.7, soft: true, to: 180 }), T('sine', 90, 38, 0.2, 0.4),
  ] },
  laser: { group: 'Weapon', from: 'studio', layers: [T('square', 1800, 300, 0.14, 0.09), T('sine', 2400, 600, 0.12, 0.08)] },
  rocketLaunch: { group: 'Weapon', from: 'studio', layers: [N('bandpass', 800, 0.5, 0.35, { q: 0.6, to: 2200, soft: true }), T('sawtooth', 110, 70, 0.35, 0.12)] },
  explosion: { group: 'Weapon', from: 'studio', layers: [
    N('lowpass', [700, 1400], [0.6, 1.2], [0.4, 0.6], { q: 0.7, soft: true, to: 90 }), T('sine', 70, 30, [0.4, 0.7], [0.35, 0.55]),
    N('highpass', 2800, 0.25, [0.06, 0.14], { q: 0.8, delay: 0.02 }),
  ] },
  reload: { group: 'Weapon', from: 'studio', layers: [N('bandpass', 1800, 0.03, 0.18, { q: 5 }), N('bandpass', 1200, 0.04, 0.2, { q: 4, delay: 0.25 }), T('square', 260, 160, 0.04, 0.06, { delay: 0.28 })] },
  dryFire: { group: 'Weapon', from: 'studio', layers: [N('bandpass', 2600, 0.03, 0.45, { q: 2.5 }), T('square', 900, 600, 0.02, 0.05)] },
  hitMarker: { group: 'Weapon', from: 'studio', layers: [T('square', 1600, null, 0.035, 0.06)] },
  headshot: { group: 'Weapon', from: 'studio', layers: [T('square', 1600, null, 0.035, 0.06), T('triangle', 2400, null, 0.08, 0.1, { delay: 0.03 })] },
  targetBreak: { group: 'Weapon', from: 'studio', layers: [N('bandpass', 1500, 0.35, 0.3, { q: 0.8, to: 400 }), T('triangle', 300, 90, 0.25, 0.14)] },
};

export const SFX_NAMES = Object.keys(SFX_PRESETS);

/**
 * A preset's layers made concrete for one call: amt read, pitch and gain
 * applied, `when` resolved -- and, since v2, VARIED:
 *   variant: 0..n-1   one of the preset's round-robin variants (presetVariant)
 *   jitter:  () => 0..1  a random source for a small per-play wobble on top
 *   theme:   a THEMES entry (or name) -- the game's timbre
 * With none of the three it is the v1 call, exactly (the tests' fixed point).
 */
export function resolveLayers(name, { amt = 0.5, pitch = 1, gain = 1, variant = null, jitter = null, theme = null, presets = SFX_PRESETS } = {}) {
  const pre = presets[name];
  if (!pre) return [];
  const a = clamp(Number.isFinite(amt) ? amt : 0.5, 0, 1);
  const at = (v) => (Array.isArray(v) ? lerp(v[0], v[1], a) : v);
  const th = typeof theme === 'string' ? THEMES[theme] : theme;
  const layers = pre.alts && variant !== null ? pre.alts[variant % pre.alts.length] : pre.alts ? pre.alts[0] : pre.layers;
  const V = variant !== null ? presetVariant(name, variant, presets) : null;
  const vy = varyOf(pre);
  // Per-play wobble: a fifth of the preset's spread, whole-sound.
  const wob = jitter && vy ? { p: (jitter() * 2 - 1) * vy.pitch * 0.2, g: (jitter() * 2 - 1) * vy.gain * 0.2 } : { p: 0, g: 0 };
  const thPitch = th ? 2 ** ((th.pitch || 0) / 12) : 1;
  const out = [];
  layers.forEach((L, i) => {
    if (L.when !== undefined && a < L.when) return;
    const lv = V ? V.layers[i % V.layers.length] : null;
    const semis = (V ? V.pitch + (lv ? lv.pitch : 0) : 0) + wob.p;
    const pm = pitch * 2 ** (semis / 12) * thPitch;
    const gm = gain * 10 ** (((V ? V.gain + (lv ? lv.gain : 0) : 0) + wob.g) / 20) * (th?.gain ?? 1);
    if (L.t === 'sfxr') {
      out.push({ t: 'sfxr', code: L.code, params: L.params, gen: L.gen, seed: (L.seed ?? 1) + (V && L.gen ? variant : 0), rate: pm, gain: Math.max(0, at(L.gain ?? 1) * gm), delay: Math.max(0, at(L.delay ?? 0) + (lv ? lv.delay : 0)), dur: 0.05, f: 440, attack: 0.001, q: 1 });
      return;
    }
    const r = { t: L.t, wave: th?.wave?.[L.wave] || L.wave, filter: L.filter, soft: !!L.soft };
    const fm = L.t === 'noise' ? (lv ? 1 + lv.filter : 1) * (th?.bright ?? 1) : 1;
    r.f = clamp(at(L.f) * (L.t === 'noise' ? fm * Math.sqrt(pm) : pm), 20, 20000);
    if (L.to !== undefined) r.to = clamp(at(L.to) * (L.t === 'noise' ? fm * Math.sqrt(pm) : pm), 20, 20000);
    r.q = L.q === undefined ? 1 : at(L.q);
    r.dur = Math.max(0.005, at(L.dur) * (th?.decay ?? 1) * (lv ? 1 + lv.dur : 1));
    r.gain = Math.max(0, at(L.gain) * gm);
    r.attack = Math.min(r.dur * 0.5, at(L.attack ?? (L.t === 'tone' ? 0.008 : 0.002)));
    r.delay = Math.max(0, at(L.delay ?? 0) + (lv ? lv.delay : 0));
    r.offset = V ? V.offset : 0;
    out.push(r);
  });
  return out;
}

// ---- variation (v2) -------------------------------------------------------
//
// "All sounds exactly the same" was literal: every play of a preset rebuilt
// the same nodes with the same numbers. Two mechanisms fix it, both data:
//   * VARIANTS: each preset has `variants` (default 4) seeded takes. A take
//     moves the whole sound by up to `pitch` semitones and `gain` dB, and --
//     for a non-musical sound -- moves each layer a little on its own, its
//     noise filter, its length and its timing, and starts the noise
//     somewhere else. The player plays them round-robin, never the same take
//     twice running.
//   * JITTER: a small random wobble on top of each play (a fifth of the spread).
// Musical sounds (a jingle, a beep, a chord) move only as a WHOLE and only a
// little, so their intervals stay in tune; `vary: false` turns it all off.

/** The spread a group gets unless its preset says otherwise. */
export const VARY_BY_GROUP = {
  UI: { pitch: 0.3, gain: 0.8, time: 0, filter: 0.04, dur: 0.04, variants: 3, musical: true },
  Race: { pitch: 0.2, gain: 0.8, time: 0, filter: 0.05, dur: 0.04, variants: 3, musical: true },
  Player: { pitch: 1.6, gain: 1.8, time: 0.006, filter: 0.18, dur: 0.12, variants: 4 },
  Weapon: { pitch: 1.4, gain: 1.6, time: 0.004, filter: 0.2, dur: 0.12, variants: 5 },
  Melee: { pitch: 2.2, gain: 2, time: 0.006, filter: 0.22, dur: 0.15, variants: 5 },
  Monster: { pitch: 2.5, gain: 2, time: 0.01, filter: 0.2, dur: 0.18, variants: 4 },
  Dungeon: { pitch: 1.8, gain: 2, time: 0.008, filter: 0.2, dur: 0.15, variants: 4 },
  Ball: { pitch: 1.5, gain: 1.8, time: 0.004, filter: 0.18, dur: 0.12, variants: 4 },
  Skate: { pitch: 1.5, gain: 1.8, time: 0.004, filter: 0.2, dur: 0.12, variants: 4 },
  Vehicle: { pitch: 1.4, gain: 1.8, time: 0.006, filter: 0.2, dur: 0.12, variants: 4 },
  default: { pitch: 1.5, gain: 1.8, time: 0.006, filter: 0.18, dur: 0.12, variants: 4 },
};

// A preset is musical when it plays two or more tones at distinct fixed
// pitches (an arpeggio, a chord, a two-note beep): a per-layer pitch wobble
// would put it out of tune.
function isMusical(pre) {
  // A slide of a few percent (coins' f -> f * 1.01) is still a fixed pitch.
  const fixed = (l) => l.t === 'tone' && !Array.isArray(l.f) && (l.to === undefined || (!Array.isArray(l.to) && Math.abs(l.to / l.f - 1) < 0.03));
  const tones = (pre.layers || []).filter(fixed);
  return tones.length >= 2 && new Set(tones.map((l) => String(l.f))).size >= 2;
}

/** The variation a preset gets (null = none). */
export function varyOf(pre) {
  if (!pre || pre.vary === false) return null;
  const base = VARY_BY_GROUP[pre.group] || VARY_BY_GROUP.default;
  const v = { ...base, ...(typeof pre.vary === 'object' ? pre.vary : {}) };
  if (v.musical === undefined || (typeof pre.vary !== 'object' || pre.vary.musical === undefined)) v.musical = base.musical || isMusical(pre);
  if (v.musical) { v.pitch = Math.min(v.pitch, 0.35); v.time = 0; }
  return v;
}

const variantCache = new Map();
function hashName(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; }
function rngFor(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** How many round-robin takes a preset has. */
export function variantCount(name, presets = SFX_PRESETS) {
  const pre = presets[name];
  const v = varyOf(pre);
  if (pre && pre.alts) return Math.max(pre.alts.length, v ? v.variants : 1);
  return v ? Math.max(1, v.variants) : 1;
}

/**
 * Take `i` of a preset: { pitch (semitones), gain (dB), offset (noise start,
 * s), layers: [{ pitch, gain, filter, dur, delay }] }. Seeded by the preset's
 * NAME, so take 2 of 'hit' is the same sound in every game and every test.
 * Take 0 is always the preset as written.
 */
export function presetVariant(name, i, presets = SFX_PRESETS) {
  const key = `${name}:${i}`;
  if (presets === SFX_PRESETS && variantCache.has(key)) return variantCache.get(key);
  const pre = presets[name];
  const v = varyOf(pre);
  const n = pre ? (pre.alts ? Math.max(...pre.alts.map((x) => x.length)) : pre.layers.length) : 0;
  let out;
  if (!v || i % variantCount(name, presets) === 0) {
    out = { pitch: 0, gain: 0, offset: 0, layers: Array.from({ length: n }, () => ({ pitch: 0, gain: 0, filter: 0, dur: 0, delay: 0 })) };
  } else {
    const r = rngFor(hashName(name) + i * 7919);
    const sym = () => r() * 2 - 1;
    // Spread the takes across the range instead of letting dice bunch them.
    const k = i % variantCount(name, presets), cnt = variantCount(name, presets);
    const lane = ((k / cnt) * 2 - 1) + sym() * (0.5 / cnt);
    out = {
      pitch: clamp(lane, -1, 1) * v.pitch,
      gain: sym() * v.gain,
      offset: r() * 1.4,
      layers: Array.from({ length: n }, () => ({
        pitch: v.musical ? 0 : sym() * v.pitch * 0.35,
        gain: sym() * v.gain * 0.5,
        filter: sym() * v.filter,
        dur: sym() * v.dur,
        delay: r() * v.time,
      })),
    };
  }
  if (presets === SFX_PRESETS) variantCache.set(key, out);
  return out;
}

/**
 * A game's timbre: the same `coin` in a fantasy game and a sci-fi one should
 * not be the same sound. pitch (semitones), bright (noise filters x), decay
 * (lengths x), wave (swap map), reverb (send 0..1), gain.
 */
export const THEMES = {
  neutral: {},
  arcade: { wave: { sine: 'square', triangle: 'square' }, bright: 1.15, decay: 0.85, reverb: 0.05 },
  cartoon: { pitch: 3, wave: { sawtooth: 'triangle', square: 'triangle' }, decay: 0.9, reverb: 0.1 },
  fantasy: { pitch: -1, wave: { square: 'triangle' }, bright: 0.85, decay: 1.15, reverb: 0.28 },
  scifi: { wave: { triangle: 'sawtooth', sine: 'triangle' }, bright: 1.25, decay: 1.05, reverb: 0.18 },
  gritty: { pitch: -3, wave: { sine: 'triangle', triangle: 'sawtooth' }, bright: 0.75, decay: 1.1, reverb: 0.12, gain: 1.05 },
  soft: { pitch: 1, wave: { square: 'sine', sawtooth: 'triangle' }, bright: 0.7, decay: 1.2, reverb: 0.22, gain: 0.9 },
  cave: { pitch: -2, bright: 0.8, decay: 1.25, reverb: 0.45 },
};
export const THEME_NAMES = Object.keys(THEMES);

/** How long a call lasts, delays included (seconds). */
export const presetLength = (name, opts) => resolveLayers(name, opts).reduce((m, l) => Math.max(m, l.delay + l.dur), 0);

/**
 * A crude upper bound on a call's peak: every layer at its gain at once. The
 * player's limiter catches the rest; this keeps a preset from relying on it.
 */
export const presetPeakBound = (name, opts) => resolveLayers(name, opts).reduce((s, l) => s + l.gain * (l.t === 'noise' ? 1 : 1), 0);

/**
 * What a weapon (kit/core/weapons.js) sounds like, from what it DOES -- so a
 * custom weapon needs no sound field. Returns [preset, opts] for play().
 */
export function weaponSound(w = {}) {
  if (w.kind === 'melee') return ['swing', {}];
  if (w.kind === 'beam') return ['laser', { gain: 0.45, pitch: 0.8 }];
  if (w.kind === 'projectile') {
    if (w.splash > 0 && w.radius >= 2) return ['rocketLaunch', {}];
    if (w.gravity > 0 && !w.splash) return ['bowLoose', {}];
    return ['laser', { pitch: 0.6 }];
  }
  if ((w.pellets || 1) > 1) return ['shotgun', {}];
  // Heavier rounds are lower; a fast trigger is lighter.
  return ['gunshot', { amt: Math.min(1, (w.damage || 20) / 90), pitch: w.damage >= 80 ? 0.7 : w.rate < 0.1 ? 1.25 : 1 }];
}

// ---- continuous voices ----------------------------------------------------

const engineTargets = ({ rpm = 900, throttle = null, idle = 800, redline = 7200, thump = 0.6, running = true } = {}) => {
  // A four-stroke fires twice per revolution: the fundamental is rpm / 30, so
  // the note falls on an upshift -- the thing that makes it an engine, not a siren.
  const r = Math.max(idle, rpm);
  const f0 = r / 30;
  const pedal = throttle == null ? clamp((r - idle) / Math.max(1, redline - idle), 0, 1) : clamp(throttle, 0, 1);
  const load = clamp(pedal * 0.7 + (r / redline) * 0.5, 0, 1);
  const revvy = clamp((redline - 6000) / 2600, 0, 1);
  return {
    'a.frequency': f0, 'b.frequency': f0, 'sub.frequency': f0 / 2,
    'subG.gain': clamp(thump, 0.15, 1.2) * 0.55,
    'lp.frequency': 600 + load * 4200,
    'body.gain': running ? 0.05 + load * 0.16 : 0.02,
    'raspF.frequency': 900 + (r / redline) * 2600,
    'raspG.gain': running ? revvy * load * 0.14 : 0,
  };
};

export const SFX_VOICES = {
  engine: {
    from: 'race', blurb: 'rpm-pitched twin saws, sub-octave thump, redline rasp: set({ rpm, throttle, idle, redline, thump, running })',
    nodes: {
      a: { osc: 'sawtooth', f: 30 }, b: { osc: 'sawtooth', f: 30, detune: 11 }, sub: { osc: 'sine', f: 15 },
      subG: { gain: 0.3 }, lp: { filter: 'lowpass', f: 900, q: 0.9 }, body: { gain: 0 },
      rasp: { noise: 'soft' }, raspF: { filter: 'bandpass', f: 1400, q: 1.1 }, raspG: { gain: 0 },
    },
    links: [['a', 'lp'], ['b', 'lp'], ['sub', 'subG'], ['subG', 'body'], ['lp', 'body'], ['body', 'out'], ['rasp', 'raspF'], ['raspF', 'raspG'], ['raspG', 'out']],
    targets: engineTargets, tau: 0.03,
    sample: { rpm: 4200, throttle: 1, redline: 7200 },
  },
  roll: {
    from: 'race+skate', blurb: 'wheels on the ground: set({ speed (m/s), top (speed at full level), rough })',
    nodes: { n: { noise: 'soft' }, f: { filter: 'lowpass', f: 380, q: 0.8 }, g: { gain: 0 } },
    links: [['n', 'f'], ['f', 'g'], ['g', 'out']],
    targets: ({ speed = 0, top = 30, rough = false } = {}) => ({ 'g.gain': clamp(speed / top, 0, 1) * (rough ? 0.2 : 0.14), 'f.frequency': rough ? 300 : 260 + clamp(speed / top, 0, 1) * 640 }),
    tau: 0.06, sample: { speed: 20 },
  },
  squeal: {
    from: 'race', blurb: 'a tyre at its slip angle: set({ slip (rad), speed })',
    nodes: { n: { noise: 'soft' }, f: { filter: 'bandpass', f: 1500, q: 2.6 }, g: { gain: 0 } },
    links: [['n', 'f'], ['f', 'g'], ['g', 'out']],
    targets: ({ slip = 0, speed = 0 } = {}) => { const s = clamp((Math.abs(slip) - 0.08) / 0.5, 0, 1) * clamp(speed / 8, 0, 1); return { 'g.gain': s * 0.17, 'f.frequency': 1100 + s * 1500 }; },
    tau: 0.03, sample: { slip: 0.5, speed: 20 },
  },
  skid: {
    from: 'race', blurb: 'a LOCKED tyre (handbrake, full brake): set({ lock 0..1, speed })',
    nodes: { n: { noise: 'soft' }, f: { filter: 'bandpass', f: 850, q: 0.7 }, g: { gain: 0 } },
    links: [['n', 'f'], ['f', 'g'], ['g', 'out']],
    targets: ({ lock = 0, speed = 0 } = {}) => ({ 'g.gain': clamp(lock, 0, 1) * clamp((speed - 2) / 6, 0, 1) * 0.3, 'f.frequency': 640 + clamp(speed / 45, 0, 1) * 520 }),
    tau: 0.04, sample: { lock: 1, speed: 20 },
  },
  wind: {
    from: 'race', blurb: 'speed you can hear past the redline: set({ speed })',
    nodes: { n: { noise: 'white' }, f: { filter: 'highpass', f: 1800, q: 0.7 }, g: { gain: 0 } },
    links: [['n', 'f'], ['f', 'g'], ['g', 'out']],
    targets: ({ speed = 0 } = {}) => ({ 'g.gain': clamp((speed - 14) / 60, 0, 1) * 0.1 }),
    tau: 0.1, sample: { speed: 70 },
  },
  hiss: {
    from: 'race', blurb: 'nitrous, a jet, a vent: set({ on })',
    nodes: { n: { noise: 'soft' }, f: { filter: 'bandpass', f: 3200, q: 0.9 }, g: { gain: 0 } },
    links: [['n', 'f'], ['f', 'g'], ['g', 'out']],
    targets: ({ on = false } = {}) => ({ 'g.gain': on ? 0.1 : 0 }),
    tau: 0.04, sample: { on: true },
  },
  grind: {
    from: 'skate', blurb: 'a board on a rail or ledge: set({ amount 0..1, metal })',
    nodes: {
      n: { noise: 'soft' }, f: { filter: 'bandpass', f: 1800, q: 1.6 }, g: { gain: 0 },
      tone: { osc: 'sawtooth', f: 900 }, tf: { filter: 'bandpass', f: 2200, q: 6 }, tg: { gain: 0 },
    },
    links: [['n', 'f'], ['f', 'g'], ['g', 'out'], ['tone', 'tf'], ['tf', 'tg'], ['tg', 'out']],
    targets: ({ amount = 0, metal = true } = {}) => { const g = clamp(amount, 0, 1); return { 'g.gain': g * 0.26, 'f.frequency': 1300 + g * 2200, 'tg.gain': g * (metal ? 0.05 : 0), 'tone.frequency': 620 + g * 700 }; },
    tau: 0.04, sample: { amount: 1, metal: true },
  },
  crowd: {
    from: 'soccer', blurb: 'a stadium crowd: set({ level 0..1 }) -- 0 murmurs, 1 is a goal',
    nodes: { n: { noise: 'white' }, f: { filter: 'bandpass', f: 700, q: 0.6 }, g: { gain: 0.05 } },
    links: [['n', 'f'], ['f', 'g'], ['g', 'out']],
    targets: ({ level = 0 } = {}) => { const l = clamp(level, 0, 1); return { 'g.gain': 0.04 + l * 0.25, 'f.frequency': 600 + l * 900 }; },
    tau: 0.4, sample: { level: 0.6 },
  },
  drone: {
    from: 'deepdark', blurb: "a crypt's breath, beating low saws: set({ level 0..1 })",
    nodes: { a: { osc: 'sawtooth', f: 55 }, b: { osc: 'sawtooth', f: 55.7 }, c: { osc: 'sawtooth', f: 82.4 }, f: { filter: 'lowpass', f: 220, q: 1 }, g: { gain: 0 } },
    links: [['a', 'f'], ['b', 'f'], ['c', 'f'], ['f', 'g'], ['g', 'out']],
    targets: ({ level = 1 } = {}) => ({ 'g.gain': clamp(level, 0, 1) * 0.035 }),
    tau: 0.5, sample: { level: 1 },
  },
  siren: {
    from: 'race', blurb: 'a mechanical wail, panned: set({ level 0..1, pan -1..1, yelp })',
    nodes: { o: { osc: 'triangle', f: 820 }, lfo: { osc: 'sine', f: 0.55 }, lfoG: { gain: 240 }, g: { gain: 0 }, p: { pan: true } },
    links: [['lfo', 'lfoG'], ['lfoG', 'o.frequency'], ['o', 'g'], ['g', 'p'], ['p', 'out']],
    targets: ({ level = 0, pan = 0, yelp = false } = {}) => ({ 'g.gain': clamp(level, 0, 1) ** 2 * 0.14, 'lfo.frequency': yelp ? 2.2 : 0.55, 'lfoG.gain': yelp ? 150 : 240, 'p.pan': clamp(pan, -1, 1) }),
    tau: 0.15, sample: { level: 1 },
  },
};

export const SFX_VOICE_NAMES = Object.keys(SFX_VOICES);

/** The silent targets of a voice: every gain it steers, at zero (hush, mute). */
export function voiceSilence(name) {
  const v = SFX_VOICES[name];
  if (!v) return {};
  const out = {};
  for (const k of Object.keys(v.targets({}))) if (k.endsWith('.gain') && !v.nodes[k.split('.')[0]].osc) out[k] = 0;
  return out;
}

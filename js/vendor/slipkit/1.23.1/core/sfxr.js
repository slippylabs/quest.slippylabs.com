// SFX Forge's renderer (sfx-forge.slippylabs.com), so a sound designed there
// drops straight into a game: paste its share string as a layer,
//   { t: 'sfxr', code: '0_1_0_0.18_...' }  or  { t: 'sfxr', params: {...} }
// and kit/audio/sfx.js renders it to a buffer once and plays that.
//
// The functions between the markers are SFX Forge's, byte for byte, so
// tools/sfxr.mjs can hold this copy to the live page (sliceLive) -- an edit
// to the tool that changes its sound fails the studio's suite.
// Pure: no AudioContext, no DOM.

// ---- from sfx-forge index.html ----
const MAX_DURATION = 6;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DEFAULTS = {
  waveform: 'square',      /* square | saw | triangle | sine | noise */
  seed: 1,
  attack: 0.0,             /* seconds */
  sustain: 0.18,
  punch: 0.0,              /* extra gain at the start of the sustain, 0..1 */
  decay: 0.25,
  startFrequency: 520,     /* Hz */
  minFrequency: 20,
  slide: 0,                /* octaves per second */
  deltaSlide: 0,           /* octaves per second per second */
  duty: 0.5,               /* square only */
  dutySweep: 0,            /* per second */
  vibratoDepth: 0,         /* fraction of the frequency */
  vibratoSpeed: 8,         /* Hz */
  arpeggioMultiplier: 1,   /* frequency jumps by this... */
  arpeggioTime: 0,         /* ...after this many seconds (0 = never) */
  lowPass: 1,              /* 1 = wide open, as a fraction of Nyquist */
  lowPassSweep: 0,
  resonance: 0,
  highPass: 0,
  repeatSpeed: 0,          /* Hz; 0 = no repeat */
  volume: 0.5,
};

const PARAM_ORDER = Object.keys(DEFAULTS);

function totalDuration(p) {
  return Math.min(MAX_DURATION, Math.max(0.01, p.attack + p.sustain + p.decay));
}

/* The envelope, as a function of time rather than a sample index, so it is the
   same shape at every sample rate. */
function envelopeAt(p, t) {
  const a = p.attack;
  const s = p.sustain;
  const d = p.decay;
  if (t < 0) return 0;
  if (t < a) return a <= 0 ? 1 : t / a;
  if (t < a + s) {
    const k = s <= 0 ? 0 : (t - a) / s;
    return 1 + p.punch * (1 - k);     /* the punch decays across the sustain */
  }
  if (t < a + s + d) return d <= 0 ? 0 : 1 - (t - a - s) / d;
  return 0;
}

function frequencyAt(p, t, nyquist) {
  const exponent = p.slide * t + (p.deltaSlide * t * t) / 2;
  let f = p.startFrequency * Math.pow(2, exponent);
  if (p.vibratoDepth > 0) f *= 1 + p.vibratoDepth * Math.sin(2 * Math.PI * p.vibratoSpeed * t);
  if (p.arpeggioTime > 0 && t >= p.arpeggioTime) f *= p.arpeggioMultiplier;
  const ceiling = nyquist * 0.95;
  return Math.min(ceiling, Math.max(p.minFrequency, f));
}

function waveSample(waveform, phase, duty, noiseValue) {
  switch (waveform) {
    case 'saw': return 1 - 2 * phase;
    case 'triangle': return 4 * Math.abs(phase - 0.5) - 1;
    case 'sine': return Math.sin(2 * Math.PI * phase);
    case 'noise': return noiseValue;
    default: return phase < duty ? 1 : -1;
  }
}

/* A two-pole resonant low-pass and a one-pole high-pass, the pair every sound
   chip emulation ends up with. Cutoff is a fraction of Nyquist so a patch keeps
   its character at any rate. */
function makeFilters() {
  return { lpPos: 0, lpVel: 0, hpPrevIn: 0, hpPrevOut: 0 };
}

function applyFilters(state, sample, cutoff, resonance, highPass) {
  let out = sample;
  if (cutoff < 0.999) {
    const f = Math.max(1e-4, Math.min(0.9, cutoff));
    const damping = Math.max(0.02, 1 - resonance * 0.98);
    state.lpVel += (out - state.lpPos) * f;
    state.lpVel *= damping;
    state.lpPos += state.lpVel;
    out = state.lpPos;
  }
  if (highPass > 0.0005) {
    const a = 1 - Math.max(0, Math.min(0.9, highPass));
    const filtered = a * (state.hpPrevOut + out - state.hpPrevIn);
    state.hpPrevIn = out;
    state.hpPrevOut = filtered;
    out = filtered;
  }
  return out;
}

/* A couple of milliseconds of ramp at each end, on top of whatever the envelope
   is doing. An instant attack is the point of a blip and a zero decay is the
   point of a stab -- but a waveform that starts and stops at full scale is a
   step, and a step is a click you hear on every single playback. Two
   milliseconds is short enough to leave the transient intact and long enough
   that the step becomes a slope. */
const DECLICK_SECONDS = 0.002;

function declickGain(i, count, fade) {
  if (fade <= 0) return 1;
  if (i < fade) return i / fade;
  if (i >= count - fade) return (count - 1 - i) / fade;
  return 1;
}

function renderSound(params, sampleRate = 44100) {
  const p = { ...DEFAULTS, ...params };
  const nyquist = sampleRate / 2;
  const duration = totalDuration(p);
  const count = Math.max(1, Math.floor(duration * sampleRate));
  const out = new Float32Array(count);
  const fade = Math.min(Math.floor(sampleRate * DECLICK_SECONDS), Math.floor(count / 8));

  const rnd = mulberry32(p.seed);
  const filters = makeFilters();
  let phase = 0;
  let noiseValue = rnd() * 2 - 1;
  /* The repeat resets the phase and the filter state, not the envelope -- an
     effect that restarted its envelope would just be a shorter effect played
     several times, which is not what a repeat sounds like. */
  const repeatPeriod = p.repeatSpeed > 0 ? 1 / p.repeatSpeed : Infinity;
  let nextRepeat = repeatPeriod;

  for (let i = 0; i < count; i++) {
    const t = i / sampleRate;
    if (t >= nextRepeat) {
      phase = 0;
      nextRepeat += repeatPeriod;
      Object.assign(filters, makeFilters());
    }
    const local = repeatPeriod === Infinity ? t : t % repeatPeriod;
    const freq = frequencyAt(p, local, nyquist);

    const before = phase;
    phase += freq / sampleRate;
    if (phase >= 1) {
      phase -= Math.floor(phase);
      /* Sample-and-hold noise: a new random value once per cycle, which is what
         makes noise pitched rather than white. */
      noiseValue = rnd() * 2 - 1;
    }
    void before;

    const duty = Math.min(0.95, Math.max(0.05, p.duty + p.dutySweep * t));
    let sample = waveSample(p.waveform, phase, duty, noiseValue);

    const cutoff = Math.max(0.001, Math.min(1, p.lowPass + p.lowPassSweep * t));
    sample = applyFilters(filters, sample, cutoff, p.resonance, p.highPass);

    sample *= envelopeAt(p, t) * p.volume * declickGain(i, count, fade);
    /* Hard clip, once, at the end. A patch that pushes past full scale is a
       legitimate sound; letting it wrap round would be a click. */
    out[i] = Math.max(-1, Math.min(1, sample));
  }
  return out;
}

/* ---- Generators --------------------------------------------------------------
   Each one is a shape plus a seeded random spread, so the button gives you a
   different pickup every press but always a pickup. */
function generate(kind, seed) {
  const rnd = mulberry32(seed);
  const r = (lo, hi) => lo + rnd() * (hi - lo);
  const p = { ...DEFAULTS, seed };
  switch (kind) {
    case 'pickup':
      Object.assign(p, {
        waveform: 'square', attack: 0, sustain: r(0.02, 0.07), punch: r(0.2, 0.5),
        decay: r(0.1, 0.3), startFrequency: r(500, 900), duty: r(0.2, 0.5),
        arpeggioMultiplier: r(1.3, 1.9), arpeggioTime: r(0.02, 0.06), volume: 0.45,
      });
      break;
    case 'laser':
      Object.assign(p, {
        waveform: rnd() < 0.6 ? 'saw' : 'square', attack: 0, sustain: r(0.02, 0.09),
        decay: r(0.08, 0.2), startFrequency: r(900, 1900), minFrequency: r(60, 200),
        slide: r(-9, -4), duty: r(0.2, 0.6), dutySweep: r(-0.6, 0.6),
        lowPass: r(0.5, 1), volume: 0.4,
      });
      break;
    case 'explosion':
      Object.assign(p, {
        waveform: 'noise', attack: 0, sustain: r(0.08, 0.2), punch: r(0.3, 0.7),
        decay: r(0.3, 0.7), startFrequency: r(200, 600), slide: r(-3, -0.6),
        lowPass: r(0.15, 0.5), lowPassSweep: r(-0.4, -0.05), resonance: r(0, 0.3),
        volume: 0.5,
      });
      break;
    case 'powerup':
      Object.assign(p, {
        waveform: rnd() < 0.5 ? 'square' : 'triangle', attack: r(0, 0.03),
        sustain: r(0.1, 0.25), decay: r(0.15, 0.4), startFrequency: r(250, 500),
        slide: r(1.2, 3), vibratoDepth: r(0, 0.12), vibratoSpeed: r(6, 16),
        duty: r(0.3, 0.6), volume: 0.42,
      });
      break;
    case 'hurt':
      Object.assign(p, {
        waveform: rnd() < 0.5 ? 'saw' : 'noise', attack: 0, sustain: r(0.02, 0.06),
        punch: r(0.2, 0.5), decay: r(0.1, 0.3), startFrequency: r(300, 700),
        slide: r(-5, -1.5), lowPass: r(0.3, 0.8), volume: 0.45,
      });
      break;
    case 'jump':
      Object.assign(p, {
        waveform: 'square', attack: 0, sustain: r(0.05, 0.12), decay: r(0.08, 0.2),
        startFrequency: r(200, 420), slide: r(1.5, 4), duty: r(0.2, 0.5), volume: 0.4,
      });
      break;
    case 'blip':
      Object.assign(p, {
        waveform: rnd() < 0.5 ? 'square' : 'triangle', attack: 0, sustain: r(0.01, 0.04),
        decay: r(0.02, 0.08), startFrequency: r(400, 1200), duty: r(0.3, 0.7), volume: 0.4,
      });
      break;
    default: {
      const waves = ['square', 'saw', 'triangle', 'sine', 'noise'];
      Object.assign(p, {
        waveform: waves[Math.floor(rnd() * waves.length)],
        attack: r(0, 0.1), sustain: r(0.02, 0.25), punch: r(0, 0.6), decay: r(0.05, 0.5),
        startFrequency: r(120, 1600), minFrequency: r(20, 120), slide: r(-6, 5),
        deltaSlide: r(-4, 4), duty: r(0.15, 0.85), dutySweep: r(-0.8, 0.8),
        vibratoDepth: rnd() < 0.5 ? 0 : r(0, 0.2), vibratoSpeed: r(3, 20),
        arpeggioMultiplier: rnd() < 0.6 ? 1 : r(0.5, 2), arpeggioTime: r(0.01, 0.1),
        lowPass: r(0.15, 1), lowPassSweep: r(-0.5, 0.5), resonance: r(0, 0.5),
        highPass: rnd() < 0.7 ? 0 : r(0, 0.3), repeatSpeed: rnd() < 0.7 ? 0 : r(2, 18),
        volume: r(0.35, 0.55),
      });
    }
  }
  return p;
}

/* Nudge every numeric dial a little, keeping the character. */
function mutate(params, seed, amount = 0.12) {
  const rnd = mulberry32(seed);
  const out = { ...params, seed };
  for (const key of PARAM_ORDER) {
    if (key === 'waveform' || key === 'seed') continue;
    const range = SPEC[key];
    if (!range) continue;
    const span = range.max - range.min;
    const nudged = out[key] + (rnd() * 2 - 1) * span * amount;
    out[key] = Math.max(range.min, Math.min(range.max, nudged));
  }
  return out;
}

/* One place that says what each dial means, used for the UI, the mutator and
   the share link. */
const SPEC = {
  attack: { min: 0, max: 1, step: 0.005, label: 'Attack', unit: 's' },
  sustain: { min: 0, max: 1.5, step: 0.005, label: 'Sustain', unit: 's' },
  punch: { min: 0, max: 1, step: 0.01, label: 'Punch' },
  decay: { min: 0, max: 2, step: 0.005, label: 'Decay', unit: 's' },
  startFrequency: { min: 20, max: 4000, step: 1, label: 'Start frequency', unit: 'Hz' },
  minFrequency: { min: 0, max: 1000, step: 1, label: 'Frequency floor', unit: 'Hz' },
  slide: { min: -10, max: 10, step: 0.05, label: 'Slide', unit: 'oct/s' },
  deltaSlide: { min: -10, max: 10, step: 0.05, label: 'Slide acceleration', unit: 'oct/s²' },
  duty: { min: 0.05, max: 0.95, step: 0.01, label: 'Duty cycle' },
  dutySweep: { min: -1, max: 1, step: 0.01, label: 'Duty sweep', unit: '/s' },
  vibratoDepth: { min: 0, max: 0.5, step: 0.005, label: 'Vibrato depth' },
  vibratoSpeed: { min: 0.5, max: 40, step: 0.1, label: 'Vibrato speed', unit: 'Hz' },
  arpeggioMultiplier: { min: 0.25, max: 3, step: 0.01, label: 'Arpeggio jump', unit: '×' },
  arpeggioTime: { min: 0, max: 0.5, step: 0.005, label: 'Arpeggio at', unit: 's' },
  lowPass: { min: 0.01, max: 1, step: 0.005, label: 'Low-pass cutoff' },
  lowPassSweep: { min: -1, max: 1, step: 0.01, label: 'Low-pass sweep', unit: '/s' },
  resonance: { min: 0, max: 0.9, step: 0.01, label: 'Resonance' },
  highPass: { min: 0, max: 0.9, step: 0.005, label: 'High-pass' },
  repeatSpeed: { min: 0, max: 30, step: 0.1, label: 'Repeat', unit: 'Hz' },
  volume: { min: 0, max: 1, step: 0.01, label: 'Volume' },
};

/* ---- Share links ------------------------------------------------------------
   Fixed field order, three significant figures, so the string is short enough to
   paste in a chat window and reproduces the sound exactly enough to be the same
   sound. */
function encodeParams(p) {
  const waves = ['square', 'saw', 'triangle', 'sine', 'noise'];
  const parts = [waves.indexOf(p.waveform), Math.round(p.seed)];
  for (const key of PARAM_ORDER) {
    if (key === 'waveform' || key === 'seed') continue;
    /* Six figures, not four. Four rounds the sustain enough to change the
       sample count, and an oscillator whose frequency is off in the fourth
       figure has drifted a noticeable fraction of a cycle by the end of the
       sound -- the samples stop matching even though the numbers look close. */
    parts.push(Number(p[key].toPrecision(6)));
  }
  return parts.join('_');
}

function decodeParams(text) {
  const waves = ['square', 'saw', 'triangle', 'sine', 'noise'];
  const parts = String(text).split('_').map(Number);
  if (parts.length < 3) return null;
  const p = { ...DEFAULTS, waveform: waves[parts[0]] || 'square', seed: parts[1] || 1 };
  let i = 2;
  for (const key of PARAM_ORDER) {
    if (key === 'waveform' || key === 'seed') continue;
    if (i < parts.length && Number.isFinite(parts[i])) p[key] = parts[i];
    i++;
  }
  return p;
}

// ---- end sfx-forge ----

export const SFXR_KINDS = ['pickup', 'laser', 'explosion', 'powerup', 'hurt', 'jump', 'blip', 'random'];
export { DEFAULTS as SFXR_DEFAULTS, generate as generateSfxr, renderSound as renderSfxr, encodeParams as encodeSfxr, decodeParams as decodeSfxr, totalDuration as sfxrDuration };

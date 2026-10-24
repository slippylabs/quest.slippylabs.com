// The music's instruments as WebAudio: kit/core/music/instruments.js entries
// turned into something that plays a note at an exact time.
//
//   const inst = createVoice(ctx, 'horn');   inst.output.connect(dest);
//   inst.play(midi, vel, when, durSec);
//
// Every note is ONE fully scheduled event: its whole envelope is written at
// play() time, attack to release, because the note's length is known (the
// composer wrote it). Nothing reads an AudioParam's .value to decide where a
// release starts -- that value is the param's state NOW, not at the note-off
// time, which is how SlipDAW's analog and pluck releases jumped to full scale
// and clicked when a note was scheduled ahead. setTargetAtTime starts from
// whatever the previous automation reached, so the chain
//   0 -> linear to peak -> target sustain -> target 0
// is continuous whatever the note's length.
//
// The drum kits are SlipDAW's (instruments.js), unchanged: one-shots, no release.

import { INSTRUMENTS } from '../core/music/instruments.js';
import { LEVELS } from '../core/music/levels.js';
import { createInstrument } from './instruments.js';
import { makeRng } from './util.js';

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const clampF = (f) => Math.max(30, Math.min(18000, f));
const MAX_VOICES = 32;

const shared = new WeakMap(); // ctx -> { noise, curves }
function bank(ctx) {
  let b = shared.get(ctx);
  if (!b) {
    const n = Math.floor(ctx.sampleRate * 1.5);
    const noise = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = noise.getChannelData(0);
    const r = makeRng(9001);
    for (let i = 0; i < n; i++) d[i] = r() * 2 - 1;
    b = { noise, curves: new Map(), plucks: new Map() };
    shared.set(ctx, b);
  }
  return b;
}

// Odd length and an (n - 1) divisor so the curve maps exactly 0 to 0: an even
// curve emits a DC offset on silence, one per voice (SlipDAW's 808 lesson).
function driveCurve(ctx, k) {
  const b = bank(ctx);
  if (b.curves.has(k)) return b.curves.get(k);
  const n = 1025, c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i * 2) / (n - 1) - 1; c[i] = Math.tanh(k * x) / Math.tanh(k); }
  b.curves.set(k, c);
  return c;
}

function adsr(g, amp, peak, when, dur) {
  const a = Math.min(amp.a, Math.max(0.002, dur * 0.6));
  const off = when + Math.max(dur, a + 0.005);
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(peak, when + a);
  g.gain.setTargetAtTime(Math.max(0, peak * amp.s), when + a, Math.max(0.005, amp.d / 3));
  g.gain.setTargetAtTime(0, off, Math.max(0.005, amp.r / 3));
  return off + amp.r * 2.6 + 0.02; // when the voice is silent (e^-7.8)
}

function limiter(list, when) {
  // Steal the oldest still-sounding note past the cap: a fast fade, not a cut.
  while (list.length && list[0].end < when) list.shift();
  if (list.length < MAX_VOICES) return;
  const v = list.shift();
  try {
    if (v.g.gain.cancelAndHoldAtTime) v.g.gain.cancelAndHoldAtTime(when);
    else v.g.gain.cancelScheduledValues(when);
    v.g.gain.setTargetAtTime(0, when, 0.012);
    for (const s of v.srcs) s.stop(when + 0.08);
  } catch { /* already stopped */ }
}

function synthVoice(ctx, spec) {
  const output = ctx.createGain();
  output.gain.value = spec.level ?? 0.8;
  const live = [];
  const curve = spec.drive ? driveCurve(ctx, spec.drive) : null;
  return {
    output,
    play(m, vel, when, dur) {
      limiter(live, when);
      const f0 = mtof(m);
      const peak = Math.max(0.0001, (vel / 127) * 0.5);
      const fl = ctx.createBiquadFilter();
      const F = spec.filter || { type: 'lowpass', f: 8000, q: 0.7 };
      fl.type = F.type || 'lowpass';
      fl.Q.value = F.q ?? 0.7;
      const fc = clampF(F.f * Math.pow(f0 / 261.63, F.track ?? 0));
      if (F.env) {
        fl.frequency.setValueAtTime(clampF(fc * F.env.from), when);
        fl.frequency.exponentialRampToValueAtTime(fc, when + F.env.time);
      } else fl.frequency.setValueAtTime(fc, when);
      const g = ctx.createGain();
      const end = adsr(g, spec.amp, peak, when, dur);
      const srcs = [];
      const sum = ctx.createGain();
      sum.gain.value = 1 / Math.sqrt(spec.osc.length);
      for (const o of spec.osc) {
        const osc = ctx.createOscillator();
        osc.type = o.wave;
        osc.frequency.setValueAtTime(f0 * Math.pow(2, (o.semis || 0) / 12), when);
        if (o.cents) osc.detune.setValueAtTime(o.cents, when);
        const og = ctx.createGain();
        og.gain.value = o.gain ?? 1;
        osc.connect(og); og.connect(sum);
        srcs.push(osc);
      }
      if (spec.vib) {
        const lfo = ctx.createOscillator();
        lfo.frequency.value = spec.vib.rate;
        const depth = ctx.createGain();
        depth.gain.setValueAtTime(0, when);
        depth.gain.linearRampToValueAtTime(spec.vib.cents, when + (spec.vib.delay || 0) + 0.25);
        lfo.connect(depth);
        for (const s of srcs) depth.connect(s.detune);
        srcs.push(lfo);
      }
      if (spec.noise) {
        const n = ctx.createBufferSource();
        n.buffer = bank(ctx).noise; n.loop = true;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass'; bp.frequency.value = clampF(f0 * 2); bp.Q.value = 1.2;
        const ng = ctx.createGain(); ng.gain.value = spec.noise * 8;
        n.connect(bp); bp.connect(ng); ng.connect(sum);
        srcs.push(n);
      }
      sum.connect(fl);
      if (curve) {
        const sh = ctx.createWaveShaper();
        sh.curve = curve;
        fl.connect(sh); sh.connect(g);
      } else fl.connect(g);
      g.connect(output);
      for (const s of srcs) { s.start(when, s.buffer ? (m * 0.0137) % 1 : undefined); s.stop(end); }
      live.push({ g, srcs, end });
      return end;
    },
  };
}

function fmVoice(ctx, spec) {
  const output = ctx.createGain();
  output.gain.value = spec.level ?? 0.7;
  const live = [];
  return {
    output,
    play(m, vel, when, dur) {
      limiter(live, when);
      const f0 = mtof(m);
      const car = ctx.createOscillator();
      car.frequency.setValueAtTime(f0, when);
      const mod = ctx.createOscillator();
      mod.frequency.setValueAtTime(f0 * spec.ratio, when);
      const md = ctx.createGain();
      // Index follows pitch so the timbre is the same across the keyboard.
      const idx = (spec.index / 440) * f0;
      md.gain.setValueAtTime(idx, when);
      md.gain.setTargetAtTime(idx * 0.04, when, Math.max(0.005, spec.modDecay / 3));
      mod.connect(md); md.connect(car.frequency);
      const g = ctx.createGain();
      const end = adsr(g, spec.amp, Math.max(0.0001, (vel / 127) * 0.5), when, dur);
      car.connect(g); g.connect(output);
      car.start(when); mod.start(when); car.stop(end); mod.stop(end);
      live.push({ g, srcs: [car, mod], end });
      return end;
    },
  };
}

// Karplus-Strong, SlipDAW's algorithm, but each pitch's string is rendered
// ONCE per context and reused: rendering per note was up to six seconds of
// samples for every arpeggio note.
function pluckVoice(ctx, spec) {
  const output = ctx.createGain();
  output.gain.value = spec.level ?? 0.8;
  const live = [];
  const cache = bank(ctx).plucks;
  function buffer(m) {
    const key = `${m}:${spec.decay}:${spec.brightness}`;
    if (cache.has(key)) return cache.get(key);
    const sr = ctx.sampleRate, freq = mtof(m);
    const period = Math.max(2, Math.round(sr / freq));
    const decay = Math.max(0.9, Math.min(0.9999, spec.decay));
    const bright = 0.1 + 0.75 * Math.max(0, Math.min(1, spec.brightness));
    const dur = Math.max(0.2, Math.min(4, Math.log(0.001) / Math.log(decay) / freq));
    const total = Math.floor(sr * dur);
    const rng = makeRng(1000 + m);
    const ring = new Float32Array(period);
    for (let i = 0; i < period; i++) ring[i] = (rng() * 2 - 1) * (1 - i / period);
    const buf = ctx.createBuffer(1, total, sr);
    const out = buf.getChannelData(0);
    let prev = ring[period - 1];
    for (let i = 0; i < total; i++) {
      const k = i % period, cur = ring[k];
      out[i] = cur;
      ring[k] = (bright * cur + (1 - bright) * ((cur + prev) * 0.5)) * decay;
      prev = cur;
    }
    // A short fade-in: the ring's first sample is a full-scale step.
    for (let i = 0; i < Math.min(48, total); i++) out[i] *= i / 48;
    cache.set(key, buf);
    return buf;
  }
  return {
    output,
    play(m, vel, when, dur) {
      limiter(live, when);
      const src = ctx.createBufferSource();
      src.buffer = buffer(m);
      const g = ctx.createGain();
      g.gain.setValueAtTime(Math.max(0.0001, (vel / 127) * 0.9), when);
      const off = when + Math.max(0.03, dur);
      g.gain.setTargetAtTime(0, off, 0.05);
      const end = Math.min(when + src.buffer.duration, off + 0.4);
      src.connect(g); g.connect(output);
      src.start(when); src.stop(end);
      live.push({ g, srcs: [src], end });
      return end;
    },
  };
}

function kitVoice(ctx, id, level) {
  const kit = createInstrument(ctx, 'drumkit', { kit: id, level: level ?? 0.9 });
  return {
    output: kit.output,
    play(m, vel, when) { kit.playNote(m, vel, when); return when + 1.2; },
  };
}

/**
 * An instrument by id (kit/core/music/instruments.js), or an inline spec.
 * By id it is calibrated (core/music/levels.js, measured by
 * tools/music_render.py --calibrate) so every timbre is equally loud at the
 * same track gain.
 */
export function createVoice(ctx, inst, { calibrated = true } = {}) {
  const spec = typeof inst === 'string' ? INSTRUMENTS[inst] : inst;
  if (!spec) throw new Error(`no instrument "${inst}"`);
  let v;
  if (spec.synth) v = synthVoice(ctx, spec.synth);
  else if (spec.fm) v = fmVoice(ctx, spec.fm);
  else if (spec.pluck) v = pluckVoice(ctx, spec.pluck);
  else if (spec.kit) v = kitVoice(ctx, spec.kit, spec.level);
  else throw new Error(`instrument "${inst}" has no kind`);
  if (calibrated && typeof inst === 'string' && LEVELS[inst]) v.output.gain.value *= LEVELS[inst];
  return v;
}

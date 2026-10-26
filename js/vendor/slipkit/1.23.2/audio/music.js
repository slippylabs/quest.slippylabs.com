// The music player: a composed song (kit/core/music) played live, adaptively.
//
//   const mixer = attachMixer(createMixer({ storageKey: 'mygame.audio' }));
//   const music = createMusic({ mixer });
//   music.play('march', 3);                 // style + seed; plays forever, never the same pass twice
//   music.setIntensity(enemies / 20);       // 0 calm .. 1 boss: tracks fade in and out by tier
//   music.play('march', 4);                 // a new song: crossfades on the next bar
//   music.stinger('win');                   // a phrase on the next beat, the song ducked under it
//   mixer.muffle(1);                        // pause menu
//
// How it keeps time: a look-ahead scheduler (25 ms timer, 150 ms horizon)
// writes every note against the AudioContext clock -- the audio clock is the
// only one that does not jitter, so notes are never fired from setInterval
// itself. A timer that was throttled (a busy frame, a background tab) does not
// burst the notes it missed: a note already in the past is skipped. Before a
// pass ends, the next pass is composed (same themes, new development) and
// joined on, beat-exact.
//
// renderSong() builds the identical graph against an OfflineAudioContext, for
// tools/music_test.py (measured, not "it did not throw") and WAV export.

import { compose, composeStinger, tierOn, resolveStyle } from '../core/music/compose.js';
import { createVoice } from './voices.js';
import { createEffect } from './effects.js';
import { createMixer } from './mixer.js';

const LOOKAHEAD = 0.15;
const TICK_MS = 25;

/** Beat position with swing applied: notes in the off half of each swing unit are pushed late. */
export function swingBeat(b, swing, unit = 8) {
  if (!swing) return b;
  const u = unit === 16 ? 0.25 : 0.5;
  const k = Math.floor(b / u + 1e-6);
  return k % 2 ? b + swing * u : b;
}

// One playing song: its voices, gates and effects, and a cursor per track.
function createDeck(ctx, dest, song, t0, { intensity = 1, mutes = new Set(), solo = null, renderAll = false } = {}) {
  const spb = 60 / song.bpm;
  const out = ctx.createGain();
  out.gain.value = 0;
  out.connect(dest);
  const fx = song.fx || {};
  let rev = null, dly = null;
  if (fx.reverb) {
    rev = createEffect(ctx, 'reverb', { size: fx.reverb.size, decay: fx.reverb.decay, tone: fx.reverb.tone, predelayMs: 18, mix: 1 });
    const rg = ctx.createGain(); rg.gain.value = fx.reverb.wet ?? 0.25;
    rev.output.connect(rg); rg.connect(out);
  }
  if (fx.delay) {
    dly = createEffect(ctx, 'delay', { timeMs: fx.delay.beats * spb * 1000, feedback: fx.delay.fb, damping: 3500, mix: 1 });
    const dg = ctx.createGain(); dg.gain.value = 0.5;
    dly.output.connect(dg); dg.connect(out);
  }
  const tracks = song.tracks.map((t) => {
    const voice = createVoice(ctx, t.inst);
    const gate = ctx.createGain();
    const lvl = ctx.createGain();
    lvl.gain.value = t.gain;
    let pan = null;
    if (ctx.createStereoPanner && t.pan) { pan = ctx.createStereoPanner(); pan.pan.value = t.pan; }
    voice.output.connect(lvl); lvl.connect(gate);
    if (pan) { gate.connect(pan); pan.connect(out); } else gate.connect(out);
    if (rev && t.rev) { const s = ctx.createGain(); s.gain.value = t.rev; gate.connect(s); s.connect(rev.input); }
    if (dly && t.dly) { const s = ctx.createGain(); s.gain.value = t.dly; gate.connect(s); s.connect(dly.input); }
    return { t, voice, gate, on: false, offAt: -1, cursor: 0 };
  });
  const deck = {
    song, t0, out, tracks, spb,
    get end() { return t0 + song.beats * spb; },
    timeOf(b) { return deck.t0 + swingBeat(b, song.swing, song.swingUnit) * spb; },
    gates(x, tau = 0.6, now = ctx.currentTime) {
      for (const tr of tracks) {
        const want = tierOn(tr.t.tier, x) && !mutes.has(tr.t.id) && (!solo || solo === tr.t.id);
        if (want === tr.on) continue;
        tr.on = want;
        tr.offAt = want ? -1 : now + tau * 4;
        tr.gate.gain.setTargetAtTime(want ? 1 : 0, now, tau);
      }
    },
    /** Schedule every note that starts before `until`. Returns the number scheduled. */
    schedule(until, now) {
      let n = 0;
      for (const tr of tracks) {
        const notes = tr.t.notes;
        while (tr.cursor < notes.length) {
          const note = notes[tr.cursor];
          const at = deck.timeOf(note.t);
          if (at >= until) break;
          tr.cursor++;
          if (!renderAll && at < now - 0.01) continue;         // missed: skip, never burst
          if (!tr.on && tr.offAt >= 0 && at > tr.offAt) continue; // gated out and faded
          if (!tr.on && tr.offAt < 0) continue;
          try { tr.voice.play(note.p, note.v, Math.max(at, now), note.d * spb); n++; } catch { /* a bad note never stops the song */ }
        }
      }
      return n;
    },
    done() { return tracks.every((tr) => tr.cursor >= tr.t.notes.length); },
    fadeTo(v, tau, at = ctx.currentTime) { out.gain.setTargetAtTime(v, at, tau); },
    dispose(at) {
      setTimeout(() => { try { out.disconnect(); } catch { /* gone */ } }, Math.max(0, (at - ctx.currentTime) * 1000) + 4000);
    },
  };
  // Initial gates: instantaneous.
  for (const tr of tracks) {
    tr.on = tierOn(tr.t.tier, intensity) && !mutes.has(tr.t.id) && (!solo || solo === tr.t.id);
    tr.gate.gain.value = tr.on ? 1 : 0;
    tr.offAt = tr.on ? -1 : t0;
  }
  return deck;
}

export function createMusic({ mixer = null, context = null, storageKey = 'slipkit.audio', bus = 'music' } = {}) {
  const mx = mixer || createMixer({ context, storageKey });
  let ctx = null, dest = null, timer = null;
  let cur = null;             // { style, seed, pass, deck, next }
  let old = [];               // decks fading out
  let intensity = 0.5;
  const mutes = new Set();
  let solo = null;
  const listeners = new Set();

  function ensure() {
    if (ctx) return true;
    if (!mx.ready && !mx.unlock()) return false;
    ctx = mx.context; dest = mx.bus(bus);
    return !!ctx;
  }

  function emit(ev) { for (const f of listeners) { try { f(ev); } catch { /* listener's bug */ } } }

  function startTimer() {
    if (timer || typeof setInterval === 'undefined') return;
    timer = setInterval(tick, TICK_MS);
  }

  function tick() {
    if (!ctx || !cur) return;
    const now = ctx.currentTime;
    const until = now + LOOKAHEAD;
    const d = cur.deck;
    d.schedule(until, now);
    for (const o of old) o.schedule(Math.min(until, o.stopAt), now);
    old = old.filter((o) => now < o.stopAt + 6);
    // Compose the next pass early (it takes milliseconds, but not inside the horizon).
    if (!cur.next && now > d.t0 + (d.end - d.t0) * 0.5) {
      cur.next = compose(cur.style, cur.seed, { pass: cur.pass + 1, ...cur.opts });
    }
    if (d.done() && until >= d.end - 0.001) {
      const song = cur.next || compose(cur.style, cur.seed, { pass: cur.pass + 1, ...cur.opts });
      const nd = createDeck(ctx, dest, song, d.end, { intensity, mutes, solo });
      nd.out.gain.value = 1;
      // The old deck stays connected until its last notes ring out.
      d.dispose(d.end + 4);
      cur = { ...cur, pass: cur.pass + 1, deck: nd, next: null };
      emit({ type: 'pass', pass: cur.pass, song });
      nd.schedule(until, now);
    }
  }

  /**
   * Play a style + seed (or a song object). If a song is playing, the new one
   * starts on the old one's next beat (quantize: 'bar' for the bar line, false
   * for now) and they crossfade over `fade` s. Extra opts (bpm, mode, tonic)
   * go to the composer.
   */
  function play(style, seed = 1, { fade = 1.5, intensity: x = null, quantize = 'beat', ...opts } = {}) {
    if (!ensure()) return false;
    if (x !== null) intensity = x;
    if (cur && cur.style === (typeof style === 'string' ? style : resolveStyle(style).id) && cur.seed === seed) return true;
    const song = typeof style === 'object' && style.tracks && style.sections ? style : compose(style, seed, opts);
    const now = ctx.currentTime;
    let t0 = now + 0.06;
    if (cur && quantize) {
      // On the old song's next beat (or bar): the change lands in time.
      // A bar at 90 bpm is 2.7 s -- too long to wait when a battle starts.
      const d = cur.deck;
      const unit = (quantize === 'bar' ? 4 : 1) * d.spb;
      const into = Math.ceil((now + 0.08 - d.t0) / unit);
      t0 = Math.max(now + 0.06, d.t0 + into * unit);
    }
    if (cur) {
      const d = cur.deck;
      d.fadeTo(0, fade / 4, t0);
      d.stopAt = t0 + fade;
      old.push(d);
      d.dispose(t0 + fade);
    }
    const deck = createDeck(ctx, dest, song, t0, { intensity, mutes, solo });
    deck.out.gain.setValueAtTime(cur ? 0 : 1, now);
    if (cur) deck.fadeTo(1, fade / 4, t0);
    cur = { style: song.style, seed, pass: song.pass || 0, deck, next: null, opts };
    startTimer();
    tick();
    emit({ type: 'play', song });
    return true;
  }

  function stop(fade = 1) {
    if (!cur || !ctx) return;
    const d = cur.deck;
    d.fadeTo(0, fade / 4);
    d.stopAt = ctx.currentTime + fade;
    old.push(d);
    d.dispose(ctx.currentTime + fade);
    cur = null;
    emit({ type: 'stop' });
  }

  function setIntensity(x, tau = 0.8) {
    intensity = Math.max(0, Math.min(1, +x || 0));
    if (cur && ctx) cur.deck.gates(intensity, tau);
    return intensity;
  }

  /** A short phrase on the next beat ('win' | 'lose' | 'levelup' | 'boss' | 'start'). */
  function stinger(kind = 'win', { duck = 0.75 } = {}) {
    if (!ensure()) return false;
    const base = cur ? cur.deck.song : compose('chiptune', 1);
    const st = composeStinger(base, kind);
    const now = ctx.currentTime;
    let t0 = now + 0.05;
    if (cur) { const d = cur.deck; t0 = Math.max(t0, d.t0 + Math.ceil((now + 0.05 - d.t0) / d.spb) * d.spb); }
    const fake = { ...base, bpm: st.bpm || base.bpm, beats: st.beats, swing: 0, tracks: st.tracks.map((t) => ({ ...t, tier: 0 })) };
    const deck = createDeck(ctx, mx.bus('sfx') || dest, fake, t0, { intensity: 1, renderAll: true });
    deck.out.gain.value = 1;
    deck.schedule(Infinity, now);
    deck.dispose(t0 + st.beats * deck.spb + 3);
    if (cur && duck) {
      const g = cur.deck.out.gain, len = st.beats * deck.spb;
      g.setTargetAtTime(1 - duck, t0 - 0.02, 0.05);
      g.setTargetAtTime(1, t0 + len, 0.5);
    }
    return true;
  }

  /** Where the song is: { pass, beat, section, sectionIndex, bar } (null when stopped). */
  function position() {
    if (!cur || !ctx) return null;
    const d = cur.deck;
    const beat = Math.max(0, (ctx.currentTime - d.t0) / d.spb);
    const si = d.song.sections.findIndex((s) => beat >= s.bar * 4 && beat < (s.bar + s.bars) * 4);
    const s = d.song.sections[Math.max(0, si)];
    return { pass: cur.pass, beat, bar: Math.floor(beat / 4), section: s ? s.kind : null, sectionIndex: si };
  }

  return {
    mixer: mx, play, stop, setIntensity, stinger, position,
    get intensity() { return intensity; },
    get song() { return cur ? cur.deck.song : null; },
    get playing() { return !!cur; },
    /** Studio: mute / solo a track by id (applies to every pass). */
    mute(id, on = true) { if (on) mutes.add(id); else mutes.delete(id); if (cur) cur.deck.gates(intensity, 0.05); },
    solo(id = null) { solo = id; if (cur) cur.deck.gates(intensity, 0.05); },
    on(f) { listeners.add(f); return () => listeners.delete(f); },
  };
}

/**
 * Render a song offline: { style, seed } or a song, `seconds` long (passes
 * are joined as they are live), at a fixed intensity. Returns the AudioBuffer.
 * opts.mutes / opts.solo as in the player; opts.stinger = [kind, atSeconds].
 */
export async function renderSong(what, { seconds = 30, intensity = 1, sampleRate = 44100, mutes = [], solo = null, stinger = null, OfflineCtx = null } = {}) {
  const OAC = OfflineCtx || globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
  const ctx = new OAC(2, Math.ceil(seconds * sampleRate), sampleRate);
  const mixer = createMixer({ context: ctx });
  mixer.unlock();
  const dest = mixer.bus('music');
  let song = what.tracks ? what : compose(what.style, what.seed ?? 1, what.opts || {});
  let t0 = 0.05;
  const ms = new Set(mutes);
  while (t0 < seconds) {
    const deck = createDeck(ctx, dest, song, t0, { intensity, mutes: ms, solo, renderAll: true });
    deck.out.gain.value = 1;
    deck.schedule(seconds, 0);
    t0 = deck.end;
    song = compose(song.style, song.seed, { pass: song.pass + 1 });
  }
  if (stinger) {
    const st = composeStinger(song, stinger[0]);
    const fake = { ...song, beats: st.beats, swing: 0, tracks: st.tracks };
    const deck = createDeck(ctx, mixer.bus('sfx'), fake, stinger[1], { intensity: 1, renderAll: true });
    deck.out.gain.value = 1;
    deck.schedule(seconds, 0);
  }
  return ctx.startRendering();
}

/** A stereo 16-bit WAV of an AudioBuffer, as bytes. */
export function encodeWav(buf) {
  const ch = Math.min(2, buf.numberOfChannels), n = buf.length, sr = buf.sampleRate;
  const data = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const w = (o, s) => { for (let i = 0; i < s.length; i++) data.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); data.setUint32(4, 36 + n * ch * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, ch, true);
  data.setUint32(24, sr, true); data.setUint32(28, sr * ch * 2, true); data.setUint16(32, ch * 2, true); data.setUint16(34, 16, true);
  w(36, 'data'); data.setUint32(40, n * ch * 2, true);
  const chans = Array.from({ length: ch }, (_, c) => buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const s = Math.max(-1, Math.min(1, chans[c][i])); data.setInt16(o, Math.round(s * 32767), true); o += 2; }
  return new Uint8Array(data.buffer);
}

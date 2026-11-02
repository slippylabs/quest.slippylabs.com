// The sound player: kit/core/sfx.js's tables turned into WebAudio nodes.
//
//   const sfx = createSfx({ storageKey: 'mygame.muted' });
//   addEventListener('pointerdown', () => sfx.unlock(), { once: true });
//   sfx.play('crash', { amt: 0.8, pos: [x, y, z] });     // one-shot, optionally placed
//   const eng = sfx.voice('engine');                      // continuous
//   eng.set({ rpm: car.rpm, throttle });                  // every drawn frame
//   sfx.listener(eye, forward);                           // where the ears are
//
// The rules the games learned, kept here so a new game gets them for free:
//   * The AudioContext is built on the first real gesture -- browsers refuse
//     audio on a page nobody touched. Every call is wrapped: a machine with no
//     audio device loses the sound, not the game.
//   * Continuous sounds are ONE voice each, steered with setTargetAtTime.
//     Retriggering per frame clicks; moving a filter does not.
//   * Discrete events are one-shots called from the SIM's event sites, never
//     derived by comparing drawn frames (a dropped frame would eat them).
//   * hush() when the page hides: rAF stops, so every voice would hold its
//     last value and a car left at 6000 rpm drones until the tab comes back.
//   * `context` is injectable, so tools/sfx_test.py renders every preset
//     through an OfflineAudioContext and MEASURES it. "It did not throw" is not
//     evidence that a sound exists.
//
// v2 (KIT 1.23): no two plays alike, and no pile-ups.
//   * Every play picks one of the preset's round-robin TAKES (core/sfx.js
//     presetVariant) -- never the one it played last -- plus a small random
//     wobble. `vary: false` (the option, or per call) is the v1 sound exactly.
//   * A preset may sound at most `maxPer` (6) times at once and the player
//     `maxAll` (40): past that the OLDEST copy is faded out in 15 ms, so a
//     shotgun into a crowd of hits steals instead of stacking into mush.
//     A call within `cooldown` (20 ms; a preset's own `cooldown` wins) of the
//     same preset is dropped -- a thousand kills a minute stay a texture.
//   * `theme` (core/sfx.js THEMES) gives a game its own timbre and a reverb.
//   * `define(name, preset)` adds a game's own sounds (same table format, plus
//     `alts`: several designs played round-robin, and `{ t: 'sfxr', code }`
//     layers pasted from SFX Forge).
//   * With a `mixer` (kit/audio/mixer.js) it shares the game's AudioContext
//     and plays into the mix's sfx bus, under the same limiter as the music.

import { SFX_PRESETS, SFX_VOICES, resolveLayers, voiceSilence, variantCount, THEMES } from '../core/sfx.js';
import { renderSfxr, decodeSfxr, generateSfxr } from '../core/sfxr.js';
import { createReverbImpulse } from './effects.js';
import { releaseWhenDone } from './util.js';

const VOLUME = 0.8;

export function createSfx({ context = null, storageKey = 'slipkit.muted', volume = VOLUME, mixer = null, theme = null, vary = true, rng = Math.random, maxPer = 6, maxAll = 40, cooldown = 0.02 } = {}) {
  const th = typeof theme === 'string' ? THEMES[theme] || null : theme;
  const presets = { ...SFX_PRESETS };
  const lastTake = new Map();   // name -> last variant played
  const lastAt = new Map();     // name -> ctx time of last play
  const active = [];            // { name, g, end }
  const sfxrCache = new Map();
  let reverbIn = null;
  const tail = [];              // master's chain (limiter, reverb), for dispose()
  const makeContext = mixer ? () => (mixer.unlock() ? mixer.context : null) : context || (() => {
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    return AC ? new AC() : null;
  });
  let ctx = null, master = null, white = null, soft = null, started = false;
  let muted = false;
  if (!context) { try { muted = localStorage.getItem(storageKey) === '1'; } catch { /* private mode */ } }
  const voices = new Map();
  const played = {};              // name -> count, for tests ("did the game make any sound?")

  // An OfflineAudioContext reports 'suspended' until rendered, so it can never
  // be required to be 'running' or every test would measure silence.
  const offline = () => !!(ctx && typeof ctx.startRendering === 'function');
  const live = () => started && ctx && !muted && (ctx.state === 'running' || offline());

  function noiseBuffer(lowpassed) {
    const n = Math.floor(ctx.sampleRate * 2);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    // Seeded, so two renders of a preset are the same sound (and a test of
    // "louder" compares the preset, not the dice). One pole of low-pass makes
    // the rumble the wheels and tyres use; white is wind, crowds, hits.
    let seed = lowpassed ? 4242 : 22222, last = 0;
    for (let i = 0; i < n; i++) {
      seed = (seed * 16807) % 2147483647;
      const w = (seed / 2147483647) * 2 - 1;
      if (lowpassed) { last = last * 0.7 + w * 0.3; d[i] = last * 1.8; } else d[i] = w;
    }
    return buf;
  }

  /** Call from the first gesture. Safe to call repeatedly. */
  function unlock() {
    if (started) { if (ctx && ctx.state === 'suspended' && !offline()) ctx.resume(); return true; }
    try {
      ctx = makeContext();
      if (!ctx) return false;
      master = ctx.createGain();
      master.gain.value = muted ? 0 : volume;
      if (mixer) master.connect(mixer.bus('sfx'));
      else {
        // A limiter, so a stack of one-shots (a goal over a crash over a crowd)
        // squashes instead of clipping.
        const lim = ctx.createDynamicsCompressor();
        lim.threshold.value = -6; lim.knee.value = 6; lim.ratio.value = 12; lim.attack.value = 0.002; lim.release.value = 0.12;
        master.connect(lim); lim.connect(ctx.destination);
        tail.push(lim);
      }
      if (th && th.reverb) {
        const conv = ctx.createConvolver();
        conv.buffer = createReverbImpulse(ctx, 1.4, 3, 777);
        const wet = ctx.createGain(); wet.gain.value = th.reverb;
        reverbIn = ctx.createGain();
        reverbIn.connect(conv); conv.connect(wet); wet.connect(master);
        tail.push(reverbIn, conv, wet);
      }
      white = noiseBuffer(false); soft = noiseBuffer(true);
      started = true;
      if (!offline() && ctx.state === 'suspended') ctx.resume();
      for (const v of voices.values()) v.build();
      return true;
    } catch (e) {
      ctx = null; started = false;
      return false;
    }
  }

  /** Where a sound goes: the mix, or a panner placed in the world. */
  function out(pos) {
    if (!pos) return master;
    const p = ctx.createPanner();
    p.panningModel = 'equalpower'; p.distanceModel = 'inverse';
    p.refDistance = 2; p.maxDistance = 60; p.rolloffFactor = 1.2;
    if (p.positionX) { p.positionX.value = pos[0]; p.positionY.value = pos[1]; p.positionZ.value = pos[2]; } else p.setPosition(pos[0], pos[1], pos[2]);
    p.connect(master);
    return p;
  }

  function sfxrBuffer(L) {
    const key = `${L.code || ''}|${L.gen || ''}|${L.seed}|${L.params ? JSON.stringify(L.params) : ''}`;
    if (sfxrCache.has(key)) return sfxrCache.get(key);
    const p = L.code ? decodeSfxr(L.code) : L.gen ? generateSfxr(L.gen, L.seed || 1) : { ...(L.params || {}) };
    const data = renderSfxr(p || {}, ctx.sampleRate);
    const buf = ctx.createBuffer(1, data.length, ctx.sampleRate);
    buf.getChannelData(0).set(data);
    sfxrCache.set(key, buf);
    return buf;
  }

  function layer(L, dest, t0, srcs) {
    const t = t0 + L.delay;
    const g = ctx.createGain();
    if (L.t === 'sfxr') {
      const src = ctx.createBufferSource();
      src.buffer = sfxrBuffer(L);
      src.playbackRate.value = L.rate || 1;
      g.gain.value = L.gain;
      src.connect(g); g.connect(dest);
      srcs.push(src);
      src.start(t);
      return t + src.buffer.duration / (L.rate || 1);
    }
    if (L.t === 'tone') {
      const o = ctx.createOscillator();
      o.type = L.wave || 'sine';
      o.frequency.setValueAtTime(L.f, t);
      if (L.to) o.frequency.exponentialRampToValueAtTime(L.to, t + L.dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, L.gain), t + L.attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + L.dur);
      o.connect(g); g.connect(dest);
      srcs.push(o);
      o.start(t); o.stop(t + L.dur + 0.03);
      return t + L.dur + 0.03;
    } else {
      const src = ctx.createBufferSource();
      src.buffer = L.soft ? soft : white;
      // Looped: a take starts up to 1.5 s into the 2 s buffer, so a long
      // layer would otherwise stop dead where the buffer ends.
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = L.filter || 'bandpass'; f.Q.value = L.q;
      f.frequency.setValueAtTime(L.f, t);
      if (L.to) f.frequency.exponentialRampToValueAtTime(L.to, t + L.dur);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(L.gain, t + L.attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + L.dur);
      src.connect(f); f.connect(g); g.connect(dest);
      srcs.push(src);
      // Where in the noise it starts: fixed in v1 (the same hiss every time),
      // the take's own offset in v2.
      src.start(t, ((L.f * 7.31 + L.delay * 13) + (L.offset || 0)) % 1.5, L.dur + 0.05);
      src.stop(t + L.dur + 0.06);
      return t + L.dur + 0.06;
    }
  }

  /** Pick a take: any but the last one played (a bag of one never repeats a different one). */
  function take(name) {
    const n = variantCount(name, presets);
    if (n <= 1) return 0;
    const last = lastTake.has(name) ? lastTake.get(name) : -1;
    let k = Math.floor(rng() * (last < 0 ? n : n - 1));
    if (last >= 0 && k >= last) k++;
    lastTake.set(name, k);
    return k;
  }

  function steal(v, t) {
    try {
      if (v.g.gain.cancelAndHoldAtTime) v.g.gain.cancelAndHoldAtTime(t); else v.g.gain.cancelScheduledValues(t);
      v.g.gain.setTargetAtTime(0, t, 0.005);
    } catch { /* gone */ }
    v.end = t;
  }

  /**
   * A one-shot. opts: { amt 0..1, gain, pitch, pos: [x, y, z] (placed in the
   * world), vary (false = the preset as written), variant (force a take) }.
   */
  function play(name, opts = {}) {
    if (!live() || !presets[name]) return false;
    try {
      const t0 = ctx.currentTime;
      const cd = presets[name].cooldown ?? cooldown;
      if (cd > 0 && lastAt.has(name) && t0 - lastAt.get(name) < cd) return false;
      lastAt.set(name, t0);
      // Voice caps: drop what has finished, then steal the oldest copy.
      for (let i = active.length - 1; i >= 0; i--) if (active[i].end <= t0) active.splice(i, 1);
      const mine = active.filter((v) => v.name === name);
      if (mine.length >= (presets[name].max || maxPer)) steal(mine[0], t0);
      if (active.length >= maxAll) steal(active[0], t0);
      const varied = opts.vary ?? vary;
      const variant = opts.variant ?? (varied ? take(name) : null);
      const pg = ctx.createGain();
      const o = out(opts.pos);
      pg.connect(o);
      if (reverbIn) pg.connect(reverbIn);
      let end = t0;
      const srcs = [];
      for (const L of resolveLayers(name, { ...opts, variant, jitter: varied ? rng : null, theme: th, presets })) end = Math.max(end, layer(L, pg, t0, srcs));
      // The play's gain (and its own panner) leave the graph when its last layer ends.
      releaseWhenDone(srcs, pg, ...(o === master ? [] : [o]));
      active.push({ name, g: pg, end });
      played[name] = (played[name] || 0) + 1;
      lastPlayed = { name, variant };
      return true;
    } catch { return false; /* a bad node never breaks the game */ }
  }
  let lastPlayed = null;

  /** Add (or replace) a game's own one-shot, in the table format. Returns the sfx. */
  function define(name, preset) {
    if (!preset || (!Array.isArray(preset.layers) && !Array.isArray(preset.alts))) throw new Error(`sfx.define("${name}"): needs layers or alts`);
    presets[name] = { group: 'Game', from: 'game', ...preset, layers: preset.layers || preset.alts[0] };
    lastTake.delete(name);
    return api;
  }

  /**
   * A continuous voice, created once and steered with set(). Safe to make
   * before unlock(): it builds itself when the context arrives.
   */
  function voice(name, opts = {}) {
    const key = opts.id || name;
    if (voices.has(key)) return voices.get(key);
    const spec = SFX_VOICES[name];
    if (!spec) throw new Error(`no voice "${name}"`);
    let nodes = null, last = null;
    const v = {
      name,
      build() {
        if (!ctx || nodes) return;
        try {
          nodes = {};
          for (const [k, n] of Object.entries(spec.nodes)) {
            let node;
            if (n.osc) { node = ctx.createOscillator(); node.type = n.osc; node.frequency.value = n.f; if (n.detune) node.detune.value = n.detune; }
            else if (n.noise) { node = ctx.createBufferSource(); node.buffer = n.noise === 'soft' ? soft : white; node.loop = true; }
            else if (n.filter) { node = ctx.createBiquadFilter(); node.type = n.filter; node.frequency.value = n.f; node.Q.value = n.q ?? 1; }
            else if (n.pan) node = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
            else { node = ctx.createGain(); node.gain.value = n.gain ?? 0; }
            nodes[k] = node;
          }
          for (const [a, b] of spec.links) {
            if (b === 'out') { nodes[a].connect(opts.pos ? out(opts.pos) : master); continue; }
            const [n, param] = b.split('.');
            nodes[a].connect(param ? nodes[n][param] : nodes[n]);
          }
          for (const n of Object.values(nodes)) if (n.start) n.start();
          v.apply(last ? spec.targets(last) : voiceSilence(name), 0);
        } catch { nodes = null; }
      },
      apply(targets, tau = spec.tau) {
        if (!nodes) return;
        const t = ctx.currentTime;
        for (const [k, val] of Object.entries(targets)) {
          const [n, param] = k.split('.');
          const p = nodes[n] && nodes[n][param];
          if (!p || !Number.isFinite(val)) continue;
          if (tau > 0) p.setTargetAtTime(val, t, tau); else p.value = val;
        }
      },
      /** Steer it. Params are the voice's own (see SFX_VOICES[name].blurb). */
      set(params = {}) { last = params; if (!muted) v.apply(spec.targets(params)); return v; },
      /** Fade it out (it keeps running, silent, ready for the next set()). */
      quiet() { v.apply(voiceSilence(name), 0.05); return v; },
      stop() { if (nodes) { for (const n of Object.values(nodes)) { try { n.stop && n.stop(); n.disconnect(); } catch { /* already gone */ } } } nodes = null; voices.delete(key); },
    };
    voices.set(key, v);
    v.build();
    return v;
  }

  /** Where the ears are and which way they face (for placed one-shots). */
  function listener(pos, fwd = [0, 0, -1]) {
    if (!ctx) return;
    const L = ctx.listener;
    try {
      if (L.positionX) {
        L.positionX.value = pos[0]; L.positionY.value = pos[1]; L.positionZ.value = pos[2];
        L.forwardX.value = fwd[0]; L.forwardY.value = fwd[1]; L.forwardZ.value = fwd[2];
        L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
      } else { L.setPosition(...pos); L.setOrientation(...fwd, 0, 1, 0); }
    } catch { /* an old engine */ }
  }

  /** Silence every voice, hard (the page hid). */
  function hush() { for (const v of voices.values()) v.quiet(); }

  function setMuted(value) {
    muted = !!value;
    if (!context) { try { localStorage.setItem(storageKey, muted ? '1' : '0'); } catch { /* private mode */ } }
    if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : volume, ctx.currentTime, 0.02);
    if (muted) hush();
    return muted;
  }

  /**
   * Take this player out of the audio graph: stop its voices and disconnect its
   * master + limiter/reverb chain (else they stay connected to the mixer bus,
   * and the convolver is pulled every quantum, until the page closes). Closes
   * the context only if this player made it. Call before replacing a player
   * (the studio's Sound tab makes a new one per theme).
   */
  function dispose() {
    for (const v of [...voices.values()]) { try { v.stop(); } catch { /* gone */ } }
    for (const n of [master, ...tail]) { try { n && n.disconnect(); } catch { /* gone */ } }
    tail.length = 0; active.length = 0; reverbIn = null; master = null;
    if (ctx && !mixer && !context && !offline()) { try { ctx.close(); } catch { /* closed */ } }
    ctx = null; started = false;
  }

  const api = {
    unlock, play, voice, listener, hush, setMuted, define, dispose,
    defineAll(table) { for (const [k, v] of Object.entries(table)) define(k, v); return api; },
    has: (name) => !!presets[name],
    get names() { return Object.keys(presets); },
    /** The last call that made sound: { name, variant } (tests, the studio). */
    get last() { return lastPlayed; },
    /** How many one-shots are sounding right now. */
    get sounding() { const t = ctx ? ctx.currentTime : 0; return active.filter((v) => v.end > t).length; },
    toggleMute: () => setMuted(!muted),
    get muted() { return muted; },
    get ready() { return started; },
    get context() { return ctx; },
    /** How many times each one-shot has actually played (muted and pre-unlock calls do not count). */
    get played() { return { ...played }; },
  };
  return api;
}

/**
 * The usual wiring: unlock on the first gesture, M toggles mute, hush when
 * the page hides. Returns the sfx. Skip it if a game owns its own keys.
 */
export function attachSfx(sfx, { muteKey = 'KeyM', onMute = null } = {}) {
  const unlock = () => sfx.unlock();
  addEventListener('pointerdown', unlock, { capture: true });
  addEventListener('keydown', (e) => {
    unlock();
    if (muteKey && e.code === muteKey && !e.repeat && !(e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName))) {
      const m = sfx.toggleMute();
      if (onMute) onMute(m);
    }
  }, { capture: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) sfx.hush(); });
  return sfx;
}

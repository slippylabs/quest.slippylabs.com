// One AudioContext and one mix for a game's music and sound effects.
//
//   const mixer = createMixer({ storageKey: 'mygame.audio' });
//   const sfx = createSfx({ mixer });  const music = createMusic({ mixer });
//   addEventListener('pointerdown', () => mixer.unlock(), { once: true });
//
//   master -> limiter -> speakers
//     music bus -> muffle (low-pass, for pause menus / underwater) -> duck -> master
//     sfx bus   -> master
//     ambience  -> master
//
// The volumes (master, music, sfx, ambience) and mute persist per storageKey,
// so every game remembers its own (persist: false for a game that saves its
// own settings). `context` is injectable (an AudioContext, or a function
// returning one): tools render through an OfflineAudioContext.

const DEFAULTS = { master: 0.85, music: 0.55, sfx: 0.9, ambience: 0.8, muted: false };

// Identity below 0.8, a tanh knee to 1 above. Odd length, (n - 1) divisor:
// x = 0 maps to exactly 0 (an even curve is a DC source; SlipDAW's lesson).
const KNEE = (() => {
  const n = 4097, c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / (n - 1) - 1, a = Math.abs(x);
    c[i] = a < 0.8 ? x : Math.sign(x) * (0.8 + 0.2 * Math.tanh((a - 0.8) / 0.2));
  }
  return c;
})();

export function createMixer({ context = null, storageKey = 'slipkit.audio', volumes = {}, persist: persistOpt = true } = {}) {
  let ctx = null, started = false;
  const nodes = {};
  const vol = { ...DEFAULTS, ...volumes };
  // A game that saves its own volume settings passes persist: false and
  // drives setVolume itself.
  const persist = persistOpt && (typeof context !== 'object' || context === null);
  if (persist) { try { Object.assign(vol, JSON.parse(localStorage.getItem(storageKey) || '{}')); } catch { /* private mode */ } }
  const listeners = [];
  let muffleAmt = 0, duckDepth = 1;

  const offline = () => !!(ctx && typeof ctx.startRendering === 'function');

  function build() {
    const m = ctx.createGain();
    const lim = ctx.createDynamicsCompressor();
    // A limiter, not a mix: a stack of one-shots over the music squashes
    // instead of clipping. The music is staged to sit well under it.
    lim.threshold.value = -4; lim.knee.value = 4; lim.ratio.value = 16; lim.attack.value = 0.002; lim.release.value = 0.18;
    // After it, a soft knee above 0.8 for the transient the compressor (no
    // look-ahead) lets through: a 2 ms overshoot is rounded, not clipped.
    const knee = ctx.createWaveShaper();
    knee.curve = KNEE;
    m.connect(lim); lim.connect(knee); knee.connect(ctx.destination);
    const bus = (name) => { const g = ctx.createGain(); g.gain.value = vol[name]; return g; };
    nodes.master = m; nodes.limiter = lim;
    nodes.music = bus('music'); nodes.sfx = bus('sfx'); nodes.ambience = bus('ambience');
    nodes.muffle = ctx.createBiquadFilter(); nodes.muffle.type = 'lowpass'; nodes.muffle.frequency.value = 20000; nodes.muffle.Q.value = 0.5;
    nodes.duck = ctx.createGain();
    // 25 Hz high-pass: decaying saws and plucked strings carry DC, and DC is headroom.
    nodes.hp = ctx.createBiquadFilter(); nodes.hp.type = 'highpass'; nodes.hp.frequency.value = 25; nodes.hp.Q.value = 0.7;
    nodes.music.connect(nodes.hp); nodes.hp.connect(nodes.muffle); nodes.muffle.connect(nodes.duck); nodes.duck.connect(m);
    nodes.sfx.connect(m); nodes.ambience.connect(m);
    m.gain.value = vol.muted ? 0 : vol.master;
  }

  /** Call from the first gesture. Safe to call repeatedly. Returns true once there is sound. */
  function unlock() {
    if (started) { if (ctx.state === 'suspended' && !offline()) ctx.resume(); return true; }
    try {
      if (context && typeof context === 'object') ctx = context;
      else {
        const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
        ctx = typeof context === 'function' ? context() : AC ? new AC({ latencyHint: 'interactive' }) : null;
      }
      if (!ctx) return false;
      build();
      started = true;
      if (!offline() && ctx.state === 'suspended') ctx.resume();
      for (const f of listeners.splice(0)) { try { f(ctx); } catch { /* a listener's bug is its own */ } }
      return true;
    } catch { ctx = null; started = false; return false; }
  }

  const save = () => { if (persist) { try { localStorage.setItem(storageKey, JSON.stringify(vol)); } catch { /* private mode */ } } };
  const ramp = (p, v, tau = 0.03) => { if (ctx) p.setTargetAtTime(v, ctx.currentTime, tau); };

  return {
    unlock,
    /** Run f(ctx) now if the context exists, else once it does. */
    onReady(f) { if (started) f(ctx); else listeners.push(f); },
    get ready() { return started; },
    get context() { return ctx; },
    get running() { return started && (offline() || ctx.state === 'running'); },
    bus(name) { return nodes[name]; },
    get volumes() { return { ...vol }; },
    setVolume(name, v) {
      vol[name] = Math.max(0, Math.min(1, +v || 0));
      if (nodes[name] && name !== 'master') ramp(nodes[name].gain, vol[name]);
      if (name === 'master' && nodes.master && !vol.muted) ramp(nodes.master.gain, vol.master);
      save();
      return vol[name];
    },
    setMuted(m) {
      vol.muted = !!m;
      if (nodes.master) ramp(nodes.master.gain, vol.muted ? 0 : vol.master, 0.02);
      save();
      return vol.muted;
    },
    toggleMute() { return this.setMuted(!vol.muted); },
    get muted() { return vol.muted; },
    /** 0 = clear, 1 = heard through a wall. For pause menus, underwater, a concussion. */
    muffle(amount = 1, tau = 0.25) {
      muffleAmt = Math.max(0, Math.min(1, amount));
      if (nodes.muffle) ramp(nodes.muffle.frequency, 20000 * Math.pow(350 / 20000, muffleAmt), tau);
      return muffleAmt;
    },
    /** Dip the music under a big moment: depth 0..1 (0.5 = half), held `hold` s. */
    duck(depth = 0.5, hold = 0.6) {
      if (!nodes.duck) return;
      const t = ctx.currentTime, g = nodes.duck.gain;
      duckDepth = Math.min(duckDepth, 1 - depth);
      g.cancelScheduledValues(t);
      g.setTargetAtTime(1 - depth, t, 0.03);
      g.setTargetAtTime(1, t + hold, 0.4);
      setTimeout(() => { duckDepth = 1; }, (hold + 1) * 1000);
    },
  };
}

/**
 * The usual wiring: unlock on the first gesture, M toggles mute, the page
 * hiding suspends the context (and resumes it on return). Returns the mixer.
 */
export function attachMixer(mixer, { muteKey = 'KeyM', onMute = null } = {}) {
  const unlock = () => mixer.unlock();
  addEventListener('pointerdown', unlock, { capture: true });
  addEventListener('touchend', unlock, { capture: true });
  addEventListener('keydown', (e) => {
    unlock();
    if (muteKey && e.code === muteKey && !e.repeat && !(e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName))) {
      const m = mixer.toggleMute();
      if (onMute) onMute(m);
    }
  }, { capture: true });
  document.addEventListener('visibilitychange', () => {
    const ctx = mixer.context;
    if (!ctx || typeof ctx.startRendering === 'function') return;
    try { if (document.hidden) ctx.suspend(); else ctx.resume(); } catch { /* closed */ }
  });
  return mixer;
}

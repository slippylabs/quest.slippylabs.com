// ============================================================================
// AetherQuest - Sound: SlipKit's audio (js/vendor/slipkit/1.23.2, vendored with
// `tools/kitcopy.sh . --audio` from SlipStudio).
//
// This page is plain scripts, not modules, so the kit's three ES modules are
// loaded with a dynamic import() from here. window.soundEngine keeps the API
// every call site already used (attack, crit, spellCast, heal, buy, click,
// levelUp, victory, defeat, toggleSound, toggleMusic ...) plus scene() and
// battleUpdate(), but:
//
//   * the MUSIC is composed (kit core/music, style 'adventure', RPG Adventure):
//     the title, Battleon Haven and every quest region is its own song (key,
//     tempo, tunes), 1-2 minutes before a song loops, each loop re-developed.
//     In battle the intensity follows the fight -- your HP running low, the
//     gauntlet's wave, a boss takes it to full. Stingers on a boss, a win, a
//     level up and a defeat (they replace the old fixed jingles, which were in
//     C whatever the song's key; those still play when the music is off).
//   * every SOUND is the game's own design as a preset (the table below, in
//     SlipKit's format) played through the kit's sfx player with the 'fantasy'
//     theme: each play is one of 3-5 takes, never the same take twice running.
//   * Sound OFF / M mutes everything (the mixer's master); Music OFF stops the
//     music. Both persist under the same localStorage keys as before. A rules
//     or account dialog over the game muffles the music.
// ============================================================================

(function () {
  const KIT = new URL('vendor/slipkit/1.23.2/audio/', document.currentScript.src).href;

  const T = (wave, f, to, dur, gain, extra = {}) => ({ t: 'tone', wave, f, ...(to == null ? {} : { to }), dur, gain, ...extra });
  const N = (filter, f, dur, gain, extra = {}) => ({ t: 'noise', filter, f, dur, gain, q: 1, ...extra });
  // the old playNoise(): a lowpass sweeping 800 -> 100 Hz
  const HIT = (dur, gain) => N('lowpass', 800, dur, gain, { to: 100 });

  // The game's sounds, as they were (frequencies, bends, gains, the setTimeout
  // gaps as delays). Groups pick how much each varies.
  const SOUNDS = {
    attack: { group: 'Melee', layers: [T('triangle', 320, 140, 0.12, 0.2), HIT(0.08, 0.15)] },
    crit: { group: 'Melee', layers: [T('sawtooth', 450, 150, 0.25, 0.3), HIT(0.2, 0.3)] },
    dodge: { group: 'Player', layers: [T('sine', 220, 520, 0.15, 0.15)] },
    encounter: { group: 'Monster', layers: [T('triangle', 300, 400, 0.2, 0.15)] },
    spell_fire: { group: 'Weapon', layers: [T('sawtooth', 180, 300, 0.3, 0.25), HIT(0.25, 0.25)] },
    spell_ice: { group: 'Weapon', layers: [T('sine', 650, 450, 0.25, 0.2), T('triangle', 880, null, 0.2, 0.15, { delay: 0.06 })] },
    spell_lightning: { group: 'Weapon', layers: [T('sawtooth', 120, 820, 0.1, 0.3), HIT(0.15, 0.3)] },
    spell_light: { group: 'UI', layers: [T('sine', 523, null, 0.3, 0.2), T('sine', 659, null, 0.3, 0.2, { delay: 0.08 }), T('sine', 784, null, 0.4, 0.25, { delay: 0.16 })] },
    spell_darkness: { group: 'Weapon', layers: [T('sawtooth', 130, 80, 0.4, 0.25), T('sawtooth', 95, null, 0.35, 0.2, { delay: 0.1 })] },
    spell_arcane: { group: 'Weapon', layers: [T('triangle', 440, 660, 0.25, 0.2), T('sine', 550, null, 0.2, 0.2, { delay: 0.08 })] },
    heal: { group: 'UI', layers: [440, 554, 659, 880].map((f, i) => T('sine', f, null, [0.2, 0.2, 0.3, 0.4][i], [0.18, 0.18, 0.2, 0.25][i], { delay: i * 0.07 })) },
    potion: { group: 'Player', layers: [T('triangle', 350, 470, 0.08, 0.18), T('triangle', 420, 570, 0.08, 0.18, { delay: 0.09 }), T('triangle', 520, 720, 0.14, 0.2, { delay: 0.18 })] },
    buy: { group: 'UI', layers: [T('square', 987, null, 0.08, 0.12), T('square', 1318, null, 0.15, 0.15, { delay: 0.07 })] },
    click: { group: 'UI', cooldown: 0.03, layers: [T('square', 600, 450, 0.04, 0.08)] },
    levelUp: { group: 'UI', layers: [261.63, 329.63, 392, 523.25, 659.25, 783.99, 1046.5].map((f, i) => T('triangle', f, null, 0.25, 0.25, { delay: i * 0.09 })) },
    victory: { group: 'UI', layers: (() => {
      const mel = [[523.25, 0.15], [523.25, 0.15], [523.25, 0.15], [659.25, 0.35], [587.33, 0.15], [659.25, 0.15], [783.99, 0.6]];
      let at = 0;
      return mel.map(([f, d]) => { const l = T('triangle', f, null, d, 0.25, { delay: at }); at += d * 0.85; return l; });
    })() },
    defeat: { group: 'UI', layers: [392, 370, 349.23, 311.13, 261.63].map((f, i) => T('sawtooth', f, null, 0.35, 0.2, { delay: i * 0.16 })) },
  };
  const SPELL = { fire: 'spell_fire', water: 'spell_ice', ice: 'spell_ice', lightning: 'spell_lightning', light: 'spell_light', darkness: 'spell_darkness' };

  // One song per place. Chosen so they differ in key and tempo: title G ionian
  // 96 bpm, Battleon Haven C mixolydian 90; Whispering Wilds F# dorian 89,
  // Frostpeak B aeolian 93, Molten Depths Ab aeolian 89, Necropolis F aeolian
  // 91, Tempest Spire Bb dorian 97, Void Rift C aeolian 92, the Gauntlet A
  // ionian 91. Audition or re-roll any of them in SlipStudio's Sound tab
  // (studio.slippylabs.com/?tab=sound, RPG Adventure, same seed).
  const TITLE_SEED = 32, TOWN_SEED = 15;
  const ZONE_SEEDS = { wilds: 9, frostpeak: 4, magma: 5, crypts: 48, tempest: 21, void: 12, gauntlet: 35 };

  let kit = null;          // { mixer, music, sfx } once the modules load
  let wanted = { seed: TITLE_SEED, intensity: 0.3, scene: 'title' };
  let pendingWin = null, muffled = false;

  const eng = {
    enabled: localStorage.getItem('aetherquest_sound') !== 'false',
    // Music now defaults ON (it was opt-in while it was a four-chord loop);
    // an explicit OFF is still remembered.
    musicEnabled: localStorage.getItem('aetherquest_music') !== 'false',
    ready: false,
    get kit() { return kit; },
    get currentScene() { return wanted.scene; },

    soundLabel() { return this.enabled ? '🔊 Sound: ON' : '🔈 Sound: OFF'; },
    musicLabel() { return this.musicEnabled ? '🎵 Music: ON' : '🔇 Music: OFF'; },

    initContext() { unlock(); },

    toggleSound() {
      this.enabled = !this.enabled;
      localStorage.setItem('aetherquest_sound', this.enabled ? 'true' : 'false');
      if (kit) kit.mixer.setMuted(!this.enabled);
      const b = document.getElementById('sound-btn');
      if (b) b.textContent = this.soundLabel();
      return this.enabled;
    },

    toggleMusic() {
      this.musicEnabled = !this.musicEnabled;
      localStorage.setItem('aetherquest_music', this.musicEnabled ? 'true' : 'false');
      if (this.musicEnabled) startWanted(); else if (kit) kit.music.stop(0.8);
      return this.musicEnabled;
    },
    startMusic() { if (this.musicEnabled) startWanted(); },
    stopMusic() { if (kit) kit.music.stop(0.8); },

    /** Where the player is: 'title' (no hero yet), 'town', or 'battle' in a zone. */
    scene(name, zoneId) {
      if (name === 'battle') wanted = { seed: ZONE_SEEDS[zoneId] ?? ZONE_SEEDS.wilds, intensity: 0.45, scene: 'battle', zone: zoneId };
      else if (name === 'town') wanted = { seed: TOWN_SEED, intensity: 0.2, scene: 'town' };
      else wanted = { seed: TITLE_SEED, intensity: 0.3, scene: 'title' };
      startWanted();
      if (kit && name !== 'battle') kit.music.setIntensity(wanted.intensity, 1.5);
    },

    /** After every turn: how dangerous the fight is now. */
    battleUpdate(player, enemy, { wave = 1, gauntlet = false, over = false } = {}) {
      if (!kit || wanted.scene !== 'battle' || !player || !enemy) return;
      let x;
      if (over) x = 0.3;
      else if (enemy.isBoss) x = 1;
      else {
        const hp = Math.max(0, Math.min(1, player.hp / Math.max(1, player.maxHp)));
        x = 0.45 + (1 - hp) * 0.35 + (gauntlet ? Math.min(0.15, (wave - 1) * 0.03) : 0);
      }
      kit.music.setIntensity(Math.min(1, x), x >= 1 ? 0.4 : 1.2);
    },

    /** A dialog over the game (rules, account): the music heard through a wall. */
    setMuffled(on) {
      if (on === muffled) return;
      muffled = on;
      if (kit) kit.mixer.muffle(on ? 0.7 : 0, 0.15);
    },

    // ---- the call sites' sounds
    play(name, opts) { if (this.enabled && kit) return kit.sfx.play(name, opts); return false; },
    playTone() { this.play('encounter'); },   // the old raw tone, kept for any stray caller
    playNoise() { this.play('attack'); },
    attack() { this.play('attack'); },
    crit() { this.play('crit'); },
    dodge() { this.play('dodge'); },
    encounter(isBoss) {
      this.play('encounter');
      // on the next tick: startBattle returns before showScreen switches to the region's song
      if (isBoss) setTimeout(() => { if (musicOn()) kit.music.stinger('boss', { duck: 0.6 }); }, 0);
    },
    spellCast(element = 'arcane') { this.play(SPELL[element] || 'spell_arcane'); },
    heal() { this.play('heal'); },
    potion() { this.play('potion'); },
    buy() { this.play('buy'); },
    click() { this.play('click'); },
    victory() {
      // The win stinger waits a tick: handleVictory calls levelUp() right
      // after, and a level up gets its own stinger instead of both at once.
      if (musicOn()) { clearTimeout(pendingWin); pendingWin = setTimeout(() => { pendingWin = null; kit.music.stinger('win', { duck: 0.75 }); }, 0); }
      else this.play('victory');
    },
    levelUp() {
      if (musicOn()) { clearTimeout(pendingWin); pendingWin = null; kit.music.stinger('levelup', { duck: 0.75 }); }
      else this.play('levelUp');
    },
    defeat() {
      if (musicOn()) kit.music.stinger('lose', { duck: 0.85 });
      else this.play('defeat');
    },
  };
  const musicOn = () => !!(kit && eng.enabled && eng.musicEnabled && kit.music.playing);

  function startWanted() {
    if (!kit || !kit.mixer.ready || !eng.musicEnabled) return;
    kit.music.play('adventure', wanted.seed, { intensity: wanted.intensity, fade: 1.6 });
  }

  function unlock() {
    if (!kit) return;
    const first = !kit.mixer.ready;
    if (kit.mixer.unlock() && first) { kit.sfx.unlock(); kit.mixer.setMuted(!eng.enabled); kit.mixer.muffle(muffled ? 0.7 : 0, 0.01); startWanted(); }
    else kit.sfx.unlock();
  }

  // A real gesture lets the AudioContext start.
  addEventListener('pointerdown', unlock, { capture: true });
  addEventListener('touchend', unlock, { capture: true });
  addEventListener('keydown', (e) => {
    unlock();
    // M toggles Sound (the game binds no keys of its own); not while typing a name or password
    if (e.code === 'KeyM' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey && !(e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName))) eng.toggleSound();
  }, { capture: true });
  document.addEventListener('visibilitychange', () => {
    const ctx = kit && kit.mixer.context;
    if (!ctx) return;
    try { if (document.hidden) ctx.suspend(); else ctx.resume(); } catch { /* closed */ }
  });

  Promise.all([import(KIT + 'mixer.js'), import(KIT + 'music.js'), import(KIT + 'sfx.js')]).then(([mx, mu, sf]) => {
    const mixer = mx.createMixer({ storageKey: 'aetherquest.audio', persist: false });
    mixer.setVolume('music', 0.8);
    const music = mu.createMusic({ mixer });
    const sfx = sf.createSfx({ mixer, theme: 'fantasy', volume: 1 }).defineAll(SOUNDS);
    kit = { mixer, music, sfx };
    eng.ready = true;
    // A gesture that came before the modules did still counts (sticky activation).
    if (navigator.userActivation && navigator.userActivation.hasBeenActive) unlock();
  }).catch(() => { /* no audio: the game plays on silently */ });

  window.soundEngine = eng;
})();

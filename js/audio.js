// ============================================================================
// AetherQuest - Web Audio Procedural Synthesizer & Music Engine
// ============================================================================

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = localStorage.getItem('aetherquest_sound') !== 'false';
    this.musicEnabled = localStorage.getItem('aetherquest_music') === 'true';
    this.musicInterval = null;
    this.musicStep = 0;
  }

  initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleSound() {
    this.enabled = !this.enabled;
    localStorage.setItem('aetherquest_sound', this.enabled ? 'true' : 'false');
    if (!this.enabled && this.musicInterval) {
      this.stopMusic();
    }
    return this.enabled;
  }

  toggleMusic() {
    this.musicEnabled = !this.musicEnabled;
    localStorage.setItem('aetherquest_music', this.musicEnabled ? 'true' : 'false');
    if (this.musicEnabled) {
      this.startMusic();
    } else {
      this.stopMusic();
    }
    return this.musicEnabled;
  }

  playTone(freq, type = 'sine', duration = 0.15, gainVal = 0.15, pitchBend = 0) {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      if (pitchBend !== 0) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(10, freq + pitchBend), this.ctx.currentTime + duration);
      }

      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      // Audio context policy safe ignore
    }
  }

  playNoise(duration = 0.15, gainVal = 0.15) {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const bufferSize = this.ctx.sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, this.ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + duration);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      whiteNoise.start();
      whiteNoise.stop(this.ctx.currentTime + duration);
    } catch (e) {}
  }

  // Combat SFX
  attack() {
    this.playTone(320, 'triangle', 0.12, 0.2, -180);
    this.playNoise(0.08, 0.15);
  }

  crit() {
    this.playTone(450, 'sawtooth', 0.25, 0.3, -300);
    this.playNoise(0.2, 0.3);
  }

  dodge() {
    this.playTone(220, 'sine', 0.15, 0.15, 300);
  }

  spellCast(element = 'arcane') {
    switch (element) {
      case 'fire':
        this.playTone(180, 'sawtooth', 0.3, 0.25, 120);
        this.playNoise(0.25, 0.25);
        break;
      case 'water':
      case 'ice':
        this.playTone(650, 'sine', 0.25, 0.2, -200);
        setTimeout(() => this.playTone(880, 'triangle', 0.2, 0.15), 60);
        break;
      case 'lightning':
        this.playTone(120, 'sawtooth', 0.1, 0.3, 700);
        this.playNoise(0.15, 0.3);
        break;
      case 'light':
        this.playTone(523, 'sine', 0.3, 0.2);
        setTimeout(() => this.playTone(659, 'sine', 0.3, 0.2), 80);
        setTimeout(() => this.playTone(784, 'sine', 0.4, 0.25), 160);
        break;
      case 'darkness':
        this.playTone(130, 'sawtooth', 0.4, 0.25, -50);
        setTimeout(() => this.playTone(95, 'sawtooth', 0.35, 0.2), 100);
        break;
      default: // arcane / physical
        this.playTone(440, 'triangle', 0.25, 0.2, 220);
        setTimeout(() => this.playTone(550, 'sine', 0.2, 0.2), 80);
        break;
    }
  }

  heal() {
    this.playTone(440, 'sine', 0.2, 0.18);
    setTimeout(() => this.playTone(554, 'sine', 0.2, 0.18), 70);
    setTimeout(() => this.playTone(659, 'sine', 0.3, 0.2), 140);
    setTimeout(() => this.playTone(880, 'sine', 0.4, 0.25), 210);
  }

  potion() {
    this.playTone(350, 'triangle', 0.08, 0.18, 120);
    setTimeout(() => this.playTone(420, 'triangle', 0.08, 0.18, 150), 90);
    setTimeout(() => this.playTone(520, 'triangle', 0.14, 0.2, 200), 180);
  }

  buy() {
    this.playTone(987, 'square', 0.08, 0.12);
    setTimeout(() => this.playTone(1318, 'square', 0.15, 0.15), 70);
  }

  click() {
    this.playTone(600, 'square', 0.04, 0.08, -150);
  }

  levelUp() {
    const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50];
    notes.forEach((f, i) => {
      setTimeout(() => this.playTone(f, 'triangle', 0.25, 0.25), i * 90);
    });
  }

  victory() {
    const melody = [
      { f: 523.25, d: 0.15 },
      { f: 523.25, d: 0.15 },
      { f: 523.25, d: 0.15 },
      { f: 659.25, d: 0.35 },
      { f: 587.33, d: 0.15 },
      { f: 659.25, d: 0.15 },
      { f: 783.99, d: 0.6 }
    ];
    let time = 0;
    melody.forEach(m => {
      setTimeout(() => this.playTone(m.f, 'triangle', m.d, 0.25), time);
      time += m.d * 1000 * 0.85;
    });
  }

  defeat() {
    const notes = [392.00, 370.00, 349.23, 311.13, 261.63];
    notes.forEach((f, i) => {
      setTimeout(() => this.playTone(f, 'sawtooth', 0.35, 0.2), i * 160);
    });
  }

  // Ambient Chiptune Background Music
  startMusic() {
    if (this.musicInterval) clearInterval(this.musicInterval);
    if (!this.musicEnabled || !this.enabled) return;

    this.initContext();
    const chords = [
      [220, 261.63, 329.63], // A minor
      [174.61, 220, 261.63], // F major
      [196, 246.94, 293.66], // G major
      [164.81, 196, 246.94]  // E minor
    ];

    const arpeggio = [0, 1, 2, 1, 0, 2, 1, 2];
    this.musicStep = 0;

    this.musicInterval = setInterval(() => {
      if (!this.musicEnabled || !this.enabled || !this.ctx) return;
      const chordIndex = Math.floor((this.musicStep / arpeggio.length) % chords.length);
      const noteIndex = arpeggio[this.musicStep % arpeggio.length];
      const chord = chords[chordIndex];
      const freq = chord[noteIndex] * 1.5;

      this.playTone(freq, 'sine', 0.18, 0.04);
      if (this.musicStep % 4 === 0) {
        this.playTone(chord[0] * 0.5, 'triangle', 0.3, 0.05);
      }
      this.musicStep++;
    }, 220);
  }

  stopMusic() {
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
  }
}

window.soundEngine = new SoundEngine();

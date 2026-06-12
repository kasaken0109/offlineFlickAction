// Web Audio API - synthetic sound effects (no files needed, works offline)
const Audio = (() => {
  let ctx = null;

  function getCtx() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function playTone({ type = 'sine', freq = 440, freq2 = null, gain = 0.3, attack = 0.01, decay = 0.1, duration = 0.15 }) {
    try {
      const c = getCtx();
      const osc = c.createOscillator();
      const gainNode = c.createGain();
      osc.connect(gainNode);
      gainNode.connect(c.destination);

      osc.type = type;
      osc.frequency.setValueAtTime(freq, c.currentTime);
      if (freq2) osc.frequency.linearRampToValueAtTime(freq2, c.currentTime + duration);

      gainNode.gain.setValueAtTime(0, c.currentTime);
      gainNode.gain.linearRampToValueAtTime(gain, c.currentTime + attack);
      gainNode.gain.exponentialRampToValueAtTime(0.001, c.currentTime + attack + decay);

      osc.start(c.currentTime);
      osc.stop(c.currentTime + duration);
    } catch (_) {}
  }

  function playNoise({ gain = 0.2, duration = 0.1, filterFreq = 800 }) {
    try {
      const c = getCtx();
      const bufferSize = c.sampleRate * duration;
      const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

      const source = c.createBufferSource();
      source.buffer = buffer;

      const filter = c.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = filterFreq;
      filter.Q.value = 0.5;

      const gainNode = c.createGain();
      gainNode.gain.setValueAtTime(gain, c.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);

      source.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(c.destination);
      source.start();
    } catch (_) {}
  }

  return {
    flick() {
      playTone({ type: 'square', freq: 300, freq2: 800, gain: 0.25, attack: 0.005, decay: 0.08, duration: 0.12 });
    },
    hit() {
      playTone({ type: 'sawtooth', freq: 180, freq2: 80, gain: 0.3, attack: 0.005, decay: 0.12, duration: 0.15 });
      playNoise({ gain: 0.15, duration: 0.08, filterFreq: 1200 });
    },
    enemyDeath() {
      playTone({ type: 'square', freq: 440, freq2: 880, gain: 0.2, attack: 0.005, decay: 0.15, duration: 0.18 });
    },
    combo(count) {
      const note = 220 * Math.pow(1.12, Math.min(count, 20));
      playTone({ type: 'triangle', freq: note, freq2: note * 1.5, gain: 0.25, attack: 0.01, decay: 0.2, duration: 0.25 });
    },
    damage() {
      playNoise({ gain: 0.4, duration: 0.2, filterFreq: 300 });
      playTone({ type: 'sawtooth', freq: 80, freq2: 40, gain: 0.35, attack: 0.005, decay: 0.25, duration: 0.3 });
    },
    waveStart(wave) {
      const freqs = [261, 329, 392, 523];
      freqs.forEach((f, i) => {
        setTimeout(() => {
          playTone({ type: 'triangle', freq: f, gain: 0.2, attack: 0.02, decay: 0.2, duration: 0.3 });
        }, i * 80);
      });
    },
    gameOver() {
      [440, 330, 220, 110].forEach((f, i) => {
        setTimeout(() => {
          playTone({ type: 'sawtooth', freq: f, gain: 0.2, attack: 0.02, decay: 0.3, duration: 0.35 });
        }, i * 120);
      });
    },
    unlock() {
      playTone({ type: 'triangle', freq: 880, freq2: 1760, gain: 0.25, attack: 0.01, decay: 0.3, duration: 0.4 });
    }
  };
})();

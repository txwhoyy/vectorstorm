// Procedural sound: every effect is an oscillator (or a burst of filtered noise) shaped by a
// gain envelope, synthesised by the Web Audio API at the moment it plays. The game ships no
// audio files. The context is created lazily and resumed on the first user gesture, as browsers
// require; until then, and while muted, every call is a no-op.

const MASTER_VOLUME = 0.32;
/** The shoot blip is short and frequent; this keeps a held trigger from stacking dozens of them. */
const SHOOT_MIN_GAP = 0.045;

export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;
  let lastShootAt = -1;

  /** Create (once) and resume the context. Called from click and key handlers in main. */
  function unlock() {
    if (context === null) {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return;
      context = new AudioCtor();
      master = context.createGain();
      master.gain.value = muted ? 0 : MASTER_VOLUME;
      master.connect(context.destination);
    }
    if (context.state === 'suspended') context.resume();
  }

  /** One oscillator voice: a pitch glide from `from` to `to` over `seconds`, fading out. */
  function tone(type, from, to, seconds, volume, delay = 0) {
    if (context === null || muted) return;
    const start = context.currentTime + delay;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(to, 1), start + seconds);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start + seconds + 0.02);
  }

  /** One noise burst through a low-pass filter: the body of an explosion. */
  function noise(seconds, volume, cutoff, delay = 0) {
    if (context === null || muted) return;
    const start = context.currentTime + delay;
    const frames = Math.max(1, Math.floor(context.sampleRate * seconds));
    const buffer = context.createBuffer(1, frames, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, start);
    filter.frequency.exponentialRampToValueAtTime(60, start + seconds);
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(start);
  }

  return {
    unlock,
    get muted() {
      return muted;
    },
    toggleMuted() {
      muted = !muted;
      if (master !== null) master.gain.value = muted ? 0 : MASTER_VOLUME;
      return muted;
    },
    shoot() {
      if (context === null || muted) return;
      const now = context.currentTime;
      if (now - lastShootAt < SHOOT_MIN_GAP) return;
      lastShootAt = now;
      tone('square', 880, 220, 0.09, 0.10);
    },
    explosion(big) {
      noise(big ? 0.55 : 0.28, big ? 0.5 : 0.26, big ? 900 : 1400);
      tone('triangle', big ? 160 : 220, 40, big ? 0.5 : 0.25, 0.3);
    },
    hurt() {
      tone('sawtooth', 300, 70, 0.22, 0.3);
      noise(0.15, 0.2, 2000);
    },
    shieldBreak() {
      tone('triangle', 1200, 300, 0.25, 0.25);
      tone('sine', 1800, 500, 0.3, 0.15, 0.03);
    },
    powerup() {
      tone('sine', 520, 780, 0.09, 0.2);
      tone('sine', 780, 1180, 0.12, 0.2, 0.07);
    },
    waveStart() {
      tone('sawtooth', 196, 196, 0.12, 0.14);
      tone('sawtooth', 294, 294, 0.12, 0.14, 0.1);
      tone('sawtooth', 392, 392, 0.2, 0.16, 0.2);
    },
    gameOver() {
      tone('triangle', 392, 392, 0.22, 0.22);
      tone('triangle', 311, 311, 0.22, 0.22, 0.22);
      tone('triangle', 262, 196, 0.55, 0.24, 0.44);
    },
    uiStart() {
      tone('sine', 440, 660, 0.08, 0.15);
      tone('sine', 660, 990, 0.1, 0.15, 0.06);
    },
  };
}

// Sound (plan §5.5), made in the browser with Web Audio: no audio files and no
// licenses (owner, 2026-10-23). The timer ding always plays, since a timer
// rings until it's stopped (owner, 2026-10-22); the effects (a sizzle on Next,
// a stamp thunk, the rank-up fanfare) follow the mute toggle, which is
// remembered on this device.
// Browsers allow sound only after a tap on the page, and can suspend it again
// when the app goes to the background, so every tap turns it back on.
const MUTE = 'cpr.mute';
let audio = null;

export function unlockSound() {
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state !== 'running') return audio.resume().catch(() => {});
  } catch { audio = null; }
  return Promise.resolve();
}
export const soundReady = () => audio?.state === 'running';

export function isMuted() { try { return localStorage.getItem(MUTE) === '1'; } catch { return false; } }
export function setMuted(on) { try { if (on) localStorage.setItem(MUTE, '1'); else localStorage.removeItem(MUTE); } catch { /* not kept */ } }

// One note: frequency, start (seconds from now), length, loudness, wave.
function tone(freq, at, len, vol = 0.25, type = 'sine') {
  const t = audio.currentTime + at, o = audio.createOscillator(), g = audio.createGain();
  o.type = type; o.frequency.value = freq; o.connect(g); g.connect(audio.destination);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  o.start(t); o.stop(t + len + 0.02);
}

// Filtered noise: a sizzle (high) or a thunk (low).
function noise(len, { type, freq, vol, at = 0 }) {
  const n = Math.floor(audio.sampleRate * len), buf = audio.createBuffer(1, n, audio.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = audio.createBufferSource(), f = audio.createBiquadFilter(), g = audio.createGain();
  src.buffer = buf; f.type = type; f.frequency.value = freq; g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(audio.destination);
  src.start(audio.currentTime + at);
}

const play = (fn, effect = true) => {
  if (!audio || (effect && isMuted())) return;
  try { fn(); } catch { /* no sound on this device */ }
};

// The timer: three high dings, and a buzz where the device can.
export function ding() {
  play(() => [0, 0.28, 0.56].forEach((d) => tone(880, d, 0.25, 0.3)), false);
  try { navigator.vibrate?.([200, 100, 200]); } catch { /* no vibration */ }
}
export const sizzle = () => play(() => noise(0.35, { type: 'highpass', freq: 3500, vol: 0.12 }));
export const thunk = () => play(() => { noise(0.18, { type: 'lowpass', freq: 400, vol: 0.9 }); tone(90, 0, 0.18, 0.4, 'triangle'); });
export const chime = () => play(() => [659, 988].forEach((f, i) => tone(f, i * 0.12, 0.3, 0.18, 'triangle')));
export const fanfare = () => play(() => [[523, 0], [659, 0.14], [784, 0.28], [1047, 0.46]].forEach(([f, at], i) => tone(f, at, i === 3 ? 0.7 : 0.18, 0.12, 'square')));

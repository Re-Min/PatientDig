// Tiny procedural sound effects (filtered noise / clicks) so each tool sounds different without audio files.
let ctx = null;
let noise = null;

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function burst({ freq, q = 1, dur = 0.2, gain = 0.3, type = 'bandpass', delay = 0 }) {
  const c = ensure();
  if (!c) return;
  const t = c.currentTime + delay;
  const src = c.createBufferSource();
  src.buffer = noise;
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = c.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(c.destination);
  src.start(t, Math.random() * 0.5, dur + 0.05);
}

function tone(freq, dur = 0.08, gain = 0.15, delay = 0) {
  const c = ensure();
  if (!c) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  o.type = 'triangle';
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(freq * 0.6, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export const sfx = {
  unlock: ensure,
  trowel: () => { burst({ freq: 900, q: 0.7, dur: 0.22, gain: 0.35 }); burst({ freq: 300, q: 0.8, dur: 0.3, gain: 0.25, delay: 0.25 }); },
  brush: () => burst({ freq: 4200, q: 0.6, dur: 0.12, gain: 0.06, type: 'highpass' }),
  pick: () => { tone(1800, 0.04, 0.08); burst({ freq: 2500, q: 2, dur: 0.06, gain: 0.12 }); },
  bone: () => { tone(420, 0.12, 0.25); tone(260, 0.16, 0.15, 0.03); },
  shutter: () => { burst({ freq: 5000, q: 1, dur: 0.05, gain: 0.25 }); burst({ freq: 3000, q: 1, dur: 0.05, gain: 0.2, delay: 0.08 }); },
  chime: () => { [660, 880, 1320].forEach((f, i) => tone(f, 0.35, 0.12, i * 0.11)); },
};

/**
 * Small, pleasant timer chimes made with the Web Audio API (no audio files).
 * 15 min: one soft tone. 5 min: two tones. 1 min: three rising tones. Time up: a longer chord.
 */
export type ChimeKind = 15 | 5 | 1 | 0;

const MUTE_KEY = 'oj:timerMuted';
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    return ctx;
  } catch {
    return null;
  }
}

/** Browsers only allow sound after a user gesture: call this from a click/keydown handler. */
export function unlockAudio() {
  const a = audio();
  if (a && a.state === 'suspended') a.resume().catch(() => undefined);
}

export function isMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setMuted(v: boolean) {
  try {
    window.localStorage.setItem(MUTE_KEY, v ? '1' : '0');
  } catch {
    /* ignore */
  }
}

/** A bell-like note: a sine with a quiet octave partial and an exponential fade. */
function bell(a: AudioContext, freq: number, at: number, length: number, volume: number) {
  const out = a.createGain();
  out.gain.setValueAtTime(0.0001, at);
  out.gain.exponentialRampToValueAtTime(volume, at + 0.015);
  out.gain.exponentialRampToValueAtTime(0.0001, at + length);
  out.connect(a.destination);
  const partials: [number, number][] = [
    [1, 1],
    [2, 0.25],
    [3, 0.08],
  ];
  for (const [mult, amp] of partials) {
    const osc = a.createOscillator();
    const g = a.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * mult, at);
    g.gain.setValueAtTime(amp, at);
    osc.connect(g).connect(out);
    osc.start(at);
    osc.stop(at + length + 0.05);
  }
}

const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const C6 = 1046.5;

export function playChime(kind: ChimeKind) {
  if (isMuted()) return;
  const a = audio();
  if (!a) return;
  if (a.state === 'suspended') a.resume().catch(() => undefined);
  const t = a.currentTime + 0.05;
  switch (kind) {
    case 15:
      bell(a, E5, t, 1.2, 0.18);
      break;
    case 5:
      bell(a, G5, t, 0.9, 0.2);
      bell(a, G5, t + 0.4, 1.1, 0.2);
      break;
    case 1:
      bell(a, C5, t, 0.8, 0.22);
      bell(a, E5, t + 0.25, 0.8, 0.22);
      bell(a, G5, t + 0.5, 1.2, 0.22);
      break;
    case 0:
      for (const [f, d] of [
        [C5, 0],
        [E5, 0.06],
        [G5, 0.12],
        [C6, 0.18],
      ] as const)
        bell(a, f, t + d, 2.4, 0.14);
      break;
  }
}

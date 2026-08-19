// Web Audio: turns the numbers from `bell.ts` into actual sound.
//
// Everything here is synthesised at strike time. Nothing is loaded, nothing is
// played back — that is the spec's first hard line, and it is also why the
// bell can change timbre continuously as you resize it, which no set of
// samples could do.

import { bellFrequency, bellPartials, ringSeconds, strikeGain } from "./bell";

/** Overlapping rings are the point; leaked oscillators are not. */
const MAX_VOICES = 6;

interface Engine {
  ctx: AudioContext;
  /** Everything dry goes here. */
  master: GainNode;
  /** Everything wet goes here, via a pre-delay, into the hall. */
  send: GainNode;
}

interface Voice {
  gain: GainNode;
  endsAt: number;
}

let engine: Engine | null = null;
let voices: Voice[] = [];

/**
 * A big stone hall, generated rather than loaded: noise shaped by an
 * exponential decay is a perfectly good impulse response, and it keeps the
 * promise that nothing audible ships as a file.
 */
function hallImpulse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel += 1) {
    const samples = impulse.getChannelData(channel);
    for (let i = 0; i < length; i += 1) {
      // A touch of early sparseness, then a smooth tail.
      const t = i / length;
      const density = i < ctx.sampleRate * 0.02 ? 0.35 : 1;
      samples[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * density;
    }
  }
  return impulse;
}

/**
 * The context starts suspended and browsers will not make a sound until a real
 * gesture, so this must be called from inside a pointer/touch handler — never
 * on load. Safe to call on every gesture; it builds the graph once.
 */
export function ensureAudio(): Engine | null {
  if (engine) {
    if (engine.ctx.state === "suspended") void engine.ctx.resume();
    return engine;
  }

  const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;

  const ctx = new Ctor();
  void ctx.resume();

  const master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);

  const hall = ctx.createConvolver();
  hall.buffer = hallImpulse(ctx, 4.5, 3.1);

  // Pre-delay: the gap before the first reflection is what makes a room read
  // as big rather than as a small tiled one.
  const preDelay = ctx.createDelay(0.2);
  preDelay.delayTime.value = 0.045;

  const wet = ctx.createGain();
  wet.gain.value = 0.55;

  const send = ctx.createGain();
  send.gain.value = 1;
  send.connect(preDelay);
  preDelay.connect(hall);
  hall.connect(wet);
  wet.connect(master);

  engine = { ctx, master, send };
  return engine;
}

/** Short filtered noise: the metal-on-wood contact, before the bell answers. */
function strikeTransient(
  { ctx, master, send }: Engine,
  at: number,
  prime: number,
  velocity: number,
): void {
  const length = Math.floor(ctx.sampleRate * 0.06);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    samples[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.5);
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = Math.min(9000, prime * 7);
  band.Q.value = 0.9;

  const gain = ctx.createGain();
  gain.gain.value = 0.18 * (0.3 + 0.7 * velocity);

  source.connect(band);
  band.connect(gain);
  gain.connect(master);
  gain.connect(send);
  source.start(at);
  source.onended = () => gain.disconnect();
}

function retireOldestVoice(): void {
  const oldest = voices.shift();
  if (!oldest || !engine) return;
  const { ctx } = engine;
  const now = ctx.currentTime;
  oldest.gain.gain.cancelScheduledValues(now);
  oldest.gain.gain.setValueAtTime(Math.max(oldest.gain.gain.value, 1e-4), now);
  oldest.gain.gain.exponentialRampToValueAtTime(1e-4, now + 0.35);
  window.setTimeout(() => oldest.gain.disconnect(), 500);
}

/**
 * Strike the bell. `size` is the bell's current size, `velocity` how hard the
 * beam landed (0..1). Rings overlap by design: a second strike over a ringing
 * bell is a chord, not an interruption.
 */
export function strikeBell(size: number, velocity: number): void {
  const active = ensureAudio();
  if (!active) return;

  const { ctx, master, send } = active;
  const at = ctx.currentTime;
  const prime = bellFrequency(size);
  const partials = bellPartials(size, velocity);
  const ring = ringSeconds(size, velocity);

  while (voices.length >= MAX_VOICES) retireOldestVoice();

  const voice = ctx.createGain();
  voice.gain.value = strikeGain(velocity);
  voice.connect(master);
  voice.connect(send);

  for (const partial of partials) {
    const frequency = prime * partial.ratio;
    if (frequency > 16000) continue;

    for (const cents of partial.detune) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = frequency;
      osc.detune.value = cents;

      const envelope = ctx.createGain();
      const peak = partial.gain / partial.detune.length;
      // A bell's onset is fast but not instant; a hard edge here clicks.
      envelope.gain.setValueAtTime(0, at);
      envelope.gain.linearRampToValueAtTime(peak, at + 0.006);
      // Exponential ramps cannot reach 0 — aim at an epsilon and then stop.
      envelope.gain.exponentialRampToValueAtTime(1e-4, at + partial.decay);

      osc.connect(envelope);
      envelope.connect(voice);
      osc.start(at);
      osc.stop(at + partial.decay + 0.05);
      osc.onended = () => envelope.disconnect();
    }
  }

  strikeTransient(active, at, prime, velocity);

  const record: Voice = { gain: voice, endsAt: at + ring };
  voices.push(record);
  window.setTimeout(
    () => {
      voice.disconnect();
      voices = voices.filter((v) => v !== record);
    },
    (ring + 0.4) * 1000,
  );
}

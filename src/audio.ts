// Web Audio: turns the numbers from `bell.ts` into actual sound.
//
// Everything here is synthesised at strike time. Nothing is loaded, nothing is
// played back — that is the spec's first hard line, and it is also why the
// bell can change timbre continuously as you resize it, which no set of
// samples could do.

import { bellFrequency, bellPartials, ringSeconds, strikeGain } from "./bell";

/** Overlapping rings are the point; leaked oscillators are not. */
const MAX_VOICES = 8;

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

  // Catches peaks only, so eight overlapping rings can't stack into clipping.
  // A high threshold and a fast attack keep it out of the way of the tail.
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -6;
  limiter.knee.value = 6;
  limiter.ratio.value = 8;
  limiter.attack.value = 0.004;
  limiter.release.value = 0.25;
  limiter.connect(ctx.destination);

  // A little lift above 2k is the difference between "bronze" and "wool".
  const air = ctx.createBiquadFilter();
  air.type = "highshelf";
  air.frequency.value = 2200;
  air.gain.value = 3.5;
  air.connect(limiter);

  const master = ctx.createGain();
  master.gain.value = 0.85;
  master.connect(air);

  const hall = ctx.createConvolver();
  hall.buffer = hallImpulse(ctx, 4.8, 2.6);

  // Only the mids and highs go to the hall. Sending the hum and the prime into
  // a four-second tail is exactly what turns a big room into a muddy one — the
  // low end stays dry, so it reads as tight and close while the bell's upper
  // voices bloom behind it.
  const sendShape = ctx.createBiquadFilter();
  sendShape.type = "highpass";
  sendShape.frequency.value = 220;
  sendShape.Q.value = 0.5;

  // Pre-delay: the gap before the first reflection is what makes a room read
  // as big rather than as a small tiled one.
  const preDelay = ctx.createDelay(0.2);
  preDelay.delayTime.value = 0.05;

  const wet = ctx.createGain();
  wet.gain.value = 0.4;

  const send = ctx.createGain();
  send.gain.value = 1;
  send.connect(sendShape);
  sendShape.connect(preDelay);
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

  // High and fairly narrow: this is the 铛, the metal-on-metal edge of the
  // contact, and it wants to sit above the bell's own partials rather than
  // thicken them.
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = Math.min(11000, prime * 13);
  band.Q.value = 1.4;

  const gain = ctx.createGain();
  gain.gain.value = 0.22 * (0.3 + 0.7 * velocity);

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

  // Every partial ramps up from silence at the same instant, so their peaks
  // land in phase and the sum overshoots 1 — which clips, and clipping is
  // heard as mud rather than as loudness. Normalise against the sum so a
  // voice peaks at strikeGain() and no further.
  const total = partials.reduce((sum, partial) => sum + partial.gain, 0) || 1;

  for (const partial of partials) {
    const frequency = prime * partial.ratio;
    if (frequency > 16000) continue;

    // The upper modes of a struck bell start first — they need less of the
    // blow to get moving. Staggering the onsets by a few milliseconds is both
    // physically right and what decorrelates the attack.
    const onset = at + 0.0045 / partial.ratio;

    for (const cents of partial.detune) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = frequency;
      osc.detune.value = cents;

      const envelope = ctx.createGain();
      const peak = partial.gain / total / partial.detune.length;
      // A bell's onset is fast but not instant; a hard edge here clicks.
      envelope.gain.setValueAtTime(0, onset);
      envelope.gain.linearRampToValueAtTime(peak, onset + 0.005);
      // Exponential ramps cannot reach 0 — aim at an epsilon and then stop.
      envelope.gain.exponentialRampToValueAtTime(1e-4, onset + partial.decay);

      osc.connect(envelope);
      envelope.connect(voice);
      osc.start(onset);
      osc.stop(onset + partial.decay + 0.05);
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

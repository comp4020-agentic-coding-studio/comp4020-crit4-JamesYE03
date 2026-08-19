// The bell's voice, as plain numbers.
//
// No AudioContext and no DOM in here on purpose: this is the part the spec
// tests can actually pin down ("a bigger bell is lower", "a harder strike
// rings longer"), and keeping it pure is what lets them assert the contract
// instead of the wiring. `src/audio.ts` turns these numbers into oscillators.
//
// Why additive-inharmonic rather than Karplus-Strong: K-S is a plucked-string
// algorithm, and its delay line produces a HARMONIC comb — partials at integer
// multiples of one fundamental. A bell's partials are famously *inharmonic*,
// and that is the entire difference between "bell" and "string". The ratios
// below are the named partials of a cast bronze bell (hum, prime, tierce,
// quint, nominal and the upper voices); the tierce being a *minor* third is
// why bells sound solemn rather than sweet.

export const MIN_SIZE = 0.6;
export const MAX_SIZE = 1.8;
export const DEFAULT_SIZE = 1;

/** The prime partial of a bell at size 1. Everything else hangs off this. */
const PRIME_AT_UNIT_SIZE = 210;

export interface BellPartial {
  /** Multiple of the prime partial. Deliberately not an integer sequence. */
  ratio: number;
  /** Peak amplitude, relative. */
  gain: number;
  /** Seconds from strike to silence for this partial alone. */
  decay: number;
  /**
   * Cents offsets for the oscillators voicing this partial. Two slightly
   * detuned oscillators beat against each other, which is the slow shimmer a
   * real bell has and a single sine does not.
   */
  detune: number[];
}

interface PartialShape {
  ratio: number;
  gain: number;
  decay: number;
  detune: number[];
}

// Peak gains and decays are quoted for a size-1 bell struck at full force.
//
// The top three ratios are what make it read as *bronze* rather than as a soft
// pad: without partials up in the low kilohertz there is nothing for the ear to
// hear as metal, and the whole thing sounds muddy however long it rings. The
// hum is deliberately held back — it carries the length, not the loudness.
const SHAPE: readonly PartialShape[] = [
  { ratio: 0.5, gain: 0.26, decay: 13.0, detune: [-3, 3] }, // hum — outlasts everything
  { ratio: 1.0, gain: 0.92, decay: 12.5, detune: [-2, 2] }, // prime
  { ratio: 1.183, gain: 0.62, decay: 9.5, detune: [-4, 4] }, // tierce (minor third)
  { ratio: 1.506, gain: 0.44, decay: 7.5, detune: [-5, 5] }, // quint
  { ratio: 2.0, gain: 0.6, decay: 6.2, detune: [-3, 3] }, // nominal
  { ratio: 2.514, gain: 0.34, decay: 4.4, detune: [0] }, // deciem
  { ratio: 2.662, gain: 0.28, decay: 3.8, detune: [0] }, // undeciem
  { ratio: 3.011, gain: 0.26, decay: 3.0, detune: [0] }, // duodeciem
  { ratio: 4.166, gain: 0.2, decay: 2.1, detune: [0] }, // upper octave
  { ratio: 5.433, gain: 0.13, decay: 1.4, detune: [0] }, // and the bright voices
  { ratio: 6.796, gain: 0.09, decay: 0.95, detune: [0] }, // that carry the strike
  { ratio: 8.521, gain: 0.06, decay: 0.62, detune: [0] }, // — the 铛 in the attack
];

export function clampSize(size: number): number {
  if (Number.isNaN(size)) return DEFAULT_SIZE;
  return Math.min(MAX_SIZE, Math.max(MIN_SIZE, size));
}

/** Bigger bell, lower bell — a bell's pitch goes as the inverse of its size. */
export function bellFrequency(size: number): number {
  return PRIME_AT_UNIT_SIZE / clampSize(size);
}

/**
 * Size and force both tilt the spectrum, which is why resizing the bell
 * changes its *timbre* and not just its pitch. A big bell is dark: its upper
 * partials fall away and its hum dominates. A hard strike is bright: it puts
 * energy into the upper partials that a gentle one never wakes.
 */
export function bellPartials(size: number, velocity: number): BellPartial[] {
  const s = clampSize(size);
  const v = Math.min(1, Math.max(0, velocity));
  const sizeTilt = (s - 1) * 0.9; // > 0 for big bells: darker
  const forceTilt = (v - 0.5) * 0.8; // > 0 for hard strikes: brighter
  // Even a gentle strike should ring on for a while: a temple bell's tail is
  // most of its character, so the velocity term floors well above zero.
  const decayScale = Math.pow(s, 0.55) * (0.68 + 0.55 * v);

  return SHAPE.map((partial) => ({
    ratio: partial.ratio,
    gain: partial.gain * Math.pow(partial.ratio, forceTilt - sizeTilt),
    decay: partial.decay * decayScale,
    detune: partial.detune,
  }));
}

/**
 * Overall level of one strike. `audio.ts` normalises the partials against their
 * own sum, so this really is the voice's peak — kept under 1 so strikes can
 * overlap, with the limiter there for when several land at once.
 */
export function strikeGain(velocity: number): number {
  const v = Math.min(1, Math.max(0, velocity));
  return 0.14 + 0.62 * Math.pow(v, 1.3);
}

/** How long this strike rings for, in seconds — the longest partial wins. */
export function ringSeconds(size: number, velocity: number): number {
  return bellPartials(size, velocity).reduce((longest, p) => Math.max(longest, p.decay), 0);
}

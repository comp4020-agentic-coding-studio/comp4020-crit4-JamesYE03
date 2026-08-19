// The beam (撞木), as plain numbers.
//
// A horizontal log hung by two ropes from a single pivot above the bell. At
// rest it hangs straight down and its head is against the bell. Drag it left
// and it rides up a circular arc about that pivot; let go and gravity brings
// it back down through rest, into the bell. Higher raise, harder landing.
//
// It strikes ONCE and settles: no rebound, no second hit. That is a design
// decision, not a physical one — a real beam bounces, but a bell that keeps
// hitting itself takes the instrument out of the player's hands.
//
// Pure, like `bell.ts`, so the spec tests can run the whole swing without a
// browser.

/** Straight down, head against the bell. */
export const REST_ANGLE = 0;

/** As far as the ropes and the scene allow, in radians (~74°). */
export const MAX_ANGLE = 1.3;

const GRAVITY_OVER_LENGTH = 7.0; // g/L — a heavy beam on a ~1.4m rope
const DAMPING = 0.12; // air, and rope that is not frictionless

export interface Beam {
  /** Radians from rest. Always in [REST_ANGLE, MAX_ANGLE]. */
  angle: number;
  angularVelocity: number;
  released: boolean;
  struck: boolean;
  /** How hard it landed, 0..1. Zero until it lands. */
  strikeVelocity: number;
}

/** Fastest the beam can ever be travelling at the bottom of its arc. */
const MAX_SPEED = Math.sqrt(2 * GRAVITY_OVER_LENGTH * (1 - Math.cos(MAX_ANGLE)));

export function clampAngle(angle: number): number {
  if (Number.isNaN(angle)) return REST_ANGLE;
  return Math.min(MAX_ANGLE, Math.max(REST_ANGLE, angle));
}

export function createBeam(angle: number = REST_ANGLE): Beam {
  return {
    angle: clampAngle(angle),
    angularVelocity: 0,
    released: false,
    struck: false,
    strikeVelocity: 0,
  };
}

/**
 * The energy the player has stored by raising the beam this far, as 0..1.
 *
 * This is the ideal, frictionless law (v ∝ √(1 − cos θ)) that the simulation
 * below approximates. The UI reads it live while you drag, to show how hard
 * the next strike will be before you commit to it.
 */
export function normalisedStrike(angle: number): number {
  const a = clampAngle(angle);
  return Math.sqrt((1 - Math.cos(a)) / (1 - Math.cos(MAX_ANGLE)));
}

export function raise(beam: Beam, angle: number): Beam {
  if (beam.released) return beam;
  return { ...beam, angle: clampAngle(angle), struck: false, strikeVelocity: 0 };
}

export function release(beam: Beam): Beam {
  return { ...beam, released: true, struck: false, strikeVelocity: 0 };
}

/**
 * One step of the swing. Returns a new beam; the caller compares `struck`
 * against the previous frame to know a strike just happened.
 */
export function stepBeam(beam: Beam, dt: number): Beam {
  if (!beam.released || beam.struck) return beam;

  const acceleration =
    -GRAVITY_OVER_LENGTH * Math.sin(beam.angle) - DAMPING * beam.angularVelocity;
  const angularVelocity = beam.angularVelocity + acceleration * dt;
  const angle = beam.angle + angularVelocity * dt;

  if (angle <= REST_ANGLE) {
    return {
      angle: REST_ANGLE,
      angularVelocity: 0,
      released: false,
      struck: true,
      strikeVelocity: Math.min(1, Math.abs(angularVelocity) / MAX_SPEED),
    };
  }

  return { ...beam, angle: clampAngle(angle), angularVelocity };
}

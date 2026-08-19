// Where everything sits, as plain numbers — and the one relationship between
// those numbers that has to hold for the instrument to make physical sense.
//
// This module exists because of a real bug. The first version had the bell on
// the LEFT and the beam pulled left too, which looks fine frozen in a
// screenshot: at rest the head is touching the bell. But the head arrives at
// rest travelling *away* from the bell, so it could never actually strike it.
// The fix was to mirror the layout; the point of putting the geometry here is
// that `spec/instrument.test.ts` can now assert the relationship, so a future
// mirror fails a check instead of shipping.
//
// Keep these in step with the SVG in index.html.

/** The bell's suspension point, under the frame. It does not move. */
export const BELL_ORIGIN = { x: 640, y: 92 };

/** Local x of the bell's wall at strike height — its near face. */
export const BELL_EDGE_AT_STRIKE = 68;

/** Local y down the bell where the beam lands: the 鐘腰, its lower third. */
export const STRIKE_LOCAL_Y = 178;

/** The beam's pivot, at size 1. Shifts with the bell; never moves vertically. */
export const PIVOT = { x: 479, y: 92 };

/** Pivot to the top of the log, at size 1. */
export const ROPE_TOP_TO_LOG = 165;

/**
 * The head's *contact face* relative to the pivot, at rest — down and to the
 * right. Measured from the beam's own drawing (pivot at 479, head circle at
 * cx 554 with r 18, so the face is at 572), independently of where the bell is.
 * That independence is what makes the checks in the spec suite mean something.
 */
export const HEAD_AT_REST = { x: 93, y: ROPE_TOP_TO_LOG + 13 };

/** Where the head meets the bell: the bell's near wall, at strike height. */
export function strikePoint(size: number): { x: number; y: number } {
  return {
    x: bellWallX(size),
    y: BELL_ORIGIN.y + STRIKE_LOCAL_Y * size,
  };
}

/** Scene x of the bell's near wall at strike height. */
export function bellWallX(size: number): number {
  return BELL_ORIGIN.x - BELL_EDGE_AT_STRIKE * size;
}

/** A bigger bell pushes the beam further left, and its strike point lower. */
export function beamShift(size: number): number {
  return -BELL_EDGE_AT_STRIKE * (size - 1);
}

export function beamDrop(size: number): number {
  return STRIKE_LOCAL_Y * (size - 1);
}

export function pivotX(size: number): number {
  return PIVOT.x + beamShift(size);
}

/**
 * Which side of the beam's resting head the bell's body lies on: +1 right.
 *
 * Derived from the beam's geometry (`PIVOT` + `HEAD_AT_REST`) against the
 * bell's (`BELL_ORIGIN`), so moving either one alone changes the answer.
 */
export function bellSideOfHead(size: number): number {
  return Math.sign(BELL_ORIGIN.x - headContactX(size, 0));
}

/** Scene x of the head's contact face, at a given size and swing angle. */
export function headContactX(size: number, angle: number): number {
  return pivotX(size) + headOffset(angle).x;
}

/** How far the head is from the bell's wall. Zero at rest: they touch. */
export function headGapToBell(size: number, angle: number): number {
  return Math.abs(bellWallX(size) - headContactX(size, angle));
}

/**
 * Which way the head is travelling at the instant of contact: +1 rightwards.
 *
 * The head traces a circle about the pivot. Writing its position as
 * `p(θ) = (hx·cosθ − hy·sinθ, hx·sinθ + hy·cosθ)`, the tangent at rest is
 * `dp/dθ = (−hy, hx)`. The beam is raised to positive θ and falls back, so it
 * reaches rest with `dθ/dt < 0` and the head's velocity is `(+hy, −hx)` — up,
 * and in the direction of `hy`'s sign.
 */
export function contactDirectionX(): number {
  return Math.sign(HEAD_AT_REST.y);
}

/** The head's offset from the pivot at a given swing angle (SVG y-down). */
export function headOffset(angle: number): { x: number; y: number } {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: HEAD_AT_REST.x * cos - HEAD_AT_REST.y * sin,
    y: HEAD_AT_REST.x * sin + HEAD_AT_REST.y * cos,
  };
}

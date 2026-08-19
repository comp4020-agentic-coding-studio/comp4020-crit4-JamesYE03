// Wiring: the scene in index.html, the physics in src/pendulum.ts, and the
// synthesis in src/audio.ts. This file owns the DOM and nothing else — the
// parts worth testing live in the pure modules.

import { ensureAudio, strikeBell } from "./src/audio";
import { DEFAULT_SIZE, MAX_SIZE, MIN_SIZE, clampSize } from "./src/bell";
import {
  type Beam,
  createBeam,
  normalisedStrike,
  raise,
  release,
  stepBeam,
} from "./src/pendulum";

// Geometry, matching the SVG in index.html. The bell scales about its
// suspension point, so the beam has to follow the bell's edge outwards and
// its strike height downwards as the bell grows.
const BELL_ORIGIN = { x: 300, y: 110 };
const BELL_EDGE_AT_STRIKE = 71; // local x of the bell's wall, at strike height
const STRIKE_LOCAL_Y = 150;
const PIVOT = { x: 446, y: 90 };
const ROPE_TOP_TO_LOG = 158; // rope length at size 1

interface Parts {
  scene: SVGSVGElement;
  bellEl: SVGGElement;
  rigEl: SVGGElement;
  swingEl: SVGGElement;
  beamEl: SVGGElement;
  ropes: SVGLineElement[];
  haloEl: SVGCircleElement;
  ripplesEl: SVGGElement;
  pivotEl: SVGCircleElement;
}

function start({
  scene,
  bellEl,
  rigEl,
  swingEl,
  beamEl,
  ropes,
  haloEl,
  ripplesEl,
  pivotEl,
}: Parts): void {
  let size = DEFAULT_SIZE;
  let beam: Beam = createBeam();
  let held = false;
  let hovering = false;
  let hasPlayed = false;
  let frame = 0;
  let lastFrameTime = 0;

  // ---------- geometry ----------

  const strikePoint = () => ({
    x: BELL_ORIGIN.x + BELL_EDGE_AT_STRIKE * size,
    y: BELL_ORIGIN.y + STRIKE_LOCAL_Y * size,
  });

  function layout(): void {
    const drop = STRIKE_LOCAL_Y * (size - 1);
    const shift = BELL_EDGE_AT_STRIKE * (size - 1);

    bellEl.setAttribute("transform", `translate(${BELL_ORIGIN.x} ${BELL_ORIGIN.y}) scale(${size})`);
    rigEl.setAttribute("transform", `translate(${shift} 0)`);
    beamEl.setAttribute("transform", `translate(0 ${drop})`);
    for (const rope of ropes) {
      rope.setAttribute("y2", String(PIVOT.y + ROPE_TOP_TO_LOG + drop));
    }
    pivotEl.setAttribute("cy", String(PIVOT.y));

    const centre = BELL_ORIGIN.y + 100 * size;
    haloEl.setAttribute("cx", String(BELL_ORIGIN.x));
    haloEl.setAttribute("cy", String(centre));
    haloEl.setAttribute("r", String(150 * size + 70));
  }

  function drawSwing(): void {
    const degrees = (beam.angle * 180) / Math.PI;
    swingEl.setAttribute("transform", `rotate(${degrees} ${PIVOT.x} ${PIVOT.y})`);
    // The held beam warms as it rises, so you can feel the coming strike.
    const charge = normalisedStrike(beam.angle);
    swingEl.style.filter =
      held && charge > 0.02
        ? `drop-shadow(0 0 ${6 + 12 * charge}px rgba(224, 194, 122, ${0.25 + 0.5 * charge}))`
        : "";
  }

  function toScene(event: { clientX: number; clientY: number }): { x: number; y: number } {
    const ctm = scene.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(ctm.inverse());
    return { x: point.x, y: point.y };
  }

  // ---------- the strike ----------

  function ripple(velocity: number): void {
    const { x, y } = strikePoint();
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rings = reduceMotion ? 1 : 3;

    for (let i = 0; i < rings; i += 1) {
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", String(x));
      circle.setAttribute("cy", String(y));
      circle.setAttribute("r", "6");
      ripplesEl.append(circle);

      const spread = (120 + 190 * velocity) * size;
      const animation = circle.animate(
        [
          { r: `${20 * size}px`, opacity: 0.55 + 0.3 * velocity, strokeWidth: "3.5px" },
          { r: `${spread}px`, opacity: 0, strokeWidth: "0.6px" },
        ],
        {
          duration: 900 + 700 * velocity,
          delay: i * 150,
          easing: "cubic-bezier(0.16, 0.8, 0.3, 1)",
          fill: "forwards",
        },
      );
      animation.finished.then(() => circle.remove()).catch(() => circle.remove());
    }
  }

  function onStrike(velocity: number): void {
    hasPlayed = true;
    haloEl.removeAttribute("data-idle");
    strikeBell(size, velocity);
    ripple(velocity);

    bellEl.setAttribute("data-ringing", "true");
    window.setTimeout(() => bellEl.removeAttribute("data-ringing"), 90 + 60 * velocity);

    haloEl.style.opacity = String(0.35 + 0.45 * velocity);
    window.setTimeout(() => {
      haloEl.style.opacity = "";
    }, 140);
  }

  // ---------- the swing loop ----------

  function tick(now: number): void {
    const dt = Math.min(1 / 30, (now - lastFrameTime) / 1000 || 1 / 60);
    lastFrameTime = now;

    const next = stepBeam(beam, dt);
    const landed = next.struck && !beam.struck;
    beam = next;
    drawSwing();

    if (landed) {
      onStrike(beam.strikeVelocity);
      frame = 0;
      return;
    }
    frame = requestAnimationFrame(tick);
  }

  function startSwing(): void {
    if (frame) cancelAnimationFrame(frame);
    lastFrameTime = performance.now();
    frame = requestAnimationFrame(tick);
  }

  // ---------- dragging the beam ----------

  beamEl.addEventListener("pointerdown", (event: PointerEvent) => {
    event.preventDefault();
    ensureAudio();
    if (frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
    held = true;
    beam = createBeam(beam.angle);
    beamEl.setAttribute("data-held", "true");
    beamEl.setPointerCapture(event.pointerId);
    drawSwing();
  });

  beamEl.addEventListener("pointermove", (event: PointerEvent) => {
    if (!held) return;
    event.preventDefault();
    const point = toScene(event);
    const pivotX = PIVOT.x + BELL_EDGE_AT_STRIKE * (size - 1);
    // Angle from straight-down, positive to the left — the direction you pull.
    beam = raise(beam, Math.atan2(-(point.x - pivotX), point.y - PIVOT.y));
    drawSwing();
  });

  function letGo(event: PointerEvent): void {
    if (!held) return;
    held = false;
    beamEl.removeAttribute("data-held");
    if (beamEl.hasPointerCapture(event.pointerId)) beamEl.releasePointerCapture(event.pointerId);
    beam = release(beam);
    drawSwing();
    startSwing();
  }

  beamEl.addEventListener("pointerup", letGo);
  beamEl.addEventListener("pointercancel", letGo);

  // ---------- resizing the bell ----------

  function resize(next: number): void {
    const clamped = clampSize(next);
    if (clamped === size) return;
    size = clamped;
    layout();
    drawSwing();
  }

  scene.addEventListener(
    "wheel",
    (event: WheelEvent) => {
      event.preventDefault();
      ensureAudio();
      // Wheel down grows the bell, which drops its pitch: bigger is lower.
      resize(size * (1 + Math.sign(event.deltaY) * 0.055));
      if (!hovering) flashHalo();
    },
    { passive: false },
  );

  let pinchStart: { distance: number; size: number } | null = null;

  const touchDistance = (touches: TouchList): number => {
    const [a, b] = [touches[0], touches[1]];
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  };

  scene.addEventListener(
    "touchstart",
    (event: TouchEvent) => {
      ensureAudio();
      if (event.touches.length === 2) {
        event.preventDefault();
        pinchStart = { distance: touchDistance(event.touches), size };
      }
    },
    { passive: false },
  );

  scene.addEventListener(
    "touchmove",
    (event: TouchEvent) => {
      if (!pinchStart || event.touches.length !== 2) return;
      event.preventDefault();
      const ratio = touchDistance(event.touches) / pinchStart.distance;
      resize(pinchStart.size * ratio);
      flashHalo();
    },
    { passive: false },
  );

  const endPinch = (event: TouchEvent): void => {
    if (event.touches.length < 2) pinchStart = null;
  };
  scene.addEventListener("touchend", endPinch);
  scene.addEventListener("touchcancel", endPinch);

  // ---------- the invitation ----------

  let haloFlash = 0;
  function flashHalo(): void {
    haloEl.setAttribute("data-lit", "hover");
    window.clearTimeout(haloFlash);
    haloFlash = window.setTimeout(() => {
      if (!hovering) haloEl.removeAttribute("data-lit");
    }, 500);
  }

  bellEl.addEventListener("pointerenter", () => {
    hovering = true;
    haloEl.setAttribute("data-lit", "hover");
  });

  bellEl.addEventListener("pointerleave", () => {
    hovering = false;
    haloEl.removeAttribute("data-lit");
  });

  // Hover cannot invite anyone on a phone, so the bell breathes very faintly
  // until it has been struck once. It stops for good after the first sound.
  const idlePulse = haloEl.animate(
    [{ opacity: 0.06 }, { opacity: 0.26 }, { opacity: 0.06 }],
    { duration: 4200, iterations: Infinity, easing: "ease-in-out" },
  );
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) idlePulse.cancel();

  const stopIdle = window.setInterval(() => {
    if (!hasPlayed) return;
    idlePulse.cancel();
    window.clearInterval(stopIdle);
  }, 400);

  layout();
  drawSwing();
}

const parts: Partial<Parts> = {
  scene: document.querySelector<SVGSVGElement>("[data-scene]") ?? undefined,
  bellEl: document.querySelector<SVGGElement>("[data-bell]") ?? undefined,
  rigEl: document.querySelector<SVGGElement>("[data-rig]") ?? undefined,
  swingEl: document.querySelector<SVGGElement>("[data-swing]") ?? undefined,
  beamEl: document.querySelector<SVGGElement>("[data-beam]") ?? undefined,
  ropes: [...document.querySelectorAll<SVGLineElement>("[data-rope]")],
  haloEl: document.querySelector<SVGCircleElement>("[data-halo]") ?? undefined,
  ripplesEl: document.querySelector<SVGGElement>("[data-ripples]") ?? undefined,
  pivotEl: document.querySelector<SVGCircleElement>("[data-pivot]") ?? undefined,
};

if (
  parts.scene &&
  parts.bellEl &&
  parts.rigEl &&
  parts.swingEl &&
  parts.beamEl &&
  parts.ropes?.length === 2 &&
  parts.haloEl &&
  parts.ripplesEl &&
  parts.pivotEl
) {
  start(parts as Parts);
}

import { readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import {
  MAX_SIZE,
  MIN_SIZE,
  bellFrequency,
  bellPartials,
  clampSize,
  ringSeconds,
  strikeGain,
} from "../src/bell";
import {
  MAX_ANGLE,
  REST_ANGLE,
  createBeam,
  normalisedStrike,
  release,
  stepBeam,
} from "../src/pendulum";

// C4 "An instrument" — https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/crits/04-instrument/
//
// These assert the CONTRACT, not the implementation: what the page must do,
// so they survive a change of approach. The spec lines only a person can judge
// ("does anyone find music in it uninstructed", latency, feel) are left to the
// crit — they are named in CLAUDE.md so I know I'm still on the hook for them.

const DIST = resolve("dist");

function shippedFiles(dir: string = DIST): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? shippedFiles(path) : [path];
  });
}

const shipped = shippedFiles().map((path) =>
  relative(DIST, path).split(sep).join("/"),
);

const pages = shipped
  .filter((name) => name.endsWith(".html"))
  .map((name) => ({
    name,
    doc: new JSDOM(readFileSync(join(DIST, name), "utf8")).window.document,
  }));

const shippedCss = shipped
  .filter((name) => name.endsWith(".css"))
  .map((name) => readFileSync(join(DIST, name), "utf8"))
  .join("\n");

describe("spec: sound is made live in the page, not played back", () => {
  // "the browser is the instrument — sound is made live in the page by the
  // player, not played back". Synthesis only: a shipped audio file would mean
  // playback, however good it sounded.
  const AUDIO_FILE = /\.(mp3|wav|ogg|oga|m4a|aac|flac|opus|weba)$/i;

  it("ships no audio files", () => {
    expect(shipped.filter((name) => AUDIO_FILE.test(name))).toEqual([]);
  });

  it("has no <audio> element on any page", () => {
    for (const { name, doc } of pages) {
      expect(doc.querySelectorAll("audio").length, `${name} plays back audio`).toBe(0);
    }
  });
});

describe("spec: there is no way to play it wrong", () => {
  // "no score, no fail state". Nothing in the interface may score, rank, time,
  // or correct the player.
  const SCORING = /\b(score|points|high ?score|streak|combo|you (win|lose)|game over|incorrect|try again|failed?|mistake)\b/i;

  for (const { name, doc } of pages) {
    it(`${name} shows no score or fail language`, () => {
      const visible = doc.body?.textContent?.replace(/\s+/g, " ").trim() ?? "";
      expect(visible.match(SCORING)?.[0]).toBeUndefined();
    });
  }
});

describe("spec: the opening screen invites the first sound", () => {
  const home = pages.find(({ name }) => name === "index.html");

  it("ships the bell and the beam as the first thing on the page", () => {
    expect(home?.doc.querySelector("[data-bell]")).toBeTruthy();
    expect(home?.doc.querySelector("[data-beam]")).toBeTruthy();
  });

  it("names both for anyone who cannot see them", () => {
    // The scene is the affordance; a screen reader gets the same invitation.
    expect(home?.doc.querySelector("[data-bell]")?.getAttribute("aria-label")).toBeTruthy();
    expect(home?.doc.querySelector("[data-beam]")?.getAttribute("aria-label")).toBeTruthy();
  });
});

describe("spec: playable with whatever is at hand", () => {
  // "mouse, keyboard or touch" — this instrument commits to mouse and touch,
  // so the stage must not let the browser steal the drag for a scroll or the
  // wheel for a page zoom.
  it("takes the gestures away from the browser", () => {
    expect(shippedCss).toMatch(/touch-action\s*:\s*none/);
  });

  it("never shows a native text cursor over the scene", () => {
    expect(shippedCss).toMatch(/user-select\s*:\s*none/);
  });
});

describe("spec: the player's choices shape what they hear", () => {
  // Two expressive axes: bell size (wheel / pinch) and release height (drag).

  it("a bigger bell is lower, across the whole range", () => {
    const sizes = [MIN_SIZE, 0.8, 1.0, 1.4, MAX_SIZE];
    const pitches = sizes.map(bellFrequency);
    for (let i = 1; i < pitches.length; i += 1) {
      expect(pitches[i], `size ${sizes[i]} should be lower than ${sizes[i - 1]}`).toBeLessThan(
        pitches[i - 1],
      );
    }
  });

  it("keeps the bell in a range a person can hear", () => {
    expect(bellFrequency(MAX_SIZE)).toBeGreaterThan(40);
    expect(bellFrequency(MIN_SIZE)).toBeLessThan(1000);
    expect(clampSize(MIN_SIZE - 5)).toBe(MIN_SIZE);
    expect(clampSize(MAX_SIZE + 5)).toBe(MAX_SIZE);
  });

  it("changes the bell's timbre with its size, not only its pitch", () => {
    // If size were a transpose, every partial would keep its relative gain.
    // A big bell has to be darker: its upper partials must fall away faster
    // than its hum does.
    const brightness = (size: number) => {
      const partials = bellPartials(size, 0.7);
      const top = partials.filter((p) => p.ratio >= 2).reduce((sum, p) => sum + p.gain, 0);
      const bottom = partials.filter((p) => p.ratio < 2).reduce((sum, p) => sum + p.gain, 0);
      return top / bottom;
    };
    expect(brightness(MAX_SIZE)).toBeLessThan(brightness(MIN_SIZE));
  });

  it("sounds like a bell, not a plucked string", () => {
    // A bell's partials are inharmonic — not integer multiples of the prime.
    // That inharmonicity is the difference between "bell" and "string", so
    // it is a contract, not an implementation detail.
    const ratios = bellPartials(1, 0.7).map((p) => p.ratio);
    const inharmonic = ratios.filter((r) => Math.abs(r - Math.round(r)) > 0.05);
    expect(inharmonic.length).toBeGreaterThanOrEqual(3);
  });

  it("a harder strike is louder and rings longer", () => {
    expect(strikeGain(0.9)).toBeGreaterThan(strikeGain(0.2));
    expect(ringSeconds(1, 0.9)).toBeGreaterThan(ringSeconds(1, 0.2));
  });

  it("a bigger bell rings longer than a small one struck the same way", () => {
    expect(ringSeconds(MAX_SIZE, 0.6)).toBeGreaterThan(ringSeconds(MIN_SIZE, 0.6));
  });

  it("two players sound different", () => {
    // Same instrument, two sets of choices, two different sounds.
    const describeVoice = (size: number, velocity: number) =>
      bellPartials(size, velocity)
        .map((p) => `${(p.ratio * bellFrequency(size)).toFixed(1)}@${p.gain.toFixed(3)}`)
        .join(" ");
    expect(describeVoice(0.7, 0.2)).not.toBe(describeVoice(1.6, 0.9));
  });
});

describe("spec: the beam swings, falls, and strikes once", () => {
  // Raise the beam about its pivot, let go, and gravity brings it back down
  // through its rest position into the bell. It strikes once and settles.

  it("the higher it is raised, the harder it lands", () => {
    const heights = [0.2, 0.5, 0.9, 1.2, MAX_ANGLE];
    const strikes = heights.map(normalisedStrike);
    for (let i = 1; i < strikes.length; i += 1) {
      expect(strikes[i]).toBeGreaterThan(strikes[i - 1]);
    }
    expect(normalisedStrike(REST_ANGLE)).toBeCloseTo(0, 5);
    expect(normalisedStrike(MAX_ANGLE)).toBeCloseTo(1, 5);
  });

  it("cannot be raised past its ropes", () => {
    expect(createBeam(MAX_ANGLE + 2).angle).toBe(MAX_ANGLE);
    expect(createBeam(-1).angle).toBe(REST_ANGLE);
  });

  it("falls back to rest and strikes exactly once", () => {
    let beam = release(createBeam(1.0));
    let strikes = 0;
    for (let i = 0; i < 2000; i += 1) {
      const stepped = stepBeam(beam, 1 / 120);
      if (stepped.struck && !beam.struck) strikes += 1;
      beam = stepped;
    }
    expect(strikes, "one release, one strike — no rebound").toBe(1);
    expect(beam.angle).toBeCloseTo(REST_ANGLE, 5);
    expect(beam.angularVelocity).toBeCloseTo(0, 5);
  });

  it("does nothing at all until it is released", () => {
    let beam = createBeam(1.0);
    for (let i = 0; i < 200; i += 1) beam = stepBeam(beam, 1 / 120);
    expect(beam.angle).toBeCloseTo(1.0, 5);
    expect(beam.struck).toBe(false);
  });

  it("carries the release height through to the strike", () => {
    const landed = (angle: number) => {
      let beam = release(createBeam(angle));
      while (!beam.struck) beam = stepBeam(beam, 1 / 240);
      return beam.strikeVelocity;
    };
    expect(landed(1.2)).toBeGreaterThan(landed(0.4));
    expect(landed(0.4)).toBeGreaterThan(0);
  });
});

describe("spec: the repo shows the process", () => {
  it("has this deliverable's reflection", () => {
    const reflections = readdirSync(resolve("reflections"));
    expect(reflections).toContain("crit-4.md");
  });
});

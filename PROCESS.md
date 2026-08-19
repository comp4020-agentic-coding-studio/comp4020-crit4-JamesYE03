# Process overview

## What I built

**鐘 Temple Bell** — a bronze temple bell you strike in the browser. A wooden
beam hangs by two ropes from a single pivot beside the bell; drag it up its arc
and let go, and gravity swings it back down through rest into the bell. How high
you raised it sets how hard it lands, which sets both loudness and how long the
bell rings. The mouse wheel or a two-finger pinch resizes the bell, and a bigger
bell is lower *and* darker — size changes the spectrum, not just the pitch.
Every sound is synthesised at strike time with Web Audio; nothing audible ships
as a file, and a spec test enforces that.

## The moments that mattered

### 1. The harness front-loaded the decisions, and pruned itself on the way in

A1 ended with a rule in `CLAUDE.md` saying every new week opens with a batch of
5–15 questions before a line of code — because earlier weeks had trickled
decisions out over many small exchanges. Carrying that forward this week
produced twelve questions answered in one message: the instrument concept, the
beam's physics, the timbre, the scope, the visual direction. Code started after
that, not before.

Carrying the harness forward also meant deciding what to *drop*. A1's file
carried a long `linkinator` recipe that only makes sense with Astro's explicit
`base`, and a lint sensor that A1's `check` ran and this template's does not.
Both were now actively wrong. I kept the principle underneath the first one — the
deployed site lives at a subpath, so test routes against a server that mounts it
there — and replaced the Astro-specific commands with this week's Vite reality,
and noted plainly that there is no lint step here so nothing cites one.

[`e75a74d`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-JamesYE03/commit/e75a74d)

### 2. The spec became tests before the instrument existed

Nine of C4's spec lines are mechanically checkable, so they went in as contract
tests first, red, with no prototype behind them. The interesting part was where
to put the assertions: the physics and the synthesis maths went into
`src/pendulum.ts` and `src/bell.ts` as pure functions over numbers — no DOM, no
`AudioContext` — so the tests could assert *what the instrument must do* ("a
bigger bell is lower across the whole range", "one release, one strike, no
rebound", "a harder strike rings longer") rather than how it was wired. Fifteen
of them passed the moment those two modules were written, which caught the maths
before any of it was audible; the rest stayed red until there was a page.

Red-to-green:
[`99af7e4...5241d25`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-JamesYE03/compare/99af7e4...5241d25)

### 3. I asked for the wrong algorithm and the correction went into the harness

I specified Karplus-Strong for the bell. The pushback was that K-S is a
plucked-string algorithm: its delay line produces a *harmonic* comb, partials at
integer multiples of one fundamental, and a bell's character is precisely its
**inharmonicity** — the hum a fifth below, the minor-third tierce, the quint,
the nominal, each decaying at its own rate. That is the whole difference between
"bell" and "string". I took the correction and the synthesis became additive over
those named partials instead.

What matters is where the correction landed. Not in a retry: it went into
`CLAUDE.md` as a stated fact about the stack, *and* into the spec suite as a test
that asserts at least three partials are non-integer multiples of the prime. A
future change that quietly harmonises the spectrum now fails a check instead of
just sounding wrong.

[`e75a74d`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-JamesYE03/commit/e75a74d)
· [`99af7e4`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-JamesYE03/commit/99af7e4)

<!-- TODO (James): job 3 for this moment — "how I knew it was right" — is the one
     thing no test here can carry, because it is my ears. Add a sentence in your
     own words after you have listened: what the additive version gave you that
     you would not have got from K-S. That sentence is the evidence. -->

## Where the checks stop

`pnpm check` (typecheck, build, 37 tests) holds the contracts. It cannot tell me
whether the bell sounds like a bell, whether the beam feels weighty, or whether a
stranger finds music in it uninstructed — and those are exactly what the pod
judges on a cold open. Those spec lines are named in `CLAUDE.md` so I know they
are mine, not the suite's.

<!-- DRAFT from this week's session record. Every claim is checkable against the
     cited commits; the judgements are in my voice as a starting point. Read it,
     make it mine, delete this comment. Two moments, ~270 words, per the course's
     stated range for a crit week. -->

# Process overview

## What I built

**鐘 Temple Bell** — a bronze temple bell struck in the browser. A beam hangs from
a pivot to its left; drag it away, let go, and gravity swings it back in. Release
height sets loudness and ring length; the wheel or a pinch resizes the bell, and a
bigger bell is lower *and* darker. Synthesised live over a cast bell's inharmonic
partials — nothing audible ships as a file.

## Two moments

### A bug thirty-seven green tests could not see

The bell sat on the same side the beam is pulled towards. At rest the head touches
it, so it looks right — but the beam returns travelling rightwards, moving *away*
from the bell at contact. It could never have struck.

Mirroring it is the fix. Instead I moved the geometry into `src/scene.ts` and
asserted the relationship. My first assertion was worthless: it derived the contact
point from the bell's own origin and compared it back — true by construction, still
green with the bug reinstated. Rewriting it from the beam's own pivot, then
mutation-testing — bell back on the wrong side, three assertions red — is the only
reason I trust it. That rule is now in `CLAUDE.md`.

[`8dc2ef7`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-JamesYE03/commit/8dc2ef7)

### One correction a check could hold, one it couldn't

I specified Karplus-Strong — a plucked-string algorithm, harmonic, where a bell's
character is its inharmonicity. That correction went into the harness, not a retry:
a fact stated in `CLAUDE.md`, plus a test that at least three partials are
non-integer multiples of the prime.

The muddiness it still had, no test could name. Listening found it: the spectrum
stopped at 4.166× the prime, so nothing above ~625 Hz read as metal, and every
partial peaked in phase at t=0 and clipped.

[`99af7e4...8dc2ef7`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-JamesYE03/compare/99af7e4...8dc2ef7)

## Where the checks stop

41 tests hold the contracts. None can hear whether it sounds like bronze, or
whether a stranger finds music in it uninstructed — what the pod judges on a cold
open. Those lines are named in `CLAUDE.md`.

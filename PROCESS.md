# Process overview

## What I built

**鐘 Temple Bell** — a bronze temple bell you strike in the browser. A beam hangs
from a pivot beside it. Drag the beam away, let go, and gravity swings it back into
the bell. How high you lifted it sets how loud it is and how long it rings. The
wheel or a pinch resizes the bell: bigger is lower and darker. All the sound is
made in the page with Web Audio, and no audio file ships.

## Two moments

### Asking everything first

In earlier weeks I gave the agent decisions a few at a time, and we burned a lot of
turns on it. After A1 I put a rule in `CLAUDE.md`: every week starts with one batch
of questions, before any code. This week that was twelve questions in one message —
the instrument, how the beam moves, the timbre, how far to take the visuals.

It was the right call. The agent built the whole first version from those answers in
one pass, and the physics I described went straight into `src/pendulum.ts`. What came
back still needed work, but not because I had left a decision open.

[`e75a74d`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-JamesYE03/commit/e75a74d)

### The sound was wrong and no test could say so

The first bell was muddy and too short. Forty-one tests were green.

The easy fix was more reverb and a longer decay. Instead I asked what was missing.
There were two real causes. The partials stopped at 4.166 times the prime, so
nothing above about 625 Hz read as metal. And every partial rose from silence at the
same moment, so their peaks lined up and clipped, which sounds like mud, not volume.

I knew the fix had worked because I listened. The strike sounds like metal now.
Before, it sounded like plastic.

[`8dc2ef7`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit4-JamesYE03/commit/8dc2ef7)

## Where the checks stop

41 tests hold the contracts. None can hear whether the bell sounds like bronze, or
whether a stranger finds music in it. That is what the pod judges.

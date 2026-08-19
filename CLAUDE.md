# COMP4020 prototype

This is my starter repo for a COMP4020 prototype: a static site written in
HTML/CSS/TypeScript that builds to plain HTML/CSS/JS and deploys to GitHub
Pages. The **deployed site is what gets marked** --- not this repo, and not "it
works on my machine". Assume it is opened live in Chrome at both desktop
(1920×1080) and phone (390×844), and that both count in full.

What I'm building this week --- the spec --- is published on the course website,
and this repo's name tells you which deliverable it is. Run the course plugin's
**start** skill at the start of each week: it pulls the right spec from the
course API, carries this harness forward from last week, and helps turn the
spec's checkable lines into tests of my own. Read the spec before you build, and
see `spec/README.md` for how the checks in this repo relate to it.

## This week: C4 "An instrument"

A **temple bell** you strike in the browser. The whole thing is a single scene:
a hanging bronze bell and a horizontal beam (撞木) suspended from a pivot above
it by two ropes.

- **Strike.** Drag the beam left; it swings up along a circular arc about the
  pivot. Release and gravity swings it back down through its rest position,
  where it hits the bell. The higher it was raised, the louder the strike and
  the longer the ring. It strikes **once** and settles --- no rebound, no
  repeated hits.
- **Tune.** The mouse wheel (desktop) or a two-finger pinch (touch) resizes the
  bell. A bigger bell is lower and darker; a smaller bell is higher and
  brighter. Size changes pitch **and** timbre, not just pitch.
- **Two expressive axes**, therefore: bell size and release height, plus
  whatever rhythm the player strikes in. Two people sound different.

Non-negotiables from the published spec, in the terms that bite here:

- **Sound is synthesised live in the page.** No `<audio>` element, no `.mp3`,
  `.wav`, `.ogg` or `.m4a` anywhere in `dist/`. Web Audio only. Playing back a
  recording fails the spec outright, however good it sounds.
- **No way to play it wrong.** No score, no timer, no fail state, no "correct"
  sequence. Nothing in the UI may score, rank, or correct the player.
- **A stranger can play it uninstructed.** There is one small hint line at the
  top of the page, but the scene itself has to invite the first strike: the bell
  glows softly on hover, and the beam reads as grabbable. The hint is a safety
  net, not the affordance.
- **Mouse first, touch properly.** The tutor may well open it on a phone. Keyboard
  is explicitly out of scope this week.

## How to work in here

- Keep the dev server running (`pnpm dev`) so you see changes as you make them.
- Before you push, run `pnpm check`. It runs typecheck, build, and the whole
  vitest suite --- the same three CI runs in its `check` job --- so you catch
  those in seconds instead of waiting for the pipeline. Evidence, secrets, links
  and the deploy only run in CI.
- **I do the visual and audio pass myself.** Don't stand up Playwright,
  `agent-browser`, screenshot tooling, or headless-browser workarounds to verify
  how something looks or sounds. `pnpm check` green is the bar you hand back on;
  I'll open it and listen. This is doubly true this week --- no automated check
  can tell you whether a bell sounds like a bell.
- When a check fails, read its output before changing anything. Each check names
  what it measures, and the failure message is the instruction: it tells you the
  file, the line, or the contract. Treat a red check as authoritative --- the
  page is wrong until the check is green, not until you decide it should be.
- Commit when the checks pass. Never commit a red state.

## The link-preview card

`public/card.png` (1200x630) is the image a shared link shows; `index.html`'s
head points at it. Replace it and the `description` meta, and copy the head
block into any new page. The card URL resolves against the page that names it,
like any link --- `./card.png` is wrong one directory down, and nothing in CI
checks it, so look at the deployed head when you add pages.

## The checks (my sensors)

CI runs these on every push once the repo is public. GitHub's checks UI shows
two jobs, `check` and `deploy`, and within `check` the steps run in sequence
(`pnpm check` chains typecheck, build and vitest with `&&`), so an early failure
like a broken build stops the later sensors for that push; fix it and push again
to see the rest. While the repo is private (all week, until I ship) the CI jobs
stay skipped --- `pnpm check` is the same roster locally, and it's the faster
loop anyway.

They also carry a mark at a crit: the sweep runs fifteen minutes after the
cutoff, and green checks there are worth half that week's shipped mark. Still
running counts as not green, so ship with time for CI to finish.

- **typecheck** --- `tsc --noEmit` runs first, so a type error stops the roster
  before the build starts. A red here is the compiler telling you a claim in the
  code is false.
- **build** --- the site must build (`pnpm build`). A build failure means the
  deployed site is broken or stale, so nothing else matters until this is green.
- **spec** --- `spec/invariants.test.ts` asserts what's true of any good website,
  whatever the brief asks; my own tests for the week's spec run alongside it (any
  `spec/*.test.ts`). A failure names the contract not met yet.
- **tests** --- any other tests, wherever they live (co-located with source is
  fine). Vitest picks up both suites in one `vitest run`.
- **deploy / online** --- the live GitHub Pages URL must load and return the page
  expected. An asset that 404s deployed counts as broken even if it loads locally.
- **evidence** (`pnpm check:evidence`) --- `PROCESS.md`'s citations resolve to
  real commits, this deliverable's exact reflection is in `reflections/` (worked
  out from this repo's name against the public course API --- this week that is
  `reflections/crit-4.md`), and `CLAUDE.md` is present. Evidence gates the
  deploy, so failing it blocks the deploy alongside everything else.
- **links** --- internal links must resolve. A broken link is a dead end I didn't
  mean to ship.
- **secrets** --- the repo is scanned for committed credentials. Never put a key,
  token, or password in a tracked file. A local pre-commit hook
  (`.githooks/pre-commit`, installed by `pnpm install`) also blocks any commit
  containing something shaped like an API key --- by the time CI sees a key it is
  already pushed, so the hook is the sensor that matters.

**This template ships no lint sensor.** Unlike the Astro setup I used for A1,
`pnpm check` here is `typecheck && build && vitest run` --- there is no
stylelint or oxlint step. Don't cite a lint check that doesn't exist, and don't
add one mid-week just to have it.

Nothing here measures **accessibility** or **performance** --- wiring those
sensors is my work, and later in the course the spec will ask me to show how I
tested both. When I do, read a green performance result honestly: it's a lab
estimate from one run on a CI machine, not proof the site is fast for real users.

## Facts about this stack that are easy to get wrong

### The deployed path is a subpath, not the root

GitHub Pages project sites serve everything under `/<repo-name>/`, not at the
domain root. This template's `vite.config.ts` sets `base: "./"` so built asset
URLs come out **relative** and this mostly takes care of itself --- which is
exactly why it's easy to reintroduce by hand. Any absolute path I write myself
(`/styles.css`, a hardcoded `fetch("/data.json")`, a hand-rolled redirect) looks
correct locally and 404s on the live URL.

The general lesson, learned the hard way in A1 and worth keeping: when something
depends on "where does this route actually live", test it against a server that
mounts the site at that subpath, not against raw disk paths --- and after fixing
this pattern in one place, grep for the same naive assumption in the other
surfaces that run similar checks (CI YAML, npm scripts, docs), instead of
assuming a fix documented in one place means every surface agrees.

### Web Audio

- **The context starts suspended.** Browsers will not produce sound until a real
  user gesture. `AudioContext.resume()` has to be called from inside a
  `pointerdown`/`touchstart` handler, not on load, not in a `setTimeout`. Build
  the context lazily on the first gesture and reuse it.
- **Schedule against `ctx.currentTime`, never `setTimeout`.** Audio runs on its
  own clock. Anything scheduled off the main thread's timers will drift and
  jitter audibly.
- **`exponentialRampToValueAtTime` cannot target 0.** Ramp to a small epsilon
  (e.g. `1e-4`) and then `stop()`. Targeting zero throws.
- **Stop and let nodes go.** Every strike builds a fresh oscillator bank. Give
  each node a `stop(when)` so it is collected; overlapping rings are fine (they
  are the point) but leaked nodes are not.
- **A bell is inharmonic.** Its partials are not integer multiples of a
  fundamental --- that inharmonicity is the whole difference between "bell" and
  "plucked string". See `src/bell.ts` for the ratios and why each is there.

### Pointer and touch

- **`touch-action: none`** on the interactive stage, or the browser hijacks the
  drag to scroll the page and the beam never moves on a phone.
- **`preventDefault()` on `wheel`** with a non-passive listener, or the page
  zooms instead of the bell. Same for the two-finger pinch.
- **Use Pointer Events, not separate mouse/touch paths.** One `pointerdown` /
  `pointermove` / `pointerup` path covers mouse and single-finger touch; only the
  two-finger pinch needs its own `touchmove` handling.

## My process is part of the mark

The deployed page is only half of it. How I got there is marked too: commit
history, agent files, and the decisions visible across them. The checks above
can't see any of that, so a person reads it directly --- which means building
legibly is part of building well.

- **Commit as you go.** Small, frequent commits are the record of how the work
  came together, and that record is read, not just the final state. A trail that
  grew alongside the code is the strongest evidence of process; a single dump the
  night before is the weakest.
- **Keep a process overview** (`PROCESS.md`). A short reading-guide, not an
  essay: what I built, the moments that mattered --- each pointing at a commit, a
  `CLAUDE.md` change, or a prompt and the commit it produced --- and where to
  look in the history. It points a marker at the evidence; it doesn't stand in
  for it, and claims the history doesn't back don't count. `pnpm check:evidence`
  verifies citations resolve to real commits before I ship. Markers follow those
  citations and don't trawl the repo for evidence I didn't cite.
- **Write the reflection in `reflections/`** --- named for the deliverable it
  answers, so the number in the filename is the number in this repo's name. This
  week: `reflections/crit-4.md`. `pnpm check:evidence` checks the exact current
  name against the course API, not merely the presence of any well-named file. It
  answers the two standing prompts: the breakthrough that moved the work forward,
  and what this work changed about the developer I want to be. It stays out of
  the deployed site. It's due at the cutoff, and if it isn't in the repo by then
  the week doesn't count as shipped, however good the prototype is.
- **This file is process evidence.** The harness I build to direct the agent ---
  this `CLAUDE.md` and any `AGENTS.md` --- is itself read as part of how I
  worked. Keep it honest and current.

I don't need a name, a student number, or any identity file in the repo: the
course knows whose repo it is. Spend the effort on the work.

## Conventions I hold the agent to

These are rules I've decided the agent should follow on every task in this repo,
not just the one that surfaced them.

- **Never fabricate anything that reads as real.** Data, links, personal
  anecdotes in `PROCESS.md`, `reflections/`, or page copy --- if the real value
  isn't available, say so and ask, or leave an explicit placeholder. Don't invent
  something plausible-looking instead.
- **Ask before assuming.** When a requirement is ambiguous or information is
  missing, ask a clarifying question before writing code, not after producing
  something wrong. The question belongs before the first line of code, not as a
  post-mortem.
- **Keep it simple by default.** Prefer the simplest implementation that
  satisfies the requirement; avoid speculative abstraction, extra configuration,
  or generality the task didn't ask for. The first version of the code should
  already be simple --- don't wait to be asked to simplify it.
- **Don't touch what you don't understand.** Never remove or change code or
  comments you don't fully understand, even if they look unrelated to the current
  task. A commit should contain only what it set out to do --- no unrelated
  "drive-by" cleanup mixed in.
- **Define done before starting.** For a multi-step task, state a clear,
  checkable completion criterion for each step before starting it. A diff should
  only contain the changes that were actually asked for.
- **Keep the physics and the synthesis pure and separate from the DOM.** The
  pendulum simulation and the bell's partial/envelope maths live in their own
  modules as plain functions over numbers, with no `AudioContext` and no
  `document`. That's what makes them testable in jsdom, and it's what lets the
  spec tests assert the **contract** ("a bigger bell is lower", "a harder strike
  rings longer") rather than the implementation.

## How to start each week's work

This is the three-message shape I want every new week's work to follow, so
neither of us burns turns re-deriving it:

1. **Understand and ask.** Clone the week's repo, read the spec from the course
   site yourself, and summarise it. Then ask a batch of roughly 5--15 questions
   covering the open decisions you can't resolve by reading the code or the spec
   --- not implementation details you can figure out on your own. Prefer open
   questions with a couple of example answers spelled out in the question itself
   over forced multiple choice, since most real answers (a reference site, a real
   data source, a scope call) aren't naturally A/B.
2. **Restate and confirm.** Once I answer, restate the full understanding and the
   plan before writing any code. Don't start until I give an explicit go-ahead;
   keep asking if the answer is "not quite."
3. **Execute, verify, hand back.** Commit at each meaningful checkpoint (sized to
   the work, not padded to a count) and push to the private `main` branch after
   each one --- CI's push-only checks should catch problems while there's still
   time to fix them, not the night of the crit. Never flip the repo public or run
   `ship` unless asked to separately. Treat `pnpm check` as the completion bar,
   don't stand up browser/screenshot tooling to self-verify UI, make the smallest
   diff that satisfies the request, and hand back a plain description of what
   changed without stacking extra confirmation prompts for routine changes.

## This file is mine

This CLAUDE.md is a starting point, not a fixed rulebook. As I learn what the
prototype needs --- a convention to hold the agent to, a sensor that keeps
catching me out, a fact about the stack the agent keeps getting wrong --- I write
it down here. Growing this file is the work of harness engineering, and the gap
between the boilerplate and my own version is part of what the prototype says
about the developer I'm becoming.

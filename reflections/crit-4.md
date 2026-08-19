<!-- DRAFT from this week's session record. Everything factual here happened and is
     checkable against the commits; the judgements are in my voice as a starting
     point. Read every sentence and make it mine, or replace it. ~270 words, per the
     course's stated range. Delete this comment before the cutoff. -->

# C4 — An instrument

## What was the breakthrough that moved the work forward?

Describing the mechanism instead of the effect.

I didn't ask for a beam that "feels weighty." I said: it hangs horizontally from a
pivot above, tied at both ends by two ropes; drag it left and it rides a circular
arc about that pivot; let go and gravity brings it back down; the higher you raised
it, the louder it lands. Directly implementable — it became a pendulum equation in
about twenty lines.

What I didn't expect is that the same description let me *catch* the bug. The first
build had the bell on the wrong side. At rest the head was touching it, it sounded
fine, thirty-seven tests were green. I saw it only because I had a physical model
in my head and could ask which way the head was moving when it landed — away from
the bell, so it could never have struck it.

A description precise enough to build from is precise enough to audit.

## What did this work change about who I want to be as a software developer?

I stopped reading green as correct.

The mirrored geometry passed thirty-seven tests. The muddy bell passed forty-one.
And the check I added so the geometry bug could never recur was itself vacuous — it
compared the bell's position against itself, and stayed green with the bug put
straight back in. A test that cannot fail is worse than none: it reports confidence
it never earned.

So the habit I want is procedural, not attitudinal. Break it on purpose, watch it
go red, put it back. Thirty seconds, and it is the only reason I believe those
assertions now.

The other half matters as much. The bell got clearer because I listened and said
so, not because anything went red. Naming which parts of a spec my sensors cannot
reach is engineering, not an admission I ran out of time to automate.

<!-- One job left for you: a concrete sentence on what the additive version actually
     sounded like next to the muddy one. That is the evidence for the paragraph
     above, and only your ears can supply it. -->

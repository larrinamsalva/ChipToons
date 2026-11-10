# PR #78 — Real Cinematic Pull-Back Reveal

Imported original PNG storyboards can preview an opt-in pull-back camera
from 1.45x close framing to 1x full-frame view over a scene. Find
"Try a cinematic pull-back reveal" in Guided Voice Recording or
"Try pull-back reveal for scene N" in Caption & Voice Timing Review.

The existing Direct My Cartoon Camera editor opens with the candidate
camera shot. Inspect actual motion with Preview Shot / Preview Full
Sequence, then explicitly Apply or Cancel. Original PNGs, captions,
voice clips and project files are never touched merely by previewing.

An optional, strictly validated starting camera value is added only
to new move shots that begin at scene time 0 and track no subject.
Previously authored camera shots continue using their original
interpolation without a migration or change in visual behavior.

This is a moving camera over 2D PNG frames, not reconstructed 3D.
Both Stage playback and genuine WebM export use the same existing
camera evaluator, with no new renderer or fake in-between frames.
Any existing authored camera work blocks the shortcut. A user change
to a different shot style, offset start, zero-duration movement or a
tracked subject clears the starting camera to avoid hidden invalid
motion. Full 20-minute media export tests and desktop/phone/tablet
browser checks must pass before a human-controlled merge.


## PR #79 — Adjustable reveal starting view

In the real Camera Director, you can now choose which side of the original art to focus on and adjust the opening zoom of an existing or proposed pull-back. Both require preview and explicit Apply. See [Reveal Framing](FRAMEFIELD_REVEAL_FRAMING.md).

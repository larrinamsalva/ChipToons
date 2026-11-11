# PR #88 — Diagonal Glide Pacing & Final-Frame Hold

## Why
Not every story beat needs the camera to keep moving until the last
frame. A camera can move early and hold on a child's reaction,
an important repair tool, or an instruction while narration finishes.

## Creator workflow
For an original numbered-PNG scene with no existing camera work,
open **Try a gentle diagonal cinematic glide** from Finish My Cartoon
or Caption & Voice Timing Review. In **Direct My Cartoon Camera**,
choose four-way direction and Subtle/Balanced/Expressive strength.

The new **Diagonal glide pacing** control provides:
- **Travel throughout the scene:** move for 100% of scene duration
- **Finish at 75%, then hold:** move for 75% and hold the last view
- **Finish halfway, then hold:** move for 50% and hold the last view

Pacing is implemented only by the standard CameraShot.move duration.
The scene itself never gets shortened and no alternate camera track,
animation engine or special renderer is introduced. You can still
adjust the existing **Move duration (seconds)** field manually,
which shows up as a custom duration in the pacing selector.

Preview Shot / Preview Full Sequence uses the actual Stage playback,
scene-time captions, 21-checkpoint canvas boundary scan, live
zoom meter and contact sheet. Explicitly **Apply** only after
review; Cancel discards the proposal.

## Preservation & tests
The same normal CameraShot is used by the genuine WebM encoder and
full scene audio mixer. No source PNGs, sound, captions, project
data schema, authored shots or other scenes are modified by choosing
a pacing preset. Direction and intensity stay the same when pacing
is changed, and vice versa.

Unit tests check exact pacing times, real Stage camera values at
mid-move, finish and final scene time, hold behavior, canvas bounds,
invalid presets, custom manually tuned durations, and unchanged
assets. Desktop/phone/tablet browser checks choose an Expressive
down-right glide finishing at 75%, preview it and explicitly Apply.

Merge only once Foundation QA and the full 20-minute narrated
episode/genuine WebM media proof pass on the latest PR commit.

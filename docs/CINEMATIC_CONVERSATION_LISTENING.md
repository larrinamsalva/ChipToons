# PR #100 — Recorded-Conversation Listening

## Milestone
Make actual **two-character Little Fixers Club conversations** read as a
shared scene. A quiet character listens to the other performer when
the speaker's original, approved recording is *actually speaking*.
This is the same opt-in Cinematic Storybook Stage rendering pipeline.

## Real implementation
- The listening cue reads only **valid existing saved voice-to-mouth**
  data attached to real audio clips. It applies the same source,
  trim, correction, mute and manual-precedence rules as the mouth.
- Five nearby mouth-envelope samples (current, +/-0.12s and +/-0.24s)
  ease attention through short spoken pauses rather than snapping the
  eyes around with each individual syllable.
- An eligible listener glances toward the **actual rendered partner's
  current position**, and gives a subtle head response (<=1.35 deg).
- With overlapping recorded speakers, choose the strongest valid
  audible speaker deterministically. If no valid audible source is
  present, preserve the existing cinematic ambient gaze behavior.
- Authoring remains entirely in the original animation and recording;
  no AI speech detection, generated conversation, lip-sync rewrite,
  inserted keyframes or new storage schema.

## Creator priorities
- **Classic mode and calm editing** are visually unchanged.
- Speakers do not automatically turn to watch themselves, and
  invisible, out-of-range, or unrelated props are never chosen.
- Manually animated head poses and gestures, handoffs, pickup/release/
  point interactions, painted heads/eyes, and unrigged characters
  retain their original behavior.
- Original audio clips, voice-to-mouth tracks, captions, scene
  positions, prop contacts, downloads and existing WebM encoding
  are unchanged. Same sampled-time frame serves Stage and exports.

Tests cover original full-body Scout & Helper Jo performers,
recorded speaker selection, visual gaze and tiny listening head
changes, side switching, silence/mute/stale/edited recordings,
manual poses/interactions, Classic/calm/painted opt-outs, and
deterministic rendering and no saved project mutation. Manual merge
only after Foundation/browser and genuine 20-minute episode/export
verification both pass on the newest PR commit.

This is a *2D vector puppet conversation acting improvement*, not
a full 3D face rig or automatic audio-to-animation synthesizer.

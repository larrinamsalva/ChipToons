# PR #99 — Recorded Voice-Paced Head Acting

## Creative goal
Give Little Fixers Club's ORIGINAL rigged cartoon speakers a quiet
on-camera response to their own approved recorded voices instead of
looking like their mouths move independently of their bodies.

## Real implementation
- Uses the EXISTING saved voice-to-mouth track generated from actual
  recorded audio, including creator-approved trims, corrections, mute
  state, manual-mouth precedence and saved audio clip references.
- In **Cinematic Storybook** only, active spoken mouth movements
  produce a subtle head-joint response (at most 1.05 degrees) that
  follows a smoothed envelope of nearby voice samples.
- Only the current deterministic Stage frame gets a temporary
  secondary head offset. Real playback and existing verified WebM
  exports use that same frame, scene time and original audio clips.
- It does not read audio in real time, infer emotion or words,
  generate voices, guess phonemes, save head keyframes or add new
  animation tracks.

## Authoring and preservation
- The original mouth opening, voice playback, emotion, scene timing,
  audio clips, captions, prop handoffs and authored joint coordinates
  stay unchanged.
- An actor in any scripted scene interaction, or with an authored
  head pose, keeps their own choreographed acting without overlays.
- Classic mode, calm authoring previews, muted/invalid/stale or
  absent voice tracks, raster head art and non-rigged characters
  have no new motion.
- The animation responds only to CURRENT approved voice-mouth
  tracks; there is no move for ordinary narration without such a
  track, no fake speech, and no new data collection or network calls.

Tests cover actual voice source references and start offsets,
audio-driven speaking/silence/mute changes, original manual gestures,
scene interactions, opt-outs, deterministic frames and unchanged
original project JSON. Manual merge only after latest Foundation
and genuine twenty-minute export CI gates are green.

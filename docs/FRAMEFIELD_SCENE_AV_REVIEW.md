# PR #74 — Jump Straight to Actual Scene Picture & Mixed Audio

## Why this matters

The prior guided recording steps let creators preview a **saved, untrimmed
original**. That is not the same as hearing the final timeline with
correct scene start times, clip trims, captions, voice and music buses.

The new **Open this scene with picture and mixed sound** control returns
from Finish My Cartoon to the *existing ScenePlayer*, positioned at the
precisely selected imported PNG shot.

## What happens

- Select a scene in Guided Voice Recording, or choose **Preview scene N
  with mixed sound** in Caption & Voice Timing Review.
- The editor opens its actual animation preview on the selected scene.
- Preview scope is set to **Selected scene**, Sound is enabled, and
  the playhead seeks to the beginning of the chosen scene.
- Press **Play cartoon** to preview *the existing* moving PNG frames,
  captions and genuine audio engine with current mix, trims, fades and
  mute settings. The player still allows pause, captions on/off,
  scene navigation, sound toggle and switching to entire-episode mode.
- Nothing autoplays or asks for microphone permission. No audio render
  is fabricated, and an empty/muted mix remains silent.

## Preservation and verification

Only imported PNG scenes get the new review shortcuts. The normal
project preview and editor are reused; no playback engine, schema,
storage, media, captions, recordings, animation or export is changed.

Desktop/phone/tablet browser QA checks imported real PNG scenes, saved
voice source playback, selecting the actual ScenePlayer, sound-enabled
scene scope and explicit playback. Foundation and the independent
complete 20-minute narrated video/audio export must both be green on
the exact PR commit. Never merge or publish automatically.

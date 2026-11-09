# PR #72 — Saved Voice Source Listen-Back

Use the existing guided recording area in Finish My Cartoon for an imported
PNG storyboard. When a narration or dialogue clip overlaps the selected
scene, the panel offers that source to inspect. Choose a saved audio
source and press Play on the native audio player.

The player uses the existing OriginalAudio component, including the local
audio vault for complete-episode file-backed originals, and it releases
temporary object URLs when the component unmounts or the source changes.

## Critical distinction

This plays the *untrimmed original source*, not its exact edited placement
in the current scene. The panel displays assignment times and trim
metadata and warns when the clip is muted or has zero voice/clip/master
volume. The current soundtrack, fades and subtitle synchronization
must be verified using Preview complete cartoon.

A source on a narration/dialogue track is not proof of speech or that
the saved audio matches the written captions. Music and effects tracks
do not appear in this inventory. Missing file-backed originals remain
subject to the existing source player error feedback.

## Verification and preservation

Pure tests check current shot order, actual clip intervals, cross-scene
overlap, voice-only selection, zero-volume/muted warnings, unchanged
project state and opt-in import scope. Browser QA imports a real two-shot
cartoon, assigns a WAV audio original, and plays the source from the
guided panel on desktop/phone/tablet browsers.

No new microphone recorder, network services, speech generation,
approval flags, persistent project fields, storage changes, altered
exporter or publishing actions. No project changes occur when listening.
The complete 20-minute narrated WebM/audio export proof and Foundation
QA must pass on the latest PR SHA before a human manually merges it.

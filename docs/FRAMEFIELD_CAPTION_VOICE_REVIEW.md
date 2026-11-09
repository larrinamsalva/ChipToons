# PR #69 — Caption & Voice Timing Review for Imported Cartoons

PR #68 introduced an explicit optional way to carry storyboard subtitle
drafts into the standard editable captions in a newly created
multi-shot Framefield PNG cartoon.

This PR adds a **read-only caption and voice timing review** in
**Finish My Cartoon**, specifically for projects created by that
Framefield multi-shot workflow.

## What you can review

1. Open a newly created multi-shot PNG cartoon.
2. Choose **Finish My Cartoon**. After the existing narration and
   production checks, the **Caption & Voice Timing Review** displays:
   - How many scenes have an active, assigned narration/dialogue
     clip with non-muted mixer settings.
   - Number of editable timed captions and the number without any
     overlapping assigned voice-clip interval.
   - A per-scene list of actual caption words and their local start/end
     seconds, indicating whether any selected voice clip overlaps.
   - Clear reminders for scenes with written narration but no voice
     clip, or written words/voice clips without timed captions.
3. Select **Review voices for scene** or **Review captions for scene**
   to open ChipToons' **existing** voice recorder and caption editor
   at the appropriate scene. Existing editing, saving and export
   controls remain unchanged.

## Accuracy and preservation boundaries

- This review looks at *assigned clip time ranges and mixer settings*.
  It does **not** decode and listen to actual audio, recognize spoken
  words, prove that voice and subtitles are synchronized, approve an
  acting performance, or automatically add voice clips.
- A voice assigned during a caption interval is **only a cue for
  manual listening**. It does not mean the voice says the matching
  words. It also does not verify that an external original audio file
  is available: the existing Episode Readiness review does that.
- Muted clips, a muted mixer, zero voice bus/master level and clips
  outside a scene do not count as an assigned audible voice.
  Music and sound effects never qualify as narration/dialogue.
- Review suggestions are **non-blocking**. Silent text slides and
  music-only cartoons remain valid creative choices.
- Only `templateId === "frame-sequence-storyboard"` shows this new
  panel; other existing scenes, starter demos, 20-minute fixtures,
  puppet motion, saved projects and import workflows are unchanged.
- The entire review is pure and read-only: no schema, caption track,
  original PNG, audio file, source asset, save behavior, WebM export,
  recording or remote service is modified.

## Verification and merge gate

- Unit tests verify per-caption overlap timing, missing voice versus
  missing captions, muted audio and mixer conditions, and exclusion
  of music and unrelated scene clips. They assert original project
  data remains byte-for-byte unchanged.
- Existing multi-shot browser import test now confirms the three
  actual imported caption cues appear in the finish review, that
  unrecorded speech is clearly identified, and that the caption
  editor link opens for the selected scene, including phone/tablet.
- Foundation/browser QA and the original full 20-minute genuine
  narrated WebM/audio verification must both pass on PR #69's
  latest head before a human merge. No automatic merges or deployments.

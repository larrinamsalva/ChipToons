# Little Fixers Club — The Wobbly Chair (PR #33)

## Mission and honest production status

Extend the **original full-body SVG/2.5D Scout cartoon**, rather than making more moving-photo slides, into a genuinely animated **90-second** story featuring an unsafe chair and a kind, age-appropriate safety lesson.

This adds a **new 30-second story scene** to the previous 60 seconds of original Scout animation. It is **not a finished 20-minute episode, not film-quality 3D, and not 90 seconds of fully voiced dialogue**. The original **first 34 seconds** have three previously approved recordings; the subsequent 26+30 seconds have four script lines **not yet recorded**. Never fake a voice, silent-subtitle a speech claim, or call the entire episode complete.

## Watch the story

Open the no-login ChipToons dashboard and choose **Watch Scout and the wobbly chair (1:30)**. The separate 34-second voiced demo and 60-second checklist demo remain available unchanged.

## Animated sequence

1. **00:00–00:34 — Scout walks and talks.** Original full-body vector puppet and the genuine approved Little Fixers recordings, waveform-based lip movements, and captions.
2. **00:34–01:00 — Scout makes a plan.** The puppet hand actually attaches to, carries and releases a checklist on the workbench, then Scout thinks and points. Additional dialogue for this scene remains unrecorded.
3. **01:00–01:06 — Scout approaches the chair.** Alternating leg and opposing arm keyframes create distinct walking motion.
4. **01:06–01:10 — The chair wobbles.** The chair has its own nine-keyframe animated rotation track (visible tilts in both directions). Scout freezes, changes expression, and notices.
5. **01:10–01:14 — A safer choice.** Scout makes two small backward steps, never sitting on, shaking, or trying to repair the unstable chair.
6. **01:14–01:30 — Look, stop, ask.** Scout pauses, points to the issue and ends with a positive reminder to ask a trusted grown-up.

There are **17 new Scout performance keyframes**, **9 new chair wobble keyframes**, **4 camera shots**, **4 timed focus labels**, and original workshop/steps/success effects reused from the existing audio library. All changes are authored with editable scene, rig, keyframe, prop and sound data; no image/poster trace, new dependency, external TTS service or new artwork asset.

## QA and remaining tasks

- Browser tests check three scenes totalling 90 seconds; correct desktop single-segment (90s) and phone two-segment (60s + 30s) plans; a real visible chair wobble; Scout's forward walk, reaction and backward step; camera shot/focus counts; and all existing approved speech and captions, with the four new lines correctly unrecorded.
- Independent media test records and decodes a real **90-second VP8/Opus** video, comparing frames before/during/after the chair motion and measuring audible original speech.
- Existing Foundation, mobile, cross-browser, 20-minute studio export, media verification and backup tests remain in place. The long-form 20-minute test proves engine capability using a fictional fixture—it is **not** a finished Little Fixers cartoon.
- Preserve PR #25–#32 source templates and their demonstrations. Do **not merge this draft automatically**. Wait for green tests, review the video artifacts and adjust choreography if necessary.

To finish this story for children, record and approve the new lines in a suitable consistent voice, attach matching waveform mouth tracks, add captions and review listening/safety clarity. Then connect more true character-driven animated scenes to the 20-minute Little Fixers Episode 1.

# PR #73 — Caption Time-Window Coverage Gaps

## What changes

Finish My Cartoon and the guided scene-recording view now display **how
much of each caption's time interval intersects assigned unmuted voice-lane
clip intervals**, and the remaining uncovered time spans.

The previous view only said "voice clip overlaps" when any overlap
existed. For example, a 0.30-second voice clip overlapping a 2-second
caption covers only 15% of that caption's time span. The new display
makes the remaining 85% and the exact uncovered period visible.

- Genuine overlapping narration/dialogue intervals are clipped to the
  caption time window, merged to avoid double-counting and compared to
  the original cue's duration.
- Music/effects, muted clips, zero clip volume, global mute and zero
  master/voice bus continue to be excluded from timing coverage.
- A cue may have multiple gaps, including between separate voice clips.
  In the scene recording guide, gaps display *episode-relative* seconds.
  In Caption & Voice Timing Review, gaps display *scene-relative* seconds.
- Existing captions with no overlap still say "No assigned voice
  overlaps." Existing overlap hints, exported .srt, saved sources and
  caption editing behave as before.
- A partial interval shows a warning, but the guide **never changes**
  real recordings, captions, scene durations or backups.

## Important limitation

A source on the narration/dialogue bus is not guaranteed to contain
speech. **100% time coverage does not mean the words were spoken**, only
that the time window overlaps assigned, currently unmuted voice clips.
Creators must listen to their original takes and preview the finished
cartoon before approval or publication. Silent cartoons remain valid.

## Verification and merge requirements

- Unit tests verify no/partial/full coverage, gaps before/after/between
  clips, overlapping clips without double counting, muted/quiet inputs,
  and no mutations to the actual project.
- Desktop/phone/tablet Playwright checks render real scene one and scene
  two timing percentages from a saved uploaded audio original while
  preserving the ability to play that source in the guided workflow.
- All Foundation tests, lint/build, cross-browser tests and independent
  genuine full 20-minute narrated WebM/audio export must pass on the
  latest commit. Human review before any merge or deployment.

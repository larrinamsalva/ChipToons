# Little Fixers Club — Safety First animation increment

This is a separate, editable continuation of **Episode 1: Fix It, Don't Toss It!** for children ages 4–7. It extends the approved **1:59 opening** with two original, animated safety scenes. It is not a finished 20-minute movie and the new dialogue is not voiced yet.

## Open the new motion preview

In ChipToons, choose **Turn My Picture Into a Cartoon → Use the Little Fixers Club poster → Open animated Safety First (3:00; new voice to record)**. The studio creates a separate local project. It doesn't modify the 34-second demo, the original 1:59 opening or the 20-minute screenplay draft.

| Episode time | Content | Actual state |
| --- | --- | --- |
| 00:00–01:59 | Wobbly chair, safety choice, episode title and workbench handoff | Original 8 real animated scenes, 17 approved voice recordings and captions from PR #25 |
| 01:59–02:30 | Clear the Walkway | New animated puppet gestures, moving toy, camera framing, teaching overlays and real sound effects; two written dialogue lines **not yet recorded** |
| 02:30–03:00 | Stop and Ask | New animated puppet gestures, separate camera shots, stored toy, child-friendly safety labels and room/success sounds; two written dialogue lines **not yet recorded** |

## What is genuinely animated

- The workshop host's separate head and right arm have authored joint keyframes.
- A toy starts in the walkway and moves visibly to a shelf across multiple motion keyframes; it remains safely stored in the second scene.
- Original workshop props and the unsteady chair remain in a safe arrangement. No child is depicted handling dangerous tools.
- Three non-overlapping camera shots and timed teaching labels direct viewers' attention.
- Looping workshop ambience, light sweeping, gentle placement and success effects use the existing real audio mixer.
- The original 17 approved voice recordings, mouth motion, captions, camera animation and original art are retained in their original scenes.

## Mobile and export behavior

Two new scenes (31 and 30 seconds) make the continuation compatible with 60-second phone segments. At the standard desktop 120-second maximum, segment planning makes **119-second opening + 61-second safety section**. The media-export verification decodes the second segment as real VP8/Opus video and independently checks moving frames; no static slideshow or repeated filler is substituted.

The four new dialogue lines are intentionally marked as **Not recorded**. They have **no approved takes, no lip synchronization and no timed speech captions**. Record or upload takes in **Script & Voice Director**, review/approve them and verify new voice-to-mouth animation before describing this as a fully voiced three-minute episode.

The separate 20:00 full-script option now keeps the original 1:59 animated opening **and** these two new Safety First motion scenes, with the other 17 scripted scenes still unanimated. Safety First's four new lines still need approved recordings and captions; all remaining scenes need unique animation, voice, captions and independently decoded WebM proof before release.

## Tests and review

- `tests/little-fixers-safety.spec.ts`: source art, original takes, actual keyframe movement, two new scenes, unrecorded voice status, portable backup, sound effects and 60-second phone segment safety.
- `tests/video-export-proof.spec.ts`: actual 61-second WebM export, ffprobe/FFmpeg checks for video and non-silent audio, and independent comparison of before/after frames.
- Full existing unit/build/browser/episode-production checks remain enabled; do not merge with failing checks. Any unrelated intermittent CI installations or 20-minute sample-export failures must be reported separately rather than relabeled as passing.

# Little Fixers Club — Finish the Voices (PR #34)

## Why this milestone matters

The real, editable 90-second **Scout and the Wobbly Chair** cartoon from PR #33 has seven script lines: the original three recordings in the first 34 seconds are approved, animated and captioned; **four lines across the two newer scenes are written but unrecorded**.

Rather than adding more silent footage, this PR makes the existing production workflow accessible as a guided recording checklist. It does **not** generate voices, substitute fake dialogue, claim unfinished footage is voiced, or modify the existing scene/story assets.

## Using the Voice Completion Board

1. On the no-login homepage, select **Watch Scout and the wobbly chair (1:30)**.
2. In the editor, choose **Finish the Little Fixers voices**.
3. The modal shows **each exact script line**, its scene, its actual recording approval status, whether its matching puppet lip-sync is current, and whether its timed captions overlap the approved recorded take. A previously approved take is never silently overwritten.
4. For an **unrecorded line**, select **Record scene N line N**. This opens the existing protected local Voice Studio *on that exact line*, with microphone recording and approved-source WAV/MP3/OGG/WebM upload.
5. After listening and saving, choose **Review and approve scene N line N** to open Script Director on the correct line and explicitly approve a selected take. Approved status depends on the original voice's actual recorded clip, line fingerprint, timing, and persistent local save.
6. Once an approved speaker still needs mouth movement, choose **Animate mouth for scene N line N**. That opens the existing waveform-driven Voice Mouth Studio, not a simulated talk-cycle.
7. Where approved voice still lacks captions, select **Review captions for scene N** and check its real clip timing. Captions are never silently fabricated for unrecorded dialogue.
8. Optionally download a **voice recording cue sheet** with every line and current progress; keep a separate complete project backup, which preserves the actual original audio recordings.

The board is only enabled for the explicit `little-fixers-scout-wobbly-chair-story` template. Existing standalone 34- and 60-second demos, the picture-cutout demo, and generic projects are not modified. The status display is entirely derived from current scene scripts, selected takes, linked clips, puppet mouth tracks, and clip-overlapping captions; it is not a hardcoded claim that the episode is finished.

## Scope and verification

- No new external voice providers, AI-generated dialogue, narrator impersonation, new dependencies, or edits to the current approved three recordings.
- No fake length inflation: the existing original cartoon is 90 seconds. The 20-minute benchmark video verifies the studio exporter and must not be described as a finished Little Fixers episode.
- Browser tests assert **3 approved / 4 unrecorded of 7 lines**, approved lip and caption coverage, correct exact-line recording navigation, a printable cue sheet, and preserved project backups. Responsive tests run on the existing desktop/phone/tablet suite.
- All real WebM export, original media proof and 20-minute engine regression tests remain enabled.
- Do not merge until the required checks are successful and the recording/approval navigation is reviewed.

**Next actual creative step:** record the four missing lines, approve each performance, create matching mouth tracks and timed captions, then inspect a genuine 90-second export with all dialogue. After that, continue writing and animating new character-led scenes toward the full 20-minute episode.

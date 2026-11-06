# Little Fixers Club — Fix the Little Wagon (PR #37)

## Mission

Extend the existing **2:30 original Scout-and-Helper-Jo cartoon** to **3:30** with two original 30-second scenes that demonstrate a genuine visual toy repair **and** a rolling test. Use only editable original vector/2.5D characters and established animation and object-transformation systems. No slideshow, simulated 20-minute episode, fake speech or new 3D claim.

The earlier five scenes, two original puppet characters, approvals, captions and scene props remain intact. The wobbly **chair remains out of use** pending adult inspection: this chapter instead uses a completely separate child-safe **toy wagon**.

## Storyline and production state

- **0:00–2:30:** All five existing episodes: Scout arrives, carries a checklist, notices the wobbly chair, shares the checklist with Jo, and Jo marks the chair out of use. The original three spoken lines in the first 34 seconds retain their approved source files and lip sync.
- **2:30–3:00 — Repair the big toy wheel:** Scout notices a wobbly toy wagon. Helper Jo moves closer, bends/reaches with independently animated limbs, and demonstrates gently pressing a *large snap-on toy wheel* into place. The wagon is a true original `toy-wagon` prop; its `objectTrack` transitions from the built-in **loose-wheel artwork to fixed-wheel artwork**, timed exactly to Jo's visible adjustment gesture. The change is causally linked to Jo's `point` interaction's **Finish** event. The wagon wobbles on its own keyframes before settling. Camera moves to a close-up of the changing wheel. The first scene has real motion, not a narrated still photo.
- **3:00–3:30 — Test it together:** The wagon starts in the actual **fixed-wheel** appearance and rolls across the floor on its own real position/tilt keyframes; camera follows the toy. Scout tracks it, points and smiles; Jo checks and celebrates. Original wheel-rolling effects play at actual rolling beats. The final beat teaches testing and thanking your helper.

There are four new script lines across the two scenes, **written but not recorded**. With this project the existing recording board should show **3 of 15 approved lines, 12 requiring approved takes, mouth motion and captions**. The three existing approved source voices remain untouched.

This demonstrates the animated concept of a large, child-safe snap-on toy component. **Not instructions for small parts or dangerous hardware**; a grown-up handles broken toys and supervises children ages 4–7. The damaged chair is NOT repaired, tested or declared safe by this story.

## Working with the demo

On the no-login ChipToons dashboard select **Watch Scout fix a toy wagon wheel (3:30)**. It creates a separate editable workspace; all earlier buttons remain available. To complete the audio use the existing **Finish the Little Fixers voices** board. Record/upload voices you own, review and approve individual original takes, apply waveform-based mouth animation, check captions and save project backups. Do not present unrecorded dialogue as audible.

## Merge gate

1. Unit/type/lint/production build pass on the actual PR head.
2. Desktop, phone, tablet, Firefox and WebKit/browser tests pass, including exact **seven-scene 210s** planning, original approved voice integrity, preserved earlier interactions, wheel's loose-to-fixed state at actual cue time, Jo's full-body gestures and genuine 150+ pixel rolling animation, 3/15 voice readiness, and backup/restore.
3. Independently export and decode the real **60-second third** and **30-second fourth** segmented WebM parts at the 60-second limit, compare actual decoded VP8 motion, and check the rolling Opus effects. Prior 34s/90s/120s/cartoon and the unrelated 20-minute engine fixture video tests remain enabled.
4. Inspect decoded video artifacts, captions, safe toy repair portrayal and readability before approving.
5. No merge or Pages deployment without user approval.

Next: finish genuine approved recordings and captions, then additional carefully animated learning scenarios toward the eventual real 20-minute Episode 1. A successful 20-minute **studio exporter fixture** is **not** the same as a completed 20-minute children's cartoon.

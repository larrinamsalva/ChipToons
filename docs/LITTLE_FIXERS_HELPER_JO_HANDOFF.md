# Little Fixers Club — Helper Jo arrives (PR #35)

## Milestone

Grow the original **90-second Scout and Wobbly Chair cartoon** into a genuinely animated **2-minute, four-scene story** that shows Scout asking a trusted grown-up for help.

This is an original **editable vector/2.5D cartoon**, not true 3D mesh cinema or a picture slideshow. This work does **not** complete the planned 20-minute Episode 1. The engine's existing successful 20-minute export test uses a separate example fixture.

## Watch

From ChipToons' no-login dashboard choose **Watch Scout meet Helper Jo (2:00)**. It creates a **separate fictional demo project**; the existing voiced 34-second Scout pilot, 60-second checklist acting scene, and 90-second wobbly-chair scene remain available unchanged.

## Timing, safety and acting

- **00:00–00:34:** original full-body Scout performance, with all three approved original voice recordings, linked waveform mouth motion and existing captions.
- **00:34–01:00:** Scout lifts, holds and puts down the checklist using a genuine puppet-hand attachment; two written dialogue lines remain unrecorded.
- **01:00–01:30:** the chair visibly wobbles independently, Scout notices, backs away and asks for help; two more lines remain unrecorded.
- **01:30–02:00:** **new two-character scene**. Larger adult **Helper Jo** (originally rigged vector puppet with different hair/skin/shirt colors, black boots and workshop tool belt) walks in on alternating steps. Scout waves and shows the picture checklist. Their **hand-to-hand transfer** uses ChipToons' existing editable `give` interaction with a timed transfer to Jo's real puppet arm/hand. They communicate, nod and stay clear of the unsafe chair. Jo offers reassurance. Neither attempts a repair, sits on the chair, or uses potentially dangerous tools.

The final 30 seconds have independent keyframed full-body joint/facial performances for both characters, one genuine object transfer, three camera shots, four educational focus captions (short **visual labels**, not false dialogue subtitles), workshop ambiance, footsteps, an original reassurance sound and a closing success effect.

The last scene has **two new written but UNRECORDED speaking roles**:
- Scout: “I noticed our chair wobbling, so I stepped back. Jo, can you help me keep everyone safe?”
- Helper Jo: “Good job stopping and asking! We won't use that chair until a grown-up checks it. Thank you for telling me.”

No synthetic or copied voice is provided. The first 34s remain the only approved spoken performance. The newer 86 seconds still need real approved human takes, matching mouth tracks and timed captions.

## Recording and format

The existing **Finish the Little Fixers voices** button (PR #34) now recognizes **both the earlier wobbly-chair template and this longer Helper Jo template**. The new story should truthfully show **3 of 9 lines approved; 6 lines needing voices**, including Jo's voice as a distinct speaker. Record and approve human voices through the existing workflow, then animate the waveform and review captions. The earlier 3 approved lines and their original audio sources remain untouched.

At the configured export limits, the 120-second new story splits into **one desktop WebM part** or **two 60-second phone parts**; neither is a slideshow.

## Merge verification

Browser tests validate two unique characters/rigs, safety rules, Jo's independent walk, Scout's hand holding the checklist before transfer, Jo holding the actual object afterwards, preserved older voice takes and caption timings, six genuine missing new takes, repeatable backup/reopening, and the split-export plan.

Independent real-video QA must export and decode an original 120-second VP8/Opus WebM; compare motion between multiple decoded frames from the new scene; and verify genuine speech exists in the original approved opening. The existing 20-minute exporter benchmark, mobile/browser tests and original-media checks must remain enabled.

**Do not auto-merge.** Keep PR #35 as a draft until all required tests pass, videos are visually reviewed and the reviewer decides to merge.

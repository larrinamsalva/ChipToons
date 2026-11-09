# PR #64 — Framefield Story Beats & Scene Notes

ChipToons already imports real original numbered PNG animation frames
(PR #57), combines two or three shots (#58), reorders scenes and holds
real final frames (#59), and previews pictures and full local story
reels with jump-to-scene markers and genuine PNG thumbnails (#60–#63).

PR #64 adds small, **optional, per-shot writing fields** before import,
so children’s educational cartoon creators can begin authoring an actual
story, lesson and narration alongside the real animated pictures.

## How to use

1. In the advanced Creative Studio Bridge, choose **Build a multi-shot
   cartoon** and select two or three complete numbered PNG shots.
2. For each shot in Shot Director, the new **Story beat · optional** box
   lets you enter:
   - **Scene title** — a short human-readable heading (max 80 characters).
   - **What happens in this shot?** — on-screen action and learning notes
     (max 240 characters).
   - **Written narration** — the words you want spoken later
     (max 300 characters).
3. Reorder shots or change their existing 0–3-second final-frame holds.
   The text stays associated with the **original shot prefix**, not
   its temporary numbered position in the storyboard.
4. Select **Create multi-shot cartoon**. ChipToons validates the selected
   file set and the matching, bounded notes before decoding PNGs, then
   creates a **new portable cartoon**. The three optional texts become
   ordinary editable `scene.title`, `scene.action` and
   `scene.narration` fields in the newly created project.
5. Continue editing, add actual voice recordings using the existing
   audio workflow, review captions and export using the existing
   verified ChipToons pipeline.

## Actual capability boundaries

- This is a **written-script and scene-notes feature**. Entering
  narration does **not** record a voice, synthesize speech, create an
  audio asset, align lips to the text, or promise that every line
  automatically fits the selected scene duration. These remain
  separate creator steps.
- If no story beats are entered, the original multi-shot default
  titles, actions and empty narration remain unchanged.
- Written notes are checked for exact selected shot prefixes, duplicates,
  unsupported extra fields, excessive lengths and disallowed control
  characters. A changed file selection or import mode **clears prior
  unsaved shot notes**, preventing them from being accidentally attached
  to different original PNGs.
- Reordering/holding a shot does not discard its writing. The
  created project retains original PNG bytes, frame IDs, order,
  duration, export scheme, backup format and existing scene validation.
- No new user login, remote service, generated imagery, third-party
  source integration or actual audio rendering is introduced.
- Existing single-shot import, unmodified multi-shot import, previously
  saved cartoons, original puppets/rigs and the complete 20-minute
  narrated export workflow remain unaffected.
- The editable source is still a local **2D rendered-PNG interchange**,
  not editable native Framefield geometry or XR content.

## Verification and manual merge gate

- Unit tests verify exact written content after shot reordering,
  exported project backup fields, still-identical durations/frame IDs,
  no invented audio, legacy no-beats behavior, and strict rejection
  of tampered/oversized/foreign notes.
- Desktop, phone and tablet browser tests write two different scene
  scripts, reorder them, add an ending hold, import the original PNGs
  and inspect the portable project on desktop. Tests also confirm a new
  file selection removes stale writing.
- The existing full Foundation/browser checks and the **real complete
  20-minute narrated movie plus decoded-video/audio tests** are
  mandatory and must both be green on the latest PR #64 SHA.
- Keep the PR as a **draft** until reviewed. No automatic merging or
  deployment.

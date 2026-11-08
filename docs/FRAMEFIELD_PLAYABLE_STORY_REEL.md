# PR #61 — Playable Framefield Story Reel

ChipToons already imports **real, original numbered PNG animation frames**
(PR #57), groups them into **multiple scenes** (#58), supports manual
**Shot Director ordering and final-frame holds** (#59), and displays each
real PNG for frame-by-frame inspection (#60).

This increment adds a **silent playable storyboard reel BEFORE import**.

## How to use

1. Expand **More ways to create · 3D, art, film & XR studio connections**
   on the ChipToons dashboard.
2. Choose **Build a multi-shot cartoon** and select 2–3 valid,
   consecutively numbered, separately named original PNG sequences.
3. Pick 2, 4, 8, or 12 fps; optionally use Shot Director to move shots
   earlier/later and add 0–3 seconds holding the last original frame.
4. In **Watch your shots in order**, select **Play**, **Pause** or
   **Restart**, or drag **Seek full storyboard**. The preview plays the
   actual selected PNG images in exactly the chosen scene order, with hard
   cuts and the same holds and duration as the new cartoon would have.
5. When satisfied, use **Create multi-shot cartoon**. This creates a
   *new portable project* using the existing import/export path. Playback
   previews do not modify the original PNGs, source scenes, audio, settings
   or previously saved cartoons.

## Scope and safety

- **Silent local-only preview**: not a recorded WebM, video renderer, music
  synchronization engine or a claim of editable 3D Framefield assets.
  It only displays original, selected File objects through temporary
  browser `blob:` object URLs; the existing preview image component
  revokes its URL whenever the frame changes or is removed.
- The shared pure reel sampler uses **the same duration formula** as the
  merged multi-shot importer: `max(2, ceil(frames / fps)) + holdSeconds`.
  At each scene boundary the new shot begins immediately; during a
  hold the last real PNG stays onscreen. No intermediate frames are
  invented or interpolated.
- Play/pause is explicit; no autoplay, external network access, remote
  publishing, persisted preview data or automatic export. Tab hiding pauses
  the reel; unmounting cancels the browser animation callback.
- Shot reorder, hold change, fps change, mode switch or a new file selection
  resets the *optional preview*. Previously saved cartoons, real WebM
  exports, source artwork, original shot list, project schema, backup
  format and existing rendering pipeline remain untouched.
- Desktop/phone/tablet-friendly controls, high-contrast dark/light labels
  and keyboard operation (including the seek slider).
- All existing import constraints remain unchanged: 2–3 scenes, 2–24 PNGs
  per shot, ≤40 assets/24 MiB, ≤4 MiB per source file, PNG signature
  validation, matching image dimensions within each shot and ≤1280×720.

## Verification

- Unit tests compare preview shot starts/durations and real imported
  scene lengths, exact frames just before/after real cuts, the final
  original frame during holds, negative/non-finite seeks, and unchanged
  default shot order.
- Browser tests in desktop, phone and tablet validate authentic PNG
  previews, manual play/pause/restart, progress seek, reordered shots,
  new hold durations, removing a selection, and rejecting corrupt inputs.
- **Existing** genuine WebM and complete narrated 20-minute episode
  tests must remain green as well; this PR adds no new export path.

Require both GitHub check groups green on **PR #61's latest commit**.
Human reviews and merges manually; do not merge automatically.

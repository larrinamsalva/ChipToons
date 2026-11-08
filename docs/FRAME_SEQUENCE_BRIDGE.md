# PR #57 — Framefield numbered PNG sequence bridge

This is the first **real animated-frame import** in the independent
ChipToons Creative Studio Bridge. It is not a 3D mesh importer, XR
runtime, GPU renderer, remote account connector or an automatic film pipeline.

## Import a short, already-rendered Framefield animation

1. In Framefield Studio (or any trusted image tool), export consecutive
   original PNG images from one fixed-resolution shot.
2. Return to the ChipToons dashboard, expand **More ways to create · 3D, art,
   film & XR studio connections**, then choose **Framefield PNG animation ·
   local import**.
3. Select the actual numbered PNGs, e.g. `frame_0001.png`,
   `frame_0002.png`, `frame_0003.png`, without gaps, and choose **2,
   4, 8 or 12 frames per second**.
4. Select **Create cartoon from numbered PNGs**. ChipToons validates
   every image and creates an entirely **new** one-scene, editable cartoon.
   The originals are bundled as separate portable image assets; no existing
   cartoon is overwritten. Save the project backup normally.
5. Preview or export the new shot with the existing ChipToons WebM exporter.
   An actual media test decodes two distinct source frames out of the final
   WebM and compares their colors, not just metadata.

### Exact limits

- **2–24 frames**, PNG only, whose filenames share a prefix and numeric
  width and start at 0000 or 0001. File order may be arbitrary; the
  importer sorts it. Missing, duplicated, mismatched, partially numbered,
  or non-PNG selections are rejected.
- PNG dimensions must **match exactly**, at most **1280 × 720**.
  Each original PNG is under the existing **4 MB asset limit**;
  the entire selected sequence must total **24 MiB or less**.
- The resulting scene lasts a minimum of 2 seconds. Any remaining time
  beyond the selected frame count holds the last imported frame rather
  than inventing new images.
- The existing portable **64 MB project** size and 40-asset limits still
  apply. Large or high-frame-rate shots must be split into shorter
  local projects/scenes, not silently downsampled or transcoded.
- This is constant-frame-rate 2D image playback. It does **not** import
  editable Framefield geometry, scene cameras, lights, texture layers,
  skeletons, materials, keyframes or external audio. Original PNGs stay
  editable only in their source tools; their full raw pixels are kept in
  the portable ChipToons assets.

## Fidelity and safety

- The stored scene has one ordinary **art** element plus optional
  `frameSequence` metadata referencing only available, validated
  locally imported PNG assets. The first frame remains its safe static
  fallback. No project schema-version bump or existing project migration
  is necessary.
- The same `frameSequenceAssetIdAt` time sampler runs for editor
  scene scrubbing, screenshots and `Stage` inside genuine video exports.
  `rangeArtwork` preloads **every** imported frame so that the
  exporter never silently substitutes the poster.
- Loading an unknown backup validates the whole metadata and asset graph:
  duplicate/missing frames, incompatible images, unsupported rates, oversized
  sequences or broken references fail closed. No network calls, external
  execution, file-system access beyond explicitly chosen local files,
  automatic remote publishing or authentication is introduced.
- Users must explicitly select files and click import; errors remain on
  the chooser. Existing local cartoons and the children's classic
  templates are unchanged.

## Verification and merge gate

- Unit tests cover numbered sorting, gaps/duplicates, project graph
  validation, per-frame SVG output, repeatable seeking and export preflight.
- The real browser test imports four *different* PNG images in reverse
  filename order on desktop, phone and tablet, rejects an incomplete
  selection, and validates the editable portable project on desktop.
  It also actually exports a 2-second WebM in desktop Chromium and
  **independently decodes** early and late picture colors with FFmpeg.
- All existing Foundation/browser checks and the full narrated
  20-minute episode/genuine-export proof must pass on this PR.
- This remains a draft until **both check groups are green**.
  Do not merge automatically; review the UI and integration first.

The next roadmap step is still a **separate, opt-in 3D scene adapter**.
Do not copy source trees from MichaelWave369's tools or bypass the
original versioned-license and provenance requirements.

## PR #58 — Multi-shot export

You can now opt into **2–3 separate numbered PNG shot prefixes**, combining up to 40 original PNGs into a *new*, multi-scene cartoon (24 MiB total selection). This is separate from and does not change the original single-shot importer. See [Framefield multi-shot storyboard](FRAMEFIELD_MULTISHOT_STORYBOARD.md) for ordering, limits and genuine export verification.

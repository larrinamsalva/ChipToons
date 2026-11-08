# PR #58 — Multiple Framefield PNG shots in one ChipToons cartoon

After the original numbered-PNG animation bridge (#57), creators can now
assemble **two or three separately rendered animation shots** into a new
multi-scene ChipToons cartoon.

## Creator workflow

1. Render several short animations independently in Framefield Studio or
   another source tool that can export real original PNG files.
2. Give each shot a separate numbered prefix with a complete run of images.
   For example: `shot01_frame_0001.png`, `shot01_frame_0002.png`,
   `shot02_frame_0001.png`, `shot02_frame_0002.png`.
3. On the ChipToons dashboard expand **More ways to create · 3D, art, film &
   XR studio connections** and select **Build a multi-shot cartoon**.
4. Select **all** local PNG files at once and choose the shared playback speed,
   2, 4, 8 or 12 frames/second. See the sorted shots and frame counts before
   confirming.
5. Choose **Create multi-shot cartoon**. ChipToons validates and decodes each
   actual PNG, then creates a **new portable cartoon**. A different shot
   becomes each independent editable scene, ordered by natural numeric
   filename prefixes. Existing local cartoons stay unchanged.
6. Preview, add captions/audio with the original editor, or export with the
   existing real WebM exporter. Scene cuts, source-frame timing and original
   artworks are all kept. The final PNG holds until its scene ends.

## Safety and actual limits

- **Two or three shots**, each with **2–24** consecutively numbered PNGs.
- **No more than 40 PNG assets total** and **24 MiB total original file size**.
- **Up to 1280 × 720**, with identical dimensions *within each shot*.
  Different shots can have different dimensions within those limits.
- Each file obeys the existing 4 MiB asset cap and actual PNG signature/
  browser decoding. The existing portable backup 64 MiB project limit
  and scene/asset graph validation still apply.
- Each scene runs for a minimum of 2 seconds, and uses a hard cut to the
  next shot. The scene duration is rounded up to a whole second;
  leftover seconds hold the final original frame, not fabricated content.
- Import only by deliberate file selection and button press; nothing reads
  external services, executes remote code or modifies other repositories.
- Existing single-shot import, children’s cartoon templates, legacy
  backups and animation renders remain unchanged.
- The source is a **rendered 2D sequence**: this does **not** magically make
  Framefield meshes, materials, rigging, lights, shaders or animations
  editable in ChipToons. Full native GPU/XR support remains a separate
  step requiring a vetted scene adapter and device testing.

## Exact playback and verification

- The same frame sampler from PR #57 selects the correct frame at local
  scene time inside the same `Stage` that handles previews and the WebM
  renderer; `frameAt` chooses the active scene from global time.
- `rangeArtwork` preloads every original frame only for the selected
  scene or segment; the normal video segmenter can still export the full
  multi-scene movie with its original safety limits.
- Pure unit tests cover arbitrary file-selection order, numeric shot sort,
  missing/duplicate frames, invalid dimensions and identity, exact
  two-scene graph, backup validation, and SVG render output before and
  after a real scene cut.
- Desktop, phone and tablet browser QA exercises real PNG decoding,
  creating a new cartoon and rejecting gaps. Desktop additionally downloads
  the project backup, records a **real four-second WebM**, and uses FFmpeg
  to independently check red first-shot and yellow last-shot frames from
  opposite sides of the scene boundary.

Require both Foundation/browser QA and full 20-minute episode + genuine
exports green on the **latest commit**. This PR stays draft and unmerged
until manual review. No automatic merge or release.

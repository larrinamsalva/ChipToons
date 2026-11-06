# PR #41 — Cinematic Character Materials

## Purpose

After the merged PR #39 Cinematic Storybook look and PR #40 more natural character movement, improve **how the full-body vector characters look**. They still aren't 3D meshes or AI-generated animation. This is a concrete, incremental 2.5D **material and facial rendering** pass, created to bring Little Fixers' Scout and Helper Jo closer to the inviting volume and expression of modern children's cartoons.

## New visual details

Turn on **Cinematic Storybook look** in the cartoon editor:

- **Rounded costume volume** — original workwear jacket, cargo pants, black work boots and toolbelt receive reusable layered lighting across the material. High-contrast details, pockets, seams, boot soles and original colors remain visible.
- **Natural vector surfaces** — ordinary rigged shirts, arms, hands, legs and feet gain the same optional material overlay instead of remaining flat rectangles. Original character shirt/skin/hair choices stay in the art. Photo-based uploaded parts are never changed by this vector shading.
- **Hair texture highlights** — the original modeled hair shape (including built-in Scout/Jo forehead hair and separate hair rigs) receives a soft illustration sheen.
- **Readable, friendly faces** — a small, non-scary nose contour complements the existing eye catchlights and cheek shapes without breaking the existing mouth shapes, blinking or approved voice mouth motion.
- **Synchronized, exportable artwork** — all details live within the existing PuppetArt SVG component rendered by Stage; the same Stage powers the editor and the actual WebM painting pipeline. No CSS-only filters, remote images, model generation, external tracking scripts, provider subscriptions or copied movie characters.

## Backward compatibility

- **Opt-in only**: Classic mode remains pixel-for-pixel structurally unchanged. Old saved projects and cartoons remain classic until the creator switches on Cinematic Storybook.
- No schema changes or new mandatory data; no new rig parts, morphs, keyframes, recordings, captions or scene edits.
- Do not modify existing Little Fixers episodes; the story remains at **4:30** of authored editable animation, with later dialogue awaiting original approval.
- The unsafe chair remains marked and unused. Children do not handle adult tools.
- SVG gradients use unique React IDs so multiple performers on the same Stage don't accidentally share or overwrite paint materials. The character's original asset image references are never reinterpreted.

## Verification

- Unit/SSR regression draws the real, fully rigged original Little Fixers pilot through Stage in both modes and checks for actual **costume, cargo, boots, belt, hair, face and eye details**. It rejects changes to authored scenes, characters, recordings, assets, and project backup format.
- Existing cross-browser/desktop/tablet/phone Cinematic Storybook E2E test now checks those actual SVG layers, save/reopen, and switching them off. It preserves original voice mouths, captions, media and animation.
- All prior foundation, browser and genuine video-export tests remain mandatory. The separate 20-minute *export fixture* still is **not** proof of a completed 20-minute Little Fixers episode.
- Manual visual approval is still required before making claims about studio-quality appearance. More convincing 3D-like silhouettes, layered background paintings, inverse kinematics and lighting are future work.

**Leave PR #41 open and unmerged until checks pass and the owner has reviewed it.**

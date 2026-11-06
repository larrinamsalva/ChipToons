# ChipToons — Cinematic Storybook Look, first visual-quality increment (PR #39)

## What this solves

ChipToons' editing, animated puppets, prop interactions, camera motion and genuine video exports already work, but the default SVG art has flat face colors, basic eye shapes, uniform workshop walls and little grounding depth. This **small, non-destructive first step** gives existing cartoons a visibly more dimensional, expressive illustrated style in **both preview and actual exported frames**.

This is **NOT photorealism, 3D model rendering, AI video generation or the entire jump to a modern feature-animation finish**. Delivering that quality would require a much larger asset/rig/lighting/render pipeline, model sheets and visual review. This PR deliberately avoids fake preview-only filters, unlicensed likenesses or repeated AI frames.

## How to use

Open any cartoon in the editor, including any Little Fixers demo. In the upper editor controls, turn on **Cinematic Storybook look**.

- It applies a **consistent, project-wide style lock** across all scenes in that cartoon.
- **Workshop/classroom backgrounds** receive warm multi-stop wall and floor gradients, window-light warmth and soft atmospheric illumination.
- **Existing full-body puppet performers** receive richer skin and shirt shading, brighter eye whites, expressive pupil highlights and faint cheek blush, with stronger floor contact shadows.
- Switching it **off** restores the original classic look without rewriting any script, keyframes, cast, prop interactions, dialogue, voices or original assets.
- The optional `visualStyle: "storybook-cinematic"` flag is included in local saves, exportable project backups and restored projects. Missing/legacy field remains classic without migration or new mandatory data.
- Uses SVG only, with existing React **Stage** component also used by `paintStage` in `src/video-export.tsx` via `renderToStaticMarkup`. Thus the exact same visual style is rendered for on-screen preview **and** genuine WebM generation. No CSS filters (which can vanish on export), remote images, paid services or secrets.
- Other non-workshop scenery and existing custom raster artworks remain intact. Premium facial highlights apply only to authored vector puppet faces, not to borrowed images.

## Tests and safety

- Unit/SSR: renders the SAME Stage with and without style, confirms visibly different real SVG, skin/shirt fills/eye highlights and workshop lighting; ensures no external image URLs or foreignObject; validates backup/revert and disallows unknown style values.
- Desktop/phone/tablet browser: applies switch to an existing Little Fixers cartoon, verifies actual Stage SVG attributes and face highlights, saves, checks **existing three approved voice takes, lip sync, animations, captions and characters unchanged**, reopens successfully, and switches back to classic.
- Keep all previous browser/codec, true video export and 20-minute **studio fixture** regression tests. The 20-minute export benchmark is NOT a fully produced Little Fixers cartoon.
- Do not automatically merge, publish or change PR #38. PR #39 branches directly from the last verified merged `main`. PR #38 can land independently.

## Later phases (not in this PR)

Character design sheets and face shape controls; consistent multi-view asset packs; more convincing limb mechanics and gait, bounce/anticipation/secondary motion; layered painted depth and natural shadows; art-directed camera layouts; higher-resolution render pipeline and original sound/voice completion. These require deliberate iteration and real visual acceptance comparisons instead of a claim of instant movie-grade quality.

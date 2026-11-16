# PR #43 — Cinematic Walking & Foot Planting

## What was changed

The existing `Cinematic Storybook look` now samples the actual authored walking path to add a small, bounded, deterministic foot-placement pass. Existing Scout and Helper Jo artwork has independent animated legs and attached boots, but its feet previously followed each leg rotation without independent planting.

- Alternating stance and swing periods are derived from the original authored leg-key timing when available. Slow movement and stationary listening do not trigger the gait pass.
- During stance, a boot resists sideways floor sliding. During swing, the toe lifts slightly and eases toward its next step. Each correction is limited to a small displacement and rotation.
- Character motion remains authored: x/y keys, personality, emotional performance, lip-sync and recorded voices are never changed. The result is a temporary sampled frame, not a timeline rewrite.
- The same frame flows through Stage and the existing interaction hand attachment / camera / WebM rendering chain. PR #42's grounding shadows use the final adjusted foot positions automatically.
- Compatible rigs with an actual upper-leg → shin → foot chain receive a small, bounded two-bone IK assist, while standard Scout/Jo rigs receive the simpler boot planting pass. Incomplete and image-backed foot rigs fall back safely.

## How to review

Open the existing no-login **Watch Scout and Jo tidy up (4:30)** story, enable **Cinematic Storybook look** and compare walking segments with the classic checkbox off. Observe Jo's entrance, Scout's workshop walk, and the stop/settle transitions. Check both boot-to-floor contact and existing hand-held signs and checklists.

Use existing browser + media-export regressions. Added unit tests check scene immutability, deterministic seeking, opt-out and calm editing, bounded foot modifications, incomplete rig fallbacks, and two-bone geometry.

## PR #139 — Heel-to-toe motion during the original boot swing

- The existing **Cinematic Storybook** foot solver now permits a very
  small (maximum 5°) directional boot pitch *only while a foot is in
  the swing phase* of an animator-authored walk.
- Foot rotation is exactly zero at the start/end of swing and during
  the entire planted stance, limiting sudden pops and preserving the
  original foot contact. The sole contact point is recomputed after
  the tilt by the existing foot-planting solver, shared by scene,
  shadows, camera, editing and genuine video exports.
- The look mirrors when a character walks the other way, and
  disappears when the character stops. This does **not** generate
  extra steps, add shin joints, alter the walk path or guarantee
  perfect physical sole collision for all custom rigs.
- Unsupported/raster boots, incomplete rigs, flipped-Y artwork,
  Classic mode, calm authoring and all original project/voice data
  keep existing behavior. Pure helper tests and real gait tests
  verify directional bounds, smooth swing boundaries, deterministic
  frame seeking, original x position and unchanged project storage.
  The full browser and verified 20-minute export gates remain.

## PR #140 — Actual articulated knees in fresh Scout walking pilots

- New instances of the **34-second original full-body Scout workshop
  pilot** now have two genuine, separately parented `leftShin` /
  `rightShin` vector parts. Each shin is attached to the upper leg;
  the work boot is attached to its shin rather than the old leg.
  The original resting sole coordinates remain stable through
  21 + 17 stage-local pixels, replacing the prior 38-pixel boot offset.
- This exposes real knee bends from the **existing two-bone gait solver**
  in the shared Cinematic Storybook Stage/preview/export pipeline.
  The knee response is bounded, deterministic, and follows the
  creator's original walks rather than generating a new path.
- Only this **newly generated pilot** opts into the additional knee
  parts. The general `fullBodyWorkshopCharacter()` preset (called
  without an opt-in flag), old serialized cartoons, imported art
  and the separately approved articulated-arm handoff demonstration
  retain their original rig structure. Classic and calm editing keep
  authored leg keyframes untouched; no automatic knee positions are
  saved into the project.
- Unit and live browser tests verify shins genuinely render as vector
  parts and are linked leg → shin → boot, that the original boot
  rest position is preserved, that Cinematic Storybook calculates
  nonzero knee rotations during walking, and that saved records,
  scripts, voice audio and position keys remain intact.
  Full Foundation/browser and real 20-minute media-export checks
  remain mandatory; inspect foot/ground contact visually.

## PR #141 — Both Scout and Helper Jo now have working knees in new handoff cartoons

- Fresh copies of the **30-second two-performer Scout-and-Jo
  articulated workshop** now enable the already proven #140 leg →
  shin → boot rig on *both* characters, in addition to their original
  shoulder → forearm → hand chains.
- The existing original 30-second animation (entrances, head poses,
  hand and elbow animation, safe picture-checklist transfer, scene
  duration and independent character colors) is unchanged. Each new
  shin is genuinely parented; each boot keeps its original resting
  coordinate (21 + 17 = 38 local pixels).
- The shared Cinematic Storybook gait solver bends both performers'
  knees during their authored approach. Classic and calm/keyframe
  views keep the original saved leg poses; painted and incomplete
  custom rigs are untouched. The Stage preview and real WebM export
  sample the same final animated frames.
- Previous serialized projects and the unopted
  `articulatedWorkshopCharacter(role)` preset retain their old
  rig structure. Existing real handoff/IK safety tests stay required.
- Tests verify each leg/shin/boot chain, both independent bend
  responses, visible SVG shin artwork twice per side, unchanged
  x positions, deterministic sampling, immutable project JSON,
  restored edits, and the original approved picture-checklist handoff.
  The strict browser and genuine 20-minute export gates remain.

## Scope limits

This is incremental original **2.5D animation**, not full 3D skeletal animation, physics-based motion capture or guaranteed zero foot sliding on every custom rig. Corrections are intentionally bounded and may be insufficient for unusually fast authored translations. The Scout/Jo preset rigs do not yet include a separately articulated shin, so their visible improvement is foot stabilization rather than a knee-joint overhaul. Custom image-backed rigs remain untouched.

The original Little Fixers story is still **4:30** and later spoken lines still need original human recordings. A 20-minute *export technical fixture* is not a completed 20-minute cartoon.

Do not merge without passing the required GitHub checks and reviewing a real moving preview.

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

## PR #142 — Sculpted knee sleeves and laced work boots

- The two real shin pieces added in #140–#141 now have **distinct
  fitted trouser sleeves**, a shaped knee panel, stitched folds and
  a clean cuff at the top of each boot in Cinematic Storybook mode.
  They no longer look like duplicated upper-thigh cargo pockets.
- The original simple rectangular cartoon boot is upgraded in
  Cinematic Storybook to a **recognizable work-boot silhouette**:
  curved ankle/upper, shaped toe cap, visible short laces, material
  highlights and a separate dark outsole. Its original lowest sole
  coordinate (half the boot height + 2) is preserved, so knee and
  ground contact calculations keep the same geometry.
- All new artwork lives inside existing **parented SVG puppet parts**.
  As the animator's knee, ankle and foot frames move, fabric folds,
  knee pad, boot laces and toe are drawn at those real transforms;
  there is no floating overlay, CSS motion or new skeleton.
- Only eligible `costume: "workshop"` **vector artwork** receives
  these details, and only with the existing Cinematic Storybook
  option. Classic, imported artwork and non-workshop costumes keep
  their old appearance. Earlier unarticulated workshop characters
  have no new knee sleeve, although their existing boots receive
  the improved look when Cinematic Storybook is enabled.
- Tests render the real Scout/Jo Stage and assert four distinct
  knees and four detailed boots, all parented to the existing
  two-actor animation. Original saved scenes, motion curves,
  prop transfers, camera, lip-sync, voice recordings and exported
  durations remain unchanged; existing full browser and genuine
  20-minute video-export gates are still required.
- This is more detailed **editable 2.5D cartoon vector workwear**,
  not generated 3D anatomy, physically simulated cloth, or an
  overhaul of the entire Character Studio.

## PR #143 — Articulated arm sleeves, forearms and resting hands

- Following #142's cleaner trousers and boots, **Cinematic Storybook**
  workshop characters now have fitted shirt sleeves with shoulder
  seams, subtle fabric folds and rolled cuffs on their original
  upper-arm joints. Their separately jointed forearms show rounded
  skin, a slight elbow crease and a wrist contour.
- When the character's original hand is **not holding anything**,
  it has a more identifiable palm/thumb silhouette and subtle
  finger creases rather than a featureless rectangle. During
  actual prop interactions the existing dedicated gripping-hand
  animator **always takes priority**; finger curls and prop anchors
  remain completely unchanged.
- These shapes live inside the existing parented SVG upper-arm,
  forearm and hand parts, so elbow IK, the safe checklist transfer,
  shoulder rotations and genuine video exports use the same
  scene frames and hand positions, without changing any skeleton,
  rig dimensions, pivot, joint keyframe, authored story or audio.
- Classic renders and non-workshop costumes retain their existing
  look. Older single-piece workshop arms gain sleeve detail when
  premium style is enabled, but are not magically given elbows.
- Tests render both performers in the real Stage, count distinct
  sleeve cuffs, elbow creases, open palms and finger lines,
  preserve the old active hand-curl renderer and verify the
  held checklist still exactly follows its animated hand. The
  existing full browser and independent 20-minute export checks
  remain mandatory.
- Incremental **2.5D vector character-art polish**, not a true
  3D arm, cloth simulation, automatic character redesign or
  change to the recording/animation-authoring pipeline.

## PR #144 — Distinct facial silhouettes for Scout and Helper Jo

- Fresh fully articulated workshop rigs now carry an optional **saved,
  explicitly chosen headStyle**: Scout uses a short side-part silhouette
  and Helper Jo has longer soft waves. This choice is intentionally stored
  on the puppet rig rather than guessed from the editable character name,
  skin tone or clothing colors.
- In Cinematic Storybook, these original hair shapes are drawn **inside
  each existing parented head joint**, alongside a subtle jaw highlight
  and ear silhouettes. The original eyes, pupil direction, eyelid motion,
  brows, mouth/lip-sync, voice opening, facial emotion and camera frames
  retain their approved coordinates and animation behavior.
- The rig validator accepts only the two known optional styles or no
  style at all. Previous saved cartoons, unstyled legacy workshop
  characters, non-workshop puppets, separate hair art, imported photo
  cutouts and Classic mode retain their prior original look.
- New tests render actual Scout/Jo Stage frames, assert *two distinct*
  hairstyles and head contours, preserve the real hand-grip attachment,
  prove deterministic seeking and unchanged serialized project data,
  verify Classic/non-workshop/legacy fallbacks, and verify that editing
  a name or hair color doesn't silently switch head style.
- The changes are limited to **original editable 2.5D character art**
  and opt-in head paint metadata, not a new AI face generator, 3D mesh,
  altered voice recording or completed television animation.
  Foundation/browser and real 20-minute media-export gates still apply.

## PR #145 — Hair follows the original actor movement

- Fresh opt-in Scout and Helper Jo hair silhouettes now have a **very
  small deterministic follow-through** when their author-recorded
  position or head-angle keys change. Hair tips against the movement
  and lifts slightly; it never drifts when the actor is at rest.
- The effect is derived from fixed local-time samples of the **existing
  authored keyframes**. It is clipped to 3.25 degrees of relative
  rotation and 1 puppet-local pixel of lift. It has no wall-clock
  physics, interval timers, new animation keys or saved motion state.
- Only the **hair silhouette** receives this secondary transform. The
  real head joint, original pupils, eyebrows, mouth, voice/lip sync,
  eye and prop positions, stage position, and handoff timing remain
  unchanged. Hair movement is part of the original SVG Stage render
  shared with previews and genuine video exports, not an independent
  browser-only CSS animation.
- Requires original `storybook-cinematic` artwork, an explicitly
  selected new workshop `headStyle`, and actual authored keyframes.
  Classic, calm keyframe previews, unstyled legacy puppets, separate
  illustrated hair assets, invalid samples and still performances
  retain their existing behavior.
- Pure tests verify bounded directional sway, a static actor no-op,
  real head response, repeatable seeking, and invalid input safety.
  Integrated tests render actual moving Scout/Jo frames and check
  separate moving hair groups, unaffected face and preserved
  checklist handoff anchor, and unchanged saved JSON.
- This is limited **2.5D cartoon follow-through** (not generated
  hair strands, cloth simulation or full 3D motion).

## PR #146 — Creator-controlled hairstyle selection

- The **Edit scene → Characters & movement** panel now includes a
  clearly labeled **Workshop hairstyle** selector for original
  editable workshop performers: **Original hairstyle**, **Short
  side part**, and **Soft waves**.
- The new choice updates the selected character's optional
  `puppet.headStyle` metadata in the existing project, making the
  original vector hair silhouette consistent in **every scene where
  that character appears**. It does not duplicate the performer or
  modify a scene-local hair color override. The current project's
  regular undo/redo, autosave, backup and restore flows apply.
- Unlike the costume color pickers, hair style is a *rig-design*
  choice; the editor says that it changes all appearances of that
  character within the cartoon. Other characters, their head styles,
  shared visual style switch, author-created keyframes, dialogue,
  audio, camera and all handoff contacts remain intact.
- Custom/imported photo characters, non-workshop puppets, and rigs
  with painted head or hair assets **do not show the selector**;
  their original drawings remain untouched. Choosing Original
  clears the optional `headStyle` and restores the legacy vector
  silhouette without damaging the existing head/eye animations.
- Unit tests verify independent character selection, project
  validation, serialization and restoration, no mutation, safe
  handoff positions and rejection of unsupported painted rigs.
  Desktop/phone/tablet browser acceptance tests edit Scout's style
  and exercise save, undo, redo and reload while comparing the
  authored scenes and audio verbatim. All existing full-media export
  gates remain.
- A more usable **2.5D character customization feature**; not
  arbitrary generated 3D hair or new AI assets.

## Scope limits

This is incremental original **2.5D animation**, not full 3D skeletal animation, physics-based motion capture or guaranteed zero foot sliding on every custom rig. Corrections are intentionally bounded and may be insufficient for unusually fast authored translations. The Scout/Jo preset rigs do not yet include a separately articulated shin, so their visible improvement is foot stabilization rather than a knee-joint overhaul. Custom image-backed rigs remain untouched.

The original Little Fixers story is still **4:30** and later spoken lines still need original human recordings. A 20-minute *export technical fixture* is not a completed 20-minute cartoon.

Do not merge without passing the required GitHub checks and reviewing a real moving preview.

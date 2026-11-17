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

## PR #147 — Create your own animated workshop character

- **Create a Puppet Character** now offers **Start with an
  Articulated Workshop Character** alongside existing custom shapes,
  drawings and uploads. This produces a new creator-owned original
  puppet instead of copying the saved Scout or Helper Jo scene.
- The new character uses the proven editable **15-part articulated
  rig** with independent upper arms, elbows, hands, thighs, knee/shin
  joints, boots, head, and tool belt. It has its own character ID,
  name and project/library life cycle; neither demo is changed.
- Puppet Maker shows a **live Cinematic Storybook preview** for
  workshop-costumed rigs. Within the assembly step, creators can
  rename their puppet, change the shirt/skin/hair colors, choose
  **Original hairstyle**, **Short side part**, or **Soft waves**,
  inspect the part hierarchy, reposition joints and use Pose Studio.
  Unlike the read-only pilot, these are editable source rig pieces.
- **Save Character** and **Add to Cartoon** use the established
  library validation and persistence flows, with normal per-project
  snapshots and backup/restore behavior. Saved original artwork,
  custom photos, existing Sunny rigs and all previously authored
  cartoons are untouched.
- New tests validate fresh unique identities, correct parented knee
  and elbow chains, serialized library-item reuse, unchanged source
  characters, and actual premium/Classic SVG rendering. Browser
  tests use the existing creation wizard to build an original
  character, change skin and hair color and hairstyle, then save
  it into a cartoon on desktop, phone and tablet.
- The live Puppet Maker preview uses Cinematic Storybook art, but
  adding the new character does **not silently switch the entire
  episode's visual style**: select Cinematic Storybook in the
  cartoon editor when you want the same cinematic detailing in
  the finished scene and exported video.
- This remains a **creator-editable 2.5D SVG puppet**, not a true
  3D mesh, photorealistic simulation or AI-generated image.

## PR #148 — Preview a real walk and reach in Puppet Maker

- A newly created complete 15-part Workshop Character in Puppet Maker
  now has **Preview Knee-Bending Walk** and **Preview Elbow-Bending
  Reach**, next to the existing Wave and Show still puppet controls.
  The SVG preview reports the current action, and every preview is
  short, repeatable and can be returned to the still puppet.
- Unlike a cosmetic CSS wobble, the same underlying **presetAnimation
  keyframes** driving the editable cartoon timeline now produce
  parented left/right alternating **knee/shin bends, ankle compensation,
  forearm swing and hand counter-motion** during Walk and Walk in place.
  The Point/Reach and Wave presets bend the true elbow and wrist.
  The effect respects each part's existing joint and parent chain,
  including the user's editable part dimensions and skin/outfit art.
- Complete workshop rigs opt in only when they already contain both
  forearms, hands, shins and feet. Pre-existing Sunny/simple five-
  or six-part rigs, incomplete custom rigs, separate painted assets,
  imported photos, and older one-piece workshop characters retain
  their original preset behavior. There is no migration.
- The preview deliberately **does not overwrite saved poses or
  keyframes**; select and apply the same Walk in place / Point / Wave
  actions in the cartoon animation timeline when you want those
  movements in the actual project and exported media. Saving the
  character saves its editable rig, not a surprise three-second clip.
- Focused unit tests prove left and right knee alternation, valid
  parented shin/ankle/elbow/wrist joint snapshots, determinism, neutral
  endpoints, preserved author positions and older rig fallbacks.
  Desktop/phone/tablet browser QA uses the real Puppet Maker wizard to
  play both actions, return to still and continue the original save.
- This is **keyframed 2.5D articulated cartoon animation**, not GPU
  skeletal mesh motion, motion capture or physically simulated cloth.

## PR #149 — Gentle weight shift and flatter stance boots in Puppet Maker

- Fresh, complete original workshop characters now add a tiny, repeatable
  torso weight transfer (up to 3 degrees) and opposite head counter-lean
  (up to 2 degrees) when using the shared **Walk** and **Walk in place**
  animation presets. This is visible both in Puppet Maker previews and when
  a creator intentionally applies those presets to an editable cartoon.
- During the stance half-cycle the articulated boot counter-rotates against
  its parent upper leg and body lean, bringing the sole closer to level.
  During swing it keeps a gentle toe lift. The existing alternating
  knee/shin and forearm poses from #148 remain.
- All added movement is bounded and eased to neutral at both ends.
  Authored scene x/y, frame timing, props, handoffs, audio, mouths, existing
  character artwork and save workflows are unchanged. The original
  Cinematic Storybook Stage foot-plant/IK solver is not duplicated or
  replaced; it can still apply its own sampled correction when enabled.
- This is an incremental **2.5D pose improvement**, not physically
  simulated ground contact or a guarantee of zero sliding on every custom
  puppet. Complete workshop rigs only; Sunny, incomplete rigs, imported
  photos and old saved projects have their previous action behavior.
- Focused tests verify alternating grounded stance angles, visible
  counter-lean, valid joint snapshots, neutral ends, deterministic sampling,
  unchanged stage positions and legacy compatibility. Before merge, run
  full Foundation/browser/media-export checks and visually inspect the
  real Puppet Maker walk for floating feet, ankle pops and face drift.

## PR #150 — Walk across the stage and settle naturally

- Complete original Workshop Characters created in Puppet Maker now show
  **Preview Walk Across Stage** alongside walk-in-place, reach, wave and
  still. The preview uses the same actual editable **Walk** keyframes
  available in the cartoon timeline, and moving across the preview does
  not save a new timeline, replace poses or change character artwork.
- The shared Walk preset now uses a bounded smoothstep travel curve for
  complete original 15-part workshop rigs only: it accelerates gently
  at the beginning and decelerates at the end while arriving at the same
  destination as before. A continuous 4px-maximum body bob replaces
  abrupt alternating 5px step jumps, landing at the original height.
- This builds directly on #148's knee/forearm motion and #149's stance
  boot compensation, without replacing Cinematic Storybook's existing
  foot-grounding pass or the project author's handoff, camera or sound.
- Older Sunny, incomplete workshop rigs, imported art and historical
  saved cartoons keep the exact previous Walk preset; other actions
  including Walk in place and Point/Reach are unchanged.
- Unit tests verify slow approach/departure, identical travel endpoints,
  smoothed body bob, legacy behavior and deterministic source-preserving
  frame evaluation. Desktop/phone/tablet browser acceptance now exercises
  the new preview action and the previous walk/reach/still sequence.
- This remains a manually editable **2.5D SVG cartoon**. It does not
  automatically create a photorealistic 3D rig, promise perfect no-slip
  soles or generate new scene content. Before merging, inspect both
  preview and genuine exports for feet leaving the floor, clipping,
  abrupt stop motion, character cropping and face/audio alignment.

## PR #151 — Bend knees, jump and settle naturally in Puppet Maker

- The original full-body workshop character now has **Preview Jump & Gentle
  Landing**, a short non-destructive sample in the same Puppet Maker action
  controls as Walk in place, Walk Across Stage, Reach and Wave.
- For complete original workshop rigs with actual parented thighs, shins,
  boots, upper arms, forearms and hands, the same shared **Jump** preset
  now creates thirteen real keyframed samples of a 3-second jump. The
  character briefly bends their knees and compresses before takeoff,
  rises on a smooth airborne arc, lifts both arms, then bends both knees
  again while settling after landing. The original position is restored.
- Joint movements are bounded and deterministic; torso/head counter-motion
  is small. All frames use existing rig parent relationships and the
  project's normal timeline, preview, Stage and media-export sampler,
  **not** browser-only CSS animation or a new character physics engine.
- Only complete original workshop rigs opt in. The preview eligibility
  now checks both hands and feet in addition to both forearms and shins.
  Sunny, partial workshop rigs, older serialized character saves,
  imported assets and other original preset types retain existing behavior.
- Tests cover the actual crouch, knee bends, arm lift, airborne height,
  landing, neutral endpoints, exact scene x preservation, joint validity,
  determinism, and legacy fallbacks. Existing cross-device Puppet Maker
  browser tests also check the new jump before the user saves a character.
- **Review before merge:** visually inspect the crouch, both boots, hand
  motion and final pose in the real preview and Stage; check face/lip-sync,
  props, saved scenes, Foundation/browser CI and independently decoded
  20-minute media exports. The result is still original **2.5D vector
  animation**, not true physics or photorealistic 3D.

## PR #152 — Real articulated victory celebrations

- Fresh, creator-owned 15-part Workshop Characters now have a
  **Preview Victory Celebration** action in Puppet Maker. It previews
  the SAME shared `Celebrate` preset used by the editable scene
  timeline and genuine video exporter, rather than a cosmetic CSS loop.
- A complete original workshop rig receives 13 deterministic samples
  of a three-second celebration: both upper arms rise, elbows bend,
  wrists move, knees and boots flex, and the torso/head sway subtly.
  Small rhythmic body lift is bounded to 15 stage pixels and settles
  to the original authored height and joint angles at both ends.
- The preview is temporary and does not automatically record or save
  a pose, alter characters, rewrite scene x positions, move props,
  change audio, change lip-sync or duplicate any project content.
- Old Sunny, partial workshop rigs, imported photos and previously
  authored cartoons keep the previous three-frame `Celebrate` preset
  and original joint behavior. The existing walk, jump and reach
  animations remain unchanged.
- Unit tests check parented shoulder/elbow/hand and shin movement,
  stage-height bounce, side-to-side body sway, deterministic seeking,
  exact neutral endpoints, valid joints, source immutability and
  legacy fallbacks. Cross-device Puppet Maker browser acceptance
  exercises celebration alongside walking, jumping and reaching.
- The result is still original editable **2.5D animation**, not
  true 3D, collision physics or motion capture. Before merge review
  real face/hand/foot artwork, ground contact, non-destructive
  previews and 20-minute independently decoded media export.

## PR #153 — Articulated full-body rhythm and dance

- Creators of complete original 15-part Workshop Characters can now choose
  **Preview Full-Body Dance** in Puppet Maker alongside walk, jump, reach,
  wave and victory celebration. The three-second preview shares the real
  `Dance` preset used by the scene timeline and actual video exports.
  Previews are temporary; no saved pose or authored animation is overwritten.
- The `Dance` preset for these rigs now samples **13 deterministic keyframes**
  instead of an abrupt nine-frame wiggle. Alternating beats bend the
  left/right thigh, shin and ankle joints while shoulders, elbows and hands
  move in rhythm. Small opposing torso/head motion creates a readable
  body sway, and a subtle vertical pulse reaches at most seven stage pixels.
- All stage movement is **in place**: original x position is unchanged,
  the y offset and stage rotation ease to their original values at both
  ends, and all joint angles settle back to neutral.
- Older Sunny puppets, incomplete custom workshop rigs, imported photos
  and historical characters retain their previous nine-frame `Dance`
  behavior. Jump, walk, reach, celebration, prop interactions, voice,
  lip-sync and existing stored projects remain unchanged.
- Focused tests cover alternating knees, both elbows/hands, torso/head
  counter-sway, height, original stage position, deterministic sampling,
  bounded and valid joint values, unchanged source data, neutral endpoints
  and exact legacy behavior. The desktop/phone/tablet Puppet Maker flow
  now previews the dance and still saves the same editable character.
- **Review before merge:** observe the actual animated knees, foot contact
  and body sway on screen; check legacy fallbacks, face/lip-sync and
  held props; run Foundation/browser checks and full independently
  decoded 20-minute media export. This is original editable **2.5D SVG
  character animation**, not 3D motion capture or a physics simulation.

## PR #154 — Natural sitting and standing for original workshop puppets

- Creators of complete original 15-part Workshop Characters now get
  **Preview Sit Down** and **Preview Stand Up** in Puppet Maker. Each
  three-second preview is temporary and uses the same real `Sit down`
  and `Stand up` presets available for authoring on the cartoon timeline.
- For these rigs only, the shared presets generate 13 deterministic,
  smoothly eased frame samples with both upper legs folding, genuine
  knee/shin articulation, ankle counter-rotation, small torso lean,
  opposing head stabilization and arm/forearm/hand movements.
- Sitting lowers the character by up to 20 stage pixels and leaves
  a saved-keyframe seated pose at the end. Standing starts with precisely
  the same seated joints and reverses them into the original upright pose.
  Both actions preserve the character's authored scene x position.
- The new angles are intentionally bounded, and parented shin/boot angles
  add up to flat boot orientation in the complete original workshop
  preset. **This is not chair collision or physical IK**: a creator still
  places their own seat prop and checks that the actor meets it visually.
- Only eligible complete original workshop rigs receive the new action
  keyframes; older Sunny, partial/custom puppets, imported images and
  historical saved scenes keep the original sit/stand action behavior.
  Walk, Jump, Dance, Celebration, voice, face, props and saves are unchanged.
- New unit tests verify middle and end positions, two actual knee chains,
  forearms/hands, neutral endpoints, flat boot angles, exact sit-to-stand
  reversibility, deterministic seeking and immutable scene source data.
  Desktop/phone/tablet browser acceptance covers both new previews.
- **Before merge:** check the real animation against a chair or bench,
  ensure legs do not clip into the seat, confirm both feet and hands
  remain plausible, review face/lip-sync and run Foundation/browser and
  full independently decoded 20-minute media export checks. This stays
  editable **2.5D cartoon animation**, not a true 3D character simulator.

## PR #155 — Sit on a real chair or bench in the scene

- After making a complete original 15-part Workshop Character, open
  **Edit scene → Characters & movement** and use **Add Workshop Chair**.
  Or, when a stationary original chair/bench prop already exists in that
  scene, choose it from **Seat in this scene**.
- **Align and Sit on Seat** is a user-triggered authoring action (not a
  surprise automatic migration). It positions the character so the actual
  final seated **upper-leg/pelvis pivot** is level with the selected
  chair/bench's illustrated seat top. It uses the existing prop drawings'
  seat dimensions and the actual articulated puppet rig transforms;
  the result is real **Sit down** timeline keyframes, not a static poster.
  The selected seat is set to the background layer to keep the actor visible.
- The helper creates the same 13 adjustable joint samples from PR #154,
  starting in a standing pose and finishing seated after three seconds.
  The rig, seat artwork, other actors, audio, script, camera and project
  identifiers are not overwritten. The edit uses the regular scene save
  and **Undo/Redo** pipeline.
- Existing animated characters, moving/rotated furniture and characters
  performing timed handoffs are rejected instead of overwriting work.
  Complete original Workshop rigs only; old Sunny, partial rigs and
  imported photos continue using their previous tools.
- This is **2.5D illustration alignment**, not furniture collision
  detection, pathfinding or a persistent joint constraint. If you later
  move the seat, you'll need to realign the authored animation yourself.
  Artists should visually check unusual sizes, leg/furniture overlap,
  mirrored characters and nearby props. Unsupported placements near
  stage edges show a clear error, rather than silently clipping.
- New pure tests check seat creation, chair and bench pelvis alignment,
  deterministic seated keyframes, no source mutation, untouched other
  props, rejection of existing motion, invalid rigs and rotated props.
  Desktop/phone/tablet browser tests add a real chair to a creator-owned
  character, align its animation, inspect saved project data and Undo.
- Before merging, run TypeScript, lint, unit and browser checks and
  a genuine independently decoded 20-minute video export. The owner
  must inspect the actual sitting animation and contact with chair/bench
  in Stage, not only the passing test assertions.

## PR #156 — Stand up naturally after sitting on real furniture

- In **Edit scene → Characters & movement**, after an original 15-part
  Workshop Character is aligned to an illustrated chair or bench using
  **Align and Sit on Seat** from PR #155, the new optional
  **Add Stand Up After Sitting** action extends the same animation track.
- The existing 13 keyframes (standing → seated in the first three
  seconds) are preserved **with their original IDs and values**.
  A stationary seated hold fills the time until the last three seconds;
  the existing `Stand up` action from PR #154 then adds 12 real
  articulated movement samples, ending in the original standing pose.
  A six-second scene plays sit → stand without an extra pause; an
  eight-second scene plays sit for 3s, rests for 2s and rises for 3s.
- The chair or bench, other characters, cameras, audio, script,
  interaction timing and all furniture layers are left intact.
  Every new keyframe is editable with the normal Stage timeline,
  Undo and Redo. The puppet rig itself and authored root x position
  are not rewritten.
- Safety: this action only accepts an **unaltered PR #155 seating track**
  on a complete original workshop rig and a still, aligned, upright
  original furniture prop. Hand-off interactions, custom-edited
  sitting animations, relocated chairs and scenes shorter than six
  seconds are rejected instead of having their timelines silently
  replaced. Other rigs and existing saved projects are unchanged.
- Focused unit tests cover scene lengths, chair/bench selection,
  hold duration, original sitting frame retention, neutral final
  joint positions, valid joints, unchanged source/seat objects and
  rejection of modified/duplicate motion. The desktop/phone/tablet
  browser workflow now creates a chair, sits, adds standing, inspects
  saved frames, and checks two separate Undo actions.
- **Review gates:** Foundation TypeScript, lint, Vitest and build,
  cross-device browser QA, full independently decoded 20-minute export
  and visual checks of hands, knees, feet and furniture contacts.
  This is editable **2.5D** puppet animation, not automatic collision
  resolution or a physical chair interaction simulator.

## Scope limits

This is incremental original **2.5D animation**, not full 3D skeletal animation, physics-based motion capture or guaranteed zero foot sliding on every custom rig. Corrections are intentionally bounded and may be insufficient for unusually fast authored translations. The Scout/Jo preset rigs do not yet include a separately articulated shin, so their visible improvement is foot stabilization rather than a knee-joint overhaul. Custom image-backed rigs remain untouched.

The original Little Fixers story is still **4:30** and later spoken lines still need original human recordings. A 20-minute *export technical fixture* is not a completed 20-minute cartoon.

Do not merge without passing the required GitHub checks and reviewing a real moving preview.

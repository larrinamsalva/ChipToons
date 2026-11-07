# Cinematic two-joint arms — PR #47

This adds **actual upper-arm + forearm joint aiming** to the existing
Cinematic Storybook interaction system, reusing the project's deterministic
two-bone solver rather than simply swinging the upper arm in one direction.

## What changes

When a puppet has a properly parented, illustrated-free `leftArm` +
`leftForearm` or `rightArm` + `rightForearm`, interactions can now
move **both shoulder and elbow** toward a nearby prop/partner. A child hand
part, if present, serves as the actual end-effector; otherwise the forearm tip
does. A saved grip offset is included. These positions are exactly the same
ones used by the actual `handAt` attachment and by stage rendering.

The same arm pose feeds the Stage, camera, handoffs, held object positions,
and WebM video exports. No wall-clock or unseeded random effects are used.

## Backward compatibility

- This is strictly opt-in **Cinematic Storybook** polish.
- Classic mode retains its previous single-arm gesture.
- Calm editor frames continue using the existing authoring behavior.
- Saved shoulder, forearm and hand keys always take priority.
- Missing forearms, wrong parent relationships, asset-painted parts, impossible
  reaches, non-finite inputs and extreme joint angles fall back to the
  previously working cinematic one-arm reach.
- Existing character rigs are **not silently upgraded or altered**. Scout
  and Helper Jo can use this when a genuinely parented forearm is authored
  for their vector puppets, without rewriting their earlier approved scenes.
- No audio, dialogue, project schema, saved keys or scene duration is changed.

## Validation

New `src/cinematic-arm-ik.test.ts` verifies precise hand/prop alignment,
grip offsets, mirrored/rotated/scaled stage coordinates, eased shoulder/elbow
movement, authored-pose priority and safe one-arm fallbacks. Merge requires
green Foundation/browser QA **and** the complete 20-minute export workflow.

This is deliberately **2D two-joint inverse kinematics in a 2.5D vector
renderer**, not a promise of photorealistic full-body 3D animation.

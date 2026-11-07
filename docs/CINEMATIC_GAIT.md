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

## Scope limits

This is incremental original **2.5D animation**, not full 3D skeletal animation, physics-based motion capture or guaranteed zero foot sliding on every custom rig. Corrections are intentionally bounded and may be insufficient for unusually fast authored translations. The Scout/Jo preset rigs do not yet include a separately articulated shin, so their visible improvement is foot stabilization rather than a knee-joint overhaul. Custom image-backed rigs remain untouched.

The original Little Fixers story is still **4:30** and later spoken lines still need original human recordings. A 20-minute *export technical fixture* is not a completed 20-minute cartoon.

Do not merge without passing the required GitHub checks and reviewing a real moving preview.

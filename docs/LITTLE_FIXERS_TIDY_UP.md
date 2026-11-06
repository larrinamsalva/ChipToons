# Little Fixers Club — Tidy Up Together (PR #38)

## Mission

Extend the original 3:30 Scout and Helper Jo story to **4 minutes 30 seconds** using two genuinely animated character-driven scenes. This installment teaches that safe repair work includes **putting plans away, keeping grown-up tools with grown-ups, clearing the work area, and parking a repaired toy**.

The earlier seven scenes, approved first-34-second Scout voice, puppet rigs, camera sequences and toy wheel's real loose-to-fixed transformation remain unchanged. No unsafe chair repair is shown; the chair stays marked out of use pending independent adult inspection.

## New original scenes

### 3:30–4:00 — Different people have different safe jobs

Scout the child walks across the workshop while holding a *picture checklist*, then places that paper plan on a **low table** through an actual editable `put` interaction. Independently, Helper Jo the adult walks with a **closed toolbox** and returns it to a **higher adult-only shelf**. The toolbox is never used or handed to Scout.

Both characters retain independent full-body alternating-leg and arm/head/expression keyframes. Their different props actually attach to their separately moving puppet hands and are released at different times and positions. The repaired big-wheel toy wagon stays parked out of their path. Three camera shots emphasize the proper storage locations; timed teaching labels say "SCOUT: picture plan" and "JO: adult-only toolbox."

Both scene lines are written but **not recorded**.

### 4:00–4:30 — Park the repaired wagon together

The same original toy wagon has its **`fixed-wheel` artwork** from the earlier safe large-snap-on-toy repair. It moves on independent x/tilt keyframes from the workshop toward a parking sign, while the independently rigged Scout and Helper Jo walk alongside it. The camera actually follows the moving wagon, and original timed wheel-rolling sound effects and a success chime accompany the performance. Both characters stop, point and wave when the toy is parked.

This is a playful end to the toy repair demonstration, **not** a test of the unsafe chair or the original 20-minute export fixture. These two new scene dialogue lines also await original human recording.

## Studio use and voice truthfulness

From the no-login dashboard select **Watch Scout and Jo tidy up (4:30)**. Existing demo projects and their buttons remain available.

The whole new story has **nine scenes**, durations `[34,26,30,30,30,30,30,30,30]`, totaling **270 seconds**. Original three lines have approved recorded audio and waveform-based mouth animation; **16 subsequent dialogue lines remain unrecorded**. The existing Finish the Little Fixers voices board recognizes this new template and should show **3/19 approved and 16 unrecorded**, with direct record/upload/approve/mouth/caption workflows. No synthetic voices, false lip sync or fake spoken captions are inserted.

The studio's separate 20-minute exporter benchmark proves *technical ability to render and decode a longer sample*, **not** a fully produced 20-minute Little Fixers episode. Real child-friendly original cartoon footage is 4:30 in this demo, with recorded dialogue needed after the 34-second opening.

## Test and release gate

- TypeScript/lint/unit tests/production build
- Desktop Chromium, phone, tablet, Firefox and WebKit production browser QA
- Verify two independent `put` interactions actually carry and release Scout's paper at child height and Jo's adult-only toolbox at a higher shelf, without changing each other's hands or prior scenes
- Verify both actors and the already-fixed wagon **all move independently** across the real 30-second final scene
- Verify truthful 3/19 approved voice status, project backup/reopen, original three approved voice takes, segment plans **60s: [60,60,60,60,30]** and **120s: [120,120,30]**
- Export and independently decode real fourth 60-second WebM part (two actual completed scenes, including tool return) and final fifth 30-second WebM part (wagon parking). Compare multiple decoded VP8 video frames and actual rolling effects in Opus audio
- Keep prior full-cartoon/export tests and 20-minute studio-engine checks enabled; visually review video artifacts and safety implications

**Do not merge automatically.** PR #38 stays in draft until required tests pass and the owner reviews merge readiness. GitHub Pages publishing is a separate main-branch action, not proof that a PR is merged.

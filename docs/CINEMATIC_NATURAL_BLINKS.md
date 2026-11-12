# PR #98 — Natural Cinematic Eyelid Blinks

## Goal
Make original Little Fixers Club cartoon close-ups less mechanical:
instead of instantly popping open eyes to thin line art, use a quick,
smooth **close → shut → open** motion when a character naturally blinks.

## Implementation
- Reuse the existing original Character ID–seeded blink periods
  (4.3s baseline, 5.4s secondary) so the scene's saved timing and
  character individuality stay deterministic.
- Eased eyelid closure and reopening last only a fraction of a second.
  The eye whites/pupils gently compress, the eyelid traces its short
  descent, and fully closed eyes use the existing line-art shape.
- No new blinks are triggered by a script or AI model; this is a
  visual transition on the existing time-based blink events.
- Existing **Cinematic Storybook** setting is the only opt-in.
  Editor Stage and genuine WebM use the same sampled SVG frame.

## Preservation
- Animation blink-off disables both procedural blink clocks.
- Classic style is unchanged; the existing face's eyes, nose, blush
  and authored smile/mouth drawing remain as before.
- Calm authoring renders bypass the entire cinematic facial pass.
- Image-backed eyes remain excluded from this procedural pass.
- Voice-mouth audio synchronization, hand poses, scenery, original PNGs,
  camera keys, project schema, and saved source remain unchanged.

Unit and actual Stage-render tests cover smooth opening/closing,
full closure, period looping, blink-off, asset-backed eyes, Classic
and calm opt-outs, unchanged mouth/voice values, deterministic seeking
and no source mutation. Merge manually after the latest Foundation
and full narrated-episode/genuine-WebM gates have passed.

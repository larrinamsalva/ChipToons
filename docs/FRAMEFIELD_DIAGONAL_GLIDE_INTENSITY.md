# PR #87 — Adjustable Diagonal Cinematic Glide Intensity

A new **Diagonal glide intensity** control appears when creating a
diagonal camera glide from **Finish My Cartoon → Guided Voice
Recording** or **Caption & Voice Timing Review**.

Choose one of three strengths:
- **Subtle:** 1.2× final zoom, smaller sideways/upward movement
- **Balanced:** 1.3× final zoom, the original PR #86 setting
- **Expressive:** 1.4× final zoom, a more pronounced move still inside the canvas

Use any of the four directions: up-left, up-right, down-left,
or down-right. Changing direction retains the intensity chosen.

The camera always starts from the original wide 1× view and eases to
its endpoint over the genuine scene duration. All 12 endpoint
combinations were intentionally chosen to fit inside the original
800×450 canvas. The whole move uses the same Stage, webcam/voice and
genuine WebM export systems: no new renderer and no alteration to
source PNGs, captions or recordings.

The selected strength is simply a normal existing CameraShot frame;
it introduces no new saved schema. It remains a draft until the
creator explicitly chooses Preview Shot or Preview Full Sequence
and presses Apply. Cancel leaves the original saved project intact.

Unit tests exercise all 12 direction/strength combinations, the
real camera samples, 21-point edge safety checks and nonmutation.
Desktop/phone/tablet browser tests import real numbered PNGs, choose
an Expressive down-right glide, change direction twice, review
the true Stage preview and explicitly Apply. Foundation/browser
and the genuine 20-minute narrated WebM proof must pass on the
latest commit before a person merges.

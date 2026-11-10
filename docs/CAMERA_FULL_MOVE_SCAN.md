# PR #82 — Full Camera-Move Artwork Edge Scan

## Why
A simple three-frame review (PRs #80–#81) can miss a pan or keyframed
camera excursion between the beginning, middle and end snapshots.
This optional full-move scan uses **21 sampled moments** spread across
the actual shot, calling the same Stage camera evaluator used by the
genuine WebM exporter. The last moment is inside the shot's half-open
interval, so an adjacent next shot isn't accidentally scanned.

## Creator workflow
Open **Direct My Cartoon Camera**, press Preview Shot or Preview Full
Sequence and enable **Show beginning, middle and end frames**.
Under the original 3-frame overview, the new scan reports how many
of the 21 times may expose outside the original 800×450 canvas.
If it sees a problem, it reports the sampled time with the greatest
visible out-of-bounds fraction and offers **Inspect worst sampled
moment in preview**, seeking the real scene player to that moment.
Use existing Compare with saved camera to check before and after.

## Preservation and limits
- This checks **sampled camera geometry**. It does not inspect original
  image pixels, identify a face being cut off *inside* the canvas,
  account for artwork deliberately extending beyond the canvas,
  or certify safety at every unsampled instant.
- The three existing true animated preview frames and captions stay
  unchanged; the 21-point scan runs only when the contact sheet is open.
- Seeking is preview-only, never writes to the project. It does not
  approve a camera shot; the creator must still press Apply explicitly.
- Existing shots, PNG source frames, subtitles, narration, audio, scene
  timeline, videos, WebM export code and backup files are not changed.

## Tests
Unit tests prove half-open sampling and an actual real camera track that
passes all three existing frames but exposes an edge between them.
Other tests ensure read-only behavior and safe scans. Desktop/phone/
tablet browser tests verify accessible status and existing review
before Apply. Keep PR draft until Foundation and full real 20-minute
export checks pass at the same commit; manual merge only.

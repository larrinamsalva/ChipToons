# PR #80 — Camera Motion Contact Sheet

## What it does

The real **Direct My Cartoon Camera** editor now offers an optional
**Show beginning, middle and end frames** checkbox after **Preview Shot**
or **Preview Full Sequence**.

It displays three snapshots from the **same animated Stage used by the
genuine WebM exporter** and, when present, the actual saved caption
overlay sampled at the exact same scene time:

- Beginning of the proposed shot
- Middle of the shot
- Just before its end (never the following shot)

This makes it easier to catch a face cut off at the opening, an unwanted
pan across text or a caption being obscured before choosing **Apply**.
The checkbox is off by default, so it adds no ongoing rendering cost
to the editor or actual media export.

## Creator steps

1. Open any **Direct My Cartoon Camera** shot (works with normal authored
   shots as well as imported-PNG cinematic push-in, side-pan and pull-back).
2. Press **Preview Shot** or **Preview Full Sequence**.
3. Enable **Show beginning, middle and end frames**. Check composition,
   cropped artwork and real timed caption overlays. Use the existing
   **Compare with the saved camera** checkbox to see the same three times
   with original/saved framing.
4. Make edits in the ordinary Camera Director, preview again and
   explicitly **Apply**. Cancel discards uncommitted edits.

## Preservation and verification

Only a client-side view and a pure sample-time function have been added.
No project migration, source changes, automatic render/export, extra
camera tracks, network calls or new video pipeline. Original character
motion, PNG frames, voice, captions and timeline still belong to the
same single Stage and existing genuine exporter.

Foundation checks include deterministic sampling, actual Stage
snapshots, no project mutation and browser checks for an ordinary camera
shot and a reviewed imported-PNG cinematic reveal. The UI uses
responsive columns, accessible labels and theme variables so scenes
are readable on phone/tablet and in dark mode.

Keep the draft unmerged until Foundation/browser and genuine
20-minute narrated episode WebM export checks pass on the newest commit.

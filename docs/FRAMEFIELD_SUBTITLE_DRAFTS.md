# PR #66 — Storyboard Subtitle Preview & Draft SRT

The existing Framefield-to-ChipToons workflow imports two or three real
numbered PNG animation shots, provides a local storyboard reel and lets
creators write scene titles, action notes and narration. PR #65 added
rough narration pacing guidance and an optional local recording cue sheet.

This incremental addition uses **only written narration** to preview
simple subtitles and export a real, independently editable **SubRip
(.srt) draft** for review before publishing.

## Creator workflow

1. On the dashboard, open **More ways to create · 3D, art, film & XR
   studio connections**, choose a multi-shot cartoon and select 2–3
   complete numbered PNG sequences.
2. Enter optional **Written narration** in the Story Beat editor under
   each shot. Shot titles and action notes remain separate.
3. In **Watch your shots in order**, the new **Written subtitle preview**
   shows the original, current shot's narration text. A shot with no
   narration displays **No written narration for this shot**. Preview
   text follows every scene cut and manual shot-order change.
4. Adjust original scene order or existing 0–3 second last-frame holds.
   Select **Download subtitle draft (.srt)**. The resulting real local
   file contains up to three numbered caption cues, each spanning the
   matching shot's exact start/end time. Shots without written
   narration create no cue; actual PNG files remain untouched.
5. Rehearse and **retime the subtitle draft to match real recorded
   speech** before publication or use in an external video editor.
   Importing a new cartoon still follows the existing tested path.

## Capabilities and limits

- This is a **draft script-to-subtitle timing helper**, NOT speech
  recognition, recorded audio alignment, automatically displayed
  captions inside a completed video, word-by-word timings, text
  animation, or an automatic YouTube upload.
- Text from each written narration is treated as one cue covering the
  entire existing scene duration. Long lines may be hard to read, even
  if PR #65's rough speaking-time estimate considers them acceptable.
  The user must edit, split and align cues to their actual performance.
- The existing `formatSrt` formatter is reused for standard
  `HH:MM:SS,mmm --> HH:MM:SS,mmm` timestamps. This local feature
  does not create media assets, modify `project.captions`, or alter
  native cartoon timings, stored clips, exports or backups.
- Captions are validated against **exact original shot prefixes** and
  existing length/control-character limits before download.
- Empty narration creates no cue and disables the draft download
  when all scenes are empty. File changes and import-mode changes
  still clear unsaved Story Beats, avoiding stale captions.
- No remote services, recording, synthesis, audio upload, login,
  server processing, or changes to previously merged scene animation.

## Tests and review

- Vitest compares original shot timings including reorders/holds,
  exact SubRip output, source scene-boundary preview, empty text
  removal, multiline normalization, invalid note rejection and
  unchanged source notes.
- Playwright desktop/phone/tablet QA downloads and reads the
  actual .srt, checks scene cut times, live caption preview and
  blank-shot/file-selection behavior.
- Require both **Foundation/browser QA** and the original
  **complete 20-minute narrated video/audio export proof** green
  on the latest PR SHA before human review and manual merge.
  Never automatically merge, publish or deploy.

## PR #67 — Review one or two caption cues per shot

In the optional **Subtitle cue review** panel, customize the first and second subtitle text per original PNG shot and move their split point between 20–80% of that scene. The local silent filmstrip preview and downloaded .srt reflect the chosen text, shot order and holds. **Use original narration** returns to the old one-cue behavior. The edits are not recorded speech, not saved project captions and not automatically placed into the final movie. See [Cue Editor](FRAMEFIELD_SUBTITLE_CUE_EDITOR.md).

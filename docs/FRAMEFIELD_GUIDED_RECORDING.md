# PR #71 — Guided Voice Recording for Imported Cartoon Scenes

The opt-in guide in **Finish My Cartoon > Caption & Voice Timing Review**
lets creators work through their actual numbered-PNG storyboard scenes,
including rearranged shots and final-frame holds.

## Workflow

1. Open an imported Framefield PNG cartoon in **Finish My Cartoon** and
   select **Start guided voice recording**.
2. Use **Previous scene** and **Next scene** to rehearse each scene's real
   narration/dialogue and inspect exact episode-relative caption intervals.
3. Select **Record or upload this scene**. The existing Voices & Sound Studio
   opens at that scene, displaying original written words. Only its
   **Start microphone recording** button requests microphone access.
4. Listen to the original take before explicitly saving an assigned clip.
   Uploaded voice files use the same validated source pipeline.
5. Return to Finish My Cartoon and reopen the guide to review timing
   coverage after the saved edit. Use the caption editor to correct cues.
6. Watch and listen to the finished film before publication.

## Guarantees and limits

- Only imported PNG projects display this guide; no existing cartoons,
  source images, saved captions, scripts or recordings are rewritten.
- No new microphone engine, storage schema, artificial voice synthesis,
  automatic speech alignment, publishing or edit to the 20-minute exporter.
- The guide's selected scene is temporary UI state, not saved progress.
- Assigned voice intervals are hints only, not proof that the clip contains
  matching speech, a valid recording or approved words.
- Users can choose intentional silent captions; no blocking of exports.
- Desktop/phone/tablet QA must verify scene order, held-frame time,
  recording handoff, preserved caption editing and local checklist export.
- Foundation checks and independent complete 20-minute real audio/video
  export proof must be green on the exact PR SHA before human review.
- Do not merge, publish, release or deploy automatically.


## PR #72 — Listen to saved voice sources

The guided scene now lists original narration/dialogue source files that overlap the current scene. Select a source and play the untrimmed original, even when its clip is muted in the final mix. This does not preview edit trims, fades, caption sync or final soundtrack. Use complete-cartoon preview to verify those. A saved source is not proof that it contains spoken or matching words.

# PR #68 — Optional Storyboard Subtitle Import into New Cartoons

After PRs #64–67, ChipToons creators can write scene narration, preview
original rendered PNG shots, customize one or two subtitle cues per scene,
and download a draft .srt file. PR #68 provides a **deliberate opt-in**:
put that same draft text and scene-relative timing in the **actual new
cartoon's normal editable caption tracks**.

## Creator workflow

1. On the dashboard open **More ways to create · 3D, art, film & XR studio
   connections**, enable **Build a multi-shot cartoon**, and select 2–3
   complete numbered local PNG animation sequences.
2. Write narration in each **Story beat** panel. Optionally review the
   first/second caption in **Subtitle cue review**, move its split slider,
   reorder shots, or add an existing final-frame hold.
3. The caption option starts **unchecked**. If you want the new cartoon
   to include these written draft captions in its editable scene tracks,
   check **Include drafted subtitles as editable captions in the NEW
   cartoon**. Otherwise, do nothing and use the old import behavior.
4. Select **Create multi-shot cartoon**. With the option checked,
   ChipToons validates the exact shot identities, cue timings and
   original text *before* decoding any large PNGs. Then it creates a
   brand-new cartoon with the existing standard `Caption` objects
   attached to the matching created scene IDs.
5. Continue editing, recording voices and inspecting captions in the
   standard ChipToons editor. The existing production caption renderer
   and SRT export understand these regular caption objects. Review,
   split, or retime them against the actual spoken audio before
   exporting or publishing.

## Important guarantees

- This is **explicitly optional**. With the box unchecked, the old
  multi-shot and single-shot paths create no new caption tracks.
  Previously saved cartoons, character rigs, assets, scene timing,
  audio assets, and 20-minute movie export code stay untouched.
- Imported caption text comes from the *actual* pre-import draft,
  including manual two-cue splits, reordering, final-frame holds,
  and intentionally blank intervals. Captions are mapped from exact
  storyboard absolute timing to per-scene local start/end times.
- Standard ChipToons editable captions limit each text to **280
  characters**. An opted-in caption longer than that is rejected with
  a helpful error *before any PNG decoding*. Text is never silently
  truncated, and opting back out allows the original long written
  narration to import without captions.
- The text is a **draft**, based on chosen shot boundaries and manual
  cue splits; no speech recognition, voice generation, recorded-audio
  synchronization or automated YouTube upload is claimed.
- No new backup schema, remote service, accounts, source image change,
  background rendering, or automated publishing is introduced.
- The imported cartoon is independently validated using the existing
  standard complete-project graph validator. The original builder
  project remains unmodified until the separate new project is created.

## Verification

- Unit tests assert that a reordered two-shot storyboard with a
  40% split and 1s ending hold produces exact normal scene caption
  tracks, same genuine SubRip timestamps, and unchanged PNG frame
  IDs, audio clips and narration; also check intentionally blank
  cues, malformed shot data and 281-character no-truncation rejection.
- Desktop, phone and tablet Playwright tests explicitly opt in,
  create a real new PNG cartoon, inspect the portable backup's
  actual caption tracks, test independent scene identity and audio,
  and confirm long caption errors permit retry or opting out.
- Require **Foundation/browser QA** and **complete 20-minute genuine
  narrated video/audio export** checks green on the latest PR SHA.
  Human review and manual merge only.

## PR #69 — Check caption intervals against assigned voice clips

Open **Finish My Cartoon** on a new imported Framefield PNG storyboard to see a **Caption & Voice Timing Review** for each scene and caption. The report flags captions without overlapping assigned voice clips or written scenes with no actual recording. Existing voice/caption editor links let you review without changing project data automatically. This is only a **timing-coverage hint**: listen manually because clip overlap does not prove actual spoken words match the caption. See [Voice Timing Review](FRAMEFIELD_CAPTION_VOICE_REVIEW.md).

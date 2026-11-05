# Scout Walks and Talks — the voiced full-body cartoon pilot

**Purpose:** take the 34-second original SVG/full-body acting pilot from PR #30 and give it **real recorded dialogue, waveform-driven lip sync and timed captions**, without altering the silent pilot or claiming the 20-minute episode is complete.

## Open and view the cartoon

On the ChipToons homepage, choose **Watch Scout walk and talk**. This creates a separate, editable 34-second cartoon project, which you can preview, export and back up. **Try the full-body cartoon workshop** still opens the unchanged silent walking/acting pilot.

## What's genuinely on screen

- Scout is a **native full-body vector puppet**, not a photo or pasted example poster. The character walks into a layered 2.5D workshop with left/right leg movement and opposing arm action, stops, turns toward the safe bench, and points.
- Scout wears a **teal workshop top, olive cargo-style pockets, a tool belt, and black work boots**. The studio's original SVG puppet renderer draws the costume with editable art primitives.
- The new voice is **not newly synthesized or falsely attributed to a different performer**. We reuse three of the original, already-approved Little Fixers recordings from PR #25: `welcome-1.mp3`, `welcome-2.mp3`, and `bench-1.mp3`. The script uses the **exact same words as those recordings**.
- The same voice analysis and mouth animation system used by PR #25 reads these **real audio recordings** and assigns distinct waveform tracks to Scout's face.
- Captions are created from the three approved dialogue lines and synchronized with the actual clip positions.
- The workshop has audible footsteps, ambience, success effects, and camera framing. The full project has **six audio assets** (three existing effects and three voice recordings), well within the engine limits.

## Boundaries and future work

This is a **34-second proof of a talking original 2.5D cartoon character**, not a newly acted script or a true 3D mesh/film-quality scene. Existing source audio is being reused intentionally; all copied performances must keep their approved wording and clearly credit the production's existing voice source. No new ElevenLabs, web TTS, external voice service or invented cast approval is involved.

The original Episode 1 opening from PR #25 and its follow-on motion through PR #29 are preserved. The complete 20-minute Episode 1 remains in-progress: the 1:59 original is voiced, later animated sections still need new original voice recordings, and the remaining minutes need actual character performance. **Do not silently replace these scenes with Scout or claim the finished show exists yet.**

## Verification

- Browser tests inspect the actual puppet animation, three approved recordings, three waveform-driven mouth tracks, captions, speaker/clip references, original project backing file and true device-safe duration.
- A video test exports actual 34-second VP8/Opus WebM; independently decodes and compares moving frames, measures audible recorded speech at separate moments, and checks the YouTube SRT captions.
- All Foundation, desktop/mobile/tablet and full-length studio export regression checks stay enabled. This PR remains unmerged until all relevant checks have passed and the visual performance is reviewed.

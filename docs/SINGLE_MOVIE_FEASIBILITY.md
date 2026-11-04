# Single-movie feasibility and verification

## Existing systems reused

| Existing system | Role |
| --- | --- |
| `FinishCartoon`, `SegmentExports`, `segments.ts` | The existing export settings and whole-scene plan produce the numbered WebMs. Export still uses the original frame renderer, mixer and recording limits. |
| `EpisodeDelivery`, `episode-delivery.ts`, `delivery-bytes.ts`, `delivery-zip.ts` | The existing delivery list, order, file assignment, export receipts and SHA-256 checks identify each input. Movie assembly checks the same bytes again. The ZIP remains independent. |
| `webm.ts`, `video-export.tsx`, `DeliveryPlayer` | The existing container reader identifies the source format, the browser verifies playback and seeks on the finished file, and the existing player previews it. |
| `audio-engine.ts`, `production.ts` | The mix already in the WebM is the source. The original mixer stays unchanged. Shared caption formatting produces one SRT mapped to the assembled movie clock. |
| Project storage and complete backups | The worker reads selected finished files and writes a temporary local result. Editable scenes, IndexedDB version 6, original recordings and project backups stay unchanged. |

## Approaches considered before building the interface

| Approach | Finding |
| --- | --- |
| Remux all tracks as encoded packets | A new WebM segment, rebased video timestamps and regenerated seek cues work for the VP8 track. Standalone Opus tracks can each have encoder delay, pre-skip and padding. Simply copying each independent Opus stream onto one track lacks a reliable way to preserve these boundaries across players. |
| MediaSource, native playback and recorder APIs | MediaSource can queue playback segments. It does not create a downloadable, indexed file. Capturing that playback back into MediaRecorder would re-encode the picture in real time and depend on the playback clock. |
| WebCodecs and a local muxer | **Selected.** Copy VP8 packets without re-encoding, decode each Opus source with its own decoder, and feed its samples onto one continuous 48 kHz stereo Opus encoder. Mediabunny rebuilds the WebM headers and seek cues on a seekable temporary file. The worker also decodes each complete video source, closing frames immediately. |
| FFmpeg/WASM | Native FFmpeg is the independent checker. Bundling the full WASM runtime would add a much larger asset and require a separate filesystem and browser memory study. The tested path needs no WASM, cross-origin isolation or remote processor. |
| Render one video directly | This would go through the existing renderer again in real time for the full episode, exceed the established recording envelope, and require the editable originals. Joining the already completed exports avoids all three constraints. |

[Matroska timing, CodecDelay and SeekPreRoll](https://www.matroska.org/technical/elements.html) · [Mediabunny packet interface](https://mediabunny.dev/guide/packets-and-samples) · [Seekable StreamTarget](https://mediabunny.dev/api/StreamTarget)

## Timing, memory and deployment

- The first version accepts original Chromium VP8 recordings at 800 × 450 or 1280 × 720 with the same export settings. All parts must have the same sound setting. For voiced files, the input is 48 kHz stereo Opus. VP9, Vorbis, other WebM writers, mismatched frame rates and discontinuous timestamps are rejected.
- Each part starts on a keyframe. Copying packet payloads and their relative timestamps preserves the original drawings, camera motion, mouth animation and any drawn captions. Source audio is decoded with its own Opus pre-skip. The supported Chromium format does not depend on arbitrary mid-file discard padding. The worker preserves the decoded audio and short recorder lead/tail, joins at integer milliseconds, and emits one audio track with one initial encoder delay. Encoding again can slightly change the sound. It does not reapply gain, normalize it, or remix sources.
- The movie retains the source timing. It can run roughly 0.15–0.2 seconds longer per part than the storyboard because each numbered export already includes that short lead-in. The SRT uses the actual join offsets and the exporter’s nominal 150 ms lead. A file differing from its planned range by more than 0.3 seconds is rejected. Browser-verified output must be within 0.06 seconds of the assembled clock.
- The worker reads file slices, keeps at most an 8 MiB input cache for the current part, and writes with 1 MiB chunks and backpressure. Decoders and the muxer also use internal memory. Neither the complete compressed output nor the decoded episode is accumulated in JavaScript memory. Storage is checked before assembly, with headroom for two copies of the estimate plus 32 MiB. Source video and output are each capped at 256 MiB. The tested path is for up to 20 planned minutes.
- The first version is available on supported larger Chromium layouts. A narrow screen or a reported memory tier below 4 GiB offers the existing playlist and ZIP. Browser APIs and available space still determine whether assembly can start. Automated viewport coverage does not establish physical tablet or phone performance.
- No media leaves the device. The library ships in an on-demand worker from the same GitHub Pages origin. The initial website and worker assets must be available. The approximately 319 kB minified worker is approximately 81 kB gzip. No service worker or offline installation is required for local processing after loading.
- Temporary media lives in origin-private browser storage. Failed or cancelled jobs remove their staging file, and active previews hold a lease. After a download starts, the temporary copy is given time for the browser to read it. A later build can clear abandoned staging files more than 24 hours old after checking they are idle. The cleanup touches only the builder’s temporary directory.

## Feasibility evidence

The two-part gate used the genuine PR #13 export of **Kindness in two little parts**, with animated original artwork, a voiced line spanning the join and continuous original music. The Chromium prototype downloaded one 8.38-second VP8/Opus WebM. FFmpeg decoded all 122 source frames in order. The six sampled audio windows had no measurable delay at 8 kHz, and correlation was at least 0.9996. Chromium reopened the download, sought on both sides of the transition and played across it.

The full gate used the ten original PR #13 exports of **Mia and Pip’s Garden of Welcome**, verified against their delivery SHA-256 hashes. The prototype wrote one 1201.72-second VP8/Opus WebM. FFmpeg decoded all 18,000 frames in order, and FFprobe confirmed strictly increasing per-track timestamps and a keyframe at every join. Seventy sampled audio windows covered all scenes and both sides of all nine joins. The smallest correlation was 0.9996, gain ratios ranged from about 0.987 to 1.010, and no sample delay was measured at 8 kHz. The saved file reopened, played and sought at 20 locations in Chromium. The recorded lead-ins account for the difference from the planned 1200 seconds.

The built delivery interface independently reproduced the 1201.72-second result using these ten files. Cancellation during the first part recovered cleanly, and retry completed. The automated production proof repeats these checks through the actual download control, using ten newly exported videos. It retains the prior editable restore, playback, independent segment and package checks. [PR #13 source exports](https://github.com/larrinamsalva/ChipToons/actions/runs/41769598894/artifacts/13294898600)

[Short delivery-interface measurements](single-movie/short-movie-verification.json)

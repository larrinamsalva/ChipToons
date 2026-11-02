# Finish your first talking cartoon

The production steps stay inside the storyboard editor: **Story → Artwork → Animation → Voices & Sound → Preview → Export**. Everything is local by default. No account, subscription, speech API or screen-recording permission is needed.

## Try the finished friendship story

1. Choose **Try a demo cartoon** on the dashboard. A fresh copy has six animated scenes, three original sample speech clips, a gentle looping melody, a sparkle effect and ten timed captions. Existing saved copies are preserved.
2. Open **Voices & Sound**. Choose a clip to listen to its original recording. **Preview with cartoon** plays the actual trimmed, mixed clips with the animation. The original sample speech was created offline with Flite; it is deliberately simple synthetic speech, not a recording of a real actor or an imitation of a licensed character.
3. Choose **Finish My Cartoon**, review the scene count, running time, voices and captions, and preview the complete episode. Some scenes intentionally use music and written captions rather than recorded narration; the review calls out those missing voice assignments.
4. Leave **WebM · VP8 + Opus**, **800 × 450**, **15 fps**, audio and captions selected. Press **Export complete cartoon** and keep the tab visible for about one minute. This records only the cartoon stage, using the same animation sampler as preview.
5. Wait for **Your movie is ready**, play it in the review panel and choose **Download completed video**. Keep a **portable project** too: the movie is a finished viewing copy; the project contains editable motion, original artwork, voices, trim settings and captions.

## Add your own voices and sounds

Choose a scene and seek to the desired moment before opening Voices & Sound. Pick **narration**, **dialogue**, **music** or **effects**. Dialogue can be associated with a character. That association labels a voice; it does not automatically synchronize the character's mouth.

**Start microphone recording** requests microphone access at that moment. Use HTTPS (GitHub Pages) or localhost. A visible indicator and elapsed time appear while recording. **Stop recording**, closing the dialog, leaving the editor or reaching 60 seconds releases microphone tracks. Listen to the draft, give it a name and explicitly **Save audio clip**, or cancel the draft. Recordings are normalized to a mono WAV for portable playback and backups. They are never uploaded automatically. Permission denial leaves upload available.

**Upload voice, music or sound** opens a WAV, MP3, Ogg or audio WebM that the current browser can actually decode. Files must have matching signatures and readable finite duration. A streaming WebM with no duration metadata may need conversion to WAV first. Uploads preserve their original bytes. No automatic transcription, subject extraction, remote voice generation or voice cloning is provided.

The original sound collection includes Kindness melody, footsteps, a door, synthesized laughter, applause, sparkle, wind, rain, birds, a notification and a gentle transition. These are small programmatically synthesized sounds, not recorded commercial music. They are made for reuse in ChipToons cartoons. Add them at the playhead, then adjust their exact timing.

**Browser voice preview (not exported)** offers installed browser voices and rate controls when available. This convenience preview is separate from the cartoon mix. Record or upload a clip to put speech in the downloaded video. An empty voice list is normal on some devices.

## Place and mix clips

Four duration-based audio rows share the animation ruler and playhead. Drag a clip left or right; snapping follows the existing timeline setting. Focus a clip and use left/right arrows for the same operation. Click a clip or its row label to open the sound inspector. **Audio clip** provides a selection alternative when clips overlap.

The inspector has exact numeric start, play length, trim start/end, fades, volume, mute and loop controls. Enter or leaving a numeric field commits; Escape cancels that field's unfinished edit. Trim settings change playback without destroying the original source. Listen to **Original audio source** for the unchanged file, and use cartoon preview to hear trim, fades and mixing.

- **Anchor clip to a scene** uses time relative to that scene. Reordering scenes moves their voices and effects with them. Changing a scene's duration proportionally retimes clip start and caption windows; playback lengths/fades are shortened only as needed to fit. Sources are never stretched or resampled to match a scene.
- **Complete episode** uses global time. Music can cross scene boundaries uninterrupted. Enable **Loop trimmed source** and extend play length to fill the episode. Looping uses the trimmed interval, not the entire original file.
- The **Cartoon mixer** controls master, voice (narration and dialogue), music and effects, plus a master mute. A gentle compressor reduces clipping when sources overlap.
- **Replace selected audio** retains the earlier source in Sources. Removing a timeline clip also keeps its source. An unused source can be removed explicitly with confirmation; a previously downloaded backup keeps its own copy.

Pause preserves the playhead. Seeking, changing scenes or editing stops the old scheduled audio; the next Play schedules the correct trimmed offsets. With Sound enabled, visual preview uses the Web Audio clock. Scene looping schedules the mix at the same loop boundaries. **Sound off** is useful for quiet visual editing. **Calmer preview** is an editing accommodation and never rewrites the saved movie.

## Create timed captions

Open **Timed captions**. Generate an initial track from written scene narration/dialogue, add a caption at the playhead, or edit an existing caption's words and start/end. Regenerating an existing track asks before replacing it. This is text drafting, not speech recognition; listen and adjust timing to match a recording.

Choose 18–32 px text, top or bottom, and white or warm yellow over a dark plate. Preview and video show up to four readable lines; keep individual captions short. The SRT download retains the complete caption wording and global millisecond timings. Video captions are optional and are burned into the picture; the separate SRT remains editable and can be used by another video player.

The original shape mouth controls remain manually timed. Put a **Talking cycle (silent)** keyframe at a dialogue start and Closed or Smile at its end. The label describes the mouth animation itself; recorded audio plays from its separate clip. Uploaded raster characters retain whole-image movement.

## Export formats and limits

| Feature                  | This release                                                                                              |
| ------------------------ | --------------------------------------------------------------------------------------------------------- |
| Microphone capture       | Capability-detected WebM/Opus or Ogg/Opus; saved as portable mono WAV                                     |
| Audio import             | WAV, MP3, Ogg and audio WebM after MIME, signature, duration and actual decoding checks                   |
| Video                    | Real WebM, VP8/Opus or VP9/Opus when MediaRecorder reports support                                        |
| Movie sizes              | 800×450 at 15 fps; wider screens also offer 1280×720 and 24 fps                                           |
| Phone export             | Up to 60 seconds, 800×450 at 15 fps                                                                       |
| Desktop/tablet export    | Up to 120 seconds; keep the tab visible and device awake                                                  |
| Recording/output budgets | 60-second microphone takes; 80 MB maximum encoded movie                                                   |
| Project media            | 12 MB and 120 seconds per uploaded audio source; 24 sources and 300 seconds total decoded source duration |
| Timeline                 | 240 clips, up to 24 simultaneous clips, 1,000 captions                                                    |
| Portable backup          | 64 MB total JSON, including base64 artwork and audio; image limits remain 4 MB / 24 megapixels per source |

The exporter preloads images and audio, mixes to a Web Audio recording destination, renders Stage SVG into a canvas at sampled times, and records actual canvas frames. Audio and pictures share a single clock. A short initial buffer lets both tracks begin together. Streaming WebM receives duration metadata so players can display its length. The completed file must load and begin video playback before the app reports success.

Cancel stops encoding and releases media tracks, audio nodes, contexts and temporary URLs. Closing the review also cancels. Encoder errors, an inactive tab, damaged media, interrupted timing, excessive size or a device rendering too slowly produce an explanation. Export never edits the project. Keep a project backup and retry a shorter movie at 800×450 / 15 fps. A browser without the required exporter still has project, SVG storyboard and SRT downloads. MP4 and offline/accelerated encoding are not implemented.

## Save, restore and compatibility

Projects use schema **4**, with explicit **1 → 2 → 3 → 4** migrations. Older stories keep their IDs, positions, artwork, durations, legacy movement and keyframes. The final migration adds empty audio/caption tracks and default mixer/style settings; it does not silently add the demo's speech to old work. IndexedDB remains at database version 2 and preserves its existing projects, library and palette stores. Migration runs on a detached copy and is saved only on a successful later write.

Each project embeds every audio source, even when a clip was removed or replaced. Portable backups can reopen without the browser's art library. Graph validation rejects duplicate IDs, missing source/scene/character references, malformed signatures, unknown versions, invalid timing, non-finite values and excessive media. Actual browser decoding happens before playback/export. Imported backups open as separate projects.

Wait for **Saved on this device**. Low available storage shows a warning; quota errors keep the open cartoon and give backup/retry controls. Download a backup before clearing site data. Base64 adds about one third to media size, so a 12 MB source occupies roughly 16 MB in JSON. Delete unused sources deliberately, shorten original files outside ChipToons when necessary, and keep larger stories as separate editable episode projects. One editor tab per project is recommended; cloud sync and cross-tab conflict resolution are not implemented.

## Verification and remaining work

The suite includes genuine Chromium MediaRecorder exports, browser playback/seek, FFprobe stream/duration/frame inspection and FFmpeg decoding with non-silent PCM measurements. Desktop, phone and tablet automation exercises recording permission success/denial, track cleanup, upload/trim, seek/resume, continuous music, caption timing/SRT, backups, quota recovery, cancellation/errors and light/dark accessibility. Microphone automation uses Chromium's synthetic test device, never a person's microphone.

Live Chromium also exported the complete 60-second demo and FFmpeg decoded its VP8 frames and Opus mix. Firefox and Safari have not been manually verified, and no export compatibility claim is made for them. Testing mobile layouts in Chromium does not prove physical iOS microphone or export behavior. PR #5 should focus on real-device/browser coverage, longer-project performance, richer original sound/voice material, smoother editing, and improved export recovery. Automatic lip-sync, transcription, voice cloning, MP4 and backend services remain outside this release.

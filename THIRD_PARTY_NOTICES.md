# Third-party notices

- **DM Sans** (via `@fontsource-variable/dm-sans`) is bundled under the SIL Open Font License, version 1.1. See `public/licenses/dm-sans-OFL.txt`.
- **Outfit** (via `@fontsource-variable/outfit`) is bundled under the SIL Open Font License, version 1.1. See `public/licenses/outfit-OFL.txt`.
- React and React DOM are distributed under the MIT license. Their package license texts remain in the npm distributions.

Font files are bundled locally. Loading the application does not contact Google Fonts or Fontsource.

## Original demonstration speech

`src/demo-voices.json` contains three original short WAV utterances generated offline with FFmpeg's Flite filter and the generic `kal` voice. No Flite executable, voice model or FFmpeg binary is shipped in the website. This is synthetic sample speech, not voice cloning or browser speech-synthesis capture. The text and generated sound collection were created for ChipToons and may be reused with its cartoons.

Reproduce the sample WAVs with FFmpeg built with libflite:

```sh
ffmpeg -f lavfi -i "flite=text='Pip notices a lonely friend. A kind hello can make a day brighter.':voice=kal" -ar 24000 -ac 1 -c:a pcm_s16le narrator.wav
ffmpeg -f lavfi -i "flite=text='Hi Sunny. Would you like to play with me?':voice=kal" -ar 24000 -ac 1 -c:a pcm_s16le pip.wav
ffmpeg -f lavfi -i "flite=text='Thank you for making room for me.':voice=kal" -ar 24000 -ac 1 -c:a pcm_s16le sunny.wav
```

Flite is by the Language Technologies Institute, Carnegie Mellon University, Alan W Black, David Huggins-Daines and contributors. Its permissive copyright notice is retained in `public/licenses/flite.txt` as attribution for the offline tool. This attribution does not imply endorsement. Original synthesized music and effects are implemented in `src/sounds.ts` without third-party recordings.

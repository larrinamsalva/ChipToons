# Little Fixers Club · Episode 1 animated opening

Open **Turn My Picture Into a Cartoon → Use the Little Fixers Club poster → Open Episode 1 animated opening**. ChipToons creates an editable 1:59 cartoon for ages 4–7. The workshop demo and 20-minute storyboard have their own choices in the same picture panel.

| Time | Scene | What viewers see |
| --- | --- | --- |
| 0:00–0:15 | Something wobbles | The host moves her head and arm independently. The chair rocks with a wooden sound and the host reacts. |
| 0:15–0:30 | Set the chair aside | The chair is clear of the work area. The host points it out and asks viewers what they notice. |
| 0:30–0:45 | Look closely at the joint | A detail shot and a circle identify the place where the chair back meets the seat. |
| 0:45–1:00 | Wait for a trusted grown-up | The host teaches the safety rule and introduces “Fix it, don’t toss it!” |
| 1:00–1:08 | Episode title | An editable title card and original melody introduce the club. |
| 1:08–1:25 | Welcome to Little Fixers Club | The host leads “Look, stop, and ask” with three teaching labels. |
| 1:25–1:43 | Pick the safe choice | Viewers choose between sitting and asking a grown-up. A quiet thinking pause gives them time to answer before the host reveals the safe choice. |
| 1:43–1:59 | Get ready at the workbench | The host gestures toward the bench and previews the Safety First segment. |

## Edit and export

- **Puppet Maker** and the animation timeline use the poster’s workshop host, separate head and arm artwork, and reusable chair. The editable world uses existing shelves, a bench, and a toolbox.
- **Script & Voice Director** contains 17 individual approved sample takes. They are original synthetic speech generated offline with FFmpeg and CMU Flite’s `slt` voice. Voice-to-Mouth uses each take’s decoded audio envelope. You can replace takes and review captions before exporting. [Attribution](../THIRD_PARTY_NOTICES.md)
- **Finish My Cartoon** can render the opening as one WebM on a supported larger screen. A 60-second segment limit produces parts of 1:00 and 0:59. **Prepare for YouTube** uses the existing verified movie and caption workflow for manual upload. [Publishing guide](YOUTUBE_PUBLISHING_KIT.md)
- **Project backup** keeps the source poster, scenes, puppet parts, sound, and captions editable. The opening stops at the workbench handoff. The remaining episode beats are in the editable storyboard.

To reproduce a sample recording, put one line from the [opening script](../src/little-fixers-opening-script.ts) in `line.txt` and run FFmpeg with libflite.

```sh
ffmpeg -f lavfi -i flite=textfile=line.txt:voice=slt \
  -af atempo=0.91,volume=1.12 -ar 24000 -ac 1 -c:a libmp3lame -b:a 40k line.mp3
```

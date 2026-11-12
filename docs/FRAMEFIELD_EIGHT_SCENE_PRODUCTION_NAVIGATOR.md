# PR #94 — Eight-Scene Production Navigator

## Why
After PR #93 expanded original numbered-PNG imports from 3 to 8 independent
scenes, sequential Previous/Next recording steps became tedious. The
existing editor already knows which scenes have written narration,
assigned audible voice clips and timed captions. A small review navigator
gets the creator to the scene that needs attention, without changing it.

## Creator workflow
1. Open a local imported multi-shot cartoon and select **Finish My Cartoon**.
2. Expand **Guided Voice Recording**.
3. Under **Jump to a scene that needs review** choose an exact scene from
   the dropdown or click:
   - **Next scene without assigned voice:** a scene with written narration
     or dialogue but without an assigned audible voice interval.
   - **Next scene without timed captions:** a scene with authored words or
     assigned voice but no caption cues.
   - **Next scene with caption timing gaps:** a scene whose captions do not
     overlap assigned audible voice at all or overlap for only part of
     their time. This may be intentional.
4. Each shortcut starts *after* the current scene and wraps to the front.
   If only the current scene matches, it stays selected. When none match,
   the corresponding shortcut is disabled.
5. Use the existing **Record or upload this scene**, **Review this
   scene's captions**, **Open this scene with picture and mixed sound**
   and genuine WebM clip preparation buttons.

## What this does not do
- It does **not** listen to speech, compare words to recordings,
  detect missing audio files, certify synchronization or approve exports.
- Intentionally silent scenes are valid. Assigned-interval coverage
  does not prove audible spoken words; the real mixed-sound preview
  still requires human review.
- It adds no schema, account, registration, audio synthesis, backend,
  camera changes, PNG replacements, recording mutations or publishing.
- Changing review selection never writes the project and clears
  only the temporary source-selection control for the previous scene.

Pure tests cover 8 scenes, fast wrap-around, isolated missing-voice,
missing-caption and uncovered-caption cases, zero-match disabling and
no project mutations. Desktop/phone/tablet browser tests create genuine
eight-scene PNG cartoons, navigate across distant scenes, return to the
start, and verify original project backups are intact.

Manual merge only once both Foundation/browser and 20-minute genuine
media-export checks pass on the latest PR commit.

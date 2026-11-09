# PR #70 — Recording To-Do Sheet for Imported Storyboards

ChipToons' real numbered-PNG storyboard creator can bring editable caption
drafts into a new cartoon (#68) and display assigned voice-clip coverage
inside **Finish My Cartoon** (#69). This increment adds a simple way to take
that review into a real recording session: a plain-text checklist downloaded
on demand from the **current**, actual imported cartoon.

## Creator workflow

1. Open your original multi-shot PNG cartoon and select **Finish My Cartoon**.
2. In **Caption & Voice Timing Review**, choose
   **Download recording to-do sheet (.txt)**.
3. The local text file records each scene in its current order with its
   actual episode start/end times, complete written narration and dialogue,
   caption text and exact time intervals, counts of assigned voice clips,
   and concrete recording/review actions where voice or captions are missing.
4. Use **Review voices for scene** to record or assign your real voice and
   **Review captions for scene** to edit written captions. You can download
   an updated checklist after any edits and compare manually.

## Accuracy and preservation

- The report is a **snapshot** of the *currently loaded project*.
  It does not edit a project, save a new field, record speech, generate
  synthetic voices, access microphones or upload anything.
- Times are the real scene and caption time intervals from the existing
  production model; no false word-level timestamps, auto speech
  alignment or claims of having a finished recording are introduced.
- A caption overlapping an assigned, unmuted clip is marked as
  **needs listening and confirmation**, not automatically "approved".
  A music/effects clip never counts as narration. Existing Episode
  Readiness separately checks whether original audio sources are present.
- Even with no recorded voice, intentional silent text is allowed.
  The checklist never blocks movie export.
- Original Framefield PNGs, existing cartoons, voice takes, captions,
  portable backups, saved project schema, full 20-minute episode
  workflow and genuine WebM exporter are untouched.
- The button appears only in cartoons with
  `templateId === "frame-sequence-storyboard"`, where the PR #69
  review already appears.
- This is not an automated publishing system, an audio processor, or a
  replacement for watching/listening to the finished children’s cartoon.

## Verification and merge requirement

- Unit tests verify exact ordered scene and caption times after a
  reordered shot + 1-second hold, actual written words, read-only
  behavior, incomplete narration, genuine clip interval vs muted
  voice/music, missing captions and refusal to report unrelated projects.
- Desktop, phone and tablet browser QA downloads the actual .txt file
  and checks its contents, retains the original editable cartoon and
  verifies the existing caption editor link still works.
- Require green **Foundation/browser QA** and **complete genuine
  20-minute narrated episode and real video/audio export** on the
  latest PR SHA before human review and manual merge.

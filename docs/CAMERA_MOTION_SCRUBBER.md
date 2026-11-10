# PR #83 — Camera Motion Timeline Scrubber

The real Camera Director now offers a touch- and keyboard-accessible
**Camera motion scrubber** below the existing live animated preview.
It works for regular authored shots, original PNG push-ins, side-pans
and close-to-wide reveals.

1. Choose **Preview Shot** or **Preview Full Sequence**.
2. Drag the shot timeline or focus it and use arrow keys to seek the
   genuine Stage frame. Captions update to the same exact time.
   The existing number field and Play/Pause remain available.
3. When **Show beginning, middle and end frames** is enabled, the
   21-point canvas safety scan marks any risky sampled moments along
   the timeline. **Previous risky moment** and **Next risky moment**
   jump to the adjacent flagged checkpoint.
4. Review visually. Explicitly **Apply** to save any camera edit or
   **Cancel** to discard it. Scrubbing and warnings never mutate the
   project or approve a camera change.

The slider uses the same half-open timeline as the camera contact sheet
so it never accidentally samples the next shot. It stops preview audio
before seeking to avoid desynchronization and resumes audio only after
the user presses Play again. The markers indicate sampled camera
geometry—not a pixel-level picture assessment or proof every
unobserved instant is safe.

This is a small client-side control over the established PlaybackClock.
No new animations, source frame modifications, automatic exports,
network activity or changes to the real Stage / WebM renderer. Existing
projects, characters, voice recordings and backups remain untouched.

Review gates: types/lint/unit/build, real desktop/phone/tablet browser
flows and the independent full 20-minute narrated episode with 10
genuine WebM pieces. Manual PR merge only after latest head passes.

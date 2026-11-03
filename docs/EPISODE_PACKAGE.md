# Episode package version 1 and local-media compatibility

## Project and database versions

Project schema remains **4**. Optional `mediaVersion: 1` explicitly enables the separately stored audio subformat and its validated larger budgets. A file-backed `AudioAsset` keeps its existing ID, name, MIME, duration, channels and rate, with `dataUrl: ""` and `file: {key, sha256, size}`. The immutable local file key is independent of source/clip IDs. Old schema-4 inline audio remains unchanged, and the tested **1 → 2 → 3 → 4** backup migration chain still works. Versions older than this application cannot resolve the new file descriptors; keep their old JSON backup when enabling long mode.

IndexedDB upgrades **2 → 3** by adding a `media` store keyed by `key`. Projects, art library and settings/palettes are preserved. Enabling long mode copies original inline bytes to immutable Blob records and updates project descriptors in one transaction. Failure rolls back both stores. No automatic conversion is performed on ordinary open/save.

Normal saves validate the whole project graph and verify every referenced local record before committing metadata. Missing files abort the transaction, preserving the last saved project. Duplicating a local project can safely share immutable originals; clip edits never modify them. Restore creates fresh project/file keys. No original files are silently garbage-collected when a project/source/clip is removed.

## Binary layout

`.ctepisode` is a bounded native Blob container, **not ZIP**. Integers are unsigned little-endian. Version 1 supports audio originals; artwork/drawings remain embedded in the validated project JSON.

| Offset             |              Length | Contents                                          |
| ------------------ | ------------------: | ------------------------------------------------- |
| 0                  |             8 bytes | ASCII `CTEPKG01`                                  |
| 8                  |             4 bytes | UTF-8 manifest length                             |
| 12                 |             4 bytes | Reserved, all zero                                |
| 16                 |     Declared length | UTF-8 JSON manifest                               |
| Following manifest | Declared file sizes | Unmodified original audio bytes in manifest order |

Manifest:

```json
{
  "format": "chiptoons-episode",
  "version": 1,
  "project": { "schemaVersion": 4, "mediaVersion": 1 },
  "projectHash": "sha256-of-JSON.stringify(project)-in-UTF8",
  "files": [
    {
      "key": "local-original-key",
      "sha256": "64-lowercase-hex-digits",
      "size": 1234,
      "mime": "audio/wav"
    }
  ]
}
```

The abbreviated `project` above must actually be a complete valid project. `projectHash` covers the exact JSON serialization parsed from the manifest. Reformatting/reordering project properties requires recalculating this hash. File hashes cover original bytes. SHA-256 uses native Web Crypto where available, with the MIT-licensed pinned `@noble/hashes` implementation as a local fallback. These checks detect corruption, **not authorship or authenticity**; the package is not signed or encrypted.

Manifest ≤64 MiB; audio originals ≤256 MiB; ≤256 file entries; each file ≤12 MiB and ≤120 seconds in validated metadata; total container ≤64 MiB +256 MiB +1 MiB allowance. MIME is limited to the existing supported audio list. There must be exactly one entry for each distinct referenced file key, no extras or duplicate keys, matching sizes/MIME/digests, no missing bytes and no trailing bytes. Repeated references to one key must agree on identity. The project validator additionally enforces unique graph IDs, valid times, references, characters, scenes, numeric ranges, captions, animation and cumulative media budgets.

## Transactional restoration

1. Read the small header; reject unknown versions, reserved bits, excessive lengths or interrupted metadata.
2. Parse and validate the entire project and manifest, check the project hash and estimated available storage.
3. Slice each original from the input File, validate its signature/size and compute its digest sequentially. No full-episode decoding or audio base64 construction is involved. Each file remains a Blob slice until storage; hashing uses at most one bounded source buffer at a time.
4. Reject missing/duplicate/unexpected sources, corrupt bytes or trailing data before opening a write transaction.
5. Assign a new project ID and new file keys. Add all originals and the complete project in one IndexedDB transaction. Abort/cancel/quota/error rolls back the entire restored copy. Existing project IDs are never overwritten.

Legacy JSON restores retain embedded originals and run existing migrations before the same copy-save path. JSON containing external audio references is rejected with guidance to choose the complete package. Restoring a package needs space for an independent full copy, not just its JSON.

Package creation validates all referenced originals and their hashes before offering a download. It preserves source order, every listed original (including unused project sources), art, scene/chapter IDs, animation, audio clips, trim/fade/loop/mixer settings and captions. It does not include encoded movie downloads, export UI checkpoints, other projects, unreferenced recovery originals, browser-installed speech voices or the separate personal art library. Use the existing art-library backup for the latter.

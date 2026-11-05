# Picture-to-Cartoon Animation Studio

## Foundation audit

`main` includes PR #22 at `575788b`. Its [required Studio checks](https://github.com/larrinamsalva/ChipToons/actions/runs/41939013193) passed, including 301 browser tests and the complete 20-minute WebM proof.

- **Artwork.** The Art Library already validates raster uploads, stores character and prop art, and places independent copies in projects. Drawing Pad already supplies missing original artwork. The new studio will use the same importer and library rather than creating an alternate asset store.
- **Animation.** Puppet Maker already attaches raster art to joints, poses, and keyframes. Voice-to-Mouth already uses recorded audio cues. Scene & World Builder, Character & Object Interaction, Fix Build & Transform, Visual Teaching, Camera & Shot Director, and Story Cards already provide the scene, action, camera, and teaching tools. The picture workflow will hand off to those editors.
- **Video and recovery.** The ordinary Stage already renders puppet motion in previews and genuine WebM. Project backups already carry validated artwork and scene metadata. The picture workflow will keep one source asset per project, sharing crop coordinates and copying only prepared cutouts. It needs no new database or rendering engine.

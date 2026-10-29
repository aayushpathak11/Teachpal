# Hosting

**Live app:** https://claude.ai/artifact/Krnn8PHjmxghTF44AFTG27 (claude.ai artifact, private to the owner)

- Built from `dist/artifact/` by `node scripts/build-artifact.mjs`; republish to the same URL to update.
- Capabilities: `db` with rules `progress` (read/write: owner) and `progress/{self}` (read/write: interact), plus `user`. Each viewer's progress is one document, `progress/<viewer id>`. The owner, and Claude acting for the owner through ArtifactData, can read it.
- The artifact is the durable copy of the content. If this repo is behind, read `content/index.json` and `content/<id>.json` back from the artifact (Artifact tool, `action: "read"`, `paths`).
- Artifacts don't run service workers, so the hosted app needs a connection. For an installable, offline PWA, host the repo root on a static host with https (for example GitHub Pages); `sw.js` and `manifest.webmanifest` are already in place.

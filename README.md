# MemLumina Voice Memo Companion

This is a lightweight PWA for capturing voice memos and ingesting them into the MemLumina Cognitive Ledger System (CLS).

## Stack
- Vite (React + TypeScript)
- Firebase (Auth, Storage, Firestore)
- MediaRecorder API
- Google Speech-to-Text (Chirp 2)

## Versioning and Deployment

Builds inject app version, commit SHA, build timestamp, build ID, and image tag into the frontend. The diagnostics UI displays the baked metadata under `Build metadata`.

The local Cloud Run deploy script builds and deploys a versioned image tag by default:

```bash
scripts/deploy-cloud-run.sh
```

Default image tags use `v<package.json version>-<12-char git sha>`, for example `v0.1.0-a1b2c3d4e5f6`. The script also pushes `latest` as a convenience pointer, but Cloud Run deploys the immutable versioned tag.

Optional overrides:

```bash
APP_VERSION=0.1.1 IMAGE_TAG=v0.1.1-hotfix scripts/deploy-cloud-run.sh
```

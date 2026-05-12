# Staged Audio Filing Implementation Plan

Date: 2026-05-11

## Goal

Implement a local-first audio staging strategy:
- always save captured audio on-device first,
- then transfer it to Firebase Storage later,
- so capture is durable immediately and upload becomes a recoverable second step.

## High-level approach

1. **Capture → Local staging**
   - After recording stops, immediately persist the audio blob locally in IndexedDB.
   - Create or update the memo document with a local-first status before any network handoff.

2. **Local memo metadata**
   - Ensure the memo document records:
     - `status`: e.g. `recorded`, `local-only`, `uploading`, `uploaded`
     - `storageState`: `local`, `uploading`, `stored`
     - local staging indicator / device queue flag
     - `captureMode`, `createdAt`, `updatedAt`

3. **Upload as a second step**
   - If online, begin transfer after local staging.
   - If offline, keep the memo queued locally.
   - Do not discard local audio until upload is confirmed and the pipeline is stable.

4. **Retry and sync**
   - On network restore, automatically sync staged memos.
   - Provide explicit resume/retry controls for pending uploads.

## Coding task breakdown

### Task 1: Add a local staging layer
- Enhance `src/hooks/useMemoUpload.ts`
- Make `uploadMemo()` always write to local IndexedDB first
- Save a staging record such as `offline-memo-{memoId}` with:
  - `memoId`
  - `userId`
  - `blob`
  - `captureMode`
  - `timestamp`

### Task 2: Create memo document at capture time
- On initial capture, create Firestore doc immediately with:
  - `status: 'local-only'` or `status: 'recorded'`
  - `audioStaged: true`
  - `storageState: 'local'`
- This gives the UI an immediate record even before upload.

### Task 3: Separate local-first upload flow
- Update the upload logic so it becomes:
  1. local persist
  2. if online, transfer to Storage
  3. on success, update Firestore with `audioURL`, `storagePath`, `storageState: 'stored'`, `status: 'recorded'`
  4. on failure, keep `storageState: 'local'` and leave memo available for retry

### Task 4: Retain staged audio until safe handoff
- Do not delete the local blob after upload or submission until:
  - upload succeeded
  - the memo is safely ingested / marked processed
- This preserves replay/debug ability and supports reprocessing.

### Task 5: Improve UI state for local staging
- Add UI labels for:
  - `Locally saved`
  - `Pending upload`
  - `Upload failed`
  - `Uploaded`
- In `src/App.tsx` and `src/HistoryView.tsx`, show staged upload state separately from transcription status.

### Task 6: Sync queued uploads automatically
- Keep the existing `syncOfflineMemos()` logic but treat it as a general queued transfer engine.
- Trigger on:
  - `window.online`
  - explicit user retry
  - app startup when online
- Update queued memo status as transfer begins and ends.

### Task 7: Add explicit upload/transfer retry
- In history, surface a retry action for memos with `storageState: 'local'` or `status: 'local-only'`.
- Make it easy for users to trigger transfer once connectivity returns.

## Expected behavior

- User records audio → app saves it immediately on-device
- The memo appears in history as “captured locally”
- Upload starts when possible
- If upload fails or offline, memo stays recoverable
- Once upload succeeds, memo transitions to “stored” and the second stage can continue

## Why this matters

- It removes dependence on immediate network access
- It makes capture durable before any backend step
- It turns upload into a recoverable stage, not a failure point
- It supports the product’s local-first reliability principle

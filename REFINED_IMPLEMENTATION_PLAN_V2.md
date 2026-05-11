# Refined Implementation Plan V2: MemLumina Voice Memo Companion

This version updates the prior refined plan to better match the repository's current state. It keeps the same product goals, but adds the missing stabilization work required before the remaining features can be implemented safely and predictably.

## 1. Executive Assessment

The codebase is no longer just missing product features. It also has foundational inconsistencies that will block clean implementation unless addressed first:

- The frontend build is broken.
- The Cloud Functions build is broken.
- The memo identity contract is inconsistent between client, Firestore, and planned UI listeners.
- The upload/transcription flow contains a race between Storage and Firestore writes.
- The transcription implementation does not yet match the intended Chirp 2 / Speech-to-Text V2 target.
- Security rules are not yet strict enough for a user-scoped ingestion workflow.

Because of that, the next plan should be executed in two stages:

1. Stabilize the system.
2. Complete the production memo lifecycle.

## 2. Priority Matrix

| Priority | Task | Why It Matters | Complexity |
| :--- | :--- | :--- | :--- |
| **P0** | **Build & Contract Stabilization** | Restores a working baseline and removes structural blockers. | Medium |
| **P1** | **Reactive Memo Lifecycle UI** | Replaces the prototype transcript flow with real backend-driven state. | Medium |
| **P2** | **Reliable Transcription Pipeline** | Makes upload-to-transcript deterministic and production-safe. | Medium-High |
| **P3** | **Idempotent CLS Ingestion Endpoint** | Safely bridges reviewed memos into CLS `raw_turns`. | Medium-High |
| **P4** | **Chirp 2 / Speech-to-Text V2 Migration** | Improves transcript quality and aligns the stack with the target architecture. | Medium |
| **P5** | **PWA & Offline Queue** | Adds resilience for real mobile capture scenarios. | Medium |
| **P6** | **Semantic Cleanup / Receipt UX** | Adds polish after the core pipeline is trustworthy. | Medium |

## 3. Stage 1: Stabilize The Foundation

### A. Restore Build Integrity

Before feature work, both packages must build cleanly.

- Fix the frontend TypeScript import issue in `src/main.tsx`.
- Align TypeScript and type-package versions across root and `functions/`.
- Confirm `npm run build` passes in both the app and Cloud Functions package.
- Treat "clean build" as the baseline acceptance gate for all subsequent work.

### B. Standardize Memo Identity

The current implementation generates a `memoId` but does not use it as the Firestore document ID. The revised contract should be:

- Storage path: `uploads/{userId}/memos/{memoId}.{ext}`
- Firestore document path: `voice_memos/{memoId}`
- UI listener key: `memoId`
- CLS ingestion idempotency key: `memoId`

This removes ambiguity between:

- Storage object name
- Firestore auto-generated document ID
- UI subscription target
- downstream CLS deduplication key

### C. Remove Upload/Trigger Race Conditions

The current upload flow uploads the file first and creates the Firestore memo record second, which can cause the Storage trigger to run before metadata exists.

The flow should be revised to one of these patterns:

1. Create the Firestore memo document first with status `recorded`, then upload the file.
2. Or keep the current order but make the trigger tolerant and deterministic by deriving all needed metadata from a canonical document path.

Recommended approach:

- Create `voice_memos/{memoId}` first.
- Include `userId`, `captureMode`, `storagePath`, `createdAt`, and initial `status`.
- Upload the blob to the corresponding Storage path.
- Let the transcription worker update the existing document.

### D. Harden Security Rules

The current Firestore rules permit authenticated creates too broadly.

Rules should enforce that:

- A user can only create a memo where `request.resource.data.userId == request.auth.uid`.
- A user can only read their own memo.
- A user cannot arbitrarily mutate backend-owned status fields unless explicitly allowed.
- Backend-managed fields such as `transcriptText`, `errorDetails`, and processing statuses are not freely client-writable.

Storage rules should continue to enforce user-scoped upload paths.

## 4. Stage 2: Complete The Product Flow

### A. Reactive Memo Lifecycle UI

Replace the prototype review behavior with a listener-driven flow.

- Introduce `useMemoStatus(memoId: string)`.
- Subscribe to `voice_memos/{memoId}` with `onSnapshot`.
- Remove the hardcoded transcript from `App.tsx`.
- Drive UI states directly from backend status.

Canonical status model:

- `recorded`: memo metadata created; upload pending or just completed
- `transcribing`: backend is processing audio
- `transcribed`: transcript available for review
- `submitted`: reviewed memo handed off to CLS
- `processed`: CLS accepted and persisted the memo
- `error`: transcription or ingestion failed

### B. Review And Submission Flow

After transcript generation:

- Present the real transcript for user review.
- Let the user choose `captureMode`.
- Mark whether the memo was reviewed by the user.
- Call a backend endpoint to submit the reviewed memo to CLS.

The client should not directly create `raw_turns`.

## 5. Backend Delivery Plan

### A. Reliable Transcription Pipeline

The Storage-triggered transcription function should remain responsible for:

- validating that the uploaded object is a supported memo file
- locating the canonical `voice_memos/{memoId}` record
- setting `status: transcribing`
- generating transcript text
- updating the memo document to `transcribed`
- storing `errorDetails` and `status: error` on failure

Additional improvements:

- Validate mime type and extension consistently.
- Stop treating `.mp4` uploads as MP3 if the recorded format is not actually MP3.
- Consider storing detected `audioContentType` on the memo document for debugging and routing.

### B. Idempotent CLS Ingestion Endpoint

Create a callable or HTTPS function named `submitMemoToLedger`.

Input payload:

```ts
{
  memoId: string,
  captureMode: "idea" | "instruction" | "reminder" | "decision" | "correction" | "project_note",
  reviewedByUser: true
}
```

Server-side enrichment should load the memo document and build the ledger payload:

```ts
{
  source: "voice_memo",
  memoId: string,
  captureMode: string,
  audioStoragePath: string,
  transcriptText: string,
  submittedFrom: "memlumina-capture",
  reviewedByUser: true,
  capturedAt: Timestamp
}
```

Idempotency requirements:

- `memoId` must be the primary deduplication key.
- The endpoint must reject or safely no-op duplicate submissions.
- The memo document should be updated to `submitted` and then `processed` only through verified backend steps.

Target integration outputs:

- write to CLS `raw_turns`, or
- enqueue downstream work in `clerk_jobs`, depending on the actual ledger architecture

## 6. Transcription Upgrade Plan

### A. Migrate To Speech-to-Text V2 / Chirp 2

This should be treated as an implementation upgrade, not just a package bump.

Tasks:

- Confirm the correct Google Cloud Speech-to-Text V2 client and request shape.
- Use the intended model path for Chirp 2.
- Verify supported encoding/container handling for browser-recorded audio.
- Re-test short voice memos and multilingual edge cases.

Acceptance outcome:

- the code clearly uses the V2-compatible integration path
- model selection is explicit and intentional
- recorded browser audio is transcribed with a matching codec configuration

## 7. PWA And Offline Work

Only after the core upload/transcription/submission path is stable:

- add `manifest.json`
- register a service worker
- support draft/offline memo queueing
- preserve client-generated `memoId` across offline/online transitions
- retry upload and submission without duplicating CLS events

This work depends on the memo ID contract being stable first.

## 8. Later-Phase Enhancements

These should come after the core pipeline is functional:

- Gemini-based cleanup of raw spoken transcript into cleaner memo text
- CLS processing receipt UI
- correction/rejection UX for downstream extracted events
- retention policies for raw audio cleanup
- processing analytics and observability

## 9. Recommended Execution Order

1. Restore root and functions builds.
2. Align memo identity so `memoId` is the canonical document key.
3. Fix the upload/transcription race by creating metadata before or alongside upload.
4. Harden Firestore rules around ownership and backend-managed fields.
5. Implement `useMemoStatus(memoId)` and remove the hardcoded transcript flow.
6. Stabilize the transcription worker against the new memo contract.
7. Implement `submitMemoToLedger` with idempotent backend submission logic.
8. Migrate transcription to Speech-to-Text V2 / Chirp 2.
9. Add PWA and offline queue support.
10. Add cleanup, receipts, and deeper CLS feedback.

## 10. Definition Of Done

The remaining work should be considered complete only when all of the following are true:

- Root app build passes.
- Functions build passes.
- Recording creates a canonical `voice_memos/{memoId}` record.
- Upload reliably leads to `transcribing` then `transcribed`.
- The UI reflects real Firestore status via listener updates.
- The user can review and submit a transcript without creating duplicates.
- Submission to CLS is idempotent on `memoId`.
- Security rules enforce user ownership correctly.
- The app can later support offline retry without changing its identity model.

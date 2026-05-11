# Refined Implementation Plan: MemLumina Voice Memo Companion

This document outlines the high-priority technical steps to move the **MemLumina Capture** app from a high-fidelity prototype to a functional production auxiliary for the Cognitive Ledger System (CLS).

## 1. Priority Matrix

| Priority | Task | Strategic Value | Complexity |
| :--- | :--- | :--- | :--- |
| **P0** | **Reactive Transcript Listener** | **Crucial.** Connects the UI to the background transcription process. | Low-Medium |
| **P1** | **Idempotent Ingestion Endpoint** | **Core Logic.** Safely bridges Voice Memos to CLS `raw_turns`. | Medium-High |
| **P2** | **Chirp 2 (V2) Migration** | **Quality.** Ensures high-fidelity ingestion (stack consistency). | Medium |
| **P3** | **PWA & Offline Queue** | **UX.** Essential for reliable mobile "capture" scenarios. | Low-Medium |
| **P4** | **Gemini Semantic Cleanup** | **Polish.** Polishes spoken thoughts into structured "ledger-ready" memory. | Medium |

---

## 2. Technical Specifications

### A. Reactive UI Flow (P0)
Instead of the current hardcoded transcript, the UI must subscribe to the memo's lifecycle.
- **Hook:** `useMemoStatus(memoId: string)`
- **Mechanism:** `onSnapshot` listener on `voice_memos/{memoId}`.
- **States:**
    - `recorded`: Audio uploaded, waiting for trigger.
    - `transcribing`: Backend has picked up the file.
    - `transcribed`: `transcriptText` is available for review.
    - `submitted`: Handoff to CLS initiated.
    - `processed`: Successfully integrated into the ledger.
    - `error`: Surfaced error details from the backend.

### B. CLS Ingestion Contract (P1)
The handoff from the Capture App to the main Ledger must be durable and metadata-rich.
- **Endpoint:** `submitMemoToLedger` (Callable Cloud Function)
- **Metadata Payload:**
  ```ts
  {
    source: "voice_memo",
    memoId: string,
    captureMode: "idea" | "instruction" | "reminder" | "decision" | "correction" | "project_note",
    audioStoragePath: string,
    transcriptText: string,
    submittedFrom: "memlumina-capture",
    reviewedByUser: true,
    capturedAt: Timestamp
  }
  ```
- **Idempotency Strategy:** Use `memoId` as the basis for the `RawTurn` document ID or store it in a `processed_memos` registry to prevent duplicate ledger events from accidental double-taps or retry logic.

### C. Transcription Upgrade (P2)
Migrate `onMemoUploaded` from Google Speech-to-Text V1 to **V2 (Chirp 2)**.
- **Model:** `chirp_2`
- **Features:** Better punctuation, higher accuracy for short "burst" ideas, and improved multilingual handling.

---

## 3. Risks & Mitigations

| Risk | Mitigation |
| :--- | :--- |
| **Transcript Ambiguity** | Retain "user_reviewed: true" flag; retain source audio path in metadata for audit. |
| **Backpressure** | Queue ingestion via `clerk_jobs` to ensure main ledger processing doesn't lag. |
| **Sync Collisions** | Client-side generation of `memoId` to ensure unique tracking across offline/online transitions. |
| **Privacy** | Configurable retention policy (e.g., auto-delete raw audio after 30 days of successful ingestion). |

---

## 4. Immediate Action Items

1. **Implement `onSnapshot` listener** in `App.tsx` to replace `handleToggleRecording`'s mock transcript.
2. **Scaffold the `submitMemo` Cloud Function** to handle the creation of user-scoped `raw_turns`.
3. **Upgrade Functions Dependencies** to include `@google-cloud/speech` v2.
4. **Initialize PWA Manifest** to enable mobile home-screen installation.

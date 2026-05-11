# Implementation Plan: MemLumina Voice Memo Companion

This plan outlines the steps to build the **MemLumina Capture** PWA, a focused auxiliary app for voice-to-ledger ingestion.

## Phase 1: MVP (Core Capture & Ingestion)

### 1. Audio Capture Foundation
- [ ] Implement `useVoiceRecorder` hook using the `MediaRecorder` API.
- [ ] Support `webm/ogg` or `aac` depending on browser compatibility.
- [ ] Add visual feedback (waveform/meter) and timer.
- [ ] Implement local blob storage for previewing before upload.

### 2. Firebase Integration
- [ ] Configure Firebase Auth for user-scoped uploads.
- [ ] Set up Firebase Storage for `.webm` audio files (`uploads/{userId}/memos/{memoId}.webm`).
- [ ] Create a `voice_memos` collection in Firestore to track status: `recorded` -> `uploaded` -> `transcribing` -> `transcribed` -> `submitted`.

### 3. Transcription Service (Backend)
- [ ] Create a Firebase Cloud Function `onMemoUploaded` (Storage trigger).
- [ ] Integrate **Google Speech-to-Text V2 (Chirp 2)** for high-quality transcription.
- [ ] Update Firestore memo record with the resulting `transcriptText`.

### 4. Review & Submission
- [ ] UI for reviewing the transcript and selecting a **Capture Mode** (Idea, Instruction, Decision, etc.).
- [ ] Create a `submitMemo` endpoint (or Firestore trigger) that:
    - [ ] Maps transcript to a `RawTurn` format.
    - [ ] Generates a `ClerkJob` for the CLS processor.
    - [ ] Updates the memo status to `processed`.

## Phase 2: Polish & PWA Features
- [ ] Add `manifest.json` and service worker for PWA support (Offline drafts).
- [ ] Implement "Offline Queue" to sync memos when connection returns.
- [ ] Add "Smart Cleanup" using Gemini to transform raw transcripts into concise memo text before ingestion.

## Phase 3: Deep CLS Feedback
- [ ] Display "Receipt" from CLS showing what was extracted (e.g., "1 Commitment created", "2 Facts updated").
- [ ] Allow correction/rejection of extracted ledger events directly in the Capture app.

---

### Action Items for USER:
1. **Initialize Dependencies:**
   ```bash
   cd /Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo
   npm install
   ```
2. **Firebase Config:** Update `src/firebase.ts` with your actual project credentials.
3. **Run Dev Server:**
   ```bash
   npm run dev
   ```

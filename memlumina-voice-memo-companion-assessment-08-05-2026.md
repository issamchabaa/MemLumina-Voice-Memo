# MemLumina Voice Memo Companion Assessment - 08-05-2026

## Executive Summary

MemLumina would benefit from a small auxiliary capture app: a lightweight voice memo recorder that lets users capture ideas, instructions, reminders, decisions, and corrections with minimal friction, then feeds the resulting transcript into the MemLumina Cognitive Ledger System.

The important product principle is that this companion should not become a separate memory system. It should be another ingestion surface for the existing CLS pipeline.

```text
Voice memo
-> audio file
-> transcript
-> reviewed or auto-submitted memo text
-> scoped raw_turn
-> clerk_job
-> ledger_events
-> semantic_index / projections / ledger_snapshots
-> usable inside MemLumina
```

This makes the recorder valuable because spoken thoughts become structured memory: commitments, decisions, facts, reminders, open loops, project context, corrections, entities, topics, and searchable semantic records.

## Current MemLumina Fit

The current MemLumina/CLS architecture already has the right downstream shape:

- scoped user storage under `users/{userId}/cls/root/{collection}/{documentId}`;
- `raw_turns` as the durable source capture layer;
- `clerk_jobs` as the semantic processing queue;
- `ledger_events` as extracted semantic memory;
- `search_tokens`, `semantic_index`, projections, and future `ledger_snapshots` as derived/rebuildable memory surfaces.

Therefore, the companion recorder should produce a scoped `RawTurn` and `ClerkJob`, not write directly to `ledger_events` and not maintain a parallel voice-note memory database.

Recommended source metadata:

```ts
metadata: {
  source: "voice_memo",
  captureMode: "instruction", // idea | instruction | reminder | decision | correction | project_note
  audioStoragePath,
  transcriptModel,
  transcriptConfidence,
  transcriptLanguage,
  submittedFrom: "memlumina-capture",
  reviewStatus: "auto_submitted" // or "user_reviewed"
}
```

A memo is not necessarily a two-party assistant chat. Avoid inventing a fake assistant answer unless the existing ingestion contract truly requires one. Prefer a user-only raw turn plus clear metadata.

## Relevant Product Examples

### Granola

Granola shows the value of explicit activation and meeting/quick-note capture. It starts transcribing only when the user opens or starts a note, which is a good privacy and trust pattern.

Source: https://docs.granola.ai/help-center/taking-notes/transcription

### Superwhisper

Superwhisper demonstrates the usefulness of dictation plus smart processing modes. The lesson for MemLumina is that the raw transcript is not the end product. Users want spoken language transformed into usable notes, instructions, tasks, and structured memory.

Source: https://superwhisper.com/docs/getting-started

### Plaud / AI Recorder Apps

Plaud-style devices and apps show a natural workflow: capture now, upload later, transcribe, summarize, search, and reuse. Their weakness is often integration into the user's real knowledge workflow. MemLumina can be stronger here because ingestion ends in the ledger.

Source: https://support.plaud.ai/hc/en-us/articles/55651927421977-How-to-Transcribe

### Browser Recording APIs

`MediaRecorder` is a suitable browser API for reliable audio recording in a web/PWA companion app.

Source: https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder

`SpeechRecognition` / Web Speech API can be useful for a rough live transcript, but it has limited browser availability and may route audio to browser-vendor recognition services. It should not be the durable transcription layer for MemLumina.

Source: https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition

## Recommended Product Shape

Create a tiny companion PWA, tentatively named one of:

- MemLumina Capture
- Lumina Memo
- MemLumina Memo
- Lumina Recorder

The first screen should be the actual recorder, not a dashboard or marketing-style page.

Core flow:

```text
Open app
-> tap Record
-> speak
-> stop
-> review transcript
-> choose capture mode if needed
-> Send to MemLumina
-> see status: queued -> transcribed -> integrated
```

Primary UI elements:

- large record/stop button;
- elapsed time;
- waveform or level meter;
- optional live rough transcript;
- transcript review editor;
- memo type selector;
- send button;
- processing status;
- local drafts / failed uploads list.

Recommended capture modes:

- `idea`: exploratory thought, possible future use;
- `instruction`: user wants MemLumina or an assistant to act later;
- `reminder`: time-based or condition-based reminder intent;
- `decision`: explicit choice that should become durable memory;
- `correction`: user corrects an earlier memory or extraction;
- `project_note`: attaches context to a known project.

The mode should be optional. If present, pass it as metadata and optionally as a system hint to the semantic clerk.

## Technical Architecture

Recommended architecture:

```text
Companion frontend
  - Firebase Auth
  - MediaRecorder audio capture
  - local draft queue
  - audio upload
  - transcript review and submit

Transcription backend
  - receives audio or storage reference
  - transcribes through selected ASR provider
  - stores transcript and metadata
  - optionally cleans transcript into memo text

MemLumina ingestion backend
  - creates scoped raw_turn
  - creates clerk_job
  - updates memo processing status
  - lets existing CLS pipeline process it
```

Recommended storage flow:

```text
Firebase Storage:
  uploads/{userId}/voice-memos/{memoId}.{ext}

Firestore or CLS operational collection:
  users/{userId}/voice_memos/{memoId}
```

A `voice_memos` operational collection can track capture lifecycle without becoming a second memory source of truth.

Example lifecycle fields:

```ts
{
  id,
  userId,
  status: "recorded" | "uploaded" | "transcribing" | "transcribed" | "submitted" | "processed" | "failed",
  audioStoragePath,
  transcriptText,
  cleanedMemoText,
  captureMode,
  rawTurnId,
  clerkJobId,
  createdAt,
  updatedAt,
  error
}
```

The ledger remains the real knowledge base once the memo is submitted.

## Transcription Provider Options

### Option A: Google Speech-to-Text / Chirp 2

This is the most ecosystem-consistent option because MemLumina already uses Firebase, Google Cloud, and Gemini tooling.

Google Cloud Speech-to-Text V2 Chirp 2 supports streaming, short audio, batch recognition, punctuation, language detection, word timestamps, translation, and model adaptation. It is appropriate for a production voice-memo pipeline.

Source: https://docs.cloud.google.com/speech-to-text/v2/docs/chirp_2-model

Recommended when:

- Firebase/GCP operational simplicity matters;
- central billing and IAM are important;
- integration with Cloud Functions / Cloud Run is preferred;
- multilingual support and adaptation are needed.

### Option B: OpenAI Transcription

OpenAI's Audio API supports `gpt-4o-transcribe`, `gpt-4o-mini-transcribe`, and `gpt-4o-transcribe-diarize`. It supports common audio formats including `mp3`, `mp4`, `mpeg`, `mpga`, `m4a`, `wav`, and `webm`, with file uploads currently limited to 25 MB.

Source: https://platform.openai.com/docs/guides/speech-to-text

Recommended when:

- transcript quality tests outperform Google for the target languages;
- diarization is important;
- OpenAI is already part of the production AI stack;
- simple file transcription is enough for MVP.

### Recommendation

Start with Google Speech-to-Text / Chirp 2 for stack consistency, but run a small transcript-quality bakeoff against OpenAI using real user-like samples:

- short spontaneous ideas;
- noisy mobile recordings;
- bilingual or code-switched speech;
- names of projects and product terms;
- long instructions with multiple action items.

Choose the provider based on actual word error rate, domain-term accuracy, latency, and operational simplicity.

## MVP Scope

Build the smallest useful version first:

1. Authenticated companion PWA.
2. Record audio using `MediaRecorder`.
3. Upload audio to backend or Firebase Storage.
4. Backend transcribes audio.
5. User reviews transcript.
6. User submits transcript to MemLumina.
7. Backend creates scoped `raw_turn` and `clerk_job`.
8. Companion shows status.
9. MemLumina later surfaces processed ledger results.

This avoids overbuilding realtime transcription, diarization, complex summaries, or native apps too early.

## Phase 2 Enhancements

Add after the MVP proves useful:

- live rough transcript during recording;
- offline draft queue with retry;
- mobile PWA install prompt;
- one-tap highlight marker while recording;
- transcript cleanup before ledger submission;
- automatic memo type detection;
- automatic title generation;
- source audio playback from memo details;
- processing receipt showing extracted commitments, reminders, facts, topics, and projects;
- correction flow for bad transcripts or bad semantic extraction;
- voice command patterns such as "MemLumina, remember...";
- project binding to active note/project;
- scheduled reminders extracted from speech;
- batch import of existing audio files.

## Phase 3: Deep CLS Integration

Once `semantic_index` and `ledger_snapshots` are mature, voice memos can become a high-value memory stream:

- transcript and cleaned memo become source material for ledger events;
- ledger events receive embeddings in `semantic_index`;
- projections update commitments, reminders, open loops, project indexes, entity timelines, and topic maps;
- snapshots summarize project/topic/entity state;
- MemLumina can retrieve processed voice-derived memory as first-class context.

At this stage, the companion should show something like:

```text
Processed into:
- 2 commitments
- 1 reminder
- 3 project notes
- 4 facts
- 1 correction
```

This gives users confidence that their spoken thoughts were actually integrated, not merely transcribed.

## Risks and Mitigations

### Bad Transcript Becomes Bad Memory

Risk: ASR errors can become durable ledger facts.

Mitigations:

- review-before-send in MVP;
- mark transcript confidence and model name;
- retain source audio temporarily for audit;
- support correction events;
- keep `EpistemicStatus` explicit or uncertain when needed.

### Accidental Recording

Risk: user trust is damaged if the app seems always-on.

Mitigations:

- explicit tap-to-record;
- clear recording state;
- visible elapsed timer;
- no background recording in MVP;
- privacy-first onboarding.

### Privacy and Retention

Risk: raw audio is sensitive.

Mitigations:

- configurable retention: delete audio after transcript, keep for 7 days, or keep manually;
- store audio under user-scoped paths;
- avoid public URLs unless required;
- log retention behavior clearly;
- make transcript provider explicit in technical docs.

### Duplicate Submission

Risk: offline retry or impatient taps create duplicate memories.

Mitigations:

- memo IDs generated client-side;
- content hash over audio/transcript/user/time;
- idempotent submit endpoint;
- raw turn metadata references `memoId`.

### Over-Processing Casual Thoughts

Risk: every casual memo becomes durable knowledge, cluttering the ledger.

Mitigations:

- draft vs submit distinction;
- capture modes;
- low-importance default for vague ideas;
- user review before commit;
- later bulk cleanup/correction tools.

### Provider Lock-In

Risk: transcription provider changes are expensive.

Mitigations:

- isolate transcription behind a provider interface;
- store `transcriptModel` and provider metadata;
- keep ingestion independent from ASR provider;
- support re-transcription if audio is retained.

## Suggested Backend Endpoints

Possible API surface:

```text
POST /api/voice-memos
  Creates memo record and upload target.

POST /api/voice-memos/:memoId/transcribe
  Starts transcription from uploaded audio.

POST /api/voice-memos/:memoId/submit
  Creates scoped raw_turn and clerk_job from transcript.

GET /api/voice-memos/:memoId
  Returns status, transcript, rawTurnId, clerkJobId, processing status.
```

Alternative: use Firebase callable functions or Cloud Functions triggers:

```text
Storage finalize trigger
-> transcribe audio
-> write transcript to voice_memos/{memoId}

Submit endpoint
-> create raw_turn + clerk_job
```

For MVP, an explicit submit endpoint is cleaner because it gives the user a review step.

## Suggested Data Contract into CLS

Raw turn message:

```ts
messages: [
  {
    role: "user",
    content: cleanedMemoText || transcriptText
  }
]
```

Metadata:

```ts
metadata: {
  source: "voice_memo",
  memoId,
  captureMode,
  audioStoragePath,
  transcriptText,
  cleanedMemoText,
  transcriptProvider,
  transcriptModel,
  transcriptLanguage,
  transcriptConfidence,
  submittedFrom: "memlumina-capture",
  reviewedByUser: true,
  capturedAt,
  submittedAt
}
```

Optional system/context hint for clerk processing:

```text
This raw turn came from a voice memo. Treat it as user-authored memory input. Extract durable facts, decisions, commitments, reminders, corrections, open loops, projects, entities, and topics where explicit enough. Preserve uncertainty when the transcript is ambiguous.
```

## Implementation Roadmap

### Step 1: Design Contract

Define the `voice_memos` operational schema and the exact raw turn metadata contract.

### Step 2: Build Capture PWA

Create a small authenticated recorder using `MediaRecorder`, upload, transcript review, and submit status.

### Step 3: Build Transcription Service

Start with one provider, preferably Google Chirp 2 for stack consistency. Keep a provider interface so OpenAI can be tested or added later.

### Step 4: Add CLS Ingestion Endpoint

Create a scoped ingestion endpoint that writes `raw_turns`, `clerk_jobs`, and `conversation_heads` consistently with the existing MemLumina chat capture pattern.

### Step 5: Add Processing Status

Expose whether the raw turn has produced ledger events, semantic index records, projections, and/or errors.

### Step 6: Add Correction Loop

Let users correct transcript text or reject/confirm extracted ledger events.

## Final Recommendation

Proceed with the idea.

Build it as a focused PWA companion rather than as a large new module inside the main MemLumina UI. Use reliable browser audio capture, server-side transcription, and the existing CLS raw-turn ingestion path.

The highest-value version is not merely a voice recorder. It is a low-friction entrance into MemLumina's ledger: a way for users to speak thoughts at the moment they occur and later find those thoughts processed, structured, indexed, and ready for use.

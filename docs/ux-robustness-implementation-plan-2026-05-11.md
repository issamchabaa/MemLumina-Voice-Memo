# MemLumina Voice Memo — UX & Robustness Implementation Plan

Date: 2026-05-11

**Source:** [Assessment 2026-05-11](file:///Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/docs/memlumina-voice-memo-ux-and-robustness-assessment-2026-05-11.md)
**Staged Audio Plan:** [staged-audio-filing-implementation-plan-2026-05-11.md](file:///Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/docs/staged-audio-filing-implementation-plan-2026-05-11.md)

---

## Inventory of Files

| File | Role | Lines |
|------|------|-------|
| [App.tsx](file:///Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/src/App.tsx) | Main UI: capture, review panel, diagnostics, action bar | 466 |
| [HistoryView.tsx](file:///Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/src/HistoryView.tsx) | History list component | 107 |
| [useVoiceRecorder.ts](file:///Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/src/hooks/useVoiceRecorder.ts) | MediaRecorder hook | 107 |
| [useMemoUpload.ts](file:///Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/src/hooks/useMemoUpload.ts) | Upload + offline queue hook | 132 |
| [useMemoStatus.ts](file:///Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/src/hooks/useMemoStatus.ts) | Real-time Firestore status listener | 49 |
| [useMemoHistory.ts](file:///Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/src/hooks/useMemoHistory.ts) | History query hook | 54 |
| [index.css](file:///Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/src/index.css) | Tailwind + custom CSS | 143 |
| [functions/src/index.ts](file:///Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/functions/src/index.ts) | Cloud Functions: STT, submit, clerk-job listener | 356 |
| [functions/src/types.ts](file:///Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/functions/src/types.ts) | Backend type definitions | 48 |

## Phase Overview

| Phase | Priority | Tasks | Theme |
|-------|----------|-------|-------|
| **1** | P0 | Tasks 1–2 | Completion assurance — the #1 UX risk |
| **2** | P1 | Tasks 3–5 | Error visibility & diagnostics truth |
| **3** | P2 | Tasks 6–8 | Operational confidence & retention |
| **4** | P3 | Tasks 9–11 | Semantic bridge & product modes |

> [!IMPORTANT]
> Phases must be completed sequentially. Tasks within a phase can be parallelized.

---

## Phase 1 — P0: Completion Assurance

> **Core problem:** Users see "Intelligence Captured" + green ✓ when a memo is `transcribed`, but the memo is NOT in CLS yet. The user must still tap "Verify & Ingest." This is the single biggest UX failure in the app.

---

### Task 1: Reword Status Labels & Icons — Distinguish `transcribed` from `ingested`

**Assessment refs:** §1, §2, §8

#### 1A. Review Panel Header — [App.tsx:300–318](file:///Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/src/App.tsx#L300-L318)

**Problem:** `transcribed` gets the same green `CheckCircle2` and the label "Intelligence Captured" — identical visual weight to `processed`.

```diff
 // App.tsx — import line 2: add AlertTriangle, Upload
-import { Mic, Square, Send, Info, Activity, LogIn, Settings, History, Shield, Cpu, CheckCircle2, AlertCircle, Database, ArrowLeft } from 'lucide-react'
+import { Mic, Square, Send, Info, Activity, LogIn, Settings, History, Shield, Cpu, CheckCircle2, AlertCircle, AlertTriangle, Upload, Database, ArrowLeft, Clock } from 'lucide-react'
```

```diff
 // App.tsx lines 301–317 — review panel status header
 <div className="flex items-center space-x-2">
-  {memoData?.status === 'transcribed' || memoData?.status === 'processed' ? (
-    <CheckCircle2 size={14} className="text-[#00FF94]" />
+  {memoData?.status === 'processed' ? (
+    <CheckCircle2 size={14} className="text-[#00FF94]" />
+  ) : memoData?.status === 'submitted' ? (
+    <Upload size={14} className="text-[#00DBE7] animate-pulse" />
+  ) : memoData?.status === 'transcribed' ? (
+    <AlertTriangle size={14} className="text-amber-400" />
   ) : memoData?.status === 'error' ? (
     <AlertCircle size={14} className="text-red-400" />
   ) : (
     <Activity size={14} className="text-[#EBB2FF] animate-pulse" />
   )}
   <span className="text-[10px] uppercase tracking-widest font-black text-white/50">
     {memoData?.status === 'transcribing' ? 'Neural Processing' :
-     memoData?.status === 'transcribed' ? 'Intelligence Captured' :
+     memoData?.status === 'transcribed' ? 'Transcript Ready — Awaiting Ingestion' :
+     memoData?.status === 'submitted' ? 'Submitted — CLS Processing' :
+     memoData?.status === 'processed' ? 'Accepted by Cognitive Ledger' :
      memoData?.status === 'error' ? 'Processing Error' : 'Stream Ready'}
   </span>
 </div>
-<span className="text-[9px] font-mono text-[#EBB2FF]/70 bg-[#EBB2FF]/10 px-2 py-0.5 rounded uppercase">
-  {memoData?.status || 'awaiting_sync'}
-</span>
+<span className={`text-[9px] font-mono px-2 py-0.5 rounded uppercase ${
+  memoData?.status === 'transcribed' ? 'text-amber-400/70 bg-amber-400/10' :
+  memoData?.status === 'submitted' ? 'text-[#00DBE7]/70 bg-[#00DBE7]/10' :
+  memoData?.status === 'processed' ? 'text-[#00FF94]/70 bg-[#00FF94]/10' :
+  'text-[#EBB2FF]/70 bg-[#EBB2FF]/10'
+}`}>
+  {memoData?.status || 'awaiting_sync'}
+</span>
```

#### 1B. Ingestion Warning Banner — [App.tsx:353–371](file:///Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/src/App.tsx#L353-L371)

**Problem:** No explicit warning that a `transcribed` memo is not yet in memory.

```diff
 // App.tsx — inside the transcript block, after the textarea (after line 363)
 // ADD new status banners BEFORE the existing processed receipt

+                    {memoData.status === 'transcribed' && (
+                      <div className="flex items-start space-x-3 text-amber-400 bg-amber-400/10 p-4 rounded-lg border border-amber-400/20 animate-in slide-in-from-bottom-2">
+                        <AlertTriangle size={18} className="shrink-0 mt-0.5" />
+                        <div className="space-y-1">
+                          <span className="text-xs uppercase font-bold tracking-widest block">Not Yet In Memory</span>
+                          <span className="text-[10px] text-amber-400/70 tracking-wide block">
+                            This transcript is ready for review. Tap "Verify & Ingest" below to send it to your Cognitive Ledger.
+                          </span>
+                        </div>
+                      </div>
+                    )}
+                    {memoData.status === 'submitted' && (
+                      <div className="flex items-center space-x-2 text-[#00DBE7] bg-[#00DBE7]/10 p-3 rounded-lg border border-[#00DBE7]/20 animate-in slide-in-from-bottom-2">
+                        <Upload size={16} className="animate-pulse" />
+                        <span className="text-xs uppercase font-bold tracking-widest">Submitted — CLS Processing</span>
+                      </div>
+                    )}
                     {memoData.status === 'processed' && (
```

#### 1C. History View Icons & Colors — [HistoryView.tsx:2, 12–34](file:///Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/src/HistoryView.tsx#L12-L34)

```diff
 // HistoryView.tsx line 2 — add AlertTriangle, Upload
-import { CheckCircle2, AlertCircle, Clock, ArrowLeft, Cpu, Trash2, ChevronRight } from 'lucide-react'
+import { CheckCircle2, AlertCircle, AlertTriangle, Clock, ArrowLeft, Cpu, Upload, ChevronRight } from 'lucide-react'
```

```diff
 // HistoryView.tsx getStatusIcon — add transcribed + fix submitted
  case 'processed':
    return <CheckCircle2 size={16} className="text-[#00FF94]" />
  case 'submitted':
-   return <CheckCircle2 size={16} className="text-[#00FF94]" />
+   return <Upload size={16} className="text-[#00DBE7] animate-pulse" />
+ case 'transcribed':
+   return <AlertTriangle size={16} className="text-amber-400" />
```

```diff
 // HistoryView.tsx getStatusColor — add transcribed case
  case 'submitted': return 'bg-[#00DBE7]/10 text-[#00DBE7] border-[#00DBE7]/20'
+ case 'transcribed': return 'bg-amber-400/10 text-amber-400 border-amber-400/20'
  case 'error': return 'bg-red-400/10 text-red-400 border-red-400/20'
```

#### 1D. History Inline CTA — [HistoryView.tsx:88–93](file:///Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/src/HistoryView.tsx#L88-L93)

```diff
 // HistoryView.tsx — replace plain chevron with contextual CTA for transcribed memos
                <p className="text-sm font-medium text-white/70 line-clamp-2 italic pr-4">
                  {memo.transcriptText || (memo.status === 'error' ? 'Failed to process signal' : 'Extracting semantics...')}
                </p>
-               <ChevronRight size={16} className="text-white/10 group-hover:text-white/30 transition-colors shrink-0" />
+               {memo.status === 'transcribed' ? (
+                 <span className="text-[9px] font-bold uppercase tracking-widest text-amber-400 whitespace-nowrap shrink-0">Ingest →</span>
+               ) : (
+                 <ChevronRight size={16} className="text-white/10 group-hover:text-white/30 transition-colors shrink-0" />
+               )}
```

---

### Task 2: Remove Auto-Dismiss — Keep Receipt Until User Dismisses

**Assessment refs:** §8

#### 2A. Delete the `setTimeout` — [App.tsx:102–109](file:///Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/src/App.tsx#L102-L109)

```diff
      setSyncStatus('submitted')
      localStorage.removeItem(`draft-${lastMemoId}`)
-
-     // Auto-dismiss after success
-     setTimeout(() => {
-       setShowReview(false)
-       resetRecording()
-       setSyncStatus('idle')
-       setLastMemoId(null)
-       setEditedTranscript('')
-     }, 3000)
```

#### 2B. New state for receipt data — [App.tsx:21](file:///Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/src/App.tsx#L21)

```diff
  const [activeView, setActiveView] = useState<'capture' | 'history' | 'diagnostics'>('capture')
+ const [clsReceipt, setClsReceipt] = useState<{ rawTurnId: string; clerkJobId: string; submittedAt: string } | null>(null)
```

#### 2C. Capture submission response — [App.tsx:88–99](file:///Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/src/App.tsx#L88-L99)

```diff
      const submitFn = httpsCallable(functions, 'submitMemoToLedger')
-     await submitFn({
+     const result = await submitFn({
        memoId: lastMemoId,
        ...
      })
+     const receiptData = result.data as any
+     setClsReceipt({
+       rawTurnId: receiptData.rawTurnId,
+       clerkJobId: receiptData.clerkJobId,
+       submittedAt: new Date().toISOString(),
+     })
      setSyncStatus('submitted')
```

#### 2D. Enhanced receipt card — [App.tsx:364–369](file:///Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/src/App.tsx#L364-L369)

```diff
-                    {memoData.status === 'processed' && (
-                      <div className="flex items-center space-x-2 text-[#00FF94] bg-[#00FF94]/10 p-3 rounded-lg border border-[#00FF94]/20 animate-in slide-in-from-bottom-2">
-                        <CheckCircle2 size={16} />
-                        <span className="text-xs uppercase font-bold tracking-widest">Receipt: Accepted by Cognitive Ledger</span>
-                      </div>
-                    )}
+                    {memoData.status === 'processed' && (
+                      <div className="text-[#00FF94] bg-[#00FF94]/10 p-4 rounded-lg border border-[#00FF94]/20 animate-in slide-in-from-bottom-2 space-y-3">
+                        <div className="flex items-center space-x-2">
+                          <CheckCircle2 size={16} />
+                          <span className="text-xs uppercase font-bold tracking-widest">Accepted by Cognitive Ledger</span>
+                        </div>
+                        {clsReceipt && (
+                          <div className="grid grid-cols-2 gap-2 text-[9px] font-mono">
+                            <div>
+                              <span className="text-[#00FF94]/50 uppercase block">Raw Turn</span>
+                              <span className="text-[#00FF94]/80 truncate block">{clsReceipt.rawTurnId}</span>
+                            </div>
+                            <div>
+                              <span className="text-[#00FF94]/50 uppercase block">Clerk Job</span>
+                              <span className="text-[#00FF94]/80 truncate block">{clsReceipt.clerkJobId}</span>
+                            </div>
+                            <div className="col-span-2">
+                              <span className="text-[#00FF94]/50 uppercase block">Submitted</span>
+                              <span className="text-[#00FF94]/80">{clsReceipt.submittedAt}</span>
+                            </div>
+                          </div>
+                        )}
+                      </div>
+                    )}
```

#### 2E. Clear receipt on dismiss — [App.tsx:396–406](file:///Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/src/App.tsx#L396-L406)

```diff
 // In the Back/Purge button onClick handler, add:
                  setSyncStatus('idle')
+                 setClsReceipt(null)
                }}\n
```

---

## Phase 2 — P1: Error Visibility & Diagnostics Truth

> **Core problem:** Recording failures are swallowed into `console.error`. Diagnostics lie about subsystem versions. Submission errors are generic and offer no retry.

---

### Task 3: Surface Recorder Errors as First-Class UI States

**Assessment refs:** §3

**Problem:** In [useVoiceRecorder.ts:73–75](file:///Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/src/hooks/useVoiceRecorder.ts#L73-L75), all recorder failures — permission denied, device unavailable, format unsupported — are caught and logged to console only. The user sees nothing.

#### 3A. New error type and state — [useVoiceRecorder.ts](file:///Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/src/hooks/useVoiceRecorder.ts)

**Add above the hook function (after line 2):**

```diff
+export type RecorderErrorCode = 'permission_denied' | 'device_unavailable' | 'format_unsupported' | 'unknown'
+
+export interface RecorderError {
+  code: RecorderErrorCode
+  message: string
+}
+
+function classifyRecorderError(err: any): RecorderError {
+  const name = err?.name || ''
+  const msg = err?.message || ''
+  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
+    return { code: 'permission_denied', message: 'Microphone access was denied. Allow microphone permissions in your browser settings and try again.' }
+  }
+  if (name === 'NotFoundError' || name === 'NotReadableError' || name === 'OverconstrainedError') {
+    return { code: 'device_unavailable', message: 'No microphone detected or the device is busy. Connect a microphone and try again.' }
+  }
+  if (msg.includes('mimetype') || msg.includes('MediaRecorder')) {
+    return { code: 'format_unsupported', message: 'Your browser does not support a compatible recording format (webm/mp4).' }
+  }
+  return { code: 'unknown', message: `Recording failed: ${msg || 'Unknown error'}` }
+}
```

#### 3B. Hook state + error classification — [useVoiceRecorder.ts:4–7, 73–75](file:///Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/src/hooks/useVoiceRecorder.ts#L4-L7)

```diff
 // useVoiceRecorder.ts — add new state after line 7
  const [audioLevel, setAudioLevel] = useState(0);
+ const [recorderError, setRecorderError] = useState<RecorderError | null>(null);
```

```diff
 // useVoiceRecorder.ts — update the startRecording try block (before the try, clear error)
  const startRecording = useCallback(async () => {
+   setRecorderError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
+
+     // Validate MIME type support before constructing MediaRecorder
+     const mimeType = MediaRecorder.isTypeSupported('audio/webm')
+       ? 'audio/webm'
+       : MediaRecorder.isTypeSupported('audio/mp4')
+         ? 'audio/mp4'
+         : null;
+     if (!mimeType) {
+       stream.getTracks().forEach(t => t.stop());
+       setRecorderError({ code: 'format_unsupported', message: 'Your browser does not support a compatible recording format (webm/mp4).' });
+       return;
+     }

-     // Determine supported mime type
-     const mimeType = MediaRecorder.isTypeSupported('audio/webm')
-       ? 'audio/webm'
-       : 'audio/mp4';
-
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
```

```diff
 // useVoiceRecorder.ts lines 73–75 — replace silent catch
    } catch (err) {
-     console.error('Failed to start recording', err);
+     console.error('Failed to start recording', err);
+     setRecorderError(classifyRecorderError(err));
    }
```

#### 3C. Export new values — [useVoiceRecorder.ts:97–105](file:///Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/src/hooks/useVoiceRecorder.ts#L97-L105)

```diff
  return {
    isRecording,
    audioBlob,
    duration,
    audioLevel,
+   recorderError,
+   clearRecorderError: useCallback(() => setRecorderError(null), []),
    startRecording,
    stopRecording,
    resetRecording
  };
```

#### 3D. Consume in App.tsx — [App.tsx:23–31, 257](file:///Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/src/App.tsx#L23-L31)

```diff
 // App.tsx lines 23–31 — destructure new values
  const {
    isRecording,
    audioBlob,
    duration,
    audioLevel,
+   recorderError,
+   clearRecorderError,
    startRecording,
    stopRecording,
    resetRecording
  } = useVoiceRecorder()
```

#### 3E. Render error card below recorder button — [App.tsx:257](file:///Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/src/App.tsx#L257)

**Insert after the closing `</div>` of the recorder button group (after line 257), before the timer display:**

```diff
              </div>
+
+             {/* Recorder Error Card */}
+             {recorderError && (
+               <div className="w-full glass-panel rounded-2xl p-5 border border-red-500/20 bg-red-500/5 animate-in fade-in slide-in-from-bottom-4 duration-500">
+                 <div className="flex items-start justify-between">
+                   <div className="flex items-start space-x-3">
+                     <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
+                     <div className="space-y-1.5">
+                       <span className="text-[10px] uppercase font-bold tracking-widest text-red-400 block">
+                         {recorderError.code === 'permission_denied' ? 'Microphone Blocked' :
+                          recorderError.code === 'device_unavailable' ? 'No Microphone Found' :
+                          recorderError.code === 'format_unsupported' ? 'Unsupported Format' :
+                          'Recording Failed'}
+                       </span>
+                       <p className="text-xs text-white/50 leading-relaxed">{recorderError.message}</p>
+                     </div>
+                   </div>
+                   <button
+                     onClick={clearRecorderError}
+                     className="text-[9px] text-white/30 uppercase tracking-widest hover:text-white/60 transition-colors shrink-0 ml-3"
+                   >
+                     Dismiss
+                   </button>
+                 </div>
+               </div>
+             )}

              <div className="text-center space-y-2">
```

---

### Task 4: Fix Hardcoded Diagnostics Labels

**Assessment refs:** §4

**Problem:** The diagnostics panel at [App.tsx:218–226](file:///Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/src/App.tsx#L218-L226) shows `STT V2 → ACTIVE` and `Gemini 1.5 → ACTIVE`. The backend actually uses STT V1 (`longRunningRecognize`, model `default`, provider `google_speech_to_text_v1`) and `gemini-1.5-flash-002`.

#### 4A. Replace hardcoded labels — [App.tsx:217–227](file:///Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/src/App.tsx#L217-L227)

```diff
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 bg-white/5 rounded-xl border border-white/5">
-                   <p className="text-[8px] text-white/40 uppercase mb-1">STT V2</p>
-                   <p className="text-[10px] text-green-400 font-bold">ACTIVE</p>
+                   <p className="text-[8px] text-white/40 uppercase mb-1">Transcription</p>
+                   <p className="text-[10px] text-white/60 font-bold font-mono">Google STT V1</p>
+                   <p className="text-[8px] text-white/30 mt-0.5">longRunningRecognize / default</p>
                  </div>
                  <div className="p-3 bg-white/5 rounded-xl border border-white/5">
-                   <p className="text-[8px] text-white/40 uppercase mb-1">Gemini 1.5</p>
-                   <p className="text-[10px] text-green-400 font-bold">ACTIVE</p>
+                   <p className="text-[8px] text-white/40 uppercase mb-1">Transcript Cleanup</p>
+                   <p className="text-[10px] text-white/60 font-bold font-mono">Gemini 1.5 Flash</p>
+                   <p className="text-[8px] text-white/30 mt-0.5">gemini-1.5-flash-002</p>
                  </div>
                </div>
```

**Why:** This replaces false `ACTIVE` claims with truthful, implementation-matching labels. No dynamic query needed — the backend is static. If the backend changes later, these labels should be updated accordingly.

#### 4B. (Optional enhancement) Show last-used provider from memo data

If you want dynamic truth, you can add a third diagnostic row that reads from the most recent processed memo:

```diff
 // App.tsx — after the subsystem grid (after line 227), add:
+              <div className="h-[1px] bg-white/5 w-full" />
+              <div className="space-y-2">
+                <p className="text-[9px] uppercase tracking-widest text-white/20 font-black">Last Processed Memo</p>
+                <div className="p-3 bg-white/5 rounded-xl border border-white/5">
+                  {/* This requires importing useMemoHistory or passing data from App state */}
+                  <p className="text-[8px] text-white/40">Provider used will appear here after first successful ingestion</p>
+                </div>
+              </div>
```

> [!NOTE]
> 4B is optional. 4A alone satisfies the assessment requirement. 4B can be deferred to Phase 3 when history is enhanced.

---

### Task 5: Improve Submission Error Visibility with Retry

**Assessment refs:** §1 (implied), §7

**Problem:** When `handlePushToLedger` fails at [App.tsx:110–113](file:///Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/src/App.tsx#L110-L113), it sets `syncStatus = 'error'` and the error banner at [App.tsx:436–440](file:///Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/src/App.tsx#L436-L440) shows a generic "Sync failed: Connection Interrupted". No retry, no specifics.

#### 5A. New error state with structure — [App.tsx:19](file:///Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/src/App.tsx#L19)

```diff
  const [syncStatus, setSyncStatus] = useState<'idle' | 'uploading' | 'success' | 'error' | 'submitted'>('idle')
+ const [syncError, setSyncError] = useState<{ message: string; retryable: boolean } | null>(null)
```

#### 5B. Classify errors in handlePushToLedger — [App.tsx:110–113](file:///Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/src/App.tsx#L110-L113)

```diff
    } catch (err: any) {
      console.error('Submission to CLS failed', err)
      setSyncStatus('error')
+     const code = err?.code || ''
+     const message = err?.message || ''
+     if (code === 'functions/unavailable' || code === 'functions/deadline-exceeded' || !navigator.onLine) {
+       setSyncError({ message: 'Network error — check your connection and try again.', retryable: true })
+     } else if (code === 'functions/failed-precondition') {
+       setSyncError({ message: 'This memo may have already been submitted or is not in the correct state.', retryable: false })
+     } else if (code === 'functions/unauthenticated') {
+       setSyncError({ message: 'Your session has expired. Please sign in again.', retryable: false })
+     } else {
+       setSyncError({ message: message || 'Submission failed unexpectedly.', retryable: true })
+     }
    }
```

#### 5C. Clear error on new actions — [App.tsx:73, 85](file:///Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/src/App.tsx#L73)

```diff
 // App.tsx handleInitializeCapture (line 73)
  const handleInitializeCapture = async () => {
    if (!audioBlob) return
    setSyncStatus('uploading')
+   setSyncError(null)
```

```diff
 // App.tsx handlePushToLedger (line 85)
  const handlePushToLedger = async () => {
    if (!lastMemoId) return
    setSyncStatus('uploading')
+   setSyncError(null)
```

#### 5D. Enhanced error banner with retry — [App.tsx:436–440](file:///Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/src/App.tsx#L436-L440)

```diff
-           {(uploadError || syncStatus === 'error') && (
-             <div className="p-3 rounded-lg border border-red-500/20 bg-red-500/5 text-red-400 text-[10px] text-center uppercase tracking-widest font-black">
-               {uploadError || 'Sync failed: Connection Interrupted'}
-             </div>
-           )}
+           {(uploadError || syncStatus === 'error') && (
+             <div className="p-4 rounded-lg border border-red-500/20 bg-red-500/5 space-y-3">
+               <div className="flex items-start space-x-2">
+                 <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
+                 <div className="space-y-1">
+                   <p className="text-red-400 text-[10px] uppercase tracking-widest font-black">
+                     {uploadError ? 'Upload Failed' : 'Submission Failed'}
+                   </p>
+                   <p className="text-red-400/70 text-[10px] leading-relaxed">
+                     {syncError?.message || uploadError || 'An unexpected error occurred.'}
+                   </p>
+                 </div>
+               </div>
+               {syncError?.retryable && memoData?.status === 'transcribed' && (
+                 <button
+                   onClick={handlePushToLedger}
+                   className="w-full py-3 rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 text-[10px] uppercase tracking-widest font-bold hover:bg-red-500/20 transition-all"
+                 >
+                   Retry Submission
+                 </button>
+               )}
+             </div>
+           )}
```

#### 5E. Clear error on dismiss — [App.tsx:396–406](file:///Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/src/App.tsx#L396-L406)

```diff
 // In the Back/Purge button onClick, add:
                  setSyncStatus('idle')
                  setClsReceipt(null)
+                 setSyncError(null)
```

---

## Phase 3 — P2: Operational Confidence & Retention

> **Core problem:** Audio is deleted the instant CLS finishes processing — before anyone can verify extraction quality. History is a flat gallery with no operational grouping. The `useMemoStatus` hook doesn't expose fields needed for receipts.

---

### Task 6: Delay Audio Deletion After Processing

**Assessment refs:** §6

**Problem:** In [functions/src/index.ts:331–348](file:///Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/functions/src/index.ts#L331-L348), when `onClerkJobUpdated` fires with status `DONE`, the function immediately deletes the source audio from Storage and removes `audioURL` / `storagePath` from the Firestore document. During hardening this is dangerous — transcription quality is uneven, extraction may be wrong, and reprocessing becomes impossible.

#### 6A. Replace immediate deletion with retention timestamp — [functions/src/index.ts:326–348](file:///Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/functions/src/index.ts#L326-L348)

```diff
 // functions/src/index.ts — onClerkJobUpdated, inside the DONE handler
        try {
          const memoRef = db.collection(`users/${newValue.userId}/voice_memos`).doc(memoId);
-         const memoSnap = await memoRef.get();

          await memoRef.update({
            status: 'processed',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
+           // Retain audio for 14 days to allow quality verification and reprocessing
+           audioRetainedUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          });

-         // Retention policy: Clean up raw audio once successfully processed by CLS
-         if (memoSnap.exists) {
-           const memoData = memoSnap.data();
-           if (memoData?.storagePath) {
-             try {
-               const bucket = admin.storage().bucket(); // gets default bucket
-               await bucket.file(memoData.storagePath).delete();
-               console.log(`Successfully cleaned up raw audio: ${memoData.storagePath}`);
-
-               // Also remove it from firestore doc to reflect it's gone
-               await memoRef.update({
-                 audioURL: admin.firestore.FieldValue.delete(),
-                 storagePath: admin.firestore.FieldValue.delete(),
-               });
-             } catch (storageError) {
-               console.error(`Failed to delete raw audio ${memoData.storagePath}:`, storageError);
-             }
-           }
-         }
+         console.log(`Memo ${memoId} marked as processed. Audio retained until ${new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()}.`);
        } catch (error) {
```

#### 6B. (Future — not blocking) Scheduled cleanup function

When you're confident in extraction quality, add a scheduled Cloud Function:

```typescript
// Future: functions/src/cleanupRetainedAudio.ts (NOT part of this PR)
// Runs daily via Cloud Scheduler
// Queries: voice_memos where audioRetainedUntil < now AND status === 'processed'
// For each: delete Storage file, remove audioURL + storagePath fields
// This is documented here for planning — implement when pipeline is stable.
```

> [!IMPORTANT]
> The immediate goal is to **stop premature deletion**. The cleanup function is a follow-up task — not required for this phase.

---

### Task 7: Restructure History as an Operational Queue

**Assessment refs:** §7

**Problem:** [HistoryView.tsx](file:///Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/src/HistoryView.tsx) renders all memos in a single flat list sorted by date. There's no distinction between memos that need attention and memos that are done. Users can't tell at a glance what requires action.

#### 7A. Group memos by operational status — [HistoryView.tsx:55–98](file:///Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/src/HistoryView.tsx#L55-L98)

**Add grouping logic after the hooks, before the return:**

```diff
 // HistoryView.tsx — after line 10 (after the useMemoHistory call)
  const { memos, isLoading, error } = useMemoHistory()
+
+ // Group memos into operational sections
+ const needsAttention = memos.filter(m => ['recorded', 'transcribed', 'error'].includes(m.status))
+ const inProgress = memos.filter(m => ['transcribing', 'submitted'].includes(m.status))
+ const completed = memos.filter(m => m.status === 'processed')
```

#### 7B. Replace the flat list with sectioned rendering — [HistoryView.tsx:55–99](file:///Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/src/HistoryView.tsx#L55-L99)

Replace the entire `<div className="space-y-3">` block:

```diff
-     <div className="space-y-3">
-       {isLoading ? (
-         Array.from({ length: 5 }).map((_, i) => (
-           <div key={i} className="h-24 w-full glass-panel rounded-2xl animate-pulse" />
-         ))
-       ) : memos.length === 0 ? (
-         <div className="flex flex-col items-center justify-center py-20 space-y-4 glass-panel rounded-2xl border-dashed">
-           <Clock size={40} className="text-white/10" />
-           <p className="text-xs uppercase tracking-widest font-black text-white/20">No entries recorded</p>
-         </div>
-       ) : (
-         memos.map((memo) => (
-           <button
-             key={memo.id}
-             onClick={() => onSelectMemo(memo.id)}
-             className="w-full glass-panel rounded-2xl p-5 text-left transition-all hover:bg-white/5 active:scale-[0.98] group relative overflow-hidden"
-           >
-             {/* ... existing card content ... */}
-           </button>
-         ))
-       )}
-     </div>
+     <div className="space-y-6">
+       {isLoading ? (
+         Array.from({ length: 5 }).map((_, i) => (
+           <div key={i} className="h-24 w-full glass-panel rounded-2xl animate-pulse" />
+         ))
+       ) : memos.length === 0 ? (
+         <div className="flex flex-col items-center justify-center py-20 space-y-4 glass-panel rounded-2xl border-dashed">
+           <Clock size={40} className="text-white/10" />
+           <p className="text-xs uppercase tracking-widest font-black text-white/20">No entries recorded</p>
+         </div>
+       ) : (
+         <>
+           {/* === NEEDS ATTENTION === */}
+           {needsAttention.length > 0 && (
+             <div className="space-y-3">
+               <div className="flex items-center space-x-2 px-1">
+                 <div className="w-1.5 h-1.5 rounded-full bg-amber-400" style={{ boxShadow: '0 0 8px rgba(251,191,36,0.8)' }} />
+                 <p className="text-[9px] uppercase tracking-[0.3em] font-black text-amber-400/60">
+                   Needs Attention ({needsAttention.length})
+                 </p>
+               </div>
+               {needsAttention.map((memo) => renderMemoCard(memo))}
+             </div>
+           )}
+
+           {/* === IN PROGRESS === */}
+           {inProgress.length > 0 && (
+             <div className="space-y-3">
+               <div className="flex items-center space-x-2 px-1">
+                 <div className="w-1.5 h-1.5 rounded-full bg-[#00DBE7] animate-pulse" style={{ boxShadow: '0 0 8px rgba(0,219,231,0.8)' }} />
+                 <p className="text-[9px] uppercase tracking-[0.3em] font-black text-[#00DBE7]/60">
+                   In Progress ({inProgress.length})
+                 </p>
+               </div>
+               {inProgress.map((memo) => renderMemoCard(memo))}
+             </div>
+           )}
+
+           {/* === COMPLETED === */}
+           {completed.length > 0 && (
+             <div className="space-y-3">
+               <div className="flex items-center space-x-2 px-1">
+                 <div className="w-1.5 h-1.5 rounded-full bg-[#00FF94]" style={{ boxShadow: '0 0 8px rgba(0,255,148,0.8)' }} />
+                 <p className="text-[9px] uppercase tracking-[0.3em] font-black text-[#00FF94]/60">
+                   Completed ({completed.length})
+                 </p>
+               </div>
+               {completed.map((memo) => renderMemoCard(memo))}
+             </div>
+           )}
+         </>
+       )}
+     </div>
```

#### 7C. Extract the memo card into a helper function — [HistoryView.tsx](file:///Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/src/HistoryView.tsx)

**Add this function inside the component, before the `return`:**

```diff
+ // HistoryView.tsx — helper function before the return statement
+ const getActionHint = (status: string) => {
+   switch (status) {
+     case 'transcribed': return 'Tap to review & ingest'
+     case 'error': return 'Tap to retry'
+     case 'recorded': return 'Awaiting transcription'
+     case 'transcribing': return 'Processing...'
+     case 'submitted': return 'CLS processing...'
+     case 'processed': return 'In your Cognitive Ledger'
+     default: return ''
+   }
+ }
+
+ const renderMemoCard = (memo: VoiceMemo) => (
+   <button
+     key={memo.id}
+     onClick={() => onSelectMemo(memo.id)}
+     className="w-full glass-panel rounded-2xl p-5 text-left transition-all hover:bg-white/5 active:scale-[0.98] group relative overflow-hidden"
+   >
+     <div className="flex justify-between items-start mb-3">
+       <div className="flex items-center space-x-2">
+         <div className={`text-[9px] font-mono px-2 py-0.5 rounded uppercase border ${getStatusColor(memo.status)}`}>
+           {memo.status}
+         </div>
+         {memo.captureMode && (
+           <div className="text-[9px] font-mono bg-white/5 text-white/40 px-2 py-0.5 rounded uppercase border border-white/5">
+             {memo.captureMode}
+           </div>
+         )}
+       </div>
+       <span className="text-[9px] font-mono text-white/20">
+         {memo.createdAt?.toDate ? new Date(memo.createdAt.toDate()).toLocaleDateString() : 'Just now'}
+       </span>
+     </div>
+
+     <div className="flex items-center justify-between">
+       <p className="text-sm font-medium text-white/70 line-clamp-2 italic pr-4">
+         {memo.transcriptText || (memo.status === 'error' ? 'Failed to process signal' : 'Extracting semantics...')}
+       </p>
+       {memo.status === 'transcribed' ? (
+         <span className="text-[9px] font-bold uppercase tracking-widest text-amber-400 whitespace-nowrap shrink-0">Ingest →</span>
+       ) : (
+         <ChevronRight size={16} className="text-white/10 group-hover:text-white/30 transition-colors shrink-0" />
+       )}
+     </div>
+
+     {/* Action hint line */}
+     <p className="text-[8px] uppercase tracking-widest text-white/20 mt-2 font-bold">
+       {getActionHint(memo.status)}
+     </p>
+
+     <div className="absolute left-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-[#00DBE7]/20 to-transparent w-full opacity-0 group-hover:opacity-100 transition-opacity" />
+   </button>
+ )
```

#### 7D. Update the `VoiceMemo` type import — [HistoryView.tsx:1](file:///Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/src/HistoryView.tsx#L1)

```diff
-import { useMemoHistory } from './hooks/useMemoHistory'
+import { useMemoHistory, VoiceMemo } from './hooks/useMemoHistory'
```

This is needed because the `renderMemoCard` helper now takes a typed `VoiceMemo` parameter.

---

### Task 8: Extend `useMemoStatus` to Expose Receipt-Ready Fields

**Assessment refs:** §8, Recommendations/Higher-Leverage §3

**Problem:** The `MemoStatus` interface in [useMemoStatus.ts:5–14](file:///Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/src/hooks/useMemoStatus.ts#L5-L14) doesn't expose `submittedAt`, `clerkJobId`, or `audioRetainedUntil` — fields that are already written to Firestore by the backend. The receipt card from Task 2 works via local state, but if the user navigates away and comes back via History, the receipt data would be lost. Exposing these fields from Firestore makes receipts persistent.

#### 8A. Extend the MemoStatus interface — [useMemoStatus.ts:5–14](file:///Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/src/hooks/useMemoStatus.ts#L5-L14)

```diff
 export interface MemoStatus {
   status: 'uploading' | 'recorded' | 'transcribing' | 'transcribed' | 'error' | 'submitted' | 'processed';
   transcriptText?: string;
   rawTranscriptText?: string;
   transcriptProvider?: string;
   transcriptModel?: string;
   transcriptLanguage?: string;
   transcriptConfidence?: number | null;
   errorDetails?: string;
+  submittedAt?: string;
+  clerkJobId?: string;
+  captureMode?: string;
+  audioRetainedUntil?: string;
 }
```

No other code changes needed — the `onSnapshot` listener already casts `docSnap.data() as MemoStatus`, so any new fields present in Firestore will automatically populate.

#### 8B. Use Firestore-sourced receipt as fallback in App.tsx — [App.tsx](file:///Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/src/App.tsx)

In the receipt card from Task 2D, make it work even when `clsReceipt` local state is null (e.g. user came back from History):

```diff
 // App.tsx — in the processed receipt card (from Task 2D)
 // Replace the clsReceipt condition with a fallback to memoData
-                       {clsReceipt && (
+                       {(clsReceipt || memoData?.clerkJobId) && (
                           <div className="grid grid-cols-2 gap-2 text-[9px] font-mono">
                             <div>
                               <span className="text-[#00FF94]/50 uppercase block">Raw Turn</span>
-                             <span className="text-[#00FF94]/80 truncate block">{clsReceipt.rawTurnId}</span>
+                             <span className="text-[#00FF94]/80 truncate block">{clsReceipt?.rawTurnId || `voice-${lastMemoId}`}</span>
                             </div>
                             <div>
                               <span className="text-[#00FF94]/50 uppercase block">Clerk Job</span>
-                             <span className="text-[#00FF94]/80 truncate block">{clsReceipt.clerkJobId}</span>
+                             <span className="text-[#00FF94]/80 truncate block">{clsReceipt?.clerkJobId || memoData?.clerkJobId}</span>
                             </div>
                             <div className="col-span-2">
                               <span className="text-[#00FF94]/50 uppercase block">Submitted</span>
-                             <span className="text-[#00FF94]/80">{clsReceipt.submittedAt}</span>
+                             <span className="text-[#00FF94]/80">{clsReceipt?.submittedAt || memoData?.submittedAt || '—'}</span>
                             </div>
                           </div>
                         )}
```

**Why:** Now when a user taps a `processed` memo from History, the receipt card will render using Firestore data even though the original `clsReceipt` local state was never set for that session.

---

## Phase 4 — P3: Semantic Bridge & Product Modes

> **Core problem:** The `captureMode` selected in the UI is stored as metadata but never fed into the CLS extraction prompt. Low-risk memos like `idea` still require the full manual review cycle.

---

### Task 9: Feed `captureMode` into the CLS Extraction Prompt

**Assessment refs:** §5

**Problem:** In [functions/src/index.ts:196–236](file:///Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/functions/src/index.ts#L196-L236), the `captureMode` is stored in `rawTurn.metadata.captureMode` but the `messages` array only contains a single `role: 'user'` message with the transcript text. The CLS clerk reads from `rawTurn.messages` for extraction — it never sees the capture intent. This means a `reminder` and an `idea` get identical extraction treatment.

#### 9A. Add a system message carrying capture intent — [functions/src/index.ts:202–208](file:///Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/functions/src/index.ts#L202-L208)

```diff
 // functions/src/index.ts — inside submitMemoToLedger, the rawTurn construction
  const rawTurn: RawTurn = {
    id: rawTurnId,
    userId: context.auth.uid,
    ledgerStreamId: 'voice_memos',
    conversationId: `voice-memo-${memoId}`,
    turnId: `turn-1`,
    sequenceNumber: 1,
    messages: [
+     {
+       role: 'system',
+       content: `This voice memo was captured with intent type: "${captureModeValue}". ` +
+         `Consider this classification when extracting ledger events. ` +
+         `For example: "reminder" should produce reminder-type events, ` +
+         `"decision" should produce decision records, ` +
+         `"correction" should produce correction/amendment events.`,
+     },
      {
        role: 'user',
        content: finalTranscriptText,
      }
    ],
```

**Why:** The `Message` type in [types.ts:1–4](file:///Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/functions/src/types.ts#L1-L4) already supports `role: 'system'`. The CLS clerk's extraction prompt reads all messages — adding a system message is the lowest-friction way to carry intent without changing the clerk code.

#### 9B. Verify the Message type supports 'system' — [functions/src/types.ts:1–4](file:///Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/functions/src/types.ts#L1-L4)

```typescript
// Already correct — no change needed:
export interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
}
```

✅ The `system` role is already in the union type. No change required.

> [!NOTE]
> For full effectiveness, the CLS clerk worker in the main MemLumina repo should be verified to include `system` messages when building its extraction prompt. If it filters to `role === 'user'` only, a parallel change is needed there. That is outside this repo's scope but should be noted as a dependency.

---

### Task 10: Introduce Quick-Capture Auto-Submit Mode

**Assessment refs:** Recommendations/Higher-Leverage §1

**Problem:** Every memo, regardless of type, requires the user to manually tap "Verify & Ingest" after transcription. For low-risk captures like a quick `idea` or `project_note`, this creates unnecessary friction. The user should be able to record, put the phone down, and trust that the memo will reach CLS automatically.

#### 10A. Define auto-submittable modes — [App.tsx](file:///Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/src/App.tsx)

```diff
 // App.tsx — after the CaptureMode type (after line 12)
 type CaptureMode = 'idea' | 'instruction' | 'reminder' | 'decision' | 'correction' | 'project_note'

+// Modes that auto-submit after transcription (low-risk, no review needed)
+const AUTO_SUBMIT_MODES: CaptureMode[] = ['idea', 'project_note']
+
+// Modes that require manual review before ingestion
+const REVIEW_REQUIRED_MODES: CaptureMode[] = ['instruction', 'reminder', 'decision', 'correction']
```

#### 10B. Add a user-controlled toggle — [App.tsx](file:///Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/src/App.tsx)

```diff
 // App.tsx — new state after the clsReceipt state
+ const [autoIngestEnabled, setAutoIngestEnabled] = useState<boolean>(() => {
+   const stored = localStorage.getItem('memlumina-auto-ingest')
+   return stored !== null ? stored === 'true' : true // default ON
+ })
+
+ // Persist toggle
+ useEffect(() => {
+   localStorage.setItem('memlumina-auto-ingest', String(autoIngestEnabled))
+ }, [autoIngestEnabled])
```

#### 10C. Auto-submit watcher effect — [App.tsx](file:///Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/src/App.tsx)

**Add a new `useEffect` after the existing `memoData` effects (after line 51):**

```diff
+ // Auto-submit for low-risk modes when transcription completes
+ useEffect(() => {
+   if (
+     autoIngestEnabled &&
+     lastMemoId &&
+     memoData?.status === 'transcribed' &&
+     syncStatus !== 'uploading' &&
+     syncStatus !== 'submitted' &&
+     AUTO_SUBMIT_MODES.includes(selectedMode)
+   ) {
+     console.log(`Auto-submitting ${selectedMode} memo ${lastMemoId}`)
+     handlePushToLedger()
+   }
+ }, [memoData?.status, autoIngestEnabled, lastMemoId, selectedMode, syncStatus])
```

> [!WARNING]
> `handlePushToLedger` is used inside a `useEffect`. Ensure it is either stable (wrapped in `useCallback`) or add it to the dependency array. Currently it's defined as a plain `async` function — it should be wrapped in `useCallback` for correctness. See 10F below.

#### 10D. Mode label indicator — [App.tsx:376–392](file:///Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/src/App.tsx#L376-L392)

**Add a visual indicator above the mode grid showing whether the selected mode will auto-submit:**

```diff
 // App.tsx — the Classification Modes section
            {/* Classification Modes */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <p className="text-[10px] uppercase tracking-[0.2em] font-black text-white/30">Schema Classification</p>
-               <Info size={12} className="text-white/20" />
+               {autoIngestEnabled && AUTO_SUBMIT_MODES.includes(selectedMode) ? (
+                 <span className="text-[8px] uppercase tracking-widest font-bold text-[#00FF94]/60 bg-[#00FF94]/10 px-2 py-0.5 rounded">
+                   Auto-Ingest
+                 </span>
+               ) : (
+                 <span className="text-[8px] uppercase tracking-widest font-bold text-white/20 bg-white/5 px-2 py-0.5 rounded">
+                   Review Required
+                 </span>
+               )}
              </div>
```

#### 10E. Settings toggle in diagnostics — [App.tsx:228](file:///Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/src/App.tsx#L228)

**Add a toggle inside the diagnostics panel, after the subsystem grid (after line 227):**

```diff
 // App.tsx — inside the diagnostics glass-panel, after the subsystem grid
+             <div className="h-[1px] bg-white/5 w-full" />
+             <div className="flex justify-between items-center">
+               <div>
+                 <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold block">Auto-Ingest</span>
+                 <span className="text-[8px] text-white/20">Auto-submit idea & project_note memos</span>
+               </div>
+               <button
+                 onClick={() => setAutoIngestEnabled(!autoIngestEnabled)}
+                 className={`w-10 h-5 rounded-full transition-all relative ${
+                   autoIngestEnabled ? 'bg-[#00FF94]/30' : 'bg-white/10'
+                 }`}
+               >
+                 <div className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${
+                   autoIngestEnabled ? 'left-5 bg-[#00FF94]' : 'left-0.5 bg-white/40'
+                 }`} />
+               </button>
+             </div>
```

#### 10F. Wrap `handlePushToLedger` in useCallback — [App.tsx:85–114](file:///Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/src/App.tsx#L85-L114)

This is needed for the auto-submit `useEffect` to work correctly:

```diff
-  const handlePushToLedger = async () => {
+  const handlePushToLedger = useCallback(async () => {
     if (!lastMemoId) return
     setSyncStatus('uploading')
     setSyncError(null)
     try {
       const submitFn = httpsCallable(functions, 'submitMemoToLedger')
       const result = await submitFn({
         memoId: lastMemoId,
         captureMode: selectedMode,
         reviewedByUser: !AUTO_SUBMIT_MODES.includes(selectedMode),  // false for auto-submit
         source: 'MemLumina-Voice-Capture',
         submittedFrom: 'web',
         capturedAt: new Date().toISOString(),
         editedTranscriptText: editedTranscript !== memoData?.transcriptText ? editedTranscript : undefined
       })
       const receiptData = result.data as any
       setClsReceipt({
         rawTurnId: receiptData.rawTurnId,
         clerkJobId: receiptData.clerkJobId,
         submittedAt: new Date().toISOString(),
       })
       setSyncStatus('submitted')
       localStorage.removeItem(`draft-${lastMemoId}`)
     } catch (err: any) {
       console.error('Submission to CLS failed', err)
       setSyncStatus('error')
       // ... error classification from Task 5B ...
     }
-  }
+  }, [lastMemoId, selectedMode, editedTranscript, memoData?.transcriptText])
```

**Also update the `reviewedByUser` field** to reflect whether the user actually reviewed or it was auto-submitted:

```diff
        reviewedByUser: true,
+       // Changes to:
        reviewedByUser: !AUTO_SUBMIT_MODES.includes(selectedMode),
```

---

### Task 11: (Deferred) Retrieval Verification Loop

**Assessment refs:** Recommendations/Higher-Leverage §4

This task is **documented but deferred** — it requires changes in the main MemLumina project to expose a "has this memo been retrieved?" signal back to the companion app.

**Concept:** After a memo reaches `processed`, the companion app would periodically check (or listen for) a signal from the main MemLumina system indicating that the memo's ledger events have been retrieved or surfaced. This would transition the memo to an `acknowledged` status, triggering the retention policy from the assessment's Memo Surface Policy (remove from active surface after 24 hours).

**Dependencies:**
- Main MemLumina project must write an `acknowledged` or `accessed` signal back to the user's CLS data
- The companion app needs a listener or polling mechanism for that signal
- The `VoiceMemo` type needs a new `acknowledged` status

**Not blocking any other task.** Document and revisit after the CLS retrieval path is mature.

---

## Full Summary

| # | Task | Phase | Files Modified | Complexity |
|---|------|-------|---------------|------------|
| 1 | Reword status labels & icons | P0 | App.tsx, HistoryView.tsx | Low |
| 2 | Remove auto-dismiss + CLS receipt | P0 | App.tsx | Low |
| 3 | Surface recorder errors | P1 | useVoiceRecorder.ts, App.tsx | Medium |
| 4 | Fix diagnostics labels | P1 | App.tsx | Low |
| 5 | Submission error visibility + retry | P1 | App.tsx | Medium |
| 6 | Delay audio deletion | P2 | functions/src/index.ts | Low |
| 7 | History as operational queue | P2 | HistoryView.tsx | Medium-High |
| 8 | Extend useMemoStatus interface | P2 | useMemoStatus.ts, App.tsx | Low |
| 9 | Feed captureMode to extraction | P3 | functions/src/index.ts | Low |
| 10 | Quick-capture auto-submit | P3 | App.tsx | High |
| 11 | Retrieval verification loop | P3 | Deferred | — |

### New Files Created: None

All changes are modifications to existing files. No new components or modules are introduced.

### New Dependencies: None

All changes use existing libraries (lucide-react icons, Firebase SDK, React hooks). No new npm packages required.

### Backend Deployment Required For:
- Task 6 (audio retention) — redeploy `onClerkJobUpdated`
- Task 9 (system message) — redeploy `submitMemoToLedger`

### Frontend-Only Tasks:
- Tasks 1, 2, 3, 4, 5, 7, 8, 10

> [!TIP]
> **Recommended git strategy:** One commit per task, one PR per phase. This keeps reviews focused and rollbacks clean.

---

## Phase 5 — Staged Audio Filing (Local-First Capture)

**Source:** [staged-audio-filing-implementation-plan-2026-05-11.md](file:///Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/docs/staged-audio-filing-implementation-plan-2026-05-11.md)

> **Core problem:** The current `uploadMemo()` flow tries to write to Firestore and upload to Storage in a single operation. If the network is unavailable, the fallback to IDB exists but is a catch-block afterthought, not the primary path. The capture should be durable on-device *first*, with upload as a recoverable second step.

> [!IMPORTANT]
> This phase reinforces **Product Principle §2: Local-First Reliability** from the assessment. Recording must not depend on network quality or backend availability.

---

### Task 12: Always Stage Audio Locally First

**Staged Audio Plan refs:** Tasks 1, 3

**Problem:** In [useMemoUpload.ts:70–128](file:///Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/src/hooks/useMemoUpload.ts#L70-L128), the online path calls `performUpload()` directly. IDB is only used as a fallback when offline or on error. This means the happy path has zero local durability — if the browser tab closes during upload, the audio is lost.

#### 12A. Refactor `uploadMemo` to always stage first — [useMemoUpload.ts:70–128](file:///Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/src/hooks/useMemoUpload.ts#L70-L128)

```diff
  const uploadMemo = useCallback(async (blob: Blob, captureMode: string) => {
    const user = auth.currentUser;
    if (!user) {
      setError('User not authenticated');
      return null;
    }

    setIsUploading(true);
    setError(null);

    const voiceMemosRef = collection(db, `users/${user.uid}/voice_memos`);
    const memoId = doc(voiceMemosRef).id;

-   if (!navigator.onLine) {
-     // Offline: store to IDB
-     try {
-       await set(`offline-memo-${memoId}`, {
-         userId: user.uid,
-         memoId,
-         blob,
-         captureMode,
-         timestamp: Date.now()
-       });
-       setIsUploading(false);
-       // We return memoId to UI so it can reflect "saved offline" state
-       return memoId;
-     } catch (err: any) {
-       console.error('Failed to save memo offline', err);
-       setError('Failed to save memo offline');
-       setIsUploading(false);
-       return null;
-     }
-   }
-
-   try {
-     await performUpload(user.uid, memoId, blob, captureMode);
-     setIsUploading(false);
-     return memoId;
-   } catch (err: any) {
-     console.error('Upload failed', err);
-
-     // If it failed due to network, try saving offline as fallback
-     try {
-        await set(`offline-memo-${memoId}`, {
-         userId: user.uid,
-         memoId,
-         blob,
-         captureMode,
-         timestamp: Date.now()
-       });
-       setIsUploading(false);
-       return memoId;
-     } catch (idbErr) {
-       setError(err.message || 'Upload failed');
-       setIsUploading(false);
-       return null;
-     }
-   }
+   // === STEP 1: Always stage locally first ===
+   try {
+     await set(`staged-memo-${memoId}`, {
+       userId: user.uid,
+       memoId,
+       blob,
+       captureMode,
+       timestamp: Date.now(),
+       storageState: 'local',  // local → uploading → stored
+     });
+     console.log(`Memo ${memoId} staged locally`);
+   } catch (idbErr: any) {
+     console.error('Failed to stage memo locally', idbErr);
+     setError('Failed to save recording on device');
+     setIsUploading(false);
+     return null;
+   }
+
+   // === STEP 2: Attempt upload if online ===
+   if (navigator.onLine) {
+     try {
+       await performUpload(user.uid, memoId, blob, captureMode);
+       // Don't delete IDB yet — wait until memo is processed (Task 13)
+       // Just mark storageState as 'stored'
+       const staged = await get(`staged-memo-${memoId}`);
+       if (staged) {
+         await set(`staged-memo-${memoId}`, { ...staged, storageState: 'stored' });
+       }
+       console.log(`Memo ${memoId} uploaded successfully, local copy retained`);
+     } catch (err: any) {
+       console.error('Upload failed, memo remains staged locally', err);
+       // Memo is safely in IDB — no error to user, just log
+     }
+   } else {
+     console.log(`Offline — memo ${memoId} queued for later upload`);
+   }
+
+   setIsUploading(false);
+   return memoId;
  }, []);
```

**Key changes:**
- IDB write is now the **first** operation, not a fallback
- IDB key changes from `offline-memo-` to `staged-memo-` to reflect the new role
- Upload failure no longer needs a separate IDB save — it's already there
- `storageState` field tracks the staging lifecycle

#### 12B. Update `syncOfflineMemos` to handle staged keys — [useMemoUpload.ts:44–62](file:///Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/src/hooks/useMemoUpload.ts#L44-L62)

```diff
  const syncOfflineMemos = useCallback(async () => {
    if (!navigator.onLine) return;

    const allKeys = await keys();
-   const memoKeys = allKeys.filter(k => typeof k === 'string' && k.startsWith('offline-memo-'));
+   // Sync both legacy offline-memo- keys and new staged-memo- keys
+   const memoKeys = allKeys.filter(k =>
+     typeof k === 'string' && (k.startsWith('offline-memo-') || k.startsWith('staged-memo-'))
+   );

    for (const key of memoKeys) {
      const data = await get(key);
-     if (data && data.userId && data.memoId && data.blob && data.captureMode) {
+     if (data && data.userId && data.memoId && data.blob && data.captureMode && data.storageState !== 'stored') {
        try {
          await performUpload(data.userId, data.memoId, data.blob, data.captureMode);
-         await del(key); // clear after successful upload
-         console.log(`Successfully synced offline memo: ${data.memoId}`);
+         // Mark as stored but don't delete — retention handled by Task 13
+         await set(key, { ...data, storageState: 'stored' });
+         console.log(`Successfully synced staged memo: ${data.memoId}`);
        } catch (err) {
-         console.error(`Failed to sync offline memo: ${data.memoId}`, err);
+         console.error(`Failed to sync staged memo: ${data.memoId}`, err);
        }
      }
    }
  }, []);
```

---

### Task 13: Retain Staged Audio Until Safe Handoff

**Staged Audio Plan refs:** Task 4

**Problem:** Currently, IDB entries are deleted immediately after upload (`await del(key)`). With the staged model, the local blob should persist until the memo reaches a safe terminal state (`processed`), because:
- Transcription quality is uneven
- Reprocessing may be needed
- The user might need to replay the audio

#### 13A. Add cleanup function — [useMemoUpload.ts](file:///Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/src/hooks/useMemoUpload.ts)

**Add a new exported function:**

```diff
+ // useMemoUpload.ts — new function, add before the return statement
+ const clearStagedMemo = useCallback(async (memoId: string) => {
+   try {
+     await del(`staged-memo-${memoId}`);
+     // Also clean legacy key if present
+     await del(`offline-memo-${memoId}`);
+     console.log(`Cleared staged audio for memo: ${memoId}`);
+   } catch (err) {
+     console.error(`Failed to clear staged memo ${memoId}:`, err);
+   }
+ }, []);
```

```diff
- return { uploadMemo, isUploading, error, syncOfflineMemos };
+ return { uploadMemo, isUploading, error, syncOfflineMemos, clearStagedMemo };
```

#### 13B. Call cleanup when memo reaches `processed` — [App.tsx](file:///Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/src/App.tsx)

```diff
 // App.tsx — destructure the new function
-const { uploadMemo, isUploading, error: uploadError, syncOfflineMemos } = useMemoUpload()
+const { uploadMemo, isUploading, error: uploadError, syncOfflineMemos, clearStagedMemo } = useMemoUpload()
```

```diff
 // App.tsx — add a useEffect that cleans up when memo is processed
+useEffect(() => {
+  if (lastMemoId && memoData?.status === 'processed') {
+    clearStagedMemo(lastMemoId);
+  }
+}, [lastMemoId, memoData?.status, clearStagedMemo])
```

---

### Task 14: Add `storageState` to Firestore Memo Document

**Staged Audio Plan refs:** Tasks 2, 3

**Problem:** The Firestore memo document currently has no field tracking whether the audio is local-only, uploading, or safely stored in Cloud Storage. Adding `storageState` allows the UI to show storage status independently from transcription status.

#### 14A. Update `performUpload` to write `storageState` — [useMemoUpload.ts:11–42](file:///Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/src/hooks/useMemoUpload.ts#L11-L42)

```diff
  const performUpload = async (userId: string, memoId: string, blob: Blob, captureMode: string) => {
    const voiceMemosRef = collection(db, `users/${userId}/voice_memos`);
    const memoDocRef = doc(voiceMemosRef, memoId);

    // Initial record creation
    await setDoc(memoDocRef, {
      userId,
      memoId,
-     status: 'uploading',
+     status: 'recorded',
      captureMode,
      audioContentType: blob.type,
+     storageState: 'uploading',
+     audioStaged: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Upload to Storage
    const fileExtension = blob.type.includes('mp4') ? 'mp4' : 'webm';
    const storagePath = `uploads/${userId}/memos/${memoId}.${fileExtension}`;
    const storageRef = ref(storage, storagePath);

    await uploadBytes(storageRef, blob);
    const downloadURL = await getDownloadURL(storageRef);

    // Update with final details
    await updateDoc(memoDocRef, {
      audioURL: downloadURL,
      storagePath,
-     status: 'recorded',
+     storageState: 'stored',
      updatedAt: serverTimestamp(),
    });
  };
```

**Key change:** The initial Firestore doc now gets `status: 'recorded'` immediately (not `uploading` — that was a transcription pipeline status, not a storage status). The new `storageState` field tracks the storage lifecycle separately.

#### 14B. Extend `MemoStatus` and `VoiceMemo` types

```diff
 // useMemoStatus.ts — add to MemoStatus interface
+  storageState?: 'local' | 'uploading' | 'stored';
+  audioStaged?: boolean;
```

```diff
 // useMemoHistory.ts — add to VoiceMemo interface
+  storageState?: 'local' | 'uploading' | 'stored'
```

---

### Task 15: Show Storage State in the UI

**Staged Audio Plan refs:** Tasks 5, 7

**Problem:** The UI currently has no concept of upload state separate from transcription state. A memo can be `recorded` but the audio might still be local-only.

#### 15A. Storage state indicator in HistoryView memo cards — [HistoryView.tsx](file:///Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/src/HistoryView.tsx)

**In the `renderMemoCard` helper (from Task 7C), add a storage badge:**

```diff
 // Inside renderMemoCard, after the status/captureMode badges row
+       {memo.storageState && memo.storageState !== 'stored' && (
+         <div className={`text-[8px] font-mono px-1.5 py-0.5 rounded uppercase border mt-1 inline-block ${
+           memo.storageState === 'local'
+             ? 'text-yellow-500/70 bg-yellow-500/10 border-yellow-500/20'
+             : 'text-[#00DBE7]/70 bg-[#00DBE7]/10 border-[#00DBE7]/20'
+         }`}>
+           {memo.storageState === 'local' ? '📱 Local Only' : '↑ Uploading'}
+         </div>
+       )}
```

#### 15B. Retry upload action for stuck local memos — [HistoryView.tsx](file:///Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/src/HistoryView.tsx)

**Update the `getActionHint` function (from Task 7C):**

```diff
  const getActionHint = (status: string) => {
    switch (status) {
-     case 'recorded': return 'Awaiting transcription'
+     case 'recorded': return 'Tap to view'
      // ... other cases
    }
  }
```

**In the `renderMemoCard` helper, update the action hint to be storage-aware:**

```diff
     {/* Action hint line */}
-    <p className="text-[8px] uppercase tracking-widest text-white/20 mt-2 font-bold">
-      {getActionHint(memo.status)}
-    </p>
+    <p className="text-[8px] uppercase tracking-widest text-white/20 mt-2 font-bold">
+      {memo.storageState === 'local'
+        ? 'Audio saved on device — pending upload'
+        : getActionHint(memo.status)}
+    </p>
```

#### 15C. Storage state in the review panel — [App.tsx](file:///Users/issamchabaa/Documents/dev/MemLumina-Voice-Memo/src/App.tsx)

**In the review panel, after the offline queue indicator (around line 344), add a storage state notice:**

```diff
+               {lastMemoId && memoData?.storageState === 'local' && navigator.onLine && (
+                 <div className="flex items-center space-x-2 text-yellow-500 bg-yellow-500/10 p-3 rounded-lg border border-yellow-500/20">
+                   <Database size={16} />
+                   <div className="space-y-0.5">
+                     <span className="text-[10px] uppercase font-bold tracking-widest block">Audio Saved Locally</span>
+                     <span className="text-[9px] text-yellow-500/60 block">Upload will retry automatically</span>
+                   </div>
+                 </div>
+               )}
```

---

## Updated Full Summary

| # | Task | Phase | Files Modified | Complexity |
|---|------|-------|---------------|------------|
| 1 | Reword status labels & icons | P0 | App.tsx, HistoryView.tsx | Low |
| 2 | Remove auto-dismiss + CLS receipt | P0 | App.tsx | Low |
| 3 | Surface recorder errors | P1 | useVoiceRecorder.ts, App.tsx | Medium |
| 4 | Fix diagnostics labels | P1 | App.tsx | Low |
| 5 | Submission error visibility + retry | P1 | App.tsx | Medium |
| 6 | Delay audio deletion | P2 | functions/src/index.ts | Low |
| 7 | History as operational queue | P2 | HistoryView.tsx | Medium-High |
| 8 | Extend useMemoStatus interface | P2 | useMemoStatus.ts, App.tsx | Low |
| 9 | Feed captureMode to extraction | P3 | functions/src/index.ts | Low |
| 10 | Quick-capture auto-submit | P3 | App.tsx | High |
| 11 | Retrieval verification loop | P3 | Deferred | — |
| 12 | Always stage audio locally first | P4 | useMemoUpload.ts | Medium |
| 13 | Retain staged audio until processed | P4 | useMemoUpload.ts, App.tsx | Low |
| 14 | Add storageState to Firestore | P4 | useMemoUpload.ts, types | Low |
| 15 | Show storage state in UI | P4 | HistoryView.tsx, App.tsx | Medium |

### New Dependencies: None

`idb-keyval` is already installed and used. All changes use existing libraries.

### Backend Deployment Required For:
- Task 6 (audio retention) — redeploy `onClerkJobUpdated`
- Task 9 (system message) — redeploy `submitMemoToLedger`

### Frontend-Only Tasks:
- Tasks 1, 2, 3, 4, 5, 7, 8, 10, 12, 13, 14, 15

> [!TIP]
> **Recommended git strategy:** One commit per task, one PR per phase. This keeps reviews focused and rollbacks clean.


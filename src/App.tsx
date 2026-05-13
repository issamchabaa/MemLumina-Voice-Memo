import { useState, useEffect, useMemo, useCallback } from 'react'
import { Mic, Square, Send, Info, Activity, LogIn, Settings, History, Shield, Cpu, CheckCircle2, AlertCircle, AlertTriangle, Upload, Database, ArrowLeft, RefreshCw, Clock } from 'lucide-react'
import { useVoiceRecorder } from './hooks/useVoiceRecorder'
import { useMemoUpload } from './hooks/useMemoUpload'
import { useMemoStatus } from './hooks/useMemoStatus'
import { auth, functions, db } from './firebase'
import { onAuthStateChanged, User } from 'firebase/auth'
import { doc, setDoc, getDoc } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { HistoryView } from './HistoryView'
import { AuthModal } from './AuthModal'
import { HelpModal } from './HelpModal'

// Capture modes removed as per V2 specification


function App() {
  const [user, setUser] = useState<User | null>(null)
  const [showReview, setShowReview] = useState(false)
  const [lastMemoId, setLastMemoId] = useState<string | null>(null)
  const [isHelpOpen, setIsHelpOpen] = useState(false)
  const [activeView, setActiveView] = useState<'capture' | 'history' | 'diagnostics'>('capture')
  const [clsReceipt, setClsReceipt] = useState<{ rawTurnId: string; clerkJobId: string; submittedAt: string } | null>(null)
  const [syncError, setSyncError] = useState<{ message: string; retryable: boolean } | null>(null)
  const [syncStatus, setSyncStatus] = useState<'idle' | 'uploading' | 'success' | 'error' | 'submitted'>('idle')
  const [editedTranscript, setEditedTranscript] = useState('')
  const [autoSubmitEnabled, setAutoSubmitEnabled] = useState(() => {
    return localStorage.getItem('memlumina-auto-submit') === 'true'
  })
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  const { 
    isRecording, 
    audioBlob, 
    duration, 
    audioLevel, 
    recorderError,
    clearRecorderError,
    startRecording, 
    stopRecording, 
    resetRecording 
  } = useVoiceRecorder()

  const { uploadMemo, retryUpload, isUploading, error: uploadError, syncOfflineMemos } = useMemoUpload()
  const { memoData, isLoading: isMemoLoading } = useMemoStatus(lastMemoId)
  const isSelectedMemoLoading = Boolean(lastMemoId) && isMemoLoading && !memoData
  const canInitializeCapture = !lastMemoId && !!audioBlob
  const canRetryUpload = memoData?.status === 'local-only' && !!lastMemoId
  const canPushToLedger = memoData?.status === 'transcribed'
  const showPrimaryAction = canInitializeCapture || canRetryUpload || canPushToLedger

  const handlePushToLedger = useCallback(async () => {
    if (!lastMemoId) return
    setSyncStatus('uploading')
    setSyncError(null)
    try {
      const submitFn = httpsCallable(functions, 'submitMemoToLedger')
      const result = await submitFn({ 
        memoId: lastMemoId,
        reviewedByUser: !autoSubmitEnabled, // If auto-submit is on, it bypasses manual review
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
      const code = err?.code || ''
      const message = err?.message || ''
      if (code === 'functions/unavailable' || code === 'functions/deadline-exceeded' || !navigator.onLine) {
        setSyncError({ message: 'Network error — check your connection and try again.', retryable: true })
      } else if (code === 'functions/failed-precondition') {
        setSyncError({ message: 'This memo may have already been submitted or is not in the correct state.', retryable: false })
      } else if (code === 'functions/unauthenticated') {
        setSyncError({ message: 'Your session has expired. Please sign in again.', retryable: false })
      } else {
        setSyncError({ message: message || 'Submission failed unexpectedly.', retryable: true })
      }
    }
  }, [lastMemoId, autoSubmitEnabled, editedTranscript, memoData?.transcriptText, functions])

  useEffect(() => {
    syncOfflineMemos()
  }, [syncOfflineMemos])

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('memlumina-auto-submit', String(autoSubmitEnabled))
    if (user) {
      setDoc(doc(db, `users/${user.uid}/settings/capture`), { autoSubmitEnabled }, { merge: true })
    }
  }, [autoSubmitEnabled, user])

  useEffect(() => {
    if (!user) return
    const loadSettings = async () => {
      const settingsRef = doc(db, `users/${user.uid}/settings/capture`)
      const snap = await getDoc(settingsRef)
      if (snap.exists()) {
        setAutoSubmitEnabled(snap.data().autoSubmitEnabled)
      }
    }
    loadSettings()
  }, [user])

  // Auto-Ingest logic
  useEffect(() => {
    if (autoSubmitEnabled && memoData?.status === 'transcribed' && syncStatus !== 'submitted' && syncStatus !== 'uploading') {
      console.log('Auto-ingest triggered for memo:', lastMemoId)
      handlePushToLedger()
    }
  }, [memoData?.status, autoSubmitEnabled, syncStatus, lastMemoId, handlePushToLedger])

  useEffect(() => {
    if (memoData?.transcriptText && !editedTranscript) {
      const savedDraft = lastMemoId ? localStorage.getItem(`draft-${lastMemoId}`) : null
      setEditedTranscript(savedDraft || memoData.transcriptText)
    }
  }, [memoData?.transcriptText, editedTranscript, lastMemoId])

  useEffect(() => {
    if (lastMemoId && editedTranscript && editedTranscript !== memoData?.transcriptText) {
      localStorage.setItem(`draft-${lastMemoId}`, editedTranscript)
    }
  }, [editedTranscript, lastMemoId, memoData?.transcriptText])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user)
    })
    return () => unsubscribe()
  }, [])

  const handleToggleRecording = () => {
    if (isRecording) {
      stopRecording()
      setShowReview(true)
    } else {
      startRecording()
      setShowReview(false)
      setSyncStatus('idle')
      setLastMemoId(null)
      setEditedTranscript('')
    }
  }

  const handleInitializeCapture = async () => {
    if (!audioBlob) return
    setSyncStatus('uploading')
    setSyncError(null)
    const memoId = await uploadMemo(audioBlob)
    if (memoId) {
      setLastMemoId(memoId)
      // Check if it's already 'recorded' (online upload succeeded) 
      // or still 'local-only' (offline or failed upload)
      setSyncStatus('success')
    } else {
      setSyncStatus('error')
    }
  }

  const handleRetryUpload = async (memoId: string) => {
    await retryUpload(memoId);
  }

  const handleSignIn = () => {
    // AuthModal handles sign in
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-between p-6 md:p-10 bg-[#0B0B0C] text-[#F8FAF7] relative overflow-hidden">
      {!isOnline && (
        <div className="absolute top-0 left-0 w-full bg-yellow-500/90 text-[#0B0B0C] py-2 px-4 z-50 flex items-center justify-center space-x-2 shadow-lg shadow-yellow-500/20">
          <Database size={14} />
          <span className="text-[10px] font-black uppercase tracking-widest">Offline Vault Active • Captures stored locally</span>
        </div>
      )}
      {!user && <AuthModal />}
      {/* Ambient Effects */}
      <div className="ambient-glow" />
      
      {/* Technical Header */}
      <header className="w-full max-w-lg flex justify-between items-center z-30">
        <div className="flex flex-col">
          <div className="flex items-center space-x-2">
            <div className={`led-status led-cyan ${isRecording ? 'led-pulse' : ''}`} />
            <h1 className="text-xl font-outfit font-extrabold tracking-tighter uppercase">
              MemLumina <span className="text-[#00DBE7]">Capture</span>
            </h1>
          </div>
          <span className="text-[9px] font-mono text-white/30 tracking-[0.3em] uppercase pl-4">Neural Ingestion Protocol v1.0</span>
        </div>

        <div className="flex items-center space-x-3">
          {!user ? (
            <button 
              onClick={handleSignIn}
              className="px-4 py-2 rounded-lg border border-[#00DBE7]/20 bg-[#00DBE7]/5 hover:bg-[#00DBE7]/10 transition-all text-[10px] font-bold uppercase tracking-widest text-[#00DBE7] flex items-center space-x-2"
            >
              <LogIn size={14} />
              <span>Identity Link</span>
            </button>
          ) : (
            <div className="flex items-center space-x-2">
              <button 
                onClick={() => setIsHelpOpen(true)}
                className="w-10 h-10 rounded-xl glass-panel flex items-center justify-center hover:bg-white/5 transition-colors"
              >
                <Info size={18} className="text-white/40" />
              </button>
              <button 
                onClick={() => setActiveView('history')}
                className={`w-10 h-10 rounded-xl glass-panel flex items-center justify-center hover:bg-white/5 transition-colors ${activeView === 'history' ? 'bg-white/10 ring-1 ring-white/20' : ''}`}
              >
                <History size={18} className={activeView === 'history' ? 'text-[#00DBE7]' : 'text-white/40'} />
              </button>
              <button 
                onClick={() => setActiveView(activeView === 'diagnostics' ? 'capture' : 'diagnostics')}
                className={`w-10 h-10 rounded-xl glass-panel flex items-center justify-center hover:bg-white/5 transition-colors ${activeView === 'diagnostics' ? 'bg-white/10 ring-1 ring-white/20' : ''}`}
              >
                <Settings size={18} className={activeView === 'diagnostics' ? 'text-[#00DBE7]' : 'text-white/40'} />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Cockpit Area */}
      <main className="flex-1 w-full max-w-lg flex flex-col items-center justify-center space-y-12 z-20">
        {activeView === 'history' ? (
          <HistoryView 
            onBack={() => setActiveView('capture')} 
            onSelectMemo={(id) => {
              setClsReceipt(null)
              setSyncError(null)
              setSyncStatus('idle')
              setEditedTranscript('')
              setLastMemoId(id)
              setShowReview(true)
              setActiveView('capture')
            }}
            onRetryUpload={handleRetryUpload}
          />
        ) : activeView === 'diagnostics' ? (
          <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-500">
            <div className="flex items-center justify-between">
              <button onClick={() => setActiveView('capture')} className="p-2 -ml-2 rounded-lg hover:bg-white/5 transition-colors group">
                <ArrowLeft size={20} className="text-white/40 group-hover:text-white" />
              </button>
              <h2 className="text-sm font-black uppercase tracking-[0.3em] text-white/60">System Diagnostics</h2>
              <div className="w-10" />
            </div>
            
            <div className="glass-panel rounded-2xl p-6 space-y-6">
              <div className="flex justify-between items-center">
                <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Neural Link</span>
                <span className={`text-[9px] font-mono px-2 py-0.5 rounded uppercase ${user ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                  {user ? 'Established' : 'Disconnected'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Protocol Sync</span>
                <span className={`text-[9px] font-mono px-2 py-0.5 rounded uppercase ${navigator.onLine ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'}`}>
                  {navigator.onLine ? 'Online' : 'Local-Only'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Identity ID</span>
                <span className="text-[9px] font-mono text-[#00DBE7] truncate max-w-[120px]">{user?.uid || 'N/A'}</span>
              </div>
              <div className="h-[1px] bg-white/5 w-full" />
              
              {/* Task 10: Auto-Submit Toggle */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[10px] uppercase tracking-widest text-white/60 font-bold">Auto-Submit Mode</span>
                    <p className="text-[8px] text-white/30 uppercase">Skip review and ingest immediately</p>
                  </div>
                  <button 
                    onClick={() => setAutoSubmitEnabled(!autoSubmitEnabled)}
                    className={`w-10 h-5 rounded-full transition-colors relative ${autoSubmitEnabled ? 'bg-[#00DBE7]' : 'bg-white/10'}`}
                  >
                    <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${autoSubmitEnabled ? 'right-1' : 'left-1'}`} />
                  </button>
                </div>
              </div>

              <div className="h-[1px] bg-white/5 w-full" />
              <div className="space-y-2">
                <p className="text-[9px] uppercase tracking-widest text-white/20 font-black">Subsystem status</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                    <p className="text-[8px] text-white/40 uppercase mb-1">Transcription</p>
                    <p className="text-[10px] text-white/60 font-bold font-mono">Google STT V1</p>
                    <p className="text-[8px] text-white/30 mt-0.5">longRunningRecognize / default</p>
                  </div>
                  <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                    <p className="text-[8px] text-white/40 uppercase mb-1">Transcript Cleanup</p>
                    <p className="text-[10px] text-white/60 font-bold font-mono">Gemini 1.5 Flash</p>
                    <p className="text-[8px] text-white/30 mt-0.5">gemini-1.5-flash-002</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : !showReview ? (
          <>
            {/* Recording State Visualization */}
            <div className="flex flex-col items-center space-y-8">
              <div className="relative group cursor-pointer" onClick={handleToggleRecording}>
                {/* Multi-layered Pulsing Rings */}
                {isRecording && (
                  <>
                    {/* Dynamic Audio Ripples */}
                    {[0, 1, 2].map((i) => (
                      <div 
                        key={i}
                        className="absolute inset-0 rounded-full border border-[#00DBE7] pointer-events-none"
                        style={{ 
                          opacity: (0.4 - i * 0.1) * (audioLevel / 60 + 0.2),
                          transform: `scale(${1 + (audioLevel / 50) * (i + 1) * 0.5})`,
                          transition: 'transform 80ms ease-out, opacity 80ms ease-out'
                        }}
                      />
                    ))}
                    
                    {/* Outer Ambient Glow */}
                    <div 
                      className="absolute inset-[-60px] rounded-full bg-[#00DBE7]/5 blur-3xl pointer-events-none"
                      style={{ 
                        transform: `scale(${1 + audioLevel / 60})`,
                        opacity: 0.1 + (audioLevel / 150)
                      }}
                    />

                    <div className="recorder-ring" />
                    <div className="recorder-ring-delayed" />
                  </>
                )}
                
                <button 
                  disabled={!user}
                  className={`btn-record ${isRecording ? 'recording' : ''} ${!user ? 'opacity-30 grayscale' : ''}`}
                  style={isRecording ? { 
                    transform: `scale(${1.05 + audioLevel / 300})`,
                    boxShadow: `0 0 ${40 + audioLevel * 2}px rgba(0, 219, 231, ${0.4 + audioLevel / 50})`
                  } : {}}
                >
                  {isRecording ? (
                    <Square size={36} fill="#0B0B0C" className="text-[#0B0B0C]" />
                  ) : (
                    <Mic size={40} className="text-[#00DBE7]" />
                  )}
                </button>
              </div>

              {/* Recorder Error Card */}
              {recorderError && (
                <div className="w-full glass-panel rounded-2xl p-5 border border-red-500/20 bg-red-500/5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
                      <div className="space-y-1.5">
                        <span className="text-[10px] uppercase font-bold tracking-widest text-red-400 block">
                          {recorderError.code === 'permission_denied' ? 'Microphone Blocked' :
                           recorderError.code === 'device_unavailable' ? 'No Microphone Found' :
                           recorderError.code === 'format_unsupported' ? 'Unsupported Format' :
                           'Recording Failed'}
                        </span>
                        <p className="text-xs text-white/50 leading-relaxed">{recorderError.message}</p>
                      </div>
                    </div>
                    <button
                      onClick={clearRecorderError}
                      className="text-[9px] text-white/30 uppercase tracking-widest hover:text-white/60 transition-colors shrink-0 ml-3"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}

              <div className="text-center space-y-2">
                <div className="text-7xl font-outfit font-black tabular-nums tracking-tighter glow-text-cyan">
                  {Math.floor(duration / 60).toString().padStart(2, '0')}:{(duration % 60).toString().padStart(2, '0')}
                </div>
                <div className="flex items-center justify-center space-x-3">
                  <span className="h-[1px] w-8 bg-white/10" />
                  <p className="text-[#8E8D91] uppercase tracking-[0.4em] text-[10px] font-black">
                    {isRecording ? 'Capturing Session' : 'Standby Mode'}
                  </p>
                  <span className="h-[1px] w-8 bg-white/10" />
                </div>
              </div>
            </div>

            {/* Technical Detail Card */}
            <div className="w-full glass-panel rounded-2xl p-6 relative overflow-hidden">
               <div className="absolute top-0 right-0 p-3 opacity-20">
                 <Cpu size={40} className="text-[#00DBE7]" />
               </div>
               
               <div className="space-y-4 relative z-10">
                 <div className="flex items-center space-x-2">
                   <Shield size={14} className="text-[#00DBE7]" />
                   <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#00DBE7]">Secure Channel: 256-bit AES</span>
                 </div>
                 
                 <p className="text-white/60 text-sm leading-relaxed font-medium">
                  {!user 
                    ? 'Authentication required to initialize high-fidelity neural capture sequence.' 
                    : isRecording 
                      ? 'Transmitting live audio stream to CLS buffer. Sub-second latency enabled.' 
                      : 'System ready. Initialize capture to begin streaming thoughts to your cognitive ledger.'
                  }
                 </p>
               </div>
            </div>
          </>
        ) : (
          <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
            {/* Transcript Preview */}
            <div className="glass-panel rounded-2xl overflow-hidden group">
              <div className="p-4 border-b border-white/5 bg-white/5 flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  {isSelectedMemoLoading ? (
                    <Activity size={14} className="text-[#00DBE7] animate-pulse" />
                  ) : memoData?.status === 'processed' ? (
                    <CheckCircle2 size={14} className="text-[#00FF94]" />
                  ) : memoData?.status === 'submitted' ? (
                    <Upload size={14} className="text-[#00DBE7] animate-pulse" />
                  ) : memoData?.status === 'transcribed' ? (
                    <AlertTriangle size={14} className="text-amber-400" />
                  ) : memoData?.status === 'error' ? (
                    <AlertCircle size={14} className="text-red-400" />
                  ) : (
                    <Activity size={14} className="text-[#EBB2FF] animate-pulse" />
                  )}
                  <span className="text-[10px] uppercase tracking-widest font-black text-white/50">
                    {isSelectedMemoLoading ? 'Loading Selected Memo' :
                     memoData?.status === 'transcribing' ? 'Neural Processing' : 
                     memoData?.status === 'transcribed' ? 'Transcript Ready — Awaiting Ledger Ingestion' :
                     memoData?.status === 'submitted' ? 'Ingesting into Cognitive Ledger' :
                     memoData?.status === 'processed' ? 'Accepted by Cognitive Ledger' :
                     memoData?.status === 'error' ? 'Processing Error' : 'Stream Ready'}
                  </span>
                </div>
                <span className={`text-[9px] font-mono px-2 py-0.5 rounded uppercase ${
                  isSelectedMemoLoading ? 'text-[#00DBE7]/70 bg-[#00DBE7]/10' :
                  memoData?.status === 'transcribed' ? 'text-amber-400/70 bg-amber-400/10' :
                  memoData?.status === 'submitted' ? 'text-[#00DBE7]/70 bg-[#00DBE7]/10' :
                  memoData?.status === 'processed' ? 'text-[#00FF94]/70 bg-[#00FF94]/10' :
                  'text-[#EBB2FF]/70 bg-[#EBB2FF]/10'
                }`}>
                  {isSelectedMemoLoading ? 'loading' : memoData?.status || 'awaiting_sync'}
                </span>
              </div>
              <div className="p-8 relative">
                {!lastMemoId && (
                  <div className="text-center py-4">
                    <p className="text-sm text-white/40 font-medium">Recordings must be committed to the ledger for intelligence extraction.</p>
                  </div>
                )}
                
                {isSelectedMemoLoading && (
                  <div className="flex flex-col items-center justify-center space-y-4 py-8">
                    <div className="relative">
                      <Activity size={32} className="text-[#00DBE7] animate-pulse" />
                      <div className="absolute inset-0 bg-[#00DBE7]/20 blur-xl animate-pulse" />
                    </div>
                    <p className="text-[10px] uppercase tracking-widest text-white/40 font-black animate-pulse">
                      Loading memo state...
                    </p>
                  </div>
                )}

                {lastMemoId && !isSelectedMemoLoading && (memoData?.status === 'uploading' || memoData?.status === 'recorded' || memoData?.status === 'transcribing') && (
                  <div className="flex flex-col items-center justify-center space-y-4 py-8">
                    <div className="relative">
                      <Activity size={32} className="text-[#00DBE7] animate-pulse" />
                      <div className="absolute inset-0 bg-[#00DBE7]/20 blur-xl animate-pulse" />
                    </div>
                    <p className="text-[10px] uppercase tracking-widest text-white/40 font-black animate-bounce">
                      {memoData?.status === 'uploading' ? 'Uploading to Cognitive Cloud...' : 'Inverting Audio Phase / Extracting Semantics...'}
                    </p>
                  </div>
                )}

                {lastMemoId && (memoData?.status === 'local-only' || (!navigator.onLine && !memoData)) && (
                  <div className="flex flex-col items-center justify-center space-y-4 py-8">
                    <div className="relative">
                      <Database size={32} className="text-yellow-500" />
                      <div className="absolute inset-0 bg-yellow-500/20 blur-xl animate-pulse" />
                    </div>
                    <p className="text-[10px] uppercase tracking-widest text-yellow-500/70 font-black animate-bounce">Saved to Local Vault / Pending Sync...</p>
                  </div>
                )}

                {memoData?.status === 'error' && (
                  <div className="text-center py-4 space-y-2">
                    <p className="text-red-400 text-sm font-bold uppercase tracking-tight">Signal Loss Detected</p>
                    <p className="text-white/40 text-[10px]">{memoData.errorDetails || 'Unknown extraction error'}</p>
                  </div>
                )}

                {memoData?.transcriptText && (
                  <div className="animate-in fade-in duration-1000 w-full space-y-4">
                    <textarea 
                      value={editedTranscript || memoData.transcriptText}
                      onChange={(e) => setEditedTranscript(e.target.value)}
                      disabled={memoData.status === 'submitted' || memoData.status === 'processed'}
                      className={`w-full bg-transparent border-none resize-none focus:ring-0 text-white/90 font-medium italic font-outfit p-0 min-h-[120px] ${
                        (memoData.status === 'submitted' || memoData.status === 'processed') ? 'opacity-70 cursor-default' : 'hover:bg-white/5 p-2 rounded-lg transition-colors'
                      }`}
                      placeholder="Transcript is empty. You can write your memo here..."
                    />
                    {memoData.status === 'transcribed' && (
                      <div className="flex items-start space-x-3 text-amber-400 bg-amber-400/10 p-4 rounded-lg border border-amber-400/20 animate-in slide-in-from-bottom-2">
                        <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <span className="text-xs uppercase font-bold tracking-widest block">Not Yet In Memory</span>
                          <span className="text-[10px] text-amber-400/70 tracking-wide block">
                            This transcript is ready for review. Tap "Verify & Ingest" below to send it to your Cognitive Ledger.
                          </span>
                        </div>
                      </div>
                    )}
                    {memoData.status === 'submitted' && (
                      <div className="flex items-center space-x-2 text-[#00DBE7] bg-[#00DBE7]/10 p-3 rounded-lg border border-[#00DBE7]/20 animate-in slide-in-from-bottom-2">
                        <Upload size={16} className="animate-pulse" />
                        <span className="text-xs uppercase font-bold tracking-widest">Ingesting into Cognitive Ledger...</span>
                      </div>
                    )}
                    {memoData.status === 'processed' && (
                      <div className="text-[#00FF94] bg-[#00FF94]/10 p-4 rounded-lg border border-[#00FF94]/20 receipt-slide-in space-y-3">
                        <div className="flex items-center space-x-2">
                          <CheckCircle2 size={16} />
                          <span className="text-xs uppercase font-bold tracking-widest">Accepted by Cognitive Ledger</span>
                        </div>
                        {(clsReceipt || memoData.rawTurnId) && (
                          <div className="grid grid-cols-2 gap-2 text-[9px] font-mono">
                            <div>
                              <span className="text-[#00FF94]/50 uppercase block">Raw Turn</span>
                              <span className="text-[#00FF94]/80 truncate block">{clsReceipt?.rawTurnId || memoData.rawTurnId}</span>
                            </div>
                            <div>
                              <span className="text-[#00FF94]/50 uppercase block">Clerk Job</span>
                              <span className="text-[#00FF94]/80 truncate block">{clsReceipt?.clerkJobId || memoData.clerkJobId}</span>
                            </div>
                            <div className="col-span-2">
                              <span className="text-[#00FF94]/50 uppercase block">Submitted</span>
                              <span className="text-[#00FF94]/80">
                                {clsReceipt?.submittedAt || (memoData.submittedAt?.toDate ? new Date(memoData.submittedAt.toDate()).toLocaleString() : 'Recently')}
                              </span>
                            </div>
                            {memoData.audioRetainedUntil && (
                              <div className="col-span-2 pt-1 border-t border-[#00FF94]/10">
                                <span className="text-[#00FF94]/50 uppercase block">Audio Purge</span>
                                <span className="text-[#00FF94]/80">
                                  {memoData.audioRetainedUntil.toDate ? new Date(memoData.audioRetainedUntil.toDate()).toLocaleString() : 'Scheduled'}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Action Bar */}
            <div className="pt-6 flex space-x-3">
              <button 
                onClick={() => {
                  if (lastMemoId && (memoData?.status === 'recorded' || memoData?.status === 'transcribed')) {
                    localStorage.removeItem(`draft-${lastMemoId}`)
                  }
                  setShowReview(false)
                  resetRecording()
                  setEditedTranscript('')
                  setLastMemoId(null)
                  setSyncStatus('idle')
                  setClsReceipt(null)
                  setSyncError(null)
                }}
                className="flex-1 py-4 rounded-xl border border-white/5 text-white/40 font-bold text-[11px] uppercase tracking-widest hover:bg-white/5 transition-all"
              >
                {(memoData?.status === 'submitted' || memoData?.status === 'processed') ? 'Back' : 'Purge'}
              </button>
              
              {showPrimaryAction && (
                <button 
                  onClick={canPushToLedger ? handlePushToLedger : canRetryUpload ? () => handleRetryUpload(lastMemoId!) : handleInitializeCapture}
                  disabled={isSelectedMemoLoading || syncStatus === 'uploading' || (syncStatus === 'success' && !canPushToLedger && !canRetryUpload) || syncStatus === 'submitted'}
                  className="flex-[2] py-4 bg-gradient-to-r from-[#00DBE7] to-[#EBB2FF] text-[#0B0B0C] rounded-xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center space-x-2 shadow-2xl shadow-[#00DBE7]/20 hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {syncStatus === 'uploading' ? (
                    <Activity size={16} className="animate-spin" />
                  ) : syncStatus === 'submitted' ? (
                    <CheckCircle2 size={16} />
                  ) : canPushToLedger ? (
                    <Cpu size={16} />
                  ) : canRetryUpload ? (
                    <RefreshCw size={16} />
                  ) : (
                    <Send size={16} />
                  )}
                  <span>
                    {syncStatus === 'uploading' ? 'Processing...' : 
                     syncStatus === 'submitted' ? 'Injected to CLS' : 
                     canPushToLedger ? 'Verify & Ingest' : 
                     canRetryUpload ? 'Retry Upload' : 'Initialize Capture'}
                  </span>
                </button>
              )}
            </div>

            {memoData?.status === 'local-only' && (
              <div className="flex items-center justify-center space-x-2 text-yellow-500 bg-yellow-500/10 p-3 rounded-lg border border-yellow-500/20 animate-in slide-in-from-bottom-2">
                <Database size={16} />
                <span className="text-[10px] uppercase font-bold tracking-widest">Signal Stored Locally. Sync required for analysis.</span>
              </div>
            )}
            
            {(uploadError || syncStatus === 'error') && (
              <div className="p-4 rounded-lg border border-red-500/20 bg-red-500/5 space-y-3">
                <div className="flex items-start space-x-2">
                  <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-red-400 text-[10px] uppercase tracking-widest font-black">
                      {uploadError ? 'Upload Failed' : 'Submission Failed'}
                    </p>
                    <p className="text-red-400/70 text-[10px] leading-relaxed">
                      {syncError?.message || uploadError || 'An unexpected error occurred.'}
                    </p>
                  </div>
                </div>
                {syncError?.retryable && memoData?.status === 'transcribed' && (
                  <button
                    onClick={handlePushToLedger}
                    className="w-full py-3 rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 text-[10px] uppercase tracking-widest font-bold hover:bg-red-500/20 transition-all"
                  >
                    Retry Submission
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Futuristic Footer */}
      <footer className="w-full max-w-lg flex flex-col items-center space-y-4 pt-8 border-t border-white/5 z-30">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2 group">
            <div className="led-status led-cyan animate-pulse" />
            <span className="text-[9px] uppercase tracking-[0.2em] font-bold text-white/30 group-hover:text-white/60 transition-colors">V-Capture High-Fi</span>
          </div>
          <div className="flex items-center space-x-2 group">
            <div className="led-status led-violet" />
            <span className="text-[9px] uppercase tracking-[0.2em] font-bold text-white/30 group-hover:text-white/60 transition-colors">CLS-Stable-Link</span>
          </div>
        </div>
        <div className="text-[8px] font-mono text-white/10 uppercase tracking-[0.5em]">System Secure // Session Scoped</div>
      </footer>
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </div>
  )
}

export default App


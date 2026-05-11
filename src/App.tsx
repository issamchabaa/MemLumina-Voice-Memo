import { useState, useEffect, useMemo } from 'react'
import { Mic, Square, Send, Info, Activity, LogIn, Settings, History, Shield, Cpu, CheckCircle2, AlertCircle, Database } from 'lucide-react'
import { useVoiceRecorder } from './hooks/useVoiceRecorder'
import { useMemoUpload } from './hooks/useMemoUpload'
import { useMemoStatus } from './hooks/useMemoStatus'
import { auth, functions } from './firebase'
import { signInAnonymously, onAuthStateChanged, User } from 'firebase/auth'
import { httpsCallable } from 'firebase/functions'

type CaptureMode = 'idea' | 'instruction' | 'reminder' | 'decision' | 'correction' | 'project_note'

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [showReview, setShowReview] = useState(false)
  const [selectedMode, setSelectedMode] = useState<CaptureMode>('idea')
  const [lastMemoId, setLastMemoId] = useState<string | null>(null)
  const [syncStatus, setSyncStatus] = useState<'idle' | 'uploading' | 'success' | 'error' | 'submitted'>('idle')
  const [editedTranscript, setEditedTranscript] = useState('')

  const { 
    isRecording, 
    audioBlob, 
    duration, 
    audioLevel, 
    startRecording, 
    stopRecording, 
    resetRecording 
  } = useVoiceRecorder()

  const { uploadMemo, isUploading, error: uploadError, syncOfflineMemos } = useMemoUpload()
  const { memoData, isLoading: isMemoLoading } = useMemoStatus(lastMemoId)

  useEffect(() => {
    syncOfflineMemos()
  }, [syncOfflineMemos])

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
    const memoId = await uploadMemo(audioBlob, selectedMode)
    if (memoId) {
      setLastMemoId(memoId)
      setSyncStatus('success')
    } else {
      setSyncStatus('error')
    }
  }

  const handlePushToLedger = async () => {
    if (!lastMemoId) return
    setSyncStatus('uploading')
    try {
      const submitFn = httpsCallable(functions, 'submitMemoToLedger')
      await submitFn({ 
        memoId: lastMemoId,
        captureMode: selectedMode,
        reviewedByUser: true,
        source: 'MemLumina-Voice-Capture',
        submittedFrom: 'web',
        capturedAt: new Date().toISOString(),
        editedTranscriptText: editedTranscript !== memoData?.transcriptText ? editedTranscript : undefined
      })
      setSyncStatus('submitted')
      localStorage.removeItem(`draft-${lastMemoId}`)
      
      // Auto-dismiss after success
      setTimeout(() => {
        setShowReview(false)
        resetRecording()
        setSyncStatus('idle')
        setLastMemoId(null)
        setEditedTranscript('')
      }, 3000)
    } catch (err) {
      console.error('Submission to CLS failed', err)
      setSyncStatus('error')
    }
  }

  const handleSignIn = () => {
    signInAnonymously(auth).catch(console.error)
  }

  const modes: { id: CaptureMode; label: string }[] = [
    { id: 'idea', label: 'Idea' },
    { id: 'instruction', label: 'Instrux' },
    { id: 'reminder', label: 'Alert' },
    { id: 'decision', label: 'Logic' },
    { id: 'correction', label: 'Fix' },
    { id: 'project_note', label: 'Project' },
  ]

  return (
    <div className="min-h-screen flex flex-col items-center justify-between p-6 md:p-10 bg-[#0B0B0C] text-[#F8FAF7] relative overflow-hidden">
      {/* Ambient Effects */}
      <div className="ambient-glow" />
      
      {/* Technical Header */}
      <header className="w-full max-w-lg flex justify-between items-center z-30">
        <div className="flex flex-col">
          <div className="flex items-center space-x-2">
            <div className="led-status led-cyan" />
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
              <button className="w-10 h-10 rounded-xl glass-panel flex items-center justify-center hover:bg-white/5 transition-colors">
                <History size={18} className="text-white/40" />
              </button>
              <button className="w-10 h-10 rounded-xl glass-panel flex items-center justify-center hover:bg-white/5 transition-colors">
                <Settings size={18} className="text-white/40" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Cockpit Area */}
      <main className="flex-1 w-full max-w-lg flex flex-col items-center justify-center space-y-12 z-20">
        {!showReview ? (
          <>
            {/* Recording State Visualization */}
            <div className="flex flex-col items-center space-y-8">
              <div className="relative group cursor-pointer" onClick={handleToggleRecording}>
                {/* Multi-layered Pulsing Rings */}
                {isRecording && (
                  <>
                    <div className="recorder-ring" />
                    <div className="recorder-ring-delayed" />
                    <div 
                      className="absolute inset-[-40px] rounded-full border border-[#00DBE7]/10 blur-xl opacity-50"
                      style={{ transform: `scale(${1 + audioLevel / 100})` }}
                    />
                  </>
                )}
                
                <button 
                  disabled={!user}
                  className={`btn-record ${isRecording ? 'recording' : ''} ${!user ? 'opacity-30 grayscale' : ''}`}
                >
                  {isRecording ? (
                    <Square size={36} fill="#0B0B0C" className="text-[#0B0B0C]" />
                  ) : (
                    <Mic size={40} className="text-[#00DBE7]" />
                  )}
                </button>
              </div>

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
                  {memoData?.status === 'transcribed' || memoData?.status === 'processed' ? (
                    <CheckCircle2 size={14} className="text-[#00FF94]" />
                  ) : memoData?.status === 'error' ? (
                    <AlertCircle size={14} className="text-red-400" />
                  ) : (
                    <Activity size={14} className="text-[#EBB2FF] animate-pulse" />
                  )}
                  <span className="text-[10px] uppercase tracking-widest font-black text-white/50">
                    {memoData?.status === 'transcribing' ? 'Neural Processing' : 
                     memoData?.status === 'transcribed' ? 'Intelligence Captured' :
                     memoData?.status === 'error' ? 'Processing Error' : 'Stream Ready'}
                  </span>
                </div>
                <span className="text-[9px] font-mono text-[#EBB2FF]/70 bg-[#EBB2FF]/10 px-2 py-0.5 rounded uppercase">
                  {memoData?.status || 'awaiting_sync'}
                </span>
              </div>
              <div className="p-8 relative">
                {!lastMemoId && (
                  <div className="text-center py-4">
                    <p className="text-sm text-white/40 font-medium">Recordings must be committed to the ledger for intelligence extraction.</p>
                  </div>
                )}
                
                {lastMemoId && (memoData?.status === 'uploading' || memoData?.status === 'recorded' || memoData?.status === 'transcribing') && (
                  <div className="flex flex-col items-center justify-center space-y-4 py-8">
                    <div className="relative">
                      <Activity size={32} className="text-[#00DBE7] animate-pulse" />
                      <div className="absolute inset-0 bg-[#00DBE7]/20 blur-xl animate-pulse" />
                    </div>
                    <p className="text-[10px] uppercase tracking-widest text-white/40 font-black animate-bounce">Inverting Audio Phase / Extracting Semantics...</p>
                  </div>
                )}

                {lastMemoId && !navigator.onLine && !memoData && (
                  <div className="flex flex-col items-center justify-center space-y-4 py-8">
                    <div className="relative">
                      <Database size={32} className="text-yellow-500" />
                      <div className="absolute inset-0 bg-yellow-500/20 blur-xl animate-pulse" />
                    </div>
                    <p className="text-[10px] uppercase tracking-widest text-yellow-500/70 font-black animate-bounce">Saved to Offline Queue...</p>
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
                    {memoData.status === 'processed' && (
                      <div className="flex items-center space-x-2 text-[#00FF94] bg-[#00FF94]/10 p-3 rounded-lg border border-[#00FF94]/20 animate-in slide-in-from-bottom-2">
                        <CheckCircle2 size={16} />
                        <span className="text-xs uppercase font-bold tracking-widest">Receipt: Accepted by Cognitive Ledger</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Classification Modes */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <p className="text-[10px] uppercase tracking-[0.2em] font-black text-white/30">Schema Classification</p>
                <Info size={12} className="text-white/20" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {modes.map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => setSelectedMode(mode.id)}
                    className={`mode-pill ${selectedMode === mode.id ? 'active' : ''}`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Bar */}
            <div className="pt-6 flex space-x-3">
              <button 
                onClick={() => {
                  if (lastMemoId) {
                    localStorage.removeItem(`draft-${lastMemoId}`)
                  }
                  setShowReview(false)
                  resetRecording()
                  setEditedTranscript('')
                }}
                className="flex-1 py-4 rounded-xl border border-white/5 text-white/40 font-bold text-[11px] uppercase tracking-widest hover:bg-white/5 transition-all"
              >
                Purge
              </button>
              <button 
                onClick={memoData?.status === 'transcribed' ? handlePushToLedger : handleInitializeCapture}
                disabled={syncStatus === 'uploading' || (syncStatus === 'success' && memoData?.status !== 'transcribed') || syncStatus === 'submitted'}
                className="flex-[2] py-4 bg-gradient-to-r from-[#00DBE7] to-[#EBB2FF] text-[#0B0B0C] rounded-xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center space-x-2 shadow-2xl shadow-[#00DBE7]/20 hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {syncStatus === 'uploading' ? (
                  <Activity size={16} className="animate-spin" />
                ) : syncStatus === 'submitted' ? (
                  <CheckCircle2 size={16} />
                ) : memoData?.status === 'transcribed' ? (
                  <Cpu size={16} />
                ) : (
                  <Send size={16} />
                )}
                <span>
                  {syncStatus === 'uploading' ? 'Processing...' : 
                   syncStatus === 'submitted' ? 'Injected to CLS' : 
                   memoData?.status === 'transcribed' ? 'Verify & Ingest' : 'Initialize Capture'}
                </span>
              </button>
            </div>
            
            {(uploadError || syncStatus === 'error') && (
              <div className="p-3 rounded-lg border border-red-500/20 bg-red-500/5 text-red-400 text-[10px] text-center uppercase tracking-widest font-black">
                {uploadError || 'Sync failed: Connection Interrupted'}
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
    </div>
  )
}

export default App



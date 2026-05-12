import { useMemoHistory } from './hooks/useMemoHistory'
import { CheckCircle2, AlertCircle, AlertTriangle, Clock, ArrowLeft, Cpu, Trash2, ChevronRight, Database, RefreshCw, Upload } from 'lucide-react'

interface HistoryViewProps {
  onBack: () => void
  onSelectMemo: (memoId: string) => void
  onRetryUpload?: (memoId: string) => void
}

export function HistoryView({ onBack, onSelectMemo, onRetryUpload }: HistoryViewProps) {
  const { memos, isLoading, error } = useMemoHistory()

  // Group memos into operational sections
  const needsAttention = memos.filter(m => ['recorded', 'transcribed', 'error', 'local-only'].includes(m.status))
  const inProgress = memos.filter(m => ['transcribing', 'uploading', 'submitted'].includes(m.status))
  const completed = memos.filter(m => m.status === 'processed')

  const getActionHint = (status: string) => {
    switch (status) {
      case 'transcribed': return 'Awaiting ledger ingestion'
      case 'error': return 'Signal loss - Tap to retry'
      case 'recorded': return 'Captured - Analyzing...'
      case 'local-only': return 'Stored locally - Sync needed'
      case 'transcribing':
      case 'uploading': return 'Neural processing in progress'
      case 'submitted': return 'Ingesting into Cognitive Ledger'
      case 'processed': return 'Archived in Cognitive Ledger'
      default: return ''
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'processed':
        return <CheckCircle2 size={16} className="text-[#00FF94]" />
      case 'submitted':
        return <Upload size={16} className="text-[#00DBE7] animate-pulse" />
      case 'transcribed':
        return <AlertTriangle size={16} className="text-amber-400" />
      case 'error':
        return <AlertCircle size={14} className="text-red-400" />
      case 'transcribing':
      case 'uploading':
        return <Cpu size={16} className="text-violet-400 animate-pulse" />
      case 'local-only':
        return <Database size={16} className="text-yellow-500" />
      default:
        return <Clock size={16} className="text-white/20" />
    }
  }

  const renderMemoCard = (memo: VoiceMemo) => (
    <button
      key={memo.id}
      onClick={() => onSelectMemo(memo.id)}
      className="w-full glass-panel rounded-2xl p-5 text-left transition-all hover:bg-white/5 active:scale-[0.98] group relative overflow-hidden"
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-lg bg-white/5 border border-white/5">
            {getStatusIcon(memo.status)}
          </div>
          <div className={`text-[9px] font-mono px-2 py-0.5 rounded uppercase border ${getStatusColor(memo.status)}`}>
            {getStatusLabel(memo.status)}
          </div>
          {memo.captureMode && (
            <div className="text-[9px] font-mono bg-white/5 text-white/40 px-2 py-0.5 rounded uppercase border border-white/5">
              {memo.captureMode}
            </div>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {memo.status === 'local-only' && onRetryUpload && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onRetryUpload(memo.id);
              }}
              className="p-1 rounded bg-[#00DBE7]/10 text-[#00DBE7] hover:bg-[#00DBE7]/20 transition-colors"
            >
              <RefreshCw size={12} />
            </button>
          )}
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-mono text-white/20">
              {memo.createdAt?.toDate ? new Date(memo.createdAt.toDate()).toLocaleDateString() : 'Just now'}
            </span>
            {memo.audioRetainedUntil && memo.status !== 'processed' && (
              <span className="text-[7px] font-mono text-white/10 uppercase tracking-tighter">
                Purge: {Math.max(0, Math.ceil((memo.audioRetainedUntil.toDate().getTime() - Date.now()) / (1000 * 60 * 60 * 24)))}d
              </span>
            )}
          </div>
        </div>
      </div>
      
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-white/70 line-clamp-2 italic pr-4">
          {memo.transcriptText || (memo.status === 'error' ? 'Signal loss detected' : 'Analyzing neural stream...')}
        </p>
        {memo.status === 'transcribed' ? (
          <span className="text-[9px] font-bold uppercase tracking-widest text-amber-400 whitespace-nowrap shrink-0 flex items-center gap-1.5 bg-amber-400/10 px-2 py-1 rounded-lg">
            Review <ChevronRight size={12} />
          </span>
        ) : (
          <ChevronRight size={16} className="text-white/10 group-hover:text-white/30 transition-colors shrink-0" />
        )}
      </div>

      {/* Action hint line */}
      <p className="text-[8px] uppercase tracking-widest text-white/20 mt-2 font-bold">
        {getActionHint(memo.status)}
      </p>

      <div className="absolute left-0 bottom-0 h-[1px] w-full opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-r from-transparent via-[#00DBE7]/20 to-transparent" />
    </button>
  )

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processed': return 'bg-[#00FF94]/10 text-[#00FF94] border-[#00FF94]/20'
      case 'submitted': return 'bg-[#00DBE7]/10 text-[#00DBE7] border-[#00DBE7]/20'
      case 'transcribed': return 'bg-amber-400/10 text-amber-400 border-amber-400/20'
      case 'error': return 'bg-red-400/10 text-red-400 border-red-400/20'
      case 'transcribing':
      case 'uploading': return 'bg-violet-400/10 text-violet-400 border-violet-400/20'
      case 'local-only': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
      default: return 'bg-white/5 text-white/40 border-white/10'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'local-only': return 'Offline'
      case 'uploading': return 'Uploading'
      case 'recorded': return 'Captured'
      case 'transcribing': return 'Analyzing'
      case 'transcribed': return 'Review'
      case 'submitted': return 'Ingesting'
      case 'processed': return 'Verified'
      default: return status
    }
  }

  return (
    <div className="w-full max-w-lg space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
      <div className="flex items-center justify-between">
        <button 
          onClick={onBack}
          className="p-2 -ml-2 rounded-lg hover:bg-white/5 transition-colors group"
        >
          <ArrowLeft size={20} className="text-white/40 group-hover:text-white" />
        </button>
        <h2 className="text-sm font-black uppercase tracking-[0.3em] text-white/60">Cognitive Stream</h2>
        <div className="w-10" />
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-xs text-center uppercase tracking-widest font-black">
          {error}
        </div>
      )}

      <div className="space-y-10">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-24 w-full glass-panel rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : memos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4 glass-panel rounded-2xl border-dashed">
            <Clock size={40} className="text-white/10" />
            <p className="text-xs uppercase tracking-widest font-black text-white/20">No entries recorded</p>
          </div>
        ) : (
          <>
            {/* === NEEDS ATTENTION === */}
            {needsAttention.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center space-x-2 px-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400" style={{ boxShadow: '0 0 8px rgba(251,191,36,0.8)' }} />
                  <p className="text-[9px] uppercase tracking-[0.3em] font-black text-amber-400/60">
                    Needs Attention ({needsAttention.length})
                  </p>
                </div>
                {needsAttention.map((memo) => renderMemoCard(memo))}
              </div>
            )}

            {/* === IN PROGRESS === */}
            {inProgress.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center space-x-2 px-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#00DBE7] animate-pulse" style={{ boxShadow: '0 0 8px rgba(0,219,231,0.8)' }} />
                  <p className="text-[9px] uppercase tracking-[0.3em] font-black text-[#00DBE7]/60">
                    In Progress ({inProgress.length})
                  </p>
                </div>
                {inProgress.map((memo) => renderMemoCard(memo))}
              </div>
            )}

            {/* === COMPLETED === */}
            {completed.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center space-x-2 px-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#00FF94]" style={{ boxShadow: '0 0 8px rgba(0,255,148,0.8)' }} />
                  <p className="text-[9px] uppercase tracking-[0.3em] font-black text-[#00FF94]/60">
                    Verified Ledger ({completed.length})
                  </p>
                </div>
                {completed.map((memo) => renderMemoCard(memo))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="pt-8 text-center border-t border-white/5">
        <p className="text-[8px] font-mono text-white/10 uppercase tracking-[0.5em]">System Secure // Session Scoped</p>
      </div>
    </div>
  )
}

import { useMemoHistory } from './hooks/useMemoHistory'
import { CheckCircle2, AlertCircle, Clock, ArrowLeft, Cpu, Trash2, ChevronRight } from 'lucide-react'

interface HistoryViewProps {
  onBack: () => void
  onSelectMemo: (memoId: string) => void
}

export function HistoryView({ onBack, onSelectMemo }: HistoryViewProps) {
  const { memos, isLoading, error } = useMemoHistory()

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'processed':
      case 'submitted':
        return <CheckCircle2 size={16} className="text-[#00FF94]" />
      case 'error':
        return <AlertCircle size={16} className="text-red-400" />
      case 'transcribing':
        return <Cpu size={16} className="text-[#00DBE7] animate-pulse" />
      default:
        return <Clock size={16} className="text-white/30" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processed': return 'bg-[#00FF94]/10 text-[#00FF94] border-[#00FF94]/20'
      case 'submitted': return 'bg-[#00DBE7]/10 text-[#00DBE7] border-[#00DBE7]/20'
      case 'error': return 'bg-red-400/10 text-red-400 border-red-400/20'
      case 'transcribing': return 'bg-violet-400/10 text-violet-400 border-violet-400/20'
      default: return 'bg-white/5 text-white/40 border-white/10'
    }
  }

  return (
    <div className="w-full max-w-lg space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
      <div className="flex items-center justify-between">
        <button 
          onClick={onBack}
          className="p-2 -ml-2 rounded-lg hover:bg-white/5 transition-colors group"
        >
          <ArrowLeft size={20} className="text-white/40 group-hover:text-white" />
        </button>
        <h2 className="text-sm font-black uppercase tracking-[0.3em] text-white/60">Cognitive Ledger</h2>
        <div className="w-10" /> {/* Spacer */}
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 text-xs text-center uppercase tracking-widest font-black">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 w-full glass-panel rounded-2xl animate-pulse" />
          ))
        ) : memos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4 glass-panel rounded-2xl border-dashed">
            <Clock size={40} className="text-white/10" />
            <p className="text-xs uppercase tracking-widest font-black text-white/20">No entries recorded</p>
          </div>
        ) : (
          memos.map((memo) => (
            <button
              key={memo.id}
              onClick={() => onSelectMemo(memo.id)}
              className="w-full glass-panel rounded-2xl p-5 text-left transition-all hover:bg-white/5 active:scale-[0.98] group relative overflow-hidden"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center space-x-2">
                  <div className={`text-[9px] font-mono px-2 py-0.5 rounded uppercase border ${getStatusColor(memo.status)}`}>
                    {memo.status}
                  </div>
                  {memo.captureMode && (
                    <div className="text-[9px] font-mono bg-white/5 text-white/40 px-2 py-0.5 rounded uppercase border border-white/5">
                      {memo.captureMode}
                    </div>
                  )}
                </div>
                <span className="text-[9px] font-mono text-white/20">
                  {memo.createdAt?.toDate ? new Date(memo.createdAt.toDate()).toLocaleDateString() : 'Just now'}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-white/70 line-clamp-2 italic pr-4">
                  {memo.transcriptText || (memo.status === 'error' ? 'Failed to process signal' : 'Extracting semantics...')}
                </p>
                <ChevronRight size={16} className="text-white/10 group-hover:text-white/30 transition-colors shrink-0" />
              </div>

              <div className="absolute left-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-[#00DBE7]/20 to-transparent w-full opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))
        )}
      </div>

      <div className="pt-8 text-center">
        <p className="text-[8px] font-mono text-white/10 uppercase tracking-[0.4em]">End of Cognitive Stream</p>
      </div>
    </div>
  )
}

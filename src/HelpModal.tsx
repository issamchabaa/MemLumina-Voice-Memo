import { X, Cpu, Database, Activity, CheckCircle2 } from 'lucide-react'

interface HelpModalProps {
  isOpen: boolean
  onClose: () => void
}

export function HelpModal({ isOpen, onClose }: HelpModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div 
        className="w-full max-w-md glass-panel rounded-3xl p-8 relative overflow-hidden animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient Glow */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#00DBE7]/10 blur-3xl pointer-events-none" />
        
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/5 transition-colors"
        >
          <X size={20} className="text-white/40" />
        </button>

        <div className="space-y-8">
          <div className="space-y-2">
            <h3 className="text-xl font-black uppercase tracking-tighter">Cognitive <span className="text-[#00DBE7]">Lifecycle</span></h3>
            <p className="text-[10px] font-mono text-white/30 uppercase tracking-[0.2em]">Protocol documentation v1.0</p>
          </div>

          <div className="space-y-6">
            <div className="flex items-start space-x-4">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0 border border-white/5">
                <Activity size={20} className="text-[#EBB2FF]" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-black uppercase tracking-widest text-[#EBB2FF]">Neural Processing</h4>
                <p className="text-[10px] text-white/50 leading-relaxed">
                  Your audio is being analyzed by Google STT V1 and Gemini 1.5 Flash. We extract raw semantics and refine them into structured thoughts.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0 border border-white/5">
                <Database size={20} className="text-amber-400" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-black uppercase tracking-widest text-amber-400">Transcribed / Ready</h4>
                <p className="text-[10px] text-white/50 leading-relaxed">
                  The thought is ready but stored in a transient buffer. It has not yet been committed to your permanent Cognitive Ledger.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0 border border-white/5">
                <Cpu size={20} className="text-[#00DBE7]" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-black uppercase tracking-widest text-[#00DBE7]">In Ledger / Submitted</h4>
                <p className="text-[10px] text-white/50 leading-relaxed">
                  The thought is being injected into the Ledger System. Idempotency checks and causal linking are in progress.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0 border border-white/5">
                <CheckCircle2 size={20} className="text-[#00FF94]" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-black uppercase tracking-widest text-[#00FF94]">Verified Ledger</h4>
                <p className="text-[10px] text-white/50 leading-relaxed">
                  Permanently archived. The Clerk system has verified the turn and integrated it into your cognitive stream.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-white/5">
            <button 
              onClick={onClose}
              className="w-full py-4 bg-white/5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-white/10 transition-all"
            >
              Close Manual
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

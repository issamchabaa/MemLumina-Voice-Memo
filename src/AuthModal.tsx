import { useState } from 'react';
import { auth } from './firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { LogIn, AlertCircle } from 'lucide-react';

export function AuthModal() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setError(err.message || 'Failed to authenticate.');
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="glass-panel w-full max-w-sm rounded-2xl p-6 relative overflow-hidden shadow-2xl shadow-[#00DBE7]/10 border border-[#00DBE7]/20">
        <div className="flex flex-col items-center mb-6 space-y-2">
          <div className="flex items-center space-x-2">
            <div className="led-status led-cyan" />
            <h1 className="text-xl font-outfit font-extrabold tracking-tighter uppercase text-white">
              MemLumina <span className="text-[#00DBE7]">Auth</span>
            </h1>
          </div>
          <span className="text-[9px] font-mono text-white/40 tracking-[0.2em] uppercase">User Authentication Required</span>
        </div>

        <form onSubmit={handleSignIn} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-white/60">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#00DBE7]/50 focus:ring-1 focus:ring-[#00DBE7]/50 transition-all font-mono"
              placeholder="operator@memlumina.com"
              required
            />
          </div>
          
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-white/60">Passcode</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#00DBE7]/50 focus:ring-1 focus:ring-[#00DBE7]/50 transition-all font-mono"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="flex items-center space-x-2 p-3 rounded-lg border border-red-500/20 bg-red-500/10 text-red-400">
              <AlertCircle size={14} />
              <span className="text-[10px] uppercase font-bold tracking-widest">{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !email || !password}
            className="w-full py-4 mt-2 bg-gradient-to-r from-[#00DBE7] to-[#EBB2FF] text-[#0B0B0C] rounded-xl font-black text-[11px] uppercase tracking-widest flex items-center justify-center space-x-2 hover:opacity-90 transition-all disabled:opacity-50"
          >
            <LogIn size={16} />
            <span>{isLoading ? 'Authenticating...' : 'Establish Link'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}

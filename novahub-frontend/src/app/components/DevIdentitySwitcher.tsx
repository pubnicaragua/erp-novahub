import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Shield, User, Users, RefreshCcw, X, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './ui/utils';

export function DevIdentitySwitcher() {
  const { switchIdentity, user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [customId, setCustomId] = useState('');

  // Identidades predefinidas (Ajustar según IDs reales de la DB/Seed)
  const presets = [
    { id: 'admin-001', label: 'Super Admin', role: 'superadmin', icon: <Shield className="size-4" /> },
    { id: 'partner-demo-001', label: 'Partner Demo', role: 'partner', icon: <Users className="size-4" /> },
    { id: 'client-demo-001', label: 'Cliente Demo (Full)', role: 'admin', icon: <User className="size-4" /> },
  ];

  if (!import.meta.env.DEV) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col items-end gap-2">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="w-72 overflow-hidden rounded-2xl border border-white/10 bg-[#0f0f0f]/95 p-4 shadow-2xl backdrop-blur-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-500">
                Identity Switcher
              </h3>
              <button 
                onClick={() => setIsOpen(false)}
                className="rounded-full p-1 hover:bg-white/10"
              >
                <X className="size-4 text-white/40" />
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] text-white/40 mb-1">PRESETS</p>
              {presets.map((p) => (
                <button
                  key={p.id}
                  onClick={() => switchIdentity(p.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border border-white/5 bg-white/5 px-3 py-2.5 transition-all hover:bg-white/10 hover:border-white/10",
                    user?.id === p.id && "border-emerald-500/50 bg-emerald-500/10"
                  )}
                >
                  <div className={cn(
                    "flex size-8 items-center justify-center rounded-lg",
                    user?.id === p.id ? "bg-emerald-500 text-white" : "bg-white/5 text-white/60"
                  )}>
                    {p.icon}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-xs font-semibold text-white">{p.label}</p>
                    <p className="text-[10px] text-white/40 uppercase">{p.role}</p>
                  </div>
                  <ChevronRight className="size-4 text-white/20" />
                </button>
              ))}

              <div className="pt-2">
                <p className="text-[10px] text-white/40 mb-2">CUSTOM USER ID</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customId}
                    onChange={(e) => setCustomId(e.target.value)}
                    placeholder="Enter User ID..."
                    className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-white/20 focus:border-emerald-500/50 focus:outline-none"
                  />
                  <button
                    onClick={() => customId && switchIdentity(customId)}
                    className="flex size-8 items-center justify-center rounded-lg bg-emerald-500 text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
                  >
                    <RefreshCcw className="size-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-4 border-t border-white/10 pt-3">
              <div className="flex items-center gap-2 text-[10px] text-white/60">
                <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Current: <strong>{user?.name}</strong> ({user?.role})</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex size-12 items-center justify-center rounded-full shadow-2xl transition-all hover:scale-110 active:scale-90",
          isOpen ? "bg-white text-black" : "bg-[#048833] text-white"
        )}
      >
        {isOpen ? <X className="size-6" /> : <Shield className="size-6" />}
      </button>
    </div>
  );
}

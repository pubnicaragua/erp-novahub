import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageCircle, X, Send, ArrowRight } from 'lucide-react';

interface Message {
  id: string;
  sender: 'lead' | 'groq' | 'admin';
  content: string;
  createdAt: string;
}

interface LeadData {
  id: string;
  name: string;
  messages: Message[];
}

function playNotificationSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.setValueAtTime(1000, ctx.currentTime + 0.1);
    osc.frequency.setValueAtTime(800, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch {}
}

export function LandingChatModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [step, setStep] = useState<'form' | 'chat'>('form');
  const [loading, setLoading] = useState(false);
  const [lead, setLead] = useState<LeadData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', company: '', message: '' });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => { scrollToBottom(); }, [messages]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowTooltip(true);
      playNotificationSound();
    }, 3500);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmitForm = async () => {
    if (!formData.name.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        const data = await res.json();
        setLead(data);
        setMessages(data.messages || []);
        setStep('chat');
      }
    } catch (error) {
      console.error('Error creating lead:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || !lead) return;
    const userMessage: Message = {
      id: Date.now().toString(),
      sender: 'lead',
      content: input,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: input }),
      });
      if (res.ok) {
        setTimeout(async () => {
          const leadRes = await fetch(`/api/leads/${lead.id}`);
          if (leadRes.ok) {
            const data = await leadRes.json();
            setMessages(data.messages || []);
          }
          setLoading(false);
        }, 2500);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (step === 'form') handleSubmitForm();
      else handleSendMessage();
    }
  };

  return (
    <>
      {/* Floating tooltip */}
      <AnimatePresence>
        {showTooltip && !isOpen && (
          <motion.div
            initial={{ opacity: 0, x: 20, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.9 }}
            className="fixed bottom-24 right-4 z-50 lg:bottom-28 lg:right-8"
          >
            <div className="relative max-w-[200px] rounded-2xl border border-[#d1fae5] bg-white px-4 py-3 shadow-lg">
              <button onClick={() => setShowTooltip(false)} className="absolute -right-2 -top-2 flex size-5 items-center justify-center rounded-full bg-[#5d7884] text-white hover:bg-[#174a3a]">
                <X className="size-3" />
              </button>
              <p className="text-sm font-bold text-[#174a3a]">¡Hola! 👋</p>
              <p className="mt-0.5 text-xs leading-relaxed text-[#5d7884]">¿Quieres ordenar tu negocio? Te ayudo.</p>
              <div className="absolute -bottom-1.5 right-6 size-3 rotate-45 border-b border-r border-[#d1fae5] bg-white" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating button */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 1, type: 'spring', stiffness: 200 }}
        onClick={() => { setIsOpen(true); setShowTooltip(false); }}
        className="fixed bottom-6 right-6 z-50 flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-[#22c55e] to-[#16a34a] text-white shadow-[0_8px_30px_-8px_rgba(34,197,94,.6)] transition-transform hover:scale-110 lg:bottom-8 lg:right-8"
      >
        <motion.div
          animate={{ scale: [1, 1.12, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <MessageCircle className="size-7" />
        </motion.div>
        <motion.div
          animate={{ scale: [1, 1.8], opacity: [0.4, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeOut' }}
          className="absolute inset-0 rounded-full border-2 border-[#22c55e]"
        />
      </motion.button>

      {/* Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 inset-x-4 z-50 flex h-[520px] flex-col overflow-hidden rounded-2xl border border-[#d1fae5] bg-white shadow-2xl lg:bottom-28 lg:right-8 lg:left-auto lg:w-[380px]"
          >
            {/* Header */}
            <div className="flex items-center justify-between bg-gradient-to-r from-[#22c55e] to-[#16a34a] px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                  <MessageCircle className="size-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">NovaHub ERP</h3>
                  <p className="text-xs text-white/80">En línea · Respondo en segundos</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="rounded-lg p-1 text-white/70 transition-colors hover:bg-white/20 hover:text-white">
                <X className="size-5" />
              </button>
            </div>

            {/* Content */}
            {step === 'form' ? (
              <div className="flex-1 overflow-y-auto p-5">
                <div className="mb-4 rounded-xl bg-[#f0fdf4] p-4 border border-[#d1fae5]">
                  <p className="text-sm font-bold text-[#174a3a]">¡Cuéntanos sobre tu negocio!</p>
                  <p className="mt-1 text-xs text-[#5d7884]">Te ayudamos a organizar ventas, inventario y contabilidad en un solo sistema.</p>
                </div>
                <div className="space-y-3">
                  <input type="text" placeholder="Tu nombre *" value={formData.name} onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))} onKeyPress={handleKeyPress} className="w-full rounded-xl border border-[#d1fae5] px-4 py-3 text-sm text-[#174a3a] placeholder-[#84a1ad] outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20" />
                  <input type="email" placeholder="Email" value={formData.email} onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))} onKeyPress={handleKeyPress} className="w-full rounded-xl border border-[#d1fae5] px-4 py-3 text-sm text-[#174a3a] placeholder-[#84a1ad] outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20" />
                  <input type="tel" placeholder="Teléfono / WhatsApp" value={formData.phone} onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))} onKeyPress={handleKeyPress} className="w-full rounded-xl border border-[#d1fae5] px-4 py-3 text-sm text-[#174a3a] placeholder-[#84a1ad] outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20" />
                  <input type="text" placeholder="Empresa" value={formData.company} onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))} onKeyPress={handleKeyPress} className="w-full rounded-xl border border-[#d1fae5] px-4 py-3 text-sm text-[#174a3a] placeholder-[#84a1ad] outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20" />
                  <textarea placeholder="¿Qué necesitas ordenar en tu negocio?" value={formData.message} onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))} rows={2} className="w-full resize-none rounded-xl border border-[#d1fae5] px-4 py-3 text-sm text-[#174a3a] placeholder-[#84a1ad] outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20" />
                </div>
                <button onClick={handleSubmitForm} disabled={!formData.name.trim() || loading} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#22c55e] to-[#16a34a] px-4 py-3.5 text-sm font-bold text-white shadow-[0_8px_20px_-8px_rgba(34,197,94,.5)] transition-all hover:shadow-[0_12px_25px_-8px_rgba(34,197,94,.6)] disabled:opacity-50">
                  {loading ? 'Conectando...' : 'Hablar con un asesor'} <ArrowRight className="size-4" />
                </button>
                <p className="mt-3 text-center text-[10px] text-[#84a1ad]">
                  O escríbenos directo al <a href="https://wa.me/50588241003?text=Hola%2C%20me%20interesa%20NovaHub%20ERP" className="font-bold text-[#22c55e] underline">WhatsApp</a>
                </p>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-4">
                  {messages.map((msg) => (
                    <div key={msg.id} className={`mb-3 flex ${msg.sender === 'lead' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${msg.sender === 'lead' ? 'bg-[#22c55e] text-white rounded-br-md' : 'bg-[#f0fdf4] text-[#174a3a] border border-[#d1fae5] rounded-bl-md'}`}>
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {loading && (
                    <div className="mb-3 flex justify-start">
                      <div className="rounded-2xl rounded-bl-md border border-[#d1fae5] bg-[#f0fdf4] px-4 py-3 text-sm text-[#5d7884]">
                        <span className="inline-flex gap-1.5">
                          <motion.span animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0 }} className="inline-block size-1.5 rounded-full bg-[#22c55e]" />
                          <motion.span animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.15 }} className="inline-block size-1.5 rounded-full bg-[#22c55e]" />
                          <motion.span animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.3 }} className="inline-block size-1.5 rounded-full bg-[#22c55e]" />
                        </span>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
                <div className="border-t border-[#d1fae5] p-3">
                  <div className="flex gap-2">
                    <input type="text" placeholder="Escribe tu mensaje..." value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={handleKeyPress} className="flex-1 rounded-xl border border-[#d1fae5] px-4 py-2.5 text-sm text-[#174a3a] placeholder-[#84a1ad] outline-none transition-all focus:border-primary" />
                    <button onClick={handleSendMessage} disabled={!input.trim() || loading} className="flex size-10 items-center justify-center rounded-xl bg-[#22c55e] text-white transition-colors hover:bg-[#1aad50] disabled:opacity-50">
                      <Send className="size-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

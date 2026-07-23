import { useState, useEffect, useRef } from 'react';
import {
  Send, Paperclip, Loader2, MessageSquare, FileText,
  ChevronLeft, MessageCircle,
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { cn } from '../ui/utils';
import { toast } from 'sonner';
import { legalService, type LegalMessage } from '../../services/legal.service';
import { storageService } from '../../services/storage.service';
import { useAuth } from '../../contexts/AuthContext';

interface LegalChatPanelProps {
  caseId: string;
  caseNumber: string;
  onBack: () => void;
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 8) return '505' + digits;
  if (digits.length === 10 && digits.startsWith('505')) return digits;
  if (digits.length === 11 && digits.startsWith('505')) return digits;
  if (digits.length > 8 && !digits.startsWith('505')) return '505' + digits;
  return digits;
}

export function LegalChatPanel({ caseId, caseNumber, onBack }: LegalChatPanelProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<LegalMessage[]>([]);
  const [newText, setNewText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [customerPhone, setCustomerPhone] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchMessages = async () => {
    try {
      const res: any = await legalService.listMessages(caseId);
      setMessages(res?.data || res || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [caseId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!newText.trim() && !uploading) return;
    setSending(true);
    try {
      const res: any = await legalService.addMessage(caseId, {
        content: newText.trim(),
        sender: 'lawyer',
        senderName: user?.name || 'Abogado',
      });
      setMessages((prev) => [...prev, res?.data || res]);
      setNewText('');
    } catch {
      toast.error('Error al enviar mensaje');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await storageService.uploadFile('legal-documents', file, { folder: `case-${caseId}` });
      const res: any = await legalService.addMessage(caseId, {
        sender: 'lawyer',
        senderName: user?.name || 'Abogado',
        fileUrl: uploaded.uri,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
      });
      setMessages((prev) => [...prev, res?.data || res]);
      toast.success('Archivo subido');
    } catch {
      toast.error('Error al subir archivo');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleWhatsApp = () => {
    if (!customerPhone.trim()) {
      toast.error('Ingresá el número de teléfono del cliente');
      return;
    }
    const phone = formatPhone(customerPhone);
    const text = encodeURIComponent(`Hola, te escribimos de NovaHub con respecto al caso ${caseNumber}.`);
    window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
  };

  return (
    <Card className="border-border/50 shadow-sm overflow-hidden">
      <CardContent className="p-0">
        <div className="flex items-center justify-between p-4 border-b border-border/30 bg-muted/10 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full shrink-0">
              <ChevronLeft className="size-5" />
            </Button>
            <div className="flex items-center gap-2">
              <MessageCircle className="size-4 text-primary" />
              <span className="text-sm font-black tracking-tight">Chat — {caseNumber}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="+505 1234 5678"
              className="h-8 w-40 text-xs rounded-xl"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleWhatsApp}
              className="h-8 rounded-xl gap-1.5 text-xs font-bold"
              disabled={!customerPhone.trim()}
            >
              <MessageCircle className="size-3.5" /> WhatsApp
            </Button>
          </div>
        </div>

        <div className="h-[400px] overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-background to-muted/10">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
              <MessageSquare className="size-10 text-muted-foreground/30" />
              <p className="text-sm">No hay mensajes aún. Iniciá la conversación.</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  'flex',
                  msg.sender === 'lawyer' ? 'justify-end' : 'justify-start',
                )}
              >
                <div
                  className={cn(
                    'max-w-[80%] rounded-2xl px-4 py-2.5 space-y-1',
                    msg.sender === 'lawyer'
                      ? 'bg-primary text-primary-foreground rounded-br-md'
                      : 'bg-muted/60 text-foreground border border-border/30 rounded-bl-md',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-[10px] font-bold uppercase tracking-wider',
                      msg.sender === 'lawyer' ? 'text-primary-foreground/70' : 'text-muted-foreground',
                    )}>
                      {msg.senderName}
                    </span>
                    <Badge variant="outline" className={cn(
                      'text-[8px] px-1.5 py-0 h-4',
                      msg.sender === 'lawyer'
                        ? 'border-primary-foreground/20 text-primary-foreground/60'
                        : 'border-border/50 text-muted-foreground',
                    )}>
                      {msg.sender === 'lawyer' ? 'Abogado' : 'Cliente'}
                    </Badge>
                  </div>
                  {msg.content && (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  )}
                  {msg.fileUrl && (
                    <div className={cn(
                      'flex items-center gap-2 rounded-xl px-3 py-2 text-xs',
                      msg.sender === 'lawyer'
                        ? 'bg-primary-foreground/10'
                        : 'bg-background/80 border border-border/30',
                    )}>
                      <FileText className="size-4 shrink-0" />
                      <span className="flex-1 truncate font-medium">{msg.fileName || 'Documento'}</span>
                      {msg.fileSize && (
                        <span className="text-[10px] opacity-60 shrink-0">
                          {(msg.fileSize / 1024).toFixed(0)} KB
                        </span>
                      )}
                    </div>
                  )}
                  <div className={cn(
                    'text-[10px] flex items-center gap-2',
                    msg.sender === 'lawyer' ? 'text-primary-foreground/50 justify-end' : 'text-muted-foreground/60 justify-start',
                  )}>
                    {new Date(msg.createdAt).toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit' })}
                    {' · '}
                    {new Date(msg.createdAt).toLocaleDateString('es-NI')}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-border/30 p-4 bg-background">
          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escribí un mensaje..."
                rows={2}
                className="w-full rounded-2xl border border-border/50 bg-muted/20 px-4 py-2.5 pr-10 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50"
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="absolute right-3 bottom-3 text-muted-foreground hover:text-foreground transition-colors"
              >
                {uploading ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
              </button>
            </div>
            <Button
              onClick={handleSend}
              disabled={sending || (!newText.trim() && !uploading)}
              className="size-[42px] rounded-2xl shrink-0"
            >
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          </div>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={handleFileSelect}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
          />
        </div>
      </CardContent>
    </Card>
  );
}

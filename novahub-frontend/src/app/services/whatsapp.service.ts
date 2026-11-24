import { api, getApiUrl, getAuthHeaders } from './api';

export type WaProvider = 'META_CLOUD' | 'QR' | 'SIMULATED';
export type WaLineStatus = 'PENDING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'ARCHIVED';
export type WaConversationStatus = 'OPEN' | 'PENDING' | 'RESOLVED';
export type WaMessageStatus = 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | 'RECEIVED';

export interface WaLineMember { userId: string; canReply: boolean; name: string; email: string }
export interface WaLine {
  id: string; name: string; phone: string | null; provider: WaProvider; status: WaLineStatus; color: string | null;
  qualityRating: string | null; assignmentMode: 'MANUAL' | 'ROUND_ROBIN'; lastSyncAt: string | null; lastError: string | null;
  hasCredentials: boolean; members: WaLineMember[]; openConversations: number; unread: number;
  disconnectedAt?: string | null;
  history?: { days: number; status: 'PENDING' | 'IMPORTING' | 'DONE'; messages: number; updatedAt: string | null } | null;
  capabilities: { deliveryStatus: boolean; phoneEchoes: boolean; serviceWindow: boolean; media: boolean } | null;
}
export interface WaOverview {
  plan: { name: string; maxLines: number; used: number; available: number };
  isAdmin: boolean; lines: WaLine[]; encryptionConfigured: boolean; webhookConfigured: boolean; qrEnabled: boolean; engine: string;
  plans: Array<{ code: string; name: string; maxLines: number; priceUsd: number }>;
}
export type WaPairingState = 'open' | 'connecting' | 'close';
export interface WaPairing { state: WaPairingState; qr?: string; pairingCode?: string; ownerPhone?: string }
export interface WaContact { id: string; phone: string; name: string; isGroup?: boolean; leadId: string | null; customerId: string | null }
export interface WaParticipant { id: string; phone: string | null; name: string | null; admin: boolean }
export interface WaConversation {
  id: string; lineId: string; line: { id: string; name: string; color: string | null; provider: WaProvider };
  status: WaConversationStatus; unreadCount: number; assigneeId: string | null; assigneeName: string | null;
  lastMessageAt: string | null; lastMessagePreview: string | null; needsReply: boolean; contact: WaContact;
  windowOpen: boolean; windowExpiresAt: string | null;
  firstIncomingAt?: string | null; firstResponseAt?: string | null;
}
export interface WaMessage {
  id: string; direction: 'IN' | 'OUT'; status: WaMessageStatus; type: string; body: string | null; mediaMime: string | null; mediaName: string | null;
  hasMedia: boolean; error: string | null; timestamp: string; clientRef: string | null; senderName: string | null; fromPhone: boolean; participantName?: string | null; participantPhone?: string | null;
}
export interface WaStats {
  from: string; to: string;
  lines: Array<{ lineId: string; name: string; color: string | null; newConversations: number; avgFirstResponseSec: number | null; unanswered: number; unassigned: number; messagesIn: number; messagesOut: number }>;
  agents: Array<{ userId: string; name: string; conversations: number; avgFirstResponseSec: number | null; unanswered: number }>;
}
export interface WaSuiteFlags { whatsappActive: boolean; chatwootVisible: boolean }
export interface WaReportQuery { from: string; to: string; lineIds?: string[]; agentIds?: string[]; tz?: string }
export interface WaReport {
  from: string; to: string; tz: string;
  kpis: {
    messagesIn: number; messagesOut: number; conversationsActive: number; conversationsNew: number; groupConversations: number; resolved: number;
    messagesPerConversation: number | null; openNow: number; unansweredNow: number; unassignedNow: number;
    firstResponse: { sample: number; avgSec: number | null; medianSec: number | null; p90Sec: number | null; answeredPct: number | null; within5Pct: number | null; within15Pct: number | null; within60Pct: number | null };
  };
  daily: Array<{ day: string; in: number; out: number }>;
  hourly: Array<{ dow: number; hour: number; count: number }>;
  lines: Array<{ lineId: string; name: string; color: string | null; conversations: number; avgFirstResponseSec: number | null; unanswered: number }>;
  agents: Array<{ userId: string; name: string; conversations: number; avgFirstResponseSec: number | null; messagesSent: number; resolved: number; unanswered: number }>;
  types: Array<{ type: string; count: number }>;
  topContacts: Array<{ id: string; name: string; isGroup: boolean; messages: number }>;
  backlogAging: Array<{ bucket: string; count: number }>;
}
export type WaReportSection = 'daily' | 'lines' | 'agents' | 'hourly' | 'conversations';
export type WaScope = 'all' | 'unread' | 'unassigned' | 'mine' | 'resolved';
export interface WaRealtimeEvent { type: 'message' | 'status' | 'conversation' | 'line' | 'resync'; tenantId?: string; lineId?: string; conversationId?: string; messageId?: string }

const base = '/novachat/wa';
const enc = encodeURIComponent;

function reportParams(query: WaReportQuery) {
  return {
    from: query.from, to: query.to, tz: query.tz || Intl.DateTimeFormat().resolvedOptions().timeZone,
    ...(query.lineIds?.length ? { lineIds: query.lineIds.join(',') } : {}), ...(query.agentIds?.length ? { agentIds: query.agentIds.join(',') } : {}),
  };
}

export const whatsappService = {
  overview: (signal?: AbortSignal) => api.get<WaOverview>(`${base}/overview`, { signal }),
  createLine: (body: Record<string, unknown>) => api.post<WaLine & { pairing?: WaPairing }>(`${base}/lines`, body),
  pairingStatus: (id: string, withQr = false, signal?: AbortSignal) => api.get<WaPairing>(`${base}/lines/${enc(id)}/pairing`, { params: withQr ? { qr: '1' } : {}, signal }),
  restartPairing: (id: string, body: { historyDays?: number | null } = {}) => api.post<WaPairing>(`${base}/lines/${enc(id)}/pairing`, body),
  suiteFlags: (signal?: AbortSignal) => api.get<WaSuiteFlags>(`${base}/suite-flags`, { signal }),
  reportSummary: (query: WaReportQuery, signal?: AbortSignal) => api.get<WaReport>(`${base}/reports/summary`, { params: reportParams(query), signal }),
  updateLine: (id: string, body: Record<string, unknown>) => api.patch<WaLine>(`${base}/lines/${enc(id)}`, body),
  setMembers: (id: string, members: Array<{ userId: string; canReply: boolean }>) => api.put<{ ok: boolean }>(`${base}/lines/${enc(id)}/members`, { members }),
  verifyLine: (id: string) => api.post<WaLine>(`${base}/lines/${enc(id)}/verify`, {}),
  archiveLine: (id: string) => api.delete<{ ok: boolean }>(`${base}/lines/${enc(id)}`),
  simulateIncoming: (id: string, body: { phone?: string; name?: string; body?: string }) => api.post<{ ok: boolean }>(`${base}/lines/${enc(id)}/simulate-incoming`, body),
  conversations: (params: { lineId?: string; lineIds?: string; scope?: WaScope; q?: string; cursor?: string; limit?: number }, signal?: AbortSignal) =>
    api.get<{ items: WaConversation[]; nextCursor: string | null }>(`${base}/conversations`, { params, signal }),
  conversation: (id: string, signal?: AbortSignal) => api.get<WaConversation>(`${base}/conversations/${enc(id)}`, { signal }),
  messages: (id: string, params: { before?: string; limit?: number } = {}, signal?: AbortSignal) =>
    api.get<{ items: WaMessage[]; nextBefore: string | null }>(`${base}/conversations/${enc(id)}/messages`, { params, signal }),
  markRead: (id: string) => api.post<{ ok: boolean }>(`${base}/conversations/${enc(id)}/read`, {}),
  sendText: (id: string, body: string, clientRef: string, mentions?: string[]) => api.post<WaMessage>(`${base}/conversations/${enc(id)}/messages`, { body, clientRef, ...(mentions?.length ? { mentions } : {}) }),
  participants: (id: string, signal?: AbortSignal) => api.get<{ items: WaParticipant[] }>(`${base}/conversations/${enc(id)}/participants`, { signal }),
  photo: (id: string, signal?: AbortSignal) => api.get<{ url: string | null }>(`${base}/conversations/${enc(id)}/photo`, { signal }),
  sendMedia: (id: string, file: File, caption: string, clientRef: string) => {
    const form = new FormData();
    form.append('file', file, file.name);
    if (caption) form.append('caption', caption);
    form.append('clientRef', clientRef);
    return api.post<WaMessage>(`${base}/conversations/${enc(id)}/media`, form);
  },
  retry: (messageId: string) => api.post<WaMessage>(`${base}/messages/${enc(messageId)}/retry`, {}),
  assign: (id: string, assigneeId: string | null) => api.patch<{ ok: boolean }>(`${base}/conversations/${enc(id)}/assign`, { assigneeId }),
  setStatus: (id: string, status: WaConversationStatus) => api.patch<{ ok: boolean }>(`${base}/conversations/${enc(id)}/status`, { status }),
  stats: (params: { from?: string; to?: string }, signal?: AbortSignal) => api.get<WaStats>(`${base}/stats`, { params, signal }),
};

/** Descarga un reporte en CSV con la sesión actual. */
export async function downloadWhatsAppReport(section: WaReportSection, query: WaReportQuery): Promise<void> {
  const params = new URLSearchParams({ section, ...reportParams(query) } as Record<string, string>);
  const response = await fetch(getApiUrl(`${base}/reports/export?${params.toString()}`), { headers: { ...getAuthHeaders() } });
  if (!response.ok) throw new Error('No se pudo generar el reporte.');
  const name = /filename="([^"]+)"/.exec(response.headers.get('Content-Disposition') || '')?.[1] || `whatsapp-${section}.csv`;
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url; link.download = name;
  document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Descarga un archivo de una conversación con la sesión actual y devuelve una URL temporal para mostrarlo. */
export async function fetchWhatsAppMediaUrl(messageId: string, signal?: AbortSignal): Promise<string> {
  const response = await fetch(getApiUrl(`${base}/messages/${enc(messageId)}/media`), { headers: { ...getAuthHeaders() }, signal });
  if (!response.ok) throw new Error('No se pudo abrir el archivo (puede haber expirado en WhatsApp).');
  return URL.createObjectURL(await response.blob());
}

/**
 * Tiempo real por SSE con reconexión automática. Al reconectar avisa con `resync` para que la pantalla
 * vuelva a leer todo lo que pudo perderse mientras estuvo desconectada.
 */
export function subscribeToWhatsAppEvents(onEvent: (event: WaRealtimeEvent) => void, onState?: (online: boolean) => void): () => void {
  const controller = new AbortController();
  let hadConnection = false;
  const connect = async () => {
    let delay = 1500;
    while (!controller.signal.aborted) {
      try {
        const response = await fetch(getApiUrl(`${base}/events`), { headers: { Accept: 'text/event-stream', ...getAuthHeaders() }, cache: 'no-store', signal: controller.signal });
        if (response.status === 403 || response.status === 401) return; // sin plan o sin permiso: no insistir
        if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
        delay = 1500;
        onState?.(true);
        if (hadConnection) onEvent({ type: 'resync' });
        hadConnection = true;
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (!controller.signal.aborted) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split(/\r?\n\r?\n/);
          buffer = frames.pop() || '';
          for (const frame of frames) {
            const data = frame.split(/\r?\n/).filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trimStart()).join('\n');
            if (!data) continue;
            try {
              const event = JSON.parse(data) as WaRealtimeEvent;
              if (event.type && event.type !== ('keepalive' as string) && event.type !== ('connected' as string)) onEvent(event);
            } catch { /* un evento dañado no debe cortar el flujo */ }
          }
        }
      } catch {
        if (controller.signal.aborted) return;
      }
      onState?.(false);
      if (!controller.signal.aborted) {
        await new Promise((resolve) => window.setTimeout(resolve, delay));
        delay = Math.min(delay * 2, 15000);
      }
    }
  };
  void connect();
  return () => controller.abort();
}

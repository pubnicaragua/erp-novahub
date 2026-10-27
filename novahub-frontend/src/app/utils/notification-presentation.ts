const MAX_PRESENTED_NOTIFICATION_EVENTS = 1_000;
const CLAIM_WINDOW_MS = 80;
const CHANNEL_NAME = 'novahub:notification-presentation';

type ClaimMessage = {
  type: 'claim' | 'committed';
  claimKey: string;
  token: string;
};

const localClaims = new Set<string>();
const pendingClaims = new Map<string, Set<string>>();
const committedClaims = new Set<string>();
let claimChannel: BroadcastChannel | null | undefined;

/** One same-origin tab claims each group event; Web Locks serialize claims when available. */
export async function claimNotificationPresentation(identity: string, eventId: string): Promise<boolean> {
  const prefix = `nh-notification-presented:${encodeURIComponent(identity)}:`;
  const claimKey = `${prefix}${encodeURIComponent(eventId)}`;
  if (localClaims.has(claimKey) || hasPersistedClaim(claimKey)) return false;

  const claim = () => persistClaim(claimKey, prefix);
  if (typeof navigator !== 'undefined' && 'locks' in navigator && navigator.locks) {
    try {
      return await navigator.locks.request(claimKey, { mode: 'exclusive' }, claim);
    } catch {
      // Continue with the shared-channel fallback if the lock service is unavailable.
    }
  }

  const channel = getClaimChannel();
  if (!channel) return claim();

  const token = createClaimToken();
  const contenders = pendingClaims.get(claimKey) || new Set<string>();
  contenders.add(token);
  pendingClaims.set(claimKey, contenders);
  channel.postMessage({ type: 'claim', claimKey, token } satisfies ClaimMessage);
  await new Promise((resolve) => window.setTimeout(resolve, CLAIM_WINDOW_MS));

  if (committedClaims.has(claimKey) || localClaims.has(claimKey) || hasPersistedClaim(claimKey)) {
    contenders.delete(token);
    return false;
  }

  const winner = [...contenders].sort()[0];
  contenders.delete(token);
  if (winner !== token) return false;

  const claimed = claim();
  if (claimed) channel.postMessage({ type: 'committed', claimKey, token } satisfies ClaimMessage);
  return claimed;
}

function getClaimChannel(): BroadcastChannel | null {
  if (claimChannel !== undefined) return claimChannel;
  if (typeof BroadcastChannel === 'undefined') {
    claimChannel = null;
    return null;
  }

  try {
    claimChannel = new BroadcastChannel(CHANNEL_NAME);
    claimChannel.addEventListener('message', (event: MessageEvent<ClaimMessage>) => {
      const message = event.data;
      if (!message || typeof message.claimKey !== 'string' || typeof message.token !== 'string') return;
      if (message.type === 'committed') {
        committedClaims.add(message.claimKey);
        if (committedClaims.size > MAX_PRESENTED_NOTIFICATION_EVENTS) {
          committedClaims.delete(committedClaims.values().next().value as string);
        }
        return;
      }
      if (message.type !== 'claim') return;
      const contenders = pendingClaims.get(message.claimKey);
      contenders?.add(message.token);
    });
  } catch {
    claimChannel = null;
  }
  return claimChannel;
}

function hasPersistedClaim(claimKey: string): boolean {
  try {
    return localStorage.getItem(claimKey) !== null;
  } catch {
    return false;
  }
}

function persistClaim(claimKey: string, prefix: string): boolean {
  if (localClaims.has(claimKey) || hasPersistedClaim(claimKey)) return false;
  localClaims.add(claimKey);
  try {
    localStorage.setItem(claimKey, String(Date.now()));
    pruneOldClaims(prefix);
  } catch {
    // Browser storage may be disabled; keep the claim for this tab's lifetime.
  }
  return true;
}

function pruneOldClaims(prefix: string) {
  const matchingKeys: Array<{ key: string; timestamp: number }> = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith(prefix)) continue;
    matchingKeys.push({ key, timestamp: Number(localStorage.getItem(key)) || 0 });
  }
  if (matchingKeys.length <= MAX_PRESENTED_NOTIFICATION_EVENTS) return;
  matchingKeys.sort((left, right) => left.timestamp - right.timestamp);
  matchingKeys.slice(0, matchingKeys.length - MAX_PRESENTED_NOTIFICATION_EVENTS).forEach(({ key }) => {
    localStorage.removeItem(key);
  });
}

function createClaimToken(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

if (typeof window !== 'undefined') getClaimChannel();

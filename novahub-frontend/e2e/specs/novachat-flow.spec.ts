import { test, expect } from '../fixtures/full-auth.fixture';
import type { APIRequestContext } from '@playwright/test';
import { createDbAssertions } from '../helpers/db-assertions';
import { NovaChatPage } from '../page-objects/NovaChatPage';

test.describe('NovaHub ERP — NovaChat, mensajes y aislamiento de conversaciones', () => {
  test.setTimeout(120_000);

  const apiUrl = String(
    process.env.E2E_API_URL || `http://localhost:${Number(process.env.E2E_BACKEND_PORT || 3310)}/api`,
  ).replace(/\/+$/, '');

  async function json<T>(response: Awaited<ReturnType<APIRequestContext['post']>>): Promise<T> {
    const text = await response.text();
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(`Respuesta no JSON de ${response.url()}: HTTP ${response.status()} ${text}`);
    }
  }

  test('siembra una bandeja, responde desde UI y no expone la conversación a otro tenant', async ({
    page,
    request,
    fullTenantSession,
    apiInterceptor,
  }) => {
    const db = createDbAssertions();
    const chatPage = new NovaChatPage(page);
    const suffix = fullTenantSession.runId.replace(/[^a-z0-9]/gi, '').slice(0, 18);
    const message = `Mensaje NovaChat E2E ${suffix}`;
    const mark = apiInterceptor.mark();

    try {
      const seedResponse = await request.post(`${apiUrl}/novachat/seed`, {
        headers: { Authorization: `Bearer ${fullTenantSession.token}` },
      });
      expect(seedResponse.status()).toBeGreaterThanOrEqual(200);
      expect(seedResponse.status()).toBeLessThan(300);
      const seed = await json<{ conversations: number }>(seedResponse);
      expect(seed.conversations).toBeGreaterThan(0);

      const conversationsResponse = await request.get(`${apiUrl}/novachat/conversations`, {
        headers: { Authorization: `Bearer ${fullTenantSession.token}` },
      });
      expect(conversationsResponse.ok()).toBeTruthy();
      const conversations = await conversationsResponse.json() as Array<{ id: string; subject?: string; status: string }>;
      expect(conversations.length).toBeGreaterThan(0);
      const conversation = conversations[0];
      expect(conversation.subject).toBeTruthy();
      const persistedConversation = await db.recordByScope('chatConversations', conversation.id, 'clientTenantId', fullTenantSession.tenantId);
      expect(persistedConversation).not.toBeNull();
      await db.assertOwnedByScope('chatConversations', conversation.id, 'clientTenantId', fullTenantSession.tenantId);

      await chatPage.openInbox();
      await chatPage.openConversation(String(conversation.id));
      const messageResponseId = await chatPage.sendMessage(message);
      const persistedMessage = await db.recordByIdUnscoped('chatMessages', messageResponseId);
      expect(String(persistedMessage?.content)).toBe(message);
      expect(String(persistedMessage?.conversationId)).toBe(conversation.id);

      const statusResponse = await request.patch(`${apiUrl}/novachat/conversations/${conversation.id}/status`, {
        headers: { Authorization: `Bearer ${fullTenantSession.token}` },
        data: { status: 'RESOLVED' },
      });
      expect(statusResponse.status()).toBeGreaterThanOrEqual(200);
      expect(statusResponse.status()).toBeLessThan(300);
      const resolvedConversation = await db.recordByScope('chatConversations', conversation.id, 'clientTenantId', fullTenantSession.tenantId);
      expect(String(resolvedConversation?.status)).toBe('RESOLVED');

      const invalidMessage = await request.post(`${apiUrl}/novachat/messages`, {
        headers: { Authorization: `Bearer ${fullTenantSession.token}` },
        data: { conversationId: '00000000-0000-0000-0000-000000000000', content: 'No debe persistir' },
      });
      expect(invalidMessage.status()).toBeGreaterThanOrEqual(400);
      expect(invalidMessage.status()).toBeLessThan(500);

      const otherTenantResponse = await request.post(`${apiUrl}/auth/register-tenant`, {
        data: {
          companyName: `Tenant NovaChat Ajeno ${suffix}`,
          userName: 'Admin NovaChat Ajeno',
          email: `novachat-ajeno-${fullTenantSession.runId.replace(/[^a-z0-9]/gi, '')}@novahub.test`,
          password: 'E2eTest!2026Xx',
          industry: 'OTHER',
          selectedModules: ['NOVACHAT'],
        },
      });
      expect(otherTenantResponse.status()).toBeGreaterThanOrEqual(200);
      expect(otherTenantResponse.status()).toBeLessThan(300);
      const otherTenant = await json<{ access_token: string }>(otherTenantResponse);
      const otherConversationsResponse = await request.get(`${apiUrl}/novachat/conversations`, {
        headers: { Authorization: `Bearer ${otherTenant.access_token}` },
      });
      expect(otherConversationsResponse.ok()).toBeTruthy();
      expect(await otherConversationsResponse.json()).toEqual([]);
      const crossTenantMessages = await request.get(`${apiUrl}/novachat/conversations/${conversation.id}/messages`, {
        headers: { Authorization: `Bearer ${otherTenant.access_token}` },
      });
      expect(crossTenantMessages.status()).toBeGreaterThanOrEqual(400);
      expect(crossTenantMessages.status()).toBeLessThan(500);

      await chatPage.assertNoViewportOverflow();
      apiInterceptor.assertSuccessful({ since: mark, requireJsonContentType: true, validateRequestPayload: true, maxLatencyMs: 10_000 });
    } finally {
      await db.close();
    }
  });
});

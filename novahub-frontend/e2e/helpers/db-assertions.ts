import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

const SAFE_TABLES = {
  clientTenants: 'ClientTenant',
  businessUnits: 'BusinessUnit',
  users: 'User',
  customers: 'Customer',
  suppliers: 'Supplier',
  products: 'Product',
  warehouses: 'Warehouse',
  transfers: 'Transfer',
  transferItems: 'TransferItem',
  salesOrders: 'SalesOrder',
  invoices: 'Invoice',
  purchaseOrders: 'PurchaseOrder',
  purchaseOrderItems: 'PurchaseOrderItem',
  purchaseReceipts: 'PurchaseReceipt',
  purchaseReceiptItems: 'PurchaseReceiptItem',
  supplierInvoices: 'SupplierInvoice',
  inventoryLevels: 'InventoryLevel',
  inventoryMovements: 'InventoryMovement',
  journalEntries: 'JournalEntry',
  accounts: 'Account',
  roles: 'Role',
  accountingConfigs: 'accounting_config',
  idempotencyKeys: 'IdempotencyKey',
  departments: 'Department',
  positions: 'Position',
  employees: 'Employee',
  documents: 'Document',
  notifications: 'Notification',
  salesProspects: 'SalesProspect',
  activities: 'Activity',
  activityEvidences: 'ActivityEvidence',
  reminders: 'Reminder',
  projects: 'Project',
  projectTasks: 'Task',
  projectMilestones: 'ProjectMilestone',
  projectBudgetLines: 'ProjectBudgetLine',
  projectCosts: 'ProjectCost',
  projectActivities: 'ProjectActivity',
  restaurantTables: 'RestaurantTable',
  restaurantOrders: 'RestaurantOrder',
  restaurantOrderItems: 'RestaurantOrderItem',
  restaurantKitchenTickets: 'RestaurantKitchenTicket',
  trackingShipments: 'TrackingShipment',
  trackingEvents: 'TrackingEvent',
  financialExpenses: 'FinancialExpense',
  incomes: 'Income',
  supportTickets: 'SupportTicket',
  tickets: 'Ticket',
  ticketComments: 'TicketComment',
  ticketAudits: 'TicketAudit',
  ticketAttachments: 'TicketAttachment',
  legalCases: 'LegalCase',
  legalCaseNotes: 'LegalCaseNote',
  legalDocuments: 'LegalDocument',
  legalCaseMessages: 'LegalCaseMessage',
  legalReminders: 'LegalReminder',
  financingApplications: 'FinancingApplication',
  financingDocuments: 'FinancingDocument',
  chatConversations: 'ChatConversation',
  chatMessages: 'ChatMessage',
  chatChannels: 'ChatChannel',
  chatContacts: 'ChatContact',
  subscriptionRequests: 'SubscriptionRequest',
  moduleSubscriptions: 'ModuleSubscription',
  trainingVideos: 'ERPTrainingVideo',
} as const;

type SafeTable = keyof typeof SAFE_TABLES;
type ScopeColumn = 'clientTenantId' | 'tenantId';

interface QueryClient {
  $connect(): Promise<void>;
  $disconnect(): Promise<void>;
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
}

interface PoolLike {
  end(): Promise<void>;
}

interface BackendRuntimeModule {
  PrismaClient: new (options: { adapter: unknown }) => QueryClient;
}

interface BackendAdapterModule {
  PrismaPg: new (pool: unknown) => unknown;
}

interface BackendPgModule {
  Pool: new (options: { connectionString: string; max: number }) => PoolLike;
}

export interface InventorySnapshot {
  quantity: number;
  reserved: number;
  warehouseId: string;
  productId: string;
  variantId: string;
  clientTenantId: string | null;
}

export interface JournalBalance {
  debit: number;
  credit: number;
  difference: number;
}

export interface InventoryMovementSnapshot {
  type: string;
  quantity: number;
  reference: string | null;
  warehouseId: string;
  productId: string;
  clientTenantId: string;
}

function e2eDatabaseUrl(): string {
  const url = process.env.DATABASE_URL_E2E?.trim();
  if (!url) throw new Error('Falta DATABASE_URL_E2E; la suite no puede tocar una base no aislada.');
  if (process.env.E2E_ALLOW_DATABASE_MUTATIONS !== '1') {
    throw new Error('Define E2E_ALLOW_DATABASE_MUTATIONS=1 para autorizar datos temporales E2E.');
  }
  if (process.env.E2E_ISOLATED_DATABASE !== '1') {
    throw new Error('Define E2E_ISOLATED_DATABASE=1; no se permite una base compartida.');
  }
  if (url === process.env.DATABASE_URL?.trim()) {
    throw new Error('DATABASE_URL_E2E coincide con DATABASE_URL; ejecución bloqueada por seguridad.');
  }

  const parsed = new URL(url);
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  const declaredName = process.env.E2E_DATABASE_NAME?.trim();
  const looksIsolated = /(?:e2e|test|qa)/i.test(databaseName);
  if (!looksIsolated && declaredName !== databaseName) {
    throw new Error(`La base E2E '${databaseName}' no parece aislada; define E2E_DATABASE_NAME si corresponde.`);
  }
  return url;
}

function backendDirectory(): string {
  const configured = process.env.E2E_BACKEND_DIR?.trim();
  if (configured) return configured;
  return path.resolve(process.cwd(), '..', '..', 'Backend');
}

function loadBackendRuntime(): { client: QueryClient; pool: PoolLike } {
  const requireBackend = createRequire(import.meta.url);
  const backendDir = backendDirectory();
  const prismaModule = requireBackend(path.join(backendDir, 'node_modules', '@prisma', 'client')) as BackendRuntimeModule;
  const adapterModule = requireBackend(path.join(backendDir, 'node_modules', '@prisma', 'adapter-pg')) as BackendAdapterModule;
  const pgModule = requireBackend(path.join(backendDir, 'node_modules', 'pg')) as BackendPgModule;
  const pool = new pgModule.Pool({ connectionString: e2eDatabaseUrl(), max: 2 });
  const client = new prismaModule.PrismaClient({ adapter: new adapterModule.PrismaPg(pool) });
  return { client, pool };
}

function tableName(table: SafeTable): string {
  return `"${SAFE_TABLES[table]}"`;
}

function decimalNumber(value: unknown): number {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`Decimal inválido en aserción E2E: ${String(value)}`);
  return number;
}

export class DbAssertions {
  private readonly runtime = loadBackendRuntime();
  private connected = false;

  async connect(): Promise<void> {
    if (!this.connected) {
      await this.runtime.client.$connect();
      this.connected = true;
    }
  }

  async countByTenant(table: SafeTable, clientTenantId: string): Promise<number> {
    await this.connect();
    const rows = await this.runtime.client.$queryRawUnsafe<Array<{ count: bigint | number }>>(
      `SELECT COUNT(*)::int AS count FROM ${tableName(table)} WHERE "clientTenantId" = $1`,
      clientTenantId,
    );
    return Number(rows[0]?.count ?? 0);
  }

  /**
   * El alta pública crea el grupo y la sucursal, pero no siempre crea el
   * rubro operativo requerido por los endpoints de inventario. Este bootstrap
   * se ejecuta únicamente en la base aislada E2E y deja el tenant listo para
   * probar alcance de bodega/sucursal sin cambiar contratos productivos.
   */
  async ensureTenantBusinessUnit(tenantId: string, runId: string): Promise<string> {
    await this.connect();
    const tenants = await this.runtime.client.$queryRawUnsafe<Array<{ enterpriseGroupId: string; businessUnitId: string | null }>>(
      `SELECT "enterpriseGroupId", "businessUnitId" FROM ${tableName('clientTenants')} WHERE id = $1 LIMIT 1`,
      tenantId,
    );
    const tenant = tenants[0];
    if (!tenant) throw new Error(`No existe el tenant E2E ${tenantId} para preparar su rubro.`);
    if (tenant.businessUnitId) return tenant.businessUnitId;

    const id = randomUUID();
    const slug = `e2e-${runId.replace(/[^a-z0-9]/gi, '').slice(0, 24)}-${id.slice(0, 8)}`.toLowerCase();
    await this.runtime.client.$executeRawUnsafe(
      `INSERT INTO ${tableName('businessUnits')}
        (id, "enterpriseGroupId", name, slug, "enabledModules", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5::jsonb, NOW(), NOW())`,
      id,
      tenant.enterpriseGroupId,
      `Rubro E2E ${runId}`,
      slug,
      JSON.stringify([]),
    );
    await this.runtime.client.$executeRawUnsafe(
      `UPDATE ${tableName('clientTenants')} SET "businessUnitId" = $1 WHERE id = $2`,
      id,
      tenantId,
    );
    return id;
  }

  async assertOwned(table: SafeTable, recordId: string, clientTenantId: string): Promise<void> {
    await this.connect();
    const rows = await this.runtime.client.$queryRawUnsafe<Array<{ count: bigint | number }>>(
      `SELECT COUNT(*)::int AS count FROM ${tableName(table)} WHERE id = $1 AND "clientTenantId" = $2`,
      recordId,
      clientTenantId,
    );
    if (Number(rows[0]?.count ?? 0) !== 1) {
      throw new Error(`${SAFE_TABLES[table]} ${recordId} no pertenece al tenant esperado ${clientTenantId}.`);
    }
  }

  async assertNotVisibleToTenant(table: SafeTable, recordId: string, otherTenantId: string): Promise<void> {
    await this.connect();
    const rows = await this.runtime.client.$queryRawUnsafe<Array<{ count: bigint | number }>>(
      `SELECT COUNT(*)::int AS count FROM ${tableName(table)} WHERE id = $1 AND "clientTenantId" = $2`,
      recordId,
      otherTenantId,
    );
    if (Number(rows[0]?.count ?? 0) !== 0) {
      throw new Error(`${SAFE_TABLES[table]} ${recordId} es visible desde un tenant ajeno.`);
    }
  }

  async recordById(table: SafeTable, recordId: string, clientTenantId: string): Promise<Record<string, unknown> | null> {
    await this.connect();
    const rows = await this.runtime.client.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT * FROM ${tableName(table)} WHERE id = $1 AND "clientTenantId" = $2 LIMIT 1`,
      recordId,
      clientTenantId,
    );
    return rows[0] || null;
  }

  async recordByIdUnscoped(table: SafeTable, recordId: string): Promise<Record<string, unknown> | null> {
    await this.connect();
    const rows = await this.runtime.client.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT * FROM ${tableName(table)} WHERE id = $1 LIMIT 1`,
      recordId,
    );
    return rows[0] || null;
  }

  async recordByScope(
    table: SafeTable,
    recordId: string,
    scopeColumn: ScopeColumn,
    scopeId: string,
  ): Promise<Record<string, unknown> | null> {
    await this.connect();
    const rows = await this.runtime.client.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT * FROM ${tableName(table)} WHERE id = $1 AND "${scopeColumn}" = $2 LIMIT 1`,
      recordId,
      scopeId,
    );
    return rows[0] || null;
  }

  async assertOwnedByScope(
    table: SafeTable,
    recordId: string,
    scopeColumn: ScopeColumn,
    scopeId: string,
  ): Promise<void> {
    const record = await this.recordByScope(table, recordId, scopeColumn, scopeId);
    if (!record) {
      throw new Error(`${SAFE_TABLES[table]} ${recordId} no pertenece al alcance ${scopeColumn}=${scopeId}.`);
    }
  }

  async assertNotVisibleByScope(
    table: SafeTable,
    recordId: string,
    scopeColumn: ScopeColumn,
    scopeId: string,
  ): Promise<void> {
    await this.connect();
    const rows = await this.runtime.client.$queryRawUnsafe<Array<{ count: bigint | number }>>(
      `SELECT COUNT(*)::int AS count FROM ${tableName(table)} WHERE id = $1 AND "${scopeColumn}" = $2`,
      recordId,
      scopeId,
    );
    if (Number(rows[0]?.count ?? 0) !== 0) {
      throw new Error(`${SAFE_TABLES[table]} ${recordId} aparece en un alcance ajeno.`);
    }
  }

  async countByScope(table: SafeTable, scopeColumn: ScopeColumn, scopeId: string): Promise<number> {
    await this.connect();
    const rows = await this.runtime.client.$queryRawUnsafe<Array<{ count: bigint | number }>>(
      `SELECT COUNT(*)::int AS count FROM ${tableName(table)} WHERE "${scopeColumn}" = $1`,
      scopeId,
    );
    return Number(rows[0]?.count ?? 0);
  }

  async trackingEventsForShipment(shipmentId: string): Promise<Array<Record<string, unknown>>> {
    await this.connect();
    return this.runtime.client.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT id, status, label, location, "shipmentId" FROM ${tableName('trackingEvents')} WHERE "shipmentId" = $1 ORDER BY "occurredAt" ASC`,
      shipmentId,
    );
  }

  async countTrackingShipmentsByCode(tenantId: string, trackingCode: string): Promise<number> {
    await this.connect();
    const rows = await this.runtime.client.$queryRawUnsafe<Array<{ count: bigint | number }>>(
      `SELECT COUNT(*)::int AS count FROM ${tableName('trackingShipments')} WHERE "tenantId" = $1 AND "trackingCode" = $2`,
      tenantId,
      trackingCode,
    );
    return Number(rows[0]?.count ?? 0);
  }

  async activityEvidencesForActivity(activityId: string): Promise<Array<Record<string, unknown>>> {
    await this.connect();
    return this.runtime.client.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT id, "activityId", "fileUrl", "uploadedBy" FROM ${tableName('activityEvidences')} WHERE "activityId" = $1 ORDER BY "uploadedAt" ASC`,
      activityId,
    );
  }

  async restaurantKitchenTicketsForOrder(orderId: string): Promise<Array<Record<string, unknown>>> {
    await this.connect();
    return this.runtime.client.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT id, status, "orderId", "branchId", "clientTenantId" FROM ${tableName('restaurantKitchenTickets')} WHERE "orderId" = $1 ORDER BY "createdAt" ASC`,
      orderId,
    );
  }

  async restaurantEventsForOrder(orderId: string): Promise<Array<Record<string, unknown>>> {
    await this.connect();
    return this.runtime.client.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT id, type, "orderId", "clientTenantId" FROM "RestaurantOrderEvent" WHERE "orderId" = $1 ORDER BY "createdAt" ASC`,
      orderId,
    );
  }

  async legalCaseNotesForCase(caseId: string): Promise<Array<Record<string, unknown>>> {
    await this.connect();
    return this.runtime.client.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT * FROM ${tableName('legalCaseNotes')} WHERE "caseId" = $1 ORDER BY "createdAt" ASC`,
      caseId,
    );
  }

  async legalCaseMessagesForCase(caseId: string): Promise<Array<Record<string, unknown>>> {
    await this.connect();
    return this.runtime.client.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT * FROM ${tableName('legalCaseMessages')} WHERE "caseId" = $1 ORDER BY "createdAt" ASC`,
      caseId,
    );
  }

  async journalByReference(
    referenceType: string,
    referenceId: string,
    clientTenantId: string,
  ): Promise<{ id: string; status: string; referenceType: string; referenceId: string } | null> {
    await this.connect();
    const rows = await this.runtime.client.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT id, status, "referenceType", "referenceId"
       FROM ${tableName('journalEntries')}
       WHERE "clientTenantId" = $1 AND "referenceType" = $2 AND "referenceId" = $3
       ORDER BY "createdAt" DESC LIMIT 1`,
      clientTenantId,
      referenceType,
      referenceId,
    );
    const row = rows[0];
    if (!row) return null;
    return {
      id: String(row.id),
      status: String(row.status),
      referenceType: String(row.referenceType),
      referenceId: String(row.referenceId),
    };
  }

  async inventoryMovements(
    clientTenantId: string,
    productId: string,
    warehouseId: string,
  ): Promise<InventoryMovementSnapshot[]> {
    await this.connect();
    const rows = await this.runtime.client.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT type, quantity, reference, "warehouseId", "productId", "clientTenantId"
       FROM ${tableName('inventoryMovements')}
       WHERE "clientTenantId" = $1 AND "productId" = $2 AND "warehouseId" = $3
       ORDER BY "createdAt" ASC`,
      clientTenantId,
      productId,
      warehouseId,
    );
    return rows.map((row) => ({
      type: String(row.type),
      quantity: decimalNumber(row.quantity),
      reference: row.reference === null || row.reference === undefined ? null : String(row.reference),
      warehouseId: String(row.warehouseId),
      productId: String(row.productId),
      clientTenantId: String(row.clientTenantId),
    }));
  }

  async transferItemsForTransfer(transferId: string): Promise<Array<Record<string, unknown>>> {
    await this.connect();
    return this.runtime.client.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT id, "transferId", "variantId", "destinationVariantId", quantity
       FROM ${tableName('transferItems')} WHERE "transferId" = $1 ORDER BY id ASC`,
      transferId,
    );
  }

  async inventorySnapshot(clientTenantId: string, productId: string, warehouseId: string): Promise<InventorySnapshot[]> {
    await this.connect();
    const rows = await this.runtime.client.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT quantity, reserved, "warehouseId", "productId", "variantId", "clientTenantId"
       FROM ${tableName('inventoryLevels')} WHERE "clientTenantId" = $1 AND "productId" = $2 AND "warehouseId" = $3`,
      clientTenantId,
      productId,
      warehouseId,
    );
    return rows.map((row) => ({
      quantity: decimalNumber(row.quantity),
      reserved: decimalNumber(row.reserved),
      warehouseId: String(row.warehouseId),
      productId: String(row.productId),
      variantId: String(row.variantId),
      clientTenantId: row.clientTenantId === null ? null : String(row.clientTenantId),
    }));
  }

  async assertNonNegativeInventory(clientTenantId: string): Promise<void> {
    await this.connect();
    const rows = await this.runtime.client.$queryRawUnsafe<Array<{ minimum: unknown }>>(
      `SELECT MIN(quantity) AS minimum FROM ${tableName('inventoryLevels')} WHERE "clientTenantId" = $1`,
      clientTenantId,
    );
    const minimum = rows[0]?.minimum;
    if (minimum !== null && minimum !== undefined && decimalNumber(minimum) < 0) {
      throw new Error(`Se detectó inventario negativo para el tenant ${clientTenantId}.`);
    }
  }

  async journalBalance(journalEntryId: string, clientTenantId: string): Promise<JournalBalance> {
    await this.connect();
    const rows = await this.runtime.client.$queryRawUnsafe<Array<{ debit: unknown; credit: unknown }>>(
      `SELECT COALESCE(SUM(l.debit), 0) AS debit, COALESCE(SUM(l.credit), 0) AS credit
       FROM "JournalEntryLine" l INNER JOIN ${tableName('journalEntries')} j ON j.id = l."journalEntryId"
       WHERE j.id = $1 AND j."clientTenantId" = $2`,
      journalEntryId,
      clientTenantId,
    );
    const debit = decimalNumber(rows[0]?.debit ?? 0);
    const credit = decimalNumber(rows[0]?.credit ?? 0);
    return { debit, credit, difference: Math.abs(debit - credit) };
  }

  async assertBalancedJournal(journalEntryId: string, clientTenantId: string): Promise<void> {
    const balance = await this.journalBalance(journalEntryId, clientTenantId);
    if (balance.difference > 0.000001) {
      throw new Error(`Asiento ${journalEntryId} descuadrado: Debe=${balance.debit}, Haber=${balance.credit}.`);
    }
  }

  async resetIsolatedDatabase(): Promise<void> {
    await this.connect();
    const tables = await this.runtime.client.$queryRawUnsafe<Array<{ tablename: string }>>(
      `SELECT tablename FROM pg_catalog.pg_tables
       WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
    );
    const quotedTables = tables
      .map(({ tablename }) => tablename.replace(/"/g, '""'))
      .map((tablename) => `"${tablename}"`)
      .join(', ');
    if (quotedTables) {
      let lastError: unknown;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await this.runtime.client.$executeRawUnsafe(`TRUNCATE TABLE ${quotedTables} RESTART IDENTITY CASCADE`);
          lastError = undefined;
          break;
        } catch (error) {
          lastError = error;
          if (!String(error).includes('40P01') || attempt === 2) throw error;
        }
      }
      if (lastError) throw lastError;
    }
  }

  async close(): Promise<void> {
    if (this.connected) await this.runtime.client.$disconnect();
    await this.runtime.pool.end();
    this.connected = false;
  }
}

export function createDbAssertions(): DbAssertions {
  return new DbAssertions();
}

export function assertE2eDatabaseConfigured(): void {
  e2eDatabaseUrl();
}

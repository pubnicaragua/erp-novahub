// ============================================================
// Nova Hub ERP - TypeScript Types
// Mirrors Prisma schema for frontend type safety
// ============================================================

// ---- Shared / Base ----
export type EntityStatus = 'active' | 'inactive' | 'archived' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
export type DocumentStatus = 'draft' | 'sent' | 'approved' | 'rejected' | 'cancelled' | 'DRAFT' | 'SENT' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type PaymentStatus = 'pending' | 'partial' | 'paid' | 'overdue' | 'refunded' | 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'REFUNDED';
export type PaymentMethod = 'cash' | 'transfer' | 'check' | 'card' | 'other';
export type Currency = 'USD' | 'EUR' | 'GTQ' | 'HNL' | 'NIO' | 'CRC' | 'PAB';

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export interface ApiFilters {
  search?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ---- Tenants ----
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  primaryColor?: string;
  createdAt: string;
  updatedAt: string;
}

// ---- Users ----
export interface User {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'admin' | 'manager' | 'employee' | 'viewer';
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// VENTAS (Sales)
// ============================================================

// ---- Customers ----
export interface Customer {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  type: 'individual' | 'company';
  taxId?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  creditLimit: number;
  balance: number;
  status: EntityStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ---- Estimates ----
export interface Estimate {
  id: string;
  tenantId: string;
  number: string;
  customerId: string;
  customer?: Customer;
  date: string;
  expiryDate: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  currency: Currency;
  exchangeRate?: number;
  baseTotal?: number;
  status: DocumentStatus;
  notes?: string;
  items: EstimateItem[];
  createdAt: string;
  updatedAt: string;
}

export interface EstimateItem {
  id: string;
  estimateId: string;
  productId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discount: number;
  total: number;
}

// ---- Sales Orders ----
export interface SalesOrder {
  id: string;
  tenantId: string;
  number: string;
  customerId: string;
  customer?: Customer;
  estimateId?: string;
  date: string;
  expectedDelivery?: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  currency: Currency;
  exchangeRate?: number;
  baseTotal?: number;
  status: 'draft' | 'pending_review' | 'confirmed' | 'in_progress' | 'shipped' | 'delivered' | 'cancelled';
  notes?: string;
  items: SalesOrderItem[];
  createdAt: string;
  updatedAt: string;
}

export interface SalesOrderItem {
  id: string;
  salesOrderId: string;
  productId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discount: number;
  total: number;
}

// ---- Invoices ----
export interface Invoice {
  id: string;
  tenantId: string;
  number: string;
  customerId: string;
  customer?: Customer;
  salesOrderId?: string;
  date: string;
  dueDate: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  amountPaid: number;
  balance: number;
  currency: Currency;
  exchangeRate?: number;
  baseTotal?: number;
  status: PaymentStatus;
  notes?: string;
  items: InvoiceItem[];
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  productId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discount: number;
  total: number;
}

// ---- Recurring Invoices ----
export interface RecurringInvoice {
  id: string;
  tenantId: string;
  customerId: string;
  customer?: Customer;
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  startDate: string;
  endDate?: string;
  nextInvoiceDate: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  currency: Currency;
  exchangeRate?: number;
  baseTotal?: number;
  status: 'active' | 'paused' | 'expired' | 'cancelled';
  items: RecurringInvoiceItem[];
  createdAt: string;
  updatedAt: string;
}

export type RecurringInvoiceStatus = 'active' | 'paused' | 'expired' | 'cancelled' | 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'CANCELLED';

export interface RecurringInvoiceItem {
  id: string;
  recurringInvoiceId: string;
  productId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  total: number;
}

// ---- Payments Received ----
export interface PaymentReceived {
  id: string;
  tenantId: string;
  number: string;
  customerId: string;
  customer?: Customer;
  invoiceId?: string;
  invoice?: Invoice;
  date: string;
  amount: number;
  currency: Currency;
  exchangeRate?: number;
  baseAmount?: number;
  method: PaymentMethod;
  reference?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ---- Sales Returns ----
export interface SalesReturn {
  id: string;
  tenantId: string;
  number: string;
  customerId: string;
  customer?: Customer;
  invoiceId: string;
  invoice?: Invoice;
  date: string;
  total: number;
  reason: string;
  status: 'pending' | 'approved' | 'processed' | 'rejected';
  items: SalesReturnItem[];
  createdAt: string;
  updatedAt: string;
}

export interface SalesReturnItem {
  id: string;
  salesReturnId: string;
  productId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

// ---- Credit Notes ----
export interface CreditNote {
  id: string;
  tenantId: string;
  number: string;
  customerId: string;
  customer?: Customer;
  invoiceId?: string;
  salesReturnId?: string;
  date: string;
  total: number;
  status: 'draft' | 'issued' | 'applied' | 'voided';
  reason: string;
  items: CreditNoteItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CreditNoteItem {
  id: string;
  creditNoteId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

// ============================================================
// COMPRAS (Purchases)
// ============================================================

// ---- Suppliers ----
export interface Supplier {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  taxId?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  paymentTerms?: string;
  balance: number;
  rating: number;
  status: EntityStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ---- Purchase Orders ----
export interface PurchaseOrder {
  id: string;
  tenantId: string;
  number: string;
  supplierId: string;
  supplier?: Supplier;
  date: string;
  expectedDelivery?: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  currency: Currency;
  exchangeRate?: number;
  baseTotal?: number;
  status: PurchaseOrderStatus;
  requestedBy: string;
  address?: string;
  includeTax?: boolean;
  taxRate?: number;
  withholdingRate?: number;
  withholdingAmount?: number;
  evidenceFileName?: string;
  evidenceFileType?: string;
  evidenceFileSize?: number;
  evidenceFileUrl?: string;
  notes?: string;
  items: PurchaseOrderItem[];
  createdAt: string;
  updatedAt: string;
}

export type PurchaseOrderStatus = 'draft' | 'sent' | 'pending' | 'approved' | 'received' | 'cancelled' | 'DRAFT' | 'SENT' | 'PENDING' | 'APPROVED' | 'RECEIVED' | 'CANCELLED';

export interface PurchaseOrderItem {
  id: string;
  purchaseOrderId: string;
  productId?: string;
  description?: string;
  code?: string;
  name?: string;
  category?: string;
  stockApplies?: boolean;
  stock?: number;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
  total: number;
}

// ---- Purchase Receipts ----
export interface PurchaseReceipt {
  id: string;
  tenantId: string;
  number: string;
  purchaseOrderId: string;
  purchaseOrder?: PurchaseOrder;
  supplierId: string;
  supplier?: Supplier;
  date: string;
  status: 'pending' | 'received' | 'partial' | 'rejected';
  notes?: string;
  items: PurchaseReceiptItem[];
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseReceiptItem {
  id: string;
  purchaseReceiptId: string;
  productId?: string;
  description: string;
  quantityOrdered: number;
  quantityReceived: number;
}

// ---- Supplier Invoices ----
export interface SupplierInvoice {
  id: string;
  tenantId: string;
  number: string;
  supplierId: string;
  supplier?: Supplier;
  purchaseOrderId?: string;
  date: string;
  dueDate: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  balance: number;
  currency: Currency;
  exchangeRate?: number;
  baseTotal?: number;
  status: PaymentStatus;
  notes?: string;
  items: SupplierInvoiceItem[];
  createdAt: string;
  updatedAt: string;
}

export interface SupplierInvoiceItem {
  id: string;
  supplierInvoiceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  total: number;
}

// ---- Recurring Supplier Invoices ----
export interface RecurringSupplierInvoice {
  id: string;
  tenantId: string;
  supplierId: string;
  supplier?: Supplier;
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  startDate: string;
  endDate?: string;
  nextInvoiceDate: string;
  total: number;
  currency: Currency;
  exchangeRate?: number;
  baseTotal?: number;
  status: 'active' | 'paused' | 'expired' | 'cancelled';
  items: RecurringSupplierInvoiceItem[];
  createdAt: string;
  updatedAt: string;
}

export interface RecurringSupplierInvoiceItem {
  id: string;
  recurringSupplierInvoiceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

// ---- Payments Made ----
export interface PaymentMade {
  id: string;
  tenantId: string;
  number: string;
  supplierId: string;
  supplier?: Supplier;
  supplierInvoiceId?: string;
  date: string;
  amount: number;
  currency: Currency;
  exchangeRate?: number;
  baseAmount?: number;
  method: PaymentMethod;
  reference?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ---- Supplier Credits ----
export interface SupplierCredit {
  id: string;
  tenantId: string;
  number: string;
  supplierId: string;
  supplier?: Supplier;
  supplierInvoiceId?: string;
  date: string;
  total: number;
  status: 'draft' | 'issued' | 'applied' | 'voided';
  reason: string;
  items: SupplierCreditItem[];
  createdAt: string;
  updatedAt: string;
}

export interface SupplierCreditItem {
  id: string;
  supplierCreditId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

// ============================================================
// FINANZAS (Finance)
// ============================================================

// ---- Accounts ----
export interface Account {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
  parentId?: string;
  balance: number;
  currency: Currency;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---- Income ----
export interface Income {
  id: string;
  tenantId: string;
  number: string;
  accountId: string;
  account?: Account;
  customerId?: string;
  customer?: Customer;
  date: string;
  amount: number;
  currency: Currency;
  exchangeRate?: number;
  baseAmount?: number;
  category: string;
  description: string;
  reference?: string;
  createdAt: string;
  updatedAt: string;
}

// ---- Expenses ----
export interface Expense {
  id: string;
  tenantId: string;
  number: string;
  accountId?: string;
  account?: Account;
  supplierId?: string;
  supplier?: Supplier;
  date: string;
  time?: string;
  amount: number;
  currency: Currency;
  exchangeRate?: number;
  baseAmount?: number;
  category: string;
  categoryCustom?: string;
  description: string;
  paidTo?: string;
  paymentSource?: 'EFECTIVO' | 'BAC' | 'LAFISE' | 'ATLANTIDA' | 'FICOHSA' | 'BANPRO' | 'BDF' | 'AVANZ';
  evidenceFileName?: string;
  evidenceFileType?: string;
  evidenceFileSize?: number;
  evidenceFileUrl?: string;
  reference?: string;
  status: ExpenseStatus;
  createdAt: string;
  updatedAt: string;
}

export type ExpenseStatus = 'pending' | 'approved' | 'paid' | 'rejected' | 'PENDING' | 'APPROVED' | 'PAID' | 'REJECTED';

// ---- Recurring Expenses ----
export interface RecurringExpense {
  id: string;
  tenantId: string;
  accountId: string;
  account?: Account;
  supplierId?: string;
  supplier?: Supplier;
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  startDate: string;
  endDate?: string;
  nextDate: string;
  amount: number;
  currency: Currency;
  exchangeRate?: number;
  baseAmount?: number;
  category: string;
  description: string;
  status: RecurringExpenseStatus;
  createdAt: string;
  updatedAt: string;
}

export type RecurringExpenseStatus = 'active' | 'paused' | 'expired' | 'cancelled' | 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'CANCELLED';
export type Frequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

// ---- Journal Entries ----
export interface JournalEntry {
  id: string;
  tenantId: string;
  number: string;
  date: string;
  description: string;
  status: 'draft' | 'posted' | 'voided';
  lines: JournalEntryLine[];
  createdAt: string;
  updatedAt: string;
}

export interface JournalEntryLine {
  id: string;
  journalEntryId: string;
  accountId: string;
  account?: Account;
  debit: number;
  credit: number;
  description?: string;
}

// ---- Transactions ----
export interface Transaction {
  id: string;
  tenantId: string;
  accountId: string;
  account?: Account;
  date: string;
  type: 'debit' | 'credit';
  amount: number;
  balance: number;
  description: string;
  referenceType?: string;
  referenceId?: string;
  createdAt: string;
}

// ============================================================
// INVENTARIO (Inventory)
// ============================================================

export interface Product {
  id: string;
  tenantId: string;
  code: string;
  sku: string;
  name: string;
  description?: string;
  categoryId?: string;
  brand?: string;
  unit?: string;
  price: number;
  cost: number;
  salePrice: number;
  costPrice: number;
  taxRate: number;
  stock: number;
  minStock: number;
  status: EntityStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Warehouse {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  location?: string;
  isMain: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// ROLES & SETTINGS
// ============================================================

export interface RoleManagement {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  permissions: Permission[];
  color?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Permission {
  module: string;
  read: boolean;
  write: boolean;
  delete: boolean;
}

// ============================================================
// RECURSOS HUMANOS (HR)
// ============================================================

// ---- Employees ----
export interface Employee {
  id: string;
  tenantId: string;
  code: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  position: string;
  department: string;
  hireDate: string;
  terminationDate?: string;
  salary: number;
  salaryType: 'monthly' | 'biweekly' | 'hourly';
  currency: Currency;
  bankAccount?: string;
  taxId?: string;
  address?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  status: 'active' | 'on_leave' | 'terminated';
  createdAt: string;
  updatedAt: string;
}

// ---- Payroll ----
export interface Payroll {
  id: string;
  tenantId: string;
  number: string;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  employeeCount: number;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  currency: Currency;
  status: 'draft' | 'processing' | 'approved' | 'paid';
  items: PayrollItem[];
  createdAt: string;
  updatedAt: string;
}

// ---- Payroll Items ----
export interface PayrollItem {
  id: string;
  payrollId: string;
  employeeId: string;
  employee?: Employee;
  baseSalary: number;
  overtime: number;
  bonuses: number;
  grossPay: number;
  taxDeduction: number;
  socialSecurity: number;
  otherDeductions: number;
  totalDeductions: number;
  netPay: number;
}

// ---- Time Off (Vacations) ----
export interface TimeOff {
  id: string;
  tenantId: string;
  employeeId: string;
  employee?: Employee;
  type: 'vacation' | 'sick_leave' | 'personal' | 'other';
  startDate: string;
  endDate: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approvedById?: string;
  reason?: string;
  createdAt: string;
}

// ---- Activities & Tasks ----
export type ActivityType = 'call' | 'meeting' | 'email' | 'task' | 'deadline' | 'CALL' | 'MEETING' | 'EMAIL' | 'TASK' | 'DEADLINE';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface Activity {
  id: string;
  tenantId: string;
  title: string;
  description?: string;
  type: ActivityType;
  assignedToId: string;
  assignedTo?: User;
  dueDate?: string;
  status: TaskStatus;
}

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'open' | 'in_progress' | 'resolved' | 'closed';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | 'low' | 'medium' | 'high' | 'urgent';

export interface Ticket {
  id: string;
  number: string;
  subject: string;
  description: string;
  customerId?: string;
  assignedToId?: string;
  status: TicketStatus;
  priority: Priority;
  slaDueAt?: string;
  slaBreachedAt?: string;
  slaReminderSentAt?: string;
  resolvedAt?: string;
  closedAt?: string;
  createdAt: string;
  updatedAt?: string;
  _count?: {
    comments?: number;
  };
}

export interface TicketComment {
  id: string;
  ticketId: string;
  authorId: string;
  message: string;
  createdAt: string;
  updatedAt?: string;
  author?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface TicketAudit {
  id: string;
  ticketId: string;
  actorId?: string | null;
  action: string;
  message?: string | null;
  metadata?: Record<string, any> | null;
  createdAt: string;
  actor?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface Document {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  folderId?: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
  read: boolean;
}

export interface Transfer {
  id: string;
  number: string;
  fromId?: string;
  toId?: string;
  date: string;
  status: 'PENDING' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED';
  items?: {
    id: string;
    variantId: string;
    quantity: number;
    variant?: any;
  }[];
}

export interface Document {
  id: string;
  projectId?: string;
  name: string;
  url: string;
  size: number;
  mimeType: string;
  folder?: string;
  uploadedById: string;
}

export interface Task { id: string; title: string; description?: string; status: TaskStatus; priority: Priority; dueDate?: string; assignedTo?: string; createdAt: string; updatedAt: string; }
export interface Event { id: string; title: string; description?: string; startDate: string; endDate: string; location?: string; attendees?: string[]; cost?: number; income?: number; expenseId?: string; incomeId?: string; createdAt: string; }
export interface Reminder { id: string; title: string; description?: string; reminderDate: string; status: string; createdAt: string; }
export interface ActivityLog { id: string; action: string; entity: string; entityId: string; userId: string; timestamp: string; details?: string; activityId?: string; fileUrl?: string; fileName?: string; }

export interface Contract { id: string; number: string; title: string; clientId: string; startDate: string; endDate: string; value: number; status: string; createdAt: string; }
export interface LegalInvoice { id: string; number: string; type: string; amount: number; issueDate: string; dueDate: string; status: string; createdAt: string; }
export interface Report { id: string; title: string; type: string; generatedDate: string; format: string; size: number; createdBy: string; }
export interface File { id: string; name: string; type: string; size: number; uploadDate: string; uploadedBy: string; category: string; url: string; }

export interface Alert { id: string; title: string; content: string; type: string; severity?: string; isRead: boolean; createdAt: string; }
export interface Message { id: string; title: string; content: string; type: string; from?: string; to?: string; isRead: boolean; createdAt: string; }
export interface PushNotification { id: string; title: string; content: string; type: string; sent?: boolean; isRead: boolean; createdAt: string; deviceId?: string; }

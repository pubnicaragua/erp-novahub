// ============================================================
// Nova Hub ERP - TypeScript Types
// Mirrors Prisma schema for frontend type safety
// ============================================================

// ---- Shared / Base ----
export type EntityStatus = 'active' | 'inactive' | 'archived' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
export type DocumentStatus = 'draft' | 'sent' | 'approved' | 'rejected' | 'cancelled' | 'DRAFT' | 'SENT' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type PaymentStatus = 'pending' | 'partial' | 'paid' | 'overdue' | 'refunded' | 'cancelled' | 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'REFUNDED' | 'CANCELLED';
export type PaymentMethod = 'cash' | 'transfer' | 'check' | 'card' | 'other' | 'CASH' | 'TRANSFER' | 'CHECK' | 'CARD' | 'OTHER';
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
  categoryId?: string;
  type?: string;
  warehouseId?: string;
  productId?: string;
  supplierId?: string;
  supplierInvoiceId?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  /** Bounded bulk mode used by reports; regular lists remain capped at 200. */
  report?: boolean;
}

export type SalesPageSize = 50 | 100 | 200;

export interface SalesPaginationControls {
  page: number;
  pageSize: SalesPageSize;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: SalesPageSize) => void;
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
  fiscalRegime?: string;
  customerClass?: string;
  taxId?: string;
  ruc?: string;
  dv?: string;
  razonSocial?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  department?: string;
  country?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  creditLimit: number;
  balance: number;
  status: EntityStatus;
  notes?: string;
  priceListId?: string;
  priceList?: { id: string; code: string; name: string } | null;
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
  priceListId?: string;
  irRate?: number;
  irTaxId?: string | null;
  irAmount?: number;
  warehouseId?: string;
  date: string;
  expiryDate: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  currency: Currency;
  exchangeRate?: number;
  baseTotal?: number;
  accountId?: string;
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
  irRate?: number;
  irTaxId?: string | null;
  irAmount?: number;
  priceListId?: string | null;
  total: number;
}

// ---- Sales Orders ----
export interface SalesOrder {
  id: string;
  tenantId: string;
  number: string;
  customerId: string;
  customer?: Customer;
  priceListId?: string;
  irRate?: number;
  irTaxId?: string | null;
  irAmount?: number;
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
  accountId?: string;
  warehouseId?: string;
  status: 'draft' | 'pending_review' | 'confirmed' | 'in_progress' | 'shipped' | 'delivered' | 'cancelled';
  notes?: string;
  items: SalesOrderItem[];
  createdAt: string;
  updatedAt: string;
  invoiceId?: string;
  invoiceNumber?: string;
  invoicedAt?: string;
  invoicedBy?: { id?: string; name?: string };
  sellerEmployeeId?: string;
  sellerEmployee?: { id?: string; firstName?: string; lastName?: string };
  commissionType?: 'PERCENTAGE' | 'FIXED';
  commissionRate?: number;
  commissionAmount?: number;
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
  irRate?: number;
  irTaxId?: string | null;
  irAmount?: number;
  priceListId?: string | null;
  total: number;
}

// ---- Invoices ----
export interface Invoice {
  id: string;
  tenantId: string;
  number: string;
  customerId: string;
  customer?: Customer;
  priceListId?: string;
  irRate?: number;
  irTaxId?: string | null;
  irAmount?: number;
  salesOrderId?: string;
  warehouseId?: string;
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
  accountId?: string;
  registerId?: string | null;
  sessionId?: string | null;
  status: PaymentStatus;
  notes?: string;
  sellerEmployeeId?: string | null;
  commissionRate?: number | null;
  commissionType?: 'PERCENTAGE' | 'FIXED' | null;
  commissionAmount?: number | null;
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
  irRate?: number;
  irTaxId?: string | null;
  irAmount?: number;
  priceListId?: string | null;
  total: number;
}

// ---- Recurring Invoices ----
export interface RecurringInvoice {
  id: string;
  tenantId: string;
  customerId: string;
  customer?: Customer;
  priceListId?: string;
  irRate?: number;
  irTaxId?: string | null;
  irAmount?: number;
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  startDate: string;
  endDate?: string;
  nextInvoiceDate: string;
  subtotal: number;
  taxAmount: number;
  discountAmount?: number;
  total: number;
  currency: Currency;
  exchangeRate?: number;
  baseTotal?: number;
  accountId?: string;
  status: 'active' | 'paused' | 'expired' | 'cancelled';
  sourceRecurringExpenseId?: string;
  sourceRecurringExpenseRef?: string;
  items: RecurringInvoiceItem[];
  createdAt: string;
  updatedAt: string;
}

export type RecurringInvoiceStatus = 'active' | 'paused' | 'expired' | 'cancelled' | 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'CANCELLED';

export interface RecurringInvoiceItem {
  id: string;
  recurringInvoiceId: string;
  itemType?: 'product' | 'service' | 'PRODUCT' | 'SERVICE';
  productId?: string;
  description: string;
  serviceName?: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  discount?: number;
  irRate?: number;
  irTaxId?: string | null;
  irAmount?: number;
  priceListId?: string | null;
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
  accountId?: string;
  method: PaymentMethod;
  reference?: string;
  notes?: string;
  isActive?: boolean;
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
  priceListId?: string;
  irRate?: number;
  irTaxId?: string | null;
  irAmount?: number;
  invoiceId: string;
  invoice?: Invoice;
  date: string;
  subtotal?: number;
  taxAmount?: number;
  discountAmount?: number;
  total: number;
  reason: string;
  accountId?: string;
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
  taxRate?: number;
  discount?: number;
  irRate?: number;
  irTaxId?: string | null;
  irAmount?: number;
  priceListId?: string | null;
  total: number;
}

// ---- Credit Notes ----
export interface CreditNote {
  id: string;
  tenantId: string;
  number: string;
  customerId: string;
  customer?: Customer;
  priceListId?: string;
  irRate?: number;
  irTaxId?: string | null;
  irAmount?: number;
  invoiceId?: string;
  salesReturnId?: string;
  date: string;
  subtotal?: number;
  taxAmount?: number;
  discountAmount?: number;
  total: number;
  status: 'draft' | 'issued' | 'applied' | 'voided';
  reason: string;
  accountId?: string;
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
  taxRate?: number;
  discount?: number;
  irRate?: number;
  irTaxId?: string | null;
  irAmount?: number;
  priceListId?: string | null;
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
  withholdingTotal?: number;
  withholdingBase?: number;
  total: number;
  currency: Currency;
  exchangeRate?: number;
  baseTotal?: number;
  status: PurchaseOrderStatus;
  requestedBy: string;
  address?: string;
  purchaseType?: string;
  includeTax?: boolean;
  taxRate?: number;
  withholdingRate?: number;
  withholdingAmount?: number;
  isService?: boolean;
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
  categoryId?: string;
  stockApplies?: boolean;
  stock?: number;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
  taxType?: string;
  taxBase?: number;
  taxAmount?: number;
  withholdingType?: string;
  withholdingRate?: number;
  withholdingBase?: number;
  accountId?: string;
  costCenterId?: string;
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
  status: 'pending' | 'received' | 'partial' | 'rejected' | 'with_incidents';
  notes?: string;
  items: PurchaseReceiptItem[];
  supplierInvoices?: SupplierInvoice[];
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseReceiptItem {
  id: string;
  purchaseReceiptId: string;
  productId?: string;
  warehouseId?: string;
  description: string;
  quantityOrdered: number;
  quantityReceived: number;
  quantityRejected?: number;
  unitPrice?: number;
  taxType?: string;
  taxBase?: number;
  taxAmount?: number;
  withholdingType?: string;
  withholdingRate?: number;
  withholdingBase?: number;
  accountId?: string;
  costCenterId?: string;
}

// ---- Supplier Invoices ----
export interface SupplierInvoice {
  id: string;
  tenantId: string;
  number: string;
  supplierId: string;
  supplier?: Supplier;
  purchaseOrderId?: string;
  purchaseReceiptId?: string;
  date: string;
  dueDate: string;
  subtotal: number;
  taxAmount: number;
  withholdingTotal?: number;
  withholdingBase?: number;
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
  taxType?: string;
  taxBase?: number;
  taxAmount?: number;
  withholdingType?: string;
  withholdingRate?: number;
  withholdingBase?: number;
  accountId?: string;
  costCenterId?: string;
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
  isActive?: boolean;
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
  currency?: string;
  exchangeRate?: number;
  baseTotal?: number;
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
  source?: string;
  notes?: string;
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
  expenseCategoryId?: string;
  expenseCategory?: {
    id: string;
    name: string;
    code?: string;
    color?: string;
  };
  description: string;
  paidTo?: string;
  paymentSource?: 'EFECTIVO' | 'BAC' | 'LAFISE' | 'ATLANTIDA' | 'FICOHSA' | 'BANPRO' | 'BDF' | 'AVANZ';
  evidenceFileName?: string;
  evidenceFileType?: string;
  evidenceFileSize?: number;
  evidenceFileUrl?: string;
  reference?: string;
  source?: string;
  notes?: string;
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
  source?: string;
  notes?: string;
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
  referenceType?: string;
  referenceId?: string;
  costCenterId?: string;
  costCenter?: any;
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
  imageUrl?: string | null;
  imageUrlStorageUri?: string;
  categoryId?: string;
  brand?: string;
  unit?: string;
  price: number;
  cost: number;
  salePrice: number;
  priceCurrency?: string;
  priceExchangeRate?: number;
  salePriceOriginal?: number;
  costPrice: number;
  lastPurchasePrice?: number;
  taxRate: number;
  stock: number;
  minStock: number;
  maxStock?: number | null;
  trackSerialNumbers?: boolean;
  itemType?: 'PRODUCT' | 'SERVICE';
  status: EntityStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CostHistory {
  id: string;
  clientTenantId: string;
  productId: string;
  warehouseId?: string | null;
  date: string;
  documentType: 'PURCHASE_ORDER' | 'PURCHASE_RECEIPT' | 'SUPPLIER_INVOICE' | 'ADJUSTMENT' | string;
  documentId: string;
  documentNumber?: string | null;
  previousCost: number;
  previousQty: number;
  orderPrice: number;
  receivedCost: number;
  invoicedCost: number;
  quantityChange: number;
  newQuantity: number;
  newAverageCost: number;
  product?: Product;
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
  userId?: string;
  tenantId: string;
  code: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  position: string;
  department: string;
  departmentId?: string;
  positionId?: string;
  managerId?: string;
  hireDate: string;
  terminationDate?: string;
  probationEndDate?: string;
  salary: number;
  salaryType: 'monthly' | 'biweekly' | 'hourly';
  currency: Currency;
  bankAccount?: string;
  taxId?: string;
  nationalId?: string;
  socialSecurityNumber?: string;
  address?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  status: 'active' | 'on_leave' | 'terminated';
  employmentStatus?: string;
  approvalStatus?: string;
  rejectionReason?: string;
  contractType?: string;
  payFrequency?: string;
  notes?: string;
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
  link?: string | null;
  metadata?: unknown;
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
export interface Event { id: string; title: string; description?: string; startDate: string; endDate: string; location?: string; attendees?: string[]; cost?: number; income?: number; currency?: string; exchangeRate?: number; baseCost?: number | null; baseIncome?: number | null; expenseId?: string; incomeId?: string; createdAt: string; }
export interface Reminder { id: string; title: string; description?: string; reminderDate: string; status: string; createdAt: string; }
export interface ActivityLog { id: string; action: string; entity: string; entityId: string; userId: string; timestamp: string; details?: string; activityId?: string; fileUrl?: string; fileName?: string; }

export interface Contract { id: string; number: string; title: string; clientId: string; startDate: string; endDate: string; value: number; currency?: Currency; exchangeRate?: number; status: string; createdAt: string; }
export interface LegalInvoice { id: string; number: string; type: string; amount: number; currency?: Currency; exchangeRate?: number; issueDate: string; dueDate: string; status: string; createdAt: string; }
export interface Report { id: string; title: string; type: string; generatedDate: string; format: string; size: number; createdBy: string; }
export interface File { id: string; name: string; type: string; size: number; uploadDate: string; uploadedBy: string; category: string; url: string; }

export interface Alert { id: string; title: string; content: string; type: string; severity?: string; isRead: boolean; createdAt: string; link?: string | null; metadata?: unknown; }
export interface MessageParticipant {
  id: string;
  name: string;
  email?: string;
  avatar?: string | null;
  role?: string;
}

export interface ChatMessage {
  id: string;
  content: string;
  createdAt: string;
  isRead: boolean;
  mine: boolean;
  sender: MessageParticipant;
  recipient: MessageParticipant;
  link?: string | null;
}

export interface Message {
  id: string;
  title: string;
  kind: 'DIRECT' | 'SYSTEM';
  participant: MessageParticipant;
  preview: string;
  lastMessageAt: string;
  unreadCount: number;
  canReply: boolean;
  messages: ChatMessage[];
}
export interface PushNotification { id: string; title: string; content: string; type: string; sent?: boolean; isRead: boolean; createdAt: string; deviceId?: string; link?: string | null; metadata?: unknown; }

// ============================================================
// SOLICITUDES DE COMPRA
// ============================================================
export type PurchasePriority = 'NORMAL' | 'URGENT' | 'CRITICAL';
export type PurchaseRequestStatus = 'DRAFT' | 'SUBMITTED' | 'RECEIVED' | 'IN_REVIEW' | 'IN_QUOTATION' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'RETURNED_FOR_CORRECTION' | 'CONVERTED_TO_ORDER' | 'CLOSED' | 'CANCELLED';

export interface PurchaseRequestItem {
  id: string;
  purchaseRequestId: string;
  productId?: string;
  description: string;
  quantity: number;
  currentStock: number;
  minStock: number;
  warehouseId: string;
  observations?: string;
  product?: Product;
}

export interface PurchaseRequest {
  id: string;
  number: string;
  clientTenantId: string;
  warehouseId: string;
  warehouse?: Warehouse;
  branchId?: string;
  branch?: any;
  requestedById: string;
  requestedBy?: { id: string; firstName: string; lastName: string; employeeNumber?: string };
  userId?: string;
  date: string;
  requiredDate?: string;
  priority: PurchasePriority;
  status: PurchaseRequestStatus;
  justification?: string;
  notes?: string;
  items: PurchaseRequestItem[];
  management?: PurchaseManagement[];
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// GESTIÓN DE COMPRA
// ============================================================
export type PurchaseManagementStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'RETURNED_FOR_CORRECTION' | 'CONVERTED_TO_ORDER' | 'CANCELLED';

export interface PurchaseManagementItem {
  id: string;
  purchaseManagementId: string;
  productId?: string;
  description: string;
  quantityRequested: number;
  quantityProposed: number;
  unitPrice: number;
  discount: number;
  taxType: string;
  taxRate: number;
  taxBase: number;
  taxAmount: number;
  subtotal: number;
  total: number;
  accountId?: string;
  product?: Product;
}

export interface PurchaseManagement {
  id: string;
  number: string;
  purchaseRequestId?: string;
  purchaseRequest?: PurchaseRequest;
  clientTenantId: string;
  date: string;
  status: PurchaseManagementStatus;
  currency: string;
  exchangeRate: number;
  baseTotal?: number;
  supplierId?: string;
  supplier?: Supplier;
  quotationNumber?: string;
  quotationDate?: string;
  quotationValidity?: string;
  supplierContact?: string;
  paymentTerms?: string;
  creditDays?: number;
  advancePayment: number;
  expectedDelivery?: string;
  shippingCost: number;
  total: number;
  internalNotes?: string;
  notes?: string;
  approvedById?: string;
  approvedBy?: { id: string; name: string };
  approvedAt?: string;
  rejectionReason?: string;
  items: PurchaseManagementItem[];
  createdAt: string;
  updatedAt: string;
}

// ---- HR Extensions ----
export interface EmployeeChangeLog {
  id: string;
  employeeId: string;
  field: string;
  oldValue?: string;
  newValue?: string;
  changedById: string;
  effectiveDate: string;
  createdAt: string;
}

export interface VacationBalance {
  id: string;
  employeeId: string;
  year: number;
  totalDays: number;
  usedDays: number;
  pendingDays: number;
  remainingDays: number;
  employee?: { id: string; firstName: string; lastName: string; employeeNumber: string };
}

export interface AbsenceType {
  id: string;
  code: string;
  name: string;
  paidByCompanyPct: number;
  paidByThirdPartyPct: number;
  maxDays?: number;
  cap?: number;
  salaryBase: string;
  requiresDoc: boolean;
  isActive: boolean;
}

export interface KpiDefinition {
  id: string;
  name: string;
  description?: string;
  target?: number;
  weight: number;
  periodType: string;
  assignToType: string;
  assignToId?: string;
  isActive: boolean;
}

export interface KpiResult {
  id: string;
  employeeId: string;
  employee?: { id: string; firstName: string; lastName: string };
  kpiDefinitionId: string;
  kpiDefinition?: KpiDefinition;
  periodStart: string;
  periodEnd: string;
  target?: number;
  actual: number;
  weight: number;
  evaluatorId?: string;
  comment?: string;
  createdAt: string;
}

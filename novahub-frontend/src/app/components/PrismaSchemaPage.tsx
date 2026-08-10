import { useState } from 'react';
import { Database, Copy, Check, ChevronDown, ChevronRight, Table2, Key, Link2, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ScrollArea } from './ui/scroll-area';
import { cn } from './ui/utils';
import { toast } from 'sonner';

// ============================================================
// PRISMA SCHEMA DEFINITION
// ============================================================

interface PrismaField {
  name: string;
  type: string;
  isPK?: boolean;
  isFK?: boolean;
  isOptional?: boolean;
  isUnique?: boolean;
  default?: string;
  relation?: string;
  attributes?: string[];
}

interface PrismaModel {
  name: string;
  module: string;
  description: string;
  fields: PrismaField[];
}

const prismaModels: PrismaModel[] = [
  // ===== CORE =====
  {
    name: 'Tenant',
    module: 'Core',
    description: 'Multi-tenant organization',
    fields: [
      { name: 'id', type: 'String', isPK: true, default: '@default(uuid())' },
      { name: 'name', type: 'String' },
      { name: 'slug', type: 'String', isUnique: true },
      { name: 'logo', type: 'String', isOptional: true },
      { name: 'primaryColor', type: 'String', isOptional: true },
      { name: 'isActive', type: 'Boolean', default: '@default(true)' },
      { name: 'createdAt', type: 'DateTime', default: '@default(now())' },
      { name: 'updatedAt', type: 'DateTime', attributes: ['@updatedAt'] },
      { name: 'users', type: 'User[]', relation: 'One-to-Many' },
      { name: 'customers', type: 'Customer[]', relation: 'One-to-Many' },
      { name: 'suppliers', type: 'Supplier[]', relation: 'One-to-Many' },
    ],
  },
  {
    name: 'User',
    module: 'Core',
    description: 'System users with RBAC',
    fields: [
      { name: 'id', type: 'String', isPK: true, default: '@default(uuid())' },
      { name: 'tenantId', type: 'String', isFK: true },
      { name: 'email', type: 'String', isUnique: true },
      { name: 'passwordHash', type: 'String' },
      { name: 'name', type: 'String' },
      { name: 'avatar', type: 'String', isOptional: true },
      { name: 'role', type: 'SystemRole', default: "@default(EMPLOYEE)" },
      { name: 'isActive', type: 'Boolean', default: '@default(true)' },
      { name: 'lastLoginAt', type: 'DateTime', isOptional: true },
      { name: 'createdAt', type: 'DateTime', default: '@default(now())' },
      { name: 'updatedAt', type: 'DateTime', attributes: ['@updatedAt'] },
      { name: 'tenant', type: 'Tenant', relation: 'Many-to-One', isFK: true },
    ],
  },
  // ===== VENTAS =====
  {
    name: 'Customer',
    module: 'Ventas',
    description: 'Customer directory',
    fields: [
      { name: 'id', type: 'String', isPK: true, default: '@default(uuid())' },
      { name: 'tenantId', type: 'String', isFK: true },
      { name: 'code', type: 'String' },
      { name: 'name', type: 'String' },
      { name: 'type', type: 'CustomerType', default: "@default(COMPANY)" },
      { name: 'taxId', type: 'String', isOptional: true },
      { name: 'email', type: 'String', isOptional: true },
      { name: 'phone', type: 'String', isOptional: true },
      { name: 'address', type: 'String', isOptional: true },
      { name: 'city', type: 'String', isOptional: true },
      { name: 'country', type: 'String', isOptional: true },
      { name: 'contactName', type: 'String', isOptional: true },
      { name: 'contactEmail', type: 'String', isOptional: true },
      { name: 'contactPhone', type: 'String', isOptional: true },
      { name: 'creditLimit', type: 'Decimal', default: '@default(0)' },
      { name: 'balance', type: 'Decimal', default: '@default(0)' },
      { name: 'status', type: 'EntityStatus', default: "@default(ACTIVE)" },
      { name: 'notes', type: 'String', isOptional: true },
      { name: 'createdAt', type: 'DateTime', default: '@default(now())' },
      { name: 'updatedAt', type: 'DateTime', attributes: ['@updatedAt'] },
      { name: 'tenant', type: 'Tenant', relation: 'Many-to-One', isFK: true },
      { name: 'estimates', type: 'Estimate[]', relation: 'One-to-Many' },
      { name: 'salesOrders', type: 'SalesOrder[]', relation: 'One-to-Many' },
      { name: 'invoices', type: 'Invoice[]', relation: 'One-to-Many' },
      { name: 'paymentsReceived', type: 'PaymentReceived[]', relation: 'One-to-Many' },
    ],
  },
  {
    name: 'Estimate',
    module: 'Ventas',
    description: 'Sales estimates/quotations',
    fields: [
      { name: 'id', type: 'String', isPK: true, default: '@default(uuid())' },
      { name: 'tenantId', type: 'String', isFK: true },
      { name: 'number', type: 'String', isUnique: true },
      { name: 'customerId', type: 'String', isFK: true },
      { name: 'date', type: 'DateTime' },
      { name: 'expiryDate', type: 'DateTime' },
      { name: 'subtotal', type: 'Decimal' },
      { name: 'taxAmount', type: 'Decimal' },
      { name: 'discountAmount', type: 'Decimal', default: '@default(0)' },
      { name: 'total', type: 'Decimal' },
      { name: 'currency', type: 'String', default: '@default("USD")' },
      { name: 'status', type: 'DocumentStatus', default: "@default(DRAFT)" },
      { name: 'notes', type: 'String', isOptional: true },
      { name: 'createdAt', type: 'DateTime', default: '@default(now())' },
      { name: 'updatedAt', type: 'DateTime', attributes: ['@updatedAt'] },
      { name: 'customer', type: 'Customer', relation: 'Many-to-One', isFK: true },
      { name: 'items', type: 'EstimateItem[]', relation: 'One-to-Many' },
    ],
  },
  {
    name: 'EstimateItem',
    module: 'Ventas',
    description: 'Line items for estimates',
    fields: [
      { name: 'id', type: 'String', isPK: true, default: '@default(uuid())' },
      { name: 'estimateId', type: 'String', isFK: true },
      { name: 'productId', type: 'String', isOptional: true, isFK: true },
      { name: 'description', type: 'String' },
      { name: 'quantity', type: 'Decimal' },
      { name: 'unitPrice', type: 'Decimal' },
      { name: 'taxRate', type: 'Decimal', default: '@default(0)' },
      { name: 'discount', type: 'Decimal', default: '@default(0)' },
      { name: 'total', type: 'Decimal' },
      { name: 'estimate', type: 'Estimate', relation: 'Many-to-One', isFK: true },
    ],
  },
  {
    name: 'SalesOrder',
    module: 'Ventas',
    description: 'Confirmed sales orders',
    fields: [
      { name: 'id', type: 'String', isPK: true, default: '@default(uuid())' },
      { name: 'tenantId', type: 'String', isFK: true },
      { name: 'number', type: 'String', isUnique: true },
      { name: 'customerId', type: 'String', isFK: true },
      { name: 'estimateId', type: 'String', isOptional: true, isFK: true },
      { name: 'date', type: 'DateTime' },
      { name: 'expectedDelivery', type: 'DateTime', isOptional: true },
      { name: 'subtotal', type: 'Decimal' },
      { name: 'taxAmount', type: 'Decimal' },
      { name: 'discountAmount', type: 'Decimal', default: '@default(0)' },
      { name: 'total', type: 'Decimal' },
      { name: 'currency', type: 'String', default: '@default("USD")' },
      { name: 'status', type: 'SalesOrderStatus', default: "@default(DRAFT)" },
      { name: 'notes', type: 'String', isOptional: true },
      { name: 'createdAt', type: 'DateTime', default: '@default(now())' },
      { name: 'updatedAt', type: 'DateTime', attributes: ['@updatedAt'] },
      { name: 'customer', type: 'Customer', relation: 'Many-to-One', isFK: true },
      { name: 'items', type: 'SalesOrderItem[]', relation: 'One-to-Many' },
      { name: 'invoices', type: 'Invoice[]', relation: 'One-to-Many' },
    ],
  },
  {
    name: 'SalesOrderItem',
    module: 'Ventas',
    description: 'Line items for sales orders',
    fields: [
      { name: 'id', type: 'String', isPK: true, default: '@default(uuid())' },
      { name: 'salesOrderId', type: 'String', isFK: true },
      { name: 'productId', type: 'String', isOptional: true, isFK: true },
      { name: 'description', type: 'String' },
      { name: 'quantity', type: 'Decimal' },
      { name: 'unitPrice', type: 'Decimal' },
      { name: 'taxRate', type: 'Decimal', default: '@default(0)' },
      { name: 'discount', type: 'Decimal', default: '@default(0)' },
      { name: 'total', type: 'Decimal' },
      { name: 'salesOrder', type: 'SalesOrder', relation: 'Many-to-One', isFK: true },
    ],
  },
  {
    name: 'Invoice',
    module: 'Ventas',
    description: 'Customer invoices',
    fields: [
      { name: 'id', type: 'String', isPK: true, default: '@default(uuid())' },
      { name: 'tenantId', type: 'String', isFK: true },
      { name: 'number', type: 'String', isUnique: true },
      { name: 'customerId', type: 'String', isFK: true },
      { name: 'salesOrderId', type: 'String', isOptional: true, isFK: true },
      { name: 'date', type: 'DateTime' },
      { name: 'dueDate', type: 'DateTime' },
      { name: 'subtotal', type: 'Decimal' },
      { name: 'taxAmount', type: 'Decimal' },
      { name: 'discountAmount', type: 'Decimal', default: '@default(0)' },
      { name: 'total', type: 'Decimal' },
      { name: 'amountPaid', type: 'Decimal', default: '@default(0)' },
      { name: 'balance', type: 'Decimal' },
      { name: 'currency', type: 'String', default: '@default("USD")' },
      { name: 'status', type: 'PaymentStatus', default: "@default(PENDING)" },
      { name: 'notes', type: 'String', isOptional: true },
      { name: 'createdAt', type: 'DateTime', default: '@default(now())' },
      { name: 'updatedAt', type: 'DateTime', attributes: ['@updatedAt'] },
      { name: 'customer', type: 'Customer', relation: 'Many-to-One', isFK: true },
      { name: 'salesOrder', type: 'SalesOrder', relation: 'Many-to-One', isFK: true },
      { name: 'items', type: 'InvoiceItem[]', relation: 'One-to-Many' },
      { name: 'payments', type: 'PaymentReceived[]', relation: 'One-to-Many' },
    ],
  },
  {
    name: 'InvoiceItem',
    module: 'Ventas',
    description: 'Line items for invoices',
    fields: [
      { name: 'id', type: 'String', isPK: true, default: '@default(uuid())' },
      { name: 'invoiceId', type: 'String', isFK: true },
      { name: 'productId', type: 'String', isOptional: true, isFK: true },
      { name: 'description', type: 'String' },
      { name: 'quantity', type: 'Decimal' },
      { name: 'unitPrice', type: 'Decimal' },
      { name: 'taxRate', type: 'Decimal', default: '@default(0)' },
      { name: 'discount', type: 'Decimal', default: '@default(0)' },
      { name: 'total', type: 'Decimal' },
      { name: 'invoice', type: 'Invoice', relation: 'Many-to-One', isFK: true },
    ],
  },
  {
    name: 'RecurringInvoice',
    module: 'Ventas',
    description: 'Recurring invoice templates',
    fields: [
      { name: 'id', type: 'String', isPK: true, default: '@default(uuid())' },
      { name: 'tenantId', type: 'String', isFK: true },
      { name: 'customerId', type: 'String', isFK: true },
      { name: 'frequency', type: 'Frequency' },
      { name: 'startDate', type: 'DateTime' },
      { name: 'endDate', type: 'DateTime', isOptional: true },
      { name: 'nextInvoiceDate', type: 'DateTime' },
      { name: 'subtotal', type: 'Decimal' },
      { name: 'taxAmount', type: 'Decimal' },
      { name: 'total', type: 'Decimal' },
      { name: 'currency', type: 'String', default: '@default("USD")' },
      { name: 'status', type: 'RecurringStatus', default: "@default(ACTIVE)" },
      { name: 'createdAt', type: 'DateTime', default: '@default(now())' },
      { name: 'updatedAt', type: 'DateTime', attributes: ['@updatedAt'] },
      { name: 'customer', type: 'Customer', relation: 'Many-to-One', isFK: true },
      { name: 'items', type: 'RecurringInvoiceItem[]', relation: 'One-to-Many' },
    ],
  },
  {
    name: 'RecurringInvoiceItem',
    module: 'Ventas',
    description: 'Line items for recurring invoices',
    fields: [
      { name: 'id', type: 'String', isPK: true, default: '@default(uuid())' },
      { name: 'recurringInvoiceId', type: 'String', isFK: true },
      { name: 'productId', type: 'String', isOptional: true, isFK: true },
      { name: 'description', type: 'String' },
      { name: 'quantity', type: 'Decimal' },
      { name: 'unitPrice', type: 'Decimal' },
      { name: 'taxRate', type: 'Decimal', default: '@default(0)' },
      { name: 'total', type: 'Decimal' },
      { name: 'recurringInvoice', type: 'RecurringInvoice', relation: 'Many-to-One', isFK: true },
    ],
  },
  {
    name: 'PaymentReceived',
    module: 'Ventas',
    description: 'Payments received from customers',
    fields: [
      { name: 'id', type: 'String', isPK: true, default: '@default(uuid())' },
      { name: 'tenantId', type: 'String', isFK: true },
      { name: 'number', type: 'String', isUnique: true },
      { name: 'customerId', type: 'String', isFK: true },
      { name: 'invoiceId', type: 'String', isOptional: true, isFK: true },
      { name: 'date', type: 'DateTime' },
      { name: 'amount', type: 'Decimal' },
      { name: 'currency', type: 'String', default: '@default("USD")' },
      { name: 'method', type: 'PaymentMethod' },
      { name: 'reference', type: 'String', isOptional: true },
      { name: 'notes', type: 'String', isOptional: true },
      { name: 'createdAt', type: 'DateTime', default: '@default(now())' },
      { name: 'customer', type: 'Customer', relation: 'Many-to-One', isFK: true },
      { name: 'invoice', type: 'Invoice', relation: 'Many-to-One', isFK: true },
    ],
  },
  {
    name: 'SalesReturn',
    module: 'Ventas',
    description: 'Customer sales returns',
    fields: [
      { name: 'id', type: 'String', isPK: true, default: '@default(uuid())' },
      { name: 'tenantId', type: 'String', isFK: true },
      { name: 'number', type: 'String', isUnique: true },
      { name: 'customerId', type: 'String', isFK: true },
      { name: 'invoiceId', type: 'String', isFK: true },
      { name: 'date', type: 'DateTime' },
      { name: 'total', type: 'Decimal' },
      { name: 'reason', type: 'String' },
      { name: 'status', type: 'ReturnStatus', default: "@default(PENDING)" },
      { name: 'createdAt', type: 'DateTime', default: '@default(now())' },
      { name: 'items', type: 'SalesReturnItem[]', relation: 'One-to-Many' },
    ],
  },
  {
    name: 'SalesReturnItem',
    module: 'Ventas',
    description: 'Line items for sales returns',
    fields: [
      { name: 'id', type: 'String', isPK: true, default: '@default(uuid())' },
      { name: 'salesReturnId', type: 'String', isFK: true },
      { name: 'productId', type: 'String', isOptional: true, isFK: true },
      { name: 'description', type: 'String' },
      { name: 'quantity', type: 'Decimal' },
      { name: 'unitPrice', type: 'Decimal' },
      { name: 'total', type: 'Decimal' },
      { name: 'salesReturn', type: 'SalesReturn', relation: 'Many-to-One', isFK: true },
    ],
  },
  {
    name: 'CreditNote',
    module: 'Ventas',
    description: 'Customer credit notes',
    fields: [
      { name: 'id', type: 'String', isPK: true, default: '@default(uuid())' },
      { name: 'tenantId', type: 'String', isFK: true },
      { name: 'number', type: 'String', isUnique: true },
      { name: 'customerId', type: 'String', isFK: true },
      { name: 'invoiceId', type: 'String', isOptional: true, isFK: true },
      { name: 'salesReturnId', type: 'String', isOptional: true, isFK: true },
      { name: 'date', type: 'DateTime' },
      { name: 'total', type: 'Decimal' },
      { name: 'status', type: 'CreditNoteStatus', default: "@default(DRAFT)" },
      { name: 'reason', type: 'String' },
      { name: 'createdAt', type: 'DateTime', default: '@default(now())' },
      { name: 'items', type: 'CreditNoteItem[]', relation: 'One-to-Many' },
    ],
  },
  {
    name: 'CreditNoteItem',
    module: 'Ventas',
    description: 'Line items for credit notes',
    fields: [
      { name: 'id', type: 'String', isPK: true, default: '@default(uuid())' },
      { name: 'creditNoteId', type: 'String', isFK: true },
      { name: 'description', type: 'String' },
      { name: 'quantity', type: 'Decimal' },
      { name: 'unitPrice', type: 'Decimal' },
      { name: 'total', type: 'Decimal' },
      { name: 'creditNote', type: 'CreditNote', relation: 'Many-to-One', isFK: true },
    ],
  },
  // ===== COMPRAS =====
  {
    name: 'Supplier',
    module: 'Compras',
    description: 'Supplier directory',
    fields: [
      { name: 'id', type: 'String', isPK: true, default: '@default(uuid())' },
      { name: 'tenantId', type: 'String', isFK: true },
      { name: 'code', type: 'String' },
      { name: 'name', type: 'String' },
      { name: 'taxId', type: 'String', isOptional: true },
      { name: 'email', type: 'String', isOptional: true },
      { name: 'phone', type: 'String', isOptional: true },
      { name: 'address', type: 'String', isOptional: true },
      { name: 'city', type: 'String', isOptional: true },
      { name: 'country', type: 'String', isOptional: true },
      { name: 'contactName', type: 'String', isOptional: true },
      { name: 'paymentTerms', type: 'String', isOptional: true },
      { name: 'balance', type: 'Decimal', default: '@default(0)' },
      { name: 'rating', type: 'Decimal', default: '@default(0)' },
      { name: 'status', type: 'EntityStatus', default: "@default(ACTIVE)" },
      { name: 'createdAt', type: 'DateTime', default: '@default(now())' },
      { name: 'updatedAt', type: 'DateTime', attributes: ['@updatedAt'] },
      { name: 'tenant', type: 'Tenant', relation: 'Many-to-One', isFK: true },
      { name: 'purchaseOrders', type: 'PurchaseOrder[]', relation: 'One-to-Many' },
      { name: 'supplierInvoices', type: 'SupplierInvoice[]', relation: 'One-to-Many' },
    ],
  },
  {
    name: 'PurchaseOrder',
    module: 'Compras',
    description: 'Purchase orders to suppliers',
    fields: [
      { name: 'id', type: 'String', isPK: true, default: '@default(uuid())' },
      { name: 'tenantId', type: 'String', isFK: true },
      { name: 'number', type: 'String', isUnique: true },
      { name: 'supplierId', type: 'String', isFK: true },
      { name: 'date', type: 'DateTime' },
      { name: 'expectedDelivery', type: 'DateTime', isOptional: true },
      { name: 'subtotal', type: 'Decimal' },
      { name: 'taxAmount', type: 'Decimal' },
      { name: 'total', type: 'Decimal' },
      { name: 'currency', type: 'String', default: '@default("USD")' },
      { name: 'status', type: 'PurchaseOrderStatus', default: "@default(DRAFT)" },
      { name: 'requestedBy', type: 'String' },
      { name: 'notes', type: 'String', isOptional: true },
      { name: 'createdAt', type: 'DateTime', default: '@default(now())' },
      { name: 'updatedAt', type: 'DateTime', attributes: ['@updatedAt'] },
      { name: 'supplier', type: 'Supplier', relation: 'Many-to-One', isFK: true },
      { name: 'items', type: 'PurchaseOrderItem[]', relation: 'One-to-Many' },
      { name: 'receipts', type: 'PurchaseReceipt[]', relation: 'One-to-Many' },
    ],
  },
  {
    name: 'PurchaseOrderItem',
    module: 'Compras',
    description: 'Line items for purchase orders',
    fields: [
      { name: 'id', type: 'String', isPK: true, default: '@default(uuid())' },
      { name: 'purchaseOrderId', type: 'String', isFK: true },
      { name: 'productId', type: 'String', isOptional: true, isFK: true },
      { name: 'description', type: 'String' },
      { name: 'quantity', type: 'Decimal' },
      { name: 'unitPrice', type: 'Decimal' },
      { name: 'taxRate', type: 'Decimal', default: '@default(0)' },
      { name: 'total', type: 'Decimal' },
      { name: 'purchaseOrder', type: 'PurchaseOrder', relation: 'Many-to-One', isFK: true },
    ],
  },
  {
    name: 'PurchaseReceipt',
    module: 'Compras',
    description: 'Goods received from purchase orders',
    fields: [
      { name: 'id', type: 'String', isPK: true, default: '@default(uuid())' },
      { name: 'tenantId', type: 'String', isFK: true },
      { name: 'number', type: 'String', isUnique: true },
      { name: 'purchaseOrderId', type: 'String', isFK: true },
      { name: 'supplierId', type: 'String', isFK: true },
      { name: 'date', type: 'DateTime' },
      { name: 'status', type: 'ReceiptStatus', default: "@default(PENDING)" },
      { name: 'notes', type: 'String', isOptional: true },
      { name: 'createdAt', type: 'DateTime', default: '@default(now())' },
      { name: 'purchaseOrder', type: 'PurchaseOrder', relation: 'Many-to-One', isFK: true },
      { name: 'items', type: 'PurchaseReceiptItem[]', relation: 'One-to-Many' },
    ],
  },
  {
    name: 'PurchaseReceiptItem',
    module: 'Compras',
    description: 'Line items for purchase receipts',
    fields: [
      { name: 'id', type: 'String', isPK: true, default: '@default(uuid())' },
      { name: 'purchaseReceiptId', type: 'String', isFK: true },
      { name: 'productId', type: 'String', isOptional: true, isFK: true },
      { name: 'description', type: 'String' },
      { name: 'quantityOrdered', type: 'Decimal' },
      { name: 'quantityReceived', type: 'Decimal' },
      { name: 'purchaseReceipt', type: 'PurchaseReceipt', relation: 'Many-to-One', isFK: true },
    ],
  },
  {
    name: 'SupplierInvoice',
    module: 'Compras',
    description: 'Invoices from suppliers',
    fields: [
      { name: 'id', type: 'String', isPK: true, default: '@default(uuid())' },
      { name: 'tenantId', type: 'String', isFK: true },
      { name: 'number', type: 'String', isUnique: true },
      { name: 'supplierId', type: 'String', isFK: true },
      { name: 'purchaseOrderId', type: 'String', isOptional: true, isFK: true },
      { name: 'date', type: 'DateTime' },
      { name: 'dueDate', type: 'DateTime' },
      { name: 'subtotal', type: 'Decimal' },
      { name: 'taxAmount', type: 'Decimal' },
      { name: 'total', type: 'Decimal' },
      { name: 'amountPaid', type: 'Decimal', default: '@default(0)' },
      { name: 'balance', type: 'Decimal' },
      { name: 'currency', type: 'String', default: '@default("USD")' },
      { name: 'status', type: 'PaymentStatus', default: "@default(PENDING)" },
      { name: 'createdAt', type: 'DateTime', default: '@default(now())' },
      { name: 'updatedAt', type: 'DateTime', attributes: ['@updatedAt'] },
      { name: 'supplier', type: 'Supplier', relation: 'Many-to-One', isFK: true },
      { name: 'items', type: 'SupplierInvoiceItem[]', relation: 'One-to-Many' },
    ],
  },
  {
    name: 'SupplierInvoiceItem',
    module: 'Compras',
    description: 'Line items for supplier invoices',
    fields: [
      { name: 'id', type: 'String', isPK: true, default: '@default(uuid())' },
      { name: 'supplierInvoiceId', type: 'String', isFK: true },
      { name: 'description', type: 'String' },
      { name: 'quantity', type: 'Decimal' },
      { name: 'unitPrice', type: 'Decimal' },
      { name: 'taxRate', type: 'Decimal', default: '@default(0)' },
      { name: 'total', type: 'Decimal' },
      { name: 'supplierInvoice', type: 'SupplierInvoice', relation: 'Many-to-One', isFK: true },
    ],
  },
  {
    name: 'RecurringSupplierInvoice',
    module: 'Compras',
    description: 'Recurring supplier invoice templates',
    fields: [
      { name: 'id', type: 'String', isPK: true, default: '@default(uuid())' },
      { name: 'tenantId', type: 'String', isFK: true },
      { name: 'supplierId', type: 'String', isFK: true },
      { name: 'frequency', type: 'Frequency' },
      { name: 'startDate', type: 'DateTime' },
      { name: 'endDate', type: 'DateTime', isOptional: true },
      { name: 'nextInvoiceDate', type: 'DateTime' },
      { name: 'total', type: 'Decimal' },
      { name: 'currency', type: 'String', default: '@default("USD")' },
      { name: 'status', type: 'RecurringStatus', default: "@default(ACTIVE)" },
      { name: 'createdAt', type: 'DateTime', default: '@default(now())' },
      { name: 'items', type: 'RecurringSupplierInvoiceItem[]', relation: 'One-to-Many' },
    ],
  },
  {
    name: 'RecurringSupplierInvoiceItem',
    module: 'Compras',
    description: 'Line items for recurring supplier invoices',
    fields: [
      { name: 'id', type: 'String', isPK: true, default: '@default(uuid())' },
      { name: 'recurringSupplierInvoiceId', type: 'String', isFK: true },
      { name: 'description', type: 'String' },
      { name: 'quantity', type: 'Decimal' },
      { name: 'unitPrice', type: 'Decimal' },
      { name: 'total', type: 'Decimal' },
    ],
  },
  {
    name: 'PaymentMade',
    module: 'Compras',
    description: 'Payments made to suppliers',
    fields: [
      { name: 'id', type: 'String', isPK: true, default: '@default(uuid())' },
      { name: 'tenantId', type: 'String', isFK: true },
      { name: 'number', type: 'String', isUnique: true },
      { name: 'supplierId', type: 'String', isFK: true },
      { name: 'supplierInvoiceId', type: 'String', isOptional: true, isFK: true },
      { name: 'date', type: 'DateTime' },
      { name: 'amount', type: 'Decimal' },
      { name: 'currency', type: 'String', default: '@default("USD")' },
      { name: 'method', type: 'PaymentMethod' },
      { name: 'reference', type: 'String', isOptional: true },
      { name: 'notes', type: 'String', isOptional: true },
      { name: 'createdAt', type: 'DateTime', default: '@default(now())' },
      { name: 'supplier', type: 'Supplier', relation: 'Many-to-One', isFK: true },
    ],
  },
  {
    name: 'SupplierCredit',
    module: 'Compras',
    description: 'Credits from suppliers',
    fields: [
      { name: 'id', type: 'String', isPK: true, default: '@default(uuid())' },
      { name: 'tenantId', type: 'String', isFK: true },
      { name: 'number', type: 'String', isUnique: true },
      { name: 'supplierId', type: 'String', isFK: true },
      { name: 'supplierInvoiceId', type: 'String', isOptional: true, isFK: true },
      { name: 'date', type: 'DateTime' },
      { name: 'total', type: 'Decimal' },
      { name: 'status', type: 'CreditNoteStatus', default: "@default(DRAFT)" },
      { name: 'reason', type: 'String' },
      { name: 'createdAt', type: 'DateTime', default: '@default(now())' },
      { name: 'items', type: 'SupplierCreditItem[]', relation: 'One-to-Many' },
    ],
  },
  {
    name: 'SupplierCreditItem',
    module: 'Compras',
    description: 'Line items for supplier credits',
    fields: [
      { name: 'id', type: 'String', isPK: true, default: '@default(uuid())' },
      { name: 'supplierCreditId', type: 'String', isFK: true },
      { name: 'description', type: 'String' },
      { name: 'quantity', type: 'Decimal' },
      { name: 'unitPrice', type: 'Decimal' },
      { name: 'total', type: 'Decimal' },
    ],
  },
  // ===== FINANZAS =====
  {
    name: 'Account',
    module: 'Finanzas',
    description: 'Chart of accounts',
    fields: [
      { name: 'id', type: 'String', isPK: true, default: '@default(uuid())' },
      { name: 'tenantId', type: 'String', isFK: true },
      { name: 'code', type: 'String' },
      { name: 'name', type: 'String' },
      { name: 'type', type: 'AccountType' },
      { name: 'parentId', type: 'String', isOptional: true, isFK: true },
      { name: 'balance', type: 'Decimal', default: '@default(0)' },
      { name: 'currency', type: 'String', default: '@default("USD")' },
      { name: 'isActive', type: 'Boolean', default: '@default(true)' },
      { name: 'createdAt', type: 'DateTime', default: '@default(now())' },
      { name: 'parent', type: 'Account', relation: 'Self Many-to-One', isFK: true },
      { name: 'children', type: 'Account[]', relation: 'Self One-to-Many' },
      { name: 'transactions', type: 'Transaction[]', relation: 'One-to-Many' },
    ],
  },
  {
    name: 'Income',
    module: 'Finanzas',
    description: 'Income entries',
    fields: [
      { name: 'id', type: 'String', isPK: true, default: '@default(uuid())' },
      { name: 'tenantId', type: 'String', isFK: true },
      { name: 'number', type: 'String', isUnique: true },
      { name: 'accountId', type: 'String', isFK: true },
      { name: 'customerId', type: 'String', isOptional: true, isFK: true },
      { name: 'date', type: 'DateTime' },
      { name: 'amount', type: 'Decimal' },
      { name: 'currency', type: 'String', default: '@default("USD")' },
      { name: 'category', type: 'String' },
      { name: 'description', type: 'String' },
      { name: 'reference', type: 'String', isOptional: true },
      { name: 'createdAt', type: 'DateTime', default: '@default(now())' },
      { name: 'account', type: 'Account', relation: 'Many-to-One', isFK: true },
    ],
  },
  {
    name: 'Expense',
    module: 'Finanzas',
    description: 'Expense entries',
    fields: [
      { name: 'id', type: 'String', isPK: true, default: '@default(uuid())' },
      { name: 'tenantId', type: 'String', isFK: true },
      { name: 'number', type: 'String', isUnique: true },
      { name: 'accountId', type: 'String', isFK: true },
      { name: 'supplierId', type: 'String', isOptional: true, isFK: true },
      { name: 'date', type: 'DateTime' },
      { name: 'amount', type: 'Decimal' },
      { name: 'currency', type: 'String', default: '@default("USD")' },
      { name: 'category', type: 'String' },
      { name: 'description', type: 'String' },
      { name: 'reference', type: 'String', isOptional: true },
      { name: 'status', type: 'ExpenseStatus', default: "@default(PENDING)" },
      { name: 'createdAt', type: 'DateTime', default: '@default(now())' },
      { name: 'account', type: 'Account', relation: 'Many-to-One', isFK: true },
    ],
  },
  {
    name: 'RecurringExpense',
    module: 'Finanzas',
    description: 'Recurring expense templates',
    fields: [
      { name: 'id', type: 'String', isPK: true, default: '@default(uuid())' },
      { name: 'tenantId', type: 'String', isFK: true },
      { name: 'accountId', type: 'String', isFK: true },
      { name: 'supplierId', type: 'String', isOptional: true, isFK: true },
      { name: 'frequency', type: 'Frequency' },
      { name: 'startDate', type: 'DateTime' },
      { name: 'endDate', type: 'DateTime', isOptional: true },
      { name: 'nextDate', type: 'DateTime' },
      { name: 'amount', type: 'Decimal' },
      { name: 'currency', type: 'String', default: '@default("USD")' },
      { name: 'category', type: 'String' },
      { name: 'description', type: 'String' },
      { name: 'status', type: 'RecurringStatus', default: "@default(ACTIVE)" },
      { name: 'createdAt', type: 'DateTime', default: '@default(now())' },
      { name: 'account', type: 'Account', relation: 'Many-to-One', isFK: true },
    ],
  },
  {
    name: 'JournalEntry',
    module: 'Finanzas',
    description: 'Double-entry journal entries',
    fields: [
      { name: 'id', type: 'String', isPK: true, default: '@default(uuid())' },
      { name: 'tenantId', type: 'String', isFK: true },
      { name: 'number', type: 'String', isUnique: true },
      { name: 'date', type: 'DateTime' },
      { name: 'description', type: 'String' },
      { name: 'status', type: 'JournalStatus', default: "@default(DRAFT)" },
      { name: 'createdAt', type: 'DateTime', default: '@default(now())' },
      { name: 'lines', type: 'JournalEntryLine[]', relation: 'One-to-Many' },
    ],
  },
  {
    name: 'JournalEntryLine',
    module: 'Finanzas',
    description: 'Individual debit/credit lines',
    fields: [
      { name: 'id', type: 'String', isPK: true, default: '@default(uuid())' },
      { name: 'journalEntryId', type: 'String', isFK: true },
      { name: 'accountId', type: 'String', isFK: true },
      { name: 'debit', type: 'Decimal', default: '@default(0)' },
      { name: 'credit', type: 'Decimal', default: '@default(0)' },
      { name: 'description', type: 'String', isOptional: true },
      { name: 'journalEntry', type: 'JournalEntry', relation: 'Many-to-One', isFK: true },
      { name: 'account', type: 'Account', relation: 'Many-to-One', isFK: true },
    ],
  },
  {
    name: 'Transaction',
    module: 'Finanzas',
    description: 'Account transaction ledger',
    fields: [
      { name: 'id', type: 'String', isPK: true, default: '@default(uuid())' },
      { name: 'tenantId', type: 'String', isFK: true },
      { name: 'accountId', type: 'String', isFK: true },
      { name: 'date', type: 'DateTime' },
      { name: 'type', type: 'TransactionType' },
      { name: 'amount', type: 'Decimal' },
      { name: 'balance', type: 'Decimal' },
      { name: 'description', type: 'String' },
      { name: 'referenceType', type: 'String', isOptional: true },
      { name: 'referenceId', type: 'String', isOptional: true },
      { name: 'createdAt', type: 'DateTime', default: '@default(now())' },
      { name: 'account', type: 'Account', relation: 'Many-to-One', isFK: true },
    ],
  },
  // ===== RRHH =====
  {
    name: 'Employee',
    module: 'RRHH',
    description: 'Employee records',
    fields: [
      { name: 'id', type: 'String', isPK: true, default: '@default(uuid())' },
      { name: 'tenantId', type: 'String', isFK: true },
      { name: 'code', type: 'String' },
      { name: 'firstName', type: 'String' },
      { name: 'lastName', type: 'String' },
      { name: 'email', type: 'String' },
      { name: 'phone', type: 'String', isOptional: true },
      { name: 'position', type: 'String' },
      { name: 'department', type: 'String' },
      { name: 'hireDate', type: 'DateTime' },
      { name: 'terminationDate', type: 'DateTime', isOptional: true },
      { name: 'salary', type: 'Decimal' },
      { name: 'salaryType', type: 'SalaryType' },
      { name: 'currency', type: 'String', default: '@default("USD")' },
      { name: 'bankAccount', type: 'String', isOptional: true },
      { name: 'taxId', type: 'String', isOptional: true },
      { name: 'address', type: 'String', isOptional: true },
      { name: 'emergencyContact', type: 'String', isOptional: true },
      { name: 'emergencyPhone', type: 'String', isOptional: true },
      { name: 'status', type: 'EmployeeStatus', default: "@default(ACTIVE)" },
      { name: 'createdAt', type: 'DateTime', default: '@default(now())' },
      { name: 'updatedAt', type: 'DateTime', attributes: ['@updatedAt'] },
      { name: 'payrollItems', type: 'PayrollItem[]', relation: 'One-to-Many' },
    ],
  },
  {
    name: 'Payroll',
    module: 'RRHH',
    description: 'Payroll runs',
    fields: [
      { name: 'id', type: 'String', isPK: true, default: '@default(uuid())' },
      { name: 'tenantId', type: 'String', isFK: true },
      { name: 'number', type: 'String', isUnique: true },
      { name: 'periodStart', type: 'DateTime' },
      { name: 'periodEnd', type: 'DateTime' },
      { name: 'payDate', type: 'DateTime' },
      { name: 'employeeCount', type: 'Int' },
      { name: 'totalGross', type: 'Decimal' },
      { name: 'totalDeductions', type: 'Decimal' },
      { name: 'totalNet', type: 'Decimal' },
      { name: 'currency', type: 'String', default: '@default("USD")' },
      { name: 'status', type: 'PayrollStatus', default: "@default(DRAFT)" },
      { name: 'createdAt', type: 'DateTime', default: '@default(now())' },
      { name: 'items', type: 'PayrollItem[]', relation: 'One-to-Many' },
    ],
  },
  {
    name: 'PayrollItem',
    module: 'RRHH',
    description: 'Individual payroll calculations per employee',
    fields: [
      { name: 'id', type: 'String', isPK: true, default: '@default(uuid())' },
      { name: 'payrollId', type: 'String', isFK: true },
      { name: 'employeeId', type: 'String', isFK: true },
      { name: 'baseSalary', type: 'Decimal' },
      { name: 'overtime', type: 'Decimal', default: '@default(0)' },
      { name: 'bonuses', type: 'Decimal', default: '@default(0)' },
      { name: 'grossPay', type: 'Decimal' },
      { name: 'taxDeduction', type: 'Decimal', default: '@default(0)' },
      { name: 'socialSecurity', type: 'Decimal', default: '@default(0)' },
      { name: 'otherDeductions', type: 'Decimal', default: '@default(0)' },
      { name: 'totalDeductions', type: 'Decimal' },
      { name: 'netPay', type: 'Decimal' },
      { name: 'payroll', type: 'Payroll', relation: 'Many-to-One', isFK: true },
    ],
  },
  // ===== INVENTARIO =====
  {
    name: 'Category',
    module: 'Inventario',
    description: 'Product categories',
    fields: [
      { name: 'id', type: 'String', isPK: true, default: '@default(uuid())' },
      { name: 'tenantId', type: 'String', isFK: true },
      { name: 'name', type: 'String' },
      { name: 'description', type: 'String', isOptional: true },
      { name: 'parentId', type: 'String', isOptional: true, isFK: true },
      { name: 'createdAt', type: 'DateTime', default: '@default(now())' },
      { name: 'parent', type: 'Category', relation: 'Self Many-to-One', isFK: true },
      { name: 'children', type: 'Category[]', relation: 'Self One-to-Many' },
      { name: 'products', type: 'Product[]', relation: 'One-to-Many' },
    ],
  },
  {
    name: 'Product',
    module: 'Inventario',
    description: 'Product catalog',
    fields: [
      { name: 'id', type: 'String', isPK: true, default: '@default(uuid())' },
      { name: 'tenantId', type: 'String', isFK: true },
      { name: 'code', type: 'String', isUnique: true },
      { name: 'name', type: 'String' },
      { name: 'categoryId', type: 'String', isFK: true },
      { name: 'type', type: 'ProductType' },
      { name: 'cost', type: 'Decimal' },
      { name: 'price', type: 'Decimal' },
      { name: 'taxRate', type: 'Decimal' },
      { name: 'trackInventory', type: 'Boolean', default: '@default(true)' },
      { name: 'createdAt', type: 'DateTime', default: '@default(now())' },
      { name: 'category', type: 'Category', relation: 'Many-to-One', isFK: true },
      { name: 'variants', type: 'ProductVariant[]', relation: 'One-to-Many' },
    ],
  },
  {
    name: 'ProductVariant',
    module: 'Inventario',
    description: 'Product variants (sizes, colors)',
    fields: [
      { name: 'id', type: 'String', isPK: true, default: '@default(uuid())' },
      { name: 'productId', type: 'String', isFK: true },
      { name: 'sku', type: 'String', isUnique: true },
      { name: 'name', type: 'String' },
      { name: 'priceModifier', type: 'Decimal', default: '@default(0)' },
      { name: 'costModifier', type: 'Decimal', default: '@default(0)' },
      { name: 'product', type: 'Product', relation: 'Many-to-One', isFK: true },
      { name: 'inventory', type: 'InventoryLevel[]', relation: 'One-to-Many' },
    ],
  },
  {
    name: 'Warehouse',
    module: 'Inventario',
    description: 'Storage locations',
    fields: [
      { name: 'id', type: 'String', isPK: true, default: '@default(uuid())' },
      { name: 'tenantId', type: 'String', isFK: true },
      { name: 'name', type: 'String' },
      { name: 'address', type: 'String', isOptional: true },
      { name: 'isActive', type: 'Boolean', default: '@default(true)' },
      { name: 'inventory', type: 'InventoryLevel[]', relation: 'One-to-Many' },
    ],
  },
  {
    name: 'InventoryLevel',
    module: 'Inventario',
    description: 'Stock levels per warehouse',
    fields: [
      { name: 'id', type: 'String', isPK: true, default: '@default(uuid())' },
      { name: 'warehouseId', type: 'String', isFK: true },
      { name: 'variantId', type: 'String', isFK: true },
      { name: 'quantity', type: 'Decimal', default: '@default(0)' },
      { name: 'reserved', type: 'Decimal', default: '@default(0)' },
      { name: 'warehouse', type: 'Warehouse', relation: 'Many-to-One', isFK: true },
      { name: 'variant', type: 'ProductVariant', relation: 'Many-to-One', isFK: true },
    ],
  },
  {
    name: 'InventoryMovement',
    module: 'Inventario',
    description: 'Stock movement history',
    fields: [
      { name: 'id', type: 'String', isPK: true, default: '@default(uuid())' },
      { name: 'tenantId', type: 'String', isFK: true },
      { name: 'warehouseId', type: 'String', isFK: true },
      { name: 'variantId', type: 'String', isFK: true },
      { name: 'type', type: 'MovementType' },
      { name: 'quantity', type: 'Decimal' },
      { name: 'date', type: 'DateTime', default: '@default(now())' },
      { name: 'reference', type: 'String', isOptional: true },
      { name: 'warehouse', type: 'Warehouse', relation: 'Many-to-One', isFK: true },
      { name: 'variant', type: 'ProductVariant', relation: 'Many-to-One', isFK: true },
    ],
  },
  // ===== RRHH (Extras) =====
  {
    name: 'TimeOff',
    module: 'RRHH',
    description: 'Employee vacation and time-off requests',
    fields: [
      { name: 'id', type: 'String', isPK: true, default: '@default(uuid())' },
      { name: 'employeeId', type: 'String', isFK: true },
      { name: 'type', type: 'TimeOffType' },
      { name: 'startDate', type: 'DateTime' },
      { name: 'endDate', type: 'DateTime' },
      { name: 'status', type: 'ApprovalStatus', default: '@default(PENDING)' },
      { name: 'approvedById', type: 'String', isOptional: true, isFK: true },
      { name: 'createdAt', type: 'DateTime', default: '@default(now())' },
      { name: 'employee', type: 'Employee', relation: 'Many-to-One', isFK: true },
    ],
  },
  // ===== HERRAMIENTAS =====
  {
    name: 'Activity',
    module: 'Herramientas',
    description: 'Tasks and activities',
    fields: [
      { name: 'id', type: 'String', isPK: true, default: '@default(uuid())' },
      { name: 'tenantId', type: 'String', isFK: true },
      { name: 'title', type: 'String' },
      { name: 'description', type: 'String', isOptional: true },
      { name: 'type', type: 'ActivityType' },
      { name: 'assignedToId', type: 'String', isFK: true },
      { name: 'dueDate', type: 'DateTime', isOptional: true },
      { name: 'status', type: 'TaskStatus', default: '@default(PENDING)' },
      { name: 'assignedTo', type: 'User', relation: 'Many-to-One', isFK: true },
    ],
  },
  {
    name: 'Ticket',
    module: 'Herramientas',
    description: 'Support tickets',
    fields: [
      { name: 'id', type: 'String', isPK: true, default: '@default(uuid())' },
      { name: 'tenantId', type: 'String', isFK: true },
      { name: 'number', type: 'String', isUnique: true },
      { name: 'subject', type: 'String' },
      { name: 'description', type: 'String' },
      { name: 'customerId', type: 'String', isOptional: true, isFK: true },
      { name: 'assignedToId', type: 'String', isOptional: true, isFK: true },
      { name: 'status', type: 'TicketStatus', default: '@default(OPEN)' },
      { name: 'priority', type: 'Priority', default: '@default(MEDIUM)' },
      { name: 'createdAt', type: 'DateTime', default: '@default(now())' },
    ],
  },
  {
    name: 'Document',
    module: 'Herramientas',
    description: 'File management',
    fields: [
      { name: 'id', type: 'String', isPK: true, default: '@default(uuid())' },
      { name: 'tenantId', type: 'String', isFK: true },
      { name: 'name', type: 'String' },
      { name: 'url', type: 'String' },
      { name: 'size', type: 'Int' },
      { name: 'mimeType', type: 'String' },
      { name: 'folder', type: 'String', isOptional: true },
      { name: 'uploadedById', type: 'String', isFK: true },
    ],
  },
  {
    name: 'Notification',
    module: 'Herramientas',
    description: 'System notifications',
    fields: [
      { name: 'id', type: 'String', isPK: true, default: '@default(uuid())' },
      { name: 'userId', type: 'String', isFK: true },
      { name: 'title', type: 'String' },
      { name: 'message', type: 'String' },
      { name: 'read', type: 'Boolean', default: '@default(false)' },
      { name: 'link', type: 'String', isOptional: true },
      { name: 'createdAt', type: 'DateTime', default: '@default(now())' },
    ],
  },
  {
    name: 'Transfer',
    module: 'Herramientas',
    description: 'Inventory transfers between warehouses',
    fields: [
      { name: 'id', type: 'String', isPK: true, default: '@default(uuid())' },
      { name: 'tenantId', type: 'String', isFK: true },
      { name: 'number', type: 'String', isUnique: true },
      { name: 'fromId', type: 'String', isFK: true },
      { name: 'toId', type: 'String', isFK: true },
      { name: 'status', type: 'TransferStatus', default: '@default(PENDING)' },
      { name: 'date', type: 'DateTime' },
      { name: 'items', type: 'TransferItem[]', relation: 'One-to-Many' },
    ]
  },
  {
    name: 'TransferItem',
    module: 'Herramientas',
    description: 'Items in a transfer',
    fields: [
      { name: 'id', type: 'String', isPK: true, default: '@default(uuid())' },
      { name: 'transferId', type: 'String', isFK: true },
      { name: 'variantId', type: 'String', isFK: true },
      { name: 'quantity', type: 'Decimal' },
    ]
  },
  // ===== SISTEMA =====
  {
    name: 'Report',
    module: 'Sistema',
    description: 'Saved report templates',
    fields: [
      { name: 'id', type: 'String', isPK: true, default: '@default(uuid())' },
      { name: 'tenantId', type: 'String', isFK: true },
      { name: 'name', type: 'String' },
      { name: 'type', type: 'String' },
      { name: 'config', type: 'Json' },
      { name: 'createdById', type: 'String', isFK: true },
      { name: 'createdAt', type: 'DateTime', default: '@default(now())' },
    ]
  },
  {
    name: 'Role',
    module: 'Sistema',
    description: 'Dynamic user roles',
    fields: [
      { name: 'id', type: 'String', isPK: true, default: '@default(uuid())' },
      { name: 'tenantId', type: 'String', isFK: true },
      { name: 'name', type: 'String' },
      { name: 'description', type: 'String', isOptional: true },
      { name: 'permissions', type: 'Json' },
    ]
  },
  {
    name: 'SystemSetting',
    module: 'Sistema',
    description: 'Tenant specific settings',
    fields: [
      { name: 'id', type: 'String', isPK: true, default: '@default(uuid())' },
      { name: 'tenantId', type: 'String', isFK: true },
      { name: 'group', type: 'String' },
      { name: 'key', type: 'String' },
      { name: 'value', type: 'String' },
      { name: 'updatedAt', type: 'DateTime', attributes: ['@updatedAt'] },
    ]
  }
];

// Prisma code generator
function generatePrismaCode(model: PrismaModel): string {
  const lines = [`model ${model.name} {`];
  model.fields.forEach(f => {
    if (f.relation) return; // skip relation fields in raw code
    let line = `  ${f.name.padEnd(22)} ${f.type}${f.isOptional ? '?' : ''}`;
    if (f.isPK) line += ' @id';
    if (f.default) line += ` ${f.default}`;
    if (f.isUnique) line += ' @unique';
    if (f.attributes) line += ` ${f.attributes.join(' ')}`;
    lines.push(line);
  });
  // Add relations
  model.fields.filter(f => f.relation).forEach(f => {
    lines.push('');
    if (f.relation === 'Many-to-One' || f.relation === 'Self Many-to-One') {
      const fkField = f.name + 'Id';
      if (model.fields.some(mf => mf.name === fkField)) {
        const relationAttr = f.relation === 'Self Many-to-One'
          ? `"${model.name}Hierarchy", fields: [${fkField}], references: [id]`
          : `fields: [${fkField}], references: [id]`;
        lines.push(`  ${f.name.padEnd(22)} ${f.type} @relation(${relationAttr})`);
      }
    } else if (f.relation === 'Self One-to-Many') {
      lines.push(`  ${f.name.padEnd(22)} ${f.type} @relation("${model.name}Hierarchy")`);
    } else {
      lines.push(`  ${f.name.padEnd(22)} ${f.type}`);
    }
  });
  lines.push('}');
  return lines.join('\n');
}

function generateFullSchema(): string {
  const enums = `// ===== ENUMS =====

enum SystemRole {
  ADMIN
  MANAGER
  EMPLOYEE
  VIEWER
}

enum EntityStatus {
  ACTIVE
  INACTIVE
  ARCHIVED
}

enum DocumentStatus {
  DRAFT
  SENT
  APPROVED
  REJECTED
  CANCELLED
}

enum PaymentStatus {
  PENDING
  PARTIAL
  PAID
  OVERDUE
  REFUNDED
}

enum PaymentMethod {
  CASH
  TRANSFER
  CHECK
  CARD
  OTHER
}

enum Frequency {
  WEEKLY
  MONTHLY
  QUARTERLY
  YEARLY
}

enum RecurringStatus {
  ACTIVE
  PAUSED
  EXPIRED
  CANCELLED
}

enum CustomerType {
  INDIVIDUAL
  COMPANY
}

enum SalesOrderStatus {
  DRAFT
  CONFIRMED
  IN_PROGRESS
  SHIPPED
  DELIVERED
  CANCELLED
}

enum PurchaseOrderStatus {
  DRAFT
  PENDING
  APPROVED
  CANCELLED
}

enum ReceiptStatus {
  PENDING
  RECEIVED
  PARTIAL
  REJECTED
}

enum ReturnStatus {
  PENDING
  APPROVED
  PROCESSED
  REJECTED
}

enum CreditNoteStatus {
  DRAFT
  ISSUED
  APPLIED
  VOIDED
}

enum AccountType {
  ASSET
  LIABILITY
  EQUITY
  INCOME
  EXPENSE
}

enum ExpenseStatus {
  PENDING
  APPROVED
  PAID
  REJECTED
}

enum JournalStatus {
  DRAFT
  POSTED
  VOIDED
}

enum TransactionType {
  DEBIT
  CREDIT
}

enum SalaryType {
  MONTHLY
  BIWEEKLY
  HOURLY
}

enum EmployeeStatus {
  ACTIVE
  ON_LEAVE
  TERMINATED
}

enum PayrollStatus {
  DRAFT
  PROCESSING
  APPROVED
  PAID
}

enum ProductType {
  PRODUCT
  SERVICE
}

enum MovementType {
  IN
  OUT
  TRANSFER
  ADJUSTMENT
}

enum TimeOffType {
  VACATION
  SICK_LEAVE
  PERSONAL
  MATERNITY
  UNPAID
}

enum ApprovalStatus {
  PENDING
  APPROVED
  REJECTED
}

enum ActivityType {
  CALL
  MEETING
  EMAIL
  TASK
  DEADLINE
}

enum TaskStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  CANCELLED
}

enum TicketStatus {
  OPEN
  IN_PROGRESS
  RESOLVED
  CLOSED
}

enum Priority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

enum TransferStatus {
  PENDING
  IN_TRANSIT
  COMPLETED
  CANCELLED
}`;

  const models = prismaModels.map(m => generatePrismaCode(m)).join('\n\n');
  return `// Nova Hub ERP - Prisma Schema\n// Generated for NestJS Backend\n// =================================\n\ngenerator client {\n  provider = "prisma-client-js"\n}\n\ndatasource db {\n  provider = "postgresql"\n  url      = env("DATABASE_URL")\n}\n\n${enums}\n\n// ===== MODELS =====\n\n${models}`;
}

// ============================================================
// UI COMPONENT
// ============================================================

export function PrismaSchemaPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedModels, setExpandedModels] = useState<Set<string>>(new Set());
  const [copiedModel, setCopiedModel] = useState<string | null>(null);

  const modules = [...new Set(prismaModels.map(m => m.module))];
  const filteredModels = prismaModels.filter(m =>
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.module.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleModel = (name: string) => {
    setExpandedModels(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const expandAll = () => setExpandedModels(new Set(prismaModels.map(m => m.name)));
  const collapseAll = () => setExpandedModels(new Set());

  const copyModelCode = (model: PrismaModel) => {
    navigator.clipboard.writeText(generatePrismaCode(model));
    setCopiedModel(model.name);
    toast.success(`Modelo ${model.name} copiado`);
    setTimeout(() => setCopiedModel(null), 2000);
  };

  const copyFullSchema = () => {
    navigator.clipboard.writeText(generateFullSchema());
    toast.success('Schema completo copiado al portapapeles');
  };

  const stats = {
    totalModels: prismaModels.length,
    totalFields: prismaModels.reduce((sum, m) => sum + m.fields.length, 0),
    totalRelations: prismaModels.reduce((sum, m) => sum + m.fields.filter(f => f.relation).length, 0),
    totalFKs: prismaModels.reduce((sum, m) => sum + m.fields.filter(f => f.isFK && !f.relation).length, 0),
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Database className="size-6 text-primary" />
            Prisma Schema - Dev Tool
          </h1>
          <p className="text-sm text-muted-foreground">
            Modelo de datos completo para NestJS + Prisma ORM
          </p>
        </div>
        <Button onClick={copyFullSchema} className="gap-2">
          <Copy className="size-4" />
          Copiar Schema Completo
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Table2 className="size-4" />Modelos</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.totalModels}</div></CardContent>
        </Card>
        <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Campos Totales</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-blue-400">{stats.totalFields}</div></CardContent>
        </Card>
        <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-transparent">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Link2 className="size-4" />Relaciones</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-purple-400">{stats.totalRelations}</div></CardContent>
        </Card>
        <Card className="border-orange-500/20 bg-gradient-to-br from-orange-500/5 to-transparent">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Key className="size-4" />Foreign Keys</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-orange-400">{stats.totalFKs}</div></CardContent>
        </Card>
      </div>

      <Tabs defaultValue="visual" className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <TabsList>
            <TabsTrigger value="visual"><Table2 className="mr-1.5 size-3.5" />Vista Visual</TabsTrigger>
            <TabsTrigger value="code"><Database className="mr-1.5 size-3.5" />Codigo Prisma</TabsTrigger>
          </TabsList>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar modelos..." className="pl-9 w-60" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <Button variant="outline" size="sm" onClick={expandAll}>Expandir</Button>
            <Button variant="outline" size="sm" onClick={collapseAll}>Colapsar</Button>
          </div>
        </div>

        {/* Visual View */}
        <TabsContent value="visual" className="space-y-4">
          {modules.map(mod => {
            const modModels = filteredModels.filter(m => m.module === mod);
            if (modModels.length === 0) return null;
            return (
              <div key={mod}>
                <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                  <div className="size-2 rounded-full bg-primary" />
                  {mod} <Badge variant="secondary" className="text-[10px]">{modModels.length} modelos</Badge>
                </h2>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {modModels.map(model => {
                    const isExpanded = expandedModels.has(model.name);
                    const dataFields = model.fields.filter(f => !f.relation);
                    const relations = model.fields.filter(f => f.relation);
                    return (
                      <Card key={model.name} className="overflow-hidden transition-all hover:shadow-md hover:shadow-primary/5">
                        <div
                          className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/20 transition-colors"
                          onClick={() => toggleModel(model.name)}
                        >
                          <div className="flex items-center gap-2">
                            {isExpanded ? <ChevronDown className="size-4 text-primary" /> : <ChevronRight className="size-4" />}
                            <Table2 className="size-4 text-primary" />
                            <span className="text-sm font-semibold">{model.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-[10px]">{dataFields.length} campos</Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              onClick={(e) => { e.stopPropagation(); copyModelCode(model); }}
                            >
                              {copiedModel === model.name ? <Check className="size-3.5 text-green-400" /> : <Copy className="size-3.5" />}
                            </Button>
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="border-t border-border">
                            <p className="px-3 py-2 text-xs text-muted-foreground bg-muted/20">{model.description}</p>
                            <div className="divide-y divide-border/50">
                              {dataFields.map(f => (
                                <div key={f.name} className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted/10">
                                  {f.isPK && <Key className="size-3 text-yellow-400 shrink-0" />}
                                  {f.isFK && !f.isPK && <Link2 className="size-3 text-blue-400 shrink-0" />}
                                  {!f.isPK && !f.isFK && <div className="size-3 shrink-0" />}
                                  <span className={cn('font-mono', f.isPK && 'text-yellow-400', f.isFK && !f.isPK && 'text-blue-400')}>
                                    {f.name}
                                  </span>
                                  <span className="text-muted-foreground ml-auto font-mono">{f.type}{f.isOptional ? '?' : ''}</span>
                                </div>
                              ))}
                              {relations.length > 0 && (
                                <div className="px-3 py-2 space-y-1 bg-primary/5">
                                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Relaciones</p>
                                  {relations.map(r => (
                                    <div key={r.name} className="flex items-center gap-2 text-xs">
                                      <Link2 className="size-3 text-primary shrink-0" />
                                      <span className="font-mono text-primary">{r.name}</span>
                                      <span className="text-muted-foreground ml-auto">{r.relation}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </TabsContent>

        {/* Code View */}
        <TabsContent value="code">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>schema.prisma</CardTitle>
                  <CardDescription>Codigo listo para copiar a tu proyecto NestJS</CardDescription>
                </div>
                <Button onClick={copyFullSchema} variant="outline" className="gap-2">
                  <Copy className="size-4" />
                  Copiar Todo
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] rounded-lg border border-border bg-black/40 p-4">
                <pre className="text-xs font-mono text-green-400 whitespace-pre-wrap">
                  {generateFullSchema()}
                </pre>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

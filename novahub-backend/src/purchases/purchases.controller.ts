import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { PurchasesService } from './purchases.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CreateSupplierDto, UpdateSupplierDto, CreatePurchaseOrderDto, CreatePurchaseReceiptDto, CreateSupplierInvoiceDto } from './dto/purchases.dto';

@ApiTags('purchases')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('purchases')
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  // ─── PROVEEDORES ─────────────────────────────────────────────────────────
  @Post('suppliers')
  @ApiOperation({ summary: 'Crear nuevo proveedor' })
  createSupplier(@Body() data: CreateSupplierDto, @Request() req) {
    return this.purchasesService.createSupplier(data, req.user.clientTenantId);
  }

  @Get('suppliers')
  @ApiOperation({ summary: 'Listar proveedores del tenant' })
  findAllSuppliers(@Request() req) {
    return this.purchasesService.findAllSuppliers(req.user.clientTenantId);
  }

  @Patch('suppliers/:id')
  @ApiOperation({ summary: 'Actualizar proveedor' })
  updateSupplier(@Param('id') id: string, @Body() data: UpdateSupplierDto, @Request() req) {
    return this.purchasesService.updateSupplier(id, data, req.user.clientTenantId);
  }

  @Delete('suppliers/:id')
  @ApiOperation({ summary: 'Eliminar proveedor' })
  removeSupplier(@Param('id') id: string, @Request() req) {
    return this.purchasesService.removeSupplier(id, req.user.clientTenantId);
  }

  // ─── ÓRDENES DE COMPRA ───────────────────────────────────────────────────
  @Post('orders')
  @ApiOperation({ summary: 'Crear orden de compra' })
  createOrder(@Body() data: CreatePurchaseOrderDto, @Request() req) {
    return this.purchasesService.createOrder(data, req.user.clientTenantId);
  }

  @Get('orders')
  @ApiOperation({ summary: 'Listar órdenes de compra' })
  findAllOrders(@Request() req) {
    return this.purchasesService.findAllOrders(req.user.clientTenantId);
  }

  @Patch('orders/:id')
  @ApiOperation({ summary: 'Actualizar orden de compra' })
  updateOrder(@Param('id') id: string, @Body() data: any, @Request() req) {
    return this.purchasesService.updateOrder(id, data, req.user.clientTenantId);
  }

  // ─── RECEPCIONES DE COMPRA ───────────────────────────────────────────────
  @Post('receipts')
  @ApiOperation({ summary: 'Registrar recepción de compra' })
  createReceipt(@Body() data: CreatePurchaseReceiptDto, @Request() req) {
    return this.purchasesService.createReceipt(data, req.user.clientTenantId);
  }

  @Get('receipts')
  @ApiOperation({ summary: 'Listar recepciones de compra' })
  findAllReceipts(@Request() req) {
    return this.purchasesService.findAllReceipts(req.user.clientTenantId);
  }

  // ─── FACTURAS DE PROVEEDOR ───────────────────────────────────────────────
  @Post('invoices')
  @ApiOperation({ summary: 'Registrar factura de proveedor' })
  createInvoice(@Body() data: CreateSupplierInvoiceDto, @Request() req) {
    return this.purchasesService.createInvoice(data, req.user.clientTenantId);
  }

  @Get('invoices')
  @ApiOperation({ summary: 'Listar facturas de proveedores' })
  findAllInvoices(@Request() req) {
    return this.purchasesService.findAllInvoices(req.user.clientTenantId);
  }

  // ─── FACTURAS RECURRENTES PROVEEDOR ──────────────────────────────────────
  @Post('recurring-invoices')
  @ApiOperation({ summary: 'Crear factura recurrente de proveedor' })
  createRecurringInvoice(@Body() data: any, @Request() req) {
    return this.purchasesService.createRecurringInvoice(data, req.user.clientTenantId);
  }

  @Get('recurring-invoices')
  @ApiOperation({ summary: 'Listar facturas recurrentes de proveedores' })
  findAllRecurringInvoices(@Request() req) {
    return this.purchasesService.findAllRecurringInvoices(req.user.clientTenantId);
  }

  // ─── PAGOS REALIZADOS ────────────────────────────────────────────────────
  @Post('payments')
  @ApiOperation({ summary: 'Registrar pago a proveedor' })
  createPayment(@Body() data: any, @Request() req) {
    return this.purchasesService.createPayment(data, req.user.clientTenantId);
  }

  @Get('payments')
  @ApiOperation({ summary: 'Historial de pagos a proveedores' })
  findAllPayments(@Request() req) {
    return this.purchasesService.findAllPayments(req.user.clientTenantId);
  }

  // ─── CRÉDITOS DE PROVEEDOR ───────────────────────────────────────────────
  @Post('credits')
  @ApiOperation({ summary: 'Registrar crédito de proveedor' })
  createCredit(@Body() data: any, @Request() req) {
    return this.purchasesService.createCredit(data, req.user.clientTenantId);
  }

  @Get('credits')
  @ApiOperation({ summary: 'Listar créditos de proveedores' })
  findAllCredits(@Request() req) {
    return this.purchasesService.findAllCredits(req.user.clientTenantId);
  }

  // ─── GASTOS ─────────────────────────────────────────────────────────────
  @Post('expenses')
  @ApiOperation({ summary: 'Registrar gasto' })
  createExpense(@Body() data: any, @Request() req) {
    return this.purchasesService.createExpense(data, req.user.clientTenantId);
  }

  @Get('expenses')
  @ApiOperation({ summary: 'Listar gastos' })
  findAllExpenses(@Request() req) {
    return this.purchasesService.findAllExpenses(req.user.clientTenantId);
  }

  @Patch('expenses/:id')
  @ApiOperation({ summary: 'Actualizar gasto' })
  updateExpense(@Param('id') id: string, @Body() data: any, @Request() req) {
    return this.purchasesService.updateExpense(id, data, req.user.clientTenantId);
  }

  @Delete('expenses/:id')
  @ApiOperation({ summary: 'Eliminar gasto' })
  removeExpense(@Param('id') id: string, @Request() req) {
    return this.purchasesService.removeExpense(id, req.user.clientTenantId);
  }

  // ─── GASTOS RECURRENTES ──────────────────────────────────────────────────
  @Post('recurring-expenses')
  @ApiOperation({ summary: 'Crear gasto recurrente' })
  createRecurringExpense(@Body() data: any, @Request() req) {
    return this.purchasesService.createRecurringExpense(data, req.user.clientTenantId);
  }

  @Get('recurring-expenses')
  @ApiOperation({ summary: 'Listar gastos recurrentes' })
  findAllRecurringExpenses(@Request() req) {
    return this.purchasesService.findAllRecurringExpenses(req.user.clientTenantId);
  }
}

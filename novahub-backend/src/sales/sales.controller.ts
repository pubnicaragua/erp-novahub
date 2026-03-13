import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { SalesService } from './sales.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiBody } from '@nestjs/swagger';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateCustomerDto, CreateEstimateDto, CreateSalesOrderDto, CreatePaymentDto } from './dto/sales.dto';

@ApiTags('sales')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  // ─── CLIENTES ───────────────────────────────────────────────────────────
  @Post('customers')
  @ApiOperation({ summary: 'Crear nuevo cliente' })
  createCustomer(@Body() data: CreateCustomerDto, @Request() req) {
    return this.salesService.createCustomer(data, req.user.clientTenantId);
  }

  @Get('customers')
  @ApiOperation({ summary: 'Listar clientes del tenant' })
  findAllCustomers(@Request() req) {
    return this.salesService.findAllCustomers(req.user.clientTenantId);
  }

  @Patch('customers/:id')
  @ApiOperation({ summary: 'Actualizar cliente' })
  updateCustomer(@Param('id') id: string, @Body() data: UpdateCustomerDto, @Request() req) {
    return this.salesService.updateCustomer(id, data, req.user.clientTenantId);
  }

  @Delete('customers/:id')
  @ApiOperation({ summary: 'Eliminar cliente' })
  removeCustomer(@Param('id') id: string, @Request() req) {
    return this.salesService.removeCustomer(id, req.user.clientTenantId);
  }

  // ─── COTIZACIONES ────────────────────────────────────────────────────────
  @Post('estimates')
  @ApiOperation({ summary: 'Crear nueva cotización' })
  createEstimate(@Body() data: CreateEstimateDto, @Request() req) {
    return this.salesService.createEstimate(data, req.user.clientTenantId);
  }

  @Get('estimates')
  @ApiOperation({ summary: 'Listar cotizaciones' })
  findAllEstimates(@Request() req) {
    return this.salesService.findAllEstimates(req.user.clientTenantId);
  }

  // ─── ÓRDENES DE VENTA ────────────────────────────────────────────────────
  @Post('orders')
  @ApiOperation({ summary: 'Crear nueva orden de venta' })
  createSalesOrder(@Body() data: CreateSalesOrderDto, @Request() req) {
    return this.salesService.createSalesOrder(data, req.user.clientTenantId);
  }

  @Get('orders')
  @ApiOperation({ summary: 'Listar órdenes de venta' })
  findAllSalesOrders(@Request() req) {
    return this.salesService.findAllSalesOrders(req.user.clientTenantId);
  }

  @Patch('orders/:id')
  @ApiOperation({ summary: 'Actualizar orden de venta' })
  updateSalesOrder(@Param('id') id: string, @Body() data: any, @Request() req) {
    return this.salesService.updateSalesOrder(id, data, req.user.clientTenantId);
  }

  // ─── FACTURAS ────────────────────────────────────────────────────────────
  @Post('invoices')
  @ApiOperation({ summary: 'Crear nueva factura' })
  createInvoice(@Body() data: CreateInvoiceDto, @Request() req) {
    return this.salesService.createInvoice(data, req.user.clientTenantId);
  }

  @Get('invoices')
  @ApiOperation({ summary: 'Listar facturas emitidas' })
  findAllInvoices(@Request() req) {
    return this.salesService.findAllInvoices(req.user.clientTenantId);
  }

  @Patch('invoices/:id')
  @ApiOperation({ summary: 'Actualizar factura' })
  updateInvoice(@Param('id') id: string, @Body() data: any, @Request() req) {
    return this.salesService.updateInvoice(id, data, req.user.clientTenantId);
  }

  // ─── PAGOS ───────────────────────────────────────────────────────────────
  @Post('payments')
  @ApiOperation({ summary: 'Registrar pago de cliente' })
  createPayment(@Body() data: CreatePaymentDto, @Request() req) {
    return this.salesService.createPayment(data, req.user.clientTenantId);
  }

  @Get('payments')
  @ApiOperation({ summary: 'Historial de pagos recibidos' })
  findAllPayments(@Request() req) {
    return this.salesService.findAllPayments(req.user.clientTenantId);
  }

  // ─── FACTURAS RECURRENTES ─────────────────────────────────────────────────
  @Get('recurring-invoices')
  @ApiOperation({ summary: 'Listar facturas recurrentes' })
  findAllRecurringInvoices(@Request() req) {
    return this.salesService.findAllRecurringInvoices(req.user.clientTenantId);
  }

  @Post('recurring-invoices')
  @ApiOperation({ summary: 'Crear factura recurrente' })
  createRecurringInvoice(@Body() data: any, @Request() req) {
    return this.salesService.createRecurringInvoice(data, req.user.clientTenantId);
  }

  @Patch('recurring-invoices/:id')
  @ApiOperation({ summary: 'Actualizar factura recurrente' })
  updateRecurringInvoice(@Param('id') id: string, @Body() data: any, @Request() req) {
    return this.salesService.updateRecurringInvoice(id, data, req.user.clientTenantId);
  }

  @Patch('recurring-invoices/:id/pause')
  @ApiOperation({ summary: 'Pausar factura recurrente' })
  pauseRecurringInvoice(@Param('id') id: string, @Request() req) {
    return this.salesService.setRecurringInvoiceStatus(id, 'paused', req.user.clientTenantId);
  }

  @Patch('recurring-invoices/:id/resume')
  @ApiOperation({ summary: 'Reanudar factura recurrente' })
  resumeRecurringInvoice(@Param('id') id: string, @Request() req) {
    return this.salesService.setRecurringInvoiceStatus(id, 'active', req.user.clientTenantId);
  }

  // ─── DEVOLUCIONES ──────────────────────────────────────────────────────────
  @Get('returns')
  @ApiOperation({ summary: 'Listar devoluciones de venta' })
  findAllReturns(@Request() req) {
    return this.salesService.findAllReturns(req.user.clientTenantId);
  }

  @Post('returns')
  @ApiOperation({ summary: 'Registrar devolución' })
  createReturn(@Body() data: any, @Request() req) {
    return this.salesService.createReturn(data, req.user.clientTenantId);
  }

  @Patch('returns/:id/approve')
  @ApiOperation({ summary: 'Aprobar devolución' })
  approveReturn(@Param('id') id: string, @Request() req) {
    return this.salesService.approveReturn(id, req.user.clientTenantId);
  }
}

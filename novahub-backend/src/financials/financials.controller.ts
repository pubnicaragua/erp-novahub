import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { FinancialsService } from './financials.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CreateAccountDto, CreateIncomeDto, CreateExpenseDto, CreateJournalEntryDto } from './dto/financials.dto';

@ApiTags('financials')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('financials')
export class FinancialsController {
  constructor(private readonly financialsService: FinancialsService) {}

  // ─── CUENTAS ────────────────────────────────────────────────────────────
  @Post('accounts')
  @ApiOperation({ summary: 'Crear cuenta contable' })
  createAccount(@Body() data: CreateAccountDto, @Request() req) {
    return this.financialsService.createAccount(data, req.user.clientTenantId);
  }

  @Get('accounts')
  @ApiOperation({ summary: 'Plan de cuentas del tenant' })
  findAllAccounts(@Request() req) {
    return this.financialsService.findAllAccounts(req.user.clientTenantId);
  }

  @Patch('accounts/:id')
  @ApiOperation({ summary: 'Actualizar cuenta contable' })
  updateAccount(@Param('id') id: string, @Body() data: any, @Request() req) {
    return this.financialsService.updateAccount(id, data, req.user.clientTenantId);
  }

  // ─── INGRESOS ───────────────────────────────────────────────────────────
  @Post('income')
  @ApiOperation({ summary: 'Registrar ingreso' })
  createIncome(@Body() data: CreateIncomeDto, @Request() req) {
    return this.financialsService.createIncome(data, req.user.clientTenantId);
  }

  @Get('income')
  @ApiOperation({ summary: 'Listar ingresos' })
  findAllIncome(@Request() req) {
    return this.financialsService.findAllIncome(req.user.clientTenantId);
  }

  @Patch('income/:id')
  @ApiOperation({ summary: 'Actualizar ingreso' })
  updateIncome(@Param('id') id: string, @Body() data: any, @Request() req) {
    return this.financialsService.updateIncome(id, data, req.user.clientTenantId);
  }

  @Delete('income/:id')
  @ApiOperation({ summary: 'Eliminar ingreso' })
  removeIncome(@Param('id') id: string, @Request() req) {
    return this.financialsService.removeIncome(id, req.user.clientTenantId);
  }

  // ─── GASTOS ─────────────────────────────────────────────────────────────
  @Post('expenses')
  @ApiOperation({ summary: 'Registrar gasto' })
  createExpense(@Body() data: CreateExpenseDto, @Request() req) {
    return this.financialsService.createExpense(data, req.user.clientTenantId);
  }

  @Get('expenses')
  @ApiOperation({ summary: 'Listar gastos' })
  findAllExpenses(@Request() req) {
    return this.financialsService.findAllExpenses(req.user.clientTenantId);
  }

  @Patch('expenses/:id')
  @ApiOperation({ summary: 'Actualizar gasto' })
  updateExpense(@Param('id') id: string, @Body() data: any, @Request() req) {
    return this.financialsService.updateExpense(id, data, req.user.clientTenantId);
  }

  @Delete('expenses/:id')
  @ApiOperation({ summary: 'Eliminar gasto' })
  removeExpense(@Param('id') id: string, @Request() req) {
    return this.financialsService.removeExpense(id, req.user.clientTenantId);
  }

  // ─── GASTOS RECURRENTES ──────────────────────────────────────────────────
  @Post('recurring-expenses')
  @ApiOperation({ summary: 'Crear gasto recurrente' })
  createRecurringExpense(@Body() data: any, @Request() req) {
    return this.financialsService.createRecurringExpense(data, req.user.clientTenantId);
  }

  @Get('recurring-expenses')
  @ApiOperation({ summary: 'Listar gastos recurrentes' })
  findAllRecurringExpenses(@Request() req) {
    return this.financialsService.findAllRecurringExpenses(req.user.clientTenantId);
  }

  @Patch('recurring-expenses/:id')
  @ApiOperation({ summary: 'Actualizar gasto recurrente' })
  updateRecurringExpense(@Param('id') id: string, @Body() data: any, @Request() req) {
    return this.financialsService.updateRecurringExpense(id, data, req.user.clientTenantId);
  }

  @Delete('recurring-expenses/:id')
  @ApiOperation({ summary: 'Eliminar gasto recurrente' })
  removeRecurringExpense(@Param('id') id: string, @Request() req) {
    return this.financialsService.removeRecurringExpense(id, req.user.clientTenantId);
  }

  // ─── ASIENTOS CONTABLES ───────────────────────────────────────────────────
  @Post('journals')
  @ApiOperation({ summary: 'Crear asiento contable' })
  createJournal(@Body() data: CreateJournalEntryDto, @Request() req) {
    return this.financialsService.createJournalEntry(data, req.user.clientTenantId);
  }

  @Get('journals')
  @ApiOperation({ summary: 'Listar asientos contables' })
  findAllJournals(@Request() req) {
    return this.financialsService.findAllJournalEntries(req.user.clientTenantId);
  }

  // ─── TRANSACCIONES ────────────────────────────────────────────────────────
  @Get('transactions')
  @ApiOperation({ summary: 'Historial de transacciones' })
  findAllTransactions(@Request() req) {
    return this.financialsService.findAllTransactions(req.user.clientTenantId);
  }

  // ─── BALANCE GENERAL ─────────────────────────────────────────────────────
  @Get('balance')
  @ApiOperation({ summary: 'Balance general consolidado del tenant' })
  getBalance(@Request() req) {
    return this.financialsService.getBalance(req.user.clientTenantId);
  }
}

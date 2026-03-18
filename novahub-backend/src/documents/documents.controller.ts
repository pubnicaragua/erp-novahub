import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { DocumentsService } from './documents.service';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get('contracts')
  getContracts() { return this.documentsService.getContracts(); }
  @Post('contracts')
  createContract(@Body() data: any) { return this.documentsService.createContract(data); }
  @Patch('contracts/:id')
  updateContract(@Param('id') id: string, @Body() data: any) { return this.documentsService.updateContract(id, data); }
  @Delete('contracts/:id')
  deleteContract(@Param('id') id: string) { return this.documentsService.deleteContract(id); }

  @Get('legal-invoices')
  getLegalInvoices() { return this.documentsService.getLegalInvoices(); }
  @Post('legal-invoices')
  createLegalInvoice(@Body() data: any) { return this.documentsService.createLegalInvoice(data); }
  @Patch('legal-invoices/:id')
  updateLegalInvoice(@Param('id') id: string, @Body() data: any) { return this.documentsService.updateLegalInvoice(id, data); }
  @Delete('legal-invoices/:id')
  deleteLegalInvoice(@Param('id') id: string) { return this.documentsService.deleteLegalInvoice(id); }

  @Get('reports')
  getReports() { return this.documentsService.getReports(); }
  @Post('reports')
  createReport(@Body() data: any) { return this.documentsService.createReport(data); }
  @Patch('reports/:id')
  updateReport(@Param('id') id: string, @Body() data: any) { return this.documentsService.updateReport(id, data); }
  @Delete('reports/:id')
  deleteReport(@Param('id') id: string) { return this.documentsService.deleteReport(id); }

  @Get('files')
  getFiles() { return this.documentsService.getFiles(); }
  @Post('files')
  createFile(@Body() data: any) { return this.documentsService.createFile(data); }
  @Patch('files/:id')
  updateFile(@Param('id') id: string, @Body() data: any) { return this.documentsService.updateFile(id, data); }
  @Delete('files/:id')
  deleteFile(@Param('id') id: string) { return this.documentsService.deleteFile(id); }
}

import { Injectable } from '@nestjs/common';

@Injectable()
export class DocumentsService {
  private contracts: any[] = [];
  private legalInvoices: any[] = [];
  private reports: any[] = [];
  private files: any[] = [];

  getContracts() { return this.contracts; }
  createContract(data: any) { const item = { id: Date.now().toString(), ...data }; this.contracts.push(item); return item; }
  updateContract(id: string, data: any) { const index = this.contracts.findIndex(x => x.id === id); if (index > -1) { this.contracts[index] = { ...this.contracts[index], ...data }; return this.contracts[index]; } return null; }
  deleteContract(id: string) { this.contracts = this.contracts.filter(x => x.id !== id); return { success: true }; }

  getLegalInvoices() { return this.legalInvoices; }
  createLegalInvoice(data: any) { const item = { id: Date.now().toString(), ...data }; this.legalInvoices.push(item); return item; }
  updateLegalInvoice(id: string, data: any) { const index = this.legalInvoices.findIndex(x => x.id === id); if (index > -1) { this.legalInvoices[index] = { ...this.legalInvoices[index], ...data }; return this.legalInvoices[index]; } return null; }
  deleteLegalInvoice(id: string) { this.legalInvoices = this.legalInvoices.filter(x => x.id !== id); return { success: true }; }

  getReports() { return this.reports; }
  createReport(data: any) { const item = { id: Date.now().toString(), ...data }; this.reports.push(item); return item; }
  updateReport(id: string, data: any) { const index = this.reports.findIndex(x => x.id === id); if (index > -1) { this.reports[index] = { ...this.reports[index], ...data }; return this.reports[index]; } return null; }
  deleteReport(id: string) { this.reports = this.reports.filter(x => x.id !== id); return { success: true }; }

  getFiles() { return this.files; }
  createFile(data: any) { const item = { id: Date.now().toString(), ...data }; this.files.push(item); return item; }
  updateFile(id: string, data: any) { const index = this.files.findIndex(x => x.id === id); if (index > -1) { this.files[index] = { ...this.files[index], ...data }; return this.files[index]; } return null; }
  deleteFile(id: string) { this.files = this.files.filter(x => x.id !== id); return { success: true }; }
}

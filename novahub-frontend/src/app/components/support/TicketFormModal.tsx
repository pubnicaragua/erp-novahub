import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { ImagePlus, Loader2, X, Building2, UserRound, LockKeyhole, Link2, Check, ChevronsUpDown, Search } from 'lucide-react';
import type { Ticket } from '../../types';
import { supportService } from '../../services/support.service';
import { invoicesService } from '../../services/ventas.service';
import { storageService } from '../../services/storage.service';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';

interface TicketFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticket?: Ticket | null;
  onRefresh: () => void;
  customerCatalog?: any[];
  categoryCatalog?: any[];
  agentCatalog?: any[];
  invoiceCatalog?: any[];
  productCatalog?: any[];
}

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Baja' },
  { value: 'MEDIUM', label: 'Media' },
  { value: 'HIGH', label: 'Alta' },
  { value: 'URGENT', label: 'Urgente' },
];

const MAX_TICKET_ATTACHMENTS = 10;
const MAX_TICKET_ATTACHMENT_SIZE = 25 * 1024 * 1024;
const ALLOWED_TICKET_ATTACHMENT_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif',
  'application/pdf', 'text/plain', 'text/csv', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

function validateTicketAttachment(file: File) {
  if (!ALLOWED_TICKET_ATTACHMENT_TYPES.has(file.type)) throw new Error(`El archivo “${file.name}” no tiene un formato permitido.`);
  if (file.size === 0) throw new Error(`El archivo “${file.name}” está vacío.`);
  if (file.size > MAX_TICKET_ATTACHMENT_SIZE) throw new Error(`El archivo “${file.name}” supera el límite de 25 MB.`);
}

function invoiceBelongsToCustomer(invoice: any, customerId: string) {
  return invoice?.customerId === customerId || invoice?.customer?.id === customerId;
}

function isPaidInvoice(invoice: any) {
  return String(invoice?.status || '').toUpperCase() === 'PAID';
}

function toDateTimeLocal(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function getMinimumSlaDateTime() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 1);
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T00:00`;
}

export function TicketFormModal({ open, onOpenChange, ticket, onRefresh, customerCatalog = [], categoryCatalog = [], agentCatalog = [], invoiceCatalog = [], productCatalog = [] }: TicketFormModalProps) {
  const { user, userBranches, selectedBranchId } = useAuth();
  const isEditing = Boolean(ticket?.id);
  const [saving, setSaving] = useState(false);
  const minimumSlaDateTime = getMinimumSlaDateTime();

  const currentBranch = userBranches.find((branch) => branch.id === selectedBranchId)
    || userBranches[0]
    || (user?.clientTenantId ? { id: user.clientTenantId, name: user.clientTenant?.name || user.tenantName } : null);
  const branchName = ticket?.clientTenant?.name || currentBranch?.name || 'Sucursal actual';
  const creatorName = ticket?.createdBy?.name || user?.name || 'Usuario actual';

  const [subject, setSubject] = useState(ticket?.subject || '');
  const [description, setDescription] = useState(ticket?.description || '');
  const [priority, setPriority] = useState<string>(ticket?.priority || 'MEDIUM');
  const [customerId, setCustomerId] = useState(ticket?.customerId || ticket?.invoice?.customerId || '');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [categoryId, setCategoryId] = useState(ticket?.categoryId || '');
  const [assignedToId, setAssignedToId] = useState(ticket?.assignedToId || '');
  const [invoiceId, setInvoiceId] = useState(ticket?.invoiceId || '');
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>(
    ticket?.ticketProducts?.map((relation) => relation.productId).filter(Boolean)
      || (ticket?.productId ? [ticket.productId] : []),
  );
  const [productsTouched, setProductsTouched] = useState(false);
  const [invoiceDetail, setInvoiceDetail] = useState<any | null>(null);
  const [invoiceLoadErrorId, setInvoiceLoadErrorId] = useState('');
  const [resolutionNote, setResolutionNote] = useState(ticket?.resolutionNote || '');
  const [slaDueAt, setSlaDueAt] = useState(toDateTimeLocal(ticket?.slaDueAt));
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (!invoiceId) return () => { cancelled = true; };

    const catalogInvoice = invoiceCatalog.find((invoice: any) => invoice.id === invoiceId);
    if (!catalogInvoice || !isPaidInvoice(catalogInvoice)) return () => { cancelled = true; };
    if (Array.isArray(catalogInvoice?.items)) {
      return () => { cancelled = true; };
    }

    invoicesService.getById(invoiceId)
      .then((invoice) => {
        if (!cancelled) {
          setInvoiceDetail(invoice);
          setInvoiceLoadErrorId('');
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setInvoiceLoadErrorId(invoiceId);
          toast.error(error?.response?.data?.message || 'No se pudo cargar el detalle de la factura');
        }
      })

    return () => { cancelled = true; };
  }, [invoiceCatalog, invoiceId]);

  const customerInvoices = customerId
    ? invoiceCatalog.filter((invoice: any) => isPaidInvoice(invoice) && invoiceBelongsToCustomer(invoice, customerId))
    : [];

  const availableInvoiceId = customerInvoices.some((invoice: any) => invoice.id === invoiceId) ? invoiceId : '';
  const selectedInvoiceInCatalog = invoiceCatalog.find((invoice: any) => invoice.id === availableInvoiceId);
  const invoiceLoading = Boolean(
    availableInvoiceId
      && !Array.isArray(selectedInvoiceInCatalog?.items)
      && invoiceDetail?.id !== availableInvoiceId
      && invoiceLoadErrorId !== availableInvoiceId,
  );
  const selectedInvoice = Array.isArray(selectedInvoiceInCatalog?.items)
    ? selectedInvoiceInCatalog
    : invoiceDetail?.id === availableInvoiceId ? invoiceDetail : null;

  const invoiceItems = useMemo(() => (
    Array.isArray(selectedInvoice?.items) ? selectedInvoice.items : []
  ), [selectedInvoice]);

  const invoiceProducts = useMemo(() => {
    const productsById = new Map(productCatalog.map((product: any) => [product.id, product]));
    const uniqueProducts = new Map<string, { id: string; name: string; code?: string | null; quantity?: number }>();

    invoiceItems.forEach((item: any) => {
      if (!item?.productId || uniqueProducts.has(item.productId)) return;
      const catalogProduct = productsById.get(item.productId);
      uniqueProducts.set(item.productId, {
        id: item.productId,
        name: item.description || catalogProduct?.name || 'Producto / servicio',
        code: item.productCode || catalogProduct?.code || null,
        quantity: item.quantity,
      });
    });

    return [...uniqueProducts.values()];
  }, [invoiceItems, productCatalog]);

  const filteredCustomers = useMemo(() => {
    const query = customerSearch.trim().toLowerCase();
    if (!query) return customerCatalog;
    return customerCatalog.filter((customer: any) => (
      `${customer.name || ''} ${customer.code || ''} ${customer.email || ''} ${customer.phone || ''}`
    ).toLowerCase().includes(query));
  }, [customerCatalog, customerSearch]);
  const selectedCustomer = customerCatalog.find((customer: any) => customer.id === customerId);

  const effectiveCategoryId = categoryId || categoryCatalog[0]?.id || '';
  const validSelectedProductIds = selectedProductIds.filter((id) => invoiceProducts.some((product) => product.id === id));
  const effectiveProductIds = invoiceLoading || !availableInvoiceId
    ? []
    : validSelectedProductIds.length > 0
      ? validSelectedProductIds
      : !productsTouched && invoiceProducts.length === 1 ? [invoiceProducts[0].id] : [];

  const handleAttachmentChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || []);
    event.currentTarget.value = '';
    if (attachmentFiles.length + selected.length > MAX_TICKET_ATTACHMENTS) {
      toast.error(`Solo puedes adjuntar hasta ${MAX_TICKET_ATTACHMENTS} archivos por ticket.`);
      return;
    }
    try {
      selected.forEach(validateTicketAttachment);
      setAttachmentFiles(current => [...current, ...selected]);
    } catch (error: any) {
      toast.error(error?.message || 'La evidencia no es válida');
    }
  };

  const handleSave = async () => {
    if (!subject.trim()) {
      toast.error('El asunto es obligatorio');
      return;
    }
    if (!description.trim()) {
      toast.error('La descripción es obligatoria');
      return;
    }

    if (slaDueAt && slaDueAt < minimumSlaDateTime) {
      toast.error('La fecha del SLA debe ser a partir de mañana');
      return;
    }

    setSaving(true);
    try {
      const data: any = {
        subject: subject.trim(),
        description: description.trim(),
        priority: priority as any,
        customerId: customerId || null,
        categoryId: effectiveCategoryId || null,
        assignedToId: assignedToId || null,
        invoiceId: availableInvoiceId || null,
        productId: effectiveProductIds[0] || null,
        productIds: effectiveProductIds,
        resolutionNote: resolutionNote.trim() || null,
        slaDueAt: slaDueAt || null,
      };

      let savedTicket: Ticket;
      if (isEditing && ticket?.id) {
        savedTicket = await supportService.update(ticket.id, data);
        toast.success('Ticket actualizado');
      } else {
        savedTicket = await supportService.create(data);
        toast.success('Ticket creado');
      }

      if (attachmentFiles.length > 0 && savedTicket?.id) {
        const uploads = await Promise.all(attachmentFiles.map((file) => storageService.uploadFile('support-evidence', file, { folder: `tickets/${savedTicket.id}` })));
        await Promise.all(uploads.map((uploaded, index) => supportService.addAttachment(savedTicket.id, {
          uri: uploaded.uri,
          fileName: attachmentFiles[index].name,
          mimeType: attachmentFiles[index].type,
          byteSize: attachmentFiles[index].size,
        })));
      }

      onOpenChange(false);
      onRefresh();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Error al guardar ticket');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1rem)] max-h-[90vh] max-w-2xl overflow-y-auto sm:w-full">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Ticket' : 'Nuevo Ticket'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Modifica los datos del ticket de soporte.' : 'Crea un nuevo ticket de soporte para un cliente o incidencia interna.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                <Building2 className="size-3.5 text-primary" /> Sucursal
              </label>
              <div className="flex h-10 items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 text-xs font-semibold text-foreground/80">
                <span className="min-w-0 flex-1 truncate">{branchName}</span>
                <LockKeyhole className="size-3.5 shrink-0 text-muted-foreground/60" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                <UserRound className="size-3.5 text-primary" /> Usuario creador
              </label>
              <div className="flex h-10 items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 text-xs font-semibold text-foreground/80">
                <span className="min-w-0 flex-1 truncate">{creatorName}</span>
                <LockKeyhole className="size-3.5 shrink-0 text-muted-foreground/60" />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-muted-foreground">Asunto *</label>
            <Input
              data-testid="tickets-form-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="h-9 text-xs"
              placeholder="Ej: Error al facturar, Solicitud de cambio..."
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase font-bold text-muted-foreground">Descripción *</label>
            <Textarea
              data-testid="tickets-form-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="text-xs min-h-[80px]"
              placeholder="Describe el problema o solicitud en detalle..."
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-muted-foreground">Prioridad</label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Categoría</label>
              <Select value={effectiveCategoryId || '__none__'} onValueChange={(value) => setCategoryId(value === '__none__' ? '' : value)}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Sin categoría" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin categoría</SelectItem>
                  {categoryCatalog.filter((category: any) => category.isActive !== false).map((category: any) => (
                    <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 rounded-2xl border border-dashed border-border/70 bg-muted/20 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">SLA opcional</label>
              <Input
                type="datetime-local"
                value={slaDueAt}
                min={minimumSlaDateTime}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value && value < minimumSlaDateTime) {
                    toast.error('La fecha del SLA debe ser a partir de mañana');
                    return;
                  }
                  setSlaDueAt(value);
                }}
                className="h-9 text-xs"
              />
            </div>
            <p className="max-w-xs text-[10px] leading-5 text-muted-foreground sm:pb-1">
              Solo puedes seleccionar una fecha desde mañana. Si lo dejas vacío, no se crea un SLA automático.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {customerCatalog.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cliente asociado</label>
                <Popover open={customerPickerOpen} onOpenChange={setCustomerPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="h-9 w-full min-w-0 justify-between gap-2 rounded-xl px-3 text-left text-xs font-normal">
                      <span className="min-w-0 flex-1 truncate">{selectedCustomer?.name || 'Sin cliente asociado'}</span>
                      <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-[min(22rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] rounded-2xl p-2">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input autoFocus value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="Buscar cliente por nombre, código o contacto" className="h-9 rounded-xl pl-9 text-xs" />
                    </div>
                    <div className="mt-2 max-h-64 space-y-1 overflow-y-auto">
                      <button type="button" className="flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-xs text-muted-foreground hover:bg-muted/60" onClick={() => { setCustomerId(''); setInvoiceId(''); setSelectedProductIds([]); setProductsTouched(false); setCustomerPickerOpen(false); setCustomerSearch(''); }}>
                        <span>Sin cliente</span>
                        {!customerId && <Check className="size-3.5 text-primary" />}
                      </button>
                      {filteredCustomers.map((customer: any) => (
                        <button key={customer.id} type="button" className="flex w-full min-w-0 items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left hover:bg-muted/60" onClick={() => {
                          const nextCustomerId = customer.id;
                          setCustomerId(nextCustomerId);
                          if (invoiceId && !invoiceBelongsToCustomer(invoiceCatalog.find((invoice: any) => invoice.id === invoiceId), nextCustomerId)) {
                            setInvoiceId('');
                            setSelectedProductIds([]);
                            setProductsTouched(false);
                          }
                          setCustomerPickerOpen(false);
                          setCustomerSearch('');
                        }}>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-semibold">{customer.name}</span>
                            <span className="block truncate text-[10px] text-muted-foreground">{customer.code || customer.email || customer.phone || 'Sin datos adicionales'}</span>
                          </span>
                          {customerId === customer.id && <Check className="size-3.5 shrink-0 text-primary" />}
                        </button>
                      ))}
                      {filteredCustomers.length === 0 && <p className="px-2.5 py-5 text-center text-xs text-muted-foreground">No se encontraron clientes.</p>}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            )}
            {agentCatalog.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Responsable</label>
                <Select value={assignedToId || '__none__'} onValueChange={(value) => setAssignedToId(value === '__none__' ? '' : value)}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin asignar</SelectItem>
                    {agentCatalog.filter((agent: any) => agent.isActive !== false).map((agent: any) => <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {invoiceCatalog.length > 0 && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground"><Link2 className="size-3.5 text-primary" /> Factura relacionada</label>
                <Select
                  disabled={!customerId}
                  value={availableInvoiceId || '__none__'}
                  onValueChange={(value) => {
                    setInvoiceId(value === '__none__' ? '' : value);
                    setSelectedProductIds([]);
                    setProductsTouched(false);
                  }}
                >
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder={customerId ? 'Sin factura pagada' : 'Selecciona un cliente primero'} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{customerId ? 'Sin factura pagada' : 'Selecciona un cliente primero'}</SelectItem>
                    {customerInvoices.map((invoice: any) => <SelectItem key={invoice.id} value={invoice.id}>{invoice.number} · {invoice.customer?.name || invoice.customCustomerName || 'Venta'}</SelectItem>)}
                  </SelectContent>
                </Select>
                {customerId && customerInvoices.length === 0 && <p className="text-[10px] text-muted-foreground">El cliente seleccionado no tiene facturas pagadas disponibles.</p>}
              </div>

              <div className="space-y-3 rounded-2xl border border-primary/15 bg-primary/[0.03] p-3">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground"><Link2 className="size-3.5 text-primary" /> Productos / servicios de la factura</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">Selecciona uno o varios productos facturados para relacionarlos con el ticket.</p>
                  </div>
                  {effectiveProductIds.length > 0 && <span className="shrink-0 rounded-full bg-primary/10 px-2 py-1 text-[10px] font-black text-primary">{effectiveProductIds.length} seleccionados</span>}
                </div>
                {!availableInvoiceId && <p className="rounded-xl border border-dashed border-border/70 px-3 py-4 text-center text-xs text-muted-foreground">Selecciona primero una factura pagada.</p>}
                {availableInvoiceId && invoiceLoading && <p className="rounded-xl border border-dashed border-border/70 px-3 py-4 text-center text-xs text-muted-foreground">Cargando productos de la factura…</p>}
                {availableInvoiceId && !invoiceLoading && invoiceProducts.length === 0 && <p className="rounded-xl border border-dashed border-border/70 px-3 py-4 text-center text-xs text-muted-foreground">La factura no tiene productos o servicios del catálogo para relacionar.</p>}
                {availableInvoiceId && !invoiceLoading && invoiceProducts.length > 0 && (
                  <div className="grid max-h-72 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                    {invoiceProducts.map((product) => {
                      const checked = effectiveProductIds.includes(product.id);
                      return (
                        <label key={product.id} className="flex min-w-0 cursor-pointer items-center gap-2 rounded-xl border border-border/60 bg-background/70 px-3 py-2.5 transition-colors hover:border-primary/40 hover:bg-primary/5">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(value) => {
                              setProductsTouched(true);
                              setSelectedProductIds((current) => value ? [...new Set([...current, product.id])] : current.filter((id) => id !== product.id));
                            }}
                            className="size-4 shrink-0"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-semibold">{product.code ? `${product.code} · ` : ''}{product.name}</span>
                            <span className="block text-[10px] text-muted-foreground">Cantidad facturada: {product.quantity ?? '—'}</span>
                          </span>
                          {checked && <Check className="size-4 shrink-0 text-primary" />}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {isEditing && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Nota de resolución / cierre</label>
              <Textarea value={resolutionNote} onChange={(event) => setResolutionNote(event.target.value)} className="min-h-20 text-xs" placeholder="Describe la solución aplicada o el motivo del cierre…" />
            </div>
          )}

          <div className="space-y-2 rounded-2xl border border-dashed border-border/70 bg-muted/20 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <label className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-muted-foreground">
                  <ImagePlus className="size-3.5 text-primary" /> Adjuntos y evidencias
                </label>
                <p className="mt-1 text-[10px] text-muted-foreground">Hasta {MAX_TICKET_ATTACHMENTS} archivos de imagen, PDF, Word, Excel o texto; máximo 25 MB cada uno.</p>
              </div>
              {attachmentFiles.length < MAX_TICKET_ATTACHMENTS && (
                <label className="relative inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-3 text-[10px] font-black uppercase text-primary hover:bg-primary/15">
                  <ImagePlus className="size-4" /> Adjuntar
                  <input type="file" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv" multiple className="absolute inset-0 cursor-pointer opacity-0" onChange={handleAttachmentChange} />
                </label>
              )}
            </div>
            {(ticket?.evidenceUrl1 || ticket?.evidenceUrl2 || attachmentFiles.length > 0) && (
              <div className="flex flex-wrap gap-2">
                {[ticket?.evidenceUrl1, ticket?.evidenceUrl2].filter(Boolean).map((url, index) => (
                  url?.startsWith('storage://') ? (
                    <span key={`existing-${url}`} className="max-w-full truncate rounded-lg border border-border/60 bg-background px-2.5 py-1.5 text-[10px] font-semibold text-muted-foreground">Evidencia existente {index + 1}</span>
                  ) : (
                    <a key={`existing-${url}`} href={url} target="_blank" rel="noreferrer" className="max-w-full truncate rounded-lg border border-border/60 bg-background px-2.5 py-1.5 text-[10px] font-semibold text-primary hover:underline">Evidencia existente {index + 1}</a>
                  )
                ))}
                {attachmentFiles.map((file, index) => (
                  <span key={`${file.name}-${file.lastModified}`} className="flex max-w-full items-center gap-1.5 rounded-lg border border-border/60 bg-background px-2.5 py-1.5 text-[10px] font-semibold">
                    <span className="max-w-[180px] truncate">{file.name}</span>
                    <button type="button" onClick={() => setAttachmentFiles(current => current.filter((_, i) => i !== index))} className="text-muted-foreground hover:text-rose-500" aria-label={`Quitar ${file.name}`}>
                      <X className="size-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {isEditing && attachmentFiles.length > 0 && <p className="text-[10px] text-amber-600">Los archivos nuevos se agregan al ticket y no eliminan los existentes.</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button data-testid="tickets-form-submit" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="size-4 mr-2 animate-spin" />}
            {isEditing ? 'Guardar cambios' : 'Crear Ticket'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

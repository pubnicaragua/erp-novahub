import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, Briefcase, Building2, CheckCircle2, Download, Plus, Upload } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { HorizontalTableScroller } from '../ui/HorizontalTableScroller';
import { ImportReviewSummary } from '../ui/ImportReviewSummary';
import { ImportProgressOverlay } from '../ui/ImportProgressOverlay';
import { useImportPreviewLayout } from '../../hooks/useImportPreviewLayout';

export type EmployeeImportRow = {
  sourceRow: number;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  hireDate: string;
  department: string;
  departmentId?: string;
  position: string;
  positionId?: string;
  contractType: string;
  salary: number | '';
  currency: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  emergencyContact: string;
  emergencyPhone: string;
  nationalId: string;
  socialSecurityNumber: string;
  probationEndDate: string;
  payFrequency: string;
  employmentStatus: string;
  notes: string;
  _hasError?: boolean;
  _errorMessage?: string;
  _hasWarning?: boolean;
  _warningMessage?: string;
};

export type EmployeeImportResult = {
  total: number;
  created: number;
  skipped: number;
  errors: Array<{ row?: number; employeeNumber?: string; message: string } | string>;
  warnings: string[];
};

type EmployeeImportPreviewProps = {
  rows: EmployeeImportRow[];
  fileName: string;
  departments: any[];
  positions: any[];
  isSidebarCollapsed?: boolean;
  canCreateCatalogs?: boolean;
  importing: boolean;
  progress: number;
  result: EmployeeImportResult | null;
  onRowUpdate: (index: number, field: string, value: string | number) => void;
  onCreateDepartment: (index: number, name: string) => Promise<void> | void;
  onCreatePosition: (index: number, title: string, departmentId: string) => Promise<void> | void;
  onDownloadErrors: () => void;
  onBack: () => void;
  onConfirm: () => void;
  onDone: () => void;
};

const fieldClass = 'h-9 w-full min-w-0 rounded-lg border-border/70 bg-background/70 text-xs';

const contractOptions = [
  ['FULL_TIME', 'Tiempo completo'],
  ['PART_TIME', 'Medio tiempo'],
  ['CONTRACTOR', 'Contratista'],
  ['INTERN', 'Pasante'],
  ['TEMPORARY', 'Temporal'],
];

export function EmployeeImportPreview({
  rows,
  fileName,
  departments,
  positions,
  isSidebarCollapsed,
  canCreateCatalogs = false,
  importing,
  progress,
  result,
  onRowUpdate,
  onCreateDepartment,
  onCreatePosition,
  onDownloadErrors,
  onBack,
  onConfirm,
  onDone,
}: EmployeeImportPreviewProps) {
  useImportPreviewLayout();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [departmentRowIndex, setDepartmentRowIndex] = useState<number | null>(null);
  const [departmentName, setDepartmentName] = useState('');
  const [positionRowIndex, setPositionRowIndex] = useState<number | null>(null);
  const [positionTitle, setPositionTitle] = useState('');
  const [positionDepartmentId, setPositionDepartmentId] = useState('');
  const [savingCatalog, setSavingCatalog] = useState(false);
  const validRows = rows.filter((row) => !row._hasError).length;
  const errorRows = rows.filter((row) => row._hasError).length;
  const warningRows = rows.filter((row) => !row._hasError && row._hasWarning).length;

  useEffect(() => {
    if (!result || result.errors.length) return;
    const timer = window.setTimeout(onDone, 3600);
    return () => window.clearTimeout(timer);
  }, [result, onDone]);

  return (
    <div className={`fixed inset-y-0 right-0 left-0 z-40 flex h-dvh min-h-0 flex-col overflow-hidden bg-background p-4 sm:p-6 ${isSidebarCollapsed ? 'lg:left-[72px]' : 'lg:left-[270px]'}`}>
      <div className="mx-auto flex min-h-0 w-full max-w-[1900px] flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-primary">Importación recurrente</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Previsualizar empleados</h1>
            <p className="mt-1 max-w-4xl text-sm text-muted-foreground">Corrige cada fila antes de importarla. El departamento y el puesto se validan juntos; los empleados que estén en un departamento vendedor podrán utilizarse para comisiones.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4">
          <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Archivo cargado</p><p className="truncate text-sm font-bold" title={fileName}>{fileName}</p></div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Importación repetible</Badge>
            <Badge variant="secondary">Sin vendedor individual</Badge>
            {(errorRows || warningRows) > 0 && <Button type="button" variant="outline" size="sm" onClick={onDownloadErrors} disabled={importing}><Download className="size-3.5" /> Descargar incidencias</Button>}
          </div>
        </div>

        <ImportReviewSummary total={rows.length} valid={validRows} skipped={errorRows} warnings={warningRows} entityLabel="empleados" />

        <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-xs text-muted-foreground">
          <Building2 className="mt-0.5 size-4 shrink-0 text-primary" />
          <p><span className="font-bold text-foreground">Catálogos relacionados:</span> si un departamento o puesto no existe, puedes crearlo desde la columna de validación. El puesto se creará obligatoriamente dentro del departamento seleccionado.</p>
        </div>

        <HorizontalTableScroller className="min-h-0 flex-1" tableClassName="overflow-x-scroll overflow-y-auto scrollbar-overlay" label="Desplazamiento horizontal · columna por columna">
          <Table containerClassName="overflow-visible" containerStyle={{ width: '4050px', minWidth: '4050px', maxWidth: 'none' }} className="w-[4050px] min-w-[4050px]">
            <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
              <TableRow>
                <TableHead className="w-20 min-w-20 whitespace-nowrap text-center">Estado</TableHead>
                <TableHead className="w-36 min-w-36 whitespace-nowrap">N.º empleado *</TableHead>
                <TableHead className="w-44 min-w-44 whitespace-nowrap">Nombres *</TableHead>
                <TableHead className="w-44 min-w-44 whitespace-nowrap">Apellidos *</TableHead>
                <TableHead className="w-64 min-w-64 whitespace-nowrap">Correo *</TableHead>
                <TableHead className="w-48 min-w-48 whitespace-nowrap">Cédula</TableHead>
                <TableHead className="w-44 min-w-44 whitespace-nowrap">Teléfono</TableHead>
                <TableHead className="w-36 min-w-36 whitespace-nowrap">Contratación *</TableHead>
                <TableHead className="w-64 min-w-64 whitespace-nowrap">Departamento *</TableHead>
                <TableHead className="w-64 min-w-64 whitespace-nowrap">Puesto *</TableHead>
                <TableHead className="w-40 min-w-40 whitespace-nowrap">Contrato *</TableHead>
                <TableHead className="w-36 min-w-36 whitespace-nowrap">Salario *</TableHead>
                <TableHead className="w-28 min-w-28 whitespace-nowrap">Moneda</TableHead>
                <TableHead className="w-36 min-w-36 whitespace-nowrap">Estado</TableHead>
                <TableHead className="w-[420px] min-w-[420px] whitespace-nowrap">Validación / acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => {
                const rowPositions = positions.filter((position: any) => !row.departmentId || position.departmentId === row.departmentId);
                return (
                  <TableRow key={index} className={row._hasError ? 'bg-rose-500/5' : row._hasWarning ? 'bg-amber-500/5' : ''}>
                    <TableCell className="text-center">{row._hasError ? <AlertTriangle className="mx-auto size-4 text-rose-500" /> : row._hasWarning ? <AlertTriangle className="mx-auto size-4 text-amber-500" /> : <CheckCircle2 className="mx-auto size-4 text-emerald-500" />}</TableCell>
                    <TableCell><Input className={fieldClass} value={row.employeeNumber} onChange={(event) => onRowUpdate(index, 'employeeNumber', event.target.value)} disabled={importing} /></TableCell>
                    <TableCell><Input className={fieldClass} value={row.firstName} onChange={(event) => onRowUpdate(index, 'firstName', event.target.value)} disabled={importing} /></TableCell>
                    <TableCell><Input className={fieldClass} value={row.lastName} onChange={(event) => onRowUpdate(index, 'lastName', event.target.value)} disabled={importing} /></TableCell>
                    <TableCell><Input className={fieldClass} type="email" value={row.email} onChange={(event) => onRowUpdate(index, 'email', event.target.value)} disabled={importing} /></TableCell>
                    <TableCell><Input className={fieldClass} value={row.nationalId} onChange={(event) => onRowUpdate(index, 'nationalId', event.target.value)} disabled={importing} placeholder="Cédula" /></TableCell>
                    <TableCell><Input className={fieldClass} value={row.phone} onChange={(event) => onRowUpdate(index, 'phone', event.target.value)} disabled={importing} /></TableCell>
                    <TableCell><Input className={fieldClass} type="date" value={row.hireDate} onChange={(event) => onRowUpdate(index, 'hireDate', event.target.value)} disabled={importing} /></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <select className={fieldClass} value={row.departmentId || ''} onChange={(event) => onRowUpdate(index, 'departmentId', event.target.value)} disabled={importing}>
                          <option value="">{row.department ? `No encontrado: ${row.department}` : 'Seleccionar departamento'}</option>
                          {row.departmentId && !departments.some((department: any) => String(department.id) === String(row.departmentId)) && <option value={row.departmentId}>{row.department} (creado)</option>}
                          {departments.map((department: any) => <option key={department.id} value={department.id}>{department.name}</option>)}
                        </select>
                        {canCreateCatalogs && !row.departmentId && row.department && <Button type="button" size="icon" variant="outline" className="size-9 shrink-0" title="Crear departamento" onClick={() => { setDepartmentRowIndex(index); setDepartmentName(row.department); }} disabled={importing}><Plus className="size-3.5" /></Button>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <select className={fieldClass} value={row.positionId || ''} onChange={(event) => onRowUpdate(index, 'positionId', event.target.value)} disabled={importing || !row.departmentId}>
                          <option value="">{row.position ? `No encontrado: ${row.position}` : 'Seleccionar puesto'}</option>
                          {row.positionId && !positions.some((position: any) => String(position.id) === String(row.positionId)) && <option value={row.positionId}>{row.position} (creado)</option>}
                          {rowPositions.map((position: any) => <option key={position.id} value={position.id}>{position.title}</option>)}
                        </select>
                        {canCreateCatalogs && !row.positionId && row.position && row.departmentId && <Button type="button" size="icon" variant="outline" className="size-9 shrink-0" title="Crear puesto" onClick={() => { setPositionRowIndex(index); setPositionTitle(row.position); setPositionDepartmentId(row.departmentId || ''); }} disabled={importing}><Plus className="size-3.5" /></Button>}
                      </div>
                    </TableCell>
                    <TableCell><select className={fieldClass} value={row.contractType} onChange={(event) => onRowUpdate(index, 'contractType', event.target.value)} disabled={importing}>{contractOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></TableCell>
                    <TableCell><Input className={`${fieldClass} text-right`} type="number" min="0" value={row.salary} onChange={(event) => onRowUpdate(index, 'salary', event.target.value === '' ? '' : Number(event.target.value))} disabled={importing} /></TableCell>
                    <TableCell><select className={fieldClass} value={row.currency} onChange={(event) => onRowUpdate(index, 'currency', event.target.value)} disabled={importing}><option value="NIO">NIO</option><option value="USD">USD</option></select></TableCell>
                    <TableCell><select className={fieldClass} value={row.employmentStatus} onChange={(event) => onRowUpdate(index, 'employmentStatus', event.target.value)} disabled={importing}><option value="ACTIVE">Activo</option><option value="INACTIVE">Inactivo</option><option value="ON_LEAVE">En ausencia</option><option value="TERMINATED">Terminado</option></select></TableCell>
                    <TableCell className="whitespace-normal">
                      <div className="space-y-2">
                        <p className={row._hasError ? 'text-xs font-medium text-rose-600' : row._hasWarning ? 'text-xs font-medium text-amber-600' : 'text-xs text-emerald-600'}>{row._errorMessage || row._warningMessage || 'Correcto'}</p>
                        {row._hasError && (!row.departmentId || !row.positionId) && <p className="text-[11px] text-muted-foreground">Corrige el catálogo o usa + para crearlo.</p>}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {!rows.length && <div className="p-12 text-center text-sm text-muted-foreground">El archivo no contiene filas para importar.</div>}
        </HorizontalTableScroller>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <Button variant="outline" onClick={onBack} disabled={importing}><ArrowLeft className="mr-2 size-4" /> Volver a la carga</Button>
          <Button onClick={() => { setConfirmText(''); setConfirmOpen(true); }} disabled={importing || validRows === 0} className="font-bold"><Upload className="mr-2 size-4" /> {importing ? `Importando… ${progress}%` : `Importar ${validRows} válidos · omitir ${errorRows}`}</Button>
        </div>
      </div>

      <Dialog open={confirmOpen && !importing} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirmar importación de empleados</DialogTitle><DialogDescription>Se importarán {validRows} empleados válidos y se omitirán {errorRows} con errores. Los {warningRows} avisos se conservarán como información y el sistema reportará cualquier conflicto adicional al guardar. Escribe IMPORTAR para continuar.</DialogDescription></DialogHeader>
          <Input value={confirmText} onChange={(event) => setConfirmText(event.target.value.toUpperCase())} placeholder="IMPORTAR" autoFocus />
          <DialogFooter><Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancelar</Button><Button onClick={() => { setConfirmOpen(false); onConfirm(); }} disabled={confirmText !== 'IMPORTAR'}>Confirmar importación</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <ImportProgressOverlay open={importing} progress={progress} title="Importando empleados" description="Guardando las filas válidas y conservando el detalle de las incidencias." />

      <Dialog open={result !== null} onOpenChange={(open) => { if (!open) onDone(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><div className="flex flex-col items-center gap-3 py-3 text-center"><div className="flex size-20 animate-in zoom-in items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 duration-500"><CheckCircle2 className="size-12 animate-pulse" /></div><DialogTitle className="text-xl">Importación procesada</DialogTitle><DialogDescription>Los empleados válidos ya fueron registrados. Puedes volver a importar otro archivo cuando quieras.</DialogDescription></div></DialogHeader>
          <div className="grid grid-cols-3 gap-2 text-center"><div className="rounded-xl border bg-muted/20 p-3"><p className="text-2xl font-black text-emerald-500">{result?.created || 0}</p><p className="text-[10px] uppercase text-muted-foreground">Creados</p></div><div className="rounded-xl border bg-muted/20 p-3"><p className="text-2xl font-black text-amber-500">{result?.warnings.length || 0}</p><p className="text-[10px] uppercase text-muted-foreground">Avisos</p></div><div className="rounded-xl border bg-muted/20 p-3"><p className="text-2xl font-black text-rose-500">{result?.skipped || 0}</p><p className="text-[10px] uppercase text-muted-foreground">Omitidos</p></div></div>
          {(result?.errors.length || result?.warnings.length) ? <div className="max-h-40 overflow-auto rounded-xl border p-3 text-xs text-muted-foreground"><p className="font-bold text-foreground">Detalles</p>{[...(result?.errors || []), ...(result?.warnings || [])].slice(0, 10).map((item, index) => <p key={index} className="mt-1">• {typeof item === 'string' ? item : `Fila ${item.row || '?'}${item.employeeNumber ? ` (${item.employeeNumber})` : ''}: ${item.message}`}</p>)}</div> : null}
          <DialogFooter className="flex-wrap sm:justify-between">
            {result?.errors.length ? <Button type="button" variant="outline" onClick={onDownloadErrors}><Download className="size-4" /> Descargar errores</Button> : null}
            <Button className="w-full sm:w-auto" onClick={onDone}>Continuar a empleados</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={departmentRowIndex !== null} onOpenChange={(open) => { if (!open && !savingCatalog) { setDepartmentRowIndex(null); setDepartmentName(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Building2 className="size-5 text-primary" /> Crear departamento</DialogTitle><DialogDescription>Se creará el departamento y se asignará automáticamente a esta fila de importación.</DialogDescription></DialogHeader>
          <Input value={departmentName} onChange={(event) => setDepartmentName(event.target.value)} placeholder="Ej. Ventas, Marketing..." disabled={savingCatalog} />
          <DialogFooter><Button variant="outline" onClick={() => setDepartmentRowIndex(null)} disabled={savingCatalog}>Cancelar</Button><Button onClick={async () => { if (departmentRowIndex === null || !departmentName.trim()) return; setSavingCatalog(true); try { await onCreateDepartment(departmentRowIndex, departmentName.trim()); setDepartmentRowIndex(null); setDepartmentName(''); } finally { setSavingCatalog(false); } }} disabled={savingCatalog || !departmentName.trim()}>{savingCatalog ? 'Creando...' : 'Crear departamento'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={positionRowIndex !== null} onOpenChange={(open) => { if (!open && !savingCatalog) { setPositionRowIndex(null); setPositionTitle(''); setPositionDepartmentId(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Briefcase className="size-5 text-primary" /> Crear puesto</DialogTitle><DialogDescription>El puesto quedará relacionado al departamento de esta fila.</DialogDescription></DialogHeader>
          <div className="space-y-3"><Input value={positionTitle} onChange={(event) => setPositionTitle(event.target.value)} placeholder="Ej. Ejecutivo de ventas" disabled={savingCatalog} /><div className="rounded-lg border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">Departamento: <span className="font-bold text-foreground">{departments.find((department: any) => String(department.id) === String(positionDepartmentId))?.name || 'Seleccionado en la fila'}</span></div></div>
          <DialogFooter><Button variant="outline" onClick={() => setPositionRowIndex(null)} disabled={savingCatalog}>Cancelar</Button><Button onClick={async () => { if (positionRowIndex === null || !positionTitle.trim() || !positionDepartmentId) return; setSavingCatalog(true); try { await onCreatePosition(positionRowIndex, positionTitle.trim(), positionDepartmentId); setPositionRowIndex(null); setPositionTitle(''); setPositionDepartmentId(''); } finally { setSavingCatalog(false); } }} disabled={savingCatalog || !positionTitle.trim() || !positionDepartmentId}>{savingCatalog ? 'Creando...' : 'Crear puesto'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

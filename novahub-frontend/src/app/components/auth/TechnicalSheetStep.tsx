import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, FileText, Info, CheckCircle2 } from 'lucide-react';
import { cn } from '../ui/utils';
import { Input } from '../ui/input';
import { safeSetItem } from '../../services/safe-storage';

export interface TechnicalSheetPrefill {
  companyName: string;
  userName: string;
  email: string;
  whatsappNumber: string;
  cargo: string;
  industry: string;
}

interface FProps { label: string; value: any; onChange: (v: any) => void; placeholder?: string; type?: string; wide?: boolean }
interface RProps { options: { v: string; l: string }[]; value: string; onChange: (v: string) => void }
interface PProps { options: string[]; value: string[]; onChange: (v: string[]) => void }
interface TProps { value: string; onChange: (v: string) => void }
interface GridProps {
  headers: string[];
  rows: any[];
  onRow: (i: number, key: string, v: any) => void;
  widths?: string[];
  textKeys?: string[];
  numKeys?: string[];
  boolKeys?: string[];
}

const SINO: RProps['options'] = [{ v: 'Sí', l: 'Sí' }, { v: 'No', l: 'No' }];
const NOA = [{ v: 'Sí', l: 'Sí' }, { v: 'No', l: 'No' }, { v: 'Algunas', l: 'Algunas' }];
const PARCIAL = [{ v: 'Sí', l: 'Sí' }, { v: 'No', l: 'No' }, { v: 'Parcial', l: 'Parcial' }];

function Sec({ n, title, subtitle, open, onToggle, missing, children }: { n: string; title: string; subtitle?: string; open: boolean; onToggle: () => void; missing?: number; children: React.ReactNode }) {
  return (
    <div className={cn('rounded-2xl border transition-all', open ? 'border-primary/40 bg-white/5 shadow-sm' : 'border-border/40 bg-white/2')}>
      <button type="button" onClick={onToggle} className="w-full flex items-center gap-3 p-4 text-left cursor-pointer hover:bg-muted/20 rounded-2xl transition-colors">
        <span className="size-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-[10px] font-black shrink-0">{n}</span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-black leading-tight">{title}</span>
          {subtitle && <span className="block text-[10px] text-muted-foreground mt-0.5 leading-tight">{subtitle}</span>}
        </span>
        {missing !== undefined && missing > 0 && (
          <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-[9px] font-black text-destructive border border-destructive/20">
            Faltan {missing} campos
          </span>
        )}
        {missing !== undefined && missing === 0 && (
          <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-black text-emerald-600 border border-emerald-500/20">
            ✓ Completa
          </span>
        )}
        <ChevronDown className={cn('size-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </div>
  );
}

function F({ label, value, onChange, placeholder, type = 'text', wide }: FProps) {
  return (
    <div className={cn(wide && 'sm:col-span-2')}>
      <label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1 block mb-1">{label}</label>
      <Input value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} type={type}
        className="h-9 rounded-lg bg-white/5 border-white/10 text-xs" />
    </div>
  );
}

function R({ options, value, onChange }: RProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button key={o.v} type="button" onClick={() => onChange(o.v)}
          className={cn('px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer',
            value === o.v ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-white/5 border-border/40 text-muted-foreground hover:border-primary/50')}>
          {o.l}
        </button>
      ))}
    </div>
  );
}

function T({ value, onChange }: TProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <button type="button" onClick={() => onChange('Sí')}
        className={cn('px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer',
          value === 'Sí' ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-white/5 border-border/40 text-muted-foreground hover:border-emerald-500/50')}>
        Sí
      </button>
      <button type="button" onClick={() => onChange('No')}
        className={cn('px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer',
          value === 'No' ? 'bg-destructive text-white border-destructive shadow-sm' : 'bg-white/5 border-border/40 text-muted-foreground hover:border-destructive/50')}>
        No
      </button>
    </div>
  );
}

function P({ options, value, onChange }: PProps) {
  const toggle = (o: string) => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o]);
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button key={o} type="button" onClick={() => toggle(o)}
          className={cn('px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer',
            value.includes(o) ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-white/5 border-border/40 text-muted-foreground hover:border-primary/50')}>
          {value.includes(o) ? '✓ ' : ''}{o}
        </button>
      ))}
    </div>
  );
}

function Grid({ headers, rows, onRow, widths, textKeys = [], numKeys = [], boolKeys = [] }: GridProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border/40">
      <table className="w-full text-xs min-w-[560px]">
        <thead>
          <tr className="bg-muted/40">
            {headers.map((h, i) => (
              <th key={h} className={cn('text-left p-2 text-[10px] uppercase font-black tracking-widest text-muted-foreground', widths?.[i] && `w-[${widths[i]}]`)}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-border/30">
              {textKeys.map((k) => (
                <td key={k} className="p-1.5">
                  <Input value={row[k] ?? ''} onChange={(e) => onRow(i, k, e.target.value)}
                    placeholder={k === 'concepto' || k === 'rol' || k === 'variable' || k === 'info' || k === 'componente' ? row[k] : ''}
                    className={cn('h-8 rounded-md bg-white/5 border-transparent text-xs', (k === 'concepto' || k === 'rol' || k === 'variable' || k === 'info' || k === 'componente') && 'font-bold bg-transparent')} />
                </td>
              ))}
              {numKeys.map((k) => (
                <td key={k} className="p-1.5">
                  <Input value={row[k] ?? ''} onChange={(e) => onRow(i, k, e.target.value)} type="number"
                    className="h-8 rounded-md bg-white/5 border-transparent text-xs text-right" />
                </td>
              ))}
              {boolKeys.map((k) => (
                <td key={k} className="p-1.5">
                  <T value={row[k] ?? ''} onChange={(v) => onRow(i, k, v)} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const GRID_NOTE = 'Haz clic en cada celda para editar. Usa los campos vacíos para agregar filas nuevas.';

function SectionNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-[10px] text-muted-foreground leading-relaxed">
      <Info className="size-3 shrink-0 mt-0.5 text-primary/70" /> {children}
    </p>
  );
}

const USUARIOS_DEFAULT = [
  'Propietario / Gerencia', 'Administración', 'Ventas / Caja', 'Compras', 'Inventario / Bodega',
  'Finanzas', 'Contabilidad', 'Recursos Humanos', 'Consulta / Auditoría',
].map((r) => ({ rol: r, cantidad: '', sucursal: '', nivel: '' }));

const ESTRUCTURA_DEFAULT = [
  'Empresas legalmente independientes', 'Sucursales / puntos de operación', 'Bodegas / almacenes',
  'Cajas / puntos de venta', 'Usuarios con acceso al ERP', 'Usuarios simultáneos estimados',
].map((c) => ({ concepto: c, cantidad: '', proyeccion: '', observaciones: '' }));

const MODULOS_DEFAULT = [
  'Ventas, clientes, cotizaciones y facturación', 'Compras y proveedores', 'Inventario, bodegas y movimientos',
  'Finanzas, CxC, CxP, caja y bancos', 'Reportes operativos y gerenciales', 'Contabilidad integrada',
  'Recursos Humanos', 'Nómina', 'Documentos / almacenamiento Nova Cloud', 'Multiempresa / dashboard consolidado',
  'Integraciones o desarrollos especiales',
].map((m) => ({ modulo: m, opcion: '' }));

const VOLUMEN_DEFAULT = [
  'Productos activos / SKU', 'Clientes registrados', 'Proveedores registrados', 'Ventas o facturas mensuales',
  'Compras mensuales', 'Movimientos de inventario mensuales', 'Documentos o archivos almacenados',
].map((v) => ({ variable: v, actual: '', proyeccion: '', origen: '' }));

const CARGA_DEFAULT = [
  'Productos y precios', 'Existencias iniciales', 'Clientes', 'Proveedores', 'CxC abiertas', 'CxP abiertas',
  'Plan de cuentas y saldos', 'Trabajadores activos', 'Historial de transacciones', 'Documentos adjuntos',
].map((i) => ({ info: i, deseaCargar: '', cantidad: '', estado: '' }));

const RESULTADO_DEFAULT = [
  'Nova Gestion', 'Contabilidad', 'Recursos Humanos / Nomina', 'Usuarios adicionales', 'Sucursales adicionales',
  'Empresas adicionales', 'Almacenamiento / Nova Cloud', 'Soporte prioritario',
].map((c) => ({ componente: c, seleccion: '', precioMensual: '', precioAnual: '' }));

const IMPL_DEFAULT = [
  'Implementación base', 'Configuración contable', 'Configuración de RR. HH. / nómina', 'Sucursal adicional',
  'Empresa adicional', 'Carga inicial adicional', 'Migración histórica', 'Capacitación adicional',
  'Integración / personalización',
].map((c) => ({ componente: c, aplica: '', monto: '', obs: '' }));

function defaultSheet(p: TechnicalSheetPrefill): any {
  return {
    id: { fecha: new Date().toISOString().slice(0, 10), codigoOportunidad: '', quienCompleta: 'Cliente', ejecutivoResponsable: '', codigoReferido: '' },
    general: {
      nombreComercial: p.companyName || '', razonSocial: '', ruc: '', paisCiudad: '', rubroPrincipal: p.industry || '',
      añosOperacion: '', nombreContacto: p.userName || '', cargo: p.cargo || '', telefonoWhatsapp: p.whatsappNumber || '',
      correo: p.email || '', sitioWeb: '', fechaInicioDeseada: '', adminActual: '', sistemaActual: '', principalProblema: '',
    },
    estructura: { rows: ESTRUCTURA_DEFAULT, mismaRazonSocial: '', inventarioSeparado: '', cajaPropia: '', multiempresa: '', reportesConsolidados: '' },
    usuarios: { rows: USUARIOS_DEFAULT },
    modulos: { rows: MODULOS_DEFAULT, procesosInicio: '', procesosSegunda: '' },
    volumen: { rows: VOLUMEN_DEFAULT, temporadas: '', temporadasDetalle: '', importacionesMasivas: '', ecommerce: '', ecommerceDetalle: '' },
    contabilidad: {
      tipoContador: '', empresasContabilidad: '', planCuentas: '', saldosConciliados: '', inicioContable: '', monedas: '',
      necesidades: [], contabilidadSucursal: '', impuestos: '', impuestosDetalle: '', inicioTipo: '', contadorParticipa: '',
    },
    rrhh: {
      trabajadoresActivos: '', proyeccion12: '', frecuenciaNomina: '', centrosTrabajo: '', tiposSalario: '', usuariosRRHH: '',
      procesos: [], otros: [], importarExpedientes: '',
    },
    carga: {
      comenzarCero: '', fuente: '', plataformaOrigen: '', rows: CARGA_DEFAULT, añosHistorial: '',
      puedeExportar: '', responsableDepuracion: '', fechaCorte: '',
    },
    integraciones: { conectividad: '', dispositivos: [], equipos: [], integraciones: [], detalle: '' },
    implementacion: {
      personasACapacitar: '', numeroGrupos: '', modalidad: '', ciudad: '', disponibilidad: '', fechaSalida: '',
      responsable: '', cargo: '', tipo: '', acompañamiento: '', capacitacionAdicional: '', restricciones: '',
    },
    soporte: { nivel: '', canal: '', presencial: '', servicios: [], comentarios: '' },
    comercial: {
      origen: '', interes: '', presupuesto: '', fechaDecision: '', personaDecide: '', competidor: '',
      proximoSeguimiento: '', estado: '', motivo: '', objeciones: '', observaciones: '',
    },
    resultado: { rows: RESULTADO_DEFAULT, impl: IMPL_DEFAULT, clasificacion: '', validacion: '', totalPrimerAnio: '', renovacion: '', responsable: '', fechaValidacion: '' },
    confirmacion: { declaracion: true, nombreFirma: '', fecha: new Date().toISOString().slice(0, 10), nombreEjecutivo: '', firma: '' },
  };
}

export function TechnicalSheetStep({ prefill, onData }: { prefill: TechnicalSheetPrefill; onData: (sheet: any) => void }) {
  const [sheet, setSheet] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('nova-technical-sheet');
      if (saved) return { ...defaultSheet(prefill), ...JSON.parse(saved) };
    } catch {}
    return defaultSheet(prefill);
  });
  const [open, setOpen] = useState<string>('id');
  const [savedFlash, setSavedFlash] = useState(false);

  const set = (section: string, key: string, v: any) =>
    setSheet((s: any) => ({ ...s, [section]: { ...s[section], [key]: v } }));

  const setRow = (section: string, i: number, key: string, v: any) =>
    setSheet((s: any) => {
      const rows = s[section].rows.map((r: any, idx: number) => (idx === i ? { ...r, [key]: v } : r));
      return { ...s, [section]: { ...s[section], rows } };
    });

  const toggleSec = (id: string) => setOpen(open === id ? '' : id);
  const required = useMemo(() => {
    const missing: Record<string, number> = {};
    const add = (key: string, count: number) => { if (count > 0) missing[key] = (missing[key] || 0) + count; };

    let g = 0;
    if (!String(sheet.general.razonSocial || '').trim()) g++;
    if (!String(sheet.general.ruc || '').trim()) g++;
    if (!String(sheet.general.paisCiudad || '').trim()) g++;
    if (!String(sheet.general.rubroPrincipal || '').trim()) g++;
    add('general', g);

    let e = 0;
    for (const row of sheet.estructura.rows || []) {
      if (['Sucursales / puntos de operación', 'Bodegas / almacenes', 'Cajas / puntos de venta', 'Usuarios con acceso al ERP', 'Usuarios simultáneos estimados'].includes(row.concepto) && !String(row.cantidad || '').trim()) e++;
    }
    for (const k of ['mismaRazonSocial', 'inventarioSeparado', 'cajaPropia', 'multiempresa', 'reportesConsolidados']) {
      if (!sheet.estructura[k]) e++;
    }
    add('estructura', e);

    let u = 0;
    for (const row of sheet.usuarios.rows || []) {
      if (!String(row.cantidad || '').trim()) u++;
    }
    add('usuarios', u);

    let v = 0;
    for (const row of sheet.volumen.rows || []) {
      if (!String(row.actual || '').trim()) v++;
    }
    add('volumen', v);

    let c = 0;
    if (!sheet.carga.comenzarCero) c++;
    if (!sheet.carga.fuente) c++;
    add('carga', c);

    let cf = 0;
    if (!sheet.confirmacion.declaracion) cf++;
    if (!String(sheet.confirmacion.nombreFirma || '').trim()) cf++;
    if (!String(sheet.confirmacion.fecha || '').trim()) cf++;
    add('confirmacion', cf);

    return missing;
  }, [sheet]);
  const missingTotal = useMemo(() => Object.values(required).reduce((a, b) => a + b, 0), [required]);
  const requiredComplete = missingTotal === 0;

  useEffect(() => {
    const timer = setTimeout(() => {
      safeSetItem('nova-technical-sheet', JSON.stringify(sheet));
      onData({ ...sheet, _requiredComplete: requiredComplete });
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1200);
    }, 400);
    return () => clearTimeout(timer);
  }, [sheet, requiredComplete]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <FileText className="size-4 text-emerald-600 shrink-0" />
          <div>
            <p className="text-xs font-black text-emerald-700 dark:text-emerald-400 leading-tight">Ficha de Diagnóstico y Precalificación</p>
            <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">Nova ERP · Objetivo: conocer tu operación para recomendar la configuración adecuada.</p>
          </div>
        </div>
        <span className={cn('text-[10px] font-black flex items-center gap-1 shrink-0 transition-opacity', savedFlash ? 'text-emerald-600 opacity-100' : 'opacity-0')}>
          <CheckCircle2 className="size-3.5" /> Guardado
        </span>
      </div>

      <div className={cn(
        'rounded-2xl border px-4 py-3 text-[11px] leading-relaxed',
        requiredComplete ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
      )}>
        {requiredComplete ? (
          <>¡Ficha completa! Todos los campos obligatorios están llenos. Podés continuar.</>
        ) : (
          <><strong>Faltan {missingTotal} campos obligatorios</strong> para continuar (marcados en rojo en cada sección). Las secciones sin badge pueden dejarse opcionales.</>
        )}
      </div>

      <Sec n="1" title="Identificación del diagnóstico" open={open === 'id'} onToggle={() => toggleSec('id')}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <F label="Fecha" value={sheet.id.fecha} onChange={(v) => set('id', 'fecha', v)} type="date" />
          <F label="Código de oportunidad" value={sheet.id.codigoOportunidad} onChange={(v) => set('id', 'codigoOportunidad', v)} />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1 block">¿Quién completa?</label>
          <R options={[{ v: 'Cliente', l: 'Cliente' }, { v: 'Ejecutivo Nova', l: 'Ejecutivo Nova' }, { v: 'Distribuidor autorizado', l: 'Distribuidor' }, { v: 'Otro', l: 'Otro' }]}
            value={sheet.id.quienCompleta} onChange={(v) => set('id', 'quienCompleta', v)} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <F label="Ejecutivo o distribuidor responsable" value={sheet.id.ejecutivoResponsable} onChange={(v) => set('id', 'ejecutivoResponsable', v)} />
          <F label="Código de referido / campaña" value={sheet.id.codigoReferido} onChange={(v) => set('id', 'codigoReferido', v)} />
        </div>
      </Sec>

      <Sec n="2" title="Datos generales de la empresa" open={open === 'general'} onToggle={() => toggleSec('general')} missing={required.general || 0}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <F label="Nombre comercial" value={sheet.general.nombreComercial} onChange={(v) => set('general', 'nombreComercial', v)} />
          <F label="Razón social" value={sheet.general.razonSocial} onChange={(v) => set('general', 'razonSocial', v)} />
          <F label="RUC / identificación tributaria" value={sheet.general.ruc} onChange={(v) => set('general', 'ruc', v)} />
          <F label="País y ciudad" value={sheet.general.paisCiudad} onChange={(v) => set('general', 'paisCiudad', v)} />
          <F label="Rubro principal" value={sheet.general.rubroPrincipal} onChange={(v) => set('general', 'rubroPrincipal', v)} />
          <F label="Años de operación" value={sheet.general.añosOperacion} onChange={(v) => set('general', 'añosOperacion', v)} type="number" />
          <F label="Nombre del contacto" value={sheet.general.nombreContacto} onChange={(v) => set('general', 'nombreContacto', v)} />
          <F label="Cargo" value={sheet.general.cargo} onChange={(v) => set('general', 'cargo', v)} />
          <F label="Teléfono / WhatsApp" value={sheet.general.telefonoWhatsapp} onChange={(v) => set('general', 'telefonoWhatsapp', v)} />
          <F label="Correo electrónico" value={sheet.general.correo} onChange={(v) => set('general', 'correo', v)} />
          <F label="Sitio web o redes sociales" value={sheet.general.sitioWeb} onChange={(v) => set('general', 'sitioWeb', v)} />
          <F label="Fecha deseada de inicio" value={sheet.general.fechaInicioDeseada} onChange={(v) => set('general', 'fechaInicioDeseada', v)} type="date" />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1 block">¿Cómo administra actualmente su operación?</label>
          <R options={[{ v: 'Cuadernos', l: 'Cuadernos' }, { v: 'Excel', l: 'Excel' }, { v: 'Otro ERP', l: 'Otro ERP' }, { v: 'Software contable', l: 'Software contable' }, { v: 'Combinación', l: 'Combinación' }]}
            value={sheet.general.adminActual} onChange={(v) => set('general', 'adminActual', v)} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <F label="Nombre del sistema actual, si aplica" value={sheet.general.sistemaActual} onChange={(v) => set('general', 'sistemaActual', v)} />
          <F label="Principal problema que desea resolver con Nova" value={sheet.general.principalProblema} onChange={(v) => set('general', 'principalProblema', v)} wide />
        </div>
      </Sec>

      <Sec n="3" title="Estructura empresarial y operativa" open={open === 'estructura'} onToggle={() => toggleSec('estructura')} missing={required.estructura || 0}>
        <Grid headers={['Concepto', 'Cantidad actual', 'Proyección 12 meses', 'Observaciones']}
          rows={sheet.estructura.rows} onRow={(i, k, v) => setRow('estructura', i, k, v)}
          textKeys={['concepto']} numKeys={['cantidad', 'proyeccion']} widths={['40%', '18%', '20%', '22%']} />
        <SectionNote>{GRID_NOTE}</SectionNote>
        {[
          { k: 'mismaRazonSocial', l: '¿Las sucursales pertenecen a la misma razón social?' },
          { k: 'inventarioSeparado', l: '¿Cada sucursal manejará inventario separado?' },
          { k: 'cajaPropia', l: '¿Cada sucursal manejará caja o bancos propios?' },
          { k: 'multiempresa', l: '¿El propietario necesita visualizar varias empresas desde un mismo acceso?' },
          { k: 'reportesConsolidados', l: '¿Necesita reportes consolidados y también individuales por empresa o sucursal?' },
        ].map((q) => (
          <div key={q.k} className="space-y-1">
            <label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1 block">{q.l}</label>
            <R options={q.k === 'mismaRazonSocial' ? NOA : SINO} value={sheet.estructura[q.k]} onChange={(v) => set('estructura', q.k, v)} />
          </div>
        ))}
      </Sec>

      <Sec n="4" title="Usuarios y roles requeridos" open={open === 'usuarios'} onToggle={() => toggleSec('usuarios')} missing={required.usuarios || 0}>
        <Grid headers={['Rol o área', 'Cantidad', 'Sucursal/empresa', 'Nivel de acceso requerido']}
          rows={sheet.usuarios.rows} onRow={(i, k, v) => setRow('usuarios', i, k, v)}
          textKeys={['rol']} numKeys={['cantidad']} widths={['34%', '14%', '26%', '26%']} />
        <SectionNote>Trabajador no significa usuario. Un colaborador puede estar en Recursos Humanos sin acceso al ERP.</SectionNote>
      </Sec>

      <Sec n="5" title="Módulos y necesidades funcionales" open={open === 'modulos'} onToggle={() => toggleSec('modulos')}>
        <div className="rounded-xl border border-border/40 overflow-x-auto">
          <table className="w-full text-xs min-w-[560px]">
            <thead>
              <tr className="bg-muted/40">
                <th className="text-left p-2 text-[10px] uppercase font-black tracking-widest text-muted-foreground w-1/2">Módulo / capacidad</th>
                <th className="text-left p-2 text-[10px] uppercase font-black tracking-widest text-muted-foreground">Necesario al iniciar</th>
                <th className="text-left p-2 text-[10px] uppercase font-black tracking-widest text-muted-foreground">Posteriormente</th>
                <th className="text-left p-2 text-[10px] uppercase font-black tracking-widest text-muted-foreground">No aplica</th>
              </tr>
            </thead>
            <tbody>
              {sheet.modulos.rows.map((row: any, i: number) => (
                <tr key={i} className="border-t border-border/30">
                  <td className="p-2 font-bold text-[11px]">{row.modulo}</td>
                  {['inicio', 'posterior', 'noAplica'].map((opt) => (
                    <td key={opt} className="p-2">
                      <button type="button" onClick={() => setRow('modulos', i, 'opcion', row.opcion === opt ? '' : opt)}
                        className={cn('size-5 rounded-md border transition-all cursor-pointer',
                          row.opcion === opt ? 'bg-primary border-primary shadow-sm' : 'border-border/50 bg-white/5 hover:border-primary/50')}>
                        {row.opcion === opt && <span className="text-[10px] text-primary-foreground flex items-center justify-center">✓</span>}
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <F label="Procesos indispensables para comenzar" value={sheet.modulos.procesosInicio} onChange={(v) => set('modulos', 'procesosInicio', v)} wide={false} />
          <F label="Procesos que pueden ir en una segunda etapa" value={sheet.modulos.procesosSegunda} onChange={(v) => set('modulos', 'procesosSegunda', v)} />
        </div>
      </Sec>

      <Sec n="6" title="Volumen actual y crecimiento esperado" open={open === 'volumen'} onToggle={() => toggleSec('volumen')} missing={required.volumen || 0}>
        <Grid headers={['Variable', 'Actual', 'Proyección 12 meses', 'Origen del dato']}
          rows={sheet.volumen.rows} onRow={(i, k, v) => setRow('volumen', i, k, v)}
          textKeys={['variable', 'origen']} numKeys={['actual', 'proyeccion']} widths={['34%', '18%', '22%', '26%']} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1 block">¿Tiene temporadas de alto volumen?</label>
            <T value={sheet.volumen.temporadas} onChange={(v) => set('volumen', 'temporadas', v)} />
          </div>
          <F label="¿Cuáles?" value={sheet.volumen.temporadasDetalle} onChange={(v) => set('volumen', 'temporadasDetalle', v)} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1 block">¿Requiere importaciones masivas frecuentes?</label>
            <T value={sheet.volumen.importacionesMasivas} onChange={(v) => set('volumen', 'importacionesMasivas', v)} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1 block">¿Vende por comercio electrónico o marketplaces?</label>
            <T value={sheet.volumen.ecommerce} onChange={(v) => set('volumen', 'ecommerce', v)} />
          </div>
          <F label="Indique cuáles" value={sheet.volumen.ecommerceDetalle} onChange={(v) => set('volumen', 'ecommerceDetalle', v)} />
        </div>
      </Sec>

      <Sec n="7" title="Contabilidad" subtitle="Completar solo si fue seleccionada" open={open === 'contabilidad'} onToggle={() => toggleSec('contabilidad')}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1 block">Tipo de contador</label>
            <R options={[{ v: 'Interno', l: 'Interno' }, { v: 'Externo', l: 'Externo' }, { v: 'No definido', l: 'No definido' }]}
              value={sheet.contabilidad.tipoContador} onChange={(v) => set('contabilidad', 'tipoContador', v)} />
          </div>
          <F label="Cantidad de empresas con contabilidad" value={sheet.contabilidad.empresasContabilidad} onChange={(v) => set('contabilidad', 'empresasContabilidad', v)} type="number" />
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1 block">¿Tiene plan de cuentas actual?</label>
            <T value={sheet.contabilidad.planCuentas} onChange={(v) => set('contabilidad', 'planCuentas', v)} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1 block">¿Saldos iniciales conciliados?</label>
            <T value={sheet.contabilidad.saldosConciliados} onChange={(v) => set('contabilidad', 'saldosConciliados', v)} />
          </div>
          <F label="Inicio contable deseado" value={sheet.contabilidad.inicioContable} onChange={(v) => set('contabilidad', 'inicioContable', v)} type="date" />
          <F label="Moneda(s)" value={sheet.contabilidad.monedas} onChange={(v) => set('contabilidad', 'monedas', v)} />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1 block">Necesidades</label>
          <P options={['Plan de cuentas', 'Libro diario', 'Libro mayor', 'Balance general', 'Estado de resultados', 'Centros de costos']}
            value={sheet.contabilidad.necesidades} onChange={(v) => set('contabilidad', 'necesidades', v)} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1 block">¿Contabilidad diferenciada por sucursal?</label>
            <T value={sheet.contabilidad.contabilidadSucursal} onChange={(v) => set('contabilidad', 'contabilidadSucursal', v)} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1 block">¿Maneja impuestos o retenciones especiales?</label>
            <T value={sheet.contabilidad.impuestos} onChange={(v) => set('contabilidad', 'impuestos', v)} />
          </div>
          <F label="Detalle de impuestos / retenciones" value={sheet.contabilidad.impuestosDetalle} onChange={(v) => set('contabilidad', 'impuestosDetalle', v)} />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1 block">¿Cómo desea iniciar?</label>
          <R options={[{ v: 'Saldos de apertura', l: 'Saldos de apertura' }, { v: 'Historial', l: 'Migrar períodos anteriores' }]}
            value={sheet.contabilidad.inicioTipo} onChange={(v) => set('contabilidad', 'inicioTipo', v)} />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1 block">¿El contador participará en la parametrización y validación?</label>
          <T value={sheet.contabilidad.contadorParticipa} onChange={(v) => set('contabilidad', 'contadorParticipa', v)} />
        </div>
      </Sec>

      <Sec n="8" title="Recursos Humanos y Nómina" subtitle="Completar solo si fue seleccionado" open={open === 'rrhh'} onToggle={() => toggleSec('rrhh')}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <F label="Trabajadores activos" value={sheet.rrhh.trabajadoresActivos} onChange={(v) => set('rrhh', 'trabajadoresActivos', v)} type="number" />
          <F label="Proyección 12 meses" value={sheet.rrhh.proyeccion12} onChange={(v) => set('rrhh', 'proyeccion12', v)} type="number" />
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1 block">Frecuencia de nómina</label>
            <R options={[{ v: 'Semanal', l: 'Semanal' }, { v: 'Quincenal', l: 'Quincenal' }, { v: 'Mensual', l: 'Mensual' }]}
              value={sheet.rrhh.frecuenciaNomina} onChange={(v) => set('rrhh', 'frecuenciaNomina', v)} />
          </div>
          <F label="Centros de trabajo" value={sheet.rrhh.centrosTrabajo} onChange={(v) => set('rrhh', 'centrosTrabajo', v)} type="number" />
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1 block">Tipos de salario</label>
            <P options={['Fijo', 'Variable', 'Mixto']} value={Array.isArray(sheet.rrhh.tiposSalario) ? sheet.rrhh.tiposSalario : []} onChange={(v) => set('rrhh', 'tiposSalario', v)} />
          </div>
          <F label="Usuarios de RR. HH." value={sheet.rrhh.usuariosRRHH} onChange={(v) => set('rrhh', 'usuariosRRHH', v)} type="number" />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1 block">Procesos requeridos</label>
          <P options={['Expedientes', 'Contratos', 'Asistencia', 'Vacaciones', 'Permisos', 'Horas extra']}
            value={sheet.rrhh.procesos} onChange={(v) => set('rrhh', 'procesos', v)} />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1 block">Otros procesos</label>
          <P options={['Comisiones', 'Bonos', 'Deducciones', 'Anticipos/préstamos', 'Historial de nómina']}
            value={sheet.rrhh.otros} onChange={(v) => set('rrhh', 'otros', v)} />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1 block">¿Requiere importar expedientes o saldos pendientes?</label>
          <T value={sheet.rrhh.importarExpedientes} onChange={(v) => set('rrhh', 'importarExpedientes', v)} />
        </div>
      </Sec>

      <Sec n="9" title="Carga inicial y migración de datos" open={open === 'carga'} onToggle={() => toggleSec('carga')} missing={required.carga || 0}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1 block">¿Comenzará desde cero?</label>
            <T value={sheet.carga.comenzarCero} onChange={(v) => set('carga', 'comenzarCero', v)} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1 block">Fuente de la información</label>
            <R options={[{ v: 'Excel/CSV', l: 'Excel/CSV' }, { v: 'Otro ERP', l: 'Otro ERP' }, { v: 'Sistema contable', l: 'Sistema contable' }, { v: 'Archivos físicos', l: 'Archivos físicos' }, { v: 'Varias fuentes', l: 'Varias' }]}
              value={sheet.carga.fuente} onChange={(v) => set('carga', 'fuente', v)} />
          </div>
          <F label="Plataforma o sistema de origen" value={sheet.carga.plataformaOrigen} onChange={(v) => set('carga', 'plataformaOrigen', v)} />
        </div>
        <Grid headers={['Información', 'Desea cargar', 'Cantidad estimada', 'Estado de los datos']}
          rows={sheet.carga.rows} onRow={(i, k, v) => setRow('carga', i, k, v)}
          textKeys={['info']} numKeys={['cantidad']} boolKeys={['deseaCargar']} widths={['36%', '16%', '20%', '28%']} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <F label="Cantidad de años de historial solicitados" value={sheet.carga.añosHistorial} onChange={(v) => set('carga', 'añosHistorial', v)} type="number" />
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1 block">¿El cliente puede exportar la información?</label>
            <R options={[{ v: 'Sí', l: 'Sí' }, { v: 'No', l: 'No' }, { v: 'Por validar', l: 'Por validar' }]}
              value={sheet.carga.puedeExportar} onChange={(v) => set('carga', 'puedeExportar', v)} />
          </div>
          <F label="Responsable de depurar y validar los datos" value={sheet.carga.responsableDepuracion} onChange={(v) => set('carga', 'responsableDepuracion', v)} />
          <F label="Fecha de corte para la información" value={sheet.carga.fechaCorte} onChange={(v) => set('carga', 'fechaCorte', v)} type="date" />
        </div>
        <SectionNote>La implementación estándar puede incluir una carga inicial mediante plantillas de Nova. La limpieza, digitación, transformación, reconstrucción contable y migración histórica se validan y cotizan por separado.</SectionNote>
      </Sec>

      <Sec n="10" title="Integraciones, equipos y conectividad" open={open === 'integraciones'} onToggle={() => toggleSec('integraciones')}>
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1 block">Conectividad estable en las instalaciones</label>
          <R options={PARCIAL} value={sheet.integraciones.conectividad} onChange={(v) => set('integraciones', 'conectividad', v)} />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1 block">Dispositivos que utilizarán Nova</label>
          <P options={['Computadoras', 'Laptops', 'Tablets', 'Celulares']} value={sheet.integraciones.dispositivos} onChange={(v) => set('integraciones', 'dispositivos', v)} />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1 block">Equipos requeridos</label>
          <P options={['Impresora térmica', 'Lector de código de barras', 'Gaveta de dinero', 'Biométrico', 'Otro']}
            value={sheet.integraciones.equipos} onChange={(v) => set('integraciones', 'equipos', v)} />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1 block">Integraciones</label>
          <P options={['E-commerce', 'Pasarela de pago', 'Bancos', 'Facturación fiscal', 'API', 'Otra']}
            value={sheet.integraciones.integraciones} onChange={(v) => set('integraciones', 'integraciones', v)} />
        </div>
        <F label="Detalle de integración o equipo" value={sheet.integraciones.detalle} onChange={(v) => set('integraciones', 'detalle', v)} wide />
      </Sec>

      <Sec n="11" title="Implementación, capacitación y salida en vivo" open={open === 'implementacion'} onToggle={() => toggleSec('implementacion')}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <F label="Personas a capacitar" value={sheet.implementacion.personasACapacitar} onChange={(v) => set('implementacion', 'personasACapacitar', v)} type="number" />
          <F label="Número de grupos" value={sheet.implementacion.numeroGrupos} onChange={(v) => set('implementacion', 'numeroGrupos', v)} type="number" />
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1 block">Modalidad</label>
            <R options={[{ v: 'Remota', l: 'Remota' }, { v: 'Presencial', l: 'Presencial' }, { v: 'Mixta', l: 'Mixta' }]}
              value={sheet.implementacion.modalidad} onChange={(v) => set('implementacion', 'modalidad', v)} />
          </div>
          <F label="Ciudad de capacitación" value={sheet.implementacion.ciudad} onChange={(v) => set('implementacion', 'ciudad', v)} />
          <F label="Disponibilidad horaria" value={sheet.implementacion.disponibilidad} onChange={(v) => set('implementacion', 'disponibilidad', v)} />
          <F label="Fecha deseada de salida en vivo" value={sheet.implementacion.fechaSalida} onChange={(v) => set('implementacion', 'fechaSalida', v)} type="date" />
          <F label="Responsable interno del proyecto" value={sheet.implementacion.responsable} onChange={(v) => set('implementacion', 'responsable', v)} />
          <F label="Cargo" value={sheet.implementacion.cargo} onChange={(v) => set('implementacion', 'cargo', v)} />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1 block">¿Implementación completa o por etapas?</label>
          <R options={[{ v: 'Completa', l: 'Completa' }, { v: 'Por etapas', l: 'Por etapas' }]}
            value={sheet.implementacion.tipo} onChange={(v) => set('implementacion', 'tipo', v)} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1 block">¿Requiere acompañamiento el día de salida en vivo?</label>
            <T value={sheet.implementacion.acompañamiento} onChange={(v) => set('implementacion', 'acompañamiento', v)} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1 block">¿Requiere capacitación adicional posterior?</label>
            <T value={sheet.implementacion.capacitacionAdicional} onChange={(v) => set('implementacion', 'capacitacionAdicional', v)} />
          </div>
          <F label="Restricciones, fechas límite o dependencias" value={sheet.implementacion.restricciones} onChange={(v) => set('implementacion', 'restricciones', v)} wide />
        </div>
      </Sec>

      <Sec n="12" title="Soporte y servicios complementarios" open={open === 'soporte'} onToggle={() => toggleSec('soporte')}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1 block">Nivel requerido</label>
            <R options={[{ v: 'Estándar', l: 'Estándar' }, { v: 'Prioritario', l: 'Prioritario' }, { v: 'Por definir', l: 'Por definir' }]}
              value={sheet.soporte.nivel} onChange={(v) => set('soporte', 'nivel', v)} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1 block">Canal preferido</label>
            <R options={[{ v: 'Tickets', l: 'Tickets' }, { v: 'Correo', l: 'Correo' }, { v: 'WhatsApp', l: 'WhatsApp' }, { v: 'Llamada', l: 'Llamada' }]}
              value={sheet.soporte.canal} onChange={(v) => set('soporte', 'canal', v)} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1 block">¿Requiere atención presencial?</label>
            <T value={sheet.soporte.presencial} onChange={(v) => set('soporte', 'presencial', v)} />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1 block">Servicios de interés</label>
          <P options={['Financiamiento PyMES', 'Asesoría legal', 'Consultoría contable', 'Capacitación adicional']}
            value={sheet.soporte.servicios} onChange={(v) => set('soporte', 'servicios', v)} />
        </div>
        <F label="Comentarios sobre soporte o servicios" value={sheet.soporte.comentarios} onChange={(v) => set('soporte', 'comentarios', v)} wide />
      </Sec>

      <Sec n="13" title="Información comercial" subtitle="Uso exclusivo del ejecutivo / distribuidor" open={open === 'comercial'} onToggle={() => toggleSec('comercial')}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <F label="Origen del prospecto" value={sheet.comercial.origen} onChange={(v) => set('comercial', 'origen', v)} />
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1 block">Nivel de interés</label>
            <R options={[{ v: 'Alto', l: 'Alto' }, { v: 'Medio', l: 'Medio' }, { v: 'Bajo', l: 'Bajo' }]}
              value={sheet.comercial.interes} onChange={(v) => set('comercial', 'interes', v)} />
          </div>
          <F label="Presupuesto estimado" value={sheet.comercial.presupuesto} onChange={(v) => set('comercial', 'presupuesto', v)} />
          <F label="Fecha probable de decisión" value={sheet.comercial.fechaDecision} onChange={(v) => set('comercial', 'fechaDecision', v)} type="date" />
          <F label="Persona que decide" value={sheet.comercial.personaDecide} onChange={(v) => set('comercial', 'personaDecide', v)} />
          <F label="Competidor o sistema evaluado" value={sheet.comercial.competidor} onChange={(v) => set('comercial', 'competidor', v)} />
          <F label="Próximo seguimiento" value={sheet.comercial.proximoSeguimiento} onChange={(v) => set('comercial', 'proximoSeguimiento', v)} type="date" />
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1 block">Estado</label>
            <R options={[{ v: 'Nuevo', l: 'Nuevo' }, { v: 'Demo', l: 'Demo' }, { v: 'Validación', l: 'Validación' }, { v: 'Propuesta', l: 'Propuesta' }]}
              value={sheet.comercial.estado} onChange={(v) => set('comercial', 'estado', v)} />
          </div>
          <F label="Motivo principal de compra o cambio" value={sheet.comercial.motivo} onChange={(v) => set('comercial', 'motivo', v)} wide={false} />
          <F label="Objeciones o riesgos identificados" value={sheet.comercial.objeciones} onChange={(v) => set('comercial', 'objeciones', v)} />
          <F label="Observaciones comerciales" value={sheet.comercial.observaciones} onChange={(v) => set('comercial', 'observaciones', v)} />
        </div>
      </Sec>

      <Sec n="14" title="Resultado preliminar de Nova" subtitle="Uso interno" open={open === 'resultado'} onToggle={() => toggleSec('resultado')}>
        <Grid headers={['Componente', 'Selección / cantidad', 'Precio mensual', 'Precio anual']}
          rows={sheet.resultado.rows} onRow={(i, k, v) => setRow('resultado', i, k, v)}
          textKeys={['componente', 'seleccion']} numKeys={['precioMensual', 'precioAnual']} widths={['36%', '24%', '20%', '20%']} />
        <Grid headers={['Implementación', 'Aplica', 'Monto estimado', 'Observaciones']}
          rows={sheet.resultado.impl} onRow={(i, k, v) => setRow('resultado', i, k, v)}
          textKeys={['componente']} numKeys={['monto']} boolKeys={['aplica']} widths={['34%', '14%', '22%', '30%']} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1 block">Clasificación</label>
            <R options={[{ v: 'Estándar', l: 'Estándar' }, { v: 'Ampliada', l: 'Ampliada' }, { v: 'Personalizada', l: 'Personalizada' }]}
              value={sheet.resultado.clasificacion} onChange={(v) => set('resultado', 'clasificacion', v)} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1 block">¿Validación técnica requerida?</label>
            <T value={sheet.resultado.validacion} onChange={(v) => set('resultado', 'validacion', v)} />
          </div>
          <F label="Total estimado primer año" value={sheet.resultado.totalPrimerAnio} onChange={(v) => set('resultado', 'totalPrimerAnio', v)} />
          <F label="Renovación estimada" value={sheet.resultado.renovacion} onChange={(v) => set('resultado', 'renovacion', v)} />
          <F label="Responsable de validar" value={sheet.resultado.responsable} onChange={(v) => set('resultado', 'responsable', v)} />
          <F label="Fecha de validación" value={sheet.resultado.fechaValidacion} onChange={(v) => set('resultado', 'fechaValidacion', v)} type="date" />
        </div>
      </Sec>

      <Sec n="15" title="Confirmación de información" open={open === 'confirmacion'} onToggle={() => toggleSec('confirmacion')} missing={required.confirmacion || 0}>
        <label className="flex items-start gap-2.5 cursor-pointer rounded-xl border border-border/40 bg-white/5 p-3">
          <input type="checkbox" checked={sheet.confirmacion.declaracion} onChange={(e) => set('confirmacion', 'declaracion', e.target.checked)}
            className="mt-0.5 size-4 rounded border-white/20 bg-white/5 text-primary focus:ring-primary/30" />
          <span className="text-[11px] text-muted-foreground leading-relaxed">
            Declaro que la información proporcionada refleja razonablemente la operación y necesidades actuales de la empresa. Comprendo que la recomendación y los precios definitivos estarán sujetos a validación técnica, alcance de implementación, estado de los datos, integraciones y servicios adicionales.
          </span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <F label="Nombre y firma del cliente" value={sheet.confirmacion.nombreFirma} onChange={(v) => set('confirmacion', 'nombreFirma', v)} />
          <F label="Fecha" value={sheet.confirmacion.fecha} onChange={(v) => set('confirmacion', 'fecha', v)} type="date" />
          <F label="Nombre del ejecutivo / distribuidor" value={sheet.confirmacion.nombreEjecutivo} onChange={(v) => set('confirmacion', 'nombreEjecutivo', v)} />
          <F label="Firma" value={sheet.confirmacion.firma} onChange={(v) => set('confirmacion', 'firma', v)} />
        </div>
      </Sec>

      <p className="text-[10px] text-muted-foreground text-center pt-1">NOVA HUB ERP — Soluciones que crecen con su empresa</p>
    </div>
  );
}

export default TechnicalSheetStep;

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  ArrowLeft,
  ArrowDown,
  Building2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  GitBranch,
  Grid3x3,
  Hand,
  Link2,
  Maximize2,
  Minus,
  Plus,
  Search,
  ShieldAlert,
  UserRoundCheck,
  Users,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import { cn } from '../ui/utils';
import { hrService } from '../../services/hr.service';

interface OrgChartViewProps {
  tenantId: string;
  tenantName?: string;
  employees: any[];
  users: any[];
  onBack: () => void;
  onDataChange?: () => Promise<unknown> | void;
}

const DEPT_COLORS = [
  'from-sky-500 to-blue-600',
  'from-emerald-500 to-teal-600',
  'from-violet-500 to-purple-600',
  'from-rose-500 to-pink-600',
  'from-amber-500 to-orange-600',
  'from-cyan-500 to-sky-600',
  'from-fuchsia-500 to-pink-600',
  'from-lime-500 to-green-600',
  'from-indigo-500 to-blue-600',
  'from-red-500 to-rose-600',
];

const getEmployeeName = (employee: any) => `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || employee.employeeNumber || 'Empleado';

interface DragState {
  kind: 'pan' | 'node';
  startX: number;
  startY: number;
  origX: number;
  origY: number;
  origK: number;
  nodeId?: string;
  moved?: boolean;
}

export function OrgChartView({ tenantId, tenantName, employees, users, onBack, onDataChange }: OrgChartViewProps) {
  // ── Lienzo (pizarra) ─────────────────────────────────────────────
  const [transform, setTransform] = useState({ x: 60, y: 60, k: 0.85 });
  const [showGrid, setShowGrid] = useState(true);
  const [hiddenAreas, setHiddenAreas] = useState<Set<string>>(new Set());
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({});
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);

  // ── Datos ────────────────────────────────────────────────────────
  const [departments, setDepartments] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any | null>(null);
  const [newManagerId, setNewManagerId] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string | null>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([hrService.getDepartments(), hrService.getPositions()])
      .then(([depRes, posRes]: any[]) => {
        if (cancelled) return;
        setDepartments(Array.isArray(depRes) ? depRes : (depRes?.data || []));
        setPositions(Array.isArray(posRes) ? posRes : (posRes?.data || []));
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  // ── Modelo: personas ─────────────────────────────────────────────
  const allEmployees = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = (employees || []).filter((e: any) => e.employmentStatus === 'ACTIVE' || e.employmentStatus === undefined);
    if (!term) return list;
    return list.filter((e: any) => {
      const haystack = `${e.firstName || ''} ${e.lastName || ''} ${e.employeeNumber || ''} ${e.department?.name || ''} ${e.position?.title || ''}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [employees, search]);

  const effectiveManagerId = (employee: any) => (employee.id in drafts ? drafts[employee.id] : employee.managerId || null);

  // ── Modelo: áreas (departamentos reales + de empleados) ──────────
  const areas = useMemo(() => {
    const map = new Map<string, any>();
    departments.forEach((d: any) => map.set(d.id, { ...d, _source: 'department' }));
    allEmployees.forEach((e: any) => {
      if (!e.departmentId) return;
      if (map.has(e.departmentId)) return;
      map.set(e.departmentId, {
        id: e.departmentId,
        code: '',
        name: e.department?.name || 'Área sin nombre',
        managerId: null,
        parentId: null,
        budget: null,
        isSellerDepartment: false,
        _source: 'employee',
      });
    });
    return [...map.values()];
  }, [departments, allEmployees]);

  const employeesByArea = useMemo(() => {
    const map = new Map<string, any[]>();
    allEmployees.forEach((e: any) => {
      const key = e.departmentId || 'unassigned';
      const list = map.get(key) || [];
      list.push(e);
      map.set(key, list);
    });
    return map;
  }, [allEmployees]);

  const positionsByArea = useMemo(() => {
    const map = new Map<string, any[]>();
    positions.forEach((p: any) => {
      const key = p.departmentId;
      if (!key) return;
      const list = map.get(key) || [];
      list.push(p);
      map.set(key, list);
    });
    return map;
  }, [positions]);

  const colorByArea = useMemo(() => {
    const map = new Map<string, string>();
    [...areas]
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      .forEach((area, index) => map.set(area.id, DEPT_COLORS[index % DEPT_COLORS.length]));
    return map;
  }, [areas]);

  const areaColor = (areaId: string) => colorByArea.get(areaId) || 'from-slate-500 to-slate-600';

  const visibleAreas = areas.filter((area: any) => !hiddenAreas.has(area.id) || (employeesByArea.get(area.id) || []).length === 0 && false);

  // ── Layout automático (coordenadas del lienzo) ───────────────────
  const EMPLOYEE_W = 178;
  const EMPLOYEE_H = 96;
  const AREA_W = 232;
  const AREA_GAP = 36;
  const ROOT_H = 64;

  const rootNode = useMemo(() => ({
    id: 'root',
    x: 0,
    y: 0,
    label: tenantName || 'Gerencia de Empresas',
    subtitle: 'Empresa',
  }), [tenantName]);

  const areaLayout = useMemo(() => {
    const list: any[] = [];
    visibleAreas.forEach((area: any, index: number) => {
      const emps = employeesByArea.get(area.id) || [];
      const pos = positionsByArea.get(area.id) || [];
      const rows = Math.max(1, Math.ceil(emps.length / 1));
      const height = 64 + rows * (EMPLOYEE_H + 18) + (pos.length > 0 ? 44 : 8);
      list.push({
        area,
        x: index * (AREA_W + AREA_GAP),
        y: ROOT_H + 150,
        width: AREA_W,
        height,
        emps,
        positions: pos,
      });
    });
    return list;
  }, [visibleAreas, employeesByArea, positionsByArea]);

  const totalAreaWidth = Math.max(1, visibleAreas.length) * (AREA_W + AREA_GAP);

  const contentWidth = Math.max(900, totalAreaWidth);
  const contentHeight = Math.max(600, ROOT_H + 150 + Math.max(...areaLayout.map((a) => a.height), 200));

  // ── Eventos del lienzo (N8N-like) ────────────────────────────────
  const getPoint = (clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const onCanvasPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-node]')) return;
    const p = getPoint(e.clientX, e.clientY);
    dragRef.current = { kind: 'pan', startX: p.x, startY: p.y, origX: transform.x, origY: transform.y, origK: transform.k };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onCanvasPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const p = getPoint(e.clientX, e.clientY);
    if (drag.kind === 'pan') {
      setTransform((t) => ({ ...t, x: drag.origX + (p.x - drag.startX), y: drag.origY + (p.y - drag.startY) }));
    } else if (drag.kind === 'node' && drag.nodeId) {
      const ddx = (p.x - drag.startX) / transform.k;
      const ddy = (p.y - drag.startY) / transform.k;
      setNodePositions((current) => ({
        ...current,
        [drag.nodeId!]: { x: drag.origX + ddx, y: drag.origY + ddy },
      }));
    }
  };

  const onCanvasPointerUp = () => { dragRef.current = null; };
  const onCanvasPointerLeave = () => { dragRef.current = null; };

  const onCanvasWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const p = getPoint(e.clientX, e.clientY);
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    setTransform((t) => {
      const k2 = Math.min(2, Math.max(0.25, t.k * factor));
      const wx = (p.x - t.x) / t.k;
      const wy = (p.y - t.y) / t.k;
      return { k: k2, x: p.x - wx * k2, y: p.y - wy * k2 };
    });
  };

  const zoomBy = (factor: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const cx = rect ? rect.width / 2 : 0;
    const cy = rect ? rect.height / 2 : 0;
    setTransform((t) => {
      const k2 = Math.min(2, Math.max(0.25, t.k * factor));
      const wx = (cx - t.x) / t.k;
      const wy = (cy - t.y) / t.k;
      return { k: k2, x: cx - wx * k2, y: cy - wy * k2 };
    });
  };

  const fitView = () => {
    setTransform({ x: 40, y: 40, k: 0.7 });
  };

  const nodeDragStart = (e: React.PointerEvent, nodeId: string, x: number, y: number) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const p = getPoint(e.clientX, e.clientY);
    dragRef.current = { kind: 'node', startX: p.x, startY: p.y, origX: x, origY: y, nodeId };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const nodePosition = (id: string, fallbackX: number, fallbackY: number) => nodePositions[id] || { x: fallbackX, y: fallbackY };

  // ── Edición de jerarquía ─────────────────────────────────────────
  const openEdit = (employee: any) => {
    if (!editMode) return;
    setEditingEmployee(employee);
    setNewManagerId(effectiveManagerId(employee) || '');
  };

  const saveAll = async () => {
    const entries = Object.entries(drafts);
    if (entries.length === 0) return;
    setSaving(true);
    try {
      let ok = 0;
      const byId = new Map(allEmployees.map((e: any) => [e.id, e]));
      for (const [employeeId, managerId] of entries) {
        try {
          await hrService.updateEmployee(employeeId, { managerId: managerId || null });
          ok += 1;
        } catch (err: any) {
          toast.error(`No se pudo guardar a ${getEmployeeName(byId.get(employeeId))}: ${err?.response?.data?.message || 'error'}`);
        }
      }
      if (ok > 0) {
        toast.success(`${ok} de ${entries.length} jerarquía(s) guardada(s)`);
        setDrafts({});
        await onDataChange?.();
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleArea = (areaId: string) => {
    setHiddenAreas((current) => {
      const next = new Set(current);
      if (next.has(areaId)) next.delete(areaId); else next.add(areaId);
      return next;
    });
  };

  const unassigned = allEmployees.filter((e: any) => !e.departmentId);

  // ── KPIs de valor (brechas y cobertura) ──────────────────────────
  const kpis = useMemo(() => {
    const totalPeople = allEmployees.length;
    const peopleWithUser = allEmployees.filter((e: any) => e.userId || users.some((u: any) => u.employee?.id === e.id)).length;
    const peopleWithoutManager = allEmployees.filter((e: any) => !effectiveManagerId(e)).length;
    const areasWithoutManager = areas.filter((a: any) => !a.managerId && !a.manager).length;
    const occupiedPositions = new Set(allEmployees.map((e: any) => e.positionId).filter(Boolean));
    const totalPositions = positions.length;
    const vacantPositions = positions.filter((p: any) => !occupiedPositions.has(p.id)).length;
    const departmentsTotal = departments.length;
    const areasWithPeople = areas.filter((a: any) => (employeesByArea.get(a.id) || []).length > 0).length;
    return { totalPeople, peopleWithUser, peopleWithoutManager, areasWithoutManager, occupiedPositions: occupiedPositions.size, totalPositions, vacantPositions, departmentsTotal, areasWithPeople, areasTotal: areas.length };
  }, [allEmployees, users, areas, positions, departments, employeesByArea, effectiveManagerId]);

  const hasPendingChanges = Object.keys(drafts).length > 0;

  const renderEmployeeBlock = (employee: any, x: number, y: number) => {
    const pos = nodePosition(employee.id, x, y);
    const deptName = employee.department?.name || 'Sin departamento';
    const positionTitle = employee.position?.title || 'Sin puesto';
    const linkedUser = users.find((u: any) => u.employee?.id === employee.id || u.id === employee.userId);
    const initial = `${employee.firstName?.[0] || ''}${employee.lastName?.[0] || ''}`.toUpperCase() || employee.employeeNumber?.[0] || '?';
    const isDrafted = employee.id in drafts;
    const area = areas.find((a: any) => a.id === employee.departmentId);
    const color = area ? areaColor(area.id) : 'from-slate-500 to-slate-600';

    return (
      <div
        key={employee.id}
        data-node
        onPointerDown={(e) => nodeDragStart(e, employee.id, pos.x, pos.y)}
        onClick={() => openEdit(employee)}
        className={cn(
          'absolute w-[178px] select-none overflow-hidden rounded-2xl border-2 bg-card text-left shadow-[0_8px_24px_-8px_rgba(0,0,0,0.35)] transition-shadow',
          editMode ? 'cursor-pointer border-primary/50 ring-2 ring-primary/30 hover:shadow-[0_14px_30px_-8px_rgba(0,0,0,0.45)]' : 'cursor-grab border-background active:cursor-grabbing',
          isDrafted && 'ring-2 ring-amber-400',
        )}
        style={{ left: pos.x, top: pos.y, zIndex: 10 }}
        title={editMode ? `Cambiar jefe de ${getEmployeeName(employee)}` : `${getEmployeeName(employee)} · ${positionTitle}`}
      >
        <div className={cn('h-1.5 w-full bg-gradient-to-r', color)} />
        <div className="flex items-center gap-2 p-2.5">
          <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-xs font-black text-white shadow-inner', color)}>
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-black leading-tight">{getEmployeeName(employee)}</p>
            <p className="truncate text-[9px] font-semibold text-muted-foreground">{positionTitle}</p>
          </div>
          {linkedUser && <Badge className="shrink-0 bg-primary/10 px-1.5 py-0 text-[7px] font-black uppercase text-primary">User</Badge>}
        </div>
        <div className="flex items-center justify-between border-t border-border/40 bg-muted/20 px-2.5 py-1.5">
          <span className="truncate text-[8px] font-bold uppercase tracking-wider text-muted-foreground">{deptName}</span>
          <span className="text-[8px] font-bold text-muted-foreground/70">{employee.employeeNumber ? `#${employee.employeeNumber}` : '—'}</span>
        </div>
        {isDrafted && <div className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-amber-400 text-[8px] font-black text-amber-950">!</div>}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="size-8 rounded-lg" onClick={onBack} aria-label="Volver a Mi Equipo">
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider">
              <GitBranch className="size-4 text-primary" /> Organigrama de la empresa
            </h2>
            <p className="text-[10px] text-muted-foreground">Pizarra interactiva: arrastra el lienzo o las personas · zoom con la rueda del mouse</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar persona..." className="h-8 w-40 pl-7 text-xs" />
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-border/50 bg-muted/30 p-1">
            <Button variant="ghost" size="icon" className="size-7" onClick={() => zoomBy(1 / 1.12)} aria-label="Alejar"><ZoomOut className="size-3.5" /></Button>
            <span className="w-10 text-center text-[10px] font-black tabular-nums">{Math.round(transform.k * 100)}%</span>
            <Button variant="ghost" size="icon" className="size-7" onClick={() => zoomBy(1.12)} aria-label="Acercar"><ZoomIn className="size-3.5" /></Button>
          </div>
          <Button variant="ghost" size="icon" className="size-8 rounded-lg" onClick={fitView} title="Ajustar vista">
            <Maximize2 className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className={cn('size-8 rounded-lg', showGrid && 'bg-primary/10 text-primary')} onClick={() => setShowGrid((g) => !g)} title="Mostrar/ocultar rejilla">
            <Grid3x3 className="size-3.5" />
          </Button>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-2.5 py-1.5">
            <Switch checked={editMode} onCheckedChange={(v) => { setEditMode(v); if (!v) setEditingEmployee(null); }} className="scale-75" />
            <span className="text-[9px] font-black uppercase tracking-widest">Editar jefes</span>
          </label>
          {hasPendingChanges && (
            <Button size="sm" className="h-8 gap-1.5 text-[10px] font-black uppercase tracking-widest" onClick={() => void saveAll()} disabled={saving}>
              {saving ? <span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Plus className="size-3.5" />} Guardar cambios ({Object.keys(drafts).length})
            </Button>
          )}
        </div>
      </div>

      {/* KPIs de valor */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
        <KpiCard icon={<Users className="size-3.5" />} label="Personas" value={kpis.totalPeople} tone="text-primary" />
        <KpiCard icon={<UserRoundCheck className="size-3.5" />} label="Con usuario" value={kpis.peopleWithUser} tone="text-emerald-500" />
        <KpiCard icon={<ShieldAlert className="size-3.5" />} label="Sin jefe" value={kpis.peopleWithoutManager} tone="text-amber-500" />
        <KpiCard icon={<Building2 className="size-3.5" />} label="Áreas" value={`${kpis.areasWithPeople}/${kpis.areasTotal}`} tone="text-sky-500" />
        <KpiCard icon={<CircleDollarSign className="size-3.5" />} label="Áreas sin gerente" value={kpis.areasWithoutManager} tone="text-rose-500" />
        <KpiCard icon={<BriefcaseIcon />} label="Puestos" value={`${kpis.occupiedPositions}/${kpis.totalPositions}`} tone="text-violet-500" />
        <KpiCard icon={<Minus className="size-3.5" />} label="Puestos vacantes" value={kpis.vacantPositions} tone="text-orange-500" />
      </div>

      {/* Panel de áreas: mostrar/ocultar */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-muted-foreground"><Building2 className="size-3" /> Áreas:</span>
        {areas.map((area: any) => {
          const hidden = hiddenAreas.has(area.id);
          const count = (employeesByArea.get(area.id) || []).length;
          const hasManager = Boolean(area.managerId || area.manager);
          return (
            <button
              key={area.id}
              type="button"
              onClick={() => toggleArea(area.id)}
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-bold transition-colors',
                hidden ? 'border-border/40 bg-muted/20 text-muted-foreground/50 line-through' : 'border-border/50 bg-muted/30',
              )}
              title={hidden ? `Mostrar ${area.name}` : `Ocultar ${area.name}`}
            >
              <span className={cn('size-2 rounded-full bg-gradient-to-br', hidden ? 'bg-muted-foreground/30' : areaColor(area.id))} />
              {area.name}
              <span className="tabular-nums">({count})</span>
              {!hasManager && !hidden && <span className="text-rose-500">· sin gerente</span>}
            </button>
          );
        })}
        {unassigned.length > 0 && (
          <button
            type="button"
            onClick={() => setHiddenAreas((current) => {
              const next = new Set(current);
              if (next.has('unassigned')) next.delete('unassigned'); else next.add('unassigned');
              return next;
            })}
            className={cn('flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-bold transition-colors', hiddenAreas.has('unassigned') ? 'border-border/40 bg-muted/20 text-muted-foreground/50 line-through' : 'border-amber-500/30 bg-amber-500/10 text-amber-600')}
          >
            Sin área ({unassigned.length})
          </button>
        )}
      </div>

      {/* Lienzo */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div
            ref={canvasRef}
            onPointerDown={onCanvasPointerDown}
            onPointerMove={onCanvasPointerMove}
            onPointerUp={onCanvasPointerUp}
            onPointerLeave={onCanvasPointerLeave}
            onWheel={onCanvasWheel}
            className={cn(
              'relative h-[calc(100vh-380px)] min-h-[460px] touch-none select-none overflow-hidden',
              showGrid && 'bg-[radial-gradient(circle_at_1px_1px,rgba(120,130,150,0.18)_1px,transparent_0)] bg-[size:24px_24px]',
            )}
          >
            {/* Capa transformable */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: contentWidth,
                height: contentHeight,
                transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`,
                transformOrigin: '0 0',
              }}
            >
              {/* Conectores */}
              <svg width={contentWidth} height={contentHeight} className="pointer-events-none absolute left-0 top-0" style={{ zIndex: 1 }}>
                <defs>
                  <marker id="arrowhead" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                    <polygon points="0 0, 7 3.5, 0 7" fill="rgba(120,130,150,0.7)" />
                  </marker>
                </defs>
                {/* Raíz → Áreas */}
                {areaLayout.map((item) => {
                  const rootPos = nodePosition('root', rootNode.x, rootNode.y);
                  const areaCx = item.x + item.width / 2;
                  const startX = rootPos.x + 140;
                  const startY = rootPos.y + ROOT_H;
                  const endX = areaCx;
                  const endY = item.y - 14;
                  const midY = (startY + endY) / 2;
                  return (
                    <g key={item.area.id}>
                      <path
                        d={`M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}`}
                        fill="none"
                        stroke="rgba(120,130,150,0.7)"
                        strokeWidth={1.5}
                        markerEnd="url(#arrowhead)"
                      />
                    </g>
                  );
                })}
              </svg>

              {/* Nodo raíz */}
              <div
                data-node
                onPointerDown={(e) => nodeDragStart(e, 'root', rootNode.x, rootNode.y)}
                className="absolute z-10 flex cursor-grab items-center gap-3 rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary to-primary/80 px-5 py-3 text-white shadow-[0_10px_30px_-6px_rgba(0,0,0,0.5)] active:cursor-grabbing"
                style={{ left: nodePosition('root', rootNode.x, rootNode.y).x, top: nodePosition('root', rootNode.x, rootNode.y).y }}
              >
                <div className="flex size-10 items-center justify-center rounded-xl bg-white/15">
                  <Building2 className="size-5" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest">{rootNode.label}</p>
                  <p className="text-[9px] font-semibold text-white/70">{kpis.totalPeople} persona(s) · {kpis.areasTotal} área(s)</p>
                </div>
              </div>

              {/* Áreas */}
              {areaLayout.map((item) => {
                const hidden = hiddenAreas.has(item.area.id);
                const areaEmps = item.emps.filter((e: any) => e.departmentId === item.area.id);
                const color = areaColor(item.area.id);
                return (
                  <div
                    key={item.area.id}
                    className="absolute rounded-2xl border-2 border-dashed border-border/40 bg-card/40 backdrop-blur-[1px]"
                    style={{ left: item.x, top: item.y, width: item.width, height: Math.max(64 + areaEmps.length * (EMPLOYEE_H + 26) + 30, item.height), zIndex: 2 }}
                  >
                    {/* Cabecera del área */}
                    <div className={cn('m-1.5 flex items-center gap-2 rounded-xl bg-gradient-to-br px-2.5 py-2 text-white shadow-md', color)}>
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/15">
                        <Building2 className="size-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[10px] font-black uppercase tracking-wider">{item.area.name}</p>
                        <p className="text-[8px] font-semibold text-white/70">
                          {areaEmps.length} persona(s) · {item.positions.length} puesto(s)
                          {item.area.isSellerDepartment ? ' · Ventas' : ''}
                        </p>
                      </div>
                      {!hidden && (
                        <button
                          type="button"
                          onClick={() => toggleArea(item.area.id)}
                          className="flex size-6 items-center justify-center rounded-lg bg-white/15 text-[9px] font-black hover:bg-white/25"
                          title="Ocultar área"
                        >
                          −
                        </button>
                      )}
                    </div>

                    {/* Gerente del área */}
                    <div className="mx-2 mt-1.5">
                      {item.area.manager ? (
                        <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-2 py-1">
                          <UserRoundCheck className="size-3 text-emerald-500" />
                          <span className="text-[9px] font-bold">Gerente: {item.area.manager.firstName} {item.area.manager.lastName}</span>
                        </div>
                      ) : item.area.managerId ? (
                        <div className="flex items-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/5 px-2 py-1">
                          <ShieldAlert className="size-3 text-amber-500" />
                          <span className="text-[9px] font-bold text-amber-600">Gerente asignado pero sin datos</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 rounded-lg border border-dashed border-rose-500/30 bg-rose-500/5 px-2 py-1">
                          <ShieldAlert className="size-3 text-rose-500" />
                          <span className="text-[9px] font-bold text-rose-500">Sin gerente asignado</span>
                        </div>
                      )}
                    </div>

                    {/* Puestos existentes */}
                    {item.positions.length > 0 && (
                      <div className="mx-2 mt-1.5 flex flex-wrap gap-1">
                        {item.positions.map((p: any) => (
                          <Badge key={p.id} variant="outline" className="px-1.5 py-0 text-[7px] font-bold">
                            {p.title}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Empleados del área */}
                    {areaEmps.map((emp: any, i: number) =>
                      renderEmployeeBlock(emp, item.x + 12, item.y + 64 + (item.positions.length > 0 ? 40 : 0) + 8 + i * (EMPLOYEE_H + 26)),
                    )}

                    {/* Área vacía */}
                    {areaEmps.length === 0 && (
                      <div className="mx-2 mt-2 flex flex-col items-center gap-1 rounded-xl border border-dashed border-border/50 bg-muted/20 px-2 py-4 text-center">
                        <Users className="size-4 text-muted-foreground/50" />
                        <p className="text-[9px] font-semibold text-muted-foreground/70">
                          {hidden ? 'Oculta' : 'Sin personas asignadas'}
                        </p>
                        <p className="text-[8px] text-muted-foreground/50">El área existe; asigna personal desde RRHH</p>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Sin área */}
              {!hiddenAreas.has('unassigned') && unassigned.length > 0 && (
                <div
                  className="absolute rounded-2xl border-2 border-dashed border-amber-500/30 bg-card/40"
                  style={{ left: areaLayout.length > 0 ? Math.max(...areaLayout.map((a) => a.x + a.width)) + AREA_GAP : 0, top: ROOT_H + 150, width: AREA_W, zIndex: 2 }}
                >
                  <div className="m-1.5 flex items-center gap-2 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 px-2.5 py-2 text-white shadow-md">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/15"><Users className="size-3.5" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[10px] font-black uppercase tracking-wider">Sin área asignada</p>
                      <p className="text-[8px] font-semibold text-white/70">{unassigned.length} persona(s)</p>
                    </div>
                  </div>
                  {unassigned.map((emp: any, i: number) => renderEmployeeBlock(emp, 12, 64 + 8 + i * (EMPLOYEE_H + 26)))}
                </div>
              )}

              {/* Hint cuando no hay nada */}
              {areas.length === 0 && allEmployees.length === 0 && (
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                  <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary/10">
                    <Users className="size-8 text-primary" />
                  </div>
                  <h3 className="mt-3 text-sm font-black uppercase tracking-wider">Aún no hay equipo que organizar</h3>
                  <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
                    Crea empleados desde RRHH o víncula usuarios desde Mi Equipo. Las áreas y puestos que ya existen se muestran en la pizarra aunque no tengan personal.
                  </p>
                </div>
              )}
            </div>

            {/* Controles flotantes estilo N8N */}
            <div className="absolute bottom-3 right-3 z-20 flex flex-col items-center gap-1 rounded-xl border border-border/50 bg-card/90 p-1 shadow-lg backdrop-blur">
              <Button variant="ghost" size="icon" className="size-7" onClick={() => zoomBy(1.12)} title="Acercar"><Plus className="size-3.5" /></Button>
              <span className="text-[9px] font-black tabular-nums">{Math.round(transform.k * 100)}%</span>
              <Button variant="ghost" size="icon" className="size-7" onClick={() => zoomBy(1 / 1.12)} title="Alejar"><Minus className="size-3.5" /></Button>
              <div className="h-px w-6 bg-border" />
              <Button variant="ghost" size="icon" className="size-7" onClick={fitView} title="Ajustar vista"><Maximize2 className="size-3.5" /></Button>
            </div>
            <div className="absolute bottom-3 left-3 z-20 flex items-center gap-1.5 rounded-xl border border-border/50 bg-card/90 px-2.5 py-1.5 text-[9px] font-bold text-muted-foreground shadow-lg backdrop-blur">
              <Hand className="size-3" /> Arrastra el lienzo · rueda para zoom
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal edición de jefe */}
      {editingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEditingEmployee(null)}>
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-black uppercase tracking-wider">Jefe de {getEmployeeName(editingEmployee)}</h3>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Puesto: <strong>{editingEmployee.position?.title || 'Sin puesto'}</strong> · Área: <strong>{editingEmployee.department?.name || 'Sin área'}</strong>
            </p>
            <div className="mt-4 space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest">Jefe directo</label>
              <select
                value={newManagerId || 'none'}
                onChange={(e) => setNewManagerId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="none">Sin jefe (raíz / gerencia)</option>
                {allEmployees.filter((e: any) => e.id !== editingEmployee.id).map((e: any) => (
                  <option key={e.id} value={e.id}>
                    {getEmployeeName(e)} · {e.position?.title || 'Sin puesto'}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-muted/20 px-2.5 py-1.5 text-[10px] text-muted-foreground">
                <UserRoundCheck className="size-3.5 shrink-0" />
                <span>Los subordinados actuales de {getEmployeeName(editingEmployee)} se mantienen con él.</span>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setEditingEmployee(null)}>Cancelar</Button>
              <Button
                size="sm"
                className="h-8 gap-1.5 text-xs"
                disabled={!editingEmployee || effectiveManagerId(editingEmployee) === (newManagerId || null)}
                onClick={() => {
                  setDrafts((current) => ({ ...current, [editingEmployee.id]: newManagerId || null }));
                  setEditingEmployee(null);
                  toast.success(`Jefe de ${getEmployeeName(editingEmployee)} actualizado en borrador. Pulsa "Guardar cambios" para aplicar.`);
                }}
              >
                <Plus className="size-3.5" /> Aplicar al borrador
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: React.ReactNode; tone: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-muted/20 px-3 py-2">
      <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-lg bg-background', tone)}>{icon}</span>
      <div className="min-w-0">
        <p className="text-sm font-black leading-tight tabular-nums">{value}</p>
        <p className="truncate text-[8px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function BriefcaseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
      <rect width="20" height="14" x="2" y="7" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}

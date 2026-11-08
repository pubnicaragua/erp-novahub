import { useState } from 'react';
import { cn } from '../ui/utils';
import { useAuth } from '../../contexts/AuthContext';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { organizacionService } from '../../services/organizacion.service';
import { performanceService } from '../../services/performance.service';
import { CheckinConfigTab } from './CheckinConfigTab';
import { CumplimientoTab } from './CumplimientoTab';
import { RespuestasTab } from './RespuestasTab';
import { TeamHourlyTab } from './TeamHourlyTab';
import { TimelineTab, type PersonOption } from './TimelineTab';

type Tab = 'linea' | 'equipo' | 'respuestas' | 'cumplimiento' | 'config';

/**
 * Seguimiento del trabajo del equipo: línea de tiempo por hora, oportunidades por hora, respuestas a las preguntas por
 * hora (con su calificación) y cumplimiento. `mode="hr"` (Recursos Humanos > Seguimiento) ve a todas las personas y
 * administra la configuración; `mode="team"` (Organización > Equipo) ve solo a quienes el usuario supervisa.
 */
export function SeguimientoPanel({ mode }: { mode: 'hr' | 'team' }) {
  const { canPerform } = useAuth();
  const canConfigure = mode === 'hr' && canPerform('HR_PERFORMANCE', 'edit');
  const [tab, setTab] = useState<Tab>('linea');

  // Las personas visibles: todas (RR. HH.) o las que supervisa (Equipo).
  const hrPeople = useTenantQuery(['performance', 'people-hr'], async (signal) => (await performanceService.getCheckinConfig(signal)).users, { enabled: mode === 'hr', staleTime: 60_000 });
  const teamPeople = useTenantQuery(['organizacion', 'team'], (signal) => organizacionService.getTeam(signal), { enabled: mode === 'team', staleTime: 30_000 });
  const people: PersonOption[] = (mode === 'hr' ? hrPeople.data : teamPeople.data)?.map((person) => ({ id: person.id, name: person.name })) ?? [];

  const tabs: Array<[Tab, string]> = [['linea', 'Línea de tiempo'], ['equipo', 'Por hora del equipo'], ['respuestas', 'Respuestas'], ['cumplimiento', 'Cumplimiento'], ...(canConfigure ? [['config', 'Configuración'] as [Tab, string]] : [])];

  return (
    <div className="min-w-0 max-w-full space-y-5 overflow-x-hidden">
      <div role="tablist" aria-label="Secciones de Seguimiento" className="flex flex-wrap gap-2">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={cn('rounded-lg border px-4 py-2 text-[13px] font-semibold', tab === id ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:bg-muted/50')}>{label}</button>
        ))}
      </div>
      {tab === 'linea' && <TimelineTab key={people.map((p) => p.id).join(',')} people={people} />}
      {tab === 'equipo' && <TeamHourlyTab />}
      {tab === 'respuestas' && <RespuestasTab people={people} />}
      {tab === 'cumplimiento' && <CumplimientoTab />}
      {tab === 'config' && canConfigure && <CheckinConfigTab />}
    </div>
  );
}

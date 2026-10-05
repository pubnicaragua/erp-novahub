import { useMemo } from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Flag,
  Search,
  Star,
  Sun,
} from 'lucide-react';
import { Input } from '../ui/input';

type Task = {
  id: string;
  title: string;
  sectionId?: string | null;
  parentTaskId?: string | null;
  status?: string;
  priority?: string;
  dueDate?: string | null;
  startDate?: string | null;
};

export type SmartFilterType =
  | 'all'
  | 'my-day'
  | 'important'
  | 'planned'
  | 'in-progress'
  | 'urgent';

type SmartFiltersBarProps = {
  tasks: Task[];
  activeFilter: SmartFilterType;
  onFilterChange: (filter: SmartFilterType) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
};

export function SmartFiltersBar({
  tasks,
  activeFilter,
  onFilterChange,
  searchQuery,
  onSearchChange,
}: SmartFiltersBarProps) {
  const todayStr = new Date().toISOString().substring(0, 10);

  // Calcula contadores en vivo para cada filtro inteligente (inspirado en Image 4)
  const counts = useMemo(() => {
    let myDay = 0;
    let important = 0;
    let planned = 0;
    let inProgress = 0;
    let urgent = 0;

    for (const task of tasks) {
      if (task.dueDate && task.dueDate.substring(0, 10) === todayStr) {
        myDay++;
      }
      if (task.priority === 'HIGH' || task.priority === 'URGENT') {
        important++;
      }
      if (task.dueDate || task.startDate) {
        planned++;
      }
      if (task.status === 'IN_PROGRESS') {
        inProgress++;
      }
      if (task.priority === 'URGENT') {
        urgent++;
      }
    }

    return {
      all: tasks.filter((t) => !t.parentTaskId).length,
      myDay,
      important,
      planned,
      inProgress,
      urgent,
    };
  }, [tasks, todayStr]);

  const filterOptions: Array<{
    id: SmartFilterType;
    label: string;
    icon: typeof Sun;
    count: number;
    color: string;
  }> = [
    { id: 'all', label: 'Todas las tareas', icon: CheckCircle2, count: counts.all, color: 'text-primary' },
    { id: 'my-day', label: 'Mi día', icon: Sun, count: counts.myDay, color: 'text-amber-500' },
    { id: 'important', label: 'Importante', icon: Star, count: counts.important, color: 'text-blue-500' },
    { id: 'planned', label: 'Planificadas', icon: Calendar, count: counts.planned, color: 'text-sky-500' },
    { id: 'in-progress', label: 'En curso', icon: Clock, count: counts.inProgress, color: 'text-indigo-500' },
    { id: 'urgent', label: 'Urgentes', icon: Flag, count: counts.urgent, color: 'text-rose-500' },
  ];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-2 rounded-2xl bg-card border shadow-sm">
      {/* Botones de Filtros Inteligentes (Image 4) */}
      <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto py-0.5">
        {filterOptions.map((opt) => {
          const Icon = opt.icon;
          const isActive = activeFilter === opt.id;

          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onFilterChange(opt.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className={`size-3.5 ${isActive ? 'text-primary-foreground' : opt.color}`} />
              <span>{opt.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  isActive
                    ? 'bg-primary-foreground/20 text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {opt.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Buscador de Tareas */}
      <div className="relative w-full sm:w-56">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar tareas..."
          className="h-8 pl-8 text-xs bg-background"
        />
      </div>
    </div>
  );
}

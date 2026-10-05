import { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Flag,
} from 'lucide-react';
import { Button } from '../ui/button';

type Task = {
  id: string;
  title: string;
  sectionId?: string | null;
  parentTaskId?: string | null;
  status?: string;
  priority?: string;
  dueDate?: string | null;
  startDate?: string | null;
  progress?: number;
};

type BoardCalendarViewProps = {
  tasks: Task[];
  onSelectTask: (taskId: string) => void;
};

const DAYS_OF_WEEK = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const PRIORITY_COLORS: Record<string, string> = {
  NONE: 'bg-primary/10 text-primary border-primary/20',
  LOW: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20',
  MEDIUM: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20',
  HIGH: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
  URGENT: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20',
};

export function BoardCalendarView({ tasks, onSelectTask }: BoardCalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(() => new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Genera los días del mes actual completando la cuadrícula con días del mes anterior y posterior
  const calendarCells = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    // Ajuste para comenzar en Lunes (0 = Lunes, 6 = Domingo)
    let startDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const totalDays = lastDayOfMonth.getDate();
    const cells: Array<{ date: Date; isCurrentMonth: boolean; dateKey: string }> = [];

    // Días del mes anterior
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i);
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      cells.push({ date: d, isCurrentMonth: false, dateKey });
    }

    // Días del mes actual
    for (let day = 1; day <= totalDays; day++) {
      const d = new Date(year, month, day);
      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      cells.push({ date: d, isCurrentMonth: true, dateKey });
    }

    // Días del mes siguiente para completar múltiplos de 7 (mínimo 35 o 42 celdas)
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      cells.push({ date: d, isCurrentMonth: false, dateKey });
    }

    return cells;
  }, [year, month]);

  // Agrupa tareas por su fecha de vencimiento (formato YYYY-MM-DD)
  const tasksByDate = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const task of tasks) {
      if (task.dueDate) {
        const key = task.dueDate.substring(0, 10);
        if (!map[key]) map[key] = [];
        map[key].push(task);
      }
    }
    return map;
  }, [tasks]);

  const monthName = currentDate.toLocaleDateString('es-NI', {
    month: 'long',
    year: 'numeric',
  });

  const todayKey = new Date().toISOString().substring(0, 10);

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-4">
      {/* Controles de Navegación del Calendario */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div className="flex items-center gap-2">
          <CalendarIcon className="size-5 text-primary" />
          <h2 className="text-lg font-bold capitalize">{monthName}</h2>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleToday}>
            Hoy
          </Button>
          <Button variant="outline" size="icon" onClick={handlePrevMonth} aria-label="Mes anterior">
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleNextMonth} aria-label="Mes siguiente">
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {/* Cuadrícula Mensual */}
      <div className="grid grid-cols-7 gap-px bg-border/60 rounded-xl overflow-hidden border">
        {/* Encabezado de Días */}
        {DAYS_OF_WEEK.map((day) => (
          <div
            key={day}
            className="bg-muted/40 p-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider"
          >
            {day}
          </div>
        ))}

        {/* Celdas de Días */}
        {calendarCells.map((cell) => {
          const dayTasks = tasksByDate[cell.dateKey] || [];
          const isToday = cell.dateKey === todayKey;

          return (
            <div
              key={cell.dateKey}
              className={`min-h-[105px] p-1.5 transition ${
                cell.isCurrentMonth ? 'bg-card' : 'bg-muted/20 text-muted-foreground'
              } ${isToday ? 'ring-2 ring-primary ring-inset' : ''}`}
            >
              {/* Número del día */}
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`text-xs font-medium size-5 flex items-center justify-center rounded-full ${
                    isToday ? 'bg-primary text-primary-foreground font-bold' : ''
                  }`}
                >
                  {cell.date.getDate()}
                </span>
                {dayTasks.length > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    {dayTasks.length} {dayTasks.length === 1 ? 'tarea' : 'tareas'}
                  </span>
                )}
              </div>

              {/* Tareas del día */}
              <div className="space-y-1 overflow-y-auto max-h-[80px]">
                {dayTasks.map((task) => {
                  const isDone = task.status === 'COMPLETED';
                  const priorityClass =
                    PRIORITY_COLORS[task.priority || 'NONE'] || PRIORITY_COLORS.NONE;

                  return (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => onSelectTask(task.id)}
                      className={`w-full text-left p-1 rounded border text-[11px] truncate flex items-center gap-1 font-medium hover:opacity-85 transition ${
                        isDone ? 'line-through opacity-60 bg-muted/50 border-muted' : priorityClass
                      }`}
                      title={task.title}
                    >
                      {task.priority && task.priority !== 'NONE' && (
                        <Flag className="size-2.5 shrink-0" />
                      )}
                      <span className="truncate">{task.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

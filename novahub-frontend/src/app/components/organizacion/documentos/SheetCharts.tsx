import { Trash2 } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts';
import type { Evaluator } from './sheet-formula';
import { chartData } from './sheet-tools';
import type { SheetChart, SheetData } from './xlsx-convert';

const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];
const TYPES: Array<{ id: SheetChart['type']; label: string }> = [{ id: 'bar', label: 'Barras' }, { id: 'line', label: 'Líneas' }, { id: 'pie', label: 'Circular' }];

/** Gráficos de la hoja: se calculan en vivo a partir de un rango de celdas. */
export function SheetCharts({ charts, sheet, evaluator, readOnly, onChange }: { charts: SheetChart[]; sheet: SheetData; evaluator: Evaluator; readOnly: boolean; onChange: (charts: SheetChart[]) => void }) {
  const patch = (id: string, change: Partial<SheetChart>) => onChange(charts.map((c) => (c.id === id ? { ...c, ...change } : c)));
  return (
    <section aria-label="Gráficos de la hoja" className="grid gap-3 md:grid-cols-2">
      {charts.map((chart) => {
        const data = chartData(evaluator, sheet, chart.range);
        const rows = data ? data.categories.map((name, i) => ({ name, ...Object.fromEntries(data.series.map((s) => [s.name, s.values[i]])) })) : [];
        return (
          <figure key={chart.id} className="min-w-0 rounded-xl border border-border bg-card p-3">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <input aria-label="Título del gráfico" value={chart.title} readOnly={readOnly} maxLength={80} onChange={(e) => patch(chart.id, { title: e.target.value })}
                className="h-8 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1 text-[13px] font-semibold hover:border-border focus:border-border" />
              <select aria-label="Tipo de gráfico" disabled={readOnly} value={chart.type} onChange={(e) => patch(chart.id, { type: e.target.value as SheetChart['type'] })} className="h-8 rounded-md border border-border bg-background px-1.5 text-[12px]">
                {TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
              <span className="text-[11px] text-muted-foreground" title="Rango de datos">{chart.range}</span>
              {!readOnly && <button type="button" aria-label={`Quitar el gráfico ${chart.title}`} onClick={() => onChange(charts.filter((c) => c.id !== chart.id))} className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive"><Trash2 className="size-4" /></button>}
            </div>
            {!data ? <p className="py-10 text-center text-[12px] text-muted-foreground">Este rango no tiene números para graficar.</p> : (
              <div role="img" aria-label={`${chart.title}: gráfico de ${TYPES.find((t) => t.id === chart.type)?.label.toLowerCase()} con ${data.series.map((s) => s.name).join(', ')}`} className="h-64 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  {chart.type === 'pie' ? (
                    <PieChart>
                      <Pie data={data.categories.map((name, i) => ({ name, value: Math.max(0, data.series[0].values[i] ?? 0) }))} dataKey="value" nameKey="name" outerRadius="80%" label>
                        {data.categories.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip /><Legend />
                    </PieChart>
                  ) : chart.type === 'line' ? (
                    <LineChart data={rows}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} width={48} /><Tooltip /><Legend />
                      {data.series.map((s, i) => <Line key={s.name} type="monotone" dataKey={s.name} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} />)}
                    </LineChart>
                  ) : (
                    <BarChart data={rows}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} width={48} /><Tooltip /><Legend />
                      {data.series.map((s, i) => <Bar key={s.name} dataKey={s.name} fill={COLORS[i % COLORS.length]} radius={[3, 3, 0, 0]} />)}
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            )}
          </figure>
        );
      })}
    </section>
  );
}

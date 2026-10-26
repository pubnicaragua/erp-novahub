import type { ReactNode } from 'react';
import { ArrowRight, Building2, ChevronRight, Code2, FileDown, Plus, Save, Send } from 'lucide-react';
import { cn } from './ui/utils';

export type AuditExecutionView = 'programs' | 'sampling' | 'workpapers' | 'pbc' | 'findings' | 'reviews' | 'reports' | 'archive' | 'risks' | 'planning' | 'accounting-imports' | 'trial-balance';

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={cn('rounded-xl border border-[#e3ece6] bg-white p-4 shadow-[0_6px_20px_rgba(13,66,45,0.045)]', className)}>{children}</section>;
}

export function Title({ children, action, onAction }: { children: ReactNode; action?: string; onAction?: () => void }) {
  return <div className="mb-3 flex items-center justify-between gap-3"><h2 className="font-serif text-[16px] font-semibold tracking-[-0.02em] text-[#173e30]">{children}</h2>{action && <button type="button" onClick={onAction} className="inline-flex items-center gap-1 text-[10px] font-bold text-[#1c8054] hover:text-[#075239]">{action}<ChevronRight className="size-3.5" /></button>}</div>;
}

export type PillTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';
export function Pill({ label, tone = 'neutral' }: { label: string; tone?: PillTone }) {
  const tones = { success: 'bg-[#e2f4e5] text-[#208052]', warning: 'bg-[#fff2d4] text-[#9d6c08]', danger: 'bg-[#ffe5e6] text-[#c83e4b]', info: 'bg-[#e3f1f7] text-[#2c6e83]', neutral: 'bg-[#edf2ef] text-[#64776c]' };
  return <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-1 text-[9px] font-bold whitespace-nowrap', tones[tone])}><span className="size-1.5 rounded-full bg-current" />{label}</span>;
}

export function Kpi({ label, value, detail, tone = 'green', icon = '▦' }: { label: string; value: string; detail: string; tone?: 'green' | 'amber' | 'danger'; icon?: string }) {
  return <article className="rounded-xl border border-[#e3ece6] bg-white p-3 shadow-[0_5px_18px_rgba(13,66,45,0.035)]"><div className="flex items-start justify-between"><div><p className="text-[9px] font-semibold text-[#8a9b92]">{label}</p><p className={cn('mt-2 text-[22px] font-black tracking-[-0.06em]', tone === 'danger' ? 'text-[#d3434e]' : tone === 'amber' ? 'text-[#a36f0a]' : 'text-[#14523d]')}>{value}</p></div><span className={cn('flex size-8 items-center justify-center rounded-lg text-sm font-black', tone === 'danger' ? 'bg-[#fff0f0] text-[#df5d66]' : tone === 'amber' ? 'bg-[#fff2da] text-[#c08b1c]' : 'bg-[#e4f5e7] text-[#2d9060]')}>{icon}</span></div><p className="mt-1 text-[9px] text-[#9aa8a1]">{detail}</p></article>;
}

export function ExecutionHeader({ title, subtitle, phase, data, onPrimary, primaryLabel, children }: { title: string; subtitle: string; phase: string; data: { code: string; client: string; period: string; status: string }; onPrimary?: () => void; primaryLabel: string; children?: ReactNode }) {
  return <><div className="rounded-xl border border-[#e4ece7] bg-white px-4 py-3 shadow-[0_5px_18px_rgba(13,66,45,0.035)]"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-lg bg-[#e2f4e5] text-[#268759]"><Building2 className="size-4" /></span><div><p className="text-[11px] font-black text-[#315b49]">{data.code} · {data.client}</p><p className="text-[9px] text-[#87988f]">Auditoría financiera · {data.period}</p></div></div><div className="flex items-center gap-4 text-[9px]"><Pill label={data.status} tone="success" /><span><strong className="block text-[#6b8377]">Socio del encargo</strong>María López</span><span><strong className="block text-[#6b8377]">Última actualización</strong>Ahora · API</span></div></div></div><div className="flex flex-wrap items-end justify-between gap-3 pt-2"><div><p className="mb-1 flex items-center gap-2 text-[10px] font-bold text-[#53a965]"><span className="size-1.5 rounded-full bg-[#5db763]" />{phase} · {data.code}</p><h1 className="font-serif text-[31px] font-semibold italic tracking-[-0.04em] text-[#143e2e] sm:text-[38px]">{title}</h1><p className="mt-1 text-[11px] text-[#84948c]">{subtitle}</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => window.print()} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#dce8e1] bg-white px-3 text-[10px] font-bold text-[#557066]"><FileDown className="size-3.5" />Exportar</button><button type="button" onClick={() => window.dispatchEvent(new CustomEvent('audit-demo-save'))} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#dce8e1] bg-white px-3 text-[10px] font-bold text-[#557066]"><Save className="size-3.5" />Guardar borrador</button>{children}<button type="button" onClick={onPrimary} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#075239] px-3 text-[10px] font-bold text-white"><Plus className="size-3.5" />{primaryLabel}</button></div></div></>;
}

export function Tabs({ items, active = 0, onSelect }: { items: string[]; active?: number; onSelect?: (index: number) => void }) {
  return <div className="mt-2 flex gap-1 overflow-x-auto border-b border-[#dfe9e2] text-[10px] font-bold text-[#71837a]">{items.map((item, index) => <button key={item} type="button" onClick={() => { onSelect?.(index); window.dispatchEvent(new CustomEvent('audit-tab-selected', { detail: { label: item, index } })); }} className={cn('min-w-max border-b-2 px-3 py-2.5', index === active ? 'border-[#168352] text-[#168352]' : 'border-transparent hover:text-[#168352]')}>{item}</button>)}</div>;
}

export function Flow({ items, onNext }: { items: string[]; onNext?: () => void }) {
  return <div className="rounded-xl border border-[#cde5d3] bg-gradient-to-r from-[#effaf0] to-white p-3 text-[10px] text-[#5f7d6d]"><div className="flex flex-wrap items-center gap-2"><Code2 className="size-4 text-[#3d9562]" /><strong className="text-[#2d704c]">Flujo:</strong>{items.map((item, index) => <span key={item} className="inline-flex items-center gap-2">{index > 0 && <ArrowRight className="size-3.5" />}{index === items.length - 1 && onNext ? <button type="button" onClick={onNext} className="font-bold text-[#19784f]">{item}</button> : item}</span>)}</div></div>;
}

export function DemoNotice({ isDemo }: { isDemo: boolean }) {
  if (!isDemo) return null;
  return <div className="rounded-xl border border-[#f0dba4] bg-[#fff9e9] px-3 py-2 text-[10px] text-[#7d5d10]"><strong>API no disponible:</strong> esta información no se ha guardado en el expediente hasta que el workspace responda correctamente.</div>;
}

export function actionTone(value: string): PillTone {
  if (/aprob|complet|acept|valid|vigente|recibido|firmad|eficaz/i.test(value)) return 'success';
  if (/pend|revis|borr|ejec|incompleto|venc/i.test(value)) return 'warning';
  if (/error|rechaz|bloque|crít|excepción/i.test(value)) return 'danger';
  return 'info';
}

export function SendButton({ label, onClick }: { label: string; onClick?: () => void }) {
  return <button type="button" onClick={onClick} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#cbe3d0] bg-[#effaf0] px-3 text-[10px] font-bold text-[#28794e]"><Send className="size-3.5" />{label}</button>;
}

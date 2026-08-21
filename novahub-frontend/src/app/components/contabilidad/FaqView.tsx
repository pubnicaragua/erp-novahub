import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { HelpCircle, ChevronDown, Search } from 'lucide-react';
import { Input } from '../ui/input';
import { cn } from '../ui/utils';

const FAKE_ITEMS = [
  {
    q: '¿Qué es el Plan de Cuentas?',
    a: 'Es la lista ordenada y codificada de todas las cuentas contables que usa tu empresa para registrar transacciones. Se estructura en activo, pasivo, patrimonio, ingresos y egresos.',
  },
  {
    q: '¿Cómo se calcula el Balance de Comprobación?',
    a: 'Suma todos los débitos y créditos de cada cuenta del libro mayor. El total de débitos debe igualar al total de créditos. Si no cuadra, hay un error en los asientos.',
  },
  {
    q: 'Diferencia entre Estado de Resultados y Balance General',
    a: 'El Estado de Resultados muestra ingresos y gastos en un período (rentabilidad). El Balance General muestra activos, pasivos y patrimonio en una fecha específica (posición financiera).',
  },
  {
    q: '¿Qué es una conciliación bancaria?',
    a: 'Proceso de comparar los movimientos del banco contra los registros contables propios para identificar diferencias por cheques no cobrados, cargos bancarios o errores.',
  },
  {
    q: '¿Cada cuándo debo cerrar un período contable?',
    a: 'Generalmente cada mes. El cierre mensual asegura que los saldos de cuentas nominales (ingresos/gastos) se reinicien y los resultados se trasladen al patrimonio.',
  },
  {
    q: '¿Qué son los activos fijos?',
    a: 'Bienes tangibles de larga duración (edificios, maquinaria, vehículos) que se usan en la operación del negocio y se deprecian a lo largo de su vida útil.',
  },
  {
    q: '¿Cómo se calcula la depreciación?',
    a: 'Método lineal: (costo - valor residual) / vida útil en años. Ejemplo: equipo de $10,000 con 5 años de vida y $1,000 residual = $1,800/año de depreciación.',
  },
  {
    q: '¿Qué son los reportes fiscales DGI?',
    a: 'Declaraciones que las empresas presentan a la Dirección General de Ingresos, incluyendo IR (Impuesto sobre la Renta), IVA, y retenciones. Deben coincidir con tus registros contables.',
  },
  {
    q: '¿Por qué no cuadra mi balance?',
    a: 'Causas comunes: asientos sin débito/crédito, montos incorrectos, cuentas mal clasificadas, o errores en la apertura de saldos iniciales. Revisá el libro mayor y el balance de comprobación.',
  },
  {
    q: '¿Qué es una cuenta de orden?',
    a: 'Cuentas que registran operaciones que no afectan el balance general pero requieren control, como avales, garantías o litigios pendientes.',
  },
];

export function FaqView() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [search, setSearch] = useState('');

  const filtered = FAKE_ITEMS.filter(
    (item) =>
      item.q.toLowerCase().includes(search.toLowerCase()) ||
      item.a.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <HelpCircle className="size-6" />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-tighter">Preguntas Frecuentes</h2>
          </div>
        </div>
        <div className="relative max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscá tu pregunta..."
            className="pl-10 h-11 rounded-xl bg-background"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">No se encontraron preguntas.</p>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((item, i) => (
            <div key={i} className="rounded-2xl border border-border/50 overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-muted/20 transition-colors"
              >
                <span className="text-sm font-bold pr-4">{item.q}</span>
                <ChevronDown
                  className={cn(
                    'size-4 text-muted-foreground shrink-0 transition-transform duration-200',
                    openIndex === i && 'rotate-180',
                  )}
                />
              </button>
              <AnimatePresence>
                {openIndex === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-4 pt-0 text-sm text-muted-foreground leading-relaxed border-t border-border/20">
                      {item.a}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

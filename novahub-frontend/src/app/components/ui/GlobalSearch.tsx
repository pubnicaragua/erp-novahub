import { useState, useRef, useEffect } from 'react'
import { Search, ChevronDown, ArrowRight } from 'lucide-react'
import { Input } from './input'

interface SearchOption {
  id: string
  label: string
  module: string
  subModule?: string
}

const SEARCH_MODULES: SearchOption[] = [
  { id: 'ventas', label: 'Ventas', module: 'ventas', subModule: 'facturas' },
  { id: 'compras', label: 'Compras', module: 'compras', subModule: 'ordenes-compra' },
  { id: 'inventario', label: 'Inventario de Mercancías', module: 'inventario', subModule: 'productos' },
  { id: 'contabilidad', label: 'Contabilidad', module: 'contabilidad', subModule: 'cuentas' },
  { id: 'finanzas', label: 'Finanzas', module: 'finanzas', subModule: 'ingresos' },
  { id: 'clientes', label: 'Clientes', module: 'ventas', subModule: 'clientes' },
  { id: 'proveedores', label: 'Proveedores', module: 'compras', subModule: 'proveedores' },
  { id: 'rh', label: 'RRHH', module: 'rh', subModule: 'empleados' },
]

interface GlobalSearchProps {
  onNavigate?: (module: string, subModule: string, searchTerm: string) => void
}

export function GlobalSearch({ onNavigate }: GlobalSearchProps) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<SearchOption>(SEARCH_MODULES[0])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleSearch = () => {
    if (!query.trim()) return
    onNavigate?.(selected.module, selected.subModule || '', query.trim())
    setQuery('')
  }

  return (
    <div ref={ref} className="relative flex items-center gap-1 px-3 py-2 border-b border-sidebar-border/50">
      <div className="relative flex-1 flex items-center gap-1">
        <Search className="size-3.5 text-sidebar-foreground/40 shrink-0" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder={`Buscar en ${selected.label}...`}
          className="h-7 text-[11px] bg-sidebar-accent/30 border-0 rounded-md px-2 py-0 text-sidebar-foreground placeholder:text-sidebar-foreground/30 focus-visible:ring-1 focus-visible:ring-sidebar-ring"
        />
      </div>
      <div className="relative shrink-0">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-0.5 h-7 px-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider text-sidebar-foreground/60 hover:bg-sidebar-accent/50 transition-colors"
        >
          {selected.label.substring(0, 4)}
          <ChevronDown className="size-2.5" />
        </button>
        {open && (
          <div className="absolute right-0 top-full mt-1 w-36 bg-popover border border-border rounded-lg shadow-lg z-50 py-1">
            {SEARCH_MODULES.map((mod) => (
              <button
                key={mod.id}
                onClick={() => { setSelected(mod); setOpen(false) }}
                className={`w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-accent ${selected.id === mod.id ? 'font-bold text-primary' : 'text-foreground'}`}
              >
                {mod.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {query.trim() && (
        <button
          onClick={handleSearch}
          className="shrink-0 flex items-center justify-center size-7 rounded-md text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-primary transition-colors"
          title="Buscar"
        >
          <ArrowRight className="size-3.5" />
        </button>
      )}
    </div>
  )
}

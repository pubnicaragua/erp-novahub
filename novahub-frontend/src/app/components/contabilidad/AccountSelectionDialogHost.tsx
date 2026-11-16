import { useEffect, useRef, useState } from 'react'
import { BookOpen, Check } from 'lucide-react'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog'
import { ACCOUNT_SELECTION_REQUIRED_EVENT, type AccountSelectionChoice } from '../../services/api'

type SelectionRequest = {
  choices: AccountSelectionChoice[]
  resolve: (values: Record<string, string>) => void
  reject: (error: Error) => void
  claimed: boolean
}

export function AccountSelectionDialogHost() {
  const [active, setActive] = useState<SelectionRequest | null>(null)
  const [selected, setSelected] = useState<Record<string, string>>({})
  const activeRef = useRef<SelectionRequest | null>(null)
  const queue = useRef<SelectionRequest[]>([])

  const advance = (next?: SelectionRequest) => {
    const request = next || queue.current.shift() || null
    activeRef.current = request
    setActive(request)
    setSelected({})
  }

  useEffect(() => {
    const onSelectionRequired = (event: Event) => {
      const request = (event as CustomEvent<SelectionRequest>).detail
      request.claimed = true
      if (!activeRef.current) advance(request)
      else queue.current.push(request)
    }
    window.addEventListener(ACCOUNT_SELECTION_REQUIRED_EVENT, onSelectionRequired)
    return () => {
      window.removeEventListener(ACCOUNT_SELECTION_REQUIRED_EVENT, onSelectionRequired)
      const cancelled = new DOMException('La selección fue cancelada', 'AbortError')
      activeRef.current?.reject(cancelled)
      queue.current.splice(0).forEach(request => request.reject(cancelled))
      activeRef.current = null
    }
  }, [])

  const canConfirm = Boolean(active?.choices.length)
    && active!.choices.every(choice => choice.accounts.some(account => account.code === selected[choice.key]))

  const confirm = () => {
    if (!active || !canConfirm) return
    const completed = active
    const values = { ...selected }
    advance()
    completed.resolve(values)
  }

  const cancel = () => {
    const cancelled = active
    advance()
    cancelled?.reject(new DOMException('La selección fue cancelada', 'AbortError'))
  }

  return (
    <Dialog open={Boolean(active)} onOpenChange={open => { if (!open && activeRef.current) cancel() }}>
      {active && (
        <DialogContent className="w-[calc(100%-1rem)] !max-w-2xl gap-4 sm:p-6">
          <DialogHeader className="pr-8 text-left">
            <DialogTitle className="flex items-center gap-2 text-base font-black">
              <BookOpen className="size-4 shrink-0 text-primary" /> Selecciona las cuentas del asiento
            </DialogTitle>
            <DialogDescription>
              Esta operación tiene más de una cuenta configurada para algunos conceptos. Elige la cuenta que se aplicará en este registro.
            </DialogDescription>
          </DialogHeader>
          <div className="min-w-0 space-y-3">
            {active.choices.map(choice => (
              <label key={choice.key} className="block min-w-0 rounded-xl border border-border/50 bg-card p-3">
                <span className="mb-2 block text-xs font-bold text-foreground">{choice.label}</span>
                <select
                  value={selected[choice.key] || ''}
                  onChange={event => setSelected(previous => ({ ...previous, [choice.key]: event.target.value }))}
                  className="h-10 w-full max-w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Cuenta contable para ${choice.label}`}
                >
                  <option value="">Seleccionar cuenta…</option>
                  {choice.accounts.map(account => (
                    <option key={account.code} value={account.code}>{account.code} · {account.name}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={cancel}>Cancelar operación</Button>
            <Button type="button" disabled={!canConfirm} onClick={confirm}>
              <Check className="mr-2 size-4" /> Confirmar cuentas
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  )
}

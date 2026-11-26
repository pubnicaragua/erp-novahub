import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, Check } from 'lucide-react'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog'
import { ACCOUNT_SELECTION_REQUIRED_EVENT, type AccountSelectionChoice } from '../../services/api'

type SelectionRequest = {
  choices: AccountSelectionChoice[]
  resolve: (values: Record<string, string>) => void
  reject: (error: Error) => void
  claimed: boolean
}

const ACCOUNTING_OPERATION_LABELS: Record<string, string> = {
  invoice: 'la factura de venta',
  cashSale: 'la venta cobrada en caja',
  payment: 'el cobro del cliente',
  cashRegister: 'el movimiento de caja',
  supplierInvoice: 'la factura del proveedor',
  supplierCredit: 'la nota de crédito del proveedor',
  paymentMade: 'el pago al proveedor',
  purchaseReceipt: 'el documento de compra',
  expense: 'el registro del gasto',
  projects: 'el costo del proyecto',
  payroll: 'la nómina',
  customerLoan: 'el desembolso o cobro del préstamo',
  creditNote: 'la nota de crédito de venta',
  saleReturn: 'la devolución de venta',
  financialIncome: 'el ingreso financiero',
  financialExpense: 'el gasto financiero',
  inventoryAdjustment: 'el ajuste de inventario',
  openingBalance: 'el saldo de apertura',
  bankReconciliation: 'la conciliación bancaria',
}

const ACCOUNTING_FIELD_DETAILS: Record<string, string> = {
  cash: 'registrar el dinero recibido o pagado desde caja, efectivo o banco',
  income: 'reconocer el ingreso generado por la operación',
  receivable: 'registrar o cancelar el saldo pendiente por cobrar al cliente',
  customerBalance: 'registrar el saldo a favor del cliente',
  payable: 'registrar la deuda pendiente con el proveedor',
  expense: 'reconocer el gasto de la operación',
  inventory: 'registrar el valor de inventario que entra, sale o se revierte',
  inTransit: 'registrar el inventario que todavía está en tránsito',
  control: 'registrar el movimiento de la cuenta de control de inventario',
  ivaPayable: 'registrar el IVA trasladado que queda por pagar',
  ivaCreditable: 'registrar el IVA de compras que se puede acreditar',
  ivaWithholdingPayable: 'registrar la retención de IVA pendiente de pagar',
  irWithholdingPayable: 'registrar la retención de IR pendiente de pagar',
  otherWithholdingPayable: 'registrar otras retenciones pendientes de pagar',
  extraCost: 'reconocer los costos adicionales cobrados al cliente',
  delivery: 'reconocer el ingreso cobrado por delivery o entrega',
  cogs: 'reconocer el costo de los productos vendidos',
  returns: 'registrar las devoluciones y descuentos de ventas',
  shortage: 'registrar el faltante de efectivo detectado',
  surplus: 'registrar el sobrante de efectivo detectado',
  loss: 'registrar la pérdida identificada en la operación',
  shrinkage: 'registrar la merma de inventario identificada',
  deterioration: 'registrar el deterioro de inventario identificado',
  adjustment: 'registrar el ajuste contable del inventario',
  equity: 'registrar la contrapartida patrimonial del saldo de apertura',
  bankFees: 'registrar los cargos o comisiones bancarias',
  interestIncome: 'reconocer el ingreso por intereses',
}

const ACCOUNTING_CHOICE_DETAILS: Record<string, string> = {
  'invoice.income': 'Reconoce el ingreso generado por esta factura. El dinero recibido (caja, efectivo o banco) se registra en otra cuenta del asiento.',
  'cashSale.income': 'Reconoce el ingreso generado por esta venta cobrada en caja. La cuenta de caja o efectivo se selecciona por separado.',
  'cashSale.cash': 'Registra el efectivo recibido por esta venta en caja.',
  'payment.cash': 'Registra el dinero recibido para aplicar el cobro del cliente; puede ser efectivo, caja o banco según el medio de pago.',
  'cashRegister.cash': 'Refleja el efectivo disponible en caja para este movimiento o ajuste.',
  'expense.cash': 'Indica desde qué cuenta sale el dinero para pagar este gasto: efectivo, caja o banco.',
  'supplierInvoice.cash': 'Registra el pago inmediato de la factura del proveedor desde efectivo, caja o banco.',
  'paymentMade.cash': 'Registra la cuenta de efectivo o banco desde la que se paga al proveedor.',
  'purchaseReceipt.cash': 'Registra el pago del documento de compra desde caja o banco.',
}

function getChoiceDescription(choice: AccountSelectionChoice) {
  const specificDetail = ACCOUNTING_CHOICE_DETAILS[`${choice.moduleId}.${choice.fieldKey}`]
  if (specificDetail) return specificDetail

  const operation = ACCOUNTING_OPERATION_LABELS[choice.moduleId] || 'esta operación'
  const fieldDetail = ACCOUNTING_FIELD_DETAILS[choice.fieldKey]
  if (fieldDetail) return `Esta cuenta se usa para ${fieldDetail} en ${operation}.`

  return `Esta cuenta se usa para registrar «${choice.label}» en ${operation}.`
}

export function AccountSelectionDialogHost() {
  const [active, setActive] = useState<SelectionRequest | null>(null)
  const [selected, setSelected] = useState<Record<string, string>>({})
  const [choiceIndex, setChoiceIndex] = useState(0)
  const activeRef = useRef<SelectionRequest | null>(null)
  const queue = useRef<SelectionRequest[]>([])

  const advance = (next?: SelectionRequest) => {
    const request = next || queue.current.shift() || null
    activeRef.current = request
    setActive(request)
    setSelected({})
    setChoiceIndex(0)
  }

  useEffect(() => {
    const onSelectionRequired = (event: Event) => {
      const request = (event as CustomEvent<SelectionRequest>).detail
      request.claimed = true
      if (!activeRef.current) advance(request)
      else queue.current.push(request)
    }
    window.addEventListener(ACCOUNT_SELECTION_REQUIRED_EVENT, onSelectionRequired)
    const pendingRequests = queue.current
    return () => {
      window.removeEventListener(ACCOUNT_SELECTION_REQUIRED_EVENT, onSelectionRequired)
      const cancelled = new DOMException('La selección fue cancelada', 'AbortError')
      activeRef.current?.reject(cancelled)
      pendingRequests.splice(0).forEach(request => request.reject(cancelled))
      activeRef.current = null
    }
  }, [])

  const currentChoice = active?.choices[choiceIndex]
  const totalChoices = active?.choices.length || 0
  const remainingChoices = Math.max(0, totalChoices - choiceIndex - 1)
  const canContinue = Boolean(currentChoice)
    && currentChoice!.accounts.some(account => account.code === selected[currentChoice!.key])

  const continueSelection = () => {
    if (!active || !canContinue) return
    if (choiceIndex < totalChoices - 1) {
      setChoiceIndex(index => index + 1)
      return
    }

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
              Cada elección identifica qué parte del asiento contable se registrará en esa cuenta. Revisa el motivo antes de continuar.
            </DialogDescription>
          </DialogHeader>
          <div className="min-w-0 space-y-4">
            <div className="space-y-2" aria-live="polite">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-black text-foreground">Elección {choiceIndex + 1} de {totalChoices}</p>
                <p className="text-xs font-medium text-muted-foreground">
                  {remainingChoices > 0 ? `${remainingChoices} ${remainingChoices === 1 ? 'elección restante' : 'elecciones restantes'} después de esta` : 'Última elección'}
                </p>
              </div>
              <div
                role="progressbar"
                aria-label="Progreso de selección de cuentas"
                aria-valuemin={0}
                aria-valuemax={totalChoices}
                aria-valuenow={choiceIndex + 1}
                className="h-1.5 overflow-hidden rounded-full bg-muted"
              >
                <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${totalChoices ? ((choiceIndex + 1) / totalChoices) * 100 : 0}%` }} />
              </div>
            </div>
            {currentChoice && (
              <label key={currentChoice.key} className="block min-w-0 rounded-xl border border-border/50 bg-card p-4">
                <span className="block text-sm font-bold text-foreground">{currentChoice.label}</span>
                <span className="mt-1.5 block text-xs leading-5 text-muted-foreground">
                  <span className="font-semibold text-foreground">Motivo: </span>{getChoiceDescription(currentChoice)}
                </span>
                <select
                  value={selected[currentChoice.key] || ''}
                  onChange={event => setSelected(previous => ({ ...previous, [currentChoice.key]: event.target.value }))}
                  className="mt-3 h-10 w-full max-w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Cuenta contable para ${currentChoice.label}`}
                >
                  <option value="">Seleccionar cuenta…</option>
                  {currentChoice.accounts.map(account => (
                    <option key={account.code} value={account.code}>{account.code} · {account.name}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={cancel}>Cancelar operación</Button>
            {choiceIndex > 0 && (
              <Button type="button" variant="outline" onClick={() => setChoiceIndex(index => Math.max(0, index - 1))}>
                <ArrowLeft className="mr-2 size-4" /> Anterior
              </Button>
            )}
            <Button type="button" disabled={!canContinue} onClick={continueSelection}>
              {choiceIndex === totalChoices - 1 ? <Check className="mr-2 size-4" /> : null}
              {choiceIndex === totalChoices - 1 ? 'Confirmar cuentas' : <>Siguiente elección <ArrowRight className="ml-2 size-4" /></>}
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  )
}

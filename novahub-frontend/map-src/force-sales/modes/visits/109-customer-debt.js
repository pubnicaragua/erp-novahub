// Modo «Visitas y zonas»: ficha del cliente en el punto (cuánto debe y cuánto lleva al día) y últimas visitas con
// quién las hizo. Los datos se piden al abrir el punto y se guardan un minuto para no consultar en cada repintado.
const pointExtras = new Map();
const POINT_EXTRAS_TTL_MS = 60000;
const VISIT_OUTCOMES = [['VISITADO', 'Visitado'], ['PAGO', 'Pago recibido'], ['PROMESA', 'Promesa de pago'], ['NO_ESTABA', 'No estaba'], ['NO_PAGA', 'Se negó a pagar']];
const VISIT_OUTCOME_LABELS = Object.fromEntries(VISIT_OUTCOMES);

function pointExtrasFor(business){
  const remoteId = stateOf(business).remoteId;
  return remoteId ? pointExtras.get(String(remoteId)) : null;
}
function forgetPointExtras(business){
  const remoteId = business ? stateOf(business).remoteId : '';
  if(remoteId)pointExtras.delete(String(remoteId));
}
function ensurePointExtras(business){
  if(ACTIVE_MODE !== 'visits' || !business)return;
  const state = stateOf(business);
  const remoteId = String(state.remoteId || '');
  if(!remoteId || state.syncPending || !navigator.onLine || !localStorage.getItem('nh-auth-token'))return;
  const current = pointExtras.get(remoteId);
  if(current && (current.loading || Date.now() - current.loadedAt < POINT_EXTRAS_TTL_MS))return;
  pointExtras.set(remoteId, {...(current || {}), loading:true, loadedAt:current?.loadedAt || 0});
  const hasCustomer = Boolean(state.customerId || state.customer?.id);
  const id = encodeURIComponent(remoteId);
  Promise.allSettled([
    hasCustomer && CAN_VIEW_CUSTOMER_SUMMARY ? forceSalesRequest(`/force-sales/prospects/${id}/customer-summary`) : Promise.resolve(null),
    forceSalesRequest(`/force-sales/prospects/${id}/visits?limit=5`),
  ]).then(([debt, visits]) => {
    pointExtras.set(remoteId, {
      loading:false, loadedAt:Date.now(),
      debt:debt.status === 'fulfilled' ? debt.value : null, debtError:debt.status === 'rejected',
      visits:visits.status === 'fulfilled' && Array.isArray(visits.value) ? visits.value : [], visitsError:visits.status === 'rejected',
    });
    if(currentPopupBusinessId && String(stateOf(activeBusinessDetail() || {}).remoteId || '') === remoteId)refreshBusinessDetailOverlay();
  });
}
function debtMoney(amount, currency){
  const symbol = ({NIO:'C$', USD:'US$'})[String(currency || '').toUpperCase()] || `${currency || ''} `;
  return `${symbol}${Number(amount || 0).toLocaleString('es-NI', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
}
function debtDate(value){
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('es-NI', {day:'2-digit', month:'short', year:'numeric'});
}
function customerDebtHtml(business){
  if(ACTIVE_MODE !== 'visits' || !CAN_VIEW_CUSTOMER_SUMMARY)return '';
  const state = stateOf(business);
  if(!(state.customerId || state.customer?.id))return '';
  const extras = pointExtrasFor(business);
  const wrap = body => `<section class="crm customer-debt" aria-label="Estado de cuenta del cliente"><div class="quick-heading">Estado de cuenta</div>${body}</section>`;
  if(!extras || (extras.loading && !extras.debt))return wrap('<div class="meta" role="status">Consultando el saldo del cliente…</div>');
  if(extras.debtError)return wrap('<div class="meta" role="alert">No se pudo consultar el saldo del cliente. Reintenta al reabrir el punto.</div>');
  const debt = extras.debt;
  if(!debt || !debt.linked)return '';
  const rows = (debt.byCurrency || []).length
    ? debt.byCurrency.map(row => `<div class="debt-grid" data-currency="${esc(row.currency)}">
        <div class="debt-cell"><span>Debe</span><b>${esc(debtMoney(row.owed, row.currency))}</b></div>
        <div class="debt-cell ${row.overdue > 0 ? 'debt-overdue' : ''}"><span>Vencido</span><b>${esc(debtMoney(row.overdue, row.currency))}</b></div>
        <div class="debt-cell"><span>Al día</span><b>${esc(debtMoney(row.upToDate, row.currency))}</b></div>
        <div class="debt-cell"><span>Cobrado en 30 días</span><b>${esc(debtMoney(row.paidLast30Days, row.currency))}</b></div>
      </div>`).join('')
    : '<div class="meta">Sin saldo pendiente. El cliente está al día.</div>';
  const facts = [
    debt.oldestOverdue ? `<div class="meta debt-overdue">Factura ${esc(debt.oldestOverdue.number)} con ${esc(debt.oldestOverdue.daysLate)} ${debt.oldestOverdue.daysLate === 1 ? 'día' : 'días'} de atraso · ${esc(debtMoney(debt.oldestOverdue.balance, debt.oldestOverdue.currency))}</div>` : '',
    debt.nextDue ? `<div class="meta">Próximo vencimiento: factura ${esc(debt.nextDue.number)} el ${esc(debtDate(debt.nextDue.dueDate))} · ${esc(debtMoney(debt.nextDue.balance, debt.nextDue.currency))}</div>` : '',
    debt.lastPayment ? `<div class="meta">Último pago: ${esc(debtMoney(debt.lastPayment.amount, debt.lastPayment.currency))} el ${esc(debtDate(debt.lastPayment.date))}</div>` : '<div class="meta">Sin pagos registrados en el último año.</div>',
  ].join('');
  const obligations = [
    ...(debt.credits || []).map(item => ({ ...item, kind: 'CREDIT_NOTE', label: 'Crédito' })),
    ...(debt.loans || []).map(item => ({ ...item, kind: 'CUSTOMER_LOAN', label: 'Préstamo' })),
  ].filter(item => Number(item.balance || 0) > 0.01);
  const contracts = obligations.length ? `<div class="debt-contracts"><div class="meta"><b>Contratos por cobrar</b></div>${obligations.map(item => {
    const overdue = Number(item.overdueBalance || 0);
    const lateDays = Number(item.overdueDays || 0);
    const detail = overdue > 0.01
      ? `Vencido ${debtMoney(overdue, item.currency)}${lateDays ? ` · ${lateDays} ${lateDays === 1 ? 'día' : 'días'} de atraso` : ''}`
      : item.nextInstallment ? `Próxima cuota: ${debtDate(item.nextInstallment.dueDate)} · ${debtMoney(item.nextInstallment.remainingAmount, item.currency)}` : 'Sin atraso';
    const button = CAN_PAY_CUSTOMER_CONTRACTS
      ? `<button type="button" class="visit-action" data-customer-debt-pay="${esc(item.id)}" data-kind="${item.kind}" data-prospect-id="${esc(state.remoteId || '')}" data-customer-name="${esc(debt.customer?.name || '')}">${item.kind === 'CUSTOMER_LOAN' ? 'Registrar abono' : 'Registrar pago'}</button>`
      : '';
    return `<div class="debt-contract"><div class="debt-contract-copy"><b>${esc(item.label)} ${esc(item.number || '')}</b><span>Saldo: ${esc(debtMoney(item.balance, item.currency))}</span><span class="${overdue > 0.01 ? 'debt-overdue' : ''}">${esc(detail)}</span></div>${button}</div>`;
  }).join('')}</div>` : '';
  return wrap(`${rows}${facts}${contracts}`);
}
document.addEventListener('click', event => {
  const button = event.target?.closest?.('[data-customer-debt-pay]');
  if (!button || !CAN_PAY_CUSTOMER_CONTRACTS || window.parent === window) return;
  event.preventDefault();
  window.parent.postMessage({
    source: 'novahub-force-sales',
    type: 'force-sales-open-payment',
    recordId: String(button.dataset.customerDebtPay || ''),
    kind: String(button.dataset.kind || ''),
    prospectId: String(button.dataset.prospectId || ''),
    customerName: String(button.dataset.customerName || ''),
  }, location.origin);
});
window.addEventListener('message', event => {
  if (event.source !== window.parent || event.origin !== window.location.origin || event.data?.source !== 'novahub-force-sales' || event.data?.type !== 'force-sales-customer-summary-refresh') return;
  const prospectId = String(event.data.prospectId || '');
  if (!prospectId) return;
  pointExtras.delete(prospectId);
  const business = businesses.find(item => String(stateOf(item).remoteId || '') === prospectId);
  if (business) ensurePointExtras(business);
});
function visitHistoryHtml(business){
  if(ACTIVE_MODE !== 'visits')return '';
  const extras = pointExtrasFor(business);
  if(!extras || extras.loading && !extras.visits)return '';
  if(extras.visitsError)return '';
  const visits = extras.visits || [];
  const body = visits.length
    ? visits.map(visit => `<div class="visit-row"><b>${esc(new Date(visit.visitedAt).toLocaleString('es-NI', {dateStyle:'short', timeStyle:'short'}))}</b><span>${esc(visit.visitedByName || 'Responsable no disponible')}${visit.outcome ? ` · ${esc(VISIT_OUTCOME_LABELS[visit.outcome] || visit.outcome)}` : ''}</span>${visit.notes ? `<small>${esc(visit.notes)}</small>` : ''}</div>`).join('')
    : '<div class="meta">Todavía no hay visitas registradas a este punto.</div>';
  return `<section class="crm visit-history" aria-label="Últimas visitas"><div class="quick-heading">Últimas visitas</div>${body}</section>`;
}
function visitOutcomeSelectHtml(sid){
  if(ACTIVE_MODE !== 'visits' || !canForceSales('registerVisit'))return '';
  return `<select id="visit-outcome-${sid}" class="visit-outcome" aria-label="Resultado de la visita"><option value="">Resultado…</option>${VISIT_OUTCOMES.map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select>`;
}

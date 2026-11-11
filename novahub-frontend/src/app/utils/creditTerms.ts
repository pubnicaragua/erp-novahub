const dateOnly = (value: string | Date | null | undefined): string | null => {
  if (!value) return null;
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
};

export function addCreditDays(issueDate: string | Date, creditDays: number): string | null {
  const normalizedIssueDate = dateOnly(issueDate);
  const days = Number(creditDays);
  if (!normalizedIssueDate || !Number.isInteger(days) || days < 0) return null;
  const [year, month, day] = normalizedIssueDate.split('-').map(Number);
  const deadline = new Date(Date.UTC(year, month - 1, day + days));
  return deadline.toISOString().slice(0, 10);
}

export function getCreditTermDeadline(
  issueDate: string | Date | null | undefined,
  creditDays: number | null | undefined,
  savedDeadline?: string | Date | null,
): string | null {
  const snapshot = dateOnly(savedDeadline);
  if (snapshot) return snapshot;
  if (!issueDate || creditDays === null || creditDays === undefined) return null;
  return addCreditDays(issueDate, Number(creditDays));
}

export function getCreditTermExtensionDays(selectedDueDate: string | Date | null | undefined, deadline: string | Date | null | undefined): number {
  const selected = dateOnly(selectedDueDate);
  const pactDeadline = dateOnly(deadline);
  if (!selected || !pactDeadline) return 0;
  const [selectedYear, selectedMonth, selectedDay] = selected.split('-').map(Number);
  const [deadlineYear, deadlineMonth, deadlineDay] = pactDeadline.split('-').map(Number);
  const selectedUtc = Date.UTC(selectedYear, selectedMonth - 1, selectedDay);
  const deadlineUtc = Date.UTC(deadlineYear, deadlineMonth - 1, deadlineDay);
  return Math.max(0, Math.round((selectedUtc - deadlineUtc) / 86400000));
}

export function formatCreditTermDate(value: string | Date): string {
  const normalized = dateOnly(value);
  if (!normalized) return '';
  const [year, month, day] = normalized.split('-').map(Number);
  return new Intl.DateTimeFormat('es-NI', { dateStyle: 'medium', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, day)));
}

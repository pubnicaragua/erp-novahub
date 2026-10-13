interface KpiSummaryNoticeProps {
  loading?: boolean;
  error?: boolean;
}

export function KpiSummaryNotice({ loading = false, error = false }: KpiSummaryNoticeProps) {
  if (!loading && !error) return null;
  return (
    <p
      className="text-xs text-muted-foreground"
      role={error ? 'alert' : 'status'}
      aria-live={error ? 'assertive' : 'polite'}
    >
      {loading ? 'Calculando indicadores para los filtros aplicados…' : 'No se pudieron calcular los indicadores.'}
    </p>
  );
}

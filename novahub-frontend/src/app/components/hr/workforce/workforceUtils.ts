/** Mensaje legible de un error de la API para mostrar en un aviso. */
export const failure = (error: unknown): string => {
  const data = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  return (Array.isArray(data) ? String(data[0]) : data?.toString?.()) || (error as Error)?.message || 'No se pudo completar la acción.';
};

export const dayLabel = (key: string, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) => new Date(`${key}T12:00:00`).toLocaleDateString('es-NI', options);

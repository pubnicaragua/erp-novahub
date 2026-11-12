# Guía de tipografía para la interfaz de NovaHub

Esta guía fija la tipografía que se debe aplicar cuando el usuario solicite cambiar o ajustar las fuentes de una vista. La referencia visual es el dashboard ejecutivo de NovaHub y las familias ya cargadas en `Frontend/novahub-frontend/src/styles/fonts.css`.

Cuando el usuario pida explícitamente un cambio de fuentes, aplica estas reglas como criterio tipográfico para esa tarea; las demás reglas visuales de `DESIGN_GUIDE.md` siguen vigentes.

## Familias

- **Playfair Display**: títulos de vistas y secciones, encabezados de diálogos, etiquetas de KPI e indicadores, y valores numéricos que se presentan como indicadores destacados.
- **Montserrat**: texto del cuerpo, descripciones, ayuda, formularios, botones, nombres y detalles operativos, mensajes, tablas, leyendas de columnas, fechas, estados y metadatos.

## Jerarquía recomendada

1. Usa `nh-module-title` para el título principal de una vista o diálogo.
2. Usa `nh-section-title` para encabezados de secciones y títulos secundarios.
3. Usa `nh-indicator-value` para cifras de KPI o indicadores que deban destacar.
4. Mantén el resto del contenido en Montserrat, que es la familia global de la aplicación.

```tsx
<h1 className="nh-module-title">Resumen ejecutivo</h1>
<h2 className="nh-section-title">Ventas del período</h2>
<p className="text-sm text-muted-foreground">Detalle y contexto en Montserrat.</p>
<span className="nh-indicator-value">128</span>
```

## Reglas de aplicación

- Conserva la jerarquía visual del dashboard: Playfair Display aporta énfasis a títulos e indicadores; Montserrat mantiene legibles los detalles de trabajo.
- Aplica las fuentes de forma semántica y acotada a la vista solicitada. No cambies la tipografía global por una petición local.
- No uses Playfair Display en textos largos, celdas de tablas, etiquetas pequeñas, formularios ni mensajes de conversación.
- Reutiliza los tokens y clases existentes; evita declarar fuentes distintas en línea o crear familias paralelas.
- Verifica que los estilos mantengan el contraste y la legibilidad en modo claro y oscuro, y que los títulos puedan envolver en pantallas pequeñas.

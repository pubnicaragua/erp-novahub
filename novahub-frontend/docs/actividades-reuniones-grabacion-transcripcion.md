# Reuniones: grabación y transcripción automática — diseño y decisiones pendientes

Estado: **solo diseño. No se construyó nada ni se contrató ningún servicio.** Requiere una decisión de Edxel porque implica gasto recurrente y enviar el audio de las reuniones a un tercero.

> Nota: en el código actual de Reuniones **no existe una función de «minuta»** (se buscó en frontend y backend). Hoy una reunión permite agendar, invitar, enlazar Meet/Teams/Zoom, compartir por WhatsApp/QR y descargar el `.ics`. La minuta sería el resultado natural de esta función (transcripción → resumen editable), así que se propone construirla junto con ella.

## 1. Qué se quiere lograr

1. Que de una reunión quede el **audio** y su **transcripción** (texto con quién habló y cuándo, si el proveedor lo permite).
2. Que de la transcripción salga una **minuta editable** (acuerdos, responsables, fechas) que se pueda guardar en la Bitácora o convertir en tareas.
3. Que todo esté **dentro del ERP**, con permisos, en la reunión que corresponde, sin buscar archivos sueltos.

## 2. Formas de obtener el audio (de menor a mayor complejidad)

| Opción | Cómo funciona | Pros | Contras |
|---|---|---|---|
| **A. Subir una grabación** | La persona sube el archivo que ya grabó (Meet/Teams/Zoom o el celular) a la reunión | Casi sin riesgo técnico; no hay captura en el navegador; el consentimiento ya se manejó en la plataforma | Un paso manual |
| **B. Grabar en el navegador (micrófono)** | Botón «Grabar» en la reunión; usa `MediaRecorder` (webm/opus) | Sirve para reuniones presenciales; todo en el ERP | Solo captura el micrófono de esa computadora |
| **C. Grabar el audio de la pestaña** | `getDisplayMedia` con audio (Chrome/Edge) para capturar Meet/Teams en el navegador | Cubre reuniones virtuales sin salir del ERP | Solo Chrome/Edge de escritorio; la persona debe marcar «compartir audio»; frágil |
| **D. Traer la transcripción de la plataforma** | Usar la integración que ya existe con Google Meet/Teams/Zoom (OAuth) para descargar la grabación o su transcripción | Sin costo de transcripción propio | Cada plataforma lo exige en su plan de pago y con permisos del organizador; depende de tres APIs |
| **E. Bot que entra a la reunión** | Servicio externo que se une como participante | Funciona con cualquier plataforma | Más caro (≈ 0.5–1 US$ por hora), privacidad visible para todos |

**Recomendación:** empezar por **A + B** (subir o grabar) y dejar **D** para una segunda fase si el cliente ya paga el plan que lo permite. C y E solo si hay demanda real.

## 3. Proveedor de transcripción y costo

Precios de referencia **aproximados, a verificar antes de contratar** (cambian):

| Proveedor | Precio aprox. | Español | Quién habló | Nota |
|---|---|---|---|---|
| OpenAI `gpt-4o-mini-transcribe` | ≈ 0.003 US$/min | Sí | No | El más barato de buena calidad |
| OpenAI `whisper-1` / `gpt-4o-transcribe` | ≈ 0.006 US$/min | Sí | No (`gpt-4o-transcribe-diarize` sí) | Muy usado, simple |
| Deepgram Nova | ≈ 0.004–0.005 US$/min | Sí | Sí | Rápido; buena diarización |
| AssemblyAI | ≈ 0.0025–0.006 US$/min | Sí | Sí | Resumen y capítulos opcionales |
| Whisper propio (faster-whisper) | Costo del servidor | Sí | No | Sin enviar audio a terceros, pero exige un servidor con GPU o muy lento en CPU; no cabe en Render económico |

**Ejemplo de gasto:** 10 reuniones por semana de 45 min ≈ 32 h al mes ≈ 1 950 min.
- A 0.003 US$/min ≈ **6 US$/mes**; a 0.006 US$/min ≈ **12 US$/mes**, por empresa.
- Resumir con un modelo de lenguaje cada transcripción añade centavos por reunión.

**Recomendación:** `gpt-4o-mini-transcribe` (o Deepgram si se quiere identificar quién habla) detrás de una **llave por empresa** y una **cuota de minutos al mes por plan**, para que el gasto no se dispare y se pueda cobrar.

## 4. Dónde se guarda el audio

- Almacenamiento privado ya existente (Supabase Storage con URL firmada y vencimiento), en un propósito nuevo `meeting-recordings`; ruta `empresa/reunión/archivo`.
- Tamaño: audio webm/opus ≈ **14 MB por hora**; un video de Meet/Teams ≈ 300–700 MB por hora, por eso se recomienda **extraer solo el audio** o pedir audio.
- Límite sugerido por archivo: 200 MB (≈ 4 h de audio). Cuenta contra el almacenamiento del plan (hoy la Bitácora usa 1 GB por empresa).
- **Retención configurable** por empresa (sugerido 90 días): pasado ese plazo se borra el audio y se **conserva la transcripción y la minuta**.

## 5. Permisos

Nuevas acciones en el módulo `ACTIVITIES_MEETINGS` (hoy: leer, crear, editar, eliminar, completar, cancelar, invitados, invitaciones, agendar, exportar):

- `record`: grabar o subir una grabación.
- `viewRecording`: escuchar/descargar el audio.
- `viewTranscript`: ver la transcripción y la minuta.

Por defecto: super admin y quien organiza la reunión. **Los invitados externos no ven nada.** Toda lectura se valida en el backend por empresa y sucursal, igual que el resto de Actividades.

## 6. Consentimiento y privacidad

- Aviso obligatorio **antes de grabar**: «Esta reunión se grabará y transcribirá», con casilla de confirmación del organizador (queda registrado quién y cuándo).
- Las leyes sobre grabar conversaciones varían por país; la empresa es responsable de avisar a los participantes. Se recomienda que el aviso quede escrito en la invitación.
- El audio se envía al proveedor solo para transcribir; elegir un plan **sin retención ni entrenamiento con los datos**.
- La transcripción puede contener datos sensibles: no se muestra en notificaciones ni en listados, solo dentro de la reunión.

## 7. Modelo de datos propuesto

`MeetingRecording`: `id`, `clientTenantId`, `activityId` (la reunión), `uploadedById`, `fileUrl`, `mimeType`, `sizeBytes`, `durationSeconds`, `status` (`UPLOADED` → `TRANSCRIBING` → `READY` | `FAILED`), `provider`, `language`, `transcriptText`, `segments` (JSON con hablante y minuto), `minutesDraft`, `consentConfirmedById`, `consentConfirmedAt`, `retentionUntil`, `estimatedCostUsd`, `errorMessage`, `createdAt`.

Flujo: subir/grabar → guardar archivo → trabajo en segundo plano (con reintentos) → llamar al proveedor → guardar texto → generar minuta (opcional, con costo aparte) → la persona la edita → se guarda en la Bitácora o se crean tareas.

## 8. Decisiones que necesito de Edxel

1. **¿Se acepta enviar el audio a un tercero?** Si no, la única vía es Whisper propio (requiere servidor).
2. **Proveedor:** ¿OpenAI (más simple y barato) o Deepgram/AssemblyAI (identifican quién habló)?
3. **Quién paga:** ¿lo absorbe NovaHub o se cobra por minutos/plan? (define la cuota mensual).
4. **Alcance de la primera fase:** ¿subir grabación + grabar con micrófono (A + B)? ¿Incluir la minuta con resumen automático?
5. **Retención del audio:** ¿90 días? ¿Se conserva la transcripción para siempre?
6. **Idiomas:** ¿solo español o también inglés?
7. **Consentimiento:** ¿se acepta el aviso con casilla del organizador como requisito?

Cuando se decida, la construcción estimada de la fase 1 es: permiso + modelo + subida/grabación + trabajo de transcripción + pantalla en la reunión con reproductor y texto buscable + minuta editable.

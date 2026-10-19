# Apariencia global y por documento para PDF

**Estado:** aprobada por el usuario; pendiente del plan de implementación
**Aprobación conversacional:** recibida para el enfoque de alcance global por sucursal y personalización por PDF
**Implementación:** no iniciada; requiere aprobación de esta especificación

## 1. Objetivo

Permitir que la apariencia de los PDF de NovaHub se configure una vez para todos los documentos de la sucursal activa o, cuando haga falta, se personalice para un PDF específico. El diseño debe seguir siendo consistente entre la vista previa, la descarga y la impresión.

La configuración común incluirá el tipo de letra de todo el documento y las opciones visuales que ya existen para los diseños PDF. El usuario podrá decidir si aplica un cambio a todos los PDF de la sucursal o únicamente al diseño actual.

## 2. Alcance confirmado

- El alcance global comprende todos los PDF de la **sucursal activa**. No se comparte automáticamente con otras sucursales.
- El alcance por documento afecta únicamente la vista/acción PDF seleccionada y la sucursal propietaria de ese diseño.
- La apariencia global es la base por defecto de los documentos de esa sucursal.
- Un ajuste local explícito prevalece sobre el ajuste global correspondiente.
- Los diseños existentes y sus personalizaciones se deben conservar.
- La fuente elegida se aplica a todo el documento: encabezado, datos, títulos, tablas, totales, notas configurables y pie. No cambia el peso, tamaño semántico, cursiva ni alineación que cada elemento ya necesite.
- Los formatos físicos especializados (por ejemplo, tickets y etiquetas con medidas fijas) mantienen sus restricciones de tamaño y distribución. No se deben deformar para adoptar el lienzo de un PDF normal. En esta primera etapa, la configuración visual compartida solo se aplica a los destinos editables del catálogo que usan el renderizador común; se debe identificar claramente cualquier destino especializado excluido.

## 3. Modelo de herencia

Para cada propiedad visual, el valor efectivo se resuelve así:

1. Valor local del documento, cuando el usuario lo haya establecido explícitamente.
2. Valor global de apariencia de la sucursal activa.
3. Valor por defecto de NovaHub.

La ausencia de un valor local significa **heredar**; no se debe guardar una copia del valor global como si fuera una personalización local. Esto permite que futuros cambios globales se reflejen en todos los documentos que sigan heredando.

### Cambios de alcance

El editor ofrecerá una opción clara para aplicar los ajustes al documento actual o a todos los PDF de la sucursal. La elección de alcance deberá preceder al guardado/aplicación y mostrar el alcance afectado. No se actualizarán documentos de otras sucursales.

En un documento que tenga una personalización local, el usuario podrá usar **Restablecer a apariencia global** para borrar solo los overrides de apariencia de ese documento. No se borrará su contenido, estructura, tamaño de papel ni orientación.

### Diseños existentes

La adopción no debe sobreescribir personalizaciones existentes. Antes de migrar o interpretar valores actuales, se distinguirán:

- ajustes que coinciden con los valores estándar vigentes y pueden comenzar a heredar;
- personalizaciones no estándar que deben permanecer como overrides locales;
- propiedades cuya procedencia no pueda determinarse con seguridad, las cuales se conservarán localmente hasta que el usuario las restablezca.

No se hará una migración masiva que elimine valores existentes. Si durante la implementación no es posible clasificar una propiedad de manera confiable, se mantiene el valor y se documenta la limitación.

## 4. Propiedades de apariencia

### Compartidas por sucursal y opcionalmente sobrescribibles por documento

- Composición del encabezado: datos y logotipo a izquierda/derecha, logotipo a izquierda y datos a derecha, o composición centrada.
- Espacio posterior al encabezado: pequeño, mediano o grande.
- Familia tipográfica de todo el documento.
- Tamaño base de fuente del documento, si la implementación confirma que se puede aplicar sin romper jerarquías, tablas o paginación. La jerarquía relativa de títulos y etiquetas se conserva.
- Colores de identidad y presentación ya soportados por el motor PDF.
- Apariencia compartida de tablas, encabezados, alineación y pie, donde el destino use el renderizador común.

La configuración por documento debe poder sobrescribir cada propiedad compartida por separado. Por ejemplo, personalizar la fuente localmente no debe impedir heredar el espacio posterior al encabezado.

### Propiedades por documento

Permanecen propias del diseño/documento:

- tamaño de papel y orientación;
- estructura y orden del contenido específico de esa vista;
- campos de datos, agrupaciones y columnas propias del reporte;
- contenido, filtros y valores del documento;
- medidas físicas requeridas por tickets o etiquetas.

Estas propiedades no se alteran al cambiar la apariencia global ni al restablecer apariencia global.

## 5. Selector de fuentes

Se incluirá una variedad amplia y legible, organizada por familias:

- **Sans serif:** Inter, Roboto, Open Sans, Lato, Montserrat, Nunito Sans, Source Sans 3, Work Sans y opciones equivalentes disponibles en el paquete local.
- **Serif:** Merriweather, Lora, Playfair Display, Source Serif 4 y opciones equivalentes.
- **Monoespaciadas:** IBM Plex Mono, JetBrains Mono, Source Code Pro y opciones equivalentes.

La lista final se validará contra las fuentes que se incorporen al frontend; no se ofrecerá una fuente que no esté realmente disponible en renderizado PDF. Las fuentes se empaquetarán/localizarán en el proyecto para hacer predecible la salida sin depender de una conexión externa al generar el PDF. El selector mostrará muestras de texto y el nombre de cada familia.

No se permitirá subir archivos de fuentes personalizadas en esta primera versión.

La fuente elegida debe prevalecer sobre la familia heredada de estilos embebidos o nodos importados, salvo que el usuario haya elegido explícitamente una personalización de fuente para un elemento, si el producto decide soportar esa excepción más adelante. En esta primera versión, la familia configurada es global al documento y los estilos individuales solo conservan peso, cursiva, tamaño relativo y demás formato semántico.

Antes de capturar/renderizar el PDF, el motor debe esperar a que las fuentes seleccionadas estén listas. Esto aplica tanto a la vista previa como a la descarga/impresión para evitar sustituciones o cambios de paginación por carga tardía.

## 6. Persistencia y API

### Perfil global de apariencia

- Guardar el perfil global usando la persistencia existente de ajustes del sistema, con clave separada de la identidad de empresa, por ejemplo `group=pdf`, `key=appearance-profile`.
- La clave debe ser independiente de `company-profile`, porque los datos legales/contacto de empresa y la apariencia del documento tienen ciclos de edición distintos.
- No se planea una migración de esquema para esta función. Se debe verificar cómo se evita o resuelve la duplicación de filas, pues `SystemSetting` no impone unicidad por tenant/grupo/clave.
- El tenant y la sucursal se derivan del contexto autenticado/alcance validado por backend; nunca se aceptan como autoridad desde el cuerpo del cliente.

### Contrato propuesto

- `GET /pdf-document-designs/appearance-profile`: devuelve los ajustes explícitos guardados para la sucursal autenticada; si no existe perfil, devuelve un objeto vacío. El frontend combina cada propiedad ausente con el valor por defecto vigente del diseño de destino para no alterar la apariencia actual.
- `PATCH /pdf-document-designs/appearance-profile`: valida y guarda una actualización parcial del perfil de esa sucursal. Enviar `null` para una propiedad elimina solo ese ajuste global y restaura el valor por defecto vigente.
- Los endpoints permanecen protegidos por autenticación y permisos `CONFIG_PDF`; lectura y edición respetan las capacidades existentes para ver/configurar diseños PDF.
- Los valores desconocidos, familias de fuentes no permitidas, enums inválidos y payloads fuera del tamaño esperado se rechazan con errores de validación claros.
- El endpoint no permite consultar o actualizar otra sucursal por ID arbitrario.

### Overrides locales

- Guardar los overrides locales dentro de `PdfDocumentDesign.settings`, distinguiendo explícitamente una propiedad heredada de una personalización local.
- No duplicar la API de identidad global ni mezclar el perfil de apariencia con los datos de la empresa.
- Al guardar un diseño local, persistir solo las propiedades efectivamente personalizadas; al restablecer, eliminarlas para que vuelvan a heredar.

## 7. Resolución y renderizado frontend

- Incorporar una única resolución de apariencia efectiva que combine defaults, perfil global de la sucursal y overrides locales.
- Usar la misma resolución desde el editor, la vista previa, las exportaciones semánticas y la impresión que comparten el renderizador PDF.
- Invalidar/refrescar la caché de diseños y apariencia tras guardar el perfil global o el documento local.
- Aplicar tipografía y opciones visuales al estilo del documento completo, incluidos los estilos HTML/estilos de diseño importados, sin cambiar el contenido de datos ni las medidas específicas del destino.
- Manejar ausencia de perfil global, diseño legado, fuente no cargable y destinos especializados con defaults seguros y legibles.
- Los cambios de apariencia deben reflejarse en vista previa antes de guardar y no afectar los PDF ya descargados.

## 8. Experiencia de configuración

- Mantener la identidad global de empresa separada de la sección de apariencia global.
- En el editor de diseños, indicar con claridad qué ajustes se heredan y cuáles son personalizados para este PDF.
- El selector de alcance debe mostrar el efecto: **Todos los PDF de esta sucursal** o **Solo este PDF**.
- Al editar un ajuste heredado en modo de documento, convertir únicamente ese ajuste en override local.
- Ofrecer una acción por propiedad o una acción agrupada para volver a heredar, con confirmación solo cuando sea necesario para explicar que el override local se eliminará.
- Mostrar en la previsualización la fuente y la composición actuales. La previsualización debe usar las mismas reglas de producción que el PDF final.
- No añadir controles para subir fuentes, crear temas arbitrarios ni cambiar contenido de negocio dentro de la configuración global.

## 9. Seguridad y aislamiento

- Todo perfil global se aísla por tenant y sucursal activa.
- Backend deriva el alcance del usuario autenticado y valida los permisos antes de leer o modificar.
- El frontend no es autoridad para tenant, sucursal, permisos ni familias de fuentes aceptadas.
- La caché del frontend debe incluir tenant/sucursal en su clave y limpiarse al cambiar de alcance o cerrar sesión para no cruzar apariencias entre sucursales.

## 10. Verificación requerida al implementar

La evidencia se reportará por capa, sin confundir compilación con uso real:

1. **Backend:** pruebas del servicio/controlador para lectura y actualización del perfil, valores por defecto, validación, permisos y aislamiento entre tenants/sucursales; confirmar el comportamiento de upsert ante filas repetidas.
2. **Frontend:** pruebas unitarias del resolver para las tres capas de precedencia, defaults, eliminación de override y validación de fuentes.
3. **Renderizado:** comprobar vista previa y PDF final con una muestra representativa de documentos comerciales y reportes; verificar que fuente, composición, espaciado y tablas sean iguales en ambas salidas.
4. **Diseños existentes:** confirmar que diseños personalizados se conservan y que los valores estándar pueden heredar sin perder contenido, estructura, orientación ni papel.
5. **Formatos especializados:** confirmar explícitamente cuáles quedan excluidos y que sus dimensiones no cambian.
6. **UI:** probar configuración y editor en móvil, tablet y escritorio, y verificar modo oscuro, teclado y foco visible.
7. **Compilación:** build de frontend y backend, más pruebas relacionadas con los cambios. Si se ejecuta en navegador o contra servicios levantados, registrar esa evidencia por separado.

No se modificarán otros módulos ni se tocarán cambios locales ajenos a esta funcionalidad.

## 11. Fuera de alcance

- Subir o administrar fuentes propias.
- Sincronizar apariencia entre todas las sucursales de una empresa.
- Cambiar tamaño de papel, orientación, campos, datos, contenido, cálculos o estructura de los documentos mediante el ajuste global.
- Rediseñar individualmente todos los PDF; la función establece una base reutilizable y conserva excepciones estructurales propias de cada vista.
- Cambiar tickets o etiquetas de formato fijo para que usen medidas de página convencionales.
- Alterar documentos PDF ya generados o descargados.

## 12. Preguntas que puede señalar la revisión

La implementación debe confirmar técnicamente antes de cerrar el alcance:

- el nombre final de la configuración en la interfaz;
- la lista exacta de fuentes que el paquete permite renderizar con fidelidad y su licencia;
- la lista concreta de destinos que usan el renderizador común frente a motores especializados;
- la clasificación de ajustes guardados actualmente como defaults heredables o personalizaciones locales.

Estas verificaciones no cambian la regla de alcance aprobada: global para PDF de la sucursal activa o local para un único PDF.

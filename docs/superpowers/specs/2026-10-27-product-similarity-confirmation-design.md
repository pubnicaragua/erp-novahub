# Confirmación para productos posiblemente similares

## Intención

Evitar que un aviso de similitud se sienta como un bloqueo o un rechazo. La alerta debe dejar claro que es una sugerencia, mostrar el registro encontrado y permitir editarlo o confirmar la creación de un registro nuevo.

## Enfoques considerados

1. **Conservar las coincidencias actuales y confirmar la decisión** — seleccionado por el usuario. Mantiene las detecciones actuales por SKU/nombre y presenta acciones explícitas para editar el encontrado o crear uno nuevo. Conserva cobertura amplia y puede mostrar falsos positivos, pero no impide continuar.
2. **Reducir coincidencias a SKU o nombre idéntico normalizado.** Reduce falsos avisos, pero deja de señalar nombres realmente parecidos.
3. **Detectar solo SKU exacto.** Minimiza avisos, pero pierde la revisión por nombre.

## Diseño seleccionado

- La alerta dirá que el producto **parece** similar y no afirmará que sea duplicado.
- Para una coincidencia no exacta de SKU, ofrecerá **Editar existente** y **Crear producto nuevo**.
- Elegir editar abrirá el producto encontrado en `EditProductModal`, también desde la pantalla dedicada de alta.
- Elegir crear confirmará explícitamente el alta nueva y conservará todos los datos introducidos hasta que el guardado tenga éxito.
- Un SKU exacto seguirá sin permitir una segunda creación con ese mismo código; la acción disponible será editar el existente.

## Alcance y límites

- Incluye el flujo de alta de productos en `AddProductsModal` y `CrearProductoView`, y su conexión con la edición existente.
- Mantiene sin cambios el algoritmo actual de búsqueda de similitud y la validación backend.
- No modifica productos ni datos de Full Car, y no despliega cambios.

## Verificación

- Prueba de flujo: coincidencia por nombre con SKU distinto, edición del encontrado, creación confirmada y retención de datos ante un rechazo.
- Ejecutar lint focalizado y build frontend; usar el entorno E2E aislado para navegador y persistencia si está configurado.

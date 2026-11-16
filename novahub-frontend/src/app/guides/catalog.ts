import type { ErpGuide } from './types';

/**
 * Catálogo de guías paso a paso. Reglas para escribirlas:
 * - Lenguaje sencillo, una acción por paso, con el nombre exacto del botón.
 * - `to` lleva a la pantalla (módulo/submódulo de la URL); `target` resalta el botón.
 * - Si un paso ocurre dentro de un formulario y no hay un ancla fiable, se deja sin `target`.
 * El script `scripts/check-guides.mjs` comprueba que cada `to` exista en el menú.
 */
export const ERP_GUIDES: ErpGuide[] = [
  // ─── Ventas ──────────────────────────────────────────────────────────
  {
    id: 'ventas-crear-cliente', area: 'Ventas', module: 'ventas', title: 'Registrar un cliente nuevo',
    keywords: ['ingresar cliente', 'ingreso un cliente', 'crear cliente', 'agregar cliente', 'registrar cliente', 'nuevo cliente', 'dar de alta un cliente', 'clientes'],
    summary: 'Crea la ficha del cliente con sus datos fiscales, contacto, crédito y lista de precios.',
    steps: [
      { to: 'ventas/clientes', target: '[data-tour="customers-new"]||text:Nuevo cliente', text: 'En Ventas → Clientes, presiona «Nuevo cliente».' },
      { text: 'Escribe el nombre, elige si es persona o empresa y su identificación (cédula o RUC).' },
      { text: 'Agrega teléfono, correo y dirección. Si le vas a dar crédito, escribe el límite y los días de plazo.', tip: 'Si el cliente compra a precio especial, elige su lista de precios aquí y se aplicará sola en cotizaciones y facturas.' },
      { text: 'Presiona «Guardar». El cliente ya aparece en la lista y en las facturas.' },
    ],
  },
  {
    id: 'ventas-importar-clientes', area: 'Ventas', module: 'ventas', title: 'Importar varios clientes desde Excel',
    keywords: ['importar clientes', 'subir clientes', 'clientes desde excel', 'cargar clientes', 'plantilla de clientes'],
    summary: 'Carga muchos clientes de una vez con la plantilla de Excel.',
    steps: [
      { to: 'ventas/clientes', target: '[data-tour="customers-import"]||text:Importar clientes', text: 'En Ventas → Clientes, presiona «Importar clientes».' },
      { text: 'Descarga la plantilla, llénala en Excel (una fila por cliente) y guárdala.' },
      { text: 'Sube el archivo. El sistema te muestra cada fila y marca en rojo lo que falta corregir.' },
      { text: 'Corrige lo marcado y confirma con «Crear clientes».' },
    ],
  },
  {
    id: 'ventas-facturar', area: 'Ventas', module: 'ventas', title: 'Hacer una factura',
    keywords: ['facturar', 'hacer una factura', 'crear factura', 'emitir factura', 'nueva factura', 'le facturo', 'facturarle a un cliente', 'vender'],
    summary: 'Emite una factura a un cliente, al contado o al crédito, y registra el pago.',
    steps: [
      { to: 'ventas/facturas', target: 'text:Nueva Factura', text: 'En Ventas → Facturas, presiona «Nueva Factura».' },
      { target: '[data-tour="sales-form-data"]', text: 'Elige el cliente, revisa la fecha, la moneda y el vendedor. Si es al crédito, revisa la fecha de vencimiento.' },
      { target: '[data-tour="sales-form-items"]', text: 'Agrega lo que vendes con «Agregar Producto» o «Agregar Servicio». Revisa cantidad y precio de cada línea.', tip: 'El precio sale de la lista de precios del cliente. Puedes cambiarlo en la línea si tienes permiso.' },
      { target: '[data-tour="sales-form-summary"]', text: 'Revisa el subtotal, descuento, IVA y total.' },
      { target: 'text:Emitir factura||[data-tour="sales-form-actions"]', text: 'Presiona «Emitir factura» (o «Guardar Borrador» si aún no está lista).', tip: 'Para cobrarla, en la lista de Facturas usa el botón de pago de su fila: puedes registrar pago completo, parcial o mixto, o enviar el saldo a crédito.' },
    ],
  },
  {
    id: 'ventas-facturar-caja', area: 'Ventas', module: 'ventas', title: 'Vender desde la caja (punto de venta)',
    keywords: ['facturacion por caja', 'punto de venta', 'pos', 'vender en caja', 'cobrar en caja', 'abrir caja', 'aperturar caja', 'caja registradora'],
    summary: 'Abre la caja con el fondo inicial, agrega productos al carrito y cobra.',
    requires: 'Necesitas tener una caja asignada a tu usuario. Si no ves ninguna, pide al administrador que te asigne una en Control de Caja.',
    steps: [
      { to: 'ventas/facturacion-caja', text: 'Ve a Ventas → Facturación por caja y elige tu caja.' },
      { target: 'text:Aperturar Caja', text: 'Si la caja está cerrada, cuenta los billetes y monedas del fondo inicial y presiona «Aperturar Caja».' },
      { target: '[data-tour="pos-catalog"]', text: 'Busca los productos y agrégalos al carrito.' },
      { target: '[data-tour="pos-customer"]', text: 'Si el cliente lo pide, elígelo; si no, se factura a consumidor final.' },
      { target: '[data-tour="pos-pay"]||text:Cobrar venta', text: 'Presiona «Cobrar venta», indica cómo paga (efectivo, tarjeta, transferencia o mixto) y confirma.' },
    ],
  },
  {
    id: 'ventas-cerrar-caja', area: 'Ventas', module: 'ventas', title: 'Cerrar la caja al final del día',
    keywords: ['cerrar caja', 'cierre de caja', 'arqueo', 'cuadrar caja', 'corte de caja'],
    summary: 'Cuenta el efectivo, compara con lo vendido y cierra la sesión de caja.',
    steps: [
      { to: 'ventas/facturacion-caja', text: 'Ve a Ventas → Facturación por caja con tu caja abierta.' },
      { target: 'text:Cerrar Caja', text: 'Presiona «Cerrar Caja».' },
      { text: 'Cuenta los billetes y monedas que hay en la gaveta y escríbelos por denominación.' },
      { text: 'Revisa la diferencia entre lo contado y lo esperado, agrega una nota si hay faltante o sobrante, y confirma el cierre.' },
      { to: 'ventas/control-caja', text: 'En Ventas → Control de Caja puedes ver el historial de aperturas, arqueos y cierres de todas las cajas.' },
    ],
  },
  {
    id: 'ventas-crear-caja', area: 'Ventas', module: 'ventas', title: 'Crear una caja y asignar cajeros',
    keywords: ['crear caja', 'nueva caja', 'asignar cajero', 'agregar caja', 'administrar cajas'],
    summary: 'Configura una caja y define qué usuarios pueden operarla.',
    steps: [
      { to: 'ventas/control-caja', target: '[data-tour="cash-control-manage"]', text: 'En Ventas → Control de Caja, abre la administración de cajas.' },
      { text: 'Crea la caja con un nombre y código fáciles de reconocer, y elige su sucursal.' },
      { text: 'Asigna los usuarios que podrán abrirla y cobrar en ella. Guarda.' },
    ],
  },
  {
    id: 'ventas-cotizar', area: 'Ventas', module: 'ventas', title: 'Hacer una cotización (proforma)',
    keywords: ['cotizar', 'cotizacion', 'proforma', 'presupuesto a un cliente', 'nueva cotizacion', 'estimacion'],
    summary: 'Prepara una propuesta para el cliente y, cuando la acepte, conviértela en orden de venta.',
    steps: [
      { to: 'ventas/estimaciones', target: 'text:Nueva Cotización', text: 'En Ventas → Cotizaciones, presiona «Nueva Cotización».' },
      { target: '[data-tour="sales-form-data"]', text: 'Elige el cliente, la vigencia y la moneda.' },
      { target: '[data-tour="sales-form-items"]', text: 'Agrega productos o servicios y revisa precios y cantidades.' },
      { target: '[data-tour="sales-form-actions"]', text: 'Guarda como borrador o márcala «En proceso». Desde la lista puedes descargar el PDF para enviarlo.' },
      { text: 'Cuando el cliente acepte, en la lista usa la acción para aprobarla y enviarla a Orden de Venta.' },
    ],
  },
  {
    id: 'ventas-orden-venta', area: 'Ventas', module: 'ventas', title: 'Crear una orden de venta',
    keywords: ['orden de venta', 'pedido de cliente', 'nueva orden', 'pedido'],
    summary: 'Registra un pedido confirmado que luego pasa a factura.',
    steps: [
      { to: 'ventas/ordenes-venta', target: 'text:Nueva Orden', text: 'En Ventas → Órdenes de venta, presiona «Nueva Orden».' },
      { target: '[data-tour="sales-form-data"]', text: 'Elige cliente, vendedor, fecha de entrega y moneda.' },
      { target: '[data-tour="sales-form-items"]', text: 'Agrega los productos y revisa cantidades y precios.' },
      { target: '[data-tour="sales-form-actions"]', text: 'Guárdala. Cuando esté lista, apruébala y envíala a Factura desde la lista.' },
    ],
  },
  {
    id: 'ventas-registrar-pago', area: 'Ventas', module: 'ventas', title: 'Registrar un pago de un cliente',
    keywords: ['registrar pago', 'cliente me pago', 'abono de cliente', 'cobrar factura', 'pago recibido', 'aplicar pago', 'recibir pago'],
    summary: 'Aplica el dinero recibido a la factura o crédito del cliente para bajar su saldo.',
    steps: [
      { to: 'ventas/pagos-recibidos', target: 'text:Registrar Pago', text: 'En Ventas → Pagos recibidos, presiona «Registrar Pago».' },
      { text: 'Elige el cliente y la factura o crédito que está pagando.' },
      { text: 'Escribe el monto, la fecha, el método (efectivo, transferencia, tarjeta…) y la cuenta donde entró el dinero.' },
      { text: 'Confirma una sola vez. El saldo del cliente se actualiza solo.', tip: 'También puedes cobrar desde Ventas → Facturas con el botón de pago de cada fila.' },
    ],
  },
  {
    id: 'ventas-credito', area: 'Ventas', module: 'ventas', title: 'Dar crédito a un cliente',
    keywords: ['credito', 'manejo un credito', 'dar credito', 'venta a credito', 'fiado', 'nuevo credito', 'plan de pagos', 'cuotas'],
    summary: 'Registra productos o servicios entregados a crédito con fecha de pago o plan de cuotas.',
    steps: [
      { to: 'ventas/notas-credito', target: 'text:Nuevo Crédito', text: 'En Ventas → Créditos, presiona «Nuevo Crédito».' },
      { target: '[data-tour="sales-form-data"]', text: 'Elige el cliente. A la derecha verás su límite de crédito y lo que tiene disponible.' },
      { text: 'Pon la fecha límite de pago, o activa el plan de abonos para dividirlo en cuotas (semanal, quincenal o mensual). Si cobras interés, configúralo en «Interés y calendario opcionales».' },
      { target: '[data-tour="sales-form-items"]', text: 'Agrega los productos o servicios que se llevó el cliente.' },
      { text: 'Presiona «Guardar Borrador» para revisarlo o emítelo cuando el acuerdo esté confirmado.' },
    ],
  },
  {
    id: 'ventas-cobrar-credito', area: 'Ventas', module: 'ventas', title: 'Cobrar una cuota o abono de un crédito',
    keywords: ['abono', 'cobrar credito', 'pagar credito', 'cuota', 'abonar', 'registrar abono'],
    summary: 'Registra el pago de una cuota para bajar el saldo del crédito o préstamo.',
    steps: [
      { to: 'ventas/notas-credito', target: 'input[placeholder="Buscar crédito..."]', text: 'En Ventas → Créditos, busca el crédito por número o cliente.' },
      { text: 'En la fila del crédito presiona el botón de tarjeta: «Registrar pago» (o «Registrar abono» si es un préstamo).' },
      { text: 'Escribe el monto, el método de pago y la cuenta donde entró el dinero. Confirma.', tip: 'El pago aparece también en Pagos recibidos y el saldo del cliente baja solo.' },
    ],
  },
  {
    id: 'ventas-prestamo', area: 'Ventas', module: 'ventas', title: 'Dar un préstamo a un cliente',
    keywords: ['prestamo', 'prestar dinero', 'manejo un prestamo', 'nuevo prestamo', 'desembolso', 'mora'],
    summary: 'Crea un préstamo con su desembolso, interés opcional y plan de abonos.',
    requires: 'Los préstamos deben estar activados. Si no ves la pestaña «Préstamos» en el cliente, pide al administrador que los active en Contabilidad → Configuración (Préstamos a clientes).',
    steps: [
      { to: 'ventas/clientes', text: 'En Ventas → Clientes, busca al cliente y presiona «Ver detalle» (el ojo) en su fila.' },
      { target: 'text:Préstamos', text: 'En la ficha del cliente abre la pestaña «Préstamos».' },
      { target: 'text:Nuevo préstamo', text: 'Presiona «Nuevo préstamo».' },
      { text: 'Escribe el principal a prestar, el interés (si cobras), y si quieres, activa «Definir un plan de abonos» con su frecuencia y la fecha del primer abono.' },
      { text: 'Elige la moneda y de dónde sale el dinero (caja abierta o banco). Confirma: se crea la factura del préstamo y su calendario.' },
      { to: 'ventas/notas-credito', text: 'Los abonos se registran en Ventas → Créditos con «Registrar abono».' },
    ],
  },
  {
    id: 'ventas-listas-precios', area: 'Ventas', module: 'ventas', title: 'Cambiar precios y manejar listas de precios',
    keywords: ['lista de precios', 'listas de precios', 'cambiar precio', 'actualizar precios', 'precio mayorista', 'precio distribuidor', 'precios', 'tarifa'],
    summary: 'Edita los precios por lista (Minorista, Mayorista, Distribuidor…) y asígnalos a clientes.',
    steps: [
      { to: 'ventas/listas-precios', target: '[data-tour="price-lists-title"]', text: 'Ve a Ventas → Listas de precios. Cada columna es una lista y cada fila un producto.' },
      { target: '[data-tour="price-lists-search"]', text: 'Busca el producto por nombre o código.' },
      { target: '[data-tour="price-lists-matrix"]', text: 'Presiona el lápiz de la fila, cambia los precios de cada lista y guarda una sola vez.' },
      { target: '[data-tour="price-lists-new"]', text: 'Si necesitas otra tarifa (por ejemplo «Promocional»), créala con «Nueva lista».' },
      { target: '[data-tour="price-lists-import"]', text: 'Para cambiar muchos precios: descarga la plantilla, edítala en Excel y súbela con «Importar precios».', tip: 'Para que un cliente use una lista, ábrelo en Ventas → Clientes y elige su lista de precios.' },
    ],
  },
  {
    id: 'ventas-devolucion', area: 'Ventas', module: 'ventas', title: 'Registrar una devolución (nota de crédito)',
    keywords: ['devolucion', 'nota de credito', 'cliente devolvio', 'devolver producto', 'anular venta'],
    summary: 'Registra lo que el cliente devolvió y genera saldo a favor.',
    steps: [
      { to: 'ventas/devoluciones-venta', target: 'text:Nueva Nota', text: 'En Ventas → Notas de crédito, presiona «Nueva Nota».' },
      { target: '[data-tour="sales-form-data"]', text: 'Elige el cliente y la factura de origen, la fecha y el motivo.' },
      { target: '[data-tour="sales-form-items"]', text: 'Indica cuántas unidades devuelve y si vuelven al inventario o se descartan.' },
      { target: '[data-tour="sales-form-actions"]', text: 'Guarda, apruébala y luego aplica el saldo a favor desde la lista.' },
    ],
  },
  {
    id: 'ventas-factura-recurrente', area: 'Ventas', module: 'ventas', title: 'Programar una factura que se repite cada mes',
    keywords: ['factura recurrente', 'facturas recurrentes', 'cobro mensual', 'suscripcion', 'mensualidad', 'contrato mensual'],
    summary: 'Configura un cobro periódico para que el sistema genere la factura en cada fecha.',
    steps: [
      { to: 'ventas/facturas-recurrentes', target: 'text:Agregar Factura Recurrente', text: 'En Ventas → Facturas recurrentes, presiona «Agregar Factura Recurrente».' },
      { text: 'Elige cliente, concepto, moneda, cada cuánto se repite y la fecha de la próxima emisión.' },
      { text: 'Agrega los productos o servicios del contrato y guarda. Desde la lista puedes pausarla o reanudarla.' },
    ],
  },
  {
    id: 'ventas-leads', area: 'Ventas', module: 'ventas', title: 'Registrar un lead o prospecto',
    keywords: ['lead', 'leads', 'prospecto', 'cliente potencial', 'red de contactos', 'agregar lead'],
    summary: 'Anota un posible cliente para darle seguimiento hasta que compre.',
    steps: [
      { to: 'ventas/leads', target: 'text:Agregar lead', text: 'En Ventas → Leads y red, presiona «Agregar lead».' },
      { text: 'Escribe el nombre, cómo contactarlo y de dónde vino. Guarda.' },
      { text: 'Cambia su etapa a medida que avanzas (contactado, propuesta, ganado o perdido).' },
    ],
  },

  // ─── Compras ─────────────────────────────────────────────────────────
  {
    id: 'compras-proveedor', area: 'Compras', module: 'compras', title: 'Registrar un proveedor',
    keywords: ['proveedor', 'nuevo proveedor', 'crear proveedor', 'agregar proveedor', 'registrar proveedor'],
    summary: 'Crea la ficha del proveedor con sus datos fiscales y condiciones de pago.',
    steps: [
      { to: 'compras/proveedores', target: 'text:Nuevo proveedor', text: 'En Compras → Proveedores, presiona «Nuevo proveedor».' },
      { text: 'Escribe nombre, RUC, contacto y días de crédito que te da el proveedor.' },
      { text: 'Guarda. Ya puedes usarlo en órdenes de compra, gastos y facturas de proveedor.' },
    ],
  },
  {
    id: 'compras-gasto', area: 'Compras', module: 'compras', title: 'Registrar un gasto',
    keywords: ['gasto', 'registrar gasto', 'anotar gasto', 'pague luz', 'pague agua', 'pago de alquiler', 'gastos'],
    summary: 'Anota un gasto (luz, alquiler, combustible…) con su categoría y forma de pago.',
    steps: [
      { to: 'compras/gastos', target: 'text:Registrar Gasto', text: 'En Compras → Gastos, presiona «Registrar Gasto».' },
      { text: 'Elige la categoría, el proveedor (si aplica), la fecha y el monto.' },
      { text: 'Indica si ya lo pagaste y desde qué cuenta, o si queda pendiente. Adjunta la factura si la tienes. Guarda.', tip: 'Si se repite cada mes, usa Compras → Gastos recurrentes.' },
    ],
  },
  {
    id: 'compras-gasto-recurrente', area: 'Compras', module: 'compras', title: 'Programar un gasto que se repite',
    keywords: ['gasto recurrente', 'gastos recurrentes', 'gasto mensual', 'alquiler mensual', 'pago fijo'],
    summary: 'Programa gastos fijos para que se registren solos en cada fecha.',
    steps: [
      { to: 'compras/gastos-recurrentes', target: 'text:Nuevo Recurrente', text: 'En Compras → Gastos recurrentes, presiona «Nuevo Recurrente».' },
      { text: 'Elige categoría, monto, cada cuánto se repite y la próxima fecha. Guarda.' },
    ],
  },
  {
    id: 'compras-orden-compra', area: 'Compras', module: 'compras', title: 'Hacer una orden de compra',
    keywords: ['orden de compra', 'comprar mercaderia', 'pedido a proveedor', 'nueva orden de compra', 'comprar producto'],
    summary: 'Pide productos a un proveedor y luego recíbelos en bodega.',
    steps: [
      { to: 'compras/ordenes-compra', target: 'text:Nueva Orden', text: 'En Compras → Órdenes de compra, presiona «Nueva Orden».' },
      { target: '[data-tour="purchases-form-data"]', text: 'Elige el proveedor, la bodega donde llegará y la fecha esperada.' },
      { target: '[data-tour="purchases-form-items"]', text: 'Presiona «Agregar productos», elige los productos, cantidades y costo.' },
      { target: '[data-tour="purchases-form-actions"]', text: 'Guarda y apruébala. Cuando llegue la mercadería, regístrala en Recepciones de compra.' },
    ],
  },
  {
    id: 'compras-recepcion', area: 'Compras', module: 'compras', title: 'Recibir mercadería de un proveedor',
    keywords: ['recepcion', 'recibir mercaderia', 'llego el pedido', 'entrada de mercaderia', 'recepcion de compra', 'ingresar compra'],
    summary: 'Registra lo que llegó para que suba el inventario y quede la cuenta por pagar.',
    steps: [
      { to: 'compras/recepciones-compra', target: 'text:Nueva Recepción', text: 'En Compras → Recepciones de compra, presiona «Nueva Recepción».' },
      { text: 'Elige la orden de compra (o el proveedor) y revisa las cantidades que realmente llegaron.' },
      { text: 'Confirma costos y bodega, y presiona «Procesar recepción». El inventario sube solo.' },
    ],
  },
  {
    id: 'compras-factura-proveedor', area: 'Compras', module: 'compras', title: 'Registrar la factura de un proveedor',
    keywords: ['factura de proveedor', 'factura del proveedor', 'cuenta por pagar', 'registrar compra'],
    summary: 'Anota la factura que te dio el proveedor para controlar lo que le debes.',
    steps: [
      { to: 'compras/creditos-proveedor', text: 'Ve a Compras → Créditos del proveedor para ver lo que debes a cada proveedor.' },
      { target: 'text:Nuevo Crédito de Proveedor', text: 'Si compraste al crédito, presiona «Nuevo Crédito de Proveedor», elige el proveedor, la fecha de vencimiento y el monto. Guarda.' },
    ],
  },
  {
    id: 'compras-pagar-proveedor', area: 'Compras', module: 'compras', title: 'Pagarle a un proveedor',
    keywords: ['pagar proveedor', 'pago a proveedor', 'abonar a proveedor', 'pago realizado', 'pagos realizados'],
    summary: 'Registra un pago a proveedor para bajar lo que le debes.',
    steps: [
      { to: 'compras/pagos-realizados', target: 'text:Registrar Pago', text: 'En Compras → Pagos realizados, presiona «Registrar Pago».' },
      { target: '[data-tour="purchases-payment-data"]', text: 'Elige el proveedor y la factura o crédito que pagas, el monto, la fecha y la cuenta de donde sale el dinero.' },
      { text: 'Confirma. La deuda con el proveedor baja sola.' },
    ],
  },
  {
    id: 'compras-solicitud', area: 'Compras', module: 'compras', title: 'Pedir una compra (solicitud)',
    keywords: ['solicitud de compra', 'solicitar compra', 'pedir compra', 'requisicion'],
    summary: 'Pide que se compre algo; quien aprueba lo convierte en orden de compra.',
    steps: [
      { to: 'compras/solicitudes', text: 'Ve a Compras → Solicitudes para ver las solicitudes pendientes.' },
      { to: 'inventario/productos', text: 'Para crear una, en Inventario → Productos usa «Solicitar compra», elige productos y cantidades y envíala.' },
      { to: 'compras/solicitudes', text: 'Quien aprueba abre la solicitud y presiona «Convertir a orden» para que se cree la orden de compra.' },
    ],
  },

  // ─── Inventario ──────────────────────────────────────────────────────
  {
    id: 'inventario-producto', area: 'Inventario', module: 'inventario', title: 'Crear un producto',
    keywords: ['crear producto', 'nuevo producto', 'agregar producto', 'registrar producto', 'ingresar producto', 'articulo nuevo', 'productos'],
    summary: 'Registra un producto con su código, categoría, costo, precios y existencia inicial.',
    steps: [
      { to: 'inventario/productos', target: '[data-tour="inventory-products-actions"] button:has(svg.lucide-plus)||text:Nuevo', text: 'En Inventario → Productos, presiona «Nuevo».' },
      { target: '[data-tour="inventory-product-add-data"]', text: 'Escribe nombre, código (SKU), categoría, marca y unidad de medida.' },
      { text: 'Escribe el costo y los precios de venta. Si tiene existencia, indica la bodega y la cantidad.' },
      { target: '[data-tour="inventory-product-add-actions"]', text: 'Guarda. El producto ya se puede vender y comprar.', tip: 'Para muchos productos usa «Importar el catálogo inicial» con la plantilla de Excel.' },
    ],
  },
  {
    id: 'inventario-importar', area: 'Inventario', module: 'inventario', title: 'Importar productos desde Excel',
    keywords: ['importar productos', 'subir productos', 'catalogo inicial', 'cargar inventario', 'productos desde excel', 'inventario inicial'],
    summary: 'Carga el catálogo y la existencia inicial de una vez con la plantilla.',
    steps: [
      { to: 'inventario/productos', target: 'button[title^="Importar"]', text: 'En Inventario → Productos, presiona el botón de importar el catálogo inicial.' },
      { text: 'Descarga la plantilla, llénala (una fila por producto) y súbela.' },
      { text: 'Revisa las filas marcadas, corrígelas y confirma la importación.' },
    ],
  },
  {
    id: 'inventario-servicio', area: 'Inventario', module: 'inventario', title: 'Crear un servicio',
    keywords: ['servicio', 'crear servicio', 'nuevo servicio', 'mano de obra'],
    summary: 'Registra un servicio (no lleva existencia) para poder facturarlo.',
    steps: [
      { to: 'inventario/servicios', text: 'Ve a Inventario → Servicios.' },
      { target: '[data-tour="inventory-products-actions"] button:has(svg.lucide-plus)||text:Nuevo', text: 'Presiona «Nuevo», escribe nombre, código y precio, y guarda.' },
    ],
  },
  {
    id: 'inventario-existencias', area: 'Inventario', module: 'inventario', title: 'Ver cuánto hay de un producto',
    keywords: ['existencia', 'existencias', 'cuanto hay', 'stock', 'inventario disponible', 'ver inventario'],
    summary: 'Consulta la existencia de cada producto por bodega.',
    steps: [
      { to: 'inventario/productos', target: '[data-tour="inventory-products-filters"]', text: 'En Inventario → Productos, busca el producto por nombre o código.' },
      { target: '[data-tour="inventory-products-table"]', text: 'La columna de existencia muestra lo disponible. Abre el producto para verlo por bodega.' },
      { to: 'inventario/movimientos', text: 'En Inventario → Movimientos ves cada entrada y salida con su fecha y documento.' },
    ],
  },
  {
    id: 'inventario-ajuste', area: 'Inventario', module: 'inventario', title: 'Ajustar la existencia (sobrante o faltante)',
    keywords: ['ajuste', 'ajustar inventario', 'corregir existencia', 'faltante', 'sobrante', 'ajuste de inventario'],
    summary: 'Corrige la existencia cuando el conteo físico no cuadra con el sistema.',
    steps: [
      { to: 'inventario/ajustes', target: '[data-tour="stock-new-btn"]||text:Nuevo Ajuste', text: 'En Inventario → Ajustes, presiona «Nuevo Ajuste».' },
      { target: '[data-tour="inventory-adjustment-form-data"]', text: 'Elige la bodega, el producto, la cantidad correcta y el motivo.' },
      { text: 'Guarda el borrador y apruébalo. La existencia se corrige y queda registrado quién lo hizo.' },
    ],
  },
  {
    id: 'inventario-transferencia', area: 'Inventario', module: 'inventario', title: 'Pasar productos de una bodega a otra',
    keywords: ['transferencia', 'transferir', 'mover productos', 'traslado', 'pasar de bodega', 'de una bodega a otra', 'pasar productos', 'enviar a sucursal'],
    summary: 'Mueve mercadería entre bodegas o sucursales.',
    steps: [
      { to: 'inventario/transferencias', target: '[data-tour="transfer-new-btn"]||text:Nueva Transferencia', text: 'En Inventario → Transferencias, presiona «Nueva Transferencia».' },
      { target: '[data-tour="inventory-transfer-form-data"]', text: 'Elige la bodega de origen y la de destino.' },
      { text: 'Presiona «Agregar producto», elige productos y cantidades.' },
      { target: '[data-tour="inventory-transfer-form-actions"]', text: 'Guarda y envíala. La bodega destino la recibe para completar el traslado.' },
    ],
  },
  {
    id: 'inventario-bodega', area: 'Inventario', module: 'inventario', title: 'Crear una bodega',
    keywords: ['bodega', 'almacen', 'nueva bodega', 'crear bodega', 'agregar bodega'],
    summary: 'Agrega un lugar donde se guarda mercadería.',
    steps: [
      { to: 'inventario/almacenes', target: '[data-tour="almacenes-add-btn"]||text:Agregar Bodega', text: 'En Inventario → Bodegas, presiona «Agregar Bodega».' },
      { text: 'Escribe el nombre, la sucursal y la dirección. Guarda.' },
    ],
  },
  {
    id: 'inventario-categorias', area: 'Inventario', module: 'inventario', title: 'Crear categorías y atributos (talla, color…)',
    keywords: ['categoria', 'categorias', 'atributo', 'talla', 'color', 'variantes', 'atributos'],
    summary: 'Organiza productos por categoría y define atributos para variantes.',
    steps: [
      { to: 'inventario/atributos', target: 'text:Categorías', text: 'En Inventario → Atributos y Categoría, abre la pestaña «Categorías».' },
      { target: 'text:Nuevo', text: 'Presiona «Nuevo», escribe el nombre de la categoría y guarda.' },
      { target: 'text:Atributos', text: 'Para tallas, colores u otras variantes, abre la pestaña «Atributos», presiona «Nuevo» y escribe sus valores.' },
    ],
  },
  {
    id: 'inventario-auditoria', area: 'Inventario', module: 'inventario', title: 'Hacer un conteo físico (auditoría)',
    keywords: ['auditoria de inventario', 'conteo fisico', 'toma fisica', 'contar inventario', 'inventario fisico'],
    summary: 'Cuenta la mercadería de una bodega y compara con el sistema.',
    steps: [
      { to: 'inventario/auditorias', target: 'text:Nueva auditoría', text: 'En Inventario → Auditorías, presiona «Nueva auditoría».' },
      { text: 'Elige la bodega y agrega los productos a contar (uno por uno o por categoría). Agrega a las personas que participan.' },
      { text: 'Escribe lo contado. El sistema muestra las diferencias; al cerrar puedes generar los ajustes.' },
    ],
  },
  {
    id: 'inventario-perdida', area: 'Inventario', module: 'inventario', title: 'Registrar una pérdida o producto dañado',
    keywords: ['perdida', 'producto danado', 'merma', 'vencido', 'robo', 'perdidas'],
    summary: 'Saca del inventario lo que se perdió, venció o se dañó.',
    steps: [
      { to: 'inventario/perdidas', target: '[data-tour="inventory-losses-actions"]', text: 'Ve a Inventario → Pérdidas y crea un registro nuevo.' },
      { target: '[data-tour="inventory-losses-data"]', text: 'Elige bodega, producto, cantidad y el motivo. Guarda.' },
    ],
  },
  {
    id: 'inventario-reposicion', area: 'Inventario', module: 'inventario', title: 'Saber qué productos debo volver a comprar',
    keywords: ['reposicion', 'reabastecer', 'que debo comprar', 'productos por agotarse', 'minimo', 'stock minimo'],
    summary: 'Revisa los productos bajo el mínimo y crea órdenes de compra en borrador.',
    steps: [
      { to: 'inventario/reposicion', text: 'Ve a Inventario → Reposición: verás los productos bajo su mínimo con la cantidad sugerida.' },
      { target: 'text:Crear órdenes de compra en borrador||text:Crear borradores', text: 'Selecciona los que quieras y presiona «Crear órdenes de compra en borrador».' },
    ],
  },
  {
    id: 'inventario-activos', area: 'Inventario', module: 'inventario', title: 'Registrar mobiliario y equipo',
    keywords: ['mobiliario', 'equipo', 'activo', 'computadora', 'muebles', 'mobiliario y equipos'],
    summary: 'Lleva el control de muebles y equipos de la empresa.',
    steps: [
      { to: 'inventario/mobiliario-equipos', target: '[data-tour="mobiliario-list-actions"]||text:Registrar activo', text: 'En Inventario → Mobiliario y Equipos, presiona «Registrar activo».' },
      { target: '[data-tour="mobiliario-form-data"]', text: 'Escribe nombre, código, ubicación, responsable y valor. Guarda.' },
    ],
  },

  // ─── Finanzas ────────────────────────────────────────────────────────
  {
    id: 'finanzas-resumen', area: 'Finanzas', module: 'finanzas', title: 'Ver cómo va el dinero de la empresa',
    keywords: ['resumen financiero', 'flujo de dinero', 'cuanto dinero tengo', 'finanzas', 'saldo de bancos'],
    summary: 'Consulta ingresos, gastos y saldos de caja y bancos.',
    steps: [
      { to: 'finanzas/resumen-financiero', text: 'Ve a Finanzas → Resumen Financiero: ingresos, gastos y utilidad del período.' },
      { to: 'finanzas/caja-bancos', text: 'En Finanzas → Caja y Bancos ves el saldo de cada cuenta.' },
      { to: 'finanzas/calendario-financiero', text: 'En Finanzas → Calendario Financiero ves qué cobros y pagos vienen.' },
    ],
  },
  {
    id: 'finanzas-cuentas-cobrar', area: 'Finanzas', module: 'finanzas', title: 'Ver quién me debe (cuentas por cobrar)',
    keywords: ['cuentas por cobrar', 'quien me debe', 'cartera', 'clientes morosos', 'facturas vencidas', 'cobranza'],
    summary: 'Revisa lo que deben tus clientes y qué está vencido.',
    steps: [
      { to: 'finanzas/cuentas-cobrar', text: 'Ve a Finanzas → Cuentas por Cobrar. Verás cada cliente con su saldo y lo vencido.' },
      { text: 'Filtra por vencidas para priorizar a quién llamar. Para registrar un pago, ve a Ventas → Pagos recibidos.' },
    ],
  },
  {
    id: 'finanzas-cuentas-pagar', area: 'Finanzas', module: 'finanzas', title: 'Ver a quién le debo (cuentas por pagar)',
    keywords: ['cuentas por pagar', 'a quien le debo', 'deudas con proveedores', 'pagos pendientes'],
    summary: 'Revisa lo que debes a proveedores y cuándo vence.',
    steps: [
      { to: 'finanzas/cuentas-pagar', text: 'Ve a Finanzas → Cuentas por Pagar: cada proveedor con su saldo y vencimiento.' },
      { to: 'compras/pagos-realizados', text: 'Para pagar, ve a Compras → Pagos realizados y presiona «Registrar Pago».' },
    ],
  },
  {
    id: 'finanzas-ingreso', area: 'Finanzas', module: 'finanzas', title: 'Registrar un ingreso que no es venta',
    keywords: ['ingreso', 'registrar ingreso', 'entrada de dinero', 'deposito', 'aporte', 'ingresos'],
    summary: 'Anota dinero que entra y no viene de una factura (aporte, préstamo bancario, intereses).',
    steps: [
      { to: 'finanzas/ingresos', text: 'Ve a Finanzas → Ingresos.' },
      { text: 'Usa el botón de nuevo ingreso, elige la cuenta donde entró el dinero, la categoría, la fecha y el monto. Guarda.' },
    ],
  },
  {
    id: 'finanzas-importar', area: 'Finanzas', module: 'finanzas', title: 'Importar ingresos o gastos desde Excel',
    keywords: ['importar gastos', 'importar ingresos', 'subir movimientos', 'estado de cuenta'],
    summary: 'Carga muchos movimientos de una vez con la plantilla.',
    steps: [
      { to: 'finanzas/egresos', text: 'Ve a Finanzas → Gastos (o Ingresos) y presiona «Importar».' },
      { text: 'Descarga la plantilla, llénala y súbela. Revisa las filas marcadas y confirma.' },
    ],
  },

  // ─── Contabilidad ────────────────────────────────────────────────────
  {
    id: 'conta-plan-cuentas', area: 'Contabilidad', module: 'contabilidad', title: 'Crear una cuenta contable',
    keywords: ['plan de cuentas', 'cuenta contable', 'nueva cuenta', 'catalogo de cuentas'],
    summary: 'Agrega una cuenta al catálogo contable.',
    steps: [
      { to: 'contabilidad/plan-cuentas', target: 'text:Nueva Cuenta', text: 'En Contabilidad → Plan de Cuentas, presiona «Nueva Cuenta».' },
      { text: 'Escribe el código, el nombre, el tipo (activo, pasivo…) y la cuenta padre. Guarda.' },
    ],
  },
  {
    id: 'conta-asientos', area: 'Contabilidad', module: 'contabilidad', title: 'Ver los asientos contables',
    keywords: ['asiento', 'asientos', 'libro diario', 'partida', 'asiento contable'],
    summary: 'Consulta los asientos que genera el sistema y los manuales.',
    steps: [
      { to: 'contabilidad/diario', text: 'Ve a Contabilidad → Libro Diario: cada venta, compra, pago y nómina genera su asiento aquí.' },
      { text: 'Filtra por fecha o busca por número de documento. Abre un asiento para ver sus cuentas.' },
      { to: 'contabilidad/libro-mayor', text: 'En Contabilidad → Libro Mayor ves los movimientos y saldo de cada cuenta.' },
    ],
  },
  {
    id: 'conta-config-cuentas', area: 'Contabilidad', module: 'contabilidad', title: 'Configurar qué cuentas usa cada proceso',
    keywords: ['configuracion contable', 'cuentas por modulo', 'cuentas de asientos', 'configurar asientos'],
    summary: 'Define las cuentas que usa el sistema al generar asientos de ventas, compras, caja, nómina…',
    steps: [
      { to: 'contabilidad/configuracion', text: 'Ve a Contabilidad → Configuración.' },
      { text: 'Elige el proceso (por ejemplo «Facturación por caja») y asigna la cuenta de cada campo Debe/Haber. Guarda.' },
    ],
  },
  {
    id: 'conta-estados', area: 'Contabilidad', module: 'contabilidad', title: 'Ver el estado de resultados y el balance general',
    keywords: ['estado de resultados', 'balance general', 'perdidas y ganancias', 'balance de comprobacion', 'estados financieros'],
    summary: 'Consulta y descarga los estados financieros.',
    steps: [
      { to: 'contabilidad/estado-resultados', text: 'Ve a Contabilidad → Estado de Resultados y elige el período.' },
      { to: 'contabilidad/balance-general-contable', text: 'En Contabilidad → Balance General ves activos, pasivos y patrimonio a una fecha.' },
      { text: 'Usa el botón de exportar para descargar en PDF o Excel.' },
    ],
  },
  {
    id: 'conta-periodos', area: 'Contabilidad', module: 'contabilidad', title: 'Cerrar un mes contable',
    keywords: ['cerrar mes', 'periodo contable', 'cierre contable', 'cierre de mes'],
    summary: 'Crea y cierra períodos para que nadie modifique meses ya revisados.',
    steps: [
      { to: 'contabilidad/periodos', target: 'text:Nuevo Período', text: 'En Contabilidad → Períodos contables, crea el período con «Nuevo Período» si no existe.' },
      { text: 'Cuando el mes esté revisado, ciérralo desde su fila.' },
    ],
  },
  {
    id: 'conta-conciliacion', area: 'Contabilidad', module: 'contabilidad', title: 'Conciliar el banco',
    keywords: ['conciliacion', 'conciliar banco', 'estado de cuenta bancario', 'conciliacion bancaria'],
    summary: 'Compara el estado de cuenta del banco con lo registrado en el sistema.',
    steps: [
      { to: 'contabilidad/conciliacion', target: 'text:Nueva Conciliación', text: 'En Contabilidad → Conciliación bancaria, presiona «Nueva Conciliación».' },
      { text: 'Elige la cuenta bancaria, el mes y el saldo final del estado de cuenta.' },
      { text: 'Marca los movimientos que aparecen en el banco. Al cuadrar la diferencia en cero, guarda.' },
    ],
  },
  {
    id: 'conta-presupuesto', area: 'Contabilidad', module: 'contabilidad', title: 'Hacer un presupuesto',
    keywords: ['presupuesto', 'presupuestos', 'partida presupuestaria'],
    summary: 'Define cuánto planeas gastar por partida y compáralo con lo real.',
    steps: [
      { to: 'contabilidad/presupuestos', target: 'text:Nueva Partida', text: 'En Contabilidad → Presupuestos, presiona «Nueva Partida».' },
      { text: 'Elige la cuenta o categoría, el período y el monto. Guarda y revisa el avance contra lo gastado.' },
    ],
  },
  {
    id: 'conta-activos-fijos', area: 'Contabilidad', module: 'contabilidad', title: 'Registrar un activo fijo y su depreciación',
    keywords: ['activo fijo', 'activos fijos', 'depreciacion', 'vehiculo de la empresa'],
    summary: 'Registra activos de larga duración y calcula su depreciación.',
    steps: [
      { to: 'contabilidad/activos-fijos', text: 'Ve a Contabilidad → Activos Fijos.' },
      { text: 'Registra el activo con su costo, fecha de compra y vida útil. El sistema calcula la depreciación de cada mes.' },
    ],
  },

  // ─── Reportes ────────────────────────────────────────────────────────
  {
    id: 'reportes-ventas', area: 'Reportes', module: 'reportes', title: 'Ver los reportes de ventas',
    keywords: ['reportes', 'reporte de ventas', 'donde veo los reportes', 'ventas del mes', 'informe de ventas', 'ver reportes'],
    summary: 'Consulta ventas por período, vendedor, producto y cliente, y descárgalas.',
    steps: [
      { to: 'reportes/reportes-ventas', text: 'Ve a Reportes → Ventas.' },
      { text: 'Arriba elige el período (desde y hasta). Los números y gráficos se actualizan.' },
      { text: 'Usa el botón de exportar para descargar en PDF o Excel.', tip: 'En el mismo menú Reportes están Compras, Financiero, Inventario, Clientes, Proveedores y Recursos Humanos.' },
    ],
  },
  {
    id: 'reportes-inventario', area: 'Reportes', module: 'reportes', title: 'Ver los reportes de inventario',
    keywords: ['reporte de inventario', 'valor del inventario', 'kardex', 'rotacion', 'informe de inventario'],
    summary: 'Consulta el valor del inventario, rotación y productos sin movimiento.',
    steps: [
      { to: 'reportes/reportes-inventario', text: 'Ve a Reportes → Inventario de Mercancías.' },
      { text: 'Elige período y bodega. Exporta a PDF o Excel si lo necesitas.' },
    ],
  },
  {
    id: 'reportes-financieros', area: 'Reportes', module: 'reportes', title: 'Ver los reportes financieros',
    keywords: ['reporte financiero', 'reportes financieros', 'utilidad del mes', 'informe financiero'],
    summary: 'Consulta ingresos, gastos y utilidad por período.',
    steps: [
      { to: 'reportes/reportes-financieros', text: 'Ve a Reportes → Financiero.' },
      { text: 'Elige el período y exporta si lo necesitas.' },
    ],
  },
  {
    id: 'reportes-clientes', area: 'Reportes', module: 'reportes', title: 'Ver reportes de clientes',
    keywords: ['reporte de clientes', 'mejores clientes', 'clientes que mas compran', 'estado de cuenta de cliente'],
    summary: 'Consulta compras y saldos por cliente.',
    steps: [
      { to: 'reportes/reportes-clientes', text: 'Ve a Reportes → Clientes y elige el período.' },
      { text: 'Para el estado de cuenta de un cliente, ábrelo en Ventas → Clientes y revisa su pestaña de movimientos.' },
    ],
  },

  // ─── Recursos Humanos ────────────────────────────────────────────────
  {
    id: 'rh-empleado', area: 'Recursos Humanos', module: 'rh', title: 'Registrar un empleado',
    keywords: ['empleado', 'nuevo empleado', 'agregar empleado', 'contratar', 'registrar empleado', 'trabajador'],
    summary: 'Crea la ficha del empleado con su puesto, salario y datos de nómina.',
    steps: [
      { to: 'rh/empleados', target: 'text:Agregar empleado', text: 'En Recursos Humanos → Empleados, presiona «Agregar empleado».' },
      { text: 'Escribe nombre, cédula, fecha de ingreso, departamento y puesto.' },
      { text: 'Escribe el salario, la frecuencia de pago y si se le paga INSS y provisiones. Guarda.' },
    ],
  },
  {
    id: 'rh-nomina', area: 'Recursos Humanos', module: 'rh', title: 'Hacer la nómina (planilla)',
    keywords: ['nomina', 'planilla', 'pagar salarios', 'procesar nomina', 'pago de empleados'],
    summary: 'Calcula y procesa el pago de los empleados del período.',
    steps: [
      { to: 'rh/nominas', target: '[data-tour="nominas-process"]||text:Procesar Nómina', text: 'En Recursos Humanos → Nóminas, presiona «Procesar Nómina».' },
      { text: 'Elige el período y los empleados. Revisa salario, horas extra, bonos, deducciones e INSS de cada uno.' },
      { text: 'Confirma. Puedes descargar los colillas y el resumen en PDF o Excel.' },
    ],
  },
  {
    id: 'rh-proyeccion', area: 'Recursos Humanos', module: 'rh', title: 'Ver la proyección del gasto de nómina',
    keywords: ['proyeccion de nomina', 'proyeccion de gastos', 'cuanto voy a pagar', 'gasto de planilla', 'presupuesto de nomina'],
    summary: 'Mira cuánto pagarás cada mes en salarios, cargas, provisiones y aguinaldo.',
    steps: [
      { to: 'rh/nominas', target: '#hr-payroll-scope', text: 'En Recursos Humanos → Nóminas, en «Mostrar» elige «Proyección de gastos».' },
      { text: 'Con «Desde» eliges el mes inicial y con «Ver» cuántos meses (3, 6, 12…).' },
      { text: 'Si el período incluye diciembre, elige la fecha en que pagarás el aguinaldo para que caiga en el mes correcto.' },
    ],
  },
  {
    id: 'rh-aguinaldo', area: 'Recursos Humanos', module: 'rh', title: 'Calcular el aguinaldo',
    keywords: ['aguinaldo', 'treceavo', 'decimo tercer mes', 'pago de aguinaldo'],
    summary: 'Calcula el aguinaldo de cada empleado y define la fecha de pago.',
    steps: [
      { to: 'rh/nominas', target: '#hr-payroll-scope', text: 'En Recursos Humanos → Nóminas, en «Mostrar» elige «Aguinaldo».' },
      { text: 'Revisa el monto de cada empleado (1 de diciembre al 30 de noviembre).' },
      { text: 'Elige «Fecha en que pagaremos el aguinaldo». La fecha límite legal es el 10 de diciembre.' },
    ],
  },
  {
    id: 'rh-vacaciones', area: 'Recursos Humanos', module: 'rh', title: 'Registrar vacaciones o permisos',
    keywords: ['vacaciones', 'permiso', 'ausencia', 'incapacidad', 'solicitar vacaciones', 'registrar vacaciones', 'dias libres'],
    summary: 'Registra o solicita vacaciones y permisos de un empleado.',
    steps: [
      { to: 'rh/ausencias', target: 'text:Nueva Solicitud', text: 'En Recursos Humanos → Vacaciones, presiona «Nueva Solicitud».' },
      { text: 'Elige el empleado, el tipo (vacaciones, permiso, incapacidad), las fechas y el motivo. Guarda.' },
      { text: 'Quien aprueba la acepta o la rechaza desde la lista. Los días disponibles se actualizan solos.' },
    ],
  },
  {
    id: 'rh-asistencia', area: 'Recursos Humanos', module: 'rh', title: 'Registrar la asistencia',
    keywords: ['asistencia', 'marcar entrada', 'llegadas tarde', 'horas trabajadas', 'reloj marcador'],
    summary: 'Marca entradas y salidas o importa las marcas del reloj.',
    steps: [
      { to: 'rh/asistencia', target: 'text:Entrada', text: 'En Recursos Humanos → Asistencia, presiona «Entrada» al llegar.' },
      { target: 'text:Salida', text: 'Al irte, presiona «Salida». Las horas trabajadas se calculan solas.' },
      { target: '[aria-label="Importar"]', text: 'Si tienes reloj marcador, presiona «Importar», descarga la plantilla y sube las marcas.' },
    ],
  },
  {
    id: 'rh-comisiones', area: 'Recursos Humanos', module: 'rh', title: 'Ver y pagar comisiones',
    keywords: ['comision', 'comisiones', 'comision de vendedor', 'pagar comisiones'],
    summary: 'Consulta las comisiones de los vendedores por mes.',
    steps: [
      { to: 'rh/comisiones', text: 'Ve a Recursos Humanos → Comisiones y elige el mes.' },
      { text: 'Verás cada vendedor con sus ventas y comisión. Las comisiones se suman a la nómina del período.' },
    ],
  },
  {
    id: 'rh-metas', area: 'Recursos Humanos', module: 'rh', title: 'Poner metas y bonos a empleados',
    keywords: ['meta', 'metas', 'bono', 'bonos', 'incentivo', 'objetivo de ventas'],
    summary: 'Define metas con su bono y registra el avance.',
    steps: [
      { to: 'rh/metas-bonos', target: 'text:Nueva meta||text:Crear meta', text: 'En Recursos Humanos → Metas y bonos, presiona «Nueva meta».' },
      { text: 'Elige empleado, qué se mide, la cifra a lograr, el período y el bono. Guarda.' },
      { target: 'text:Registrar avance', text: 'Registra el avance cuando corresponda. Al cumplirse, el bono pasa a la nómina.' },
    ],
  },
  {
    id: 'rh-departamentos', area: 'Recursos Humanos', module: 'rh', title: 'Crear departamentos',
    keywords: ['departamento', 'departamentos', 'area de trabajo', 'puestos'],
    summary: 'Organiza a los empleados por departamento.',
    steps: [
      { to: 'rh/departamentos', target: 'text:Nuevo departamento', text: 'En Recursos Humanos → Departamentos, presiona «Nuevo departamento», escribe el nombre y guarda.' },
    ],
  },
  {
    id: 'rh-evaluacion', area: 'Recursos Humanos', module: 'rh', title: 'Evaluar el desempeño de un empleado',
    keywords: ['evaluacion', 'desempeno', 'evaluar empleado'],
    summary: 'Registra una evaluación de desempeño.',
    steps: [
      { to: 'rh/evaluaciones', target: 'text:Nueva Evaluación', text: 'En Recursos Humanos → Desempeño, presiona «Nueva Evaluación».' },
      { text: 'Elige el empleado, el período y califica cada criterio. Guarda.' },
    ],
  },

  // ─── Actividades ─────────────────────────────────────────────────────
  {
    id: 'act-tarea', area: 'Actividades', module: 'actividades', title: 'Crear y asignar una tarea',
    keywords: ['tarea', 'tareas', 'asignar tarea', 'nueva tarea', 'pendiente para alguien'],
    summary: 'Crea una tarea, asígnala y sigue su avance.',
    steps: [
      { to: 'actividades/tareas', target: '[data-tour="tareas-tutorial-actions"]', text: 'En Actividades → Tareas, presiona el botón para crear una tarea.' },
      { text: 'Escribe el título, la descripción, la categoría, la fecha límite y a quién se la asignas. Agrega subtareas si hace falta.' },
      { text: 'Guarda. La persona la toma, reporta avance y la envía a revisión; tú la aceptas o la rechazas.' },
    ],
  },
  {
    id: 'act-recordatorio', area: 'Actividades', module: 'actividades', title: 'Crear un recordatorio',
    keywords: ['recordatorio', 'recordar', 'avisarme', 'alarma'],
    summary: 'Programa un aviso para ti o tu equipo.',
    steps: [
      { to: 'actividades/recordatorios', target: '[data-tour="recordatorios-tutorial-actions"]', text: 'En Actividades → Recordatorios, crea uno nuevo.' },
      { text: 'Escribe qué recordar, la fecha y hora, y a quién avisar. Guarda.' },
    ],
  },
  {
    id: 'act-evento', area: 'Actividades', module: 'actividades', title: 'Agendar un evento o reunión',
    keywords: ['evento', 'reunion', 'agendar', 'cita', 'calendario'],
    summary: 'Agenda reuniones y eventos en el calendario del equipo.',
    steps: [
      { to: 'actividades/eventos', text: 'Ve a Actividades → Eventos y crea uno nuevo.' },
      { text: 'Escribe título, fecha, hora, lugar e invitados. Guarda.' },
      { to: 'actividades/calendario', text: 'En Actividades → Calendario ves todo por día, semana o mes.' },
    ],
  },

  // ─── Configuración y equipo ─────────────────────────────────────────
  {
    id: 'config-usuarios', area: 'Mi Sucursal', module: 'suscripciones', title: 'Crear un usuario y darle permisos',
    keywords: ['usuario', 'nuevo usuario', 'crear usuario', 'permisos', 'rol', 'roles', 'dar acceso', 'quitar acceso'],
    summary: 'Invita a una persona al ERP y define qué puede ver y hacer.',
    requires: 'Solo el administrador de la empresa puede crear usuarios y roles.',
    steps: [
      { to: 'suscripciones/usuarios', target: '[data-tour="team-users"]', text: 'Ve a Mi Sucursal → Usuarios.' },
      { text: 'Crea el usuario con su nombre y correo, y elige su rol.' },
      { to: 'suscripciones/roles', text: 'En Mi Sucursal → Roles defines qué módulos y acciones tiene cada rol (ver, crear, editar, aprobar…).' },
    ],
  },
  {
    id: 'config-pdf', area: 'Configuración', module: 'configuracion', title: 'Cambiar el diseño de facturas y documentos PDF',
    keywords: ['diseno de factura', 'formato de factura', 'logo en factura', 'pdf', 'plantilla de factura', 'documentos pdf'],
    summary: 'Elige el diseño, el logo y los datos que salen en tus PDF.',
    steps: [
      { to: 'configuracion/documentos-pdf', target: '[data-tour="pdf-designs"]', text: 'Ve a Configuración → Documentos PDF y elige un diseño.' },
      { target: '[data-tour="pdf-company-identity"]', text: 'Revisa el logo, nombre y datos de la empresa.' },
      { target: '[data-tour="pdf-save"]', text: 'Guarda. Los próximos PDF salen con este diseño.' },
    ],
  },
  {
    id: 'config-moneda', area: 'Configuración', module: 'configuracion', title: 'Cambiar la tasa de cambio',
    keywords: ['tasa de cambio', 'tipo de cambio', 'dolar', 'moneda', 'cordobas'],
    summary: 'Actualiza la tasa entre córdobas y dólares que usa el sistema.',
    steps: [
      { to: 'configuracion/currency', text: 'Ve a Configuración → Moneda y cambio.' },
      { text: 'Escribe la tasa de cambio vigente y guarda. Se usa en precios, facturas y reportes.' },
    ],
  },
  {
    id: 'config-marca', area: 'Configuración', module: 'configuracion', title: 'Poner el logo y colores de mi empresa',
    keywords: ['logo', 'marca', 'colores', 'branding', 'nombre de la empresa'],
    summary: 'Personaliza el logo y los colores del ERP.',
    steps: [
      { to: 'configuracion/branding', text: 'Ve a Configuración → Marca y tema.' },
      { text: 'Sube el logo, elige los colores y guarda.' },
    ],
  },

  // ─── Restaurante ─────────────────────────────────────────────────────
  {
    id: 'rest-comanda', area: 'Restaurante', module: 'restaurante', title: 'Tomar una orden en el restaurante',
    keywords: ['comanda', 'tomar orden', 'mesa', 'pedido de mesa', 'restaurante'],
    summary: 'Abre la mesa, agrega platos y envía la comanda a cocina.',
    steps: [
      { to: 'restaurante/salon', target: '[data-tour="restaurant-salon"]', text: 'Ve a Restaurante → Salón y mesas y elige la mesa.' },
      { to: 'restaurante/operacion-pos', target: '[data-tour="restaurant-pos"]', text: 'Agrega los platos del menú con sus notas (sin cebolla, término, etc.).' },
      { text: 'Envía la comanda: aparece en Cocina. Al terminar, cobra la cuenta desde la mesa.' },
    ],
  },
  {
    id: 'rest-menu', area: 'Restaurante', module: 'restaurante', title: 'Agregar platos a la carta',
    keywords: ['menu', 'carta', 'agregar plato', 'platillo', 'receta'],
    summary: 'Crea los platos que se venden en el restaurante.',
    steps: [
      { to: 'restaurante/carta', target: '[data-tour="restaurant-menu"]', text: 'Ve a Restaurante → Carta y menú.' },
      { text: 'Agrega el plato con su nombre, categoría, precio e ingredientes (receta) si descuentas inventario. Guarda.' },
    ],
  },

  // ─── Notificaciones y ayuda ─────────────────────────────────────────
  {
    id: 'ayuda-capacitacion', area: 'Ayuda', module: 'centro-capacitacion', title: 'Ver videos y manuales del ERP',
    keywords: ['capacitacion', 'videos', 'manual', 'tutoriales', 'aprender a usar', 'centro de capacitacion'],
    summary: 'Encuentra videos, manuales en PDF y todas las guías paso a paso.',
    steps: [
      { to: 'centro-capacitacion', text: 'Abre el Centro de Capacitación desde el menú.' },
      { text: 'Busca por tema o elige un área. En «Guías paso a paso» presiona «Iniciar» y el sistema te lleva botón por botón.' },
    ],
  },
];

export function findGuide(id: string | null | undefined) {
  return id ? ERP_GUIDES.find((guide) => guide.id === id) || null : null;
}

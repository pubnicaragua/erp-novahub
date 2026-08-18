# Gestión de Productos con Variantes en Facturación por Caja y Órdenes de Compra

## 1. Objetivo

Definir cómo debe funcionar el ERP cuando un producto tiene **variantes**, especialmente en:

- Facturación por Caja.
- Órdenes de Compra.
- Inventario.
- Stock por sucursal/almacén.
- Precios por variante.
- Visualización consolidada del producto padre.
- Entregas.

La regla principal es:

> **El producto padre sirve para agrupar y mostrar información consolidada; la variante hija es la unidad operativa real de inventario, precio y comercialización.**

---

# 2. Concepto de producto padre y variante hija

Un producto puede tener atributos como:

- Talla.
- Color.
- Material.
- Capacidad.
- Presentación.
- Cualquier otro atributo definido por el ERP.

Ejemplo:

### Producto padre

**Camisa básica**

Atributos:

- Talla: S, M, L, XL.
- Color: Blanco, Azul, Negro.

Las combinaciones de estos valores generan variantes.

### Variantes

| SKU | Talla | Color |
|---|---|---|
| CAM-S-BLA | S | Blanco |
| CAM-M-BLA | M | Blanco |
| CAM-L-BLA | L | Blanco |
| CAM-XL-BLA | XL | Blanco |

Cada variante debe poder tener información operativa propia.

---

# 3. Regla arquitectónica principal

La arquitectura debe diferenciar claramente:

```text
Producto padre
    ↓
Variantes
    ↓
Precio
    ↓
Inventario
    ↓
Compra
    ↓
Venta
    ↓
Entrega
```

El producto padre representa el **concepto comercial y de catálogo**.

La variante representa la **unidad real que se compra, vende, almacena y entrega**.

Por lo tanto:

> **El producto padre es una entidad de catálogo; la variante es la unidad operativa de inventario, precio y comercialización.**

---

# 4. Stock del producto padre

El producto padre debe mostrar el stock acumulado de todas sus variantes.

Ejemplo:

**Camisa básica**

| Variante | Stock |
|---|---:|
| S / Blanco | 5 |
| M / Blanco | 8 |
| L / Blanco | 3 |
| XL / Blanco | 2 |
| **Stock total** | **18** |

El producto padre puede mostrar:

> **Stock total: 18**

Pero el stock real debe pertenecer a las variantes.

Conceptualmente:

```text
Camisa básica
├── S / Blanco → 5
├── M / Blanco → 8
├── L / Blanco → 3
└── XL / Blanco → 2

Stock total = 18
```

Se recomienda que el stock consolidado del padre sea **calculado a partir de sus variantes**, evitando almacenar dos valores independientes que puedan quedar desincronizados.

---

# 5. Stock por sucursal

El stock de una variante debe seguir respetando la separación por sucursal/almacén existente en el ERP.

Ejemplo:

```text
Camisa básica
└── L / Blanco
    ├── Sucursal 1 → 3
    └── Sucursal 2 → 8
```

El stock global de la variante sería:

**3 + 8 = 11**

Pero si un usuario está facturando desde Sucursal 1, debe visualizar:

> **Stock disponible: 3**

No debe utilizarse automáticamente el stock global de 11.

---

# 6. Facturación por Caja

## 6.1 Producto sin variantes

Debe conservar el comportamiento actual.

Flujo:

```text
Buscar producto
    ↓
Mostrar precio
    ↓
Mostrar stock
    ↓
Agregar al carrito
```

Ejemplo:

```text
Producto: Mouse inalámbrico
Precio: C$500
Stock: 10
```

---

## 6.2 Producto con variantes

Cuando el cajero busque un producto variable, no debe agregarse directamente el producto padre al carrito.

Debe abrirse un selector de variantes.

Ejemplo:

```text
Camisa básica

Talla:
[S] [M] [L] [XL]

Color:
[Blanco] [Azul] [Negro]
```

Después de seleccionar los atributos, el sistema debe identificar una variante concreta.

Ejemplo:

```text
Camisa básica
Talla: L
Color: Blanco
SKU: CAM-L-BLA
```

Y mostrar información específica:

```text
Precio: C$550
Stock en esta sucursal: 3
```

El usuario podrá entonces seleccionar la cantidad y agregarla al carrito.

---

# 7. Precio en Facturación por Caja

Cada variante puede tener un precio diferente.

Ejemplo:

| Variante | Precio Minorista |
|---|---:|
| S / Blanco | C$500 |
| M / Blanco | C$500 |
| L / Blanco | C$550 |
| XL / Blanco | C$575 |

Si el cliente selecciona:

**L / Blanco**

el sistema debe utilizar:

> **C$550**

No debe utilizar el precio general del producto padre si existe un precio específico para la variante.

La determinación del precio debe considerar:

```text
Lista de precios
    +
Variante
    ↓
Precio efectivo de venta
```

---

# 8. Carrito de venta

El detalle del carrito debe identificar la variante vendida.

Incorrecto:

```text
Camisa básica
Cantidad: 1
Precio: C$500
```

Correcto:

```text
Camisa básica
Talla: L
Color: Blanco
SKU: CAM-L-BLA
Cantidad: 1
Precio: C$550
```

El detalle de la venta debe mantener la referencia a la variante para conservar trazabilidad.

Esto permitirá conocer posteriormente:

- Qué talla se vendió.
- Qué color se vendió.
- Qué SKU se vendió.
- Qué precio tuvo.
- Qué stock fue afectado.

---

# 9. Descuento de inventario en una venta

Cuando se venda una variante, debe disminuirse únicamente el stock de esa variante.

Ejemplo:

```text
Camisa básica / L / Blanco

Stock antes: 15
Venta: 1
Stock después: 14
```

No debe disminuirse únicamente un stock genérico del producto padre.

El producto padre podrá reflejar automáticamente:

```text
Stock total antes: 30
Stock total después: 29
```

---

# 10. Órdenes de Compra

Las órdenes de compra deben trabajar con variantes cuando el producto sea variable.

No debería manejarse únicamente:

```text
Camisa básica
Cantidad: 50
```

porque esto no especifica qué combinaciones deben comprarse.

Debe poder realizarse algo como:

| Variante | Cantidad |
|---|---:|
| S / Blanco | 10 |
| M / Blanco | 15 |
| L / Blanco | 15 |
| XL / Blanco | 10 |

Total:

**50 unidades**

La orden de compra puede agrupar visualmente las variantes bajo el producto padre para facilitar la comprensión del usuario.

---

# 11. Recepción de una Orden de Compra

Cuando se reciba la mercancía, las cantidades deben aumentar en las variantes correspondientes.

Ejemplo:

Antes:

```text
S / Blanco → 5
M / Blanco → 8
L / Blanco → 3
XL / Blanco → 2
```

Se recibe:

```text
S / Blanco → +10
M / Blanco → +15
L / Blanco → +15
XL / Blanco → +10
```

Después:

```text
S / Blanco → 15
M / Blanco → 23
L / Blanco → 18
XL / Blanco → 12
```

El producto padre mostrará:

> **Stock total: 68**

Pero el stock individual seguirá perteneciendo a cada variante.

---

# 12. Productos: vista consolidada y detalle

En el listado general de productos se recomienda mostrar el producto padre de forma consolidada.

Ejemplo:

| Código | Producto | Tipo | Stock |
|---|---|---|---:|
| CAM-001 | Camisa básica | Variable | 68 |

Al entrar al producto, se debe poder visualizar el detalle de variantes:

| SKU | Talla | Color | Stock |
|---|---|---|---:|
| CAM-S-BLA | S | Blanco | 15 |
| CAM-M-BLA | M | Blanco | 23 |
| CAM-L-BLA | L | Blanco | 18 |
| CAM-XL-BLA | XL | Blanco | 12 |

Esto permite mantener una interfaz simple en el catálogo sin perder el detalle operativo.

---

# 13. Variantes y listas de precios

Las listas de precios deben permitir que cada variante tenga su propio precio.

Ejemplo:

```text
Producto: Camisa básica

Minorista
├── S / Blanco → C$500
├── M / Blanco → C$500
├── L / Blanco → C$550
└── XL / Blanco → C$575
```

Para productos sin variantes se conserva el comportamiento actual:

```text
Producto
└── Lista de precios
    └── Precio
```

Para productos con variantes:

```text
Producto
└── Variante
    └── Lista de precios
        └── Precio
```

---

# 14. Excel de listas de precios

La importación/exportación de precios para productos variables debe identificar la variante.

Formato recomendado:

| SKU Variante | Producto | Talla | Color | Costo | Minorista | Mayorista |
|---|---|---|---|---:|---:|---:|
| CAM-S-BLA | Camisa básica | S | Blanco | 300 | 500 | 450 |
| CAM-M-BLA | Camisa básica | M | Blanco | 300 | 500 | 450 |
| CAM-L-BLA | Camisa básica | L | Blanco | 350 | 550 | 500 |
| CAM-XL-BLA | Camisa básica | XL | Blanco | 375 | 575 | 525 |

Los productos sin variantes deben continuar funcionando con el formato existente.

---

# 15. Entregas

La lógica de entregas debe trabajar también con la variante.

Flujo:

```text
Factura
    ↓
Pago realizado
    ↓
Pendiente de entrega
    ↓
Sucursal realiza entrega
    ↓
Se afecta stock de la variante
    ↓
Entregada
```

Ejemplo:

```text
Factura:
Camisa básica
Talla: L
Color: Blanco
Cantidad: 1
```

Si la entrega se realiza desde Sucursal 2:

```text
Sucursal 2
Camisa básica / L / Blanco
Stock: 8 → 7
```

No debe descontarse una variante diferente ni utilizar únicamente el stock consolidado del producto padre.

---

# 16. Reglas funcionales definitivas

## Producto sin variantes

```text
Producto
├── Precio
├── Stock
├── Compra
└── Venta
```

## Producto con variantes

```text
Producto padre
│
├── Variante
│   ├── SKU
│   ├── Atributos
│   ├── Precio
│   └── Stock
│
├── Variante
│   ├── SKU
│   ├── Atributos
│   ├── Precio
│   └── Stock
│
└── ...
```

### Reglas

1. El producto padre agrupa las variantes.
2. La variante es la unidad real de venta.
3. La variante es la unidad real de inventario.
4. La variante puede tener un precio diferente.
5. La variante debe tener identificación propia.
6. El stock del producto padre es la suma de sus variantes.
7. El stock debe seguir separado por sucursal/almacén.
8. Facturación por Caja debe permitir seleccionar la variante.
9. Caja debe mostrar el stock individual de la variante seleccionada.
10. Caja debe utilizar el precio correspondiente a la variante.
11. El detalle de venta debe guardar la variante.
12. Las órdenes de compra deben permitir comprar cantidades por variante.
13. La recepción de compra debe incrementar la variante correspondiente.
14. Las entregas deben afectar la variante específica.
15. Los productos sin variantes deben seguir funcionando como actualmente.
16. No se debe crear una variante artificial para productos que no la necesitan.

---

# 17. Ejemplo completo del flujo

## Producto

**Camisa básica**

Variantes:

```text
S / Blanco
M / Blanco
L / Blanco
XL / Blanco
```

## Precios

```text
S / Blanco  → C$500
M / Blanco  → C$500
L / Blanco  → C$550
XL / Blanco → C$575
```

## Inventario inicial

```text
S / Blanco  → 5
M / Blanco  → 8
L / Blanco  → 3
XL / Blanco → 2

Total padre = 18
```

## Facturación

Cliente compra:

```text
L / Blanco
Cantidad: 1
```

Caja muestra:

```text
Precio: C$550
Stock: 3
```

Se agrega al carrito:

```text
Camisa básica / L / Blanco
Cantidad: 1
Precio: C$550
```

Stock:

```text
L / Blanco → 3 → 2
```

Stock consolidado:

```text
18 → 17
```

## Compra

Posteriormente se compran:

```text
L / Blanco → 10
XL / Blanco → 5
```

Al recibir:

```text
L / Blanco → 12
XL / Blanco → 7
```

El producto padre pasa a mostrar:

```text
Stock total = 24
```

pero cada variante conserva su stock individual.

---

# 18. Recomendación arquitectónica

La solución debe evitar duplicar información entre padre e hija.

El principio recomendado es:

```text
Producto padre
= Catálogo + agrupación + información consolidada

Variante
= SKU + atributos + precio + inventario + unidad vendible
```

El sistema debe calcular o consultar la información consolidada del padre a partir de sus variantes cuando corresponda.

Esto permite que la misma variante sea utilizada consistentemente por:

```text
Listas de precios
        ↓
Facturación por Caja
        ↓
Inventario
        ↓
Órdenes de Compra
        ↓
Recepción
        ↓
Entregas
        ↓
Reportes
```

La prioridad debe ser mantener la trazabilidad completa de la variante desde que se compra hasta que se vende y entrega.

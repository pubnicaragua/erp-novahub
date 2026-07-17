# 🎨 Guía de Diseño NovaHub - Sistema Unificado

**Versión 2.4.0 - Diseño Base Oficial**

Esta guía define el estilo visual, tipografía, animaciones y componentes que **TODOS** los módulos deben seguir para mantener consistencia profesional en todo el ERP.

------

## 🎯 Filosofía de Diseño

- **Tipografía audaz y moderna**: Font-black, italic, uppercase, tracking-widest
- **Contraste adaptativo**: Dark mode nativo + Light mode optimizado
- **Animaciones suaves**: Framer Motion con transiciones fluidas
- **Espaciado generoso**: Padding y gaps amplios para respiración
- **Colores vibrantes**: Emerald como color primario, con acentos por módulo

---

## 📐 Tipografía Oficial

### Headers Principales
```tsx
<h1 className="text-4xl font-black tracking-tighter text-white uppercase italic flex items-center gap-3">
  <IconComponent className="size-10 text-emerald-500 fill-emerald-500/20" />
  Nombre <span className="text-emerald-500">Módulo</span>
</h1>
```

### Badges de Versión
```tsx
<Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 px-3 py-1 text-[10px] font-black uppercase tracking-widest">
  Descripción del Módulo
</Badge>
```

### Labels de Formularios
```tsx
<Label className="text-[10px] uppercase font-black tracking-widest text-white/40 ml-1">
  Campo
</Label>
```

### Texto de Ayuda
```tsx
<p className="text-[9px] text-white/30 ml-1">
  Descripción o ayuda contextual
</p>
```

---

## 🎨 Paleta de Colores por Módulo

| Módulo | Color Primario | Hex | Uso |
|--------|---------------|-----|-----|
| **Global/Base** | Emerald | `#10b981` | Botones principales, iconos destacados |
| **Inventario** | Blue | `#3b82f6` | Stats, badges, iconos |
| **Ventas** | Purple | `#a855f7` | Stats, badges, iconos |
| **Finanzas** | Emerald | `#10b981` | Stats, badges, iconos |
| **RH** | Orange | `#f97316` | Stats, badges, iconos |
| **Proyectos** | Cyan | `#06b6d4` | Stats, badges, iconos |
| **Suscripciones** | Emerald | `#10b981` | Sistema base |

---

## 🧩 Componentes Estándar

### 1. Stats Card
```tsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  className="bg-card border border-border/50 rounded-2xl p-6 hover:border-primary/30 transition-all group"
>
  <div className="flex items-center gap-4">
    <div className="size-12 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
      <Icon className="size-6 text-emerald-500" />
    </div>
    <div className="flex-1">
      <p className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Label</p>
      <p className="text-3xl font-black tracking-tighter text-foreground mt-1">1,234</p>
    </div>
  </div>
</motion.div>
```

### 2. Botón Primario
```tsx
<Button className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2 shadow-xl shadow-emerald-900/40 px-8 h-12 rounded-2xl transition-all hover:scale-105 active:scale-95 font-bold">
  <Plus className="size-5" /> Acción Principal
</Button>
```

### 3. Input de Formulario
```tsx
<Input 
  placeholder="Placeholder..." 
  className="bg-white/5 dark:bg-white/5 border-white/10 dark:border-white/10 h-11 rounded-xl" 
  value={value}
  onChange={e => setValue(e.target.value)}
/>
```

### 4. Card de Lista
```tsx
<Card className="bg-card border-border/50 overflow-hidden hover:border-primary/30 transition-all group">
  <div className="flex items-center gap-4 p-6">
    {/* Contenido */}
  </div>
</Card>
```

### 5. Badge de Estado
```tsx
<Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px] font-black uppercase tracking-widest px-3 py-1">
  ACTIVO
</Badge>
```

---

## 🎭 Animaciones con Framer Motion

### Entrada de Componente
```tsx
<motion.div
  initial={{ opacity: 0, x: -20 }}
  animate={{ opacity: 1, x: 0 }}
  transition={{ duration: 0.3 }}
>
  {/* Contenido */}
</motion.div>
```

### Lista con Stagger
```tsx
<motion.div
  variants={{
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  }}
  initial="hidden"
  animate="show"
>
  {items.map((item, i) => (
    <motion.div
      key={i}
      variants={{
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 }
      }}
    >
      {/* Item */}
    </motion.div>
  ))}
</motion.div>
```

---

## 🌓 Modo Claro vs Oscuro

### Reglas Críticas para Contraste

**❌ NUNCA usar:**
- `text-white` sin variante dark
- `bg-black` sin variante light
- Colores fijos que no se adapten

**✅ SIEMPRE usar:**
- `text-foreground` (se adapta automáticamente)
- `text-muted-foreground` (texto secundario)
- `bg-card`, `bg-background` (fondos adaptativos)
- `border-border` (bordes adaptativos)

### Ejemplo Correcto
```tsx
// ❌ MAL - Invisible en modo claro
<p className="text-white/60">Texto</p>

// ✅ BIEN - Se adapta al tema
<p className="text-muted-foreground">Texto</p>

// ✅ BIEN - Variante específica
<p className="text-white dark:text-white/60">Texto</p>
```

---

## 📋 Tabs de Navegación

```tsx
<Tabs defaultValue="tab1" className="w-full">
  <TabsList className="bg-muted/50 p-1 rounded-2xl w-full">
    <TabsTrigger 
      value="tab1" 
      className="flex-1 rounded-xl data-[state=active]:bg-background data-[state=active]:shadow-lg uppercase text-xs font-black tracking-widest"
    >
      <Icon className="size-4 mr-2" />
      Tab 1
    </TabsTrigger>
    <TabsTrigger value="tab2" className="flex-1 rounded-xl uppercase text-xs font-black tracking-widest">
      Tab 2
    </TabsTrigger>
  </TabsList>

  <TabsContent value="tab1" className="mt-6">
    {/* Contenido */}
  </TabsContent>
</Tabs>
```

---

## 🔍 Barra de Búsqueda

```tsx
<div className="relative">
  <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground/60" />
  <Input 
    placeholder="Buscar por nombre, código o categoría..." 
    className="pl-12 h-12 rounded-2xl bg-muted/30 border-border/50" 
    value={searchTerm}
    onChange={e => setSearchTerm(e.target.value)}
  />
</div>
```

---

## 📊 Tabla de Datos

```tsx
<Table>
  <TableHeader>
    <TableRow className="border-border/50 hover:bg-transparent">
      <TableHead className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Columna</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow className="border-border/50 hover:bg-muted/20 transition-colors">
      <TableCell className="font-medium text-foreground">Dato</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

---

## 🚨 Estados de Carga y Vacío

### Loading State
```tsx
{loading ? (
  <div className="flex items-center justify-center py-20">
    <div className="flex flex-col items-center gap-4">
      <div className="size-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      <p className="text-sm text-muted-foreground font-bold uppercase tracking-widest">Cargando datos...</p>
    </div>
  </div>
) : (
  {/* Contenido */}
)}
```

### Empty State
```tsx
<Card className="bg-card border-dashed border-border/50 py-20">
  <div className="flex flex-col items-center justify-center text-center">
    <Icon className="size-12 text-muted-foreground/20 mb-4" />
    <p className="text-muted-foreground font-bold uppercase tracking-widest text-xs">
      No hay datos disponibles
    </p>
  </div>
</Card>
```

---

## 🎯 Checklist de Implementación

Al crear un nuevo módulo, verificar:

- [ ] Header con tipografía audaz (font-black, italic, uppercase)
- [ ] Badge de versión/descripción con tracking-widest
- [ ] Stats cards con iconos y colores del módulo
- [ ] Botón primario emerald con hover effects
- [ ] Inputs con rounded-xl y border-white/10
- [ ] Cards con hover:border-primary/30
- [ ] Animaciones de entrada con Framer Motion
- [ ] Contraste correcto en modo claro (usar text-foreground)
- [ ] Labels en uppercase con tracking-widest
- [ ] Badges de estado con colores semánticos
- [ ] Empty states con diseño consistente
- [ ] Loading states con spinner y mensaje

---

## 📝 Ejemplo Completo de Módulo

Ver `SuscripcionesPage.tsx` como referencia oficial del diseño base.

**Características clave:**
- Tipografía audaz y consistente
- Contraste adaptativo (dark/light mode)
- Animaciones suaves con Framer Motion
- Espaciado generoso y respiración
- Colores vibrantes con emerald como base
- Componentes reutilizables

---

## 🚀 Mantener Consistencia

**TODOS los módulos deben:**
1. Seguir esta guía de diseño
2. Usar los mismos componentes base
3. Mantener la tipografía audaz
4. Respetar el contraste en ambos modos
5. Implementar animaciones suaves
6. Usar emerald como color primario global

**Esta es la base del mejor ERP del mundo. 🌟**

import { useState, useEffect, useCallback } from 'react';
import { Tag, Plus, Trash2, X, Edit2, Loader2, Tags, Layers, FolderOpen } from 'lucide-react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { toast } from 'sonner';
import { inventoryService } from '../../services/inventario.service';
import { ConfirmDialog } from '../ui/ConfirmDialog';

interface Attribute {
  id: string;
  name: string;
  description?: string;
  options: string[];
  _count?: { productVariants?: number };
}

interface Category {
  id: string;
  name: string;
  description?: string;
  type?: string;
  _count?: { products?: number };
}

export function AtributosView() {
  const [activeTab, setActiveTab] = useState('atributos');

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-border/40 bg-gradient-to-r from-primary/10 via-background to-amber-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/15 p-2.5">
            <Tags className="size-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-black uppercase tracking-tight">Atributos y Categoría</h2>
            <p className="text-xs text-muted-foreground">Define variantes (Talla, Color, etc.) y organiza productos por categoría.</p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex h-auto w-max gap-1.5 rounded-xl border border-border/40 bg-muted/30 p-1">
          <TabsTrigger value="atributos" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Tag className="size-3.5" /> Atributos
          </TabsTrigger>
          <TabsTrigger value="categorias" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <FolderOpen className="size-3.5" /> Categorías
          </TabsTrigger>
        </TabsList>

        <TabsContent value="atributos">
          <AtributosTab />
        </TabsContent>

        <TabsContent value="categorias">
          <CategoriasTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AtributosTab() {
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formOptions, setFormOptions] = useState<string[]>([]);
  const [optionInput, setOptionInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState('');

  const loadAttributes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await inventoryService.getAttributes();
      const data = (res as any)?.data || res || [];
      setAttributes(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Error al cargar atributos');
      setAttributes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAttributes();
  }, [loadAttributes]);

  const filtered = attributes.filter(
    (a) => !search || a.name.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditingId(null);
    setFormName('');
    setFormDescription('');
    setFormOptions([]);
    setOptionInput('');
    setModalOpen(true);
  };

  const openEdit = (attr: Attribute) => {
    setEditingId(attr.id);
    setFormName(attr.name);
    setFormDescription(attr.description || '');
    setFormOptions([...attr.options]);
    setOptionInput('');
    setModalOpen(true);
  };

  const addOption = () => {
    const trimmed = optionInput.trim();
    if (!trimmed) return;
    if (formOptions.some((o) => o.toLowerCase() === trimmed.toLowerCase())) {
      toast.warning('Esta opción ya existe');
      return;
    }
    setFormOptions((prev) => [...prev, trimmed]);
    setOptionInput('');
  };

  const removeOption = (index: number) => {
    setFormOptions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleOptionKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addOption();
    }
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }
    if (formOptions.length < 2) {
      toast.error('Agrega al menos 2 opciones');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        options: formOptions,
      };
      if (editingId) {
        await inventoryService.updateAttribute(editingId, payload);
        toast.success('Atributo actualizado');
      } else {
        await inventoryService.createAttribute(payload);
        toast.success('Atributo creado');
      }
      setModalOpen(false);
      void loadAttributes();
    } catch (e: any) {
      toast.error(e?.message || 'Error al guardar atributo');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await inventoryService.deleteAttribute(deleteId);
      toast.success('Atributo eliminado');
      setDeleteId(null);
      void loadAttributes();
    } catch (e: any) {
      toast.error(e?.message || 'Error al eliminar atributo');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
          Los atributos se vinculan al crear un producto variable
        </p>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar atributo..."
            className="h-9 w-full rounded-xl sm:w-44"
          />
          <Button onClick={openCreate} size="sm" className="h-10 w-full rounded-xl px-3 text-[10px] font-black uppercase tracking-widest sm:w-auto">
            <Plus className="mr-1 size-3.5" /> Nuevo
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="rounded-2xl border-dashed p-8 text-center text-muted-foreground">
          <Tag className="mx-auto mb-2 size-9 opacity-20" />
          <p>{search ? 'No se encontraron atributos' : 'No hay atributos creados'}</p>
          <p className="text-sm">{search ? 'Intenta con otro nombre' : 'Crea tu primer atributo para empezar a definir variantes.'}</p>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/50">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-black text-[10px] uppercase tracking-widest">Nombre</TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-widest">Descripción</TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-widest">Opciones</TableHead>
                <TableHead className="text-right font-black text-[10px] uppercase tracking-widest">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((attr) => (
                <TableRow key={attr.id} className="hover:bg-muted/20 transition-colors">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Tag className="size-4 text-primary" />
                      <span className="font-bold text-sm">{attr.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {attr.description || '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {attr.options.map((opt, i) => (
                        <Badge key={i} variant="secondary" className="text-[9px]">
                          {opt}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(attr)}>
                        <Edit2 className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-red-500 hover:text-white hover:bg-red-500"
                        onClick={() => setDeleteId(attr.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Modal crear/editar */}
      <Dialog open={modalOpen} onOpenChange={(v) => { if (!saving) setModalOpen(v); }}>
        <DialogContent className="w-[calc(100vw-2rem)] !max-w-[min(92vw,520px)]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-black">
              <Tag className="size-5 text-primary" />
              {editingId ? 'Editar Atributo' : 'Nuevo Atributo'}
            </DialogTitle>
            <DialogDescription>
              {editingId ? 'Modifica el nombre o las opciones del atributo.' : 'Define un atributo con sus opciones para usar en productos variables.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-muted-foreground">Nombre *</label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="h-9 text-sm uppercase"
                placeholder="Ej: TALLA, COLOR, MATERIAL"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-muted-foreground">Descripción <span className="normal-case font-medium">(opcional)</span></label>
              <Input
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                className="h-9 text-xs"
                placeholder="Descripción breve del atributo"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-muted-foreground">Opciones *</label>
              <div className="flex gap-1.5">
                <Input
                  value={optionInput}
                  onChange={(e) => setOptionInput(e.target.value)}
                  onKeyDown={handleOptionKeyDown}
                  className="h-9 flex-1 text-xs"
                  placeholder="Escribir y presionar Enter o +"
                />
                <Button type="button" variant="outline" size="icon" className="size-9 shrink-0" onClick={addOption} disabled={!optionInput.trim()}>
                  <Plus className="size-4" />
                </Button>
              </div>
              {formOptions.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {formOptions.map((opt, idx) => (
                    <Badge key={idx} variant="secondary" className="gap-1 text-xs pr-1">
                      {opt}
                      <button
                        type="button"
                        onClick={() => removeOption(idx)}
                        className="ml-0.5 rounded-full p-0.5 hover:bg-destructive/20 hover:text-destructive"
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-muted-foreground pt-1">Agrega al menos 2 opciones (ej: S, M, L, XL)</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving || !formName.trim() || formOptions.length < 2} className="font-bold">
              {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear atributo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmación eliminar */}
      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Eliminar atributo"
        description="Esta acción eliminará el atributo permanentemente. Los productos que lo usen podrían verse afectados."
        confirmLabel={deleting ? 'Eliminando...' : 'Eliminar'}
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
}

function CategoriasTab() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState('');

  const loadCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await inventoryService.getCategories();
      const data = (res as any)?.data || res || [];
      setCategories(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Error al cargar categorías');
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  const filtered = categories.filter(
    (c) => !search || c.name.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditingId(null);
    setFormName('');
    setFormDescription('');
    setModalOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditingId(cat.id);
    setFormName(cat.name);
    setFormDescription(cat.description || '');
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: formName.trim(),
        description: formDescription.trim() || undefined,
      };
      if (editingId) {
        await inventoryService.updateCategory(editingId, payload);
        toast.success('Categoría actualizada');
      } else {
        await inventoryService.createCategory(payload);
        toast.success('Categoría creada');
      }
      setModalOpen(false);
      void loadCategories();
    } catch (e: any) {
      toast.error(e?.message || 'Error al guardar categoría');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await inventoryService.deleteCategory(deleteId);
      toast.success('Categoría eliminada');
      setDeleteId(null);
      void loadCategories();
    } catch (e: any) {
      toast.error(e?.message || 'Error al eliminar categoría');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
          Organiza tus productos por categoría
        </p>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar categoría..."
            className="h-9 w-full rounded-xl sm:w-44"
          />
          <Button onClick={openCreate} size="sm" className="h-10 w-full rounded-xl px-3 text-[10px] font-black uppercase tracking-widest sm:w-auto">
            <Plus className="mr-1 size-3.5" /> Nuevo
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="rounded-2xl border-dashed p-8 text-center text-muted-foreground">
          <FolderOpen className="mx-auto mb-2 size-9 opacity-20" />
          <p>{search ? 'No se encontraron categorías' : 'No hay categorías creadas'}</p>
          <p className="text-sm">{search ? 'Intenta con otro nombre' : 'Crea tu primera categoría para organizar los productos.'}</p>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/50">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-black text-[10px] uppercase tracking-widest">Nombre</TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-widest">Descripción</TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-widest">Tipo</TableHead>
                <TableHead className="text-right font-black text-[10px] uppercase tracking-widest">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((cat) => (
                <TableRow key={cat.id} className="hover:bg-muted/20 transition-colors">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Layers className="size-4 text-primary" />
                      <span className="font-bold text-sm">{cat.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {cat.description || '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-[9px]">
                      {cat.type === 'SERVICE' ? 'Servicio' : 'Producto'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(cat)}>
                        <Edit2 className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-red-500 hover:text-white hover:bg-red-500"
                        onClick={() => setDeleteId(cat.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Modal crear/editar */}
      <Dialog open={modalOpen} onOpenChange={(v) => { if (!saving) setModalOpen(v); }}>
        <DialogContent className="w-[calc(100vw-2rem)] !max-w-[min(92vw,520px)]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-black">
              <Layers className="size-5 text-primary" />
              {editingId ? 'Editar Categoría' : 'Nueva Categoría'}
            </DialogTitle>
            <DialogDescription>
              {editingId ? 'Modifica el nombre o la descripción de la categoría.' : 'Crea una categoría para organizar tus productos.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-muted-foreground">Nombre *</label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="h-9 text-sm"
                placeholder="Ej: Electrónica, Ropa, Alimentos"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-muted-foreground">Descripción <span className="normal-case font-medium">(opcional)</span></label>
              <Input
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                className="h-9 text-xs"
                placeholder="Descripción breve de la categoría"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving || !formName.trim()} className="font-bold">
              {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear categoría'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmación eliminar */}
      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Eliminar categoría"
        description="Esta acción eliminará la categoría permanentemente. Los productos asociados podrían verse afectados."
        confirmLabel={deleting ? 'Eliminando...' : 'Eliminar'}
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
}

import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { BookOpen, FileText, Plus, Search, FolderOpen, FileCheck } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import { knowledgeBaseService } from '../../services/support.service';

interface KnowledgeArticle {
  id: string;
  name: string;
  url: string;
  size: number;
  mimeType: string;
  folder?: string | null;
}

interface KnowledgeBaseViewProps {
  data: KnowledgeArticle[];
  loading: boolean;
  onRefresh: () => void;
}

export const KnowledgeBaseView: React.FC<KnowledgeBaseViewProps> = ({ data, loading, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const mimeTypeOptions = [
    { value: 'text/markdown', label: 'Markdown' },
    { value: 'text/plain', label: 'Texto' },
    { value: 'application/pdf', label: 'PDF' },
    { value: 'text/html', label: 'HTML' },
    { value: 'application/json', label: 'JSON' },
  ];

  const columns: ColumnDef<KnowledgeArticle>[] = [
    { key: 'name', header: 'Artículo', width: '28%', editable: true },
    { key: 'folder', header: 'Categoría', width: '16%', editable: true },
    {
      key: 'mimeType',
      header: 'Formato',
      width: '14%',
      editable: true,
      type: 'select',
      options: mimeTypeOptions,
      render: (val: any) => {
        const opt = mimeTypeOptions.find((item) => item.value === val);
        return (
          <span className="text-[10px] font-black uppercase tracking-widest text-foreground/80">
            {opt?.label || val || '-'}
          </span>
        );
      },
    },
    {
      key: 'size',
      header: 'Tamaño',
      width: '110px',
      editable: true,
      type: 'number',
      render: (val: any) => `${(Number(val || 0) / 1024).toFixed(1)} KB`,
    },
    {
      key: 'url',
      header: 'URL',
      width: '42%',
      editable: true,
      render: (val: any) =>
        val ? (
          <a
            href={String(val)}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-blue-500 hover:text-blue-600 underline underline-offset-2"
          >
            {String(val)}
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        ),
    },
  ];

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return data;
    return data.filter((item) =>
      [item.name, item.folder, item.mimeType, item.url].some((field) =>
        String(field || '')
          .toLowerCase()
          .includes(q),
      ),
    );
  }, [data, searchTerm]);

  const handleUpdate = async (id: string | number, updates: Partial<KnowledgeArticle>) => {
    try {
      await knowledgeBaseService.update(String(id), updates as any);
      toast.success('Artículo actualizado');
      onRefresh();
    } catch (error: any) {
      toast.error(error?.message || 'Error al actualizar artículo');
    }
  };

  const handleAdd = async () => {
    try {
      await knowledgeBaseService.create({
        name: 'Nuevo artículo',
        folder: 'General',
        mimeType: 'text/markdown',
        size: 0,
        url: `https://docs.novahub.local/articulo-${Date.now()}`,
      } as any);
      toast.success('Artículo creado');
      onRefresh();
    } catch (error: any) {
      toast.error(error?.message || 'Error al crear artículo');
    }
  };

  const kpis = [
    {
      title: 'Total Artículos',
      value: data.length,
      icon: BookOpen,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
    },
    {
      title: 'Documentación',
      value: data.filter((doc) => ['text/markdown', 'text/plain', 'text/html'].includes((doc.mimeType || '').toLowerCase())).length,
      icon: FileText,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
    },
    {
      title: 'PDFs',
      value: data.filter((doc) => (doc.mimeType || '').toLowerCase() === 'application/pdf').length,
      icon: FileCheck,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
    },
    {
      title: 'Categorías',
      value: new Set(data.map((doc) => (doc.folder || 'General').toLowerCase())).size,
      icon: FolderOpen,
      color: 'text-violet-500',
      bg: 'bg-violet-500/10',
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.title} className="border-none bg-background/50 backdrop-blur-xl shadow-sm hover:shadow-md transition-all duration-300">
            <CardContent className="p-5 flex items-center gap-4">
              <div className={cn('p-3 rounded-2xl flex items-center justify-center', kpi.bg)}>
                <kpi.icon className={cn('size-6', kpi.color)} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{kpi.title}</p>
                <p className="text-2xl font-black tracking-tight">{kpi.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-none bg-background/50 backdrop-blur-xl shadow-sm">
        <div className="p-4 border-b border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight">Base de Conocimiento</h2>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">
              Procedimientos, guías y referencias internas
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" />
              <Input
                placeholder="Buscar artículo..."
                className="pl-9 h-10 w-56 bg-background/50 border-border/50 rounded-xl text-xs"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button
              onClick={handleAdd}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2"
            >
              <Plus className="size-4" />
              Nuevo Artículo
            </Button>
          </div>
        </div>

        <EditableDataTable
          data={filtered}
          columns={columns}
          onRowUpdate={handleUpdate}
          isLoading={loading}
          onRowDelete={async (id) => {
            try {
              await knowledgeBaseService.delete(String(id));
              toast.success('Artículo eliminado');
              onRefresh();
            } catch (error: any) {
              toast.error(error?.message || 'Error al eliminar artículo');
            }
          }}
        />
      </Card>
    </div>
  );
};

import React, { useState } from 'react';
import { EditableDataTable, ColumnDef } from '../ui/EditableDataTable';
import { File as FileModel } from '../../types';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Plus, Search, HardDrive, File as FileIcon, Image as ImageIcon, FileArchive } from 'lucide-react';
import { filesService } from '../../services/documentos.service';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import { format } from 'date-fns';

interface ArchivosViewProps {
  data: FileModel[];
  loading: boolean;
  onRefresh: () => void;
}

export const ArchivosView: React.FC<ArchivosViewProps> = ({ data, loading, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const columns: ColumnDef<FileModel>[] = [
    { key: 'name', header: 'Nombre', width: '40%', editable: true },
    { key: 'type', header: 'Tipo', width: '15%' },
    { key: 'size', header: 'Tamaño', width: '100px', render: (val: any) => val ? `${(Number(val)/1024).toFixed(1)} KB` : '-' },
    { key: 'category', header: 'Categoría', width: '150px', editable: true },
    { key: 'uploadDate', header: 'Subido', width: '150px', type: 'date', render: (val: any) => val ? format(new Date(val), 'MMM dd, yyyy') : '-' },
  ];

  const handleUpdate = async (id: string | number, updates: Partial<FileModel>) => {
    try { await filesService.update(id as string, updates); toast.success('Archivo actualizado'); onRefresh(); }
    catch { toast.error('Error al actualizar'); }
  };

  const handleAdd = async () => {
    try {
      await filesService.create({ name: 'Nuevo_Documento.pdf', type: 'application/pdf', size: 1024, category: 'General', uploadDate: new Date().toISOString() });
      toast.success('Archivo subido'); onRefresh();
    } catch { toast.error('Error al subir'); }
  };

  const kpis = [
    { title: 'Total Archivos', value: data.length,                                                                    icon: HardDrive,   color: 'text-blue-500',    bg: 'bg-blue-500/10'    },
    { title: 'Documentos',     value: data.filter(f => f.type?.includes('pdf') || f.type?.includes('doc')).length,   icon: FileIcon,    color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { title: 'Imágenes',       value: data.filter(f => f.type?.includes('image')).length,                            icon: ImageIcon,   color: 'text-amber-500',  bg: 'bg-amber-500/10'   },
    { title: 'Comprimidos',    value: data.filter(f => f.type?.includes('zip') || f.type?.includes('rar')).length,   icon: FileArchive, color: 'text-purple-500',  bg: 'bg-purple-500/10'  },
  ];

  const filtered = data.filter(f => f.name?.toLowerCase().includes(searchTerm.toLowerCase()) || f.category?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <Card key={i} className="border-none bg-background/50 backdrop-blur-xl shadow-sm hover:shadow-md transition-all duration-300">
            <CardContent className="p-5 flex items-center gap-4">
              <div className={cn("p-3 rounded-2xl flex items-center justify-center", kpi.bg)}><kpi.icon className={cn("size-6", kpi.color)} /></div>
              <div><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{kpi.title}</p><p className="text-2xl font-black tracking-tight">{kpi.value}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-none bg-background/50 backdrop-blur-xl shadow-sm">
        <div className="p-4 border-b border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div><h2 className="text-xl font-black uppercase tracking-tight">Archivos</h2><p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">Almacenamiento en la nube</p></div>
          <div className="flex items-center gap-3">
            <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" /><Input placeholder="Buscar..." className="pl-9 h-10 w-56 bg-background/50 border-border/50 rounded-xl text-xs" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
            <Button onClick={handleAdd} className="bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-[10px] tracking-widest px-4 h-10 rounded-xl gap-2"><Plus className="size-4" /> Subir Archivo</Button>
          </div>
        </div>
        <EditableDataTable data={filtered} columns={columns} onRowUpdate={handleUpdate} isLoading={loading} onRowDelete={async (id) => { try { await filesService.delete(id as string); toast.success('Eliminado'); onRefresh(); } catch { toast.error('Error al eliminar'); } }} />
      </Card>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { FolderOpen, Plus, Search, File, FileText, FileSpreadsheet, Image as ImageIcon, Download, Eye, Trash2, Upload, FolderPlus, MoreVertical, HardDrive } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { documentsService } from '../services/documents.service';
import { toast } from 'sonner';
import type { Document as AppDocument } from '../types';

const fileIcons: Record<string, React.ReactNode> = {
  'application/pdf': <FileText className="size-5 text-red-500" />,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': <FileSpreadsheet className="size-5 text-emerald-500" />,
  'text/csv': <FileSpreadsheet className="size-5 text-emerald-500" />,
  'application/vnd.ms-excel': <FileSpreadsheet className="size-5 text-emerald-500" />,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': <FileText className="size-5 text-blue-500" />,
  'image/png': <ImageIcon className="size-5 text-amber-500" />,
  'image/jpeg': <ImageIcon className="size-5 text-amber-500" />,
  'image/svg+xml': <ImageIcon className="size-5 text-pink-500" />,
};

export function DocumentosPage() {
  const [files, setFiles] = useState<AppDocument[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  const [isFolderDialogOpen, setIsFolderDialogOpen] = useState(false);
  const [folderName, setFolderName] = useState('');

  const [isFileDialogOpen, setIsFileDialogOpen] = useState(false);
  const [fileData, setFileData] = useState({
    name: '',
    mimeType: 'application/pdf',
    folder: 'General',
    url: '',
    size: 0
  });

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const res = await documentsService.getAll();
      setFiles(res.data || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast.error('Error al sincronizar documentos');
    } finally {
      setLoading(false);
    }
  };

  const folders = Array.from(new Set(files.map(f => f.folder).filter(Boolean))) as string[];
  if (!folders.includes('General')) folders.push('General');

  const folderStats = folders.map(folder => {
    const folderFiles = files.filter(f => (f.folder || 'General') === folder);
    const totalSize = folderFiles.reduce((acc, f) => acc + (f.size || 0), 0);
    return {
      nombre: folder,
      archivos: folderFiles.length,
      size: totalSize > 1024 * 1024 
        ? `${(totalSize / (1024 * 1024)).toFixed(1)} MB` 
        : `${(totalSize / 1024).toFixed(0)} KB`,
      color: folder === 'General' ? 'text-primary' : 'text-blue-500/70'
    };
  });

  const handleCreateFolder = () => {
    if (!folderName.trim()) return;
    toast.success(`Carpeta "${folderName}" lista para usar`);
    setFolderName('');
    setIsFolderDialogOpen(false);
  };

  const handleUploadFile = async () => {
    if (!fileData.name.trim() || !fileData.url.trim()) {
        toast.error('Nombre y URL son requeridos');
        return;
    }
    try {
      await documentsService.create(fileData);
      toast.success('Documento guardado con éxito');
      setIsFileDialogOpen(false);
      fetchDocuments();
      setFileData({ name: '', mimeType: 'application/pdf', folder: 'General', url: '', size: 0 });
    } catch (error) {
      console.error('Error uploading document:', error);
      toast.error('Error al guardar documento');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Eliminar definitivamente este documento?')) {
      try {
        await documentsService.delete(id);
        toast.success('Documento eliminado');
        fetchDocuments();
      } catch (error) {
        console.error('Error deleting document:', error);
        toast.error('Error al eliminar');
      }
    }
  };

  const filteredFiles = files.filter(f => 
    f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (f.folder || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <FolderOpen className="size-6 text-primary" /> Documentos y Archivos
          </h1>
          <p className="text-sm text-muted-foreground">Repositorio central para la gestión documental de la empresa.</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isFolderDialogOpen} onOpenChange={setIsFolderDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><FolderPlus className="mr-2 size-4" /> Nueva Carpeta</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[400px]">
              <DialogHeader>
                <DialogTitle>Organizar Carpetas</DialogTitle>
                <DialogDescription>Asigna un nombre para categorizar tus documentos.</DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Label>Nombre de la categoría/carpeta</Label>
                <Input value={folderName} onChange={e => setFolderName(e.target.value)} placeholder="Ej. Contratos RRHH" className="mt-2" />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsFolderDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleCreateFolder}>Crear Carpeta</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isFileDialogOpen} onOpenChange={setIsFileDialogOpen}>
            <DialogTrigger asChild>
              <Button className="shadow-lg shadow-primary/20"><Upload className="mr-2 size-4" /> Subir Archivo</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Cargar Nuevo Documento</DialogTitle>
                <DialogDescription>Vincula un archivo externo al repositorio del ERP.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Nombre del Documento</Label>
                  <Input value={fileData.name} onChange={e => setFileData({ ...fileData, name: e.target.value })} placeholder="Ej. Manual Operativo_v2.pdf" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label>Tipo de Archivo</Label>
                        <Select value={fileData.mimeType} onValueChange={v => setFileData({ ...fileData, mimeType: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="application/pdf">PDF</SelectItem>
                                <SelectItem value="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet">Excel</SelectItem>
                                <SelectItem value="image/png">Imagen</SelectItem>
                                <SelectItem value="text/csv">CSV</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label>Carpeta</Label>
                        <Select value={fileData.folder} onValueChange={v => setFileData({ ...fileData, folder: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {folders.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="grid gap-2">
                  <Label>Enlace / URL del archivo</Label>
                  <Input value={fileData.url} onChange={e => setFileData({ ...fileData, url: e.target.value })} placeholder="https://cloud.storage/file.pdf" />
                </div>
                <div className="grid gap-2">
                  <Label>Tamaño aproximado (Bytes)</Label>
                  <Input type="number" value={fileData.size} onChange={e => setFileData({ ...fileData, size: parseInt(e.target.value) || 0 })} placeholder="Bytes" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsFileDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleUploadFile}>Confirmar Carga</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-6 overflow-x-auto pb-2">
        {folderStats.map(folder => (
          <Card key={folder.nombre} className="min-w-[150px] cursor-pointer transition-all hover:shadow-md hover:shadow-primary/5 hover:border-primary/30 group">
            <CardContent className="p-4 text-center">
              <FolderOpen className={`size-10 mx-auto mb-2 transition-transform group-hover:scale-110 ${folder.color}`} />
              <p className="text-sm font-bold truncate group-hover:text-primary transition-colors">{folder.nombre}</p>
              <p className="text-[10px] text-muted-foreground font-medium mt-1">{folder.archivos} archivos • {folder.size}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar por nombre o categoría..." className="pl-9 bg-muted/30 border-none h-10" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/20 px-3 py-2 rounded-lg border border-border/50">
              <HardDrive className="size-3.5" />
              <span>Espacio utilizado: <span className="text-foreground font-bold">128.4 MB</span> / 1 GB</span>
          </div>
      </div>

      <Card className="border-border/50 shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/30 pb-4 border-b border-border/50 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold">Repositorio de Archivos</CardTitle>
            <Badge variant="secondary" className="text-[10px] font-bold">{filteredFiles.length} Resultados</Badge>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border/50">
            {loading && filteredFiles.length === 0 ? (
                <div className="p-12 text-center animate-pulse text-muted-foreground">Sincronizando con el servidor de archivos...</div>
            ) : filteredFiles.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-2">
                    <File className="size-12 opacity-10" />
                    <p>No se encontraron documentos.</p>
                </div>
            ) : (
                filteredFiles.map(file => (
                  <div key={file.id} className="flex items-center gap-4 p-4 transition-all hover:bg-muted/10 group">
                    <div className="relative">
                        <div className="absolute -inset-1 bg-primary/20 rounded-full blur opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="relative bg-muted/50 p-2 rounded-lg border border-border group-hover:border-primary/50 transition-colors">
                            {fileIcons[file.mimeType] || <File className="size-6 text-muted-foreground" />}
                        </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate group-hover:text-primary transition-colors">{file.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-[9px] h-4 py-0 font-medium bg-muted/30">{file.folder || 'General'}</Badge>
                          <span className="text-[10px] text-muted-foreground">{(file.size / 1024).toFixed(0)} KB • {new Date(file.createdAt || Date.now()).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="size-9 rounded-full" asChild>
                          <a href={file.url} target="_blank" rel="noreferrer" title="Ver archivo"><Eye className="size-4" /></a>
                      </Button>
                      <Button variant="ghost" size="icon" className="size-9 rounded-full" asChild>
                          <a href={file.url} download title="Descargar"><Download className="size-4" /></a>
                      </Button>
                      <Button variant="ghost" size="icon" className="size-9 rounded-full text-red-500 hover:bg-red-500/10" onClick={() => handleDelete(file.id)} title="Eliminar">
                          <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

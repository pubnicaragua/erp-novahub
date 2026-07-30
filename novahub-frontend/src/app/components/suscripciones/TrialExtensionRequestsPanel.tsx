import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { toast } from 'sonner'
import { api } from '../../services/api'
import { Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react'

export function TrialExtensionRequestsPanel() {
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)

  const fetchRequests = async () => {
    setLoading(true)
    try {
      const res = await api.get<any[]>('/admin/trial-extension-requests')
      setRequests(res || [])
    } catch { setRequests([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchRequests() }, [])

  const handleApprove = async (id: string, days: number) => {
    setProcessing(id)
    try {
      await api.patch(`/admin/trial-extension-requests/${id}`, { status: 'APPROVED', extensionDays: days })
      toast.success(`Trial extendido ${days} días`)
      fetchRequests()
    } catch (e: any) {
      toast.error(e?.message || 'Error al aprobar')
    } finally { setProcessing(null) }
  }

  const handleReject = async (id: string) => {
    setProcessing(id)
    try {
      await api.patch(`/admin/trial-extension-requests/${id}`, { status: 'REJECTED' })
      toast.success('Solicitud rechazada')
      fetchRequests()
    } catch (e: any) {
      toast.error(e?.message || 'Error al rechazar')
    } finally { setProcessing(null) }
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
          <Clock className="size-4 text-primary" /> Solicitudes de Extensión de Trial
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
        ) : requests.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">No hay solicitudes de extensión pendientes</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-2 font-bold uppercase tracking-wider">Empresa</th>
                  <th className="text-left py-2 font-bold uppercase tracking-wider">Email</th>
                  <th className="text-left py-2 font-bold uppercase tracking-wider">Motivo</th>
                  <th className="text-left py-2 font-bold uppercase tracking-wider">Fecha</th>
                  <th className="text-center py-2 font-bold uppercase tracking-wider">Estado</th>
                  <th className="text-right py-2 font-bold uppercase tracking-wider">Acción</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r: any) => (
                  <tr key={r.id} className="border-b border-border/20">
                    <td className="py-2 font-medium">{r.tenantName}</td>
                    <td className="py-2 text-muted-foreground">{r.tenantEmail}</td>
                    <td className="py-2 max-w-[200px] truncate" title={r.reason}>{r.reason}</td>
                    <td className="py-2 text-muted-foreground">{new Date(r.createdAt).toLocaleDateString('es-NI')}</td>
                    <td className="py-2 text-center">
                      {r.status === 'PENDING' ? (
                        <Badge variant="outline" className="text-amber-500 border-amber-500/30">Pendiente</Badge>
                      ) : r.status === 'APPROVED' ? (
                        <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Aprobado</Badge>
                      ) : (
                        <Badge variant="destructive">Rechazado</Badge>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      {r.status === 'PENDING' ? (
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="outline" size="sm" className="h-7 text-[10px]"
                            onClick={() => handleApprove(r.id, 7)}
                            disabled={processing === r.id}>
                            {processing === r.id ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3 mr-1" />}
                            +7 días
                          </Button>
                          <Button variant="outline" size="sm" className="h-7 text-[10px] text-rose-500 border-rose-500/30 hover:bg-rose-500/10"
                            onClick={() => handleReject(r.id)}
                            disabled={processing === r.id}>
                            <XCircle className="size-3 mr-1" /> Rechazar
                          </Button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">
                          {r.approvedAt ? new Date(r.approvedAt).toLocaleDateString('es-NI') : ''}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

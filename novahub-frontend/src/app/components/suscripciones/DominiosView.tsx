import { motion } from 'motion/react'
import { Globe, Rocket, Copy, ArrowRight, CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card'
import { Button } from '../ui/button'
import { Label } from '../ui/label'
import { cn } from '../ui/utils'
import { toast } from 'sonner'
import { useAuth } from '../../contexts/AuthContext'

export function DominiosView() {
  const { user } = useAuth()

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="border-border/50 shadow-sm mb-6">
        <CardHeader className="border-b border-border/30 bg-muted/10">
          <CardTitle className="flex items-center gap-2 font-black"><Globe className="size-5 text-primary" />Dominios Personalizados</CardTitle>
          <CardDescription>Accede a Nova Hub con tu propio dominio corporativo</CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="p-5 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-primary/15 rounded-xl">
                <Rocket className="size-6 text-primary" />
              </div>
              <div>
                <p className="font-black text-base">Dominio Personalizado · Próximamente</p>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  Pronto podrás acceder al ERP con tu propia URL corporativa, por ejemplo: <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">erp.tuempresa.com</code>
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Subdominio Nova Hub (Activo)</Label>
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 px-4 py-3 rounded-xl bg-muted/20 border border-border/40">
                <Globe className="size-4 text-muted-foreground flex-shrink-0" />
                <span className="font-mono text-sm">{user?.tenantId || 'empresa-demo'}.novahub.io</span>
              </div>
              <Button variant="outline" className="rounded-xl h-11 gap-2" onClick={() => { navigator.clipboard?.writeText(`${user?.tenantId || 'empresa-demo'}.novahub.io`); toast.success('Subdominio copiado') }}>
                <Copy className="size-4" />Copiar
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            {[
              { title: 'Subdominio Gratis', price: 'Incluido', desc: 'empresa.novahub.io', current: true, features: ['SSL automático', 'CDN global', 'Soporte técnico'] },
              { title: 'Dominio Propio', price: '$29/mes', desc: 'erp.tuempresa.com', current: false, features: ['Tu dominio corporativo', 'SSL personalizado', 'Redirección automática', 'DNS configurado'] },
              { title: 'White Label Total', price: 'Enterprise', desc: 'app.tuempresa.com', current: false, features: ['Sin mención a NovaHub', 'Branding completo', 'Email corporativo', 'Support dedicado'] },
            ].map(({ title, price, desc, current, features }) => (
              <div key={title} className={cn('relative p-5 rounded-2xl border transition-all',
                current ? 'border-primary/40 bg-primary/5 shadow-lg' : 'border-border/50 hover:border-primary/20')}>
                {current && <div className="absolute -top-2 left-4 px-3 py-0.5 bg-primary text-primary-foreground text-[10px] font-black rounded-full uppercase tracking-widest">Activo</div>}
                <div className="mt-2">
                  <p className="font-black text-base">{title}</p>
                  <p className="text-2xl font-black text-primary mt-1">{price}</p>
                  <p className="text-xs font-mono text-muted-foreground mt-1">{desc}</p>
                </div>
                <div className="space-y-2 mt-4">
                  {features.map(f => (
                    <div key={f} className="flex items-center gap-2 text-xs">
                      <CheckCircle2 className="size-3.5 text-primary flex-shrink-0" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
                <Button className="w-full mt-4 rounded-xl font-bold" variant={current ? 'outline' : 'default'} disabled={!current && price !== '$29/mes'}
                  onClick={() => current ? toast.info('Ya estás usando este plan') : toast.info('Próximamente disponible')}>
                  {current ? 'Plan Actual' : price === 'Enterprise' ? <><Rocket className="size-3.5 mr-1" />Contactar</> : <><ArrowRight className="size-3.5 mr-1" />Activar</>}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

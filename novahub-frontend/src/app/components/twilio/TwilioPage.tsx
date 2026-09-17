import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, BarChart3, Building2, Send, Settings,
  Users, MessageCircle, Smartphone, Globe, Shield,
  ArrowUpRight, Activity, Zap, Check, Clock, Plus, Smartphone as PhoneIcon
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Badge } from '../ui/badge';
import { motion } from 'motion/react';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { cn } from '../ui/utils';

interface TwilioPageProps {
  activeSubModule?: string;
  onSubModuleChange?: (subModule?: string) => void;
}

export default function TwilioPage({ activeSubModule, onSubModuleChange }: TwilioPageProps) {
  const { user, hasAccess } = useAuth();
  
  const subModuleToTab: Record<string, string> = {
    'twilio-dashboard': 'dashboard',
    'twilio-accounts': 'accounts',
    'twilio-messages': 'messages',
    'twilio-config': 'settings'
  };

  const tabs = [
    { id: 'dashboard', label: 'Vista General', icon: BarChart3, module: 'TWILIO_DASHBOARD' },
    { id: 'accounts', label: 'Cuentas Conectadas', icon: Smartphone, module: 'TWILIO_ACCOUNTS' },
    { id: 'messages', label: 'Bandeja Unificada', icon: Send, module: 'TWILIO_MESSAGES' },
    { id: 'settings', label: 'Configuración API', icon: Settings, module: 'TWILIO_CONFIG' }
  ];

  const [activeTab, setActiveTab] = useState(() => {
    if (activeSubModule && subModuleToTab[activeSubModule]) {
      return subModuleToTab[activeSubModule];
    }
    return tabs.find(t => hasAccess(t.module))?.id || 'dashboard';
  });

  useEffect(() => {
    if (activeSubModule && subModuleToTab[activeSubModule]) {
      if (activeTab !== subModuleToTab[activeSubModule]) {
        setActiveTab(subModuleToTab[activeSubModule]);
      }
    }
  }, [activeSubModule, activeTab]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    const subModule = Object.keys(subModuleToTab).find(key => subModuleToTab[key] === value) || value;
    if (onSubModuleChange) {
      onSubModuleChange(subModule);
    }
  };

  const tabTriggerClass = "flex items-center gap-2 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:text-primary-foreground data-[state=active]:shadow-xl data-[state=active]:shadow-primary/20 transition-all hover:bg-muted/50";

  return (
    <div className="space-y-8 p-6 pb-24 max-w-[1800px] mx-auto animate-in fade-in duration-500">
      
      {/* ─── HEADER PREMIUM ──────────────────────── */}
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between border-b border-border/40 pb-8">
        <div className="flex items-center gap-5">
          <div className="p-4 bg-gradient-to-br from-primary to-primary/80 rounded-3xl shadow-2xl shadow-primary/30 rotate-3 hover:rotate-0 transition-transform duration-300">
            <MessageSquare className="size-10 text-primary-foreground" />
          </div>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-4xl sm:text-6xl font-black tracking-tighter uppercase italic leading-none">
                WhatsApp <span className="text-primary drop-shadow-sm">Twilio</span>
              </h1>
              <Badge className="bg-primary/10 text-primary border-primary/20 px-3 py-1 text-[10px] font-black uppercase tracking-widest">v2.0 Beta</Badge>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                <Globe className="size-3 text-primary" /> Gateway Global
              </span>
              <span className="text-muted-foreground/30">•</span>
              <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                <Shield className="size-3 text-primary" /> API Segura
              </span>
              <span className="text-muted-foreground/30">•</span>
              <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-tighter bg-muted/30">
                {activeTab === 'dashboard' ? 'Panel de Control' : activeTab === 'accounts' ? 'Gestión de Cuentas' : activeTab === 'messages' ? 'Centro de Mensajería' : 'Configuración API'}
              </Badge>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
           <Button variant="outline" className="border-border/60 hover:bg-muted rounded-2xl h-14 px-6 font-black uppercase tracking-widest text-[10px] gap-2 shadow-sm transition-all active:scale-95">
             <Clock className="size-4" /> Historial API
           </Button>
           <Button className="bg-gradient-to-br from-primary to-primary/80 hover:from-primary/90 hover:to-primary text-primary-foreground font-black uppercase tracking-widest text-[10px] px-8 h-14 rounded-2xl shadow-xl shadow-primary/20 transition-all hover:scale-[1.03] active:scale-95 gap-2 group">
             <Plus className="size-4 group-hover:rotate-90 transition-transform" /> Conectar Número
           </Button>
        </div>
      </div>

      {/* ─── NAVEGACIÓN TABS ───────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="w-full h-auto bg-muted/30 backdrop-blur-md p-2 flex overflow-x-auto justify-start pb-2 flex-nowrap gap-2 rounded-3xl border border-border/40 mb-8 custom-scrollbar">
          {tabs.map((tab) => {
            if (!hasAccess(tab.module)) return null;
            return (
              <TabsTrigger key={tab.id} value={tab.id} className={tabTriggerClass}>
                <tab.icon className="size-4" />
                <span>{tab.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="min-h-[700px]"
        >
          <TabsContent value="dashboard" className="m-0 space-y-8">
             <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
                <KPIStat title="Mensajes Hoy" value="1,284" sub="+12% vs ayer" color="primary" icon={<MessageCircle />} />
                <KPIStat title="Cuentas Activas" value="3" sub="Todas operativas" color="blue" icon={<Smartphone />} />
                <KPIStat title="Tasa de Respuesta" value="98.2%" sub="+2.1% este mes" color="primary" icon={<Activity />} />
                <KPIStat title="Alertas" value="0" sub="Sin incidencias" color="orange" icon={<Zap />} />
             </div>
             
             <div className="grid gap-6 lg:grid-cols-3">
                <Card className="lg:col-span-2 border-border/40 bg-card/50 backdrop-blur-sm rounded-[2.5rem] overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  <CardHeader className="p-8 pb-4">
                    <CardTitle className="text-xl font-black uppercase tracking-tight italic flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-xl text-primary"><Activity className="size-5" /></div>
                      Actividad de Mensajería
                    </CardTitle>
                    <CardDescription className="font-bold text-[10px] uppercase tracking-widest ml-12">Tráfico de entrada y salida en las últimas 24 horas</CardDescription>
                  </CardHeader>
                  <CardContent className="p-8 pt-0">
                     <div className="h-80 flex flex-col items-center justify-center border-2 border-dashed border-border/40 rounded-[2rem] bg-muted/5 group hover:bg-muted/10 transition-colors">
                        <BarChart3 className="size-16 text-muted-foreground/20 group-hover:scale-110 transition-transform" />
                        <p className="mt-4 text-xs font-black uppercase tracking-widest text-muted-foreground/60 italic">[ Visualización de tráfico en desarrollo ]</p>
                     </div>
                  </CardContent>
                </Card>

                <Card className="border-border/40 bg-card/50 backdrop-blur-sm rounded-[2.5rem] shadow-sm">
                  <CardHeader className="p-8 pb-4">
                    <CardTitle className="text-xl font-black uppercase tracking-tight italic flex items-center gap-3">
                      <div className="p-2 bg-orange-500/10 rounded-xl text-orange-500"><Zap className="size-5" /></div>
                      Estado Global
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-8 pt-4 space-y-6">
                    <StatusItem label="WhatsApp API" status="Operativo" color="primary" />
                    <StatusItem label="Webhooks NovaHub" status="Sincronizado" color="blue" />
                    <StatusItem label="Twilio Gateway" status="Conectado" color="primary" />
                    <StatusItem label="IA Responder" status="Standby" color="orange" />
                    
                    <div className="mt-10 p-6 rounded-3xl bg-primary/5 border border-primary/10 relative overflow-hidden group">
                      <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-125 transition-transform"><Smartphone className="size-32" /></div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-2">Sugerencia</p>
                      <p className="text-sm font-bold text-foreground leading-relaxed">Tienes 2 números pendientes de validación en la consola de Twilio.</p>
                      <Button variant="link" className="p-0 h-auto text-[10px] font-black uppercase tracking-widest mt-4 text-primary gap-1">Gestionar Ahora <ArrowUpRight className="size-3" /></Button>
                    </div>
                  </CardContent>
                </Card>
             </div>

             <Card className="border-border/40 bg-card/50 backdrop-blur-sm rounded-[2.5rem] shadow-sm">
               <CardHeader className="p-8 pb-2">
                  <CardTitle className="text-xl font-black uppercase tracking-tight italic">Mensajes Recientes</CardTitle>
                  <CardDescription className="font-bold text-[10px] uppercase tracking-widest">Últimas interacciones recibidas a través de todos los números.</CardDescription>
               </CardHeader>
               <CardContent className="p-8 pt-4">
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center justify-between p-5 rounded-[1.5rem] bg-muted/20 border border-border/30 hover:border-primary/40 hover:bg-muted/40 transition-all cursor-pointer group">
                        <div className="flex items-center gap-4">
                          <div className="size-12 rounded-2xl bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center group-hover:from-primary/20 group-hover:to-primary/10 transition-colors">
                            <Users className="size-6 text-muted-foreground group-hover:text-primary transition-colors" />
                          </div>
                          <div>
                            <p className="font-black italic uppercase tracking-tighter text-base">Cliente #{Math.floor(Math.random() * 1000)}</p>
                            <p className="text-sm font-medium text-muted-foreground">Hola, necesito ayuda con mi pedido de...</p>
                          </div>
                        </div>
                        <div className="text-right flex flex-col items-end gap-1">
                          <Badge className="bg-primary/10 text-primary border-primary/20 text-[9px] font-black uppercase tracking-widest">Activo</Badge>
                          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Hace {i * 2} min</p>
                        </div>
                      </div>
                    ))}
                    <Button variant="ghost" className="w-full py-8 text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-primary rounded-3xl transition-colors">
                      Ver todos los mensajes
                    </Button>
                  </div>
               </CardContent>
             </Card>
          </TabsContent>

          <TabsContent value="accounts" className="m-0 space-y-6">
             <div className="grid gap-6 md:grid-cols-2">
                <AccountCardPremium 
                  name="Ventas Norte" 
                  number="+505 8888 8888" 
                  status="Conectado" 
                  plan="Unlimited" 
                  usage="85%"
                />
                <AccountCardPremium 
                  name="Soporte Técnico" 
                  number="+505 7777 7777" 
                  status="Conectado" 
                  plan="Enterprise" 
                  usage="12%"
                />
             </div>
          </TabsContent>

          <TabsContent value="messages" className="m-0">
             <Card className="border-border/40 bg-card/50 backdrop-blur-sm rounded-[3rem] h-[700px] flex items-center justify-center overflow-hidden border-2 border-dashed">
                <div className="text-center space-y-6 max-w-sm px-6">
                   <div className="p-10 bg-gradient-to-br from-primary/20 to-primary/5 rounded-full inline-block animate-pulse">
                      <Send className="size-16 text-primary" />
                   </div>
                   <div>
                     <h3 className="text-3xl font-black uppercase italic tracking-tighter mb-2">Bandeja Unificada</h3>
                     <p className="text-muted-foreground font-medium leading-relaxed">
                        Gestiona conversaciones de todos tus números desde una sola vista centralizada con soporte multi-agente.
                     </p>
                   </div>
                   <Button variant="outline" className="rounded-2xl font-black uppercase tracking-widest text-[10px] px-10 h-14 border-2 border-primary/20 text-primary hover:bg-primary/5">
                      Abrir Consola de Chat
                   </Button>
                </div>
             </Card>
          </TabsContent>

          <TabsContent value="settings" className="m-0">
             <Card className="border-border/40 bg-card/50 backdrop-blur-sm rounded-[3rem] p-10 overflow-hidden relative shadow-sm">
                <div className="absolute top-0 right-0 p-12 opacity-5 -mr-10 -mt-10"><Settings className="size-64" /></div>
                
                <div className="max-w-3xl space-y-10 relative z-10">
                   <div className="flex items-center gap-6 pb-8 border-b border-border/40">
                      <div className="p-4 bg-primary/10 rounded-2xl text-primary"><Shield className="size-10" /></div>
                      <div>
                         <h3 className="text-3xl font-black uppercase tracking-tighter italic">Seguridad y Credenciales</h3>
                         <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mt-1">Configura la conexión maestra con Twilio</p>
                      </div>
                   </div>
                   
                   <div className="grid gap-8">
                      <div className="space-y-3">
                         <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                           Twilio Account SID <Badge variant="outline" className="text-[8px] px-1.5 font-bold uppercase">Maestro</Badge>
                         </label>
                         <input type="password" value="ACxxxxxxxxxxxxxxxxxxxxxxxx" className="w-full bg-muted/50 border-2 border-border/40 rounded-2xl px-6 py-4 font-mono text-sm focus:border-primary/50 outline-none transition-all shadow-inner text-foreground" readOnly />
                      </div>
                      
                      <div className="space-y-3">
                         <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                           Auth Token <Badge variant="outline" className="text-[8px] px-1.5 font-bold uppercase">Encriptado</Badge>
                         </label>
                         <div className="relative">
                            <input type="password" value="••••••••••••••••••••••••••••" className="w-full bg-muted/50 border-2 border-border/40 rounded-2xl px-6 py-4 font-mono text-sm focus:border-primary/50 outline-none transition-all shadow-inner text-foreground" readOnly />
                            <Button variant="ghost" size="sm" className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-black uppercase tracking-widest text-primary">Revelar</Button>
                         </div>
                      </div>

                      <div className="pt-6 border-t border-border/40 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-primary font-bold">
                          <Check className="size-5" />
                          <span className="text-[10px] font-black uppercase tracking-widest">Conexión Verificada</span>
                        </div>
                        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl font-black uppercase tracking-widest text-[10px] px-12 h-14 shadow-xl shadow-primary/20">Guardar Cambios</Button>
                      </div>
                   </div>
                </div>
             </Card>
          </TabsContent>
        </motion.div>
      </Tabs>
    </div>
  );
}

function KPIStat({ title, value, sub, color, icon }: { title: string, value: string, sub: string, color: string, icon: React.ReactElement }) {
  const colorMap: Record<string, string> = {
    primary: 'border-primary/20 from-primary/5 text-primary',
    blue: 'border-blue-500/20 from-blue-500/5 text-blue-500',
    purple: 'border-purple-500/20 from-purple-500/5 text-purple-500',
    orange: 'border-orange-500/20 from-orange-500/5 text-orange-500'
  };

  const currentStyles = colorMap[color] || colorMap.primary;

  return (
    <Card className={cn("border bg-gradient-to-br to-transparent relative overflow-hidden group hover:shadow-xl transition-all rounded-[2rem] p-6", currentStyles)}>
      <div className="absolute top-2 right-2 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-125 duration-500">
        {React.cloneElement(icon, { className: 'size-20' })}
      </div>
      <CardHeader className="p-0 pb-1">
        <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
          <ArrowUpRight className={cn("size-3.5", color === 'primary' ? 'text-primary' : 'text-foreground/50')} /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <p className="text-3xl font-black italic tracking-tighter mt-1">{value}</p>
        <p className="text-[10px] font-bold text-muted-foreground mt-0.5 uppercase tracking-widest">{sub}</p>
      </CardContent>
    </Card>
  );
}

function StatusItem({ label, status, color }: { label: string, status: string, color: string }) {
  const colorMap: Record<string, string> = {
    primary: 'bg-primary/10 text-primary border-primary/20',
    blue: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    orange: 'bg-orange-500/10 text-orange-500 border-orange-500/20'
  };

  return (
    <div className="flex items-center justify-between p-1">
      <div className="flex items-center gap-3">
        <div className={cn("size-2.5 rounded-full animate-pulse", color === 'primary' ? 'bg-primary' : color === 'blue' ? 'bg-blue-500' : 'bg-orange-500')} />
        <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">{label}</span>
      </div>
      <Badge className={cn("text-[9px] font-black uppercase tracking-widest px-3 py-1", colorMap[color])}>
        {status}
      </Badge>
    </div>
  );
}

function AccountCardPremium({ name, number, status, plan, usage }: { name: string, number: string, status: string, plan: string, usage: string }) {
  return (
    <Card className="border-border/40 bg-card/50 backdrop-blur-sm hover:border-primary/40 transition-all rounded-[2rem] group overflow-hidden shadow-sm">
      <CardContent className="p-8">
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-center gap-5">
            <div className="size-16 bg-gradient-to-br from-primary to-primary/60 rounded-3xl flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20 transform group-hover:rotate-6 transition-transform">
               <PhoneIcon className="size-8" />
            </div>
            <div>
              <h4 className="font-black uppercase tracking-tighter italic text-2xl mb-1">{name}</h4>
              <p className="text-xs font-bold text-muted-foreground tracking-widest">{number}</p>
            </div>
          </div>
          <div className="text-right">
            <Badge className="bg-primary/10 text-primary border-primary/20 uppercase text-[10px] font-black px-4 py-1.5 rounded-xl">{status}</Badge>
            <p className="text-[10px] font-black text-muted-foreground mt-3 uppercase tracking-widest">Plan {plan}</p>
          </div>
        </div>
        
        <div className="space-y-3">
          <div className="flex justify-between items-end">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Uso de Mensajes</span>
            <span className="text-xs font-black text-primary">{usage}</span>
          </div>
          <div className="w-full bg-muted h-3 rounded-full overflow-hidden border border-border/40 p-0.5">
            <div className="h-full bg-gradient-to-r from-primary to-primary/40 rounded-full transition-all duration-1000" style={{ width: usage }} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-8">
           <Button variant="outline" className="rounded-xl font-black uppercase tracking-widest text-[9px] h-11 border-border/60">Configurar</Button>
           <Button variant="outline" className="rounded-xl font-black uppercase tracking-widest text-[9px] h-11 border-border/60 hover:text-rose-500 hover:border-rose-500/30">Desconectar</Button>
        </div>
      </CardContent>
    </Card>
  );
}

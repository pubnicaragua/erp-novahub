import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { Separator } from '../ui/separator';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { cn } from '../ui/utils';
import {
  Settings2, Save, RefreshCw, Shield, DollarSign, Building2, 
  Calculator, Info, CheckCircle2, Percent, Scale
} from 'lucide-react';
import { hrService } from '../../services/hr.service';
import { useAuth } from '../../contexts/AuthContext';

interface PayrollConfigData {
  id?: string;
  name: string;
  inssLaboralPct: number;
  irEnabled: boolean;
  irTramo1Limite: number; irTramo1Pct: number;
  irTramo2Limite: number; irTramo2Base: number; irTramo2Pct: number;
  irTramo3Limite: number; irTramo3Base: number; irTramo3Pct: number;
  irTramo4Limite: number; irTramo4Base: number; irTramo4Pct: number;
  irTramo5Base: number; irTramo5Pct: number;
  inssPatronalPct: number;
  inatecPct: number;
  trecenoMesPct: number;
  vacacionesPct: number;
  indemnizacionPct: number;
  isActive: boolean;
}

const DEFAULT_CONFIG: PayrollConfigData = {
  name: 'Configuración Default',
  inssLaboralPct: 7.0,
  irEnabled: true,
  irTramo1Limite: 100000, irTramo1Pct: 0,
  irTramo2Limite: 200000, irTramo2Base: 0, irTramo2Pct: 15,
  irTramo3Limite: 350000, irTramo3Base: 15000, irTramo3Pct: 20,
  irTramo4Limite: 500000, irTramo4Base: 45000, irTramo4Pct: 25,
  irTramo5Base: 82500, irTramo5Pct: 30,
  inssPatronalPct: 22.5,
  inatecPct: 2.0,
  trecenoMesPct: 8.33,
  vacacionesPct: 8.33,
  indemnizacionPct: 8.33,
  isActive: true,
};

export function ConfigNominaView() {
  const { canPerform } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<PayrollConfigData>(DEFAULT_CONFIG);
  const [hasExisting, setHasExisting] = useState(false);

  // Simulation calculator state
  const [simSalaryBruto, setSimSalaryBruto] = useState<number>(13000);

  useEffect(() => { fetchConfig(); }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const res = await hrService.getActivePayrollConfig() as any;
      if (res && res.id) {
        setConfig({
          id: res.id,
          name: res.name || 'Configuración Default',
          inssLaboralPct: Number(res.inssLaboralPct),
          irEnabled: res.irEnabled ?? true,
          irTramo1Limite: Number(res.irTramo1Limite), irTramo1Pct: Number(res.irTramo1Pct),
          irTramo2Limite: Number(res.irTramo2Limite), irTramo2Base: Number(res.irTramo2Base), irTramo2Pct: Number(res.irTramo2Pct),
          irTramo3Limite: Number(res.irTramo3Limite), irTramo3Base: Number(res.irTramo3Base), irTramo3Pct: Number(res.irTramo3Pct),
          irTramo4Limite: Number(res.irTramo4Limite), irTramo4Base: Number(res.irTramo4Base), irTramo4Pct: Number(res.irTramo4Pct),
          irTramo5Base: Number(res.irTramo5Base), irTramo5Pct: Number(res.irTramo5Pct),
          inssPatronalPct: Number(res.inssPatronalPct),
          inatecPct: Number(res.inatecPct),
          trecenoMesPct: Number(res.trecenoMesPct),
          vacacionesPct: Number(res.vacacionesPct),
          indemnizacionPct: Number(res.indemnizacionPct),
          isActive: res.isActive ?? true,
        });
        setHasExisting(true);
      }
    } catch (error) {
      console.error('Error fetching payroll config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      if (config.id) {
        const { id, ...updateData } = config;
        await hrService.updatePayrollConfig(id, updateData);
      } else {
        const res = await hrService.createPayrollConfig(config) as any;
        if (res?.id) setConfig(prev => ({ ...prev, id: res.id }));
        setHasExisting(true);
      }
      toast.success('Configuración de nómina guardada exitosamente');
    } catch (error) {
      console.error('Error saving payroll config:', error);
      toast.error('Error al guardar configuración');
    } finally {
      setSaving(false);
    }
  };

  // IR Calculation simulation
  const calculateSimulation = () => {
    const bruto = simSalaryBruto;
    const inssLaboral = bruto * (config.inssLaboralPct / 100);
    const rentaNetaMensual = bruto - inssLaboral;
    const rentaNetaAnual = rentaNetaMensual * 12;

    let irAnual = 0;
    if (config.irEnabled) {
      const tramos = [
        { limite: config.irTramo1Limite, base: 0, pct: config.irTramo1Pct },
        { limite: config.irTramo2Limite, base: config.irTramo2Base, pct: config.irTramo2Pct },
        { limite: config.irTramo3Limite, base: config.irTramo3Base, pct: config.irTramo3Pct },
        { limite: config.irTramo4Limite, base: config.irTramo4Base, pct: config.irTramo4Pct },
      ];

      let found = false;
      for (let i = 0; i < tramos.length; i++) {
        if (rentaNetaAnual <= tramos[i].limite) {
          const prevLimite = i > 0 ? tramos[i - 1].limite : 0;
          const excedente = rentaNetaAnual - prevLimite;
          irAnual = tramos[i].base + (excedente * tramos[i].pct / 100);
          found = true;
          break;
        }
      }
      if (!found) {
        const excedente = rentaNetaAnual - config.irTramo4Limite;
        irAnual = config.irTramo5Base + (excedente * config.irTramo5Pct / 100);
      }
    }

    const irMensual = irAnual / 12;
    const netoPagar = bruto - inssLaboral - irMensual;

    // Patronal
    const inssPatronal = bruto * (config.inssPatronalPct / 100);
    const inatec = bruto * (config.inatecPct / 100);
    const trecenoMes = bruto * (config.trecenoMesPct / 100);
    const vacaciones = bruto * (config.vacacionesPct / 100);
    const indemnizacion = bruto * (config.indemnizacionPct / 100);
    const costoTotal = bruto + inssPatronal + inatec + trecenoMes + vacaciones + indemnizacion;

    return { bruto, inssLaboral, irMensual, netoPagar, inssPatronal, inatec, trecenoMes, vacaciones, indemnizacion, costoTotal };
  };

  const sim = calculateSimulation();

  const formatC = (v: number) => `C$ ${v.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/50 to-primary/30 blur-xl rounded-full" />
            <div className="relative size-16 border-4 border-muted border-t-primary rounded-full animate-spin" />
          </div>
          <p className="text-sm font-bold text-muted-foreground tracking-wide">Cargando configuración...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <Settings2 className="size-6 text-primary" />
            Configuración de Nómina
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Define los porcentajes de deducciones, aportes patronales y provisiones
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={cn(
            "px-3 py-1 text-[10px] font-black uppercase tracking-widest",
            hasExisting ? "bg-primary/10 text-primary border-primary/20" : "bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400"
          )}>
            {hasExisting ? '✓ Configuración Activa' : 'Sin configuración'}
          </Badge>
          {canPerform('HR_PAYROLLS', 'edit') && (
            <Button onClick={handleSave} disabled={saving} className="gap-2 rounded-xl font-bold">
              {saving ? <RefreshCw className="size-4 animate-spin" /> : <Save className="size-4" />}
              {saving ? 'Guardando...' : 'Guardar Configuración'}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Column: Config Forms */}
        <div className="xl:col-span-2 space-y-6">

          {/* Deducciones del Empleado */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border-border/40 shadow-sm">
              <CardHeader className="border-b border-border/30 bg-muted/10">
                <CardTitle className="flex items-center gap-2 text-lg font-black">
                  <DollarSign className="size-5 text-primary" />
                  Deducciones del Empleado
                </CardTitle>
                <CardDescription>Montos que se deducen del salario bruto del trabajador</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">INSS Laboral (%)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number" step="0.01"
                        value={config.inssLaboralPct}
                        onChange={e => setConfig({ ...config, inssLaboralPct: Number(e.target.value) })}
                        className="rounded-xl h-11"
                      />
                      <Percent className="size-4 text-muted-foreground" />
                    </div>
                    <p className="text-[10px] text-muted-foreground">Valor oficial: 7%</p>
                  </div>
                </div>

                <Separator />

                {/* IR Toggle */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-muted/20 border border-border/30">
                  <div>
                    <p className="text-sm font-bold">Impuesto sobre la Renta (IR)</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Art. 23 Ley 822 - Ley de Concertación Tributaria</p>
                  </div>
                  <Switch checked={config.irEnabled} onCheckedChange={v => setConfig({ ...config, irEnabled: v })} />
                </div>

                {/* IR Table */}
                {config.irEnabled && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-3">
                    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                      <Scale className="size-4" /> Tabla Progresiva del IR (Rentas del Trabajo)
                    </p>
                    <div className="rounded-xl border border-border/40 overflow-x-auto">
                      <table className="w-full text-sm min-w-[550px]">
                        <thead>
                          <tr className="bg-muted/30 border-b border-border/40">
                            <th className="text-left p-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Renta Neta Anual (C$)</th>
                            <th className="text-center p-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Impuesto Base (C$)</th>
                            <th className="text-center p-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">% s/Excedente</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { label: `0.01 – ${config.irTramo1Limite.toLocaleString()}`, base: '0', pctKey: 'irTramo1Pct', baseKey: null, limiteKey: 'irTramo1Limite', exento: true },
                            { label: `${config.irTramo1Limite.toLocaleString()} – ${config.irTramo2Limite.toLocaleString()}`, base: config.irTramo2Base, pctKey: 'irTramo2Pct', baseKey: 'irTramo2Base', limiteKey: 'irTramo2Limite' },
                            { label: `${config.irTramo2Limite.toLocaleString()} – ${config.irTramo3Limite.toLocaleString()}`, base: config.irTramo3Base, pctKey: 'irTramo3Pct', baseKey: 'irTramo3Base', limiteKey: 'irTramo3Limite' },
                            { label: `${config.irTramo3Limite.toLocaleString()} – ${config.irTramo4Limite.toLocaleString()}`, base: config.irTramo4Base, pctKey: 'irTramo4Pct', baseKey: 'irTramo4Base', limiteKey: 'irTramo4Limite' },
                            { label: `${config.irTramo4Limite.toLocaleString()}+`, base: config.irTramo5Base, pctKey: 'irTramo5Pct', baseKey: 'irTramo5Base', limiteKey: null },
                          ].map((row, i) => (
                            <tr key={i} className="border-b border-border/20 last:border-0 hover:bg-muted/10 transition-colors">
                              <td className="p-3 font-medium text-xs">{row.label}</td>
                              <td className="p-3 text-center">
                                {row.baseKey ? (
                                  <Input type="number" className="w-28 h-8 text-xs text-center mx-auto rounded-lg"
                                    value={(config as any)[row.baseKey]}
                                    onChange={e => setConfig({ ...config, [row.baseKey!]: Number(e.target.value) })} />
                                ) : (
                                  <span className="text-xs font-medium text-muted-foreground">{row.exento ? '—' : String(row.base)}</span>
                                )}
                              </td>
                              <td className="p-3 text-center">
                                <Input type="number" className="w-20 h-8 text-xs text-center mx-auto rounded-lg"
                                  value={(config as any)[row.pctKey]} step="0.1"
                                  onChange={e => setConfig({ ...config, [row.pctKey]: Number(e.target.value) })} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Info className="size-3" /> Fuente: Art. 23 Ley 822, Dirección General de Ingresos (DGI) de Nicaragua
                    </p>
                  </motion.div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Aportes Patronales */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="border-border/40 shadow-sm">
              <CardHeader className="border-b border-border/30 bg-muted/10">
                <CardTitle className="flex items-center gap-2 text-lg font-black">
                  <Building2 className="size-5 text-primary" />
                  Aportes Patronales
                </CardTitle>
                <CardDescription>Costos adicionales que asume la empresa por cada empleado</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">INSS Patronal (%)</Label>
                    <div className="flex items-center gap-2">
                      <Input type="number" step="0.01" value={config.inssPatronalPct}
                        onChange={e => setConfig({ ...config, inssPatronalPct: Number(e.target.value) })}
                        className="rounded-xl h-11" />
                      <Percent className="size-4 text-muted-foreground" />
                    </div>
                    <p className="text-[10px] text-muted-foreground">Valor oficial: 22.5%</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">INATEC (%)</Label>
                    <div className="flex items-center gap-2">
                      <Input type="number" step="0.01" value={config.inatecPct}
                        onChange={e => setConfig({ ...config, inatecPct: Number(e.target.value) })}
                        className="rounded-xl h-11" />
                      <Percent className="size-4 text-muted-foreground" />
                    </div>
                    <p className="text-[10px] text-muted-foreground">Valor oficial: 2%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Provisiones Mensuales */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="border-border/40 shadow-sm">
              <CardHeader className="border-b border-border/30 bg-muted/10">
                <CardTitle className="flex items-center gap-2 text-lg font-black">
                  <Shield className="size-5 text-primary" />
                  Provisiones Mensuales
                </CardTitle>
                <CardDescription>Reservas mensuales que debe provisionar la empresa por ley</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Treceavo Mes (%)</Label>
                    <div className="flex items-center gap-2">
                      <Input type="number" step="0.01" value={config.trecenoMesPct}
                        onChange={e => setConfig({ ...config, trecenoMesPct: Number(e.target.value) })}
                        className="rounded-xl h-11" />
                      <Percent className="size-4 text-muted-foreground" />
                    </div>
                    <p className="text-[10px] text-muted-foreground">≈ 1/12 del salario (8.33%)</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Vacaciones (%)</Label>
                    <div className="flex items-center gap-2">
                      <Input type="number" step="0.01" value={config.vacacionesPct}
                        onChange={e => setConfig({ ...config, vacacionesPct: Number(e.target.value) })}
                        className="rounded-xl h-11" />
                      <Percent className="size-4 text-muted-foreground" />
                    </div>
                    <p className="text-[10px] text-muted-foreground">15 días / año (8.33%)</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Indemnización (%)</Label>
                    <div className="flex items-center gap-2">
                      <Input type="number" step="0.01" value={config.indemnizacionPct}
                        onChange={e => setConfig({ ...config, indemnizacionPct: Number(e.target.value) })}
                        className="rounded-xl h-11" />
                      <Percent className="size-4 text-muted-foreground" />
                    </div>
                    <p className="text-[10px] text-muted-foreground">1 mes / año (8.33%)</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Right Column: Simulation */}
        <div className="space-y-6">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <Card className="border-primary/20 shadow-sm bg-gradient-to-br from-primary/5 to-transparent">
              <CardHeader className="border-b border-primary/10 bg-primary/5">
                <CardTitle className="flex items-center gap-2 text-lg font-black">
                  <Calculator className="size-5 text-primary" />
                  Simulador de Nómina
                </CardTitle>
                <CardDescription>Calcula en tiempo real el impacto con los porcentajes actuales</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-5">
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Salario Bruto Mensual (C$)</Label>
                  <Input type="number" value={simSalaryBruto}
                    onChange={e => setSimSalaryBruto(Number(e.target.value))}
                    className="rounded-xl h-12 text-lg font-bold" placeholder="13,000" />
                </div>

                <Separator />

                {/* Deducciones Empleado */}
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-red-500">Deducciones del Empleado</p>
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">INSS Laboral ({config.inssLaboralPct}%)</span>
                      <span className="font-bold text-red-600">-{formatC(sim.inssLaboral)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">IR Mensual</span>
                      <span className="font-bold text-red-600">-{formatC(sim.irMensual)}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-black text-primary uppercase tracking-wide">Neto a Pagar</span>
                    <span className="text-xl font-black text-primary">{formatC(sim.netoPagar)}</span>
                  </div>
                </div>

                <Separator />

                {/* Costos Patronales */}
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-orange-600">Costos Adicionales (Patronal)</p>
                  <div className="space-y-1.5">
                    {[
                      { label: `INSS Patronal (${config.inssPatronalPct}%)`, value: sim.inssPatronal },
                      { label: `INATEC (${config.inatecPct}%)`, value: sim.inatec },
                      { label: `Treceavo Mes (${config.trecenoMesPct}%)`, value: sim.trecenoMes },
                      { label: `Vacaciones (${config.vacacionesPct}%)`, value: sim.vacaciones },
                      { label: `Indemnización (${config.indemnizacionPct}%)`, value: sim.indemnizacion },
                    ].map(item => (
                      <div key={item.label} className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">{item.label}</span>
                        <span className="font-medium text-orange-600">+{formatC(item.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-black text-orange-700 dark:text-orange-400 uppercase tracking-wide">Costo Total Empresa</span>
                    <span className="text-xl font-black text-orange-700 dark:text-orange-400">{formatC(sim.costoTotal)}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-muted/20 border border-border/30 text-center">
                  <p className="text-[10px] text-muted-foreground">
                    El costo real del empleado para la empresa es <span className="font-bold text-foreground">{((sim.costoTotal / sim.bruto - 1) * 100).toFixed(1)}%</span> más que el salario bruto pactado.
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}


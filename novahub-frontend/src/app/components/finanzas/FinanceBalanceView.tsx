import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Landmark, ArrowUpRight, ArrowDownRight, Scale, PieChart, Info } from 'lucide-react';
import { useCurrency } from '../../contexts/CurrencyContext';
import { accountsService } from '../../services/finanzas.service';
import { Badge } from '../ui/badge';

export function FinanceBalanceView() {
  const { displayCurrency, formatConvertedAmount, convertAmount } = useCurrency();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const res = await accountsService.getAll();
      setAccounts(Array.isArray(res) ? res : (res as any)?.data || []);
    } catch (error) {
      console.error('Error fetching accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const assets = accounts.filter(a => {
    const t = String(a.type || '').toUpperCase();
    return t === 'ASSET' || t === 'INCOME' || t === 'REVENUE';
  });
  const liabilities = accounts.filter(a => {
    const t = String(a.type || '').toUpperCase();
    return t === 'LIABILITY' || t === 'EXPENSE';
  });
  const equity = accounts.filter(a => String(a.type || '').toUpperCase() === 'EQUITY');

  const totalAssets = assets.reduce((acc, a) => acc + convertAmount(a.balance || 0, a.currency), 0);
  const totalLiabilities = liabilities.reduce((acc, a) => acc + convertAmount(a.balance || 0, a.currency), 0);
  const totalEquity = equity.reduce((acc, a) => acc + convertAmount(a.balance || 0, a.currency), 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Assets Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-emerald-500 mb-2">
            <ArrowUpRight className="size-5" />
            <h3 className="font-bold uppercase tracking-wider text-sm">Activos (Lo que tenemos)</h3>
          </div>
          {assets.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No hay activos registrados</p>
          ) : assets.map(acc => (
            <Card key={acc.id} className="border-l-4 border-l-emerald-500 bg-emerald-500/5">
              <CardContent className="p-4 flex justify-between items-center">
                <div>
                  <p className="text-xs font-bold text-muted-foreground">{acc.code}</p>
                  <p className="font-bold text-sm">{acc.name}</p>
                </div>
                <div className="text-right">
                  <p className="font-black text-emerald-500">{formatConvertedAmount(acc.balance, acc.currency)}</p>
                  <Badge variant="outline" className="text-[9px] border-emerald-500/20 text-emerald-500 uppercase">Líquido</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
          <div className="pt-2 border-t border-dashed border-emerald-500/30 flex justify-between items-center px-1">
            <span className="text-xs font-bold text-muted-foreground uppercase">Total Activos</span>
            <span className="text-lg font-black text-emerald-500">{formatConvertedAmount(totalAssets, displayCurrency)}</span>
          </div>
        </div>

        {/* Liabilities Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-rose-500 mb-2">
            <ArrowDownRight className="size-5" />
            <h3 className="font-bold uppercase tracking-wider text-sm">Pasivos (Lo que debemos)</h3>
          </div>
          {liabilities.length === 0 ? (
             <div className="p-8 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center bg-muted/10 opacity-60">
                <Info className="size-6 mb-2 text-muted-foreground" />
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Sin Deudas Pendientes</p>
             </div>
          ) : liabilities.map(acc => (
            <Card key={acc.id} className="border-l-4 border-l-rose-500 bg-rose-500/5">
              <CardContent className="p-4 flex justify-between items-center">
                <div>
                  <p className="text-xs font-bold text-muted-foreground">{acc.code}</p>
                  <p className="font-bold text-sm">{acc.name}</p>
                </div>
                <div className="text-right">
                  <p className="font-black text-rose-500">{formatConvertedAmount(acc.balance, acc.currency)}</p>
                </div>
              </CardContent>
            </Card>
          ))}
          <div className="pt-2 border-t border-dashed border-rose-500/30 flex justify-between items-center px-1">
            <span className="text-xs font-bold text-muted-foreground uppercase">Total Pasivos</span>
            <span className="text-lg font-black text-rose-500">{formatConvertedAmount(totalLiabilities, displayCurrency)}</span>
          </div>
        </div>

        {/* Equity Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-blue-500 mb-2">
            <Scale className="size-5" />
            <h3 className="font-bold uppercase tracking-wider text-sm">Patrimonio (Capital Neto)</h3>
          </div>
          <Card className="border-l-4 border-l-blue-500 bg-blue-500/5 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-2 opacity-10">
                <Scale className="size-16" />
             </div>
             <CardContent className="p-6">
                <p className="text-xs font-bold text-muted-foreground uppercase mb-1">Ecuación Contable</p>
                <p className="text-2xl font-black text-blue-500 mb-4">{formatConvertedAmount(totalAssets - totalLiabilities, displayCurrency)}</p>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Inversión Inicial:</span>
                    <span className="font-bold">{formatConvertedAmount(totalEquity, displayCurrency)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Reservas:</span>
                    <span className="font-bold">{formatConvertedAmount(0, displayCurrency)}</span>
                  </div>
                </div>
             </CardContent>
          </Card>
          
          <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5">
            <div className="flex items-center gap-2 mb-2">
               <PieChart className="size-4 text-blue-400" />
               <p className="text-[10px] font-black uppercase tracking-widest">Resumen de Salud</p>
            </div>
            <div className="w-full bg-muted h-2 rounded-full overflow-hidden flex">
               <div className="h-full bg-emerald-500" style={{ width: `${(totalAssets / (totalAssets + Math.abs(totalLiabilities))) * 100}%` }} />
               <div className="h-full bg-rose-500" style={{ width: `${(Math.abs(totalLiabilities) / (totalAssets + Math.abs(totalLiabilities))) * 100}%` }} />
            </div>
            <div className="flex justify-between mt-2 text-[9px] font-black uppercase tracking-tighter">
               <span className="text-emerald-500">Activos: {totalAssets > 0 ? ((totalAssets / (totalAssets + Math.abs(totalLiabilities))) * 100).toFixed(0) : 0}%</span>
               <span className="text-rose-500">Pasivos: {totalAssets > 0 ? ((Math.abs(totalLiabilities) / (totalAssets + Math.abs(totalLiabilities))) * 100).toFixed(0) : 0}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

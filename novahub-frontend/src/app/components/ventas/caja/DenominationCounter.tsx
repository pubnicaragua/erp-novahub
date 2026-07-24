import React from 'react';
import { Label } from '../../ui/label';
import { Input } from '../../ui/input';
import { Minus, Plus, ChevronDown, ChevronRight } from 'lucide-react';

export const NIO_BILLS = [1000, 500, 200, 100, 50, 20, 10];
export const NIO_COINS = [10, 5, 1, 0.50, 0.25];
export const USD_BILLS = [100, 50, 20, 10, 5, 2, 1];
export const USD_COINS = [0.50, 0.25, 0.10, 0.05, 0.01];

export interface DenominationState {
  value: number;
  quantity: number;
  type: 'bill' | 'coin';
}

interface DenominationCounterProps {
  nioDenominations: DenominationState[];
  setNioDenominations: React.Dispatch<React.SetStateAction<DenominationState[]>>;
  usdDenominations: DenominationState[];
  setUsdDenominations: React.Dispatch<React.SetStateAction<DenominationState[]>>;
  totalNIO: number;
  totalUSD: number;
  stackedLayout?: boolean;
}

export function DenominationCounter({
  nioDenominations,
  setNioDenominations,
  usdDenominations,
  setUsdDenominations,
  totalNIO,
  totalUSD,
  stackedLayout
}: DenominationCounterProps) {

  const [collapsedNio, setCollapsedNio] = React.useState(false);
  const [collapsedUsd, setCollapsedUsd] = React.useState(false);

  const renderGrid = (currency: 'NIO' | 'USD') => {
    const isNIO = currency === 'NIO';
    const state = isNIO ? nioDenominations : usdDenominations;
    const setState = isNIO ? setNioDenominations : setUsdDenominations;
    const prefix = isNIO ? 'C$' : '$';
    const total = isNIO ? totalNIO : totalUSD;

    const bills = state.filter(s => s.type === 'bill');
    const coins = state.filter(s => s.type === 'coin');

    const collapsed = isNIO ? collapsedNio : collapsedUsd;
    const setCollapsed = isNIO ? setCollapsedNio : setCollapsedUsd;

    return (
      <div className="flex flex-col border border-border/50 bg-muted/10 rounded-xl p-4 gap-4">
        <div 
          className="flex justify-between items-center border-b border-border/50 pb-2 cursor-pointer hover:bg-muted/50 transition-colors -mx-2 px-2 rounded-md"
          onClick={() => setCollapsed(!collapsed)}
        >
          <div className="flex items-center gap-2">
            {collapsed ? <ChevronRight className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
            <span className="font-bold text-sm tracking-widest">{isNIO ? 'CÓRDOBAS (NIO)' : 'DÓLARES (USD)'}</span>
          </div>
          <span className="font-mono text-sm font-bold text-muted-foreground">{prefix} {total.toFixed(2)}</span>
        </div>
        
        {!collapsed && (
          <div className="space-y-4">
            <div className="space-y-2">
            <div className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1">Billetes</div>
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-2">
              {bills.map(item => (
                  <div key={`bill-${item.value}`} className="flex items-center gap-2 bg-background/50 p-1.5 px-2 rounded-md border border-border/50 shadow-sm">
                  <Label className="text-xs font-mono font-medium text-muted-foreground w-12">{prefix}{item.value}</Label>
                  <div className="flex items-center flex-1 h-7 bg-background rounded-md border border-border/50 overflow-hidden">
                    <button 
                      type="button"
                      onClick={() => setState(prev => prev.map(p => (p.value === item.value && p.type === 'bill') ? { ...p, quantity: Math.max(0, p.quantity - 1) } : p))}
                      className="h-full px-1.5 flex items-center justify-center hover:bg-muted text-muted-foreground transition-colors border-r border-border/50"
                    >
                      <Minus className="size-3" />
                    </button>
                    <Input 
                      type="number" 
                      min="0" 
                      className="flex-1 h-full min-w-0 border-0 rounded-none text-xs text-center font-mono font-bold bg-transparent px-1 shadow-none focus-visible:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                      value={item.quantity || ''}
                      onChange={(e) => {
                        const qty = parseInt(e.target.value) || 0;
                        setState(prev => prev.map(p => (p.value === item.value && p.type === 'bill') ? { ...p, quantity: qty } : p));
                      }}
                    />
                    <button 
                      type="button"
                      onClick={() => setState(prev => prev.map(p => (p.value === item.value && p.type === 'bill') ? { ...p, quantity: p.quantity + 1 } : p))}
                      className="h-full px-1.5 flex items-center justify-center hover:bg-muted text-muted-foreground transition-colors border-l border-border/50"
                    >
                      <Plus className="size-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1">Monedas</div>
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-2">
              {coins.map(item => (
                <div key={`coin-${item.value}`} className="flex items-center gap-2 bg-background/50 p-1.5 px-2 rounded-md border border-border/50 shadow-sm">
                  <Label className="text-xs font-mono font-medium text-muted-foreground w-12">{prefix}{item.value}</Label>
                  <div className="flex items-center flex-1 h-7 bg-background rounded-md border border-border/50 overflow-hidden">
                    <button 
                      type="button"
                      onClick={() => setState(prev => prev.map(p => (p.value === item.value && p.type === 'coin') ? { ...p, quantity: Math.max(0, p.quantity - 1) } : p))}
                      className="h-full px-1.5 flex items-center justify-center hover:bg-muted text-muted-foreground transition-colors border-r border-border/50"
                    >
                      <Minus className="size-3" />
                    </button>
                    <Input 
                      type="number" 
                      min="0" 
                      className="flex-1 h-full min-w-0 border-0 rounded-none text-xs text-center font-mono font-bold bg-transparent px-1 shadow-none focus-visible:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                      value={item.quantity || ''}
                      onChange={(e) => {
                        const qty = parseInt(e.target.value) || 0;
                        setState(prev => prev.map(p => (p.value === item.value && p.type === 'coin') ? { ...p, quantity: qty } : p));
                      }}
                    />
                    <button 
                      type="button"
                      onClick={() => setState(prev => prev.map(p => (p.value === item.value && p.type === 'coin') ? { ...p, quantity: p.quantity + 1 } : p))}
                      className="h-full px-1.5 flex items-center justify-center hover:bg-muted text-muted-foreground transition-colors border-l border-border/50"
                    >
                      <Plus className="size-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={stackedLayout ? "flex flex-col gap-4" : "grid grid-cols-1 md:grid-cols-2 gap-4"}>
      {renderGrid('NIO')}
      {renderGrid('USD')}
    </div>
  );
}

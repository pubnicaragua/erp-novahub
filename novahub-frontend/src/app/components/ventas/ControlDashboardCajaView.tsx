import React, { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { Vault, BarChart3 } from 'lucide-react';
import { ControlCajaView } from './ControlCajaView';
import { DashboardCajaView } from './DashboardCajaView';

// Unified view for Cash Register Control and Dashboard
export function ControlDashboardCajaView() {
  const [activeTab, setActiveTab] = useState('control');

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full justify-start p-1 bg-muted/50 rounded-xl overflow-x-auto flex-nowrap h-auto mb-4 border border-border/50">
          <TabsTrigger 
            value="control" 
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary"
          >
            <Vault className="size-4" /> Control de Caja
          </TabsTrigger>
          <TabsTrigger 
            value="dashboard" 
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-primary"
          >
            <BarChart3 className="size-4" /> Dashboard
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="control" className="m-0 focus-visible:outline-none">
          <ControlCajaView />
        </TabsContent>
        
        <TabsContent value="dashboard" className="m-0 focus-visible:outline-none">
          <DashboardCajaView onNavigateToFacturacion={() => {}} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

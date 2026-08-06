import { AsesoriaLegalView } from './support/AsesoriaLegalView';

interface AsesoriaLegalPageProps {
  activeSubModule?: string;
  isSidebarCollapsed?: boolean;
  onSubModuleChange?: (module: string) => void;
}

export function AsesoriaLegalPage({ activeSubModule, onSubModuleChange, isSidebarCollapsed}: AsesoriaLegalPageProps) {
  return (
    <div className="min-h-full bg-background">
      <div className="mx-auto min-h-[calc(100vh-5rem)] w-full max-w-[1700px] p-4 sm:p-6 md:p-10">
        <AsesoriaLegalView activeSubModule={activeSubModule} onSubModuleChange={onSubModuleChange} isSidebarCollapsed={isSidebarCollapsed} />
      </div>
    </div>
  );
}

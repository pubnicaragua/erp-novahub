import { AsesoriaLegalView } from './support/AsesoriaLegalView';

export function AsesoriaLegalPage() {
  return (
    <div className="min-h-full bg-background">
      <div className="mx-auto min-h-[calc(100vh-5rem)] max-w-[1700px] p-6 md:p-10">
        <AsesoriaLegalView />
      </div>
    </div>
  );
}

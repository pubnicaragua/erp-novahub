const fs = require('fs');
const file = 'c:/Users/rafae/OneDrive/Desktop/Proyectos/ERP-NovaHub/Frontend/novahub-frontend/src/app/components/auth/RegisterTenantPage.tsx';
let code = fs.readFileSync(file, 'utf8');

// Update Left Panel logic
code = code.replace(
  'if (step === 3) return null;',
  'if (step === 2) return null;'
);
code = code.replace(
  'step === 3 && "lg:w-full"',
  'step === 2 && "lg:w-full"'
);
code = code.replace(
  'step === 3 ? "max-w-3xl" : "max-w-md"',
  'step === 2 ? "max-w-3xl" : "max-w-md"'
);

// Fix Headers mapping
code = code.replace(
  /\{step === 2 && <>Tu <span className="text-primary">equipo<\/span><\/>\}/, 
  '{TEMP_STEP_3_HEADER}'
);
code = code.replace(
  /\{step === 3 && <>Tus <span className="text-primary">módulos<\/span><\/>\}/, 
  '{step === 2 && <>Tus <span className="text-primary">módulos</span></>}'
);
code = code.replace(
  '{TEMP_STEP_3_HEADER}', 
  '{step === 3 && <>Tu <span className="text-primary">equipo</span></>}'
);

// Fix step array
code = code.replace(
  `{['Cuenta', 'Negocio', 'Equipo', 'Módulos'].map((label, i) => (`,
  `{['Cuenta', 'Negocio', 'Módulos', 'Equipo'].map((label, i) => (`
);

// Fix STEP_MESSAGES
code = code.replace(
  `STEP_MESSAGES = [\n  'Contanos sobre tu empresa para empezar',\n  'Seleccioná tu industria y tamaño de empresa',\n  'Configurá roles y usuarios (Opcional)',\n  'Personalizá tu NovaHub con los módulos que necesitás',\n];`,
  `STEP_MESSAGES = [\n  'Contanos sobre tu empresa para empezar',\n  'Seleccioná tu industria y tamaño de empresa',\n  'Personalizá tu NovaHub con los módulos que necesitás',\n  'Configurá roles y usuarios (Opcional)',\n];`
);
code = code.replace(
  `STEP_MESSAGES = [\r\n  'Contanos sobre tu empresa para empezar',\r\n  'Seleccioná tu industria y tamaño de empresa',\r\n  'Configurá roles y usuarios (Opcional)',\r\n  'Personalizá tu NovaHub con los módulos que necesitás',\r\n];`,
  `STEP_MESSAGES = [\n  'Contanos sobre tu empresa para empezar',\n  'Seleccioná tu industria y tamaño de empresa',\n  'Personalizá tu NovaHub con los módulos que necesitás',\n  'Configurá roles y usuarios (Opcional)',\n];`
);

// Update loadRecommendations useEffect
code = code.replace(
  'if (step === 3 && industry && !recommendations) {',
  'if (step === 2 && industry && !recommendations) {'
);

// Now the actual render functions
// We will simply extract both renderStep3 (Team) and renderStep4 (Modules)
// and swap their internal logic and names.
// It's easier to find the indices and substring it out, or we can just replace the function signatures.

const teamStart = 'const renderStep3 = () => (';
const modulesStart = 'const renderStep4 = () => {';

// Let's replace button texts and target steps directly in the code since we will swap their step index references.

// In original renderStep3 (Team), Atrás went to setStep(1), Siguiente went to setStep(3).
// Now Team is step 3 (index 3). Atrás should go to setStep(2), Siguiente should call handleFinalSubmit.
code = code.replace(
  /onClick=\{\(\) => setStep\(3\)\}\s*className="h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase tracking-widest gap-2 shadow-lg shadow-emerald-900\/40 flex-1">\s*Siguiente <ArrowRight className="size-4" \/>\s*<\/Button>/,
  `disabled={submitting} onClick={handleFinalSubmit}
          className="h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase tracking-widest gap-2 shadow-lg shadow-emerald-900/40 flex-1">
          {submitting ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          Comenzar prueba gratis
        </Button>`
);

code = code.replace(
  // Atrás on Team step
  /onClick=\{\(\) => setStep\(1\)\}\s*className="h-12 rounded-xl font-bold uppercase tracking-widest gap-2 flex-1">\s*<ArrowLeft className="size-4" \/> Atrás\s*<\/Button>/,
  `onClick={() => setStep(2)}
          className="h-12 rounded-xl font-bold uppercase tracking-widest gap-2 flex-1">
          <ArrowLeft className="size-4" /> Atrás
        </Button>`
);

// In original renderStep4 (Modules), Atrás went to setStep(2), Siguiente called handleFinalSubmit.
// Now Modules is step 2 (index 2). Atrás should go to setStep(1), Siguiente should go to setStep(3).
code = code.replace(
  /disabled=\{selectedModules\.length === 0 \|\| submitting\} onClick=\{handleFinalSubmit\}\s*className="h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase tracking-widest gap-2 shadow-lg shadow-emerald-900\/40 flex-1">\s*\{submitting \? <Loader2 className="size-4 animate-spin" \/> : <Sparkles className="size-4" \/>\}\s*Comenzar prueba gratis\s*<\/Button>/,
  `disabled={selectedModules.length === 0} onClick={() => setStep(3)}
          className="h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase tracking-widest gap-2 shadow-lg shadow-emerald-900/40 flex-1">
          Siguiente <ArrowRight className="size-4" />
        </Button>`
);

code = code.replace(
  // Atrás on Modules step
  /onClick=\{\(\) => setStep\(2\)\}\s*className="h-12 rounded-xl font-bold uppercase tracking-widest gap-2 flex-1">\s*<ArrowLeft className="size-4" \/> Atrás\s*<\/Button>/,
  `onClick={() => setStep(1)}
          className="h-12 rounded-xl font-bold uppercase tracking-widest gap-2 flex-1">
          <ArrowLeft className="size-4" /> Atrás
        </Button>`
);

// Now swap the function names and step logic
code = code.replace('const renderStep3 = () => (', 'const __TEMP__ = () => (');
code = code.replace('const renderStep4 = () => {', 'const renderStep3 = () => {');
code = code.replace('const __TEMP__ = () => (', 'const renderStep4 = () => (');

// And swap in the render loop:
// Wait, the render loop is:
// {step === 0 && renderStep1()}
// {step === 1 && renderStep2()}
// {step === 2 && renderStep3()}
// {step === 3 && renderStep4()}
// Since I swapped the names `renderStep3` (now Modules) and `renderStep4` (now Team), the loop stays exactly the same and maps perfectly!

fs.writeFileSync(file, code);
console.log('Swapped steps and updated buttons');

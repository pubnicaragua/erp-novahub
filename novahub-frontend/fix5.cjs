const fs = require('fs');
const file = 'c:/Users/rafae/OneDrive/Desktop/Proyectos/ERP-NovaHub/Frontend/novahub-frontend/src/app/components/auth/RegisterTenantPage.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Add renderStep4 to render loop using regex
code = code.replace(
  /\{step === 0 && renderStep1\(\)\}\s*\{step === 1 && renderStep2\(\)\}\s*\{step === 2 && renderStep3\(\)\}/,
  `{step === 0 && renderStep1()}
                  {step === 1 && renderStep2()}
                  {step === 2 && renderStep3()}
                  {step === 3 && renderStep4()}`
);

// 2. Add header 4 using regex
if (!code.includes('{step === 3 && <>Tu <span className="text-primary">equipo</span></>}')) {
  code = code.replace(
    /\{step === 2 && <>Tus <span className="text-primary">.*?<\/span><\/>\}/,
    `{step === 2 && <>Tus <span className="text-primary">módulos</span></>}
                    {step === 3 && <>Tu <span className="text-primary">equipo</span></>}`
  );
}

// 3. Fix Left Panel visibility
code = code.replace(/if\s*\(\s*step\s*===\s*\d+\s*\)\s*return\s*null\s*;/g, '');
code = code.replace(/step\s*===\s*\d+\s*&&\s*"lg:w-full"/g, '""');
code = code.replace(/step === 2 \? "max-w-3xl" : "max-w-md"/g, 'step === 2 ? "max-w-2xl" : "max-w-md"');

// 4. Fix role modules
const oldCheckboxMap = `{Array.from(PARENT_KEYS).map(mod => (`;
const newCheckboxMap = `{Array.from(PARENT_KEYS).filter(mod => {
                const subs = PARENT_SUBMODULES[mod] || [];
                if (subs.length === 0) return selectedModules.includes(mod);
                return selectedModules.includes(mod) || subs.some(s => selectedModules.includes(s));
              }).map(mod => (`;
if (code.includes(oldCheckboxMap)) {
  code = code.replace(oldCheckboxMap, newCheckboxMap);
  const closeIIFE = `</span>\n                </label>\n              ))}`;
  const newCloseIIFE = `</span>\n                </label>\n              ));\n              })()}`;
  
  const emptyStateFull = `
              {(() => {
                const available = Array.from(PARENT_KEYS).filter(mod => {
                  const subs = PARENT_SUBMODULES[mod] || [];
                  if (subs.length === 0) return selectedModules.includes(mod);
                  return selectedModules.includes(mod) || subs.some(s => selectedModules.includes(s));
                });
                if (available.length === 0) return <div className="col-span-2 text-xs text-muted-foreground mt-2">No hay módulos seleccionados en el paso anterior.</div>;
                return available.map(mod => (`;
                
  code = code.replace(newCheckboxMap, emptyStateFull);
  code = code.replace(closeIIFE, newCloseIIFE);
}

fs.writeFileSync(file, code);
console.log('Applied fix5');

const fs = require('fs');
const file = 'c:/Users/rafae/OneDrive/Desktop/Proyectos/ERP-NovaHub/Frontend/novahub-frontend/src/app/components/auth/RegisterTenantPage.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Fix the main render loop
const renderString = `{step === 0 && renderStep1()}
                  {step === 1 && renderStep2()}
                  {step === 2 && renderStep3()}`;

const renderStringReplaced = `{step === 0 && renderStep1()}
                  {step === 1 && renderStep2()}
                  {step === 2 && renderStep3()}
                  {step === 3 && renderStep4()}`;

code = code.replace(renderString, renderStringReplaced);

// 2. Fix the Headers mapping
const headerString = `{step === 0 && <>Crear <span className="text-primary">cuenta</span></>}
                    {step === 1 && <>Tu <span className="text-primary">negocio</span></>}
                    {step === 2 && <>Tus <span className="text-primary">módulos</span></>}`;

// Wait, the terminal shows it like this because of encoding: "Tus <span className=\"text-primary\">mdulos</span>"
// I will just use regex to replace it
code = code.replace(/\{step === 2 && <>Tus <span className="text-primary">.*?<\/span><\/>\}/, 
`{step === 2 && <>Tu <span className="text-primary">equipo</span></>}
                    {step === 3 && <>Tus <span className="text-primary">módulos</span></>}`
);

fs.writeFileSync(file, code);
console.log('Fixed render map');

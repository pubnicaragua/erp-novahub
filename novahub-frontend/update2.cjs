const fs = require('fs');
const file = 'c:/Users/rafae/OneDrive/Desktop/Proyectos/ERP-NovaHub/Frontend/novahub-frontend/src/app/components/auth/RegisterTenantPage.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Fix step conditions for renderLeftPanel and main container width
code = code.replace(
  'if (step === 2) return null;',
  'if (step === 3) return null;'
);
code = code.replace(
  'step === 2 && "lg:w-full"',
  'step === 3 && "lg:w-full"'
);
code = code.replace(
  'step === 2 ? "max-w-3xl" : "max-w-md"',
  'step === 3 ? "max-w-3xl" : "max-w-md"'
);

// 2. Add newRoleModules state
code = code.replace(
  "const [newRoleName, setNewRoleName] = useState('');",
  "const [newRoleName, setNewRoleName] = useState('');\n  const [newRoleModules, setNewRoleModules] = useState<string[]>([]);"
);

// 3. Update the Roles UI in renderStep3
const oldRolesUI = `<div className="flex gap-2 mb-3">
          <Input value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} placeholder="Nombre del Rol (Ej: Vendedor)" className="flex-1 h-9 bg-white/5 text-xs" />
          <Button type="button" onClick={() => {
            if (newRoleName) {
              setRoles([...roles, { name: newRoleName, allowedModules: [], permissions: [] }]);
              setNewRoleName('');
            }
          }} className="h-9 bg-emerald-600 hover:bg-emerald-500 text-white">Añadir</Button>
        </div>`;

const newRolesUI = `<div className="flex flex-col gap-2 mb-3">
          <div className="flex gap-2">
            <Input value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} placeholder="Nombre del Rol (Ej: Vendedor)" className="flex-1 h-9 bg-white/5 text-xs" />
            <Button type="button" onClick={() => {
              if (newRoleName && newRoleModules.length > 0) {
                // Generamos los permisos base para los módulos seleccionados
                const newPerms = newRoleModules.map(m => ({ module: m, read: true, write: true, delete: true }));
                setRoles([...roles, { name: newRoleName, allowedModules: newRoleModules, permissions: newPerms }]);
                setNewRoleName('');
                setNewRoleModules([]);
              } else if (!newRoleName) {
                toast.error('Ingresa un nombre para el rol');
              } else {
                toast.error('Selecciona al menos un módulo para el rol');
              }
            }} className="h-9 bg-emerald-600 hover:bg-emerald-500 text-white text-xs">Añadir Rol</Button>
          </div>
          <div className="bg-black/20 p-3 rounded-lg border border-border/30">
            <div className="text-[10px] font-bold text-muted-foreground mb-2">Selecciona los módulos a los que tendrá acceso:</div>
            <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
              {Array.from(PARENT_KEYS).map(mod => (
                <label key={mod} className="flex items-start gap-2 cursor-pointer hover:bg-white/5 p-1 rounded-md transition-colors">
                  <input type="checkbox" checked={newRoleModules.includes(mod)} onChange={(e) => {
                    if (e.target.checked) setNewRoleModules([...newRoleModules, mod]);
                    else setNewRoleModules(newRoleModules.filter(m => m !== mod));
                  }} className="size-3.5 mt-0.5 rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-emerald-500/30" />
                  <span className="text-[10px] text-foreground font-medium leading-tight">
                    {mod === 'HR' ? 'Recursos Humanos' : 
                     mod === 'SUPPORT_TECH' ? 'Soporte Técnico' :
                     mod.replace(/_/g, ' ').toLowerCase().replace(/\\b\\w/g, c => c.toUpperCase())}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>`;

code = code.replace(oldRolesUI, newRolesUI);

// Update Role display to show number of modules
code = code.replace(
  '{r.name}',
  '{r.name} ({r.allowedModules.length} mods)'
);

fs.writeFileSync(file, code);
console.log('Successfully applied visual fixes to RegisterTenantPage.tsx');

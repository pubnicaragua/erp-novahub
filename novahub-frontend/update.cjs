const fs = require('fs');
const file = 'c:/Users/rafae/OneDrive/Desktop/Proyectos/ERP-NovaHub/Frontend/novahub-frontend/src/app/components/auth/RegisterTenantPage.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Add states
code = code.replace(
  'const [expandedParent, setExpandedParent] = useState<string | null>(null);',
  `const [expandedParent, setExpandedParent] = useState<string | null>(null);
  const [logo, setLogo] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [users, setUsers] = useState<{name: string, email: string, password?: string, roleName?: string}[]>([]);
  const [roles, setRoles] = useState<{name: string, allowedModules: string[], permissions: any[]}[]>([]);
  const [newRoleName, setNewRoleName] = useState('');
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', roleName: '' });`
);

// 2. Change useEffect for step 2 -> step 3
code = code.replace(
  'if (step === 2 && industry && !recommendations) {',
  'if (step === 3 && industry && !recommendations) {'
);

// 3. Update handleFinalSubmit
code = code.replace(
  'companyDescription: companyDescription || undefined,\n        selectedModules,',
  `companyDescription: companyDescription || undefined,\n        selectedModules,\n        logo: logo || undefined,\n        roles: roles.length > 0 ? roles : undefined,\n        users: users.length > 0 ? users : undefined,`
);
code = code.replace(
  'companyDescription: companyDescription || undefined,\r\n        selectedModules,',
  `companyDescription: companyDescription || undefined,\n        selectedModules,\n        logo: logo || undefined,\n        roles: roles.length > 0 ? roles : undefined,\n        users: users.length > 0 ? users : undefined,`
);


// 4. Update progress steps
code = code.replace(
  'const totalSteps = 3;',
  'const totalSteps = 4;'
);
code = code.replace(
  `{['Cuenta', 'Negocio', 'Módulos'].map((label, i) => (`,
  `{['Cuenta', 'Negocio', 'Equipo', 'Módulos'].map((label, i) => (`
);
code = code.replace(
  `STEP_MESSAGES = [\n  'Contanos sobre tu empresa para empezar',\n  'Seleccioná tu industria para recomendarte los mejores módulos',\n  'Personalizá tu NovaHub con los módulos que necesitás',\n];`,
  `STEP_MESSAGES = [\n  'Contanos sobre tu empresa para empezar',\n  'Seleccioná tu industria y tamaño de empresa',\n  'Configurá roles y usuarios (Opcional)',\n  'Personalizá tu NovaHub con los módulos que necesitás',\n];`
);
code = code.replace(
  `STEP_MESSAGES = [\r\n  'Contanos sobre tu empresa para empezar',\r\n  'Seleccioná tu industria para recomendarte los mejores módulos',\r\n  'Personalizá tu NovaHub con los módulos que necesitás',\r\n];`,
  `STEP_MESSAGES = [\n  'Contanos sobre tu empresa para empezar',\n  'Seleccioná tu industria y tamaño de empresa',\n  'Configurá roles y usuarios (Opcional)',\n  'Personalizá tu NovaHub con los módulos que necesitás',\n];`
);


// 5. Update renderStep2 with Logo
code = code.replace(
  '<div className="space-y-5">\r\n      <div>',
  `<div className="space-y-5">
      <div className="space-y-1.5 mb-2">
        <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1">Logo de la empresa (Opcional)</Label>
        <div className="flex items-center gap-4">
          <div className="size-16 rounded-xl bg-muted/50 border border-border/50 flex items-center justify-center overflow-hidden">
            {logoPreview ? <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" /> : <Building className="size-6 text-muted-foreground" />}
          </div>
          <Input type="file" accept="image/png, image/jpeg" onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              setLogoPreview(URL.createObjectURL(file));
              const reader = new FileReader();
              reader.onloadend = () => setLogo(reader.result as string);
              reader.readAsDataURL(file);
            }
          }} className="flex-1 bg-white/5 border-white/10 text-xs" />
        </div>
      </div>
      <div>`
);
code = code.replace(
  '<div className="space-y-5">\n      <div>',
  `<div className="space-y-5">
      <div className="space-y-1.5 mb-2">
        <Label className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1">Logo de la empresa (Opcional)</Label>
        <div className="flex items-center gap-4">
          <div className="size-16 rounded-xl bg-muted/50 border border-border/50 flex items-center justify-center overflow-hidden">
            {logoPreview ? <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" /> : <Building className="size-6 text-muted-foreground" />}
          </div>
          <Input type="file" accept="image/png, image/jpeg" onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              setLogoPreview(URL.createObjectURL(file));
              const reader = new FileReader();
              reader.onloadend = () => setLogo(reader.result as string);
              reader.readAsDataURL(file);
            }
          }} className="flex-1 bg-white/5 border-white/10 text-xs" />
        </div>
      </div>
      <div>`
);

// 6. Rename renderStep3 to renderStep4
code = code.replace(
  'const renderStep3 = () => {',
  'const renderStep4 = () => {'
);
code = code.replace(
  'onClick={() => setStep(1)}\r\n            className="h-12 rounded-xl font-bold uppercase tracking-widest gap-2 flex-1">\r\n            <ArrowLeft className="size-4" /> Atrás',
  'onClick={() => setStep(2)}\n            className="h-12 rounded-xl font-bold uppercase tracking-widest gap-2 flex-1">\n            <ArrowLeft className="size-4" /> Atrás'
);
code = code.replace(
  'onClick={() => setStep(1)}\n            className="h-12 rounded-xl font-bold uppercase tracking-widest gap-2 flex-1">\n            <ArrowLeft className="size-4" /> Atrás',
  'onClick={() => setStep(2)}\n            className="h-12 rounded-xl font-bold uppercase tracking-widest gap-2 flex-1">\n            <ArrowLeft className="size-4" /> Atrás'
);

// 7. Insert renderStep3 (Usuarios y Roles)
const renderStep3Code = `
  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border/50 p-4 bg-white/5">
        <h4 className="text-xs font-bold mb-3">Roles (Opcional)</h4>
        <div className="flex gap-2 mb-3">
          <Input value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} placeholder="Nombre del Rol (Ej: Vendedor)" className="flex-1 h-9 bg-white/5 text-xs" />
          <Button type="button" onClick={() => {
            if (newRoleName) {
              setRoles([...roles, { name: newRoleName, allowedModules: [], permissions: [] }]);
              setNewRoleName('');
            }
          }} className="h-9 bg-emerald-600 hover:bg-emerald-500 text-white">Añadir</Button>
        </div>
        {roles.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {roles.map((r, i) => (
              <span key={i} className="px-2 py-1 text-[10px] font-bold bg-primary/20 text-primary rounded-md flex items-center gap-1">
                {r.name}
                <button type="button" onClick={() => setRoles(roles.filter(x => x.name !== r.name))} className="hover:text-red-500">×</button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border/50 p-4 bg-white/5">
        <h4 className="text-xs font-bold mb-3">Usuarios (Opcional)</h4>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <Input value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} placeholder="Nombre" className="h-9 bg-white/5 text-xs border-border/50" />
          <Input value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} placeholder="Email" type="email" className="h-9 bg-white/5 text-xs border-border/50" />
          <Input value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} placeholder="Contraseña" type="password" className="h-9 bg-white/5 text-xs border-border/50" />
          <select value={newUser.roleName} onChange={(e) => setNewUser({ ...newUser, roleName: e.target.value })} className="h-9 bg-white/5 text-xs rounded-md border border-border/50 px-2 outline-none text-muted-foreground">
            <option value="">Rol Base (Sin módulos extras)</option>
            {roles.map((r, i) => <option key={i} value={r.name}>{r.name}</option>)}
          </select>
        </div>
        <Button type="button" variant="outline" className="w-full h-8 text-xs mb-3 border-border/50" onClick={() => {
          if (newUser.name && newUser.email && newUser.password) {
            setUsers([...users, { ...newUser }]);
            setNewUser({ name: '', email: '', password: '', roleName: '' });
          } else {
            toast.error('Nombre, Email y Contraseña son obligatorios para crear un usuario');
          }
        }}>Añadir Usuario</Button>
        {users.length > 0 && (
          <div className="space-y-2">
            {users.map((u, i) => (
              <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-black/10 border border-border/30">
                <div>
                  <div className="text-xs font-bold">{u.name}</div>
                  <div className="text-[10px] text-muted-foreground">{u.email}</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full">{u.roleName || 'Usuario base'}</div>
                  <button type="button" onClick={() => setUsers(users.filter((_, idx) => idx !== i))} className="text-red-500/70 hover:text-red-500">×</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={() => setStep(1)}
          className="h-12 rounded-xl font-bold uppercase tracking-widest gap-2 flex-1">
          <ArrowLeft className="size-4" /> Atrás
        </Button>
        <Button type="button" onClick={() => setStep(3)}
          className="h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase tracking-widest gap-2 shadow-lg shadow-emerald-900/40 flex-1">
          Siguiente <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
`;

code = code.replace(
  'const SETUP_MESSAGES = [',
  renderStep3Code + '\n\n  const SETUP_MESSAGES = ['
);

// 8. Update main render
code = code.replace(
  '          {step === 0 && renderStep1()}\r\n          {step === 1 && renderStep2()}\r\n          {step === 2 && renderStep3()}',
  '          {step === 0 && renderStep1()}\n          {step === 1 && renderStep2()}\n          {step === 2 && renderStep3()}\n          {step === 3 && renderStep4()}'
);
code = code.replace(
  '          {step === 0 && renderStep1()}\n          {step === 1 && renderStep2()}\n          {step === 2 && renderStep3()}',
  '          {step === 0 && renderStep1()}\n          {step === 1 && renderStep2()}\n          {step === 2 && renderStep3()}\n          {step === 3 && renderStep4()}'
);

// 9. Update Welcome Logo
code = code.replace(
  '<Package className="size-10 text-white" />',
  '{logoPreview ? <img src={logoPreview} alt="Logo" className="size-12 object-cover rounded-full shadow-lg" /> : <Package className="size-10 text-white" />}'
);

fs.writeFileSync(file, code);
console.log('Successfully updated RegisterTenantPage.tsx');

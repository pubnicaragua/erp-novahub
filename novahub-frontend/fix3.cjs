const fs = require('fs');
const file = 'c:/Users/rafae/OneDrive/Desktop/Proyectos/ERP-NovaHub/Frontend/novahub-frontend/src/app/components/auth/RegisterTenantPage.tsx';
let content = fs.readFileSync(file, 'utf8');

const targetLine = '<Input value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} placeholder="Email" type="email" className="h-9 bg-white/5 text-xs border-border/50" />';

const replacement = `<Input 
            value={newUser.email} 
            onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} 
            onBlur={async (e) => {
              if (e.target.value && e.target.value.includes('@')) {
                try {
                  const res: any = await authService.checkEmail(e.target.value);
                  if (res?.data?.exists ?? res?.exists) {
                    toast.error('Este email ya está en uso');
                  }
                } catch (err) {}
              }
            }}
            placeholder="Email" 
            type="email" 
            className="h-9 bg-white/5 text-xs border-border/50" 
          />`;

if (content.includes(targetLine)) {
  content = content.replace(targetLine, replacement);
  fs.writeFileSync(file, content);
  console.log('Fixed Step 4');
} else {
  console.log('Could not find step 4 target line');
}

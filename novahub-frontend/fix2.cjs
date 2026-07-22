const fs = require('fs');
const file = 'c:/Users/rafae/OneDrive/Desktop/Proyectos/ERP-NovaHub/Frontend/novahub-frontend/src/app/components/auth/RegisterTenantPage.tsx';
let content = fs.readFileSync(file, 'utf8');

// I will restore the email div and add the onBlur
const startIdx = content.indexOf('{errors.userName && <p className="text-xs text-destructive ml-1">{errors.userName.message}</p>}');
const endIdx = content.indexOf('<Label htmlFor="password"');

if (startIdx !== -1 && endIdx !== -1) {
  const newMiddle = `{errors.userName && <p className="text-xs text-destructive ml-1">{errors.userName.message}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-1">Email</Label>
        <div className="relative">
          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input id="email" {...register('email')} type="email" placeholder="tu@empresa.com" autoComplete="email"
            onBlur={async (e) => {
              register('email').onBlur(e);
              if (e.target.value && e.target.value.includes('@')) {
                try {
                  const res: any = await authService.checkEmail(e.target.value);
                  if (res?.data?.exists ?? res?.exists) {
                    setFormError('email', { type: 'manual', message: 'Email ya registrado en el sistema' });
                  }
                } catch (err) {}
              }
            }}
            className={cn('h-11 pl-11 rounded-xl bg-white/5 border-white/10', errors.email && 'border-destructive')} />
        </div>
        {errors.email && <p className="text-xs text-destructive ml-1">{errors.email.message}</p>}
      </div>
      <div className="space-y-1.5">
        `;
  content = content.substring(0, startIdx) + newMiddle + content.substring(endIdx);
  fs.writeFileSync(file, content);
  console.log('Fixed Step 1');
} else {
  console.log('Could not find start or end index for step 1', startIdx, endIdx);
}

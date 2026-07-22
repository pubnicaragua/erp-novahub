const fs = require('fs');

const registerFile = 'c:/Users/rafae/OneDrive/Desktop/Proyectos/ERP-NovaHub/Frontend/novahub-frontend/src/app/components/auth/RegisterTenantPage.tsx';
let registerCode = fs.readFileSync(registerFile, 'utf8');

const registerTarget = `  const addRole = () => {
    if (!newRoleName) return;
    setRoles([...roles, { name: newRoleName, allowedModules: newRoleModules, permissions: [] }]);
    setNewRoleName('');
    setNewRoleModules([]);
  };`;

const registerReplacement = `  const addRole = () => {
    if (!newRoleName) return;
    const permissions: any[] = [];
    const expandedAllowed = new Set(newRoleModules);
    newRoleModules.forEach(mod => {
      const subs = PARENT_SUBMODULES[mod] || [];
      subs.forEach(sub => expandedAllowed.add(sub));
    });
    expandedAllowed.forEach(mod => {
      permissions.push({
        module: mod,
        read: true,
        write: true,
        delete: true
      });
    });

    setRoles([...roles, { name: newRoleName, allowedModules: Array.from(expandedAllowed), permissions }]);
    setNewRoleName('');
    setNewRoleModules([]);
  };`;

registerCode = registerCode.replace(registerTarget, registerReplacement);
fs.writeFileSync(registerFile, registerCode);


const authFile = 'c:/Users/rafae/OneDrive/Desktop/Proyectos/ERP-NovaHub/Frontend/novahub-frontend/src/app/contexts/AuthContext.tsx';
let authCode = fs.readFileSync(authFile, 'utf8');

const authTarget = `    const coreModules = [
      'configuracion', 'dashboard', 'suscripciones',
      'centro-capacitacion', 'soporte-tecnico', 'asesoria-legal',
    ];`;

const authReplacement = `    const coreModules = [
      'configuracion', 'dashboard', 'suscripciones',
    ];`;

authCode = authCode.replace(authTarget, authReplacement);
fs.writeFileSync(authFile, authCode);

console.log('Fixed role creation permissions and core modules');

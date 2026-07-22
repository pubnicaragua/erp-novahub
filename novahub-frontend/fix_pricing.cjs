const fs = require('fs');
const file = 'c:/Users/rafae/OneDrive/Desktop/Proyectos/ERP-NovaHub/Frontend/novahub-frontend/src/app/components/auth/RegisterTenantPage.tsx';
let code = fs.readFileSync(file, 'utf8');

const totalPriceOld = `  const totalPrice = selectedModules.reduce((sum, mod) => {
    const found = [
      ...(recommendations?.recommended || []),
      ...(recommendations?.optional || []),
    ].find((m) => m.module === mod);
    return sum + (found?.price || 0);
  }, 0);`;

const totalPriceNew = `  const totalPrice = selectedModules.reduce((sum, mod) => {
    if (!PARENT_KEYS.has(mod)) return sum; // Solo sumar precios de los módulos padre
    const found = [
      ...(recommendations?.recommended || []),
      ...(recommendations?.optional || []),
    ].find((m) => m.module === mod);
    return sum + (found?.price || 0);
  }, 0);`;

code = code.replace(totalPriceOld, totalPriceNew);

const toggleModuleOld = `  const toggleModule = (moduleKey: string) => {
    setSelectedModules((prev) =>
      prev.includes(moduleKey) ? prev.filter((m) => m !== moduleKey) : [...prev, moduleKey],
    );
  };`;

const toggleModuleNew = `  const toggleModule = (moduleKey: string) => {
    setSelectedModules((prev) =>
      prev.includes(moduleKey) ? prev.filter((m) => m !== moduleKey) : [...prev, moduleKey],
    );
  };

  const toggleParentAndSubs = (parent: string) => {
    const subs = PARENT_SUBMODULES[parent] || [];
    setSelectedModules((prev) => {
      const isCurrentlyActive = subs.length === 0 ? prev.includes(parent) : subs.every(s => prev.includes(s));
      if (isCurrentlyActive) {
        return prev.filter(m => m !== parent && !subs.includes(m));
      } else {
        const toAdd = [parent, ...subs].filter(m => !prev.includes(m));
        return [...prev, ...toAdd];
      }
    });
  };`;

code = code.replace(toggleModuleOld, toggleModuleNew);

const onClickOld = /<button type="button" onClick=\{\(\) => \{ if \(hasSubs\) \{ expandParent\(mod\.module\); \} else \{ toggleModule\(mod\.module\); \} \}\}/g;
const onClickNew = `<button type="button" onClick={() => toggleParentAndSubs(mod.module)}`;
code = code.replace(onClickOld, onClickNew);

const expandArrowOld = /\{hasSubs && \(\r?\n\s*<span className="text-\[10px\] text-muted-foreground">\{isExpanded \? '▲' : '▼'\}<\/span>\r?\n\s*\)\}/g;
const expandArrowNew = `{hasSubs && (
                      <div 
                        className="p-1 hover:bg-muted/30 rounded-md cursor-pointer"
                        onClick={(e) => { e.stopPropagation(); expandParent(mod.module); }}
                      >
                        <span className="text-[10px] text-muted-foreground">{isExpanded ? '▲' : '▼'}</span>
                      </div>
                    )}`;
code = code.replace(expandArrowOld, expandArrowNew);

fs.writeFileSync(file, code);
console.log('Fixed calculation and toggles');

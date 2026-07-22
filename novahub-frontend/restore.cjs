const fs = require('fs');
const file = 'c:/Users/rafae/OneDrive/Desktop/Proyectos/ERP-NovaHub/Frontend/novahub-frontend/src/app/components/auth/RegisterTenantPage.tsx';
let code = fs.readFileSync(file, 'utf8');

const badCode = `  const onStep1Submit = (data: Step1Data) => {
    setError(null);
    try {
      const response: any = await authService.registerTenant({`;

const goodCode = `  const onStep1Submit = (data: Step1Data) => {
    setStep1Data(data);
    setStep(1);
  };

  const canGoStep2 = industry !== null && companySize !== null;
  const totalPrice = selectedModules.reduce((sum, mod) => {
    if (!PARENT_KEYS.has(mod)) return sum; // Solo sumar precios de los mÃ³dulos padre
    const found = [
      ...(recommendations?.recommended || []),
      ...(recommendations?.optional || []),
    ].find((m) => m.module === mod);
    return sum + (found?.price || 0);
  }, 0);

  const handleFinalSubmit = async () => {
    if (!step1Data) return;
    setSubmitting(true);
    setError(null);
    try {
      const response: any = await authService.registerTenant({`;

code = code.replace(badCode, goodCode);
fs.writeFileSync(file, code);
console.log('Restored');

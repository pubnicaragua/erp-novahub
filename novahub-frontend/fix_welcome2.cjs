const fs = require('fs');
const file = 'c:/Users/rafae/OneDrive/Desktop/Proyectos/ERP-NovaHub/Frontend/novahub-frontend/src/app/components/auth/RegisterTenantPage.tsx';
let code = fs.readFileSync(file, 'utf8');

const regex = /\s*className="text-muted-foreground"\s*>\s*Hemos configurado todo para <strong className="text-foreground">\{step1Data\?\.companyName \|\| 'tu empresa'\}<\/strong>\s*<\/motion\.p>/;

const replacement = `
  const SETUP_MESSAGES = [
    'Creando tu workspace...',
    'Configurando módulos seleccionados...',
    'Preparando base de datos...',
    'Inicializando tu dashboard...',
    'Aplicando personalización...',
    'Casi listo...',
  ];

  const renderWelcome = () => {
    const selectedCount = selectedModules.length;
    const sizeLabel = COMPANY_SIZES.find(s => s.key === companySize)?.label || companySize || '';
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="flex flex-col items-center py-8 text-center gap-6"
      >
        <motion.div
          initial={{ scale: 0, rotate: -45 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 12, delay: 0.1 }}
          className="size-24 rounded-full flex items-center justify-center shadow-xl shadow-emerald-500/30 overflow-hidden bg-white border border-emerald-100"
        >
          <motion.div
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            className="flex items-center justify-center w-full h-full"
          >
            {logoPreview ? (
              <img src={logoPreview} alt="Logo de la empresa" className="w-full h-full object-contain p-2" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
                <Sparkles className="size-10 text-white" />
              </div>
            )}
          </motion.div>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-3xl font-black tracking-tighter"
        >
          ¡Tu NovaHub está listo!
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-muted-foreground"
        >
          Hemos configurado todo para <strong className="text-foreground">{step1Data?.companyName || 'tu empresa'}</strong>
        </motion.p>`;

if (regex.test(code)) {
    code = code.replace(regex, replacement);
    fs.writeFileSync(file, code);
    console.log('Fixed welcome screen properly');
} else {
    console.log('Regex did not match');
}

const fs = require('fs');
const file = 'c:/Users/rafae/OneDrive/Desktop/Proyectos/ERP-NovaHub/Frontend/novahub-frontend/src/app/components/auth/RegisterTenantPage.tsx';
let content = fs.readFileSync(file, 'utf8');

// I will find the hooks section by looking for const [newUser... and replacing everything until onStep1Submit
const startIdx = content.indexOf('const [newUser');
const endIdx = content.indexOf('const onStep1Submit');

if (startIdx !== -1 && endIdx !== -1) {
  const newMiddle = `const [newUser, setNewUser] = useState({ name: '', email: '', password: '', roleName: '' });

  const { register, handleSubmit, formState: { errors }, watch, setError: setFormError } = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
    defaultValues: { companyName: '', userName: '', email: '', password: '', acceptTerms: false },
  });

  const acceptTerms = watch('acceptTerms');

  useEffect(() => {
    if (step === 2 && industry && !recommendations) {
      setLoadingModules(true);
      authService.getModuleRecommendations(industry)
        .then((res: any) => {
          const data = res?.data || res;
          setRecommendations(data);
          setSelectedModules(data.recommended?.map((m: any) => m.module) || []);
        })
        .catch(() => toast.error('Error al carrar recomendaciones'))
        .finally(() => setLoadingModules(false));
    }
  }, [step, industry, recommendations]);

  useEffect(() => {
    if (!showWelcome) return;
    setMsgIndex(0);
    const interval = setInterval(() => {
      setMsgIndex((prev) => {
        if (prev >= 5) { clearInterval(interval); return prev; }
        return prev + 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [showWelcome]);

  `;
  content = content.substring(0, startIdx) + newMiddle + content.substring(endIdx);
  fs.writeFileSync(file, content);
  console.log('Fixed');
} else {
  console.log('Could not find start or end index', startIdx, endIdx);
}

const fs = require('fs');
const file = 'c:/Users/rafae/OneDrive/Desktop/Proyectos/ERP-NovaHub/Frontend/novahub-frontend/src/app/components/auth/RegisterTenantPage.tsx';
let content = fs.readFileSync(file, 'utf8');

const startStr = `<a href="#" className="text-primary hover:underline">términos de servicio</a>{' '}y la{' '}`;
const endStr = `const renderStep2 = () => (`;

const startIdx = content.indexOf(startStr);
const endIdx = content.indexOf(endStr);

if (startIdx !== -1 && endIdx !== -1) {
  const newMiddle = startStr + `
            <a href="#" className="text-primary hover:underline">política de privacidad</a>.
          </span>
        </label>
        {errors.acceptTerms && <p className="text-xs text-destructive ml-1">{errors.acceptTerms.message}</p>}
      </div>
      <Button type="submit" disabled={!acceptTerms || Object.keys(errors).length > 0}
        className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase tracking-widest gap-2 shadow-lg shadow-emerald-900/40 mt-2">
        Siguiente <ArrowRight className="size-4" />
      </Button>
    </form>
  );

  `;
  content = content.substring(0, startIdx) + newMiddle + content.substring(endIdx);
  fs.writeFileSync(file, content);
  console.log('Fixed button disabled state');
} else {
  console.log('Could not find start or end index for button fix');
}

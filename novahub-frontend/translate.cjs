const fs = require('fs');
const file = 'c:/Users/rafae/OneDrive/Desktop/Proyectos/ERP-NovaHub/Frontend/novahub-frontend/src/app/components/auth/RegisterTenantPage.tsx';
let code = fs.readFileSync(file, 'utf8');

const replacement = `<span className="text-[10px] text-foreground font-medium leading-tight">
                      {
                        mod === 'SALES' ? 'Ventas' :
                        mod === 'PURCHASES' ? 'Compras' :
                        mod === 'INVENTORY' ? 'Inventario' :
                        mod === 'FINANCIAL' ? 'Finanzas' :
                        mod === 'ACCOUNTING' ? 'Contabilidad' :
                        mod === 'HR' ? 'Recursos Humanos' :
                        mod === 'PROJECTS' ? 'Proyectos' :
                        mod === 'NOTIFICATIONS' ? 'Notificaciones' :
                        mod === 'ACTIVITIES' ? 'Actividades' :
                        mod === 'DOCUMENTS' ? 'Documentos' :
                        mod === 'REPORTS' ? 'Reportes' :
                        mod === 'SUPPORT_TECH' ? 'Soporte Técnico' :
                        mod === 'TOOLS' ? 'Herramientas' :
                        mod.replace(/_/g, ' ').toLowerCase().replace(/\\b\\w/g, c => c.toUpperCase())
                      }
                    </span>`;

code = code.replace(/<span className="text-\[10px\] text-foreground font-medium leading-tight">[\s\S]*?<\/span>/, replacement);

fs.writeFileSync(file, code);
console.log('Translated module names');

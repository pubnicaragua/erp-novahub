const fs = require('fs');
const path = require('path');
const filePath = 'c:/Users/Probook 450 G7/BE-NH/novahub-backend/src/sales/sales.service.ts';
let content = fs.readFileSync(filePath, 'utf8');

const replacement1 = let customerId = rest.customerId;
    if (!customerId || customerId.includes('temp-') || customerId.includes('new-')) {
      customerId = (await this.prisma.customer.findFirst({ where: { clientTenantId } }))?.id;
    };

const replacement2 = let customerId = data.customerId;
    if (!customerId || customerId.includes('temp-') || customerId.includes('new-')) {
      customerId = (await this.prisma.customer.findFirst({ where: { clientTenantId } }))?.id;
    };

content = content.replace(/const customerId = rest\.customerId \|\| \(await this\.prisma\.customer\.findFirst\(\{ where: \{ clientTenantId \} \}\)\)\?\.id;/g, replacement1);
content = content.replace(/const customerId = data\.customerId \|\| \(await this\.prisma\.customer\.findFirst\(\{ where: \{ clientTenantId \} \}\)\)\?\.id;/g, replacement2);

fs.writeFileSync(filePath, content);
console.log('Done');

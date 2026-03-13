import { PrismaClient, MovementType, WarehouseType, BillingPlanType, TransferStatus, AdjustmentReason } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  console.log('🌱 Starting Complete Inventory Seed...');

  // 0. Ensure Partner exists (Requirement for ClientTenant)
  let partner = await prisma.partner.findUnique({ where: { email: 'partner@novahub.io' } });
  if (!partner) {
    console.log('Creating demo partner...');
    const novaHubTenant = await prisma.novaHubTenant.upsert({
      where: { id: 'novahub-main' },
      update: {},
      create: { id: 'novahub-main', name: 'NovaHub Platform', isActive: true },
    });
    partner = await prisma.partner.create({
      data: {
        id: 'partner-demo',
        novaHubTenantId: novaHubTenant.id,
        name: 'NovaHub Demo Partner',
        email: 'partner@novahub.io',
        isActive: true,
      }
    });
  }

  // 1. Get or Create Tenant
  let tenant = await prisma.clientTenant.findFirst({ where: { slug: 'empresa-demo' } });
  if (!tenant) {
    console.log('Creating missing tenant...');
    tenant = await prisma.clientTenant.create({
      data: {
        id: 'client-demo-001',
        partnerId: partner.id,
        name: 'Empresa Demo S.A.',
        slug: 'empresa-demo',
        plan: BillingPlanType.ENTERPRISE,
        isActive: true,
      }
    });
  }
  const tid = tenant.id;

  // 2. Categories - Complete set
  const categories = [
    { id: 'cat-comp-001', name: 'Computación', description: 'Equipos de cómputo y accesorios' },
    { id: 'cat-comp-002', name: 'Laptops', description: 'Computadoras portátiles' },
    { id: 'cat-elect-001', name: 'Smartphones', description: 'Teléfonos inteligentes' },
    { id: 'cat-elect-002', name: 'Tablets', description: 'Tabletas electrónicas' },
    { id: 'cat-acces-001', name: 'Accesorios', description: 'Accesorios y periféricos' },
    { id: 'cat-audio-001', name: 'Audio', description: 'Equipos de audio y auriculares' },
    { id: 'cat-redes-001', name: 'Redes', description: 'Equipos de networking' },
    { id: 'cat-almac-001', name: 'Almacenamiento', description: 'Discos y memorias' },
  ];
  
  console.log('📦 Creating categories...');
  for (const cat of categories) {
    await prisma.category.upsert({
      where: { id: cat.id },
      update: { name: cat.name, description: cat.description },
      create: { id: cat.id, clientTenantId: tid, name: cat.name, description: cat.description }
    });
  }

  // 3. Warehouses - Complete hierarchy
  const warehouses = [
    { id: 'wh-main-001', name: 'Bodega Central', location: 'Zona Industrial Norte', type: WarehouseType.MAIN, parentId: null },
    { id: 'wh-store-001', name: 'Tienda Centro', location: 'Centro Comercial Plaza', type: WarehouseType.STORE, parentId: 'wh-main-001' },
    { id: 'wh-store-002', name: 'Tienda Sur', location: 'Mall del Sur', type: WarehouseType.STORE, parentId: 'wh-main-001' },
    { id: 'wh-store-003', name: 'Showroom Principal', location: 'Av. Principal 123', type: WarehouseType.STORE, parentId: 'wh-main-001' },
    { id: 'wh-depot-001', name: 'Centro Distribución', location: 'Parque Logístico', type: WarehouseType.DISTRIBUTION_CENTER, parentId: null },
  ];
  
  console.log('🏭 Creating warehouses...');
  for (const wh of warehouses) {
    await prisma.warehouse.upsert({
      where: { id: wh.id },
      update: { name: wh.name, location: wh.location, type: wh.type },
      create: { 
        id: wh.id, 
        clientTenantId: tid, 
        name: wh.name, 
        location: wh.location,
        type: wh.type,
        parentId: wh.parentId,
        isActive: true 
      }
    });
  }

  // 4. Products & Variants - Complete catalog
  const products = [
    // Laptops
    { id: 'prod-mac-001', code: 'MAC-M3-14', name: 'MacBook Pro 14" M3', cat: 'cat-comp-002', price: 1999, cost: 1500, trackBatch: false, trackSeries: true },
    { id: 'prod-mac-002', code: 'MAC-M3-16', name: 'MacBook Pro 16" M3 Max', cat: 'cat-comp-002', price: 3499, cost: 2800, trackBatch: false, trackSeries: true },
    { id: 'prod-dell-001', code: 'DELL-XPS-15', name: 'Dell XPS 15 i9', cat: 'cat-comp-002', price: 1799, cost: 1350, trackBatch: false, trackSeries: true },
    { id: 'prod-lenovo-001', code: 'LEN-THINK-X1', name: 'Lenovo ThinkPad X1 Carbon', cat: 'cat-comp-002', price: 1599, cost: 1200, trackBatch: false, trackSeries: true },
    // Smartphones
    { id: 'prod-iphone-015', code: 'IPH-15-PRO', name: 'iPhone 15 Pro 256GB', cat: 'cat-elect-001', price: 1099, cost: 850, trackBatch: false, trackSeries: true },
    { id: 'prod-iphone-016', code: 'IPH-15-PROMAX', name: 'iPhone 15 Pro Max 512GB', cat: 'cat-elect-001', price: 1399, cost: 1100, trackBatch: false, trackSeries: true },
    { id: 'prod-samsung-001', code: 'SAM-S24-ULTRA', name: 'Samsung Galaxy S24 Ultra', cat: 'cat-elect-001', price: 1199, cost: 900, trackBatch: false, trackSeries: true },
    { id: 'prod-pixel-001', code: 'PIX-8-PRO', name: 'Google Pixel 8 Pro', cat: 'cat-elect-001', price: 999, cost: 750, trackBatch: false, trackSeries: true },
    // Tablets
    { id: 'prod-ipad-001', code: 'IPAD-PRO-12', name: 'iPad Pro 12.9" M2', cat: 'cat-elect-002', price: 1099, cost: 850, trackBatch: false, trackSeries: true },
    { id: 'prod-ipad-002', code: 'IPAD-AIR-11', name: 'iPad Air 11" M2', cat: 'cat-elect-002', price: 799, cost: 600, trackBatch: false, trackSeries: false },
    // Accesorios
    { id: 'prod-magic-001', code: 'MAGIC-KB-ESP', name: 'Magic Keyboard Español', cat: 'cat-acces-001', price: 99, cost: 65, trackBatch: true, trackSeries: false },
    { id: 'prod-mouse-001', code: 'MAGIC-MOUSE-3', name: 'Magic Mouse 3', cat: 'cat-acces-001', price: 79, cost: 50, trackBatch: true, trackSeries: false },
    { id: 'prod-charger-001', code: 'USB-C-140W', name: 'Cargador USB-C 140W', cat: 'cat-acces-001', price: 99, cost: 60, trackBatch: true, trackSeries: false },
    // Audio
    { id: 'prod-airpods-001', code: 'AIRPODS-PRO-2', name: 'AirPods Pro 2', cat: 'cat-audio-001', price: 249, cost: 180, trackBatch: true, trackSeries: false },
    { id: 'prod-airpods-002', code: 'AIRPODS-MAX', name: 'AirPods Max', cat: 'cat-audio-001', price: 549, cost: 400, trackBatch: false, trackSeries: true },
    // Redes
    { id: 'prod-switch-001', code: 'CISCO-SW-24P', name: 'Switch Cisco 24 Puertos', cat: 'cat-redes-001', price: 450, cost: 320, trackBatch: true, trackSeries: true },
    { id: 'prod-router-001', code: 'UBIQ-DREAM', name: 'Ubiquiti Dream Machine Pro', cat: 'cat-redes-001', price: 379, cost: 280, trackBatch: false, trackSeries: true },
    // Almacenamiento
    { id: 'prod-ssd-001', code: 'SSD-SAMS-2TB', name: 'Samsung 990 Pro 2TB', cat: 'cat-almac-001', price: 179, cost: 120, trackBatch: true, trackSeries: false },
    { id: 'prod-ssd-002', code: 'SSD-WD-4TB', name: 'WD Black SN850X 4TB', cat: 'cat-almac-001', price: 349, cost: 250, trackBatch: true, trackSeries: false },
    { id: 'prod-hdd-001', code: 'HDD-SEA-8TB', name: 'Seagate IronWolf 8TB', cat: 'cat-almac-001', price: 199, cost: 140, trackBatch: true, trackSeries: false },
  ];

  console.log('📱 Creating products and variants...');
  for (const p of products) {
    // Check if product exists first
    const existingProduct = await prisma.product.findUnique({ where: { code: p.code } });
    
    let productId: string;
    if (existingProduct) {
      // Update existing product
      await prisma.product.update({
        where: { code: p.code },
        data: { salePrice: p.price, costPrice: p.cost, taxRate: 15, categoryId: p.cat, trackBatch: p.trackBatch, trackSeries: p.trackSeries }
      });
      productId = existingProduct.id;
    } else {
      // Create new product
      const newProduct = await prisma.product.create({
        data: {
          code: p.code,
          name: p.name,
          categoryId: p.cat,
          salePrice: p.price,
          costPrice: p.cost,
          taxRate: 15,
          trackBatch: p.trackBatch,
          trackSeries: p.trackSeries,
          clientTenantId: tid
        }
      });
      productId = newProduct.id;
    }

    // Create default variant for each product
    const variantSku = `SKU-${p.code}`;
    const existingVariant = await prisma.productVariant.findUnique({ where: { sku: variantSku } });
    
    if (!existingVariant) {
      await prisma.productVariant.create({
        data: {
          productId: productId,
          sku: variantSku,
          name: 'Estándar',
        }
      });
    }
  }

  // 5. Inventory Levels - Stock in warehouses
  console.log('📊 Setting up inventory levels...');
  
  // Build a map of product codes to their actual IDs
  const productMap = new Map<string, string>();
  for (const p of products) {
    const prod = await prisma.product.findUnique({ where: { code: p.code } });
    if (prod) productMap.set(p.code, prod.id);
  }

  const stockLevels = [
    // Bodega Central - Main stock
    { productCode: 'MAC-M3-14', warehouseId: 'wh-main-001', quantity: 45, minStock: 10, maxStock: 100 },
    { productCode: 'MAC-M3-16', warehouseId: 'wh-main-001', quantity: 20, minStock: 5, maxStock: 50 },
    { productCode: 'DELL-XPS-15', warehouseId: 'wh-main-001', quantity: 30, minStock: 8, maxStock: 60 },
    { productCode: 'LEN-THINK-X1', warehouseId: 'wh-main-001', quantity: 25, minStock: 5, maxStock: 50 },
    { productCode: 'IPH-15-PRO', warehouseId: 'wh-main-001', quantity: 80, minStock: 20, maxStock: 200 },
    { productCode: 'IPH-15-PROMAX', warehouseId: 'wh-main-001', quantity: 50, minStock: 15, maxStock: 150 },
    { productCode: 'SAM-S24-ULTRA', warehouseId: 'wh-main-001', quantity: 60, minStock: 15, maxStock: 120 },
    { productCode: 'AIRPODS-PRO-2', warehouseId: 'wh-main-001', quantity: 150, minStock: 30, maxStock: 300 },
    { productCode: 'CISCO-SW-24P', warehouseId: 'wh-main-001', quantity: 8, minStock: 10, maxStock: 30 }, // Low stock alert!
    { productCode: 'SSD-SAMS-2TB', warehouseId: 'wh-main-001', quantity: 100, minStock: 20, maxStock: 200 },
    // Showroom
    { productCode: 'MAC-M3-14', warehouseId: 'wh-store-003', quantity: 5, minStock: 2, maxStock: 15 },
    { productCode: 'IPH-15-PRO', warehouseId: 'wh-store-003', quantity: 12, minStock: 5, maxStock: 30 },
    { productCode: 'IPAD-PRO-12', warehouseId: 'wh-store-003', quantity: 8, minStock: 3, maxStock: 20 },
    { productCode: 'AIRPODS-PRO-2', warehouseId: 'wh-store-003', quantity: 25, minStock: 10, maxStock: 50 },
    { productCode: 'AIRPODS-MAX', warehouseId: 'wh-store-003', quantity: 3, minStock: 5, maxStock: 15 }, // Low stock!
    // Tienda Centro
    { productCode: 'IPH-15-PRO', warehouseId: 'wh-store-001', quantity: 15, minStock: 5, maxStock: 40 },
    { productCode: 'SAM-S24-ULTRA', warehouseId: 'wh-store-001', quantity: 10, minStock: 5, maxStock: 30 },
    { productCode: 'MAGIC-KB-ESP', warehouseId: 'wh-store-001', quantity: 20, minStock: 5, maxStock: 40 },
  ];

  for (const sl of stockLevels) {
    const productId = productMap.get(sl.productCode);
    if (!productId) {
      console.log(`⚠️ Product not found: ${sl.productCode}`);
      continue;
    }
    
    const variantSku = `SKU-${sl.productCode}`;
    const variant = await prisma.productVariant.findUnique({ where: { sku: variantSku } });
    if (!variant) {
      console.log(`⚠️ Variant not found: ${variantSku}`);
      continue;
    }

    const levelId = `invlvl-${sl.productCode}-${sl.warehouseId}`;
    const existingLevel = await prisma.inventoryLevel.findUnique({ where: { id: levelId } });
    
    if (existingLevel) {
      await prisma.inventoryLevel.update({
        where: { id: levelId },
        data: { quantity: sl.quantity, minStock: sl.minStock, maxStock: sl.maxStock }
      });
    } else {
      await prisma.inventoryLevel.create({
        data: {
          id: levelId,
          clientTenantId: tid,
          productId: productId,
          warehouseId: sl.warehouseId,
          variantId: variant.id,
          quantity: sl.quantity,
          minStock: sl.minStock,
          maxStock: sl.maxStock,
        }
      });
    }
  }

  // 6. Inventory Movements - History
  console.log('📈 Creating movement history...');
  await prisma.inventoryMovement.deleteMany({ where: { clientTenantId: tid, reference: { startsWith: 'Seed:' } } });
  
  const movements = [
    { productCode: 'MAC-M3-14', warehouseId: 'wh-main-001', quantity: 50, type: MovementType.IN, reference: 'Seed: Compra inicial MacBooks', daysAgo: 30 },
    { productCode: 'IPH-15-PRO', warehouseId: 'wh-main-001', quantity: 100, type: MovementType.IN, reference: 'Seed: Recepción iPhones', daysAgo: 25 },
    { productCode: 'IPH-15-PRO', warehouseId: 'wh-main-001', quantity: 20, type: MovementType.OUT, reference: 'Seed: Venta mayorista', daysAgo: 20 },
    { productCode: 'MAC-M3-14', warehouseId: 'wh-main-001', quantity: 5, type: MovementType.TRANSFER, reference: 'Seed: Transferencia a Showroom', daysAgo: 15 },
    { productCode: 'MAC-M3-14', warehouseId: 'wh-store-003', quantity: 5, type: MovementType.IN, reference: 'Seed: Recepción de Bodega Central', daysAgo: 15 },
    { productCode: 'AIRPODS-PRO-2', warehouseId: 'wh-main-001', quantity: 200, type: MovementType.IN, reference: 'Seed: Compra AirPods', daysAgo: 10 },
    { productCode: 'AIRPODS-PRO-2', warehouseId: 'wh-main-001', quantity: 50, type: MovementType.OUT, reference: 'Seed: Distribución tiendas', daysAgo: 8 },
    { productCode: 'SAM-S24-ULTRA', warehouseId: 'wh-main-001', quantity: 80, type: MovementType.IN, reference: 'Seed: Recepción Samsung', daysAgo: 7 },
    { productCode: 'CISCO-SW-24P', warehouseId: 'wh-main-001', quantity: 15, type: MovementType.IN, reference: 'Seed: Compra switches Cisco', daysAgo: 5 },
    { productCode: 'CISCO-SW-24P', warehouseId: 'wh-main-001', quantity: 7, type: MovementType.OUT, reference: 'Seed: Venta proyecto corporativo', daysAgo: 3 },
    { productCode: 'SSD-SAMS-2TB', warehouseId: 'wh-main-001', quantity: 120, type: MovementType.IN, reference: 'Seed: Compra SSDs Samsung', daysAgo: 2 },
    { productCode: 'IPH-15-PROMAX', warehouseId: 'wh-store-003', quantity: 8, type: MovementType.IN, reference: 'Seed: Reposición tienda', daysAgo: 1 },
  ];

  for (const m of movements) {
    const productId = productMap.get(m.productCode);
    if (!productId) continue;
    
    const variantSku = `SKU-${m.productCode}`;
    const variant = await prisma.productVariant.findUnique({ where: { sku: variantSku } });
    
    await prisma.inventoryMovement.create({
      data: {
        clientTenantId: tid,
        productId: productId,
        warehouseId: m.warehouseId,
        variantId: variant?.id,
        quantity: m.quantity,
        type: m.type,
        reference: m.reference,
        date: new Date(Date.now() - m.daysAgo * 86400000)
      }
    });
  }

  // 7. Transfers
  console.log('🚚 Creating transfers...');
  await prisma.transfer.deleteMany({ where: { clientTenantId: tid, number: { startsWith: 'TRF-SEED' } } });
  
  const transfers = [
    { 
      number: 'TRF-SEED-001', 
      fromId: 'wh-main-001', 
      toId: 'wh-store-003', 
      status: TransferStatus.COMPLETED,
      carrier: 'DHL Express',
      daysAgo: 10,
      items: [
        { variantSku: 'SKU-MAC-M3-14', quantity: 3 },
        { variantSku: 'SKU-AIRPODS-PRO-2', quantity: 10 },
      ]
    },
    { 
      number: 'TRF-SEED-002', 
      fromId: 'wh-main-001', 
      toId: 'wh-store-001', 
      status: TransferStatus.COMPLETED,
      carrier: 'FedEx',
      daysAgo: 5,
      items: [
        { variantSku: 'SKU-IPH-15-PRO', quantity: 15 },
        { variantSku: 'SKU-SAM-S24-ULTRA', quantity: 10 },
      ]
    },
    { 
      number: 'TRF-SEED-003', 
      fromId: 'wh-depot-001', 
      toId: 'wh-main-001', 
      status: TransferStatus.IN_TRANSIT,
      carrier: 'UPS',
      trackingNumber: 'UPS1234567890',
      daysAgo: 1,
      items: [
        { variantSku: 'SKU-DELL-XPS-15', quantity: 20 },
        { variantSku: 'SKU-LEN-THINK-X1', quantity: 15 },
      ]
    },
    { 
      number: 'TRF-SEED-004', 
      fromId: 'wh-main-001', 
      toId: 'wh-store-002', 
      status: TransferStatus.PENDING,
      daysAgo: 0,
      items: [
        { variantSku: 'SKU-IPAD-PRO-12', quantity: 5 },
        { variantSku: 'SKU-MAGIC-KB-ESP', quantity: 8 },
      ]
    },
  ];

  for (const t of transfers) {
    const transfer = await prisma.transfer.create({
      data: {
        number: t.number,
        clientTenantId: tid,
        fromId: t.fromId,
        toId: t.toId,
        status: t.status,
        carrier: t.carrier || null,
        trackingNumber: t.trackingNumber || null,
        date: new Date(Date.now() - t.daysAgo * 86400000),
      }
    });

    for (const item of t.items) {
      const variant = await prisma.productVariant.findUnique({ where: { sku: item.variantSku } });
      if (variant) {
        await prisma.transferItem.create({
          data: {
            transferId: transfer.id,
            variantId: variant.id,
            quantity: item.quantity,
          }
        });
      }
    }
  }

  // 8. Inventory Adjustments
  console.log('⚖️ Creating inventory adjustments...');
  await prisma.inventoryAdjustment.deleteMany({ where: { clientTenantId: tid, number: { startsWith: 'ADJ-SEED' } } });

  const adjustments = [
    {
      number: 'ADJ-SEED-001',
      warehouseId: 'wh-main-001',
      reason: AdjustmentReason.DISCREPANCY,
      notes: 'Ajuste por conteo físico mensual',
      status: 'APPROVED',
      daysAgo: 15,
      items: [
        { productCode: 'AIRPODS-PRO-2', currentStock: 155, actualStock: 150 },
      ]
    },
    {
      number: 'ADJ-SEED-002',
      warehouseId: 'wh-store-003',
      reason: AdjustmentReason.DAMAGE,
      notes: 'Producto dañado en exhibición',
      status: 'APPROVED',
      daysAgo: 7,
      items: [
        { productCode: 'IPAD-PRO-12', currentStock: 10, actualStock: 8 },
      ]
    },
    {
      number: 'ADJ-SEED-003',
      warehouseId: 'wh-main-001',
      reason: AdjustmentReason.OTHER,
      notes: 'Auditoría de fin de mes pendiente',
      status: 'DRAFT',
      daysAgo: 0,
      items: [
        { productCode: 'SSD-SAMS-2TB', currentStock: 100, actualStock: 98 },
        { productCode: 'HDD-SEA-8TB', currentStock: 50, actualStock: 48 },
      ]
    },
  ];

  for (const adj of adjustments) {
    const adjustment = await prisma.inventoryAdjustment.create({
      data: {
        number: adj.number,
        clientTenantId: tid,
        warehouseId: adj.warehouseId,
        reason: adj.reason,
        notes: adj.notes,
        status: adj.status as any,
        date: new Date(Date.now() - adj.daysAgo * 86400000),
      }
    });

    for (const item of adj.items) {
      const productId = productMap.get(item.productCode);
      if (!productId) continue;
      
      const variantSku = `SKU-${item.productCode}`;
      const variant = await prisma.productVariant.findUnique({ where: { sku: variantSku } });
      
      await prisma.inventoryAdjustmentItem.create({
        data: {
          adjustmentId: adjustment.id,
          productId: productId,
          variantId: variant?.id,
          currentStock: item.currentStock,
          actualStock: item.actualStock,
        }
      });
    }
  }

  // 9. Product Lots (for batch tracking)
  console.log('📦 Creating product lots...');
  const lots = [
    { productCode: 'AIRPODS-PRO-2', number: 'LOT-AP-2024-001', expirationDate: null, manufactureDate: new Date('2024-01-15') },
    { productCode: 'AIRPODS-PRO-2', number: 'LOT-AP-2024-002', expirationDate: null, manufactureDate: new Date('2024-02-20') },
    { productCode: 'SSD-SAMS-2TB', number: 'LOT-SSD-2024-001', expirationDate: null, manufactureDate: new Date('2024-03-01') },
    { productCode: 'MAGIC-KB-ESP', number: 'LOT-MK-2024-001', expirationDate: null, manufactureDate: new Date('2024-02-10') },
  ];

  for (const lot of lots) {
    const productId = productMap.get(lot.productCode);
    if (!productId) continue;
    
    const existingLot = await prisma.productLot.findFirst({ where: { number: lot.number, clientTenantId: tid } });
    if (!existingLot) {
      await prisma.productLot.create({
        data: {
          clientTenantId: tid,
          productId: productId,
          number: lot.number,
          expirationDate: lot.expirationDate,
          manufactureDate: lot.manufactureDate,
        }
      });
    }
  }

  // 10. Product Series (for serial tracking)
  console.log('🔢 Creating product series...');
  const seriesData = [
    { productCode: 'MAC-M3-14', numbers: ['SN-MAC-001-A1B2C3', 'SN-MAC-001-D4E5F6', 'SN-MAC-001-G7H8I9'] },
    { productCode: 'IPH-15-PRO', numbers: ['SN-IPH15-ABCD1234', 'SN-IPH15-EFGH5678', 'SN-IPH15-IJKL9012'] },
    { productCode: 'AIRPODS-MAX', numbers: ['SN-APM-001-XYZ', 'SN-APM-002-XYZ', 'SN-APM-003-XYZ'] },
  ];

  for (const s of seriesData) {
    const productId = productMap.get(s.productCode);
    if (!productId) continue;
    
    for (const num of s.numbers) {
      const existingSeries = await prisma.productSeries.findUnique({ where: { number: num } });
      if (!existingSeries) {
        await prisma.productSeries.create({
          data: {
            clientTenantId: tid,
            productId: productId,
            number: num,
          }
        });
      }
    }
  }

  console.log('✨ Complete Inventory Seed Finished Successfully!');
  console.log('📊 Summary:');
  console.log(`   - ${categories.length} categories`);
  console.log(`   - ${warehouses.length} warehouses`);
  console.log(`   - ${products.length} products`);
  console.log(`   - ${stockLevels.length} stock levels`);
  console.log(`   - ${movements.length} movements`);
  console.log(`   - ${transfers.length} transfers`);
  console.log(`   - ${adjustments.length} adjustments`);
}

main().catch(e => {
  console.error('❌ Error seeding inventory:', e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});

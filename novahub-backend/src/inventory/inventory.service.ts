import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  // ==================== PRODUCTS ====================
  async createProduct(data: any, clientTenantId: string) {
    const { initialStock, ...productData } = data;
    const count = await this.prisma.product.count({ where: { clientTenantId } });
    const code = productData.code || `SKU-${String(count + 1).padStart(5, '0')}`;
    
    // Create product
    const product = await this.prisma.product.create({
      data: { 
        ...productData, 
        code,
        clientTenantId,
        taxRate: productData.taxRate || 0.15,
        costPrice: productData.costPrice || 0,
        salePrice: productData.salePrice || 0,
      },
      include: { category: true },
    });

    // Create a default variant for the product
    const variant = await this.prisma.productVariant.create({
      data: {
        productId: product.id,
        sku: product.code, // Same as product code for the default variant
        name: 'Estándar', // Default name
      }
    });

    if (initialStock > 0) {
      // Find the first active warehouse to assign initial stock
      const warehouse = await this.prisma.warehouse.findFirst({
        where: { clientTenantId, isActive: true },
        orderBy: { createdAt: 'asc' },
      });

      if (warehouse) {
        await this.prisma.inventoryLevel.create({
          data: {
            clientTenantId,
            productId: product.id,
            warehouseId: warehouse.id,
            variantId: variant.id,
            quantity: initialStock,
            minStock: 0,
          },
        });

        // Also create an initial movement for history
        await this.prisma.inventoryMovement.create({
          data: {
            clientTenantId,
            productId: product.id,
            warehouseId: warehouse.id,
            variantId: variant.id,
            type: 'IN',
            quantity: initialStock,
            reference: 'Stock inicial al crear producto',
          },
        });
      }
    }

    return product;
  }

  async findAllProducts(clientTenantId: string, filters?: { search?: string; categoryId?: string }) {
    const where: Prisma.ProductWhereInput = { clientTenantId };
    
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { code: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    if (filters?.categoryId) {
      where.categoryId = filters.categoryId;
    }

    const products = await this.prisma.product.findMany({
      where,
      include: { 
        category: true,
        stockLevels: {
          include: { warehouse: true }
        }
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      data: products.map(p => ({
        ...p,
        stock: p.stockLevels.reduce((acc, sl) => acc + Number(sl.quantity), 0),
      })),
      total: products.length,
    };
  }

  async findOneProduct(id: string, clientTenantId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, clientTenantId },
      include: { 
        category: true, 
        stockLevels: { include: { warehouse: true } },
        variants: true,
        lots: true,
        series: true,
      },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');
    return product;
  }

  async updateProduct(id: string, data: any, clientTenantId: string) {
    return this.prisma.product.update({ 
      where: { id, clientTenantId }, 
      data,
      include: { category: true },
    });
  }

  async removeProduct(id: string, clientTenantId: string) {
    return this.prisma.product.update({ 
      where: { id, clientTenantId }, 
      data: { isActive: false },
    });
  }

  // ==================== CATEGORIES ====================
  async findAllCategories(clientTenantId: string) {
    return this.prisma.category.findMany({
      where: { clientTenantId },
      include: { products: { select: { id: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async createCategory(data: any, clientTenantId: string) {
    return this.prisma.category.create({
      data: { ...data, clientTenantId },
    });
  }

  async updateCategory(id: string, data: any, clientTenantId: string) {
    return this.prisma.category.update({
      where: { id, clientTenantId },
      data,
    });
  }

  async removeCategory(id: string, clientTenantId: string) {
    const hasProducts = await this.prisma.product.count({ where: { categoryId: id } });
    if (hasProducts > 0) {
      throw new BadRequestException('No se puede eliminar una categoría con productos asociados');
    }
    return this.prisma.category.delete({ where: { id, clientTenantId } });
  }

  // ==================== WAREHOUSES ====================
  async createWarehouse(data: any, clientTenantId: string) {
    return this.prisma.warehouse.create({
      data: { ...data, clientTenantId },
      include: { parent: true, responsible: true },
    });
  }

  async findAllWarehouses(clientTenantId: string) {
    return this.prisma.warehouse.findMany({
      where: { clientTenantId, isActive: true },
      include: { 
        parent: true, 
        children: true, 
        responsible: true,
        stockLevels: { select: { id: true, quantity: true } },
      },
    });
  }

  async findOneWarehouse(id: string, clientTenantId: string) {
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id, clientTenantId },
      include: { 
        parent: true, 
        children: true, 
        responsible: true,
        stockLevels: { include: { product: true, variant: true } },
      },
    });
    if (!warehouse) throw new NotFoundException('Almacén no encontrado');
    return warehouse;
  }

  async updateWarehouse(id: string, data: any, clientTenantId: string) {
    return this.prisma.warehouse.update({
      where: { id, clientTenantId },
      data,
      include: { parent: true, responsible: true },
    });
  }

  async removeWarehouse(id: string, clientTenantId: string) {
    const hasStock = await this.prisma.inventoryLevel.count({ 
      where: { warehouseId: id, quantity: { gt: 0 } } 
    });
    if (hasStock > 0) {
      throw new BadRequestException('No se puede eliminar un almacén con stock');
    }
    return this.prisma.warehouse.update({ 
      where: { id, clientTenantId }, 
      data: { isActive: false },
    });
  }

  // ==================== STOCK LEVELS ====================
  async getAllStockLevels(clientTenantId: string) {
    return this.prisma.inventoryLevel.findMany({
      where: { clientTenantId },
      include: { 
        product: true, 
        warehouse: true, 
        variant: true,
        lot: true,
        series: true,
      },
    });
  }

  async getStockByWarehouse(warehouseId: string, clientTenantId: string) {
    return this.prisma.inventoryLevel.findMany({
      where: { warehouseId, clientTenantId },
      include: { product: true, variant: true, lot: true, series: true },
    });
  }

  async updateStockLevel(data: any, clientTenantId: string) {
    const { productId, warehouseId, variantId, quantity, minStock, maxStock } = data;
    
    const existing = await this.prisma.inventoryLevel.findFirst({
      where: { productId, warehouseId, variantId, clientTenantId },
    });

    if (existing) {
      return this.prisma.inventoryLevel.update({
        where: { id: existing.id },
        data: { quantity, minStock, maxStock },
      });
    } else {
      return this.prisma.inventoryLevel.create({
        data: {
          clientTenantId,
          productId,
          warehouseId,
          variantId,
          quantity,
          minStock: minStock || 0,
          maxStock,
        },
      });
    }
  }

  // ==================== LOTS ====================
  async findAllLots(clientTenantId: string) {
    return this.prisma.productLot.findMany({
      where: { clientTenantId },
      include: { product: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createLot(data: any, clientTenantId: string) {
    return this.prisma.productLot.create({
      data: { ...data, clientTenantId },
      include: { product: true },
    });
  }

  async removeLot(id: string, clientTenantId: string) {
    return this.prisma.productLot.delete({ where: { id, clientTenantId } });
  }

  // ==================== SERIES ====================
  async findAllSeries(clientTenantId: string) {
    return this.prisma.productSeries.findMany({
      where: { clientTenantId },
      include: { product: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createSeries(data: any, clientTenantId: string) {
    return this.prisma.productSeries.create({
      data: { ...data, clientTenantId },
      include: { product: true },
    });
  }

  async removeSeries(id: string, clientTenantId: string) {
    return this.prisma.productSeries.delete({ where: { id, clientTenantId } });
  }

  // ==================== ADJUSTMENTS ====================
  async findAllAdjustments(clientTenantId: string) {
    return this.prisma.inventoryAdjustment.findMany({
      where: { clientTenantId },
      include: { warehouse: true, items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneAdjustment(id: string, clientTenantId: string) {
    const adjustment = await this.prisma.inventoryAdjustment.findFirst({
      where: { id, clientTenantId },
      include: { warehouse: true, items: { include: { product: true, variant: true } } },
    });
    if (!adjustment) throw new NotFoundException('Ajuste no encontrado');
    return adjustment;
  }

  async createAdjustment(data: any, clientTenantId: string) {
    const { items, ...adjData } = data;
    const count = await this.prisma.inventoryAdjustment.count({ where: { clientTenantId } });
    const number = `ADJ-${String(count + 1).padStart(5, '0')}`;

    return this.prisma.inventoryAdjustment.create({
      data: {
        ...adjData,
        number,
        date: new Date(),
        clientTenantId,
        items: {
          create: items.map((item: any) => ({
            productId: item.productId,
            variantId: item.variantId,
            currentStock: item.currentStock || 0,
            actualStock: item.actualStock,
          })),
        },
      },
      include: { items: true, warehouse: true },
    });
  }

  async approveAdjustment(id: string, clientTenantId: string) {
    const adjustment = await this.prisma.inventoryAdjustment.findFirst({
      where: { id, clientTenantId },
      include: { items: true },
    });
    if (!adjustment) throw new NotFoundException('Ajuste no encontrado');

    // Apply stock changes
    for (const item of adjustment.items) {
      const diff = Number(item.actualStock) - Number(item.currentStock);
      const movementType = diff > 0 ? 'IN' : 'OUT';

      await this.prisma.inventoryMovement.create({
        data: {
          clientTenantId,
          productId: item.productId,
          variantId: item.variantId,
          warehouseId: adjustment.warehouseId,
          type: movementType,
          quantity: Math.abs(diff),
          reference: `Ajuste ${adjustment.number}`,
        },
      });
    }

    return this.prisma.inventoryAdjustment.update({
      where: { id },
      data: { status: 'APPROVED' },
      include: { items: true, warehouse: true },
    });
  }

  // ==================== TRANSFERS ====================
  async findAllTransfers(clientTenantId: string) {
    return this.prisma.transfer.findMany({
      where: { clientTenantId },
      include: {
        from: true,
        to: true,
        items: {
          include: { variant: { include: { product: true } } },
        },
      },
      orderBy: { date: 'desc' },
    });
  }

  async findOneTransfer(id: string, clientTenantId: string) {
    const transfer = await this.prisma.transfer.findFirst({
      where: { id, clientTenantId },
      include: {
        from: true,
        to: true,
        items: { include: { variant: { include: { product: true } } } },
      },
    });
    if (!transfer) throw new NotFoundException('Transferencia no encontrada');
    return transfer;
  }

  async createTransfer(data: any, clientTenantId: string) {
    const { items, ...transferData } = data;
    const count = await this.prisma.transfer.count({ where: { clientTenantId } });
    const number = `TRF-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    return this.prisma.transfer.create({
      data: {
        ...transferData,
        number,
        date: new Date(),
        clientTenantId,
        items: {
          create: items.map((item: any) => ({
            variantId: item.variantId,
            quantity: item.quantity,
          })),
        },
      },
      include: { items: true, from: true, to: true },
    });
  }

  async updateTransferStatus(id: string, status: string, clientTenantId: string) {
    const transfer = await this.prisma.transfer.findFirst({
      where: { id, clientTenantId },
      include: { items: true },
    });
    if (!transfer) throw new NotFoundException('Transferencia no encontrada');

    // If completing transfer, create movements
    if (status === 'COMPLETED') {
      for (const item of transfer.items) {
        // OUT from origin
        await this.prisma.inventoryMovement.create({
          data: {
            clientTenantId,
            productId: (await this.prisma.productVariant.findUnique({ where: { id: item.variantId } }))?.productId || '',
            variantId: item.variantId,
            warehouseId: transfer.fromId,
            type: 'OUT',
            quantity: item.quantity,
            reference: `Transferencia ${transfer.number}`,
          },
        });
        // IN to destination
        await this.prisma.inventoryMovement.create({
          data: {
            clientTenantId,
            productId: (await this.prisma.productVariant.findUnique({ where: { id: item.variantId } }))?.productId || '',
            variantId: item.variantId,
            warehouseId: transfer.toId,
            type: 'IN',
            quantity: item.quantity,
            reference: `Transferencia ${transfer.number}`,
          },
        });
      }
    }

    return this.prisma.transfer.update({
      where: { id },
      data: { status: status as any },
      include: { items: true, from: true, to: true },
    });
  }

  // ==================== MOVEMENTS ====================
  async findAllMovements(clientTenantId: string, filters?: { type?: string; warehouseId?: string; limit?: number }) {
    const where: Prisma.InventoryMovementWhereInput = { clientTenantId };
    
    if (filters?.type) where.type = filters.type as any;
    if (filters?.warehouseId) where.warehouseId = filters.warehouseId;

    return this.prisma.inventoryMovement.findMany({
      where,
      include: {
        product: true,
        warehouse: true,
        variant: true,
      },
      orderBy: { date: 'desc' },
      take: filters?.limit || 100,
    });
  }

  async createMovement(data: any, clientTenantId: string) {
    return this.prisma.inventoryMovement.create({
      data: {
        ...data,
        clientTenantId,
        date: new Date(),
      },
      include: { product: true, warehouse: true },
    });
  }

  // ==================== DASHBOARD / STATS ====================
  async getDashboardStats(clientTenantId: string) {
    const [products, warehouses, movements, lowStockCount] = await Promise.all([
      this.prisma.product.findMany({
        where: { clientTenantId, isActive: true },
        include: { stockLevels: true },
      }),
      this.prisma.warehouse.count({ where: { clientTenantId, isActive: true } }),
      this.prisma.inventoryMovement.count({ 
        where: { 
          clientTenantId,
          date: { gte: new Date(new Date().setDate(new Date().getDate() - 30)) }
        } 
      }),
      this.prisma.inventoryLevel.count({
        where: {
          clientTenantId,
          quantity: { lte: this.prisma.inventoryLevel.fields.minStock as any },
        },
      }),
    ]);

    const totalStock = products.reduce((acc, p) => 
      acc + p.stockLevels.reduce((sum, sl) => sum + Number(sl.quantity), 0), 0
    );

    const inventoryValue = products.reduce((acc, p) => {
      const stock = p.stockLevels.reduce((sum, sl) => sum + Number(sl.quantity), 0);
      return acc + (stock * Number(p.costPrice || 0));
    }, 0);

    return {
      totalSkus: products.length,
      totalStock,
      inventoryValue,
      warehousesActive: warehouses,
      movementsThisMonth: movements,
      lowStockAlerts: lowStockCount,
    };
  }

  async getLowStockProducts(clientTenantId: string) {
    const levels = await this.prisma.inventoryLevel.findMany({
      where: { clientTenantId },
      include: { product: true, warehouse: true },
    });

    return levels.filter(l => Number(l.quantity) <= Number(l.minStock)).map(l => ({
      product: l.product,
      warehouse: l.warehouse,
      currentStock: l.quantity,
      minStock: l.minStock,
      deficit: Number(l.minStock) - Number(l.quantity),
    }));
  }
}

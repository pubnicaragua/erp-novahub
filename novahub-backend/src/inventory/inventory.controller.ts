import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request, Query } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { CreateProductDto, UpdateProductDto, CreateCategoryDto, CreateWarehouseDto, CreateLotDto, CreateSeriesDto, CreateAdjustmentDto } from './dto/inventory.dto';

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  // ==================== PRODUCTS ====================
  @Post('products')
  @ApiOperation({ summary: 'Crear nuevo producto' })
  createProduct(@Body() data: CreateProductDto, @Request() req) {
    return this.inventoryService.createProduct(data, req.user.clientTenantId);
  }

  @Get('products')
  @ApiOperation({ summary: 'Listar productos del catálogo' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'categoryId', required: false })
  findAllProducts(
    @Request() req,
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string
  ) {
    return this.inventoryService.findAllProducts(req.user.clientTenantId, { search, categoryId });
  }

  @Get('products/:id')
  @ApiOperation({ summary: 'Obtener producto por ID' })
  findOneProduct(@Param('id') id: string, @Request() req) {
    return this.inventoryService.findOneProduct(id, req.user.clientTenantId);
  }

  @Patch('products/:id')
  @ApiOperation({ summary: 'Actualizar producto' })
  updateProduct(@Param('id') id: string, @Body() data: UpdateProductDto, @Request() req) {
    return this.inventoryService.updateProduct(id, data, req.user.clientTenantId);
  }

  @Delete('products/:id')
  @ApiOperation({ summary: 'Eliminar producto' })
  removeProduct(@Param('id') id: string, @Request() req) {
    return this.inventoryService.removeProduct(id, req.user.clientTenantId);
  }

  // ==================== CATEGORIES ====================
  @Get('categories')
  @ApiOperation({ summary: 'Listar categorías de productos' })
  findAllCategories(@Request() req) {
    return this.inventoryService.findAllCategories(req.user.clientTenantId);
  }

  @Post('categories')
  @ApiOperation({ summary: 'Crear nueva categoría' })
  createCategory(@Body() data: CreateCategoryDto, @Request() req) {
    return this.inventoryService.createCategory(data, req.user.clientTenantId);
  }

  @Patch('categories/:id')
  @ApiOperation({ summary: 'Actualizar categoría' })
  updateCategory(@Param('id') id: string, @Body() data: CreateCategoryDto, @Request() req) {
    return this.inventoryService.updateCategory(id, data, req.user.clientTenantId);
  }

  @Delete('categories/:id')
  @ApiOperation({ summary: 'Eliminar categoría' })
  removeCategory(@Param('id') id: string, @Request() req) {
    return this.inventoryService.removeCategory(id, req.user.clientTenantId);
  }

  // ==================== WAREHOUSES ====================
  @Post('warehouses')
  @ApiOperation({ summary: 'Crear nuevo almacén' })
  createWarehouse(@Body() data: CreateWarehouseDto, @Request() req) {
    return this.inventoryService.createWarehouse(data, req.user.clientTenantId);
  }

  @Get('warehouses')
  @ApiOperation({ summary: 'Listar almacenes' })
  findAllWarehouses(@Request() req) {
    return this.inventoryService.findAllWarehouses(req.user.clientTenantId);
  }

  @Get('warehouses/:id')
  @ApiOperation({ summary: 'Obtener almacén por ID' })
  findOneWarehouse(@Param('id') id: string, @Request() req) {
    return this.inventoryService.findOneWarehouse(id, req.user.clientTenantId);
  }

  @Patch('warehouses/:id')
  @ApiOperation({ summary: 'Actualizar almacén' })
  updateWarehouse(@Param('id') id: string, @Body() data: CreateWarehouseDto, @Request() req) {
    return this.inventoryService.updateWarehouse(id, data, req.user.clientTenantId);
  }

  @Delete('warehouses/:id')
  @ApiOperation({ summary: 'Eliminar almacén' })
  removeWarehouse(@Param('id') id: string, @Request() req) {
    return this.inventoryService.removeWarehouse(id, req.user.clientTenantId);
  }

  // ==================== STOCK LEVELS ====================
  @Get('stock')
  @ApiOperation({ summary: 'Ver niveles de stock general' })
  getAllStock(@Request() req) {
    return this.inventoryService.getAllStockLevels(req.user.clientTenantId);
  }

  @Get('stock/:warehouseId')
  @ApiOperation({ summary: 'Ver stock por almacén' })
  getStock(@Param('warehouseId') warehouseId: string, @Request() req) {
    return this.inventoryService.getStockByWarehouse(warehouseId, req.user.clientTenantId);
  }

  @Post('stock/update')
  @ApiOperation({ summary: 'Actualizar nivel de stock' })
  updateStockLevel(@Body() data: any, @Request() req) {
    return this.inventoryService.updateStockLevel(data, req.user.clientTenantId);
  }

  // ==================== LOTS ====================
  @Get('lots')
  @ApiOperation({ summary: 'Listar lotes de productos' })
  findAllLots(@Request() req) {
    return this.inventoryService.findAllLots(req.user.clientTenantId);
  }

  @Post('lots')
  @ApiOperation({ summary: 'Crear nuevo lote' })
  createLot(@Body() data: CreateLotDto, @Request() req) {
    return this.inventoryService.createLot(data, req.user.clientTenantId);
  }

  @Delete('lots/:id')
  @ApiOperation({ summary: 'Eliminar lote' })
  removeLot(@Param('id') id: string, @Request() req) {
    return this.inventoryService.removeLot(id, req.user.clientTenantId);
  }

  // ==================== SERIES ====================
  @Get('series')
  @ApiOperation({ summary: 'Listar series de productos' })
  findAllSeries(@Request() req) {
    return this.inventoryService.findAllSeries(req.user.clientTenantId);
  }

  @Post('series')
  @ApiOperation({ summary: 'Crear nueva serie' })
  createSeries(@Body() data: CreateSeriesDto, @Request() req) {
    return this.inventoryService.createSeries(data, req.user.clientTenantId);
  }

  @Delete('series/:id')
  @ApiOperation({ summary: 'Eliminar serie' })
  removeSeries(@Param('id') id: string, @Request() req) {
    return this.inventoryService.removeSeries(id, req.user.clientTenantId);
  }

  // ==================== ADJUSTMENTS ====================
  @Get('adjustments')
  @ApiOperation({ summary: 'Listar ajustes de inventario' })
  findAllAdjustments(@Request() req) {
    return this.inventoryService.findAllAdjustments(req.user.clientTenantId);
  }

  @Get('adjustments/:id')
  @ApiOperation({ summary: 'Obtener ajuste por ID' })
  findOneAdjustment(@Param('id') id: string, @Request() req) {
    return this.inventoryService.findOneAdjustment(id, req.user.clientTenantId);
  }

  @Post('adjustments')
  @ApiOperation({ summary: 'Crear ajuste de inventario' })
  createAdjustment(@Body() data: CreateAdjustmentDto, @Request() req) {
    return this.inventoryService.createAdjustment(data, req.user.clientTenantId);
  }

  @Patch('adjustments/:id/approve')
  @ApiOperation({ summary: 'Aprobar ajuste de inventario' })
  approveAdjustment(@Param('id') id: string, @Request() req) {
    return this.inventoryService.approveAdjustment(id, req.user.clientTenantId);
  }

  // ==================== TRANSFERS ====================
  @Post('transfers')
  @ApiOperation({ summary: 'Crear transferencia de inventario' })
  createTransfer(@Body() data: any, @Request() req) {
    return this.inventoryService.createTransfer(data, req.user.clientTenantId);
  }

  @Get('transfers')
  @ApiOperation({ summary: 'Listar transferencias' })
  findAllTransfers(@Request() req) {
    return this.inventoryService.findAllTransfers(req.user.clientTenantId);
  }

  @Get('transfers/:id')
  @ApiOperation({ summary: 'Obtener transferencia por ID' })
  findOneTransfer(@Param('id') id: string, @Request() req) {
    return this.inventoryService.findOneTransfer(id, req.user.clientTenantId);
  }

  @Patch('transfers/:id/status')
  @ApiOperation({ summary: 'Actualizar estado de transferencia' })
  updateTransferStatus(@Param('id') id: string, @Body() data: { status: string }, @Request() req) {
    return this.inventoryService.updateTransferStatus(id, data.status, req.user.clientTenantId);
  }

  // ==================== MOVEMENTS ====================
  @Get('movements')
  @ApiOperation({ summary: 'Listar movimientos de inventario' })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'warehouseId', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findAllMovements(
    @Request() req,
    @Query('type') type?: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('limit') limit?: string
  ) {
    return this.inventoryService.findAllMovements(req.user.clientTenantId, { type, warehouseId, limit: limit ? parseInt(limit) : 100 });
  }

  @Post('movements')
  @ApiOperation({ summary: 'Registrar movimiento manual' })
  createMovement(@Body() data: any, @Request() req) {
    return this.inventoryService.createMovement(data, req.user.clientTenantId);
  }

  // ==================== DASHBOARD / STATS ====================
  @Get('dashboard/stats')
  @ApiOperation({ summary: 'Obtener estadísticas del dashboard' })
  getDashboardStats(@Request() req) {
    return this.inventoryService.getDashboardStats(req.user.clientTenantId);
  }

  @Get('dashboard/low-stock')
  @ApiOperation({ summary: 'Productos con stock bajo' })
  getLowStockProducts(@Request() req) {
    return this.inventoryService.getLowStockProducts(req.user.clientTenantId);
  }
}

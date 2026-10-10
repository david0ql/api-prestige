import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { RequireAnyPermission, RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission as P } from '../../common/enums/permission.enum';
import {
  CreateCustomerDto, CreateFinanceCategoryDto, CreateLaborRateDto, CreateLocationDto,
  CreateMaterialCategoryDto, CreateMaterialDto, CreatePaymentMethodDto, CreateProductDto,
  CreateProductFamilyDto, CreateStageDto, CreateStandardDto, CreateUnitDto, CreateVariableDto,
  CreateVariantDto, CreateWorkshopDto, MasterQueryDto, UpdateCustomerDto, UpdateFinanceCategoryDto,
  UpdateLaborRateDto, UpdateLocationDto, UpdateMaterialCategoryDto, UpdateMaterialDto,
  UpdateParameterDto, UpdatePaymentMethodDto, UpdateProductDto, UpdateProductFamilyDto,
  UpdateStageDto, UpdateStandardDto, UpdateUnitDto, UpdateVariableDto, UpdateVariantDto,
  UpdateWorkshopDto,
} from './dto/masters.dto';
import { MastersService } from './masters.service';
import { ParametersService } from './parameters.service';

class ProductQueryDto extends MasterQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() familyId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() workshopId?: string;
}

class LaborRateQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() workshopId?: string;
}

/** Lectura de catálogos básicos: oficina y portal de taller (para consumos/solicitudes). */
const READ = [P.MASTERS_READ, P.WORKSHOP_PORTAL] as const;

@ApiTags('Maestros y parametrización')
@Controller()
export class MastersController {
  constructor(
    private readonly s: MastersService,
    private readonly params: ParametersService,
  ) {}

  // Unidades
  @Get('units') @RequireAnyPermission(...READ) units() { return this.s.listUnits(); }
  @Post('units') @RequirePermissions(P.MASTERS_MANAGE) createUnit(@Body() d: CreateUnitDto) { return this.s.createUnit(d); }
  @Patch('units/:id') @RequirePermissions(P.MASTERS_MANAGE) updateUnit(@Param('id', ParseUUIDPipe) id: string, @Body() d: UpdateUnitDto) { return this.s.updateUnit(id, d); }

  // Categorías de material
  @Get('material-categories') @RequireAnyPermission(...READ) categories() { return this.s.listCategories(); }
  @Post('material-categories') @RequirePermissions(P.MASTERS_MANAGE) createCategory(@Body() d: CreateMaterialCategoryDto) { return this.s.createCategory(d); }
  @Patch('material-categories/:id') @RequirePermissions(P.MASTERS_MANAGE) updateCategory(@Param('id', ParseUUIDPipe) id: string, @Body() d: UpdateMaterialCategoryDto) { return this.s.updateCategory(id, d); }

  // Materiales
  @Get('materials') @RequireAnyPermission(...READ) materials(@Query() q: MasterQueryDto) { return this.s.listMaterials(q); }
  @Get('materials/:id') @RequireAnyPermission(...READ) material(@Param('id', ParseUUIDPipe) id: string) { return this.s.getMaterial(id); }
  @Post('materials') @RequirePermissions(P.MASTERS_MANAGE) createMaterial(@Body() d: CreateMaterialDto) { return this.s.createMaterial(d); }
  @Patch('materials/:id') @RequirePermissions(P.MASTERS_MANAGE) updateMaterial(@Param('id', ParseUUIDPipe) id: string, @Body() d: UpdateMaterialDto) { return this.s.updateMaterial(id, d); }

  // Talleres
  @Get('workshops') @RequirePermissions(P.MASTERS_READ) workshops(@Query() q: MasterQueryDto) { return this.s.listWorkshops(q); }
  @Get('workshops/:id') @RequirePermissions(P.MASTERS_READ) workshop(@Param('id', ParseUUIDPipe) id: string) { return this.s.getWorkshop(id); }
  @Post('workshops') @RequirePermissions(P.MASTERS_MANAGE) createWorkshop(@Body() d: CreateWorkshopDto) { return this.s.createWorkshop(d); }
  @Patch('workshops/:id') @RequirePermissions(P.MASTERS_MANAGE) updateWorkshop(@Param('id', ParseUUIDPipe) id: string, @Body() d: UpdateWorkshopDto) { return this.s.updateWorkshop(id, d); }

  // Ubicaciones
  @Get('locations') @RequirePermissions(P.MASTERS_READ) locations() { return this.s.listLocations(); }
  @Post('locations') @RequirePermissions(P.MASTERS_MANAGE) createLocation(@Body() d: CreateLocationDto) { return this.s.createLocation(d); }
  @Patch('locations/:id') @RequirePermissions(P.MASTERS_MANAGE) updateLocation(@Param('id', ParseUUIDPipe) id: string, @Body() d: UpdateLocationDto) { return this.s.updateLocation(id, d); }

  // Clientes
  @Get('customers') @RequirePermissions(P.CUSTOMERS_READ) customers(@Query() q: MasterQueryDto) { return this.s.listCustomers(q); }
  @Get('customers/:id') @RequirePermissions(P.CUSTOMERS_READ) customer(@Param('id', ParseUUIDPipe) id: string) { return this.s.getCustomer(id); }
  @Post('customers') @RequirePermissions(P.CUSTOMERS_MANAGE) createCustomer(@Body() d: CreateCustomerDto) { return this.s.createCustomer(d); }
  @Patch('customers/:id') @RequirePermissions(P.CUSTOMERS_MANAGE) updateCustomer(@Param('id', ParseUUIDPipe) id: string, @Body() d: UpdateCustomerDto) { return this.s.updateCustomer(id, d); }

  // Familias
  @Get('product-families') @RequireAnyPermission(...READ, P.CATALOG_READ) families() { return this.s.listFamilies(); }
  @Post('product-families') @RequirePermissions(P.MASTERS_MANAGE) createFamily(@Body() d: CreateProductFamilyDto) { return this.s.createFamily(d); }
  @Patch('product-families/:id') @RequirePermissions(P.MASTERS_MANAGE) updateFamily(@Param('id', ParseUUIDPipe) id: string, @Body() d: UpdateProductFamilyDto) { return this.s.updateFamily(id, d); }

  // Productos, variantes y estándares
  @Get('products') @RequireAnyPermission(P.MASTERS_READ, P.CATALOG_READ) products(@Query() q: ProductQueryDto) { return this.s.listProducts(q); }
  @Get('products/:id') @RequireAnyPermission(P.MASTERS_READ, P.CATALOG_READ) product(@Param('id', ParseUUIDPipe) id: string) { return this.s.getProduct(id); }
  @Post('products') @RequirePermissions(P.MASTERS_MANAGE) createProduct(@Body() d: CreateProductDto) { return this.s.createProduct(d); }
  @Patch('products/:id') @RequirePermissions(P.MASTERS_MANAGE) updateProduct(@Param('id', ParseUUIDPipe) id: string, @Body() d: UpdateProductDto) { return this.s.updateProduct(id, d); }
  @Post('products/:id/variants') @RequirePermissions(P.MASTERS_MANAGE) createVariant(@Param('id', ParseUUIDPipe) id: string, @Body() d: CreateVariantDto) { return this.s.createVariant(id, d); }
  @Patch('products/:id/variants/:variantId') @RequirePermissions(P.MASTERS_MANAGE) updateVariant(@Param('id', ParseUUIDPipe) id: string, @Param('variantId', ParseUUIDPipe) vid: string, @Body() d: UpdateVariantDto) { return this.s.updateVariant(id, vid, d); }
  @Get('products/:id/standards') @RequirePermissions(P.MASTERS_READ) standards(@Param('id', ParseUUIDPipe) id: string) { return this.s.listStandards(id); }
  @Post('products/:id/standards') @RequirePermissions(P.MASTERS_MANAGE) createStandard(@Param('id', ParseUUIDPipe) id: string, @Body() d: CreateStandardDto) { return this.s.createStandard(id, d); }
  @Patch('products/:id/standards/:standardId') @RequirePermissions(P.MASTERS_MANAGE) updateStandard(@Param('id', ParseUUIDPipe) id: string, @Param('standardId', ParseUUIDPipe) sid: string, @Body() d: UpdateStandardDto) { return this.s.updateStandard(id, sid, d); }

  // Tarifas de mano de obra
  @Get('labor-rates') @RequirePermissions(P.MASTERS_READ) laborRates(@Query() q: LaborRateQueryDto) { return this.s.listLaborRates(q.workshopId); }
  @Post('labor-rates') @RequirePermissions(P.MASTERS_MANAGE) createLaborRate(@Body() d: CreateLaborRateDto) { return this.s.createLaborRate(d); }
  @Patch('labor-rates/:id') @RequirePermissions(P.MASTERS_MANAGE) updateLaborRate(@Param('id', ParseUUIDPipe) id: string, @Body() d: UpdateLaborRateDto) { return this.s.updateLaborRate(id, d); }

  // Etapas de producción
  @Get('production-stages') @RequireAnyPermission(...READ, P.ORDERS_READ) stages() { return this.s.listStages(); }
  @Post('production-stages') @RequirePermissions(P.MASTERS_MANAGE) createStage(@Body() d: CreateStageDto) { return this.s.createStage(d); }
  @Patch('production-stages/:id') @RequirePermissions(P.MASTERS_MANAGE) updateStage(@Param('id', ParseUUIDPipe) id: string, @Body() d: UpdateStageDto) { return this.s.updateStage(id, d); }

  // Variables técnicas
  @Get('technical-variables') @RequireAnyPermission(...READ, P.CATALOG_READ) variables() { return this.s.listVariables(); }
  @Post('technical-variables') @RequirePermissions(P.MASTERS_MANAGE) createVariable(@Body() d: CreateVariableDto) { return this.s.createVariable(d); }
  @Patch('technical-variables/:id') @RequirePermissions(P.MASTERS_MANAGE) updateVariable(@Param('id', ParseUUIDPipe) id: string, @Body() d: UpdateVariableDto) { return this.s.updateVariable(id, d); }

  // Medios de pago y categorías financieras
  @Get('payment-methods') @RequireAnyPermission(P.MASTERS_READ, P.PAYMENTS_MANAGE, P.FINANCE_READ) paymentMethods() { return this.s.listPaymentMethods(); }
  @Post('payment-methods') @RequirePermissions(P.MASTERS_MANAGE) createPaymentMethod(@Body() d: CreatePaymentMethodDto) { return this.s.createPaymentMethod(d); }
  @Patch('payment-methods/:id') @RequirePermissions(P.MASTERS_MANAGE) updatePaymentMethod(@Param('id', ParseUUIDPipe) id: string, @Body() d: UpdatePaymentMethodDto) { return this.s.updatePaymentMethod(id, d); }
  @Get('finance-categories') @RequireAnyPermission(P.MASTERS_READ, P.FINANCE_READ) financeCategories() { return this.s.listFinanceCategories(); }
  @Post('finance-categories') @RequirePermissions(P.MASTERS_MANAGE) createFinanceCategory(@Body() d: CreateFinanceCategoryDto) { return this.s.createFinanceCategory(d); }
  @Patch('finance-categories/:id') @RequirePermissions(P.MASTERS_MANAGE) updateFinanceCategory(@Param('id', ParseUUIDPipe) id: string, @Body() d: UpdateFinanceCategoryDto) { return this.s.updateFinanceCategory(id, d); }

  // Parámetros del sistema
  @Get('parameters') @RequireAnyPermission(P.PARAMS_MANAGE, P.MASTERS_READ) parameters() { return this.params.list(); }
  @Put('parameters/:key') @RequirePermissions(P.PARAMS_MANAGE) updateParameter(@Param('key') key: string, @Body() d: UpdateParameterDto) { return this.params.update(key, d.value); }
}

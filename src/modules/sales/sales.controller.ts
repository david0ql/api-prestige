import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditAccess } from '../../common/decorators/audit-access.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../../common/decorators/permissions.decorator';
import { Permission as P } from '../../common/enums/permission.enum';
import type { AuthUser } from '../../common/types/auth-user';
import {
  CreateContributionDto,
  CreateOperationDto,
  CreatePaymentDto,
  CreateSaleDispatchDto,
  CustomerScopedQueryDto,
  OperationQueryDto,
  ReverseDto,
  UpdateOperationDto,
} from './dto/sales.dto';
import { SalesService } from './sales.service';

@ApiTags('Clientes y abonos')
@Controller()
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Get('customers/:id/account')
  @RequirePermissions(P.CUSTOMERS_READ)
  @AuditAccess('CustomerAccount')
  @ApiOperation({
    summary: 'P13 · Estado de cuenta (saldo en dinero y en material separados)',
  })
  account(@Param('id', ParseUUIDPipe) id: string) {
    return this.sales.customerAccount(id);
  }

  @Get('customer-operations')
  @RequirePermissions(P.CUSTOMERS_READ)
  operations(@Query() q: OperationQueryDto) {
    return this.sales.listOperations(q);
  }

  @Post('customer-operations')
  @RequirePermissions(P.CUSTOMERS_MANAGE)
  createOperation(
    @Body() dto: CreateOperationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.sales.createOperation(dto, user);
  }

  @Get('customer-operations/:id')
  @RequirePermissions(P.CUSTOMERS_READ)
  operation(@Param('id', ParseUUIDPipe) id: string) {
    return this.sales.getOperation(id);
  }

  @Patch('customer-operations/:id')
  @RequirePermissions(P.CUSTOMERS_MANAGE)
  updateOperation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOperationDto,
  ) {
    return this.sales.updateOperation(id, dto);
  }

  @Post('sales')
  @RequirePermissions(P.SALES_MANAGE)
  @ApiOperation({
    summary: 'RF-025 · Despacho/venta con control de calidad y ley (CA-014)',
  })
  createSale(
    @Body() dto: CreateSaleDispatchDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.sales.createSale(dto, user);
  }

  @Get('sales')
  @RequireAnyPermission(P.SALES_MANAGE, P.CUSTOMERS_READ)
  listSales(@Query() q: CustomerScopedQueryDto) {
    return this.sales.listSales(q);
  }

  @Post('sales/:id/reverse')
  @RequirePermissions(P.SALES_MANAGE, P.REVERSALS_AUTHORIZE)
  reverseSale(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReverseDto) {
    return this.sales.reverseSale(id, dto.reason);
  }

  @Post('customer-payments')
  @RequirePermissions(P.PAYMENTS_MANAGE)
  @ApiOperation({ summary: 'RF-026 · Abono monetario' })
  createPayment(@Body() dto: CreatePaymentDto, @CurrentUser() user: AuthUser) {
    return this.sales.createPayment(dto, user);
  }

  @Get('customer-payments')
  @RequireAnyPermission(P.PAYMENTS_MANAGE, P.CUSTOMERS_READ)
  listPayments(@Query() q: CustomerScopedQueryDto) {
    return this.sales.listPayments(q);
  }

  @Post('customer-payments/:id/reverse')
  @RequirePermissions(P.PAYMENTS_MANAGE, P.REVERSALS_AUTHORIZE)
  reversePayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReverseDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.sales.reversePayment(id, dto.reason, user);
  }

  @Post('customer-contributions')
  @RequirePermissions(P.CUSTOMER_MATERIAL_MANAGE, P.SCALE_WEIGH)
  @ApiOperation({
    summary: 'RF-027 · Abono/aporte de material del cliente (pesado)',
  })
  createContribution(
    @Body() dto: CreateContributionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.sales.createContribution(dto, user);
  }

  @Get('customer-contributions')
  @RequireAnyPermission(P.CUSTOMER_MATERIAL_MANAGE, P.CUSTOMERS_READ)
  listContributions(@Query() q: CustomerScopedQueryDto) {
    return this.sales.listContributions(q);
  }

  @Post('customer-contributions/:id/reverse')
  @RequirePermissions(P.CUSTOMER_MATERIAL_MANAGE, P.REVERSALS_AUTHORIZE)
  reverseContribution(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReverseDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.sales.reverseContribution(id, dto.reason, user);
  }
}

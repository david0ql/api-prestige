import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditAccess } from '../../common/decorators/audit-access.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireAnyPermission, RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission as P } from '../../common/enums/permission.enum';
import type { AuthUser } from '../../common/types/auth-user';
import { assertWorkshopAccess } from '../../common/utils/scope';
import {
  AdjustmentDto,
  BalanceQueryDto,
  KardexQueryDto,
  MovementQueryDto,
  RegisterEntryDto,
  ReverseDto,
  TransferDto,
} from './dto/inventory.dto';
import { InventoryService } from './inventory.service';

@ApiTags('Inventario')
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Post('entries')
  @RequirePermissions(P.INVENTORY_ENTRY, P.SCALE_WEIGH)
  @ApiOperation({ summary: 'RF-001 · Entrada de material pesada en Balanza Madre' })
  entry(@Body() dto: RegisterEntryDto, @CurrentUser() user: AuthUser) {
    return this.inventory.registerEntry(dto, user);
  }

  @Post('transfers')
  @RequirePermissions(P.INVENTORY_TRANSFER)
  transfer(@Body() dto: TransferDto, @CurrentUser() user: AuthUser) {
    return this.inventory.transfer(dto, user);
  }

  @Post('adjustments')
  @RequirePermissions(P.INVENTORY_ADJUST)
  adjust(@Body() dto: AdjustmentDto, @CurrentUser() user: AuthUser) {
    return this.inventory.adjust(dto, user);
  }

  @Post('movements/:id/reverse')
  @RequirePermissions(P.REVERSALS_AUTHORIZE)
  @ApiOperation({ summary: 'RN-015 · Reverso auditable de movimiento' })
  reverse(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReverseDto, @CurrentUser() user: AuthUser) {
    return this.inventory.reverse(id, dto, user);
  }

  @Get('balances')
  @RequireAnyPermission(P.INVENTORY_READ, P.WORKSHOP_PORTAL)
  @ApiOperation({ summary: 'P04 · Existencias por material, ubicación y lote' })
  balances(@Query() q: BalanceQueryDto, @CurrentUser() user: AuthUser) {
    return this.inventory.listBalances(q, user);
  }

  @Get('summary')
  @RequirePermissions(P.INVENTORY_READ)
  @ApiOperation({ summary: 'RF-005 · Inventario global por material (oficina, tránsito, talleres)' })
  summary(@CurrentUser() user: AuthUser) {
    return this.inventory.globalSummary(user);
  }

  @Get('workshops/:workshopId/custody')
  @RequireAnyPermission(P.INVENTORY_READ, P.WORKSHOP_PORTAL)
  @AuditAccess('WorkshopCustody')
  @ApiOperation({ summary: 'RF-006 · Material en custodia del taller (por orden y desde cuándo)' })
  custody(@Param('workshopId', ParseUUIDPipe) workshopId: string, @CurrentUser() user: AuthUser) {
    assertWorkshopAccess(user, workshopId);
    return this.inventory.workshopCustody(workshopId);
  }

  @Get('movements')
  @RequireAnyPermission(P.INVENTORY_READ, P.WORKSHOP_PORTAL)
  movements(@Query() q: MovementQueryDto, @CurrentUser() user: AuthUser) {
    return this.inventory.listMovements(q, user);
  }

  @Get('movements/:id')
  @RequireAnyPermission(P.INVENTORY_READ, P.WORKSHOP_PORTAL)
  movement(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.inventory.getMovement(id, user);
  }

  @Get('kardex')
  @RequirePermissions(P.INVENTORY_READ)
  @AuditAccess('Kardex')
  kardex(@Query() q: KardexQueryDto) {
    return this.inventory.kardex(q);
  }
}

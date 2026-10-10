import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireAnyPermission, RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission as P } from '../../common/enums/permission.enum';
import type { AuthUser } from '../../common/types/auth-user';
import { paginated } from '../../common/dto/pagination.dto';
import {
  ApproveOrderDto,
  ConsumptionBatchDto,
  CreateDiscrepancyDto,
  CreateDispatchDto,
  CreateMaterialRequestDto,
  CreateOrderDto,
  CreateReceiptDto,
  DiscrepancyQueryDto,
  DispatchQueryDto,
  FinishedDeclarationDto,
  FinishedGoodQueryDto,
  JustifyDiscrepancyDto,
  LaborDecisionDto,
  LaborQueryDto,
  ModifyTargetDto,
  OrderQueryDto,
  PreviewDispatchDto,
  ProgressDto,
  PurityVerificationDto,
  QualityCheckDto,
  ReasonDto,
  RequestQueryDto,
  RespondDispatchDto,
  ReviewDiscrepancyDto,
  ReviewRequestDto,
  UpdateOrderDto,
} from './dto/production.dto';
import { DispatchService } from './services/dispatch.service';
import { FinishedGoodsService } from './services/finished-goods.service';
import { OrdersService } from './services/orders.service';
import { ReceptionService } from './services/reception.service';
import { ReconciliationService } from './services/reconciliation.service';
import { WorkshopOpsService } from './services/workshop-ops.service';

@ApiTags('Órdenes de producción')
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly ws: WorkshopOpsService,
    private readonly reception: ReceptionService,
    private readonly rec: ReconciliationService,
  ) {}

  @Get()
  @RequirePermissions(P.ORDERS_READ)
  list(@Query() q: OrderQueryDto, @CurrentUser() user: AuthUser) {
    return this.orders.list(q, user);
  }

  @Post()
  @RequirePermissions(P.ORDERS_MANAGE)
  @ApiOperation({ summary: 'RF-007 · Crear orden (calcula insumos según estándar RF-008)' })
  create(@Body() dto: CreateOrderDto, @CurrentUser() user: AuthUser) {
    return this.orders.create(dto, user);
  }

  @Get(':id')
  @RequirePermissions(P.ORDERS_READ)
  @ApiOperation({ summary: 'P06 · Detalle y seguimiento completo' })
  detail(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.orders.detail(id, user);
  }

  @Patch(':id')
  @RequirePermissions(P.ORDERS_MANAGE)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateOrderDto, @CurrentUser() user: AuthUser) {
    return this.orders.update(id, dto, user);
  }

  @Post(':id/plan')
  @RequirePermissions(P.ORDERS_MANAGE)
  @ApiOperation({ summary: 'Borrador → Lista / Pendiente de materiales (valida suficiencia)' })
  plan(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.orders.plan(id, user);
  }

  @Post(':id/refresh-status')
  @RequirePermissions(P.ORDERS_MANAGE)
  refresh(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.orders.refreshStatus(id, user);
  }

  @Get(':id/sufficiency')
  @RequirePermissions(P.ORDERS_READ, P.INVENTORY_READ)
  @ApiOperation({ summary: 'RF-008/009 · Insumos requeridos vs disponibles' })
  sufficiency(@Param('id', ParseUUIDPipe) id: string) {
    return this.orders.sufficiency(id);
  }

  @Post(':id/modify-target')
  @RequirePermissions(P.ORDERS_AUTHORIZE_CHANGES)
  modifyTarget(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ModifyTargetDto, @CurrentUser() user: AuthUser) {
    return this.orders.modifyTarget(id, dto, user);
  }

  @Post(':id/cancel')
  @RequirePermissions(P.ORDERS_CANCEL)
  cancel(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReasonDto, @CurrentUser() user: AuthUser) {
    return this.orders.cancel(id, dto.reason, user);
  }

  @Get(':id/history')
  @RequirePermissions(P.ORDERS_READ)
  async history(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    await this.orders.findOrFail(id, user);
    return this.orders.history(id);
  }

  // ---- Portal de taller ----
  @Post(':id/consumptions')
  @RequirePermissions(P.WORKSHOP_PORTAL)
  @ApiOperation({ summary: 'RF-012 · Registrar consumos del taller' })
  consumption(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ConsumptionBatchDto, @CurrentUser() user: AuthUser) {
    return this.ws.reportConsumption(id, dto, user);
  }

  @Post(':id/consumptions/:consumptionId/void')
  @RequirePermissions(P.WORKSHOP_PORTAL)
  voidConsumption(@Param('id', ParseUUIDPipe) id: string, @Param('consumptionId', ParseUUIDPipe) cid: string, @Body() dto: ReasonDto, @CurrentUser() user: AuthUser) {
    return this.ws.voidConsumption(id, cid, dto.reason, user);
  }

  @Post(':id/progress')
  @RequirePermissions(P.WORKSHOP_PORTAL)
  @ApiOperation({ summary: 'RF-013/014 · Avance y cierre de etapa con evidencia obligatoria' })
  progress(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ProgressDto, @CurrentUser() user: AuthUser) {
    return this.ws.reportProgress(id, dto, user);
  }

  @Post(':id/finished')
  @RequirePermissions(P.WORKSHOP_PORTAL)
  @ApiOperation({ summary: 'RF-017/018 · Declarar producto terminado + mano de obra propuesta' })
  finished(@Param('id', ParseUUIDPipe) id: string, @Body() dto: FinishedDeclarationDto, @CurrentUser() user: AuthUser) {
    return this.ws.declareFinished(id, dto, user);
  }

  // ---- Recepción y control ----
  @Post(':id/receipts')
  @RequirePermissions(P.ORDERS_RECEIVE, P.SCALE_WEIGH)
  @ApiOperation({ summary: 'RF-019/020 · Recepción pesada (terminado, sobrante, no utilizado, devolución)' })
  receipt(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateReceiptDto, @CurrentUser() user: AuthUser) {
    return this.reception.create(id, dto, user);
  }

  @Post(':id/receipts/:receiptId/quality')
  @RequirePermissions(P.QUALITY_VERIFY)
  quality(@Param('id', ParseUUIDPipe) id: string, @Param('receiptId', ParseUUIDPipe) rid: string, @Body() dto: QualityCheckDto, @CurrentUser() user: AuthUser) {
    return this.reception.qualityCheck(id, rid, dto, user);
  }

  @Post(':id/receipts/:receiptId/purity')
  @RequirePermissions(P.QUALITY_VERIFY)
  @ApiOperation({ summary: 'RF-044 · Verificación de ley/pureza del producto terminado' })
  purity(@Param('id', ParseUUIDPipe) id: string, @Param('receiptId', ParseUUIDPipe) rid: string, @Body() dto: PurityVerificationDto, @CurrentUser() user: AuthUser) {
    return this.reception.purityVerification(id, rid, dto, user);
  }

  // ---- Conciliación y cierre ----
  @Get(':id/reconciliation')
  @RequirePermissions(P.ORDERS_READ)
  @ApiOperation({ summary: 'RF-021 / P12 · Conciliación entregado/consumido/devuelto/terminado/diferencia' })
  async reconciliation(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    await this.orders.findOrFail(id, user);
    return this.rec.compute(id);
  }

  @Post(':id/reconciliation/discrepancies')
  @RequirePermissions(P.ORDERS_RECONCILE)
  @ApiOperation({ summary: 'RN-010 · Registrar diferencias y merma de la conciliación' })
  generate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.rec.generateDiscrepancies(id, user);
  }

  @Post(':id/discrepancies')
  @RequirePermissions(P.ORDERS_RECONCILE)
  manualDiscrepancy(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateDiscrepancyDto, @CurrentUser() user: AuthUser) {
    return this.rec.createManual(id, dto, user);
  }

  @Post(':id/send-to-review')
  @RequirePermissions(P.ORDERS_RECEIVE)
  sendToReview(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.rec.sendToReview(id, user);
  }

  @Post(':id/reject')
  @RequireAnyPermission(P.ORDERS_APPROVE, P.ORDERS_RECONCILE)
  @ApiOperation({ summary: 'Devolver a ajuste (Rechazada/Ajuste)' })
  reject(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReasonDto, @CurrentUser() user: AuthUser) {
    return this.rec.reject(id, dto.reason, user);
  }

  @Post(':id/approve')
  @RequirePermissions(P.ORDERS_APPROVE)
  @ApiOperation({ summary: 'RF-023/024 · Aprobar y cerrar (solo Prestige Gold)' })
  approve(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ApproveOrderDto, @CurrentUser() user: AuthUser) {
    return this.rec.approve(id, dto, user);
  }
}

@ApiTags('Entregas a taller')
@Controller('dispatches')
export class DispatchController {
  constructor(private readonly dispatches: DispatchService) {}

  @Post('preview')
  @RequirePermissions(P.ORDERS_DISPATCH)
  @ApiOperation({ summary: 'RF-009 · Simular asignación y detectar insuficiencia' })
  preview(@Body() dto: PreviewDispatchDto, @CurrentUser() user: AuthUser) {
    return this.dispatches.preview(dto, user);
  }

  @Post()
  @RequirePermissions(P.ORDERS_DISPATCH)
  @ApiOperation({ summary: 'RF-010 · Despachar material pesado al taller (P05)' })
  create(@Body() dto: CreateDispatchDto, @CurrentUser() user: AuthUser) {
    return this.dispatches.create(dto, user);
  }

  @Get()
  @RequireAnyPermission(P.ORDERS_READ, P.WORKSHOP_PORTAL)
  list(@Query() q: DispatchQueryDto, @CurrentUser() user: AuthUser) {
    return this.dispatches.list(q, user);
  }

  @Get(':id')
  @RequireAnyPermission(P.ORDERS_READ, P.WORKSHOP_PORTAL)
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.dispatches.get(id, user);
  }

  @Post(':id/respond')
  @RequirePermissions(P.WORKSHOP_PORTAL)
  @ApiOperation({ summary: 'RF-011/035 · P08 Confirmación de entrega con firma digital' })
  respond(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RespondDispatchDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.dispatches.respond(id, dto, user, { ip: req.ip, userAgent: req.headers['user-agent'] });
  }
}

@ApiTags('Portal de taller')
@Controller('workshop-portal')
export class WorkshopPortalController {
  constructor(private readonly ws: WorkshopOpsService) {}

  @Get('dashboard')
  @RequirePermissions(P.WORKSHOP_PORTAL)
  @ApiOperation({ summary: 'P07 / RF-034 · Panel del taller (solo su información)' })
  dashboard(@CurrentUser() user: AuthUser) {
    return this.ws.dashboard(user);
  }
}

@ApiTags('Solicitudes de material')
@Controller('material-requests')
export class MaterialRequestsController {
  constructor(private readonly ws: WorkshopOpsService) {}

  @Post()
  @RequirePermissions(P.WORKSHOP_PORTAL)
  @ApiOperation({ summary: 'RF-015/016 · Solicitar material adicional (validado contra estándar)' })
  create(@Body() dto: CreateMaterialRequestDto, @CurrentUser() user: AuthUser) {
    return this.ws.createRequest(dto, user);
  }

  @Get()
  @RequireAnyPermission(P.REQUESTS_REVIEW, P.WORKSHOP_PORTAL, P.ORDERS_READ)
  list(@Query() q: RequestQueryDto, @CurrentUser() user: AuthUser) {
    return this.ws.listRequests(q, user);
  }

  @Post(':id/review')
  @RequirePermissions(P.REQUESTS_REVIEW)
  review(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewRequestDto, @CurrentUser() user: AuthUser) {
    return this.ws.reviewRequest(id, dto, user);
  }
}

@ApiTags('Mermas y diferencias')
@Controller('discrepancies')
export class DiscrepanciesController {
  constructor(private readonly rec: ReconciliationService) {}

  @Get()
  @RequireAnyPermission(P.ORDERS_READ, P.DISCREPANCIES_APPROVE)
  list(@Query() q: DiscrepancyQueryDto, @CurrentUser() user: AuthUser) {
    return this.rec.list(q, user);
  }

  @Post(':id/justify')
  @RequireAnyPermission(P.ORDERS_RECONCILE, P.DISCREPANCIES_APPROVE)
  justify(@Param('id', ParseUUIDPipe) id: string, @Body() dto: JustifyDiscrepancyDto) {
    return this.rec.justify(id, dto);
  }

  @Post(':id/review')
  @RequirePermissions(P.DISCREPANCIES_APPROVE)
  @ApiOperation({ summary: 'RF-022 · Aprobar/rechazar diferencia' })
  review(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewDiscrepancyDto, @CurrentUser() user: AuthUser) {
    return this.rec.review(id, dto, user);
  }
}

@ApiTags('Mano de obra')
@Controller('labor')
export class LaborController {
  constructor(private readonly rec: ReconciliationService) {}

  @Get()
  @RequireAnyPermission(P.LABOR_APPROVE, P.FINANCE_READ, P.WORKSHOP_PORTAL)
  list(@Query() q: LaborQueryDto, @CurrentUser() user: AuthUser) {
    return this.rec.listLabor(q, user);
  }

  @Post(':id/decision')
  @RequirePermissions(P.LABOR_APPROVE)
  @ApiOperation({ summary: 'RN-012 · Aprobar/rechazar mano de obra propuesta' })
  decide(@Param('id', ParseUUIDPipe) id: string, @Body() dto: LaborDecisionDto, @CurrentUser() user: AuthUser) {
    return this.rec.decideLabor(id, dto, user);
  }
}

@ApiTags('Producto terminado')
@Controller('finished-goods')
export class FinishedGoodsController {
  constructor(private readonly goods: FinishedGoodsService) {}

  @Get()
  @RequireAnyPermission(P.SALES_MANAGE, P.INVENTORY_READ)
  list(@Query() q: FinishedGoodQueryDto) {
    return this.goods.list(q);
  }

  @Get(':id')
  @RequireAnyPermission(P.SALES_MANAGE, P.INVENTORY_READ)
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.goods.get(id);
  }
}

export { paginated };

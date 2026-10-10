import { localDate } from '../../../common/utils/dates';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  FindOptionsWhere,
  In,
  IsNull,
  LessThanOrEqual,
  Not,
  Repository,
} from 'typeorm';
import { paginated } from '../../../common/dto/pagination.dto';
import {
  AlertSeverity,
  AlertType,
  ApprovalStatus,
  DispatchStatus,
  LaborBasis,
  OrderStatus as S,
  RequestStatus,
} from '../../../common/enums/domain.enums';
import type { AuthUser } from '../../../common/types/auth-user';
import { BusinessRuleException } from '../../../common/utils/business-error';
import {
  GRAM_EPSILON,
  roundGrams,
  roundMoney,
} from '../../../common/utils/numeric';
import { assertWorkshopAccess } from '../../../common/utils/scope';
import { CatalogService } from '../../catalog/catalog.service';
import { InventoryService } from '../../inventory/inventory.service';
import { LaborRate } from '../../masters/entities/labor-rate.entity';
import { MastersService } from '../../masters/masters.service';
import { MediaService } from '../../media/media.service';
import { SequenceService } from '../../sequences/sequence.service';
import {
  ConsumptionBatchDto,
  CreateMaterialRequestDto,
  FinishedDeclarationDto,
  ProgressDto,
  RequestQueryDto,
  ReviewRequestDto,
} from '../dto/production.dto';
import { ConsumptionReport } from '../entities/consumption-report.entity';
import { FinishedDeclaration } from '../entities/finished-declaration.entity';
import { LaborCost } from '../entities/labor-cost.entity';
import { MaterialDispatch } from '../entities/material-dispatch.entity';
import { MaterialRequest } from '../entities/material-request.entity';
import { ProductionOrder } from '../entities/production-order.entity';
import { ProgressReport } from '../entities/progress-report.entity';
import { StageCompletion } from '../entities/stage-completion.entity';
import { ALERT_RAISE, AlertRaiseEvent } from '../production.events';
import {
  OrderStateService,
  WORKSHOP_ACTIVE_STATUSES,
} from './order-state.service';
import { OrdersService } from './orders.service';

/**
 * Portal de talleres (RF-012…018, RF-034, P07/P09/P10): consumos, avances con
 * evidencia por etapa, solicitudes de material y producto terminado.
 */
@Injectable()
export class WorkshopOpsService {
  constructor(
    private readonly ds: DataSource,
    @InjectRepository(MaterialRequest)
    private readonly requests: Repository<MaterialRequest>,
    @InjectRepository(LaborCost) private readonly labor: Repository<LaborCost>,
    private readonly orders: OrdersService,
    private readonly state: OrderStateService,
    private readonly inventory: InventoryService,
    private readonly masters: MastersService,
    private readonly media: MediaService,
    private readonly catalog: CatalogService,
    private readonly seq: SequenceService,
    private readonly events: EventEmitter2,
  ) {}

  private assertWorkshopUser(user: AuthUser, order: ProductionOrder) {
    if (!user.workshopId)
      throw new BusinessRuleException(
        'WORKSHOP_ONLY',
        'Operación exclusiva del taller asignado',
      );
    assertWorkshopAccess(user, order.workshopId);
  }

  /** Pasa a "En producción" al primer reporte de trabajo. */
  private async markInProduction(orderId: string, user: AuthUser) {
    await this.ds.transaction(async (m) => {
      const order = await m.findOneOrFail(ProductionOrder, {
        where: { id: orderId },
        loadEagerRelations: false,
      });
      if (order.status === S.ACCEPTED_BY_WORKSHOP)
        await this.state.transition(
          m,
          order,
          S.IN_PRODUCTION,
          user,
          'Primer reporte del taller',
        );
    });
  }

  // ---------------- Consumos (RF-012) ----------------
  async reportConsumption(
    orderId: string,
    dto: ConsumptionBatchDto,
    user: AuthUser,
  ) {
    const order = await this.orders.findOrFail(orderId, user);
    this.assertWorkshopUser(user, order);
    this.state.assertStatus(
      order,
      WORKSHOP_ACTIVE_STATUSES,
      'registrar consumos',
    );
    const loc = await this.masters.workshopLocation(order.workshopId);
    const custody = await this.inventory.orderCustody(orderId, loc.id);
    const saved = await this.ds.transaction(async (m) => {
      const out: ConsumptionReport[] = [];
      for (const item of dto.items) {
        const material = await this.masters.activeMaterial(item.materialId);
        const c = custody.find((x) => x.materialId === item.materialId);
        const already =
          (await m.getRepository(ConsumptionReport).sum('grams', {
            orderId,
            materialId: item.materialId,
            voided: false,
          })) ?? 0;
        const totalConsumed = roundGrams(already + item.grams);
        const inCustody = c?.balance ?? 0;
        // No se puede consumir material que el taller no ha recibido para esta orden.
        if (totalConsumed > inCustody + GRAM_EPSILON) {
          throw new BusinessRuleException(
            'CONSUMPTION_EXCEEDS_CUSTODY',
            `${material.name}: el consumo acumulado (${totalConsumed} g) supera el material en custodia para la orden (${inCustody} g)`,
          );
        }
        out.push(
          await m.save(
            ConsumptionReport,
            m.create(ConsumptionReport, {
              orderId,
              workshopId: order.workshopId,
              materialId: item.materialId,
              grams: roundGrams(item.grams),
              stageId: item.stageId ?? null,
              notes: item.notes ?? null,
              reportedById: user.id,
            }),
          ),
        );
        // RF-039: consumo anormal frente al estándar.
        const req = order.requirements.find(
          (r) => r.materialId === item.materialId,
        );
        if (
          req &&
          totalConsumed >
            req.requiredGrams * (1 + req.tolerancePct / 100) + GRAM_EPSILON
        ) {
          await this.events.emitAsync(ALERT_RAISE, {
            type: AlertType.ABNORMAL_CONSUMPTION,
            severity: AlertSeverity.WARNING,
            title: `Consumo fuera de estándar en ${order.number}`,
            message: `${material.name}: consumido ${totalConsumed} g vs estándar ${req.requiredGrams} g (+${req.tolerancePct}%)`,
            entityType: 'ProductionOrder',
            entityId: order.id,
            workshopId: order.workshopId,
            dedupKey: `ABNORMAL:${order.id}:${material.id}`,
          } satisfies AlertRaiseEvent);
        }
      }
      return out;
    });
    await this.markInProduction(orderId, user);
    return saved;
  }

  async voidConsumption(
    orderId: string,
    consumptionId: string,
    reason: string,
    user: AuthUser,
  ) {
    const order = await this.orders.findOrFail(orderId, user);
    this.assertWorkshopUser(user, order);
    this.state.assertStatus(order, WORKSHOP_ACTIVE_STATUSES, 'anular consumos');
    const c = await this.ds.manager.findOne(ConsumptionReport, {
      where: { id: consumptionId, orderId },
    });
    if (!c || c.voided) throw new NotFoundException('Consumo no encontrado');
    await this.ds.manager.update(
      ConsumptionReport,
      { id: c.id },
      { voided: true, voidReason: reason },
    );
    return { ...c, voided: true, voidReason: reason };
  }

  // ---------------- Avances y etapas (RF-013/014, RN-013) ----------------
  async reportProgress(orderId: string, dto: ProgressDto, user: AuthUser) {
    const order = await this.orders.findOrFail(orderId, user);
    this.assertWorkshopUser(user, order);
    this.state.assertStatus(
      order,
      WORKSHOP_ACTIVE_STATUSES,
      'registrar avances',
    );
    if (dto.grams !== undefined && dto.grams > order.targetGrams * 1.5) {
      throw new BusinessRuleException(
        'IMPLAUSIBLE_PROGRESS',
        'El avance reportado supera valores plausibles para la orden',
      );
    }
    const stage = dto.stageId
      ? (await this.masters.stagesForProduct(order.product)).find(
          (s) => s.id === dto.stageId,
        )
      : null;
    if (dto.stageId && !stage)
      throw new BadRequestException('La etapa no aplica a este producto');
    if (dto.completesStage && !stage)
      throw new BadRequestException('Indique la etapa a completar');

    const report = await this.ds.transaction(async (m) => {
      const r = await m.save(
        ProgressReport,
        m.create(ProgressReport, {
          orderId,
          workshopId: order.workshopId,
          stageId: stage?.id ?? null,
          grams: dto.grams ?? null,
          units: dto.units ?? null,
          percent: dto.percent ?? null,
          notes: dto.notes ?? null,
          completesStage: !!dto.completesStage,
          reportedById: user.id,
        }),
      );
      if (dto.completesStage && stage) {
        if (stage.isFinal)
          throw new BusinessRuleException(
            'FINAL_STAGE',
            'La etapa final se completa al declarar el producto terminado',
          );
        const counts = await this.media.countByStage(orderId, stage.id);
        // Validación crítica: no se completa una etapa obligatoria sin su evidencia.
        this.media.ensureStageEvidence(stage, counts);
        const exists = await m.exists(StageCompletion, {
          where: { orderId, stageId: stage.id },
        });
        if (!exists) {
          await m.save(
            StageCompletion,
            m.create(StageCompletion, {
              orderId,
              stageId: stage.id,
              photoCount: counts.photos,
              videoCount: counts.videos,
              completedById: user.id,
            }),
          );
        }
      }
      return r;
    });
    await this.markInProduction(orderId, user);
    return report;
  }

  // ---------------- Solicitudes de material (RF-015/016) ----------------
  async createRequest(dto: CreateMaterialRequestDto, user: AuthUser) {
    if (!user.workshopId)
      throw new BusinessRuleException(
        'WORKSHOP_ONLY',
        'Las solicitudes las crea el taller',
      );
    const material = await this.masters.activeMaterial(dto.materialId);
    let expected: number | null = null;
    let delivered: number | null = null;
    let deviationPct: number | null = null;
    let exceeds = false;
    let order: ProductionOrder | null = null;
    if (dto.orderId) {
      order = await this.orders.findOrFail(dto.orderId, user);
      this.state.assertStatus(
        order,
        [...WORKSHOP_ACTIVE_STATUSES, S.DISPATCHED],
        'solicitar material',
      );
      const req = order.requirements.find(
        (r) => r.materialId === dto.materialId,
      );
      delivered = await this.inventory.dispatchedForOrder(
        order.id,
        dto.materialId,
      );
      expected = req?.requiredGrams ?? 0;
      const tol = req?.tolerancePct ?? 0;
      const totalIfApproved = roundGrams(delivered + dto.grams);
      deviationPct =
        expected > 0
          ? roundGrams(((totalIfApproved - expected) / expected) * 100)
          : 100;
      // RF-016: la solicitud se compara con el consumo esperado según estándar.
      exceeds = totalIfApproved > expected * (1 + tol / 100) + GRAM_EPSILON;
    }
    const saved = await this.ds.transaction(async (m) =>
      m.save(
        MaterialRequest,
        m.create(MaterialRequest, {
          number: await this.seq.next(m, 'SOL'),
          orderId: order?.id ?? null,
          workshopId: user.workshopId!,
          materialId: material.id,
          grams: roundGrams(dto.grams),
          reason: dto.reason,
          status: RequestStatus.PENDING,
          expectedGrams: expected,
          alreadyDeliveredGrams: delivered,
          deviationPct,
          exceedsStandard: exceeds,
          requestedById: user.id,
        }),
      ),
    );
    await this.events.emitAsync(ALERT_RAISE, {
      type: exceeds ? AlertType.REQUEST_DEVIATION : AlertType.PENDING_OPERATION,
      severity: exceeds ? AlertSeverity.WARNING : AlertSeverity.INFO,
      title: `Solicitud ${saved.number} de ${material.name}${exceeds ? ' fuera de estándar' : ''}`,
      message: `${dto.grams} g · ${dto.reason}${exceeds ? ` · desviación ${deviationPct?.toFixed(1)}% sobre estándar` : ''}`,
      entityType: 'MaterialRequest',
      entityId: saved.id,
      workshopId: user.workshopId,
      dedupKey: `REQUEST:${saved.id}`,
    } satisfies AlertRaiseEvent);
    return saved;
  }

  async listRequests(q: RequestQueryDto, user: AuthUser) {
    const where: FindOptionsWhere<MaterialRequest> = {};
    if (q.status) where.status = q.status;
    if (q.orderId) where.orderId = q.orderId;
    if (q.workshopId) where.workshopId = q.workshopId;
    if (user.workshopId) where.workshopId = user.workshopId;
    return paginated(
      await this.requests.findAndCount({
        where,
        order: { createdAt: 'DESC' },
        skip: q.skip,
        take: q.pageSize,
      }),
      q,
    );
  }

  async reviewRequest(id: string, dto: ReviewRequestDto, user: AuthUser) {
    const r = await this.requests.findOne({ where: { id } });
    if (!r) throw new NotFoundException('Solicitud no encontrada');
    if (r.status !== RequestStatus.PENDING)
      throw new BusinessRuleException(
        'REQUEST_REVIEWED',
        'La solicitud ya fue revisada',
      );
    r.status =
      dto.decision === 'APPROVE'
        ? RequestStatus.APPROVED
        : RequestStatus.REJECTED;
    r.reviewedById = user.id;
    r.reviewedAt = new Date();
    r.reviewNotes = dto.notes ?? null;
    await this.requests.save(r);
    this.events.emit('alert.resolve', {
      dedupKey: `REQUEST:${r.id}`,
      notes: `Solicitud ${r.status}`,
    });
    return r;
  }

  // ---------------- Producto terminado (RF-017/018, P10) ----------------
  async declareFinished(
    orderId: string,
    dto: FinishedDeclarationDto,
    user: AuthUser,
  ) {
    const order = await this.orders.findOrFail(orderId, user);
    this.assertWorkshopUser(user, order);
    this.state.assertStatus(
      order,
      [
        S.ACCEPTED_BY_WORKSHOP,
        S.IN_PRODUCTION,
        S.PARTIAL,
        S.REJECTED_ADJUSTMENT,
      ],
      'declarar producto terminado',
    );
    const stages = await this.masters.stagesForProduct(order.product);
    const completions = await this.ds.manager.find(StageCompletion, {
      where: { orderId },
    });
    // RN-013: todas las etapas obligatorias (no finales) deben estar completas con evidencia.
    const missing = stages.filter(
      (s) =>
        s.mandatory &&
        !s.isFinal &&
        !completions.some((c) => c.stageId === s.id),
    );
    if (missing.length) {
      throw new BusinessRuleException(
        'MANDATORY_STAGES_PENDING',
        `Faltan etapas obligatorias con evidencia: ${missing.map((s) => s.name).join(', ')}`,
        { missing: missing.map((s) => ({ id: s.id, name: s.name })) },
      );
    }
    // Evidencia final del producto terminado (foto/video) — RF-017.
    const finalStage = stages.find((s) => s.isFinal);
    if (finalStage)
      this.media.ensureStageEvidence(
        finalStage,
        await this.media.countByStage(orderId, finalStage.id),
      );
    // Variables técnicas requeridas para alimentar el estándar del modelo.
    const defs = await this.masters.variablesForProduct(order.product);
    const technicalValues = this.catalog.validateVariables(
      dto.technicalValues ?? {},
      defs,
      true,
    );
    // Plausibilidad: el terminado no puede superar lo entregado a la orden.
    const loc = await this.masters.workshopLocation(order.workshopId);
    const custody = await this.inventory.orderCustody(orderId, loc.id);
    const deliveredTotal = custody.reduce((s, c) => s + c.inGrams, 0);
    if (dto.grams > deliveredTotal + GRAM_EPSILON) {
      throw new BusinessRuleException(
        'IMPLAUSIBLE_FINISHED',
        `El peso terminado (${dto.grams} g) supera el material entregado a la orden (${roundGrams(deliveredTotal)} g)`,
      );
    }
    for (const l of dto.leftovers ?? [])
      await this.masters.activeMaterial(l.materialId);

    let rate: number | null = null;
    if (dto.labor) {
      rate =
        dto.labor.rate ??
        (await this.currentRate(
          order.workshopId,
          order.productId,
          dto.labor.basis,
        ));
      if (rate === null)
        throw new BusinessRuleException(
          'NO_LABOR_RATE',
          'No hay tarifa vigente: indique la tarifa propuesta',
        );
    }

    await this.ds.transaction(async (m) => {
      await m.update(
        FinishedDeclaration,
        { orderId, current: true },
        { current: false },
      );
      const decl = await m.save(
        FinishedDeclaration,
        m.create(FinishedDeclaration, {
          orderId,
          workshopId: order.workshopId,
          units: dto.units ?? null,
          grams: roundGrams(dto.grams),
          technicalValues,
          diameterMm: dto.diameterMm ?? null,
          lengthMm: dto.lengthMm ?? null,
          measures: dto.measures ?? null,
          declaredLeftovers: (dto.leftovers ?? []).map((l) => ({
            materialId: l.materialId,
            grams: roundGrams(l.grams),
            type: l.type,
          })),
          notes: dto.notes ?? null,
          declaredById: user.id,
        }),
      );
      if (finalStage) {
        const counts = await this.media.countByStage(orderId, finalStage.id);
        if (
          !(await m.exists(StageCompletion, {
            where: { orderId, stageId: finalStage.id },
          }))
        ) {
          await m.save(
            StageCompletion,
            m.create(StageCompletion, {
              orderId,
              stageId: finalStage.id,
              photoCount: counts.photos,
              videoCount: counts.videos,
              completedById: user.id,
            }),
          );
        }
      }
      if (dto.labor && rate !== null) {
        // Una sola propuesta vigente por orden: las anteriores quedan reemplazadas.
        await m.update(
          LaborCost,
          { orderId, status: ApprovalStatus.PROPOSED },
          {
            status: ApprovalStatus.REJECTED,
            reviewNotes: 'Reemplazada por nueva propuesta',
          },
        );
        await m.save(
          LaborCost,
          m.create(LaborCost, {
            orderId,
            workshopId: order.workshopId,
            basis: dto.labor.basis,
            rate,
            quantity: dto.labor.quantity,
            proposedValue: roundMoney(rate * dto.labor.quantity),
            status: ApprovalStatus.PROPOSED,
            notes: dto.labor.notes ?? null,
            proposedById: user.id,
          }),
        );
      }
      const current = await m.findOneOrFail(ProductionOrder, {
        where: { id: orderId },
        loadEagerRelations: false,
      });
      await this.state.transition(
        m,
        current,
        S.FINISHED_BY_WORKSHOP,
        user,
        `Declaración: ${decl.grams} g${decl.units ? ` / ${decl.units} u` : ''}`,
      );
    });
    await this.events.emitAsync(ALERT_RAISE, {
      type: AlertType.PENDING_OPERATION,
      severity: AlertSeverity.INFO,
      title: `${order.number} terminada por taller: pendiente de recepción`,
      message: `${order.workshop.name} declaró ${dto.grams} g de ${order.product.name}`,
      entityType: 'ProductionOrder',
      entityId: order.id,
      dedupKey: `TO_RECEIVE:${order.id}`,
    } satisfies AlertRaiseEvent);
    return this.orders.findOrFail(orderId);
  }

  async currentRate(
    workshopId: string,
    productId: string,
    basis: LaborBasis,
  ): Promise<number | null> {
    const today = localDate();
    const rates = await this.ds.manager.find(LaborRate, {
      where: [
        {
          workshopId,
          productId,
          basis,
          active: true,
          validFrom: LessThanOrEqual(today),
        },
        {
          workshopId,
          productId: IsNull(),
          basis,
          active: true,
          validFrom: LessThanOrEqual(today),
        },
      ],
      order: { validFrom: 'DESC' },
    });
    const valid = rates.filter((r) => !r.validTo || r.validTo >= today);
    return (
      (valid.find((r) => r.productId === productId) ?? valid[0])?.rate ?? null
    );
  }

  // ---------------- Panel de taller (P07, RF-034) ----------------
  async dashboard(user: AuthUser) {
    if (!user.workshopId)
      throw new BusinessRuleException(
        'WORKSHOP_ONLY',
        'Panel exclusivo de taller',
      );
    const workshopId = user.workshopId;
    const em = this.ds.manager;
    const today = localDate();
    const [orders, pendingDispatches, requests, custody] = await Promise.all([
      em.find(ProductionOrder, {
        where: {
          workshopId,
          status: Not(In([S.APPROVED_CLOSED, S.CANCELLED])),
        },
        relations: { requirements: true },
        order: { commitmentDate: 'ASC' },
      }),
      em.find(MaterialDispatch, {
        where: { workshopId, status: DispatchStatus.PENDING_ACCEPTANCE },
        order: { createdAt: 'ASC' },
      }),
      em.find(MaterialRequest, {
        where: { workshopId },
        order: { createdAt: 'DESC' },
        take: 10,
      }),
      this.inventory.workshopCustody(workshopId),
    ]);
    const tasks: {
      type: string;
      title: string;
      detail: string;
      orderId?: string;
      dispatchId?: string;
      priority: 'HIGH' | 'MEDIUM' | 'LOW';
    }[] = [];
    for (const d of pendingDispatches) {
      tasks.push({
        type: 'CONFIRM_DISPATCH',
        title: `Confirmar entrega ${d.number}`,
        detail: d.lines
          .map((l) => `${l.material.name} ${l.grams} g`)
          .join(', '),
        dispatchId: d.id,
        orderId: d.orderId ?? undefined,
        priority: 'HIGH',
      });
    }
    for (const o of orders) {
      if (o.status === S.REJECTED_ADJUSTMENT)
        tasks.push({
          type: 'ADJUST',
          title: `Corregir ${o.number}`,
          detail: o.rejectionReason ?? 'Devuelta a ajuste',
          orderId: o.id,
          priority: 'HIGH',
        });
      if (
        [S.ACCEPTED_BY_WORKSHOP, S.IN_PRODUCTION, S.PARTIAL].includes(o.status)
      ) {
        tasks.push({
          type: 'PRODUCE',
          title: `Registrar producción ${o.number}`,
          detail: `${o.product.name} · ${o.targetGrams} g · entrega ${o.commitmentDate}`,
          orderId: o.id,
          priority: o.commitmentDate < today ? 'HIGH' : 'MEDIUM',
        });
      }
    }
    return {
      workshop: { id: workshopId, code: user.workshopCode },
      kpis: {
        openOrders: orders.length,
        overdue: orders.filter(
          (o) =>
            o.commitmentDate < today &&
            ![S.FINISHED_BY_WORKSHOP, S.IN_REVIEW].includes(o.status),
        ).length,
        pendingDispatches: pendingDispatches.length,
        custodyGrams: roundGrams(
          custody.totals.reduce((s, t) => s + t.grams, 0),
        ),
      },
      orders,
      pendingDispatches,
      requests,
      custody,
      tasks,
    };
  }

  listLabor(where: FindOptionsWhere<LaborCost>, skip: number, take: number) {
    return this.labor.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip,
      take,
    });
  }
}

import { localDate } from '../../../common/utils/dates';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  FindOptionsWhere,
  In,
  Repository,
} from 'typeorm';
import { paginated } from '../../../common/dto/pagination.dto';
import {
  AlertSeverity,
  AlertType,
  ApprovalStatus,
  AuditAction,
  CostType,
  DiscrepancyStatus,
  DiscrepancyType,
  DispatchStatus,
  FinishedGoodStatus,
  MovementStatus,
  MovementType,
  OrderStatus as S,
  PurityStatus,
  QualityResult,
  ReceiptLineType,
  ReceiptType,
  RequestStatus,
} from '../../../common/enums/domain.enums';
import { Permission } from '../../../common/enums/permission.enum';
import type { AuthUser } from '../../../common/types/auth-user';
import { BusinessRuleException } from '../../../common/utils/business-error';
import {
  GRAM_EPSILON,
  roundGrams,
  roundMoney,
} from '../../../common/utils/numeric';
import { AuditService } from '../../audit/audit.service';
import { CatalogService } from '../../catalog/catalog.service';
import { CostEntry } from '../../finance/entities/cost-entry.entity';
import { InventoryService } from '../../inventory/inventory.service';
import { InventoryMovement } from '../../inventory/entities/inventory-movement.entity';
import { Material } from '../../masters/entities/material.entity';
import { MastersService } from '../../masters/masters.service';
import { ParametersService, PARAM } from '../../masters/parameters.service';
import { SequenceService } from '../../sequences/sequence.service';
import {
  ApproveOrderDto,
  CreateDiscrepancyDto,
  DiscrepancyQueryDto,
  JustifyDiscrepancyDto,
  LaborDecisionDto,
  LaborQueryDto,
  ReviewDiscrepancyDto,
} from '../dto/production.dto';
import { ConsumptionReport } from '../entities/consumption-report.entity';
import { Discrepancy } from '../entities/discrepancy.entity';
import { FinishedDeclaration } from '../entities/finished-declaration.entity';
import { FinishedGood } from '../entities/finished-good.entity';
import { LaborCost } from '../entities/labor-cost.entity';
import { MaterialDispatch } from '../entities/material-dispatch.entity';
import { MaterialRequest } from '../entities/material-request.entity';
import { ProductionOrder } from '../entities/production-order.entity';
import { ProductionReceipt } from '../entities/production-receipt.entity';
import { PurityVerification } from '../entities/purity-verification.entity';
import { QualityCheck } from '../entities/quality-check.entity';
import { ALERT_RAISE, AlertRaiseEvent } from '../production.events';
import { OrderStateService } from './order-state.service';
import { OrdersService } from './orders.service';

export interface ReconciliationLine {
  materialId: string;
  materialCode: string;
  materialName: string;
  deliveredGrams: number;
  returnedGrams: number;
  postedAdjustmentsGrams: number;
  custodyGrams: number;
  consumedGrams: number;
  unexplainedGrams: number;
  approvedDifferenceGrams: number;
  pendingDifferenceGrams: number;
  balanced: boolean;
}

/**
 * Conciliación, mermas/diferencias y aprobación (RF-021/022/023/024, RN-009…012,
 * RN-021, P12, CA-006/008/013).
 *
 * Por material: entregado = consumido + retornado + diferencia autorizada.
 * Transformación: consumido = producto terminado + merma de proceso.
 */
@Injectable()
export class ReconciliationService {
  constructor(
    private readonly ds: DataSource,
    @InjectRepository(Discrepancy)
    private readonly discrepancies: Repository<Discrepancy>,
    private readonly orders: OrdersService,
    private readonly state: OrderStateService,
    private readonly inventory: InventoryService,
    private readonly masters: MastersService,
    private readonly params: ParametersService,
    private readonly catalog: CatalogService,
    private readonly seq: SequenceService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
  ) {}

  async compute(orderId: string, m: EntityManager = this.ds.manager) {
    const order = await m.findOneOrFail(ProductionOrder, {
      where: { id: orderId },
      relations: { requirements: true },
    });
    const wsLoc = await this.masters.workshopLocation(order.workshopId);
    const [custody, consumptions, receipts, discrepancies, movements] =
      await Promise.all([
        this.inventory.orderCustody(orderId, wsLoc.id, m),
        m.find(ConsumptionReport, { where: { orderId, voided: false } }),
        m.find(ProductionReceipt, { where: { orderId } }),
        m.find(Discrepancy, { where: { orderId } }),
        m.find(InventoryMovement, {
          where: { productionOrderId: orderId },
          loadEagerRelations: false,
        }),
      ]);
    const materials = new Map<string, Material>();
    for (const r of order.requirements) materials.set(r.materialId, r.material);
    for (const c of custody) materials.set(c.materialId, c.material);
    for (const c of consumptions) materials.set(c.materialId, c.material);

    const sum =
      (pred: (mv: (typeof movements)[number]) => boolean) =>
      (materialId: string) =>
        roundGrams(
          movements
            .filter(
              (mv) =>
                mv.status === MovementStatus.CONFIRMED &&
                mv.materialId === materialId &&
                pred(mv),
            )
            .reduce((s, mv) => s + mv.grams, 0),
        );
    const delivered = sum(
      (mv) =>
        mv.type === MovementType.CUSTODY_ACCEPTANCE &&
        mv.toLocationId === wsLoc.id,
    );
    const returned = sum(
      (mv) => mv.type === MovementType.RETURN && mv.fromLocationId === wsLoc.id,
    );
    const losses = sum(
      (mv) =>
        [MovementType.LOSS].includes(mv.type) && mv.fromLocationId === wsLoc.id,
    );
    const adjIn = sum(
      (mv) =>
        mv.type === MovementType.ADJUSTMENT && mv.toLocationId === wsLoc.id,
    );
    const consumedPosted = sum(
      (mv) =>
        mv.type === MovementType.CONSUMPTION && mv.fromLocationId === wsLoc.id,
    );

    const lines: ReconciliationLine[] = [];
    for (const [materialId, material] of materials) {
      const consumed = roundGrams(
        consumptions
          .filter((c) => c.materialId === materialId)
          .reduce((s, c) => s + c.grams, 0),
      );
      const custodyNow = roundGrams(
        (custody.find((c) => c.materialId === materialId)?.balance ?? 0) +
          consumedPosted(materialId),
      );
      const unexplained = roundGrams(custodyNow - consumed);
      const custodyDisc = discrepancies.filter(
        (d) =>
          d.materialId === materialId &&
          [
            DiscrepancyType.CUSTODY_SHORTAGE,
            DiscrepancyType.CUSTODY_SURPLUS,
            DiscrepancyType.DISPATCH_DIFFERENCE,
          ].includes(d.type),
      );
      lines.push({
        materialId,
        materialCode: material.code,
        materialName: material.name,
        deliveredGrams: delivered(materialId),
        returnedGrams: returned(materialId),
        postedAdjustmentsGrams: roundGrams(
          adjIn(materialId) - losses(materialId),
        ),
        custodyGrams: custodyNow,
        consumedGrams: consumed,
        unexplainedGrams: unexplained,
        approvedDifferenceGrams: roundGrams(
          custodyDisc
            .filter((d) => d.status === DiscrepancyStatus.APPROVED)
            .reduce((s, d) => s + d.grams, 0),
        ),
        pendingDifferenceGrams: roundGrams(
          custodyDisc
            .filter((d) => d.status === DiscrepancyStatus.PENDING)
            .reduce((s, d) => s + d.grams, 0),
        ),
        balanced: Math.abs(unexplained) <= GRAM_EPSILON,
      });
    }
    const finishedGrams = roundGrams(
      receipts
        .flatMap((r) => r.lines)
        .filter((l) => l.lineType === ReceiptLineType.FINISHED_PRODUCT)
        .reduce((s, l) => s + l.grams, 0),
    );
    const finishedUnits = receipts
      .flatMap((r) => r.lines)
      .filter((l) => l.lineType === ReceiptLineType.FINISHED_PRODUCT)
      .reduce((s, l) => s + (l.units ?? 0), 0);
    const totalConsumed = roundGrams(
      lines.reduce((s, l) => s + l.consumedGrams, 0),
    );
    const processLoss = roundGrams(totalConsumed - finishedGrams);
    const processLossPct =
      totalConsumed > 0 ? roundGrams((processLoss / totalConsumed) * 100) : 0;
    const tolerancePct =
      order.product.lossTolerancePct ??
      (await this.params.get<number>(PARAM.DEFAULT_LOSS_TOLERANCE_PCT, 2));
    const processDisc = discrepancies.filter(
      (d) =>
        d.type === DiscrepancyType.PROCESS_LOSS &&
        d.status !== DiscrepancyStatus.REJECTED,
    );
    const pending = discrepancies.filter(
      (d) => d.status === DiscrepancyStatus.PENDING,
    );
    const hasFinal = receipts.some((r) => r.type === ReceiptType.FINAL);
    const processLossRegistered =
      Math.abs(processLoss) <= GRAM_EPSILON || processDisc.length > 0;
    const blockers: string[] = [];
    if (!hasFinal)
      blockers.push('Falta la recepción final del producto terminado');
    for (const l of lines.filter((x) => !x.balanced))
      blockers.push(
        `${l.materialName}: diferencia sin explicar de ${l.unexplainedGrams} g`,
      );
    if (!processLossRegistered)
      blockers.push(`Merma de proceso de ${processLoss} g sin registrar`);
    if (pending.length)
      blockers.push(
        `${pending.length} diferencia(s) pendiente(s) de justificación/aprobación`,
      );
    return {
      orderId,
      orderNumber: order.number,
      status: order.status,
      lines,
      transformation: {
        totalConsumedGrams: totalConsumed,
        finishedGrams,
        finishedUnits,
        processLossGrams: processLoss,
        processLossPct,
        tolerancePct,
        withinTolerance: Math.abs(processLossPct) <= tolerancePct,
        registered: processLossRegistered,
      },
      discrepancies,
      balanced: blockers.length === 0,
      blockers,
    };
  }

  /**
   * RN-010 / CA-008: registra como diferencia todo lo no explicado y la merma de
   * proceso. Dentro de tolerancia → aprobada automáticamente (queda registrada);
   * fuera de tolerancia → PENDIENTE de justificación y aprobación.
   */
  async generateDiscrepancies(orderId: string, user: AuthUser) {
    await this.ds.transaction(async (m) => {
      const order = await this.orders.findOrFail(orderId, undefined, m, true);
      this.state.assertStatus(
        order,
        [S.IN_REVIEW],
        'generar diferencias de conciliación',
      );
      const rec = await this.compute(orderId, m);
      const custodyTol = await this.params.get<number>(
        PARAM.CUSTODY_TOLERANCE_GRAMS,
        0.01,
      );
      for (const l of rec.lines.filter((x) => !x.balanced)) {
        const pending = rec.discrepancies.some(
          (d) =>
            d.materialId === l.materialId &&
            d.status === DiscrepancyStatus.PENDING &&
            [
              DiscrepancyType.CUSTODY_SHORTAGE,
              DiscrepancyType.CUSTODY_SURPLUS,
            ].includes(d.type),
        );
        if (pending) continue;
        const within = Math.abs(l.unexplainedGrams) <= custodyTol;
        await this.registerDiscrepancy(
          m,
          order,
          {
            type:
              l.unexplainedGrams > 0
                ? DiscrepancyType.CUSTODY_SHORTAGE
                : DiscrepancyType.CUSTODY_SURPLUS,
            materialId: l.materialId,
            grams: l.unexplainedGrams,
            percent:
              l.deliveredGrams > 0
                ? roundGrams((l.unexplainedGrams / l.deliveredGrams) * 100)
                : null,
            tolerancePct: null,
            withinTolerance: within,
            reason: `Conciliación: custodia ${l.custodyGrams} g vs consumido ${l.consumedGrams} g`,
          },
          user,
        );
      }
      const t = rec.transformation;
      if (!t.registered) {
        await this.registerDiscrepancy(
          m,
          order,
          {
            type: DiscrepancyType.PROCESS_LOSS,
            materialId: null,
            grams: t.processLossGrams,
            percent: t.processLossPct,
            tolerancePct: t.tolerancePct,
            withinTolerance: t.withinTolerance && t.processLossGrams >= 0,
            reason: `Merma de proceso: consumido ${t.totalConsumedGrams} g, terminado ${t.finishedGrams} g`,
          },
          user,
        );
      }
    });
    return this.compute(orderId);
  }

  private async registerDiscrepancy(
    m: EntityManager,
    order: ProductionOrder,
    d: {
      type: DiscrepancyType;
      materialId: string | null;
      grams: number;
      percent: number | null;
      tolerancePct: number | null;
      withinTolerance: boolean;
      reason: string;
    },
    user: AuthUser,
  ) {
    const disc = await m.save(
      Discrepancy,
      m.create(Discrepancy, {
        number: await this.seq.next(m, 'DIF'),
        orderId: order.id,
        workshopId: order.workshopId,
        type: d.type,
        materialId: d.materialId,
        grams: d.grams,
        percent: d.percent,
        tolerancePct: d.tolerancePct,
        withinTolerance: d.withinTolerance,
        reason: d.reason,
        responsibleParty: order.workshop?.name ?? null,
        status: d.withinTolerance
          ? DiscrepancyStatus.APPROVED
          : DiscrepancyStatus.PENDING,
        autoApproved: d.withinTolerance,
        justification: d.withinTolerance
          ? 'Dentro de tolerancia parametrizada'
          : null,
        approvedAt: d.withinTolerance ? new Date() : null,
        registeredById: user.id,
      }),
    );
    if (d.withinTolerance) await this.postDiscrepancy(m, disc, user);
    else {
      await this.events.emitAsync(ALERT_RAISE, {
        type: AlertType.DIFFERENCE,
        severity: AlertSeverity.CRITICAL,
        title: `Diferencia fuera de tolerancia en ${order.number}`,
        message: d.reason,
        entityType: 'Discrepancy',
        entityId: disc.id,
        workshopId: order.workshopId,
        dedupKey: `DIFF:${disc.id}`,
      } satisfies AlertRaiseEvent);
    }
    return disc;
  }

  /** Contabiliza en el kardex la diferencia aprobada que afecta la custodia. */
  private async postDiscrepancy(
    m: EntityManager,
    disc: Discrepancy,
    user: AuthUser,
  ) {
    if (!disc.materialId || !disc.orderId || disc.movementId) return;
    if (
      ![
        DiscrepancyType.CUSTODY_SHORTAGE,
        DiscrepancyType.CUSTODY_SURPLUS,
        DiscrepancyType.DISPATCH_DIFFERENCE,
      ].includes(disc.type)
    )
      return;
    const order = await m.findOneOrFail(ProductionOrder, {
      where: { id: disc.orderId },
      loadEagerRelations: false,
    });
    const wsLoc = await this.masters.workshopLocation(order.workshopId);
    const shortage = disc.grams > 0;
    const mv = await this.inventory.post(
      m,
      {
        type: shortage ? MovementType.LOSS : MovementType.ADJUSTMENT,
        materialId: disc.materialId,
        grams: Math.abs(disc.grams),
        fromLocationId: shortage ? wsLoc.id : null,
        toLocationId: shortage ? null : wsLoc.id,
        productionOrderId: order.id,
        sourceType: 'DISCREPANCY',
        sourceId: disc.id,
        reference: disc.number,
        notes: disc.justification ?? disc.reason,
        allowNegative: true,
      },
      user,
    );
    await m.update(Discrepancy, { id: disc.id }, { movementId: mv.id });
  }

  async createManual(
    orderId: string,
    dto: CreateDiscrepancyDto,
    user: AuthUser,
  ) {
    const order = await this.orders.findOrFail(orderId);
    if (dto.materialId) await this.masters.activeMaterial(dto.materialId);
    return this.ds.transaction(async (m) =>
      m.save(
        Discrepancy,
        m.create(Discrepancy, {
          number: await this.seq.next(m, 'DIF'),
          orderId,
          workshopId: order.workshopId,
          type: dto.type,
          materialId: dto.materialId ?? null,
          grams: roundGrams(dto.grams),
          reason: dto.reason,
          responsibleParty: dto.responsibleParty ?? order.workshop.name,
          status: DiscrepancyStatus.PENDING,
          registeredById: user.id,
        }),
      ),
    );
  }

  async list(q: DiscrepancyQueryDto, user: AuthUser) {
    const where: FindOptionsWhere<Discrepancy> = {};
    if (q.status) where.status = q.status;
    if (q.type) where.type = q.type;
    if (q.orderId) where.orderId = q.orderId;
    if (q.workshopId) where.workshopId = q.workshopId;
    if (user.workshopId) where.workshopId = user.workshopId;
    return paginated(
      await this.discrepancies.findAndCount({
        where,
        order: { createdAt: 'DESC' },
        skip: q.skip,
        take: q.pageSize,
      }),
      q,
    );
  }

  async justify(id: string, dto: JustifyDiscrepancyDto) {
    const d = await this.discrepancies.findOne({ where: { id } });
    if (!d) throw new NotFoundException('Diferencia no encontrada');
    if (d.status !== DiscrepancyStatus.PENDING)
      throw new BusinessRuleException(
        'DISCREPANCY_CLOSED',
        'La diferencia ya fue resuelta',
      );
    d.justification = dto.justification;
    if (dto.responsibleParty) d.responsibleParty = dto.responsibleParty;
    return this.discrepancies.save(d);
  }

  /** RF-022: toda diferencia requiere justificación y aprobación de Prestige Gold. */
  async review(id: string, dto: ReviewDiscrepancyDto, user: AuthUser) {
    if (user.workshopId)
      throw new ForbiddenException(
        'El taller no puede aprobar diferencias (RN-009)',
      );
    return this.ds.transaction(async (m) => {
      const d = await m.findOne(Discrepancy, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
        loadEagerRelations: false,
      });
      if (!d) throw new NotFoundException('Diferencia no encontrada');
      if (d.status !== DiscrepancyStatus.PENDING)
        throw new BusinessRuleException(
          'DISCREPANCY_CLOSED',
          'La diferencia ya fue resuelta',
        );
      if (dto.decision === DiscrepancyStatus.APPROVED && !d.justification) {
        throw new BusinessRuleException(
          'JUSTIFICATION_REQUIRED',
          'La diferencia debe estar justificada antes de aprobarse',
        );
      }
      d.status = dto.decision;
      d.approvedById = user.id;
      d.approvedAt = new Date();
      d.reviewNotes = dto.notes ?? null;
      await m.save(Discrepancy, d);
      if (d.status === DiscrepancyStatus.APPROVED)
        await this.postDiscrepancy(m, d, user);
      await this.audit.log(
        {
          action:
            dto.decision === DiscrepancyStatus.APPROVED
              ? AuditAction.APPROVE
              : AuditAction.REJECT,
          entityType: 'Discrepancy',
          entityId: id,
          description: `${d.number}: ${dto.decision}${dto.notes ? ` — ${dto.notes}` : ''}`,
        },
        m,
      );
      this.events.emit('alert.resolve', {
        dedupKey: `DIFF:${id}`,
        notes: `Diferencia ${dto.decision}`,
      });
      return m.findOneOrFail(Discrepancy, { where: { id } });
    });
  }

  /** FINISHED_BY_WORKSHOP → IN_REVIEW cuando el producto ya fue recibido (re-declaración tras ajuste). */
  async sendToReview(orderId: string, user: AuthUser) {
    await this.ds.transaction(async (m) => {
      const order = await this.orders.findOrFail(orderId, undefined, m, true);
      this.state.assertStatus(
        order,
        [S.FINISHED_BY_WORKSHOP],
        'enviar a revisión',
      );
      if (
        !(await m.exists(ProductionReceipt, {
          where: { orderId, type: ReceiptType.FINAL },
        }))
      ) {
        throw new BusinessRuleException(
          'NO_FINAL_RECEIPT',
          'Registre primero la recepción final del producto',
        );
      }
      await this.state.transition(
        m,
        order,
        S.IN_REVIEW,
        user,
        'Enviada a revisión',
      );
    });
    return this.orders.findOrFail(orderId);
  }

  /** Devolver a ajuste (Rechazada/Ajuste) con motivo. */
  async reject(orderId: string, reason: string, user: AuthUser) {
    if (user.workshopId)
      throw new ForbiddenException(
        'El taller no puede revisar su propia producción (RN-009)',
      );
    await this.ds.transaction(async (m) => {
      const order = await this.orders.findOrFail(orderId, undefined, m, true);
      this.state.assertStatus(
        order,
        [S.FINISHED_BY_WORKSHOP, S.IN_REVIEW],
        'devolver a ajuste',
      );
      await m.update(
        FinishedDeclaration,
        { orderId, current: true },
        { current: false },
      );
      await this.state.transition(
        m,
        order,
        S.REJECTED_ADJUSTMENT,
        user,
        reason,
      );
    });
    const order = await this.orders.findOrFail(orderId);
    await this.events.emitAsync(ALERT_RAISE, {
      type: AlertType.PENDING_OPERATION,
      severity: AlertSeverity.WARNING,
      title: `${order.number} devuelta a ajuste`,
      message: reason,
      entityType: 'ProductionOrder',
      entityId: orderId,
      workshopId: order.workshopId,
    } satisfies AlertRaiseEvent);
    return order;
  }

  // ---------------- Mano de obra (RF-018/024, RN-012) ----------------
  async listLabor(q: LaborQueryDto, user: AuthUser) {
    const where: FindOptionsWhere<LaborCost> = {};
    if (q.status) where.status = q.status;
    if (q.workshopId) where.workshopId = q.workshopId;
    if (user.workshopId) where.workshopId = user.workshopId;
    return paginated(
      await this.ds.getRepository(LaborCost).findAndCount({
        where,
        order: { createdAt: 'DESC' },
        skip: q.skip,
        take: q.pageSize,
      }),
      q,
    );
  }

  async decideLabor(
    laborId: string,
    dto: LaborDecisionDto,
    user: AuthUser,
    m?: EntityManager,
  ) {
    if (
      user.workshopId ||
      !user.permissions.includes(Permission.LABOR_APPROVE)
    ) {
      throw new ForbiddenException(
        'Solo Prestige Gold aprueba mano de obra (RN-012)',
      );
    }
    const run = async (em: EntityManager) => {
      const l = await em.findOne(LaborCost, {
        where: { id: laborId },
        lock: { mode: 'pessimistic_write' },
        loadEagerRelations: false,
      });
      if (!l) throw new NotFoundException('Mano de obra no encontrada');
      if (l.status !== ApprovalStatus.PROPOSED)
        throw new BusinessRuleException(
          'LABOR_REVIEWED',
          'La mano de obra ya fue revisada',
        );
      const order = await em.findOneOrFail(ProductionOrder, {
        where: { id: l.orderId },
      });
      l.status =
        dto.decision === 'APPROVE'
          ? ApprovalStatus.APPROVED
          : ApprovalStatus.REJECTED;
      l.approvedValue =
        dto.decision === 'APPROVE'
          ? roundMoney(dto.approvedValue ?? l.proposedValue)
          : null;
      l.reviewedById = user.id;
      l.reviewedAt = new Date();
      l.reviewNotes = dto.notes ?? null;
      await em.save(LaborCost, l);
      if (l.status === ApprovalStatus.APPROVED) {
        // RF-024: solo al aprobar impacta costos/contabilidad.
        await em.save(
          CostEntry,
          em.create(CostEntry, {
            type: CostType.LABOR,
            orderId: l.orderId,
            productId: order.productId,
            workshopId: l.workshopId,
            amount: l.approvedValue!,
            description: `Mano de obra ${order.number}`,
            periodDate: localDate(),
            sourceType: 'LaborCost',
            sourceId: l.id,
            approvedById: user.id,
          }),
        );
      }
      await this.audit.log(
        {
          action:
            l.status === ApprovalStatus.APPROVED
              ? AuditAction.APPROVE
              : AuditAction.REJECT,
          entityType: 'LaborCost',
          entityId: l.id,
          description: `Mano de obra ${order.number}: ${l.status} ${l.approvedValue ?? ''}`,
        },
        em,
      );
      return l;
    };
    return m ? run(m) : this.ds.transaction(run);
  }

  /**
   * RF-023 · Aprobar y cerrar. Solo Prestige Gold (RN-009). Exige conciliación sin
   * pendientes (RN-010/011), ley y calidad cuando aplica (RN-021, CA-013) y
   * decisión sobre mano de obra (RN-012). Contabiliza consumos, costos y producto.
   */
  async approve(orderId: string, dto: ApproveOrderDto, user: AuthUser) {
    if (user.workshopId)
      throw new ForbiddenException(
        'El taller no puede aprobar su propia producción (RN-009)',
      );
    const closed = await this.ds.transaction(async (m) => {
      const order = await this.orders.findOrFail(orderId, undefined, m, true);
      this.state.assertStatus(order, [S.IN_REVIEW], 'aprobar');
      const blockers: string[] = [];

      if (
        await m.exists(MaterialDispatch, {
          where: { orderId, status: DispatchStatus.PENDING_ACCEPTANCE },
        })
      )
        blockers.push('Hay entregas pendientes de aceptación por el taller');
      if (
        await m.exists(MaterialRequest, {
          where: {
            orderId,
            status: In([RequestStatus.PENDING, RequestStatus.APPROVED]),
          },
        })
      )
        blockers.push('Hay solicitudes de material sin resolver');
      const rec = await this.compute(orderId, m);
      blockers.push(...rec.blockers);

      const receipts = (
        await m.find(ProductionReceipt, { where: { orderId } })
      ).filter((r) =>
        r.lines.some((l) => l.lineType === ReceiptLineType.FINISHED_PRODUCT),
      );
      for (const r of receipts) {
        if (order.product.requiresQualityCheck) {
          const qc = await m.findOne(QualityCheck, {
            where: { receiptId: r.id },
            order: { checkedAt: 'DESC' },
          });
          if (!qc || qc.result !== QualityResult.APPROVED)
            blockers.push(
              `Recepción ${r.number}: control de calidad no aprobado`,
            );
        }
        if (order.product.requiresPurityCheck) {
          const pv = await m.findOne(PurityVerification, {
            where: { receiptId: r.id },
            order: { createdAt: 'DESC' },
          });
          if (!pv)
            blockers.push(
              `Recepción ${r.number}: falta verificación de ley/pureza (RN-021)`,
            );
          else if (!pv.conforming)
            blockers.push(
              `Recepción ${r.number}: ley ${pv.obtainedValue} fuera de tolerancia (objetivo ${pv.targetValue} ± ${pv.tolerance})`,
            );
        }
      }
      const proposed = await m.findOne(LaborCost, {
        where: { orderId, status: ApprovalStatus.PROPOSED },
      });
      if (proposed && !dto.labor)
        blockers.push(
          'Debe aprobar o rechazar la mano de obra propuesta por el taller',
        );
      if (blockers.length) {
        throw new BusinessRuleException(
          'APPROVAL_BLOCKED',
          `No se puede aprobar ${order.number}: ${blockers.join('; ')}`,
          { blockers },
        );
      }

      if (proposed && dto.labor)
        await this.decideLabor(proposed.id, dto.labor, user, m);

      // 1) Consumos aprobados salen de la custodia (kardex) con su costo.
      const wsLoc = await this.masters.workshopLocation(order.workshopId);
      const today = localDate();
      let materialCost = 0;
      for (const l of rec.lines.filter((x) => x.consumedGrams > GRAM_EPSILON)) {
        const material = await this.masters.getMaterial(l.materialId);
        await this.inventory.post(
          m,
          {
            type: MovementType.CONSUMPTION,
            materialId: l.materialId,
            grams: l.consumedGrams,
            fromLocationId: wsLoc.id,
            productionOrderId: orderId,
            sourceType: 'ORDER_APPROVAL',
            sourceId: orderId,
            reference: order.number,
            unitCost: material.referenceCost,
            notes: 'Consumo aprobado',
            allowNegative: false,
          },
          user,
        );
        const cost = roundMoney(l.consumedGrams * material.referenceCost);
        materialCost += cost;
        await m.save(
          CostEntry,
          m.create(CostEntry, {
            type: CostType.MATERIAL,
            orderId,
            productId: order.productId,
            workshopId: order.workshopId,
            materialId: l.materialId,
            grams: l.consumedGrams,
            amount: cost,
            description: `${material.name} consumido en ${order.number}`,
            periodDate: today,
            sourceType: 'ProductionOrder',
            sourceId: orderId,
            approvedById: user.id,
          }),
        );
      }
      const laborCost = roundMoney(
        (
          await m.find(LaborCost, {
            where: { orderId, status: ApprovalStatus.APPROVED },
          })
        ).reduce((s, l) => s + (l.approvedValue ?? 0), 0),
      );
      const totalCost = roundMoney(materialCost + laborCost);
      const finishedGrams = rec.transformation.finishedGrams;
      const costPerGram =
        finishedGrams > 0 ? roundMoney(totalCost / finishedGrams) : 0;

      // 2) Producto: intermedio → entra como material (Escenario B); final → liberado.
      if (order.product.outputMaterialId) {
        const output = await this.masters.getMaterial(
          order.product.outputMaterialId,
        );
        const office = await this.masters.motherOffice();
        const pv = await m.findOne(PurityVerification, {
          where: { orderId },
          order: { createdAt: 'DESC' },
        });
        const lot = await this.inventory.ensureLot(m, output, {
          productionOrderId: orderId,
          purity: pv?.obtainedValue ?? output.purity,
          origin: `Producción ${order.number}`,
        });
        await this.inventory.post(
          m,
          {
            type: MovementType.PRODUCTION_OUTPUT,
            materialId: output.id,
            lotId: lot?.id ?? null,
            grams: finishedGrams,
            toLocationId: office.id,
            productionOrderId: orderId,
            sourceType: 'ORDER_APPROVAL',
            sourceId: orderId,
            reference: order.number,
            unitCost: costPerGram,
            purity: pv?.obtainedValue ?? output.purity,
            origin: `Producción ${order.number}`,
          },
          user,
        );
      } else {
        const goods = await m.find(FinishedGood, { where: { orderId } });
        for (const g of goods) {
          const released =
            g.qualityStatus === QualityResult.APPROVED &&
            [PurityStatus.CONFORMING, PurityStatus.NOT_REQUIRED].includes(
              g.purityStatus,
            );
          await m.update(
            FinishedGood,
            { id: g.id },
            {
              status: released
                ? FinishedGoodStatus.AVAILABLE
                : FinishedGoodStatus.REJECTED,
              unitCostPerGram: costPerGram,
              totalCost: roundMoney(costPerGram * g.grams),
            },
          );
        }
      }

      // 3) Cierre con foto inmutable de la conciliación.
      const snapshot = {
        ...rec,
        approvedAt: new Date().toISOString(),
        materialCost: roundMoney(materialCost),
        laborCost: roundMoney(laborCost),
        totalCost,
        costPerGram,
        notes: dto.notes ?? null,
      };
      const fresh = await m.findOneOrFail(ProductionOrder, {
        where: { id: orderId },
        loadEagerRelations: false,
      });
      fresh.reconciliationSnapshot = JSON.parse(
        JSON.stringify(snapshot),
      ) as Record<string, unknown>;
      await m.save(ProductionOrder, fresh);
      await this.state.transition(
        m,
        order,
        S.APPROVED_CLOSED,
        user,
        dto.notes ?? 'Producción conciliada y costos autorizados',
      );
      await this.audit.log(
        {
          action: AuditAction.APPROVE,
          entityType: 'ProductionOrder',
          entityId: orderId,
          description: `Aprobación y cierre de ${order.number} · costo ${totalCost}`,
        },
        m,
      );
      return order;
    });
    if (dto.updateTechnicalSheet) {
      await this.catalog.createFromOrder(
        closed.productId,
        orderId,
        'Actualización desde producción aprobada',
        user,
      );
    }
    this.events.emit('alert.resolve', {
      dedupKey: `SHORTAGE:${orderId}`,
      notes: 'Orden cerrada',
    });
    return this.orders.findOrFail(orderId);
  }
}

import { startOfDay, endOfDay, localDate } from '../../../common/utils/dates';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  DataSource,
  EntityManager,
  FindOptionsWhere,
  ILike,
  In,
  LessThan,
  Not,
  Repository,
} from 'typeorm';
import { paginated } from '../../../common/dto/pagination.dto';
import {
  AlertSeverity,
  AlertType,
  DispatchStatus,
  InsufficiencyAction,
  OrderStatus as S,
  ReceiptLineType,
  RecordStatus,
  RequestStatus,
} from '../../../common/enums/domain.enums';
import { Permission } from '../../../common/enums/permission.enum';
import type { AuthUser } from '../../../common/types/auth-user';
import { BusinessRuleException } from '../../../common/utils/business-error';
import { GRAM_EPSILON, roundGrams } from '../../../common/utils/numeric';
import { assertWorkshopAccess } from '../../../common/utils/scope';
import { TechnicalSheet } from '../../catalog/entities/technical-sheet.entity';
import { InventoryService } from '../../inventory/inventory.service';
import { ConsumptionStandard } from '../../masters/entities/consumption-standard.entity';
import { Product } from '../../masters/entities/product.entity';
import { MastersService } from '../../masters/masters.service';
import { SequenceService } from '../../sequences/sequence.service';
import {
  CreateOrderDto,
  ModifyTargetDto,
  OrderQueryDto,
  UpdateOrderDto,
} from '../dto/production.dto';
import { ConsumptionReport } from '../entities/consumption-report.entity';
import { Discrepancy } from '../entities/discrepancy.entity';
import { FinishedDeclaration } from '../entities/finished-declaration.entity';
import { LaborCost } from '../entities/labor-cost.entity';
import { MaterialDispatch } from '../entities/material-dispatch.entity';
import { MaterialRequest } from '../entities/material-request.entity';
import { OrderDecision } from '../entities/order-decision.entity';
import { OrderMaterialRequirement } from '../entities/order-material-requirement.entity';
import { OrderStatusHistory } from '../entities/order-status-history.entity';
import { ProductionOrder } from '../entities/production-order.entity';
import { ProductionReceipt } from '../entities/production-receipt.entity';
import { ProgressReport } from '../entities/progress-report.entity';
import { PurityVerification } from '../entities/purity-verification.entity';
import { QualityCheck } from '../entities/quality-check.entity';
import { StageCompletion } from '../entities/stage-completion.entity';
import { ALERT_RAISE, AlertRaiseEvent } from '../production.events';
import { OrderStateService, STATUS_LABELS } from './order-state.service';
import { computeRequirements } from './requirements.util';

const OPEN_STATUSES = Object.values(S).filter(
  (s) => ![S.APPROVED_CLOSED, S.CANCELLED].includes(s),
);

export interface SufficiencyLine {
  materialId: string;
  materialCode: string;
  materialName: string;
  requiredGrams: number;
  dispatchedGrams: number;
  pendingGrams: number;
  availableInOffice: number;
  shortfallGrams: number;
  sufficient: boolean;
}

/** Órdenes de producción (RF-007/008/009, RN-006/008, P06). */
@Injectable()
export class OrdersService {
  constructor(
    private readonly ds: DataSource,
    @InjectRepository(ProductionOrder)
    private readonly orders: Repository<ProductionOrder>,
    @InjectRepository(OrderMaterialRequirement)
    private readonly reqs: Repository<OrderMaterialRequirement>,
    @InjectRepository(ConsumptionStandard)
    private readonly standards: Repository<ConsumptionStandard>,
    @InjectRepository(TechnicalSheet)
    private readonly sheets: Repository<TechnicalSheet>,
    private readonly masters: MastersService,
    private readonly inventory: InventoryService,
    private readonly seq: SequenceService,
    private readonly state: OrderStateService,
    private readonly events: EventEmitter2,
  ) {}

  async findOrFail(
    id: string,
    user?: AuthUser,
    m?: EntityManager,
    lock = false,
  ): Promise<ProductionOrder> {
    const repo = (m ?? this.ds.manager).getRepository(ProductionOrder);
    const order = lock
      ? await repo.findOne({
          where: { id },
          lock: { mode: 'pessimistic_write' },
          loadEagerRelations: false,
        })
      : await repo.findOne({
          where: { id },
          relations: { requirements: true },
        });
    if (!order) throw new NotFoundException('Orden no encontrada');
    if (user) assertWorkshopAccess(user, order.workshopId);
    if (lock) {
      // Con bloqueo no se cargan relaciones (FOR UPDATE no admite LEFT JOIN); se recargan.
      return repo.findOneOrFail({
        where: { id },
        relations: { requirements: true },
      });
    }
    return order;
  }

  private async validateBase(dto: {
    productId: string;
    workshopId: string;
    variantId?: string | null;
    targetUnits?: number | null;
  }) {
    const product = await this.masters.getProduct(dto.productId);
    if (product.status !== RecordStatus.ACTIVE)
      throw new BadRequestException('El producto está inactivo');
    const workshop = await this.masters.getWorkshop(dto.workshopId);
    if (workshop.status !== RecordStatus.ACTIVE)
      throw new BadRequestException('El taller está inactivo');
    await this.masters.assertWorkshopEnabled(product.id, workshop.id);
    if (
      dto.variantId &&
      !product.variants.some((v) => v.id === dto.variantId)
    ) {
      throw new BadRequestException('La variante no pertenece al producto');
    }
    return product;
  }

  private async buildRequirements(
    product: Product,
    dto: {
      targetGrams: number;
      targetUnits?: number | null;
      variantId?: string | null;
      extraRequirements?: {
        materialId: string;
        requiredGrams: number;
        tolerancePct?: number;
      }[];
    },
  ) {
    const standards = await this.standards.find({
      where: { productId: product.id, active: true },
    });
    const computed = computeRequirements(standards, {
      grams: dto.targetGrams,
      units: dto.targetUnits ?? null,
      variantId: dto.variantId ?? null,
    });
    type Req = {
      materialId: string;
      requiredGrams: number;
      tolerancePct: number;
      standardId: string | null;
      manual: boolean;
    };
    const map = new Map<string, Req>(
      computed.map((c) => [
        c.materialId,
        { ...c, manual: false, standardId: c.standardId },
      ]),
    );
    for (const e of dto.extraRequirements ?? []) {
      await this.masters.activeMaterial(e.materialId);
      map.set(e.materialId, {
        materialId: e.materialId,
        requiredGrams: roundGrams(e.requiredGrams),
        tolerancePct: e.tolerancePct ?? 5,
        standardId: null,
        manual: true,
      });
    }
    if (map.size === 0) {
      throw new BusinessRuleException(
        'ORDER_WITHOUT_MATERIALS',
        'La orden debe tener materiales requeridos (RN-006): configure el estándar de consumo del producto o agregue insumos',
      );
    }
    return [...map.values()];
  }

  async create(
    dto: CreateOrderDto,
    user: AuthUser,
    m?: EntityManager,
  ): Promise<ProductionOrder> {
    const product = await this.validateBase(dto);
    const requirements = await this.buildRequirements(product, dto);
    const sheet = product.currentSheetVersion
      ? await this.sheets.findOne({
          where: {
            productId: product.id,
            versionNumber: product.currentSheetVersion,
          },
        })
      : null;
    const run = async (em: EntityManager) => {
      const order = em.create(ProductionOrder, {
        number: await this.seq.next(em, 'OP', 4),
        productId: product.id,
        variantId: dto.variantId ?? null,
        workshopId: dto.workshopId,
        targetUnits: dto.targetUnits ?? null,
        targetGrams: roundGrams(dto.targetGrams),
        commitmentDate: dto.commitmentDate.slice(0, 10),
        priority: dto.priority,
        notes: dto.notes ?? null,
        technicalSheetId: sheet?.id ?? null,
        customerOperationId: dto.customerOperationId ?? null,
        createdById: user.id,
        status: S.DRAFT,
        requirements: requirements.map((r) =>
          em.create(OrderMaterialRequirement, r),
        ),
      });
      const saved = await em.save(ProductionOrder, order);
      await em.save(
        OrderStatusHistory,
        em.create(OrderStatusHistory, {
          orderId: saved.id,
          fromStatus: null,
          toStatus: S.DRAFT,
          userId: user.id,
          userName: user.fullName,
          reason: 'Creación',
        }),
      );
      return saved;
    };
    const saved = m ? await run(m) : await this.ds.transaction(run);
    return m ? saved : this.findOrFail(saved.id);
  }

  async update(id: string, dto: UpdateOrderDto, user: AuthUser) {
    return this.ds
      .transaction(async (m) => {
        const order = await this.findOrFail(id, user, m, true);
        this.state.assertStatus(
          order,
          [S.DRAFT, S.PENDING_MATERIALS, S.READY_FOR_DISPATCH],
          'editar la orden',
        );
        const hasDispatch = await m.exists(MaterialDispatch, {
          where: { orderId: id, status: Not(DispatchStatus.REJECTED) },
        });
        if (hasDispatch && (dto.productId || dto.workshopId)) {
          throw new BusinessRuleException(
            'ORDER_HAS_DISPATCHES',
            'No se puede cambiar producto o taller con material despachado',
          );
        }
        const merged = {
          productId: dto.productId ?? order.productId,
          workshopId: dto.workshopId ?? order.workshopId,
          variantId:
            dto.variantId !== undefined ? dto.variantId : order.variantId,
          targetUnits:
            dto.targetUnits !== undefined ? dto.targetUnits : order.targetUnits,
          targetGrams: dto.targetGrams ?? order.targetGrams,
          extraRequirements:
            dto.extraRequirements ??
            order.requirements
              .filter((r) => r.manual)
              .map((r) => ({
                materialId: r.materialId,
                requiredGrams: r.requiredGrams,
                tolerancePct: r.tolerancePct,
              })),
        };
        const product = await this.validateBase(merged);
        const requirements = await this.buildRequirements(product, merged);
        await m.update(
          ProductionOrder,
          { id },
          {
            productId: merged.productId,
            workshopId: merged.workshopId,
            variantId: merged.variantId ?? null,
            targetUnits: merged.targetUnits ?? null,
            targetGrams: roundGrams(merged.targetGrams),
            commitmentDate:
              dto.commitmentDate?.slice(0, 10) ?? order.commitmentDate,
            priority: dto.priority ?? order.priority,
            notes: dto.notes !== undefined ? dto.notes : order.notes,
            customerOperationId:
              dto.customerOperationId !== undefined
                ? dto.customerOperationId
                : order.customerOperationId,
          },
        );
        await this.replaceRequirements(m, id, requirements);
        if (order.status !== S.DRAFT) await this.reevaluate(m, id, user);
        return id;
      })
      .then((oid) => this.findOrFail(oid));
  }

  private async replaceRequirements(
    m: EntityManager,
    orderId: string,
    requirements: {
      materialId: string;
      requiredGrams: number;
      tolerancePct: number;
      standardId: string | null;
      manual: boolean;
    }[],
  ) {
    const existing = await m.find(OrderMaterialRequirement, {
      where: { orderId },
    });
    const keep = new Set(requirements.map((r) => r.materialId));
    const toRemove = existing.filter((e) => !keep.has(e.materialId));
    if (toRemove.length) await m.remove(OrderMaterialRequirement, toRemove);
    for (const r of requirements) {
      const e = existing.find((x) => x.materialId === r.materialId);
      if (e) await m.save(OrderMaterialRequirement, Object.assign(e, r));
      else
        await m.save(
          OrderMaterialRequirement,
          m.create(OrderMaterialRequirement, { ...r, orderId }),
        );
    }
  }

  /** RF-008/009 · Análisis de suficiencia por insumo contra inventario de Oficina Madre. */
  async sufficiency(
    orderId: string,
    m?: EntityManager,
  ): Promise<{ lines: SufficiencyLine[]; sufficient: boolean }> {
    const em = m ?? this.ds.manager;
    const order = await em.findOneOrFail(ProductionOrder, {
      where: { id: orderId },
      relations: { requirements: true },
    });
    const office = await this.masters.motherOffice();
    const lines: SufficiencyLine[] = [];
    for (const r of order.requirements) {
      const dispatched = await this.inventory.dispatchedForOrder(
        order.id,
        r.materialId,
        em,
      );
      const available = await this.inventory.available(
        em,
        office.id,
        r.materialId,
      );
      const pending = roundGrams(Math.max(0, r.requiredGrams - dispatched));
      const shortfall = roundGrams(Math.max(0, pending - available));
      lines.push({
        materialId: r.materialId,
        materialCode: r.material.code,
        materialName: r.material.name,
        requiredGrams: r.requiredGrams,
        dispatchedGrams: dispatched,
        pendingGrams: pending,
        availableInOffice: available,
        shortfallGrams: shortfall,
        sufficient: shortfall <= GRAM_EPSILON,
      });
    }
    return { lines, sufficient: lines.every((l) => l.sufficient) };
  }

  /** Borrador → planificada: queda Lista o Pendiente de materiales según suficiencia. */
  async plan(id: string, user: AuthUser) {
    await this.ds.transaction(async (m) => {
      const order = await this.findOrFail(id, user, m, true);
      this.state.assertStatus(order, [S.DRAFT], 'planificar la orden');
      if (!order.requirements.length)
        throw new BusinessRuleException(
          'ORDER_WITHOUT_MATERIALS',
          'La orden no tiene materiales requeridos',
        );
      await this.reevaluate(m, id, user);
    });
    return this.findOrFail(id);
  }

  /** Recalcula Lista/Pendiente y emite alerta preventiva de faltantes (RN-008). */
  async reevaluate(m: EntityManager, id: string, user: AuthUser) {
    const order = await m.findOneOrFail(ProductionOrder, { where: { id } });
    if (
      ![S.DRAFT, S.PENDING_MATERIALS, S.READY_FOR_DISPATCH].includes(
        order.status,
      )
    )
      return order;
    const { sufficient, lines } = await this.sufficiency(id, m);
    const target = sufficient ? S.READY_FOR_DISPATCH : S.PENDING_MATERIALS;
    await this.state.transition(
      m,
      order,
      target,
      user,
      sufficient
        ? 'Material suficiente en Oficina Madre'
        : 'Faltan insumos en Oficina Madre',
    );
    if (!sufficient) {
      const short = lines.filter((l) => !l.sufficient);
      await this.events.emitAsync(ALERT_RAISE, {
        type: AlertType.SHORTAGE,
        severity: AlertSeverity.WARNING,
        title: `Faltan insumos para ${order.number}`,
        message: short
          .map((l) => `${l.materialName}: faltan ${l.shortfallGrams} g`)
          .join('; '),
        entityType: 'ProductionOrder',
        entityId: order.id,
        dedupKey: `SHORTAGE:${order.id}`,
        data: { lines: short },
      } satisfies AlertRaiseEvent);
    }
    return order;
  }

  async refreshStatus(id: string, user: AuthUser) {
    await this.ds.transaction((m) => this.reevaluate(m, id, user));
    return this.findOrFail(id);
  }

  /** Modificar objetivo con autorización (Escenario C: "modificar la orden con autorización"). */
  async modifyTarget(
    id: string,
    dto: ModifyTargetDto,
    user: AuthUser,
    m?: EntityManager,
  ) {
    if (!user.permissions.includes(Permission.ORDERS_AUTHORIZE_CHANGES)) {
      throw new ForbiddenException(
        'Modificar el objetivo de una orden requiere autorización',
      );
    }
    const run = async (em: EntityManager) => {
      const order = await this.findOrFail(id, user, em, true);
      this.state.assertStatus(
        order,
        [
          S.DRAFT,
          S.PENDING_MATERIALS,
          S.READY_FOR_DISPATCH,
          S.DISPATCHED,
          S.ACCEPTED_BY_WORKSHOP,
          S.IN_PRODUCTION,
        ],
        'modificar el objetivo',
      );
      const product = await this.masters.getProduct(order.productId);
      const requirements = await this.buildRequirements(product, {
        targetGrams: dto.targetGrams,
        targetUnits: dto.targetUnits ?? order.targetUnits,
        variantId: order.variantId,
        extraRequirements: order.requirements
          .filter((r) => r.manual)
          .map((r) => ({
            materialId: r.materialId,
            requiredGrams: r.requiredGrams,
            tolerancePct: r.tolerancePct,
          })),
      });
      await em.update(
        ProductionOrder,
        { id },
        {
          targetGrams: roundGrams(dto.targetGrams),
          targetUnits: dto.targetUnits ?? order.targetUnits,
        },
      );
      await this.replaceRequirements(em, id, requirements);
      await em.save(
        OrderDecision,
        em.create(OrderDecision, {
          orderId: id,
          action: InsufficiencyAction.MODIFY_ORDER,
          justification: dto.reason,
          details: {
            previousTargetGrams: order.targetGrams,
            newTargetGrams: dto.targetGrams,
            previousUnits: order.targetUnits,
            newUnits: dto.targetUnits ?? order.targetUnits,
          },
          decidedById: user.id,
          authorizedById: user.id,
        }),
      );
      await this.reevaluate(em, id, user);
    };
    if (m) await run(m);
    else await this.ds.transaction(run);
    return m ? null : this.findOrFail(id);
  }

  async list(q: OrderQueryDto, user: AuthUser) {
    const where: FindOptionsWhere<ProductionOrder> = {};
    const statuses = q.status
      ? Array.isArray(q.status)
        ? q.status
        : [q.status]
      : null;
    if (statuses) where.status = In(statuses);
    else if (q.open === 'true') where.status = In(OPEN_STATUSES);
    if (q.workshopId) where.workshopId = q.workshopId;
    if (user.workshopId) where.workshopId = user.workshopId;
    if (q.productId) where.productId = q.productId;
    if (q.overdue === 'true') {
      where.commitmentDate = LessThan(localDate());
      if (!statuses) where.status = In(OPEN_STATUSES);
    }
    if (q.from || q.to) {
      where.createdAt = Between(
        q.from ? startOfDay(q.from) : new Date(0),
        q.to ? endOfDay(q.to) : new Date(),
      );
    }
    const finalWhere = q.search
      ? [
          { ...where, number: ILike(`%${q.search}%`) },
          { ...where, product: { name: ILike(`%${q.search}%`) } },
        ]
      : where;
    return paginated(
      await this.orders.findAndCount({
        where: finalWhere,
        relations: { requirements: true },
        order: { createdAt: 'DESC' },
        skip: q.skip,
        take: q.pageSize,
      }),
      q,
    );
  }

  /** P06 · Detalle completo y seguimiento de la orden. */
  async detail(id: string, user: AuthUser) {
    const order = await this.findOrFail(id, user);
    const em = this.ds.manager;
    const workshopLoc = await this.masters.workshopLocation(order.workshopId);
    const [
      dispatches,
      consumptions,
      progress,
      completions,
      requests,
      declarations,
      labor,
      receipts,
      quality,
      purity,
      discrepancies,
      decisions,
      history,
      custody,
      sufficiency,
      stages,
    ] = await Promise.all([
      em.find(MaterialDispatch, {
        where: { orderId: id },
        relations: { responsible: true },
        order: { createdAt: 'DESC' },
      }),
      em.find(ConsumptionReport, {
        where: { orderId: id },
        order: { createdAt: 'DESC' },
      }),
      em.find(ProgressReport, {
        where: { orderId: id },
        order: { createdAt: 'DESC' },
      }),
      em.find(StageCompletion, { where: { orderId: id } }),
      em.find(MaterialRequest, {
        where: { orderId: id },
        order: { createdAt: 'DESC' },
      }),
      em.find(FinishedDeclaration, {
        where: { orderId: id },
        order: { createdAt: 'DESC' },
      }),
      em.find(LaborCost, {
        where: { orderId: id },
        order: { createdAt: 'DESC' },
      }),
      em.find(ProductionReceipt, {
        where: { orderId: id },
        order: { createdAt: 'DESC' },
      }),
      em.find(QualityCheck, {
        where: { orderId: id },
        order: { checkedAt: 'DESC' },
      }),
      em.find(PurityVerification, {
        where: { orderId: id },
        order: { createdAt: 'DESC' },
      }),
      em.find(Discrepancy, {
        where: { orderId: id },
        order: { createdAt: 'DESC' },
      }),
      em.find(OrderDecision, {
        where: { orderId: id },
        order: { createdAt: 'DESC' },
      }),
      em.find(OrderStatusHistory, {
        where: { orderId: id },
        order: { createdAt: 'ASC' },
      }),
      this.inventory.orderCustody(id, workshopLoc.id),
      this.sufficiency(id),
      this.masters.stagesForProduct(order.product),
    ]);
    const consumedBy = new Map<string, number>();
    for (const c of consumptions.filter((c) => !c.voided))
      consumedBy.set(
        c.materialId,
        roundGrams((consumedBy.get(c.materialId) ?? 0) + c.grams),
      );
    const today = localDate();
    const isOpen = OPEN_STATUSES.includes(order.status);
    const delivered = order.deliveredAt ? localDate(order.deliveredAt) : null;
    return {
      ...order,
      statusLabel: STATUS_LABELS[order.status],
      overdue: isOpen && order.commitmentDate < today && !order.deliveredAt,
      onTime: delivered ? delivered <= order.commitmentDate : null,
      requirements: order.requirements.map((r) => {
        const s = sufficiency.lines.find((l) => l.materialId === r.materialId);
        const c = custody.find((x) => x.materialId === r.materialId);
        return {
          ...r,
          dispatchedGrams: s?.dispatchedGrams ?? 0,
          pendingGrams: s?.pendingGrams ?? 0,
          availableInOffice: s?.availableInOffice ?? 0,
          shortfallGrams: s?.shortfallGrams ?? 0,
          consumedGrams: consumedBy.get(r.materialId) ?? 0,
          custodyGrams: c?.balance ?? 0,
        };
      }),
      sufficiency,
      custody,
      stages: stages.map((s) => ({
        ...s,
        completed: completions.find((c) => c.stageId === s.id) ?? null,
      })),
      dispatches,
      consumptions,
      progress,
      requests,
      declarations,
      labor,
      receipts,
      quality,
      purity,
      discrepancies,
      decisions,
      history,
    };
  }

  /**
   * Cancelación con control de materiales: si hubo despachos, todo el material en
   * custodia debe haber retornado (recepción) antes de cancelar.
   */
  async cancel(id: string, reason: string, user: AuthUser) {
    await this.ds.transaction(async (m) => {
      const order = await this.findOrFail(id, user, m, true);
      this.state.assertStatus(
        order,
        [
          S.DRAFT,
          S.PENDING_MATERIALS,
          S.READY_FOR_DISPATCH,
          S.DISPATCHED,
          S.ACCEPTED_BY_WORKSHOP,
          S.IN_PRODUCTION,
          S.PARTIAL,
          S.REJECTED_ADJUSTMENT,
        ],
        'cancelar',
      );
      if (
        await m.exists(MaterialDispatch, {
          where: { orderId: id, status: DispatchStatus.PENDING_ACCEPTANCE },
        })
      ) {
        throw new BusinessRuleException(
          'PENDING_DISPATCH',
          'Hay entregas pendientes de aceptación: el taller debe aceptarlas o rechazarlas primero',
        );
      }
      const loc = await this.masters.workshopLocation(order.workshopId);
      const custody = await this.inventory.orderCustody(id, loc.id, m);
      const remaining = custody.filter(
        (c) => Math.abs(c.balance) > GRAM_EPSILON,
      );
      if (remaining.length) {
        throw new BusinessRuleException(
          'CUSTODY_NOT_RETURNED',
          `Para cancelar debe recibir primero el material en custodia: ${remaining.map((r) => `${r.material.name} ${r.balance} g`).join(', ')}`,
          { remaining },
        );
      }
      if (await m.exists(ProductionReceipt, { where: { orderId: id } })) {
        const finished = await m.find(ProductionReceipt, {
          where: { orderId: id },
        });
        if (
          finished.some((r) =>
            r.lines.some(
              (l) => l.lineType === ReceiptLineType.FINISHED_PRODUCT,
            ),
          )
        ) {
          throw new BusinessRuleException(
            'HAS_FINISHED_PRODUCT',
            'La orden ya tiene producto terminado recibido: debe cerrarse por aprobación o rechazo',
          );
        }
      }
      await m.update(
        MaterialRequest,
        {
          orderId: id,
          status: In([RequestStatus.PENDING, RequestStatus.APPROVED]),
        },
        { status: RequestStatus.CANCELLED },
      );
      await this.state.transition(m, order, S.CANCELLED, user, reason);
    });
    return this.findOrFail(id);
  }

  history(id: string) {
    return this.ds.manager.find(OrderStatusHistory, {
      where: { orderId: id },
      order: { createdAt: 'ASC' },
    });
  }
}

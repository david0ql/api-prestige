import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomUUID } from 'node:crypto';
import {
  DataSource,
  EntityManager,
  FindOptionsWhere,
  ILike,
  In,
  Repository,
} from 'typeorm';
import { paginated } from '../../../common/dto/pagination.dto';
import {
  AlertSeverity,
  AlertType,
  AuditAction,
  DiscrepancyStatus,
  DiscrepancyType,
  DispatchStatus,
  InsufficiencyAction,
  MovementType,
  OrderStatus as S,
  RecordStatus,
  RequestStatus,
  WeighingPurpose,
} from '../../../common/enums/domain.enums';
import { Permission } from '../../../common/enums/permission.enum';
import type { AuthUser } from '../../../common/types/auth-user';
import { BusinessRuleException } from '../../../common/utils/business-error';
import { GRAM_EPSILON, roundGrams } from '../../../common/utils/numeric';
import { assertWorkshopAccess } from '../../../common/utils/scope';
import { AuditService } from '../../audit/audit.service';
import { InventoryService } from '../../inventory/inventory.service';
import { Product } from '../../masters/entities/product.entity';
import { MastersService } from '../../masters/masters.service';
import { ParametersService, PARAM } from '../../masters/parameters.service';
import { ScaleService } from '../../scale/scale.service';
import { SequenceService } from '../../sequences/sequence.service';
import {
  CreateDispatchDto,
  DispatchQueryDto,
  PreviewDispatchDto,
  RespondDispatchDto,
} from '../dto/production.dto';
import { DigitalAcceptance } from '../entities/digital-acceptance.entity';
import { Discrepancy } from '../entities/discrepancy.entity';
import { DispatchLine } from '../entities/dispatch-line.entity';
import { MaterialDispatch } from '../entities/material-dispatch.entity';
import { MaterialRequest } from '../entities/material-request.entity';
import { OrderDecision } from '../entities/order-decision.entity';
import { ProductionOrder } from '../entities/production-order.entity';
import { ALERT_RAISE, AlertRaiseEvent } from '../production.events';
import {
  DISPATCHABLE_STATUSES,
  OrderStateService,
} from './order-state.service';
import { OrdersService } from './orders.service';

export interface InsufficiencyLine {
  materialId: string;
  materialName: string;
  requiredGrams: number;
  previouslyDispatched: number;
  thisDispatch: number;
  totalAssigned: number;
  shortfallGrams: number;
  availableInOffice: number;
  canCompleteFromInventory: boolean;
  fabricationProduct: { id: string; code: string; name: string } | null;
}

/**
 * Entregas a taller (RF-009/010/011, RN-003/004/005/008, P05, P08, Escenarios A y C).
 */
@Injectable()
export class DispatchService {
  constructor(
    private readonly ds: DataSource,
    @InjectRepository(MaterialDispatch)
    private readonly dispatches: Repository<MaterialDispatch>,
    private readonly orders: OrdersService,
    private readonly state: OrderStateService,
    private readonly inventory: InventoryService,
    private readonly scale: ScaleService,
    private readonly masters: MastersService,
    private readonly params: ParametersService,
    private readonly seq: SequenceService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
    private readonly config: ConfigService,
  ) {}

  /**
   * RF-009 / CA-003 / Escenario C: compara lo requerido por la orden contra lo
   * asignado (despachos previos + este) y propone acciones ante un faltante.
   */
  async analyze(
    orderId: string,
    lines: { materialId: string; grams: number }[],
    m?: EntityManager,
  ): Promise<{ insufficient: InsufficiencyLine[]; ok: boolean }> {
    const em = m ?? this.ds.manager;
    const order = await em.findOneOrFail(ProductionOrder, {
      where: { id: orderId },
      relations: { requirements: true },
    });
    const office = await this.masters.motherOffice();
    const insufficient: InsufficiencyLine[] = [];
    for (const r of order.requirements) {
      const thisDispatch = roundGrams(
        lines
          .filter((l) => l.materialId === r.materialId)
          .reduce((s, l) => s + l.grams, 0),
      );
      const previously = await this.inventory.dispatchedForOrder(
        order.id,
        r.materialId,
        em,
      );
      const total = roundGrams(previously + thisDispatch);
      const shortfall = roundGrams(r.requiredGrams - total);
      // Solo se evalúan los insumos incluidos en este despacho (o todos si es el primero).
      const evaluated = thisDispatch > 0 || previously === 0;
      if (evaluated && shortfall > GRAM_EPSILON) {
        const available = await this.inventory.available(
          em,
          office.id,
          r.materialId,
        );
        const fabrication = await em.findOne(Product, {
          where: {
            outputMaterialId: r.materialId,
            status: RecordStatus.ACTIVE,
          },
        });
        insufficient.push({
          materialId: r.materialId,
          materialName: r.material.name,
          requiredGrams: r.requiredGrams,
          previouslyDispatched: previously,
          thisDispatch,
          totalAssigned: total,
          shortfallGrams: shortfall,
          availableInOffice: roundGrams(available - thisDispatch),
          canCompleteFromInventory:
            available - thisDispatch >= shortfall - GRAM_EPSILON,
          fabricationProduct: fabrication
            ? {
                id: fabrication.id,
                code: fabrication.code,
                name: fabrication.name,
              }
            : null,
        });
      }
    }
    return { insufficient, ok: insufficient.length === 0 };
  }

  preview(dto: PreviewDispatchDto, user: AuthUser) {
    return this.orders
      .findOrFail(dto.orderId, user)
      .then(() => this.analyze(dto.orderId, dto.lines));
  }

  async create(dto: CreateDispatchDto, user: AuthUser) {
    const dispatchId = await this.ds.transaction(async (m) => {
      let order: ProductionOrder | null = null;
      let workshopId = dto.workshopId ?? null;
      if (dto.orderId) {
        order = await this.orders.findOrFail(dto.orderId, user, m, true);
        this.state.assertStatus(
          order,
          DISPATCHABLE_STATUSES,
          'despachar material',
        );
        workshopId = order.workshopId;
      }
      if (!workshopId)
        throw new BadRequestException('Indique el taller destino');
      const workshop = await this.masters.getWorkshop(workshopId);
      if (workshop.status !== RecordStatus.ACTIVE)
        throw new BadRequestException('El taller está inactivo');

      let request: MaterialRequest | null = null;
      if (dto.materialRequestId) {
        request = await m.findOne(MaterialRequest, {
          where: { id: dto.materialRequestId },
          lock: { mode: 'pessimistic_write' },
          loadEagerRelations: false,
        });
        if (!request || request.status !== RequestStatus.APPROVED)
          throw new BusinessRuleException(
            'REQUEST_NOT_APPROVED',
            'La solicitud de material no está aprobada',
          );
        if (request.workshopId !== workshopId)
          throw new BadRequestException('La solicitud es de otro taller');
      }

      const id = randomUUID();
      const office = await this.masters.motherOffice();
      const transit = await this.masters.transit();
      // 1) Pesajes de salida (RF-010): el peso de cada línea sale de la balanza.
      const weighed: {
        materialId: string;
        lotId: string | null;
        grams: number;
        weighingId: string;
      }[] = [];
      for (const l of dto.lines) {
        await this.masters.activeMaterial(l.materialId);
        const w = await this.scale.consume(
          m,
          l.weighingId,
          [WeighingPurpose.DISPATCH],
          'MaterialDispatch',
          id,
          l.materialId,
        );
        weighed.push({
          materialId: l.materialId,
          lotId: l.lotId ?? null,
          grams: w.currentNetGrams,
          weighingId: w.id,
        });
      }

      // 2) Suficiencia frente al estándar de la orden (RF-009 / RN-008).
      if (order) {
        const analysis = await this.analyze(order.id, weighed, m);
        if (!analysis.ok) {
          if (!dto.insufficiencyDecision) {
            throw new BusinessRuleException(
              'INSUFFICIENT_FOR_ORDER',
              `El material asignado no alcanza para el objetivo: ${analysis.insufficient.map((i) => `${i.materialName} faltan ${i.shortfallGrams} g`).join('; ')}`,
              {
                insufficient: analysis.insufficient,
                actions: [
                  InsufficiencyAction.COMPLETE_FROM_INVENTORY,
                  InsufficiencyAction.REQUEST_FABRICATION,
                  InsufficiencyAction.MODIFY_ORDER,
                  InsufficiencyAction.DISPATCH_PARTIAL,
                ],
              },
            );
          }
          await this.applyDecision(
            m,
            order,
            analysis.insufficient,
            dto.insufficiencyDecision,
            user,
          );
        }
      }

      // 3) Movimientos: Oficina Madre → Tránsito (RN-003 valida disponibilidad).
      const dispatch = m.create(MaterialDispatch, {
        id,
        number: await this.seq.next(m, 'DES'),
        orderId: order?.id ?? null,
        workshopId,
        purpose: dto.purpose,
        status: DispatchStatus.PENDING_ACCEPTANCE,
        materialRequestId: request?.id ?? null,
        responsibleId: user.id,
        notes: dto.notes ?? null,
        lines: [],
      });
      await m.save(MaterialDispatch, dispatch);
      for (const l of weighed) {
        const mv = await this.inventory.post(
          m,
          {
            type: MovementType.DISPATCH,
            materialId: l.materialId,
            lotId: l.lotId,
            grams: l.grams,
            fromLocationId: office.id,
            toLocationId: transit.id,
            productionOrderId: order?.id ?? null,
            weighingId: l.weighingId,
            sourceType: 'DISPATCH',
            sourceId: id,
            reference: dispatch.number,
            notes: dto.purpose,
            override: dto.overrideReason
              ? { reason: dto.overrideReason }
              : null,
          },
          user,
        );
        await m.save(
          DispatchLine,
          m.create(DispatchLine, {
            dispatchId: id,
            materialId: l.materialId,
            lotId: l.lotId,
            grams: l.grams,
            weighingId: l.weighingId,
            movementId: mv.id,
            overrideApplied: mv.overrideApplied,
          }),
        );
      }
      if (request) {
        await m.update(
          MaterialRequest,
          { id: request.id },
          { status: RequestStatus.DISPATCHED, dispatchId: id },
        );
      }
      if (
        order &&
        [S.PENDING_MATERIALS, S.READY_FOR_DISPATCH].includes(order.status)
      ) {
        await this.state.transition(
          m,
          order,
          S.DISPATCHED,
          user,
          `Despacho ${dispatch.number}`,
        );
      }
      return id;
    });
    return this.get(dispatchId);
  }

  /** Registra la decisión ante insuficiencia con trazabilidad (Escenario C). */
  private async applyDecision(
    m: EntityManager,
    order: ProductionOrder,
    insufficient: InsufficiencyLine[],
    decision: NonNullable<CreateDispatchDto['insufficiencyDecision']>,
    user: AuthUser,
  ) {
    for (const i of insufficient) {
      let generatedOrderId: string | null = null;
      let authorizedById: string | null = null;
      const details: Record<string, unknown> = {};
      if (decision.action === InsufficiencyAction.REQUEST_FABRICATION) {
        if (!i.fabricationProduct) {
          throw new BusinessRuleException(
            'NO_FABRICATION_PRODUCT',
            `No hay un producto configurado para fabricar ${i.materialName}`,
          );
        }
        const product = await this.masters.getProduct(i.fabricationProduct.id);
        const workshopId =
          decision.fabricationWorkshopId ??
          product.workshops.find((w) => w.enabled)?.workshopId;
        if (!workshopId)
          throw new BusinessRuleException(
            'NO_FABRICATION_WORKSHOP',
            'Indique el taller que fabricará el insumo',
          );
        const child = await this.orders.create(
          {
            productId: product.id,
            workshopId,
            targetGrams: i.shortfallGrams,
            commitmentDate: order.commitmentDate,
            notes: `Fabricación de ${i.shortfallGrams} g de ${i.materialName} por faltante en ${order.number}`,
          },
          user,
          m,
        );
        await m.update(
          ProductionOrder,
          { id: child.id },
          { parentOrderId: order.id },
        );
        generatedOrderId = child.id;
        details.generatedOrderNumber = child.number;
      } else if (decision.action === InsufficiencyAction.MODIFY_ORDER) {
        if (!user.permissions.includes(Permission.ORDERS_AUTHORIZE_CHANGES)) {
          throw new BusinessRuleException(
            'AUTHORIZATION_REQUIRED',
            'Modificar la orden por faltante requiere autorización (Gerencia)',
          );
        }
        authorizedById = user.id;
        const ratio = i.totalAssigned / i.requiredGrams;
        details.previousTargetGrams = order.targetGrams;
        details.newTargetGrams = roundGrams(order.targetGrams * ratio);
      }
      await m.save(
        OrderDecision,
        m.create(OrderDecision, {
          orderId: order.id,
          action: decision.action,
          materialId: i.materialId,
          requiredGrams: i.requiredGrams,
          assignedGrams: i.totalAssigned,
          shortfallGrams: i.shortfallGrams,
          justification: decision.justification,
          details,
          generatedOrderId,
          decidedById: user.id,
          authorizedById,
        }),
      );
    }
    if (decision.action === InsufficiencyAction.MODIFY_ORDER) {
      // Reduce el objetivo al material más restrictivo y recalcula requerimientos.
      const ratio = Math.min(
        ...insufficient.map((i) => i.totalAssigned / i.requiredGrams),
      );
      await this.orders.modifyTarget(
        order.id,
        {
          targetGrams: roundGrams(order.targetGrams * ratio),
          targetUnits: order.targetUnits
            ? Math.max(1, Math.floor(order.targetUnits * ratio))
            : null,
          reason: decision.justification,
        },
        user,
        m,
      );
    }
    await this.events.emitAsync(ALERT_RAISE, {
      type: AlertType.SHORTAGE,
      severity: AlertSeverity.WARNING,
      title: `Insuficiencia en despacho de ${order.number}`,
      message: `${insufficient.map((i) => `${i.materialName}: faltan ${i.shortfallGrams} g`).join('; ')}. Decisión: ${decision.action}`,
      entityType: 'ProductionOrder',
      entityId: order.id,
      workshopId: order.workshopId,
      dedupKey: `INSUFFICIENCY:${order.id}:${Date.now()}`,
    } satisfies AlertRaiseEvent);
  }

  async list(q: DispatchQueryDto, user: AuthUser) {
    const where: FindOptionsWhere<MaterialDispatch> = {};
    if (q.orderId) where.orderId = q.orderId;
    if (q.workshopId) where.workshopId = q.workshopId;
    if (user.workshopId) where.workshopId = user.workshopId;
    if (q.status) where.status = q.status;
    const finalWhere = q.search
      ? [
          { ...where, number: ILike(`%${q.search}%`) },
          { ...where, purpose: ILike(`%${q.search}%`) },
        ]
      : where;
    return paginated(
      await this.dispatches.findAndCount({
        where: finalWhere,
        relations: { responsible: true },
        order: { createdAt: 'DESC' },
        skip: q.skip,
        take: q.pageSize,
      }),
      q,
    );
  }

  async get(id: string, user?: AuthUser) {
    const d = await this.dispatches.findOne({
      where: { id },
      relations: { responsible: true },
    });
    if (!d) throw new NotFoundException('Despacho no encontrado');
    if (user) assertWorkshopAccess(user, d.workshopId);
    return d;
  }

  /**
   * RF-011 / RF-035 / P08: el taller confirma (o rechaza) material y peso recibido,
   * acepta el compromiso y firma digitalmente. Al aceptar, el material pasa de
   * tránsito a la custodia del taller (RN-004).
   */
  async respond(
    id: string,
    dto: RespondDispatchDto,
    user: AuthUser,
    client: { ip?: string; userAgent?: string },
  ) {
    if (!user.workshopId)
      throw new BusinessRuleException(
        'WORKSHOP_ONLY',
        'Solo el taller destinatario puede confirmar la entrega',
      );
    await this.ds.transaction(async (m) => {
      const d = await m.findOne(MaterialDispatch, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
        loadEagerRelations: false,
      });
      if (!d) throw new NotFoundException('Despacho no encontrado');
      assertWorkshopAccess(user, d.workshopId);
      if (d.status !== DispatchStatus.PENDING_ACCEPTANCE) {
        throw new BusinessRuleException(
          'DISPATCH_ALREADY_RESPONDED',
          'La entrega ya fue respondida',
        );
      }
      const lines = await m.find(DispatchLine, { where: { dispatchId: id } });
      const order = d.orderId
        ? await m.findOneOrFail(ProductionOrder, { where: { id: d.orderId } })
        : null;
      if (dto.decision === 'ACCEPT' && order && !dto.acceptCommitment) {
        throw new BusinessRuleException(
          'COMMITMENT_REQUIRED',
          'Debe aceptar el compromiso de producción y fecha de entrega',
        );
      }
      const transit = await this.masters.transit();
      const office = await this.masters.motherOffice();
      const wsLoc = await this.masters.workshopLocation(d.workshopId);
      const tolerance = await this.params.get<number>(
        PARAM.CUSTODY_TOLERANCE_GRAMS,
        0.01,
      );

      const declared = new Map(
        (dto.lines ?? []).map((l) => [l.lineId, roundGrams(l.receivedGrams)]),
      );
      if (dto.decision === 'ACCEPT') {
        for (const l of lines)
          if (!declared.has(l.id))
            throw new BadRequestException(
              'Debe declarar el peso recibido de cada línea',
            );
      }
      const payload = {
        dispatch: d.number,
        order: order?.number ?? null,
        commitmentDate: order?.commitmentDate ?? null,
        decision: dto.decision,
        lines: lines.map((l) => ({
          id: l.id,
          material: l.material.code,
          dispatchedGrams: l.grams,
          receivedGrams: declared.get(l.id) ?? null,
        })),
        signerName: dto.signerName,
        acceptCommitment: dto.acceptCommitment,
      };
      const acceptance = await m.save(
        DigitalAcceptance,
        m.create(DigitalAcceptance, {
          entityType: 'MaterialDispatch',
          entityId: id,
          decision: dto.decision,
          userId: user.id,
          signerName: dto.signerName,
          signatureImage: dto.signatureImage ?? null,
          payload,
          payloadHash: createHash('sha256')
            .update(JSON.stringify(payload))
            .digest('hex'),
          observations: dto.observations ?? null,
          ip: client.ip ?? null,
          userAgent: client.userAgent?.slice(0, 255) ?? null,
        }),
      );

      if (dto.decision === 'REJECT') {
        for (const l of lines) {
          await this.inventory.post(
            m,
            {
              type: MovementType.DISPATCH_REJECTION,
              materialId: l.materialId,
              lotId: l.lotId,
              grams: l.grams,
              fromLocationId: transit.id,
              toLocationId: office.id,
              productionOrderId: d.orderId,
              sourceType: 'DISPATCH',
              sourceId: id,
              reference: d.number,
              notes: `Rechazado por taller: ${dto.observations}`,
            },
            user,
          );
        }
        await m.update(
          MaterialDispatch,
          { id },
          {
            status: DispatchStatus.REJECTED,
            respondedAt: new Date(),
            workshopObservations: dto.observations ?? null,
            acceptanceId: acceptance.id,
          },
        );
        if (order && order.status === S.DISPATCHED) {
          const stillDispatched = await m.exists(MaterialDispatch, {
            where: {
              orderId: order.id,
              status: In([
                DispatchStatus.ACCEPTED,
                DispatchStatus.ACCEPTED_WITH_OBSERVATIONS,
              ]),
            },
          });
          const pending = await m.exists(MaterialDispatch, {
            where: {
              orderId: order.id,
              status: DispatchStatus.PENDING_ACCEPTANCE,
            },
          });
          if (!stillDispatched && !pending) {
            await this.state.transition(
              m,
              order,
              S.READY_FOR_DISPATCH,
              user,
              'Entrega rechazada por el taller',
            );
            await this.orders.reevaluate(m, order.id, user);
          }
        }
        await this.events.emitAsync(ALERT_RAISE, {
          type: AlertType.PENDING_OPERATION,
          severity: AlertSeverity.WARNING,
          title: `Entrega ${d.number} rechazada por el taller`,
          message: dto.observations ?? 'Sin observaciones',
          entityType: 'MaterialDispatch',
          entityId: id,
          workshopId: d.workshopId,
        } satisfies AlertRaiseEvent);
      } else {
        let withDifferences = false;
        for (const l of lines) {
          const received = declared.get(l.id)!;
          await this.inventory.post(
            m,
            {
              type: MovementType.CUSTODY_ACCEPTANCE,
              materialId: l.materialId,
              lotId: l.lotId,
              grams: l.grams,
              fromLocationId: transit.id,
              toLocationId: wsLoc.id,
              productionOrderId: d.orderId,
              sourceType: 'DISPATCH',
              sourceId: id,
              reference: d.number,
              notes: 'Aceptado por taller',
            },
            user,
          );
          await m.update(
            DispatchLine,
            { id: l.id },
            { receivedGrams: received },
          );
          const diff = roundGrams(l.grams - received);
          if (Math.abs(diff) > tolerance) {
            withDifferences = true;
            const disc = await m.save(
              Discrepancy,
              m.create(Discrepancy, {
                number: await this.seq.next(m, 'DIF'),
                orderId: d.orderId,
                workshopId: d.workshopId,
                type: DiscrepancyType.DISPATCH_DIFFERENCE,
                materialId: l.materialId,
                grams: diff,
                percent: roundGrams((diff / l.grams) * 100),
                tolerancePct: null,
                withinTolerance: false,
                reason: `Taller declara ${received} g recibidos de ${l.grams} g despachados (${d.number})`,
                responsibleParty: d.workshop?.name ?? null,
                status: DiscrepancyStatus.PENDING,
                sourceType: 'DispatchLine',
                sourceId: l.id,
                registeredById: user.id,
              }),
            );
            await this.events.emitAsync(ALERT_RAISE, {
              type: AlertType.DIFFERENCE,
              severity: AlertSeverity.CRITICAL,
              title: `Diferencia de peso en entrega ${d.number}`,
              message: `${l.material.name}: despachado ${l.grams} g, recibido ${received} g (dif. ${diff} g)`,
              entityType: 'Discrepancy',
              entityId: disc.id,
              workshopId: d.workshopId,
              dedupKey: `DIFF:${disc.id}`,
            } satisfies AlertRaiseEvent);
          }
        }
        await m.update(
          MaterialDispatch,
          { id },
          {
            status:
              withDifferences || dto.observations
                ? DispatchStatus.ACCEPTED_WITH_OBSERVATIONS
                : DispatchStatus.ACCEPTED,
            respondedAt: new Date(),
            workshopObservations: dto.observations ?? null,
            acceptanceId: acceptance.id,
          },
        );
        if (order && order.status === S.DISPATCHED) {
          await this.state.transition(
            m,
            order,
            S.ACCEPTED_BY_WORKSHOP,
            user,
            `Taller acepta ${d.number} y el compromiso al ${order.commitmentDate}`,
          );
        }
      }
      await this.audit.log(
        {
          action: AuditAction.SIGN,
          entityType: 'MaterialDispatch',
          entityId: id,
          description: `${dto.decision === 'ACCEPT' ? 'Aceptación' : 'Rechazo'} firmado por ${dto.signerName}`,
          after: { payloadHash: acceptance.payloadHash },
        },
        m,
      );
    });
    return this.get(id);
  }
}

import { randomUUID } from 'node:crypto';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, EntityManager, FindOptionsWhere, In, LessThan, Repository } from 'typeorm';
import { paginated } from '../../common/dto/pagination.dto';
import {
  AuditAction,
  LocationType,
  MovementStatus,
  MovementType,
  OrderStatus,
  WeighingPurpose,
} from '../../common/enums/domain.enums';
import { Permission } from '../../common/enums/permission.enum';
import type { AuthUser } from '../../common/types/auth-user';
import { BusinessRuleException } from '../../common/utils/business-error';
import { GRAM_EPSILON, roundGrams } from '../../common/utils/numeric';
import { AuditService } from '../audit/audit.service';
import { Location } from '../masters/entities/location.entity';
import { Material } from '../masters/entities/material.entity';
import { MastersService } from '../masters/masters.service';
import { OrderMaterialRequirement } from '../production/entities/order-material-requirement.entity';
import { ScaleService } from '../scale/scale.service';
import { SequenceService } from '../sequences/sequence.service';
import {
  AdjustmentDto,
  BalanceQueryDto,
  KardexQueryDto,
  MovementQueryDto,
  RegisterEntryDto,
  ReverseDto,
  TransferDto,
} from './dto/inventory.dto';
import { InventoryBalance } from './entities/inventory-balance.entity';
import { InventoryMovement } from './entities/inventory-movement.entity';
import { MaterialLot } from './entities/material-lot.entity';

export interface PostMovementInput {
  /** Id predefinido (para enlazar pesajes antes de insertar). */
  id?: string;
  type: MovementType;
  materialId: string;
  lotId?: string | null;
  grams: number;
  fromLocationId?: string | null;
  toLocationId?: string | null;
  productionOrderId?: string | null;
  customerId?: string | null;
  weighingId?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  reference?: string | null;
  origin?: string | null;
  notes?: string | null;
  purity?: number | null;
  unitCost?: number | null;
  reversalOfId?: string | null;
  /** RN-003: permitir dejar el origen en negativo (solo con autorización auditada). */
  override?: { reason: string } | null;
  /** Permite saldo negativo sin autorización (p. ej. conciliación de sobrantes). */
  allowNegative?: boolean;
}

export const INVENTORY_CHANGED = 'inventory.changed';

/**
 * Núcleo de trazabilidad por gramos (RF-005/006, RN-001/003/004/015). Toda variación
 * de inventario pasa por `post()`: crea el movimiento inmutable y actualiza saldos
 * con bloqueo pesimista en la misma transacción.
 */
@Injectable()
export class InventoryService {
  constructor(
    private readonly ds: DataSource,
    @InjectRepository(InventoryMovement) private readonly movements: Repository<InventoryMovement>,
    @InjectRepository(InventoryBalance) private readonly balances: Repository<InventoryBalance>,
    @InjectRepository(MaterialLot) private readonly lots: Repository<MaterialLot>,
    @InjectRepository(Location) private readonly locations: Repository<Location>,
    @InjectRepository(OrderMaterialRequirement) private readonly requirements: Repository<OrderMaterialRequirement>,
    private readonly masters: MastersService,
    private readonly scale: ScaleService,
    private readonly seq: SequenceService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
  ) {}

  private async lockBalance(m: EntityManager, locationId: string, materialId: string, lotId: string | null) {
    const lotKey = lotId ?? 'NONE';
    const repo = m.getRepository(InventoryBalance);
    await repo
      .createQueryBuilder()
      .insert()
      .values({ locationId, materialId, lotId, lotKey, grams: 0 })
      .orIgnore()
      .execute();
    return repo.findOneOrFail({
      where: { locationId, materialId, lotKey },
      lock: { mode: 'pessimistic_write' }, loadEagerRelations: false,
    });
  }

  /** Saldo disponible en una ubicación (todos los lotes o uno). */
  async available(m: EntityManager | null, locationId: string, materialId: string, lotId?: string | null) {
    const repo = (m ?? this.ds.manager).getRepository(InventoryBalance);
    const where: FindOptionsWhere<InventoryBalance> = { locationId, materialId };
    if (lotId) where.lotId = lotId;
    const total = await repo.sum('grams', where);
    return roundGrams(total ?? 0);
  }

  /**
   * Si no se indica lote, asigna FIFO: primero el saldo sin lote y luego los lotes
   * más antiguos, conservando el lote en el destino (trazabilidad por lote).
   */
  private async allocate(m: EntityManager, locationId: string, materialId: string, grams: number) {
    const rows = await m.find(InventoryBalance, {
      where: { locationId, materialId },
      lock: { mode: 'pessimistic_write' },
      loadEagerRelations: false,
      order: { lotKey: 'ASC' },
    });
    const none = rows.find((r) => r.lotKey === 'NONE');
    const lots = rows.filter((r) => r.lotKey !== 'NONE' && r.grams > GRAM_EPSILON);
    const lotDates = lots.length
      ? new Map((await m.find(MaterialLot, { where: { id: In(lots.map((l) => l.lotId!)) }, loadEagerRelations: false })).map((l) => [l.id, l.createdAt.getTime()]))
      : new Map<string, number>();
    lots.sort((a, b) => (lotDates.get(a.lotId!) ?? 0) - (lotDates.get(b.lotId!) ?? 0));
    const ordered = [...(none && none.grams > GRAM_EPSILON ? [none] : []), ...lots];
    const total = roundGrams(ordered.reduce((s, r) => s + r.grams, 0));
    if (total + GRAM_EPSILON < grams) return [{ lotId: null as string | null, grams }];
    const out: { lotId: string | null; grams: number }[] = [];
    let remaining = grams;
    for (const r of ordered) {
      if (remaining <= GRAM_EPSILON) break;
      const take = roundGrams(Math.min(r.grams, remaining));
      out.push({ lotId: r.lotId, grams: take });
      remaining = roundGrams(remaining - take);
    }
    return out;
  }

  /**
   * Registra el movimiento (o varios, uno por lote asignado) y actualiza saldos.
   * Devuelve el movimiento principal; todos comparten sourceType/sourceId.
   */
  async post(m: EntityManager, input: PostMovementInput, user: AuthUser): Promise<InventoryMovement> {
    const grams = roundGrams(input.grams);
    if (!(grams > 0)) throw new BusinessRuleException('WEIGHT_NOT_POSITIVE', 'La cantidad debe ser mayor que cero');
    if (!input.fromLocationId && !input.toLocationId) throw new BadRequestException('Movimiento sin origen ni destino');
    if (input.fromLocationId && input.fromLocationId === input.toLocationId) {
      throw new BadRequestException('Origen y destino no pueden ser iguales');
    }
    const allocations = input.fromLocationId && !input.lotId
      ? await this.allocate(m, input.fromLocationId, input.materialId, grams)
      : [{ lotId: input.lotId ?? null, grams }];

    const created: InventoryMovement[] = [];
    for (const [i, alloc] of allocations.entries()) {
      let overrideApplied = false;
      if (input.fromLocationId) {
        const bal = await this.lockBalance(m, input.fromLocationId, input.materialId, alloc.lotId);
        const after = roundGrams(bal.grams - alloc.grams);
        if (after < -GRAM_EPSILON && !input.allowNegative) {
          if (!input.override) {
            const totalAvailable = await this.available(m, input.fromLocationId, input.materialId);
            throw new BusinessRuleException(
              'INSUFFICIENT_STOCK',
              `Inventario insuficiente en origen: disponible ${totalAvailable} g, solicitado ${grams} g`,
              { available: totalAvailable, requested: grams, shortfall: roundGrams(grams - totalAvailable) },
            );
          }
          if (!user.permissions.includes(Permission.INVENTORY_OVERRIDE)) {
            throw new ForbiddenException('Despachar más de lo disponible requiere autorización excepcional');
          }
          overrideApplied = true;
        }
        bal.grams = after;
        bal.lastMovementAt = new Date();
        await m.save(InventoryBalance, bal);
      }
      if (input.toLocationId) {
        const bal = await this.lockBalance(m, input.toLocationId, input.materialId, alloc.lotId);
        bal.grams = roundGrams(bal.grams + alloc.grams);
        bal.lastMovementAt = new Date();
        await m.save(InventoryBalance, bal);
      }
      const movement = await m.save(
        InventoryMovement,
        m.create(InventoryMovement, {
          ...(input.id && i === 0 ? { id: input.id } : {}),
          number: await this.seq.next(m, 'MOV', 6),
          type: input.type,
          status: MovementStatus.CONFIRMED,
          materialId: input.materialId,
          lotId: alloc.lotId,
          grams: alloc.grams,
          purity: input.purity ?? null,
          fromLocationId: input.fromLocationId ?? null,
          toLocationId: input.toLocationId ?? null,
          productionOrderId: input.productionOrderId ?? null,
          customerId: input.customerId ?? null,
          weighingId: input.weighingId ?? null,
          sourceType: input.sourceType ?? null,
          sourceId: input.sourceId ?? null,
          reference: input.reference ?? null,
          origin: input.origin ?? null,
          notes: input.notes ?? null,
          unitCost: input.unitCost ?? null,
          overrideApplied,
          overrideReason: overrideApplied ? (input.override?.reason ?? null) : null,
          reversalOfId: input.reversalOfId ?? null,
          responsibleId: user.id,
        }),
      );
      if (overrideApplied) {
        await this.audit.log(
          {
            action: AuditAction.OVERRIDE,
            entityType: 'InventoryMovement',
            entityId: movement.id,
            description: `Autorización excepcional RN-003: ${input.override?.reason}`,
            after: { grams: alloc.grams, fromLocationId: input.fromLocationId },
          },
          m,
        );
      }
      created.push(movement);
    }
    this.events.emit(INVENTORY_CHANGED, { materialId: input.materialId });
    return created[0];
  }

  /** Busca o crea un lote. */
  async ensureLot(
    m: EntityManager,
    material: Material,
    data: { code?: string; purity?: number | null; origin?: string | null; customerId?: string | null; productionOrderId?: string | null },
  ): Promise<MaterialLot | null> {
    if (!data.code && !material.tracksLots && !data.customerId && !data.productionOrderId) return null;
    const code = data.code ?? (await this.seq.next(m, `L${material.code}`.slice(0, 20), 4));
    const existing = await m.findOne(MaterialLot, { where: { code } });
    if (existing) {
      if (existing.materialId !== material.id) throw new BadRequestException('El lote pertenece a otro material');
      return existing;
    }
    return m.save(
      MaterialLot,
      m.create(MaterialLot, {
        code,
        materialId: material.id,
        purity: data.purity ?? material.purity,
        origin: data.origin ?? null,
        customerId: data.customerId ?? null,
        productionOrderId: data.productionOrderId ?? null,
      }),
    );
  }

  /** RF-001 / CA-001: entrada pesada → inventario disponible Oficina Madre. */
  async registerEntry(dto: RegisterEntryDto, user: AuthUser) {
    const material = await this.masters.activeMaterial(dto.materialId);
    const office = await this.masters.motherOffice();
    return this.ds.transaction(async (m) => {
      // El peso SIEMPRE proviene del pesaje de Balanza Madre (RN-019).
      const movementId = randomUUID();
      const w = await this.scale.consume(m, dto.weighingId, [WeighingPurpose.ENTRY], 'InventoryMovement', movementId, material.id);
      const lot = await this.ensureLot(m, material, {
        code: dto.lotCode,
        purity: dto.purity,
        origin: dto.origin,
        customerId: dto.customerId,
      });
      return this.post(
        m,
        {
          id: movementId,
          type: MovementType.ENTRY,
          materialId: material.id,
          lotId: lot?.id ?? null,
          grams: w.currentNetGrams,
          toLocationId: office.id,
          productionOrderId: dto.productionOrderId ?? null,
          customerId: dto.customerId ?? null,
          weighingId: w.id,
          sourceType: 'ENTRY',
          reference: dto.reference ?? null,
          origin: dto.origin,
          notes: dto.notes ?? null,
          purity: dto.purity ?? material.purity,
          unitCost: dto.unitCost ?? material.referenceCost,
        },
        user,
      );
    });
  }

  /** Traslado entre ubicaciones que no son talleres (a talleres solo vía despacho). */
  async transfer(dto: TransferDto, user: AuthUser) {
    await this.masters.activeMaterial(dto.materialId);
    const [from, to] = await Promise.all([
      this.locations.findOne({ where: { id: dto.fromLocationId } }),
      this.locations.findOne({ where: { id: dto.toLocationId } }),
    ]);
    if (!from || !to) throw new BadRequestException('Ubicación inexistente');
    if ([from.type, to.type].includes(LocationType.WORKSHOP)) {
      throw new BusinessRuleException(
        'USE_DISPATCH',
        'Las entregas y retornos de talleres se registran con despacho/recepción para conservar la custodia',
      );
    }
    return this.ds.transaction(async (m) => {
      const movementId = randomUUID();
      let grams = dto.grams;
      if (dto.weighingId) {
        const w = await this.scale.consume(m, dto.weighingId, [WeighingPurpose.DISPATCH, WeighingPurpose.OTHER], 'InventoryMovement', movementId, dto.materialId);
        grams = w.currentNetGrams;
      }
      return this.post(
        m,
        {
          id: movementId,
          type: MovementType.TRANSFER,
          materialId: dto.materialId,
          lotId: dto.lotId ?? null,
          grams,
          fromLocationId: from.id,
          toLocationId: to.id,
          weighingId: dto.weighingId ?? null,
          sourceType: 'TRANSFER',
          notes: dto.reason,
        },
        user,
      );
    });
  }

  /** Ajuste auditado (requiere permiso de ajuste: Gerencia/Admin). */
  async adjust(dto: AdjustmentDto, user: AuthUser) {
    await this.masters.activeMaterial(dto.materialId);
    return this.ds.transaction(async (m) => {
      const movementId = randomUUID();
      let grams = dto.grams;
      if (dto.weighingId) {
        const w = await this.scale.consume(m, dto.weighingId, [WeighingPurpose.OTHER, WeighingPurpose.ENTRY], 'InventoryMovement', movementId, dto.materialId);
        grams = w.currentNetGrams;
      }
      const mv = await this.post(
        m,
        {
          id: movementId,
          type: MovementType.ADJUSTMENT,
          materialId: dto.materialId,
          lotId: dto.lotId ?? null,
          grams,
          fromLocationId: dto.direction === 'OUT' ? dto.locationId : null,
          toLocationId: dto.direction === 'IN' ? dto.locationId : null,
          weighingId: dto.weighingId ?? null,
          sourceType: 'ADJUSTMENT',
          notes: dto.reason,
        },
        user,
      );
      await this.audit.log(
        {
          action: AuditAction.OVERRIDE,
          entityType: 'InventoryMovement',
          entityId: mv.id,
          description: `Ajuste ${dto.direction} ${dto.grams} g: ${dto.reason}`,
        },
        m,
      );
      return mv;
    });
  }

  /**
   * RN-015: un movimiento confirmado no se borra; se reversa con el movimiento
   * opuesto. Solo entradas, traslados y ajustes manuales (los documentales se
   * revierten desde su documento para no romper la conciliación).
   */
  async reverse(id: string, dto: ReverseDto, user: AuthUser) {
    return this.ds.transaction(async (m) => {
      const mv = await m.findOne(InventoryMovement, { where: { id }, lock: { mode: 'pessimistic_write' }, loadEagerRelations: false });
      if (!mv) throw new NotFoundException('Movimiento no encontrado');
      if (mv.status === MovementStatus.REVERSED) throw new BusinessRuleException('ALREADY_REVERSED', 'El movimiento ya fue reversado');
      if (![MovementType.ENTRY, MovementType.TRANSFER, MovementType.ADJUSTMENT].includes(mv.type)) {
        throw new BusinessRuleException('REVERSE_FROM_DOCUMENT', 'Este movimiento se corrige desde su documento de origen');
      }
      const reversal = await this.post(
        m,
        {
          type: MovementType.REVERSAL,
          materialId: mv.materialId,
          lotId: mv.lotId,
          grams: mv.grams,
          fromLocationId: mv.toLocationId,
          toLocationId: mv.fromLocationId,
          productionOrderId: mv.productionOrderId,
          customerId: mv.customerId,
          sourceType: 'REVERSAL',
          sourceId: mv.id,
          reference: mv.number,
          notes: dto.reason,
          reversalOfId: mv.id,
        },
        user,
      );
      await m.update(InventoryMovement, { id: mv.id }, { status: MovementStatus.REVERSED });
      await this.audit.log(
        {
          action: AuditAction.REVERSE,
          entityType: 'InventoryMovement',
          entityId: mv.id,
          description: `Reverso de ${mv.number}: ${dto.reason}`,
          after: { reversalId: reversal.id },
        },
        m,
      );
      return reversal;
    });
  }

  // ---------------- Consultas ----------------

  /** P04: existencias por material, ubicación y lote (solo saldos ≠ 0). */
  async listBalances(q: BalanceQueryDto, user: AuthUser) {
    const where: FindOptionsWhere<InventoryBalance> = {};
    if (q.materialId) where.materialId = q.materialId;
    if (q.locationId) where.locationId = q.locationId;
    const locWhere: FindOptionsWhere<Location> = {};
    if (q.locationType) locWhere.type = q.locationType;
    if (q.workshopId) locWhere.workshopId = q.workshopId;
    if (user.workshopId) locWhere.workshopId = user.workshopId;
    if (Object.keys(locWhere).length) where.location = locWhere;
    if (q.categoryId) where.material = { categoryId: q.categoryId };
    const rows = await this.balances.find({ where, order: { material: { name: 'ASC' } } });
    return rows.filter((r) => Math.abs(r.grams) > GRAM_EPSILON);
  }

  /**
   * Resumen global por material (RF-005, RN-004, CA-002): el total bajo control de
   * Prestige Gold se mantiene aunque esté distribuido en custodias.
   */
  async globalSummary(user: AuthUser) {
    const rows = await this.listBalances({}, user);
    const committed = await this.committedByMaterial();
    const byMaterial = new Map<string, {
      material: Material; office: number; transit: number; workshops: number; other: number; total: number;
      committed: number; available: number; minStock: number; belowMin: boolean;
      byWorkshop: Record<string, { workshopId: string; code: string; name: string; grams: number }>;
    }>();
    for (const r of rows) {
      let e = byMaterial.get(r.materialId);
      if (!e) {
        e = { material: r.material, office: 0, transit: 0, workshops: 0, other: 0, total: 0, committed: 0, available: 0, minStock: r.material.minStock, belowMin: false, byWorkshop: {} };
        byMaterial.set(r.materialId, e);
      }
      const g = r.grams;
      if (r.location.type === LocationType.MOTHER_OFFICE) e.office += g;
      else if (r.location.type === LocationType.TRANSIT) e.transit += g;
      else if (r.location.type === LocationType.WORKSHOP && r.location.workshop) {
        e.workshops += g;
        const w = r.location.workshop;
        e.byWorkshop[w.id] ??= { workshopId: w.id, code: w.code, name: w.name, grams: 0 };
        e.byWorkshop[w.id].grams = roundGrams(e.byWorkshop[w.id].grams + g);
      } else e.other += g;
      e.total += g;
    }
    return [...byMaterial.values()].map((e) => {
      const c = committed.get(e.material.id) ?? 0;
      return {
        ...e,
        office: roundGrams(e.office),
        transit: roundGrams(e.transit),
        workshops: roundGrams(e.workshops),
        other: roundGrams(e.other),
        total: roundGrams(e.total),
        committed: roundGrams(c),
        available: roundGrams(e.office - c),
        belowMin: e.material.minStock > 0 && e.office < e.material.minStock,
        byWorkshop: Object.values(e.byWorkshop),
      };
    });
  }

  /** Comprometido = requerido por órdenes aún no despachadas por completo. */
  async committedByMaterial(): Promise<Map<string, number>> {
    const reqs = await this.requirements.find({
      where: { order: { status: In([OrderStatus.PENDING_MATERIALS, OrderStatus.READY_FOR_DISPATCH]) } },
      relations: { order: true },
    });
    const map = new Map<string, number>();
    for (const r of reqs) {
      const dispatched = await this.dispatchedForOrder(r.orderId, r.materialId);
      const pending = Math.max(0, r.requiredGrams - dispatched);
      map.set(r.materialId, (map.get(r.materialId) ?? 0) + pending);
    }
    return map;
  }

  /** Gramos despachados (en tránsito o aceptados) a una orden para un material. */
  async dispatchedForOrder(orderId: string, materialId: string, m?: EntityManager): Promise<number> {
    const repo = (m ?? this.ds.manager).getRepository(InventoryMovement);
    const out = await repo.sum('grams', {
      productionOrderId: orderId,
      materialId,
      type: MovementType.DISPATCH,
      status: MovementStatus.CONFIRMED,
    });
    const rejected = await repo.sum('grams', {
      productionOrderId: orderId,
      materialId,
      type: MovementType.DISPATCH_REJECTION,
      status: MovementStatus.CONFIRMED,
    });
    return roundGrams((out ?? 0) - (rejected ?? 0));
  }

  /**
   * Custodia de una orden por material: entra con la aceptación del taller y sale
   * con retornos, consumos aprobados y mermas. "Quién tiene cada gramo y para qué
   * producción" (Escenario A).
   */
  async orderCustody(orderId: string, workshopLocationId: string, m?: EntityManager) {
    const repo = (m ?? this.ds.manager).getRepository(InventoryMovement);
    const rows = await repo.find({
      where: [
        { productionOrderId: orderId, toLocationId: workshopLocationId, status: MovementStatus.CONFIRMED },
        { productionOrderId: orderId, fromLocationId: workshopLocationId, status: MovementStatus.CONFIRMED },
      ],
      order: { createdAt: 'ASC' },
    });
    const map = new Map<string, { materialId: string; material: Material; inGrams: number; outGrams: number; balance: number; since: Date | null }>();
    for (const r of rows) {
      const e = map.get(r.materialId) ?? { materialId: r.materialId, material: r.material, inGrams: 0, outGrams: 0, balance: 0, since: null };
      if (r.toLocationId === workshopLocationId) {
        e.inGrams += r.grams;
        e.since ??= r.createdAt;
      }
      if (r.fromLocationId === workshopLocationId) e.outGrams += r.grams;
      e.balance = roundGrams(e.inGrams - e.outGrams);
      map.set(r.materialId, e);
    }
    return [...map.values()].map((e) => ({ ...e, inGrams: roundGrams(e.inGrams), outGrams: roundGrams(e.outGrams) }));
  }

  /** RF-006 / reporte "Material por taller": qué tiene, desde cuándo y de qué orden. */
  async workshopCustody(workshopId: string) {
    const loc = await this.masters.workshopLocation(workshopId);
    const rows = await this.movements.find({
      where: [
        { toLocationId: loc.id, status: MovementStatus.CONFIRMED },
        { fromLocationId: loc.id, status: MovementStatus.CONFIRMED },
      ],
      order: { createdAt: 'ASC' },
    });
    const key = (r: InventoryMovement) => `${r.productionOrderId ?? 'SIN-ORDEN'}|${r.materialId}`;
    const map = new Map<string, { productionOrderId: string | null; materialId: string; material: Material; grams: number; since: Date | null }>();
    for (const r of rows) {
      const k = key(r);
      const e = map.get(k) ?? { productionOrderId: r.productionOrderId, materialId: r.materialId, material: r.material, grams: 0, since: null };
      if (r.toLocationId === loc.id) {
        e.grams += r.grams;
        e.since ??= r.createdAt;
      } else e.grams -= r.grams;
      e.grams = roundGrams(e.grams);
      map.set(k, e);
    }
    const balances = await this.balances.find({ where: { locationId: loc.id } });
    return {
      location: loc,
      totals: balances.filter((b) => Math.abs(b.grams) > GRAM_EPSILON).map((b) => ({ material: b.material, lot: b.lot, grams: b.grams })),
      byOrder: [...map.values()].filter((e) => Math.abs(e.grams) > GRAM_EPSILON),
    };
  }

  async listMovements(q: MovementQueryDto, user: AuthUser) {
    const base: FindOptionsWhere<InventoryMovement> = {};
    if (q.materialId) base.materialId = q.materialId;
    if (q.productionOrderId) base.productionOrderId = q.productionOrderId;
    if (q.type) base.type = q.type;
    if (q.from || q.to) {
      base.createdAt = Between(
        q.from ? new Date(q.from) : new Date(0),
        q.to ? new Date(`${q.to.slice(0, 10)}T23:59:59.999Z`) : new Date(),
      );
    }
    let where: FindOptionsWhere<InventoryMovement>[] | FindOptionsWhere<InventoryMovement> = base;
    const workshopId = user.workshopId ?? q.workshopId;
    if (workshopId) {
      const loc = await this.masters.workshopLocation(workshopId);
      where = [{ ...base, toLocationId: loc.id }, { ...base, fromLocationId: loc.id }];
    } else if (q.locationId) {
      where = [{ ...base, toLocationId: q.locationId }, { ...base, fromLocationId: q.locationId }];
    }
    return paginated(
      await this.movements.findAndCount({
        where,
        relations: { responsible: true },
        order: { createdAt: 'DESC' },
        skip: q.skip,
        take: q.pageSize,
      }),
      q,
    );
  }

  async getMovement(id: string, user: AuthUser) {
    const mv = await this.movements.findOne({ where: { id }, relations: { responsible: true, weighing: true } });
    if (!mv) throw new NotFoundException('Movimiento no encontrado');
    if (user.workshopId) {
      const wsIds = [mv.fromLocation?.workshopId, mv.toLocation?.workshopId];
      if (!wsIds.includes(user.workshopId)) throw new NotFoundException('Movimiento no encontrado');
    }
    return mv;
  }

  /** Kardex (reporte 15): entradas, salidas, devoluciones, ajustes y saldo corrido. */
  async kardex(q: KardexQueryDto) {
    const material = await this.masters.getMaterial(q.materialId);
    const from = q.from ? new Date(q.from) : new Date(0);
    const to = q.to ? new Date(`${q.to.slice(0, 10)}T23:59:59.999Z`) : new Date();
    const scope = (extra: FindOptionsWhere<InventoryMovement>) =>
      q.locationId
        ? [{ ...extra, toLocationId: q.locationId }, { ...extra, fromLocationId: q.locationId }]
        : [extra];

    // Saldo inicial = efecto neto de movimientos anteriores al rango.
    const prior = await this.movements.find({
      where: scope({ materialId: q.materialId, createdAt: LessThan(from) }),
    });
    const effect = (r: InventoryMovement) => {
      if (q.locationId) return (r.toLocationId === q.locationId ? r.grams : 0) - (r.fromLocationId === q.locationId ? r.grams : 0);
      // Global: solo cambia el total bajo control lo que entra o sale de Prestige Gold.
      return (r.toLocationId && !r.fromLocationId ? r.grams : 0) - (r.fromLocationId && !r.toLocationId ? r.grams : 0);
    };
    let balance = roundGrams(prior.reduce((s, r) => s + effect(r), 0));
    const opening = balance;
    const rows = await this.movements.find({
      where: scope({ materialId: q.materialId, createdAt: Between(from, to) }),
      relations: { responsible: true },
      order: { createdAt: 'ASC' },
    });
    const lines = rows.map((r) => {
      const e = effect(r);
      balance = roundGrams(balance + e);
      return {
        id: r.id,
        number: r.number,
        date: r.createdAt,
        type: r.type,
        status: r.status,
        from: r.fromLocation?.name ?? null,
        to: r.toLocation?.name ?? null,
        lot: r.lot?.code ?? null,
        inGrams: e > 0 ? e : 0,
        outGrams: e < 0 ? -e : 0,
        movedGrams: r.grams,
        balance,
        productionOrderId: r.productionOrderId,
        reference: r.reference,
        responsible: r.responsible?.fullName,
        notes: r.notes,
      };
    });
    return { material, opening, closing: balance, lines };
  }
}

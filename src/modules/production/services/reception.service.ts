import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import {
  AlertSeverity,
  AlertType,
  DiscrepancyStatus,
  DiscrepancyType,
  FinishedGoodStatus,
  MovementType,
  OrderStatus as S,
  PurityStatus,
  QualityResult,
  ReceiptLineType,
  ReceiptType,
  WeighingPurpose,
} from '../../../common/enums/domain.enums';
import type { AuthUser } from '../../../common/types/auth-user';
import { BusinessRuleException } from '../../../common/utils/business-error';
import { GRAM_EPSILON, roundGrams } from '../../../common/utils/numeric';
import { InventoryService } from '../../inventory/inventory.service';
import { MastersService } from '../../masters/masters.service';
import { ParametersService, PARAM } from '../../masters/parameters.service';
import { ScaleService } from '../../scale/scale.service';
import { SequenceService } from '../../sequences/sequence.service';
import { CreateReceiptDto, PurityVerificationDto, QualityCheckDto } from '../dto/production.dto';
import { ConsumptionReport } from '../entities/consumption-report.entity';
import { Discrepancy } from '../entities/discrepancy.entity';
import { FinishedDeclaration } from '../entities/finished-declaration.entity';
import { FinishedGood } from '../entities/finished-good.entity';
import { ProductionOrder } from '../entities/production-order.entity';
import { ProductionReceipt } from '../entities/production-receipt.entity';
import { PurityVerification } from '../entities/purity-verification.entity';
import { QualityCheck } from '../entities/quality-check.entity';
import { ReceiptLine } from '../entities/receipt-line.entity';
import { ALERT_RAISE, AlertRaiseEvent } from '../production.events';
import { OrderStateService } from './order-state.service';
import { OrdersService } from './orders.service';

/**
 * Recepción y control de calidad/ley (RF-019/020/043/044, RN-021, P11, CA-013).
 */
@Injectable()
export class ReceptionService {
  constructor(
    private readonly ds: DataSource,
    private readonly orders: OrdersService,
    private readonly state: OrderStateService,
    private readonly inventory: InventoryService,
    private readonly scale: ScaleService,
    private readonly masters: MastersService,
    private readonly params: ParametersService,
    private readonly seq: SequenceService,
    private readonly events: EventEmitter2,
  ) {}

  async create(orderId: string, dto: CreateReceiptDto, user: AuthUser) {
    const order = await this.orders.findOrFail(orderId);
    if (dto.type === ReceiptType.FINAL) {
      this.state.assertStatus(order, [S.FINISHED_BY_WORKSHOP], 'registrar la recepción final (el taller debe declarar el producto terminado)');
    } else {
      this.state.assertStatus(order, [S.ACCEPTED_BY_WORKSHOP, S.IN_PRODUCTION, S.PARTIAL, S.FINISHED_BY_WORKSHOP, S.IN_REVIEW, S.REJECTED_ADJUSTMENT], 'registrar una recepción parcial');
    }
    if (dto.type === ReceiptType.FINAL && !dto.lines.some((l) => l.lineType === ReceiptLineType.FINISHED_PRODUCT)) {
      throw new BadRequestException('La recepción final debe incluir el producto terminado');
    }
    const office = await this.masters.motherOffice();
    const wsLoc = await this.masters.workshopLocation(order.workshopId);
    const receiptId = randomUUID();
    const warnings: string[] = [];

    const result = await this.ds.transaction(async (m) => {
      const custody = await this.inventory.orderCustody(orderId, wsLoc.id, m);
      const lines: ReceiptLine[] = [];
      const returnedByMaterial = new Map<string, number>();
      for (const l of dto.lines) {
        const isProduct = l.lineType === ReceiptLineType.FINISHED_PRODUCT;
        if (!isProduct) await this.masters.activeMaterial(l.materialId!);
        const w = await this.scale.consume(m, l.weighingId, [WeighingPurpose.RECEPTION], 'ProductionReceipt', receiptId, isProduct ? null : l.materialId);
        if (!isProduct) {
          const prev = returnedByMaterial.get(l.materialId!) ?? 0;
          returnedByMaterial.set(l.materialId!, prev + w.currentNetGrams);
        }
        lines.push(m.create(ReceiptLine, {
          receiptId,
          lineType: l.lineType,
          materialId: isProduct ? null : l.materialId,
          units: l.units ?? null,
          grams: w.currentNetGrams,
          weighingId: w.id,
        }));
      }
      // RF-020: los retornos no pueden superar la custodia de la orden.
      for (const [materialId, grams] of returnedByMaterial) {
        const c = custody.find((x) => x.materialId === materialId);
        if (!c || grams > c.balance + GRAM_EPSILON) {
          throw new BusinessRuleException('RETURN_EXCEEDS_CUSTODY', `Se intenta recibir ${roundGrams(grams)} g de un material con ${c?.balance ?? 0} g en custodia para esta orden`);
        }
      }
      // Validación crítica de plausibilidad: terminado vs entradas.
      const finishedGrams = roundGrams(lines.filter((l) => l.lineType === ReceiptLineType.FINISHED_PRODUCT).reduce((s, l) => s + l.grams, 0));
      if (finishedGrams > 0) {
        const previousFinished = await this.finishedReceivedGrams(orderId, m);
        const deliveredTotal = custody.reduce((s, c) => s + c.inGrams, 0);
        const totalFinished = roundGrams(previousFinished + finishedGrams);
        if (totalFinished > deliveredTotal + GRAM_EPSILON) {
          throw new BusinessRuleException('IMPLAUSIBLE_FINISHED', `El producto terminado (${totalFinished} g) supera el material entregado a la orden (${roundGrams(deliveredTotal)} g)`);
        }
        const consumed = (await m.getRepository(ConsumptionReport).sum('grams', { orderId, voided: false })) ?? 0;
        if (totalFinished > consumed + GRAM_EPSILON) {
          warnings.push(`El terminado (${totalFinished} g) supera los consumos reportados por el taller (${roundGrams(consumed)} g)`);
        }
      }
      if (warnings.length && !dto.acknowledgeWarnings) {
        throw new BusinessRuleException('PLAUSIBILITY_WARNING', warnings.join('. '), { warnings });
      }

      // Comparación contra lo declarado por el taller (P11).
      const decl = await m.findOne(FinishedDeclaration, { where: { orderId, current: true }, order: { createdAt: 'DESC' } });
      let comparison: Record<string, unknown> | null = null;
      if (decl && dto.type === ReceiptType.FINAL) {
        const tolPct = await this.params.get<number>(PARAM.RECEPTION_TOLERANCE_PCT, 0.5);
        const diff = roundGrams(decl.grams - finishedGrams);
        const pct = decl.grams > 0 ? roundGrams((diff / decl.grams) * 100) : 0;
        comparison = { declaredGrams: decl.grams, receivedGrams: finishedGrams, differenceGrams: diff, differencePct: pct, declaredUnits: decl.units, receivedUnits: lines.reduce((s, l) => s + (l.units ?? 0), 0), tolerancePct: tolPct };
        if (Math.abs(pct) > tolPct) {
          const disc = await m.save(Discrepancy, m.create(Discrepancy, {
            number: await this.seq.next(m, 'DIF'), orderId, workshopId: order.workshopId,
            type: DiscrepancyType.RECEPTION_DIFFERENCE, materialId: null, grams: diff, percent: pct, tolerancePct: tolPct,
            withinTolerance: false, reason: `Taller declaró ${decl.grams} g; recibido en balanza ${finishedGrams} g`,
            responsibleParty: order.workshop.name, status: DiscrepancyStatus.PENDING, sourceType: 'ProductionReceipt', sourceId: receiptId,
            registeredById: user.id,
          }));
          await this.events.emitAsync(ALERT_RAISE, {
            type: AlertType.DIFFERENCE, severity: AlertSeverity.CRITICAL,
            title: `Diferencia en recepción de ${order.number}`, message: String(disc.reason),
            entityType: 'Discrepancy', entityId: disc.id, workshopId: order.workshopId, dedupKey: `DIFF:${disc.id}`,
          } satisfies AlertRaiseEvent);
        }
      }

      const receipt = await m.save(ProductionReceipt, m.create(ProductionReceipt, {
        id: receiptId, number: await this.seq.next(m, 'REC'), orderId, workshopId: order.workshopId,
        type: dto.type, notes: dto.notes ?? null, comparison, receivedById: user.id, lines: [],
      }));
      for (const line of lines) {
        const saved = await m.save(ReceiptLine, line);
        if (line.lineType !== ReceiptLineType.FINISHED_PRODUCT) {
          // Retorno físico pesado: sale de la custodia y vuelve a Oficina Madre.
          const mv = await this.inventory.post(m, {
            type: MovementType.RETURN, materialId: line.materialId!, grams: line.grams,
            fromLocationId: wsLoc.id, toLocationId: office.id, productionOrderId: orderId, weighingId: line.weighingId,
            sourceType: 'RECEIPT', sourceId: receiptId, reference: receipt.number, notes: line.lineType,
          }, user);
          await m.update(ReceiptLine, { id: saved.id }, { movementId: mv.id });
        } else if (!order.product.outputMaterialId) {
          // Producto terminado en CUARENTENA hasta aprobación con calidad y ley (RN-021/022).
          const fg = await m.save(FinishedGood, m.create(FinishedGood, {
            code: await this.seq.next(m, 'PT'), productId: order.productId, variantId: order.variantId, orderId,
            workshopId: order.workshopId, receiptId, locationId: office.id, units: line.units ?? 0, grams: line.grams,
            availableUnits: line.units ?? 0, availableGrams: line.grams, status: FinishedGoodStatus.QUARANTINE,
            qualityStatus: order.product.requiresQualityCheck ? QualityResult.PENDING : QualityResult.APPROVED,
            purityStatus: order.product.requiresPurityCheck ? PurityStatus.PENDING : PurityStatus.NOT_REQUIRED,
          }));
          await m.update(ReceiptLine, { id: saved.id }, { finishedGoodId: fg.id });
        }
      }
      const current = await m.findOneOrFail(ProductionOrder, { where: { id: orderId }, loadEagerRelations: false });
      if (dto.type === ReceiptType.FINAL) {
        await m.update(ProductionOrder, { id: orderId }, { deliveredAt: new Date() });
        await this.state.transition(m, current, S.IN_REVIEW, user, `Recepción final ${receipt.number}`);
      } else if (finishedGrams > 0 && [S.ACCEPTED_BY_WORKSHOP, S.IN_PRODUCTION].includes(current.status)) {
        await this.state.transition(m, current, S.PARTIAL, user, `Recepción parcial ${receipt.number}`);
      }
      return receipt;
    });
    this.events.emit('alert.resolve', { dedupKey: `TO_RECEIVE:${orderId}`, notes: 'Recepción registrada' });
    return { ...(await this.getReceipt(result.id)), warnings };
  }

  async finishedReceivedGrams(orderId: string, m = this.ds.manager) {
    const receipts = await m.find(ProductionReceipt, { where: { orderId } });
    return roundGrams(receipts.flatMap((r) => r.lines).filter((l) => l.lineType === ReceiptLineType.FINISHED_PRODUCT).reduce((s, l) => s + l.grams, 0));
  }

  async getReceipt(id: string) {
    const r = await this.ds.manager.findOne(ProductionReceipt, { where: { id } });
    if (!r) throw new NotFoundException('Recepción no encontrada');
    const [quality, purity] = await Promise.all([
      this.ds.manager.find(QualityCheck, { where: { receiptId: id }, order: { checkedAt: 'DESC' } }),
      this.ds.manager.find(PurityVerification, { where: { receiptId: id }, order: { createdAt: 'DESC' } }),
    ]);
    return { ...r, quality, purity };
  }

  private async receiptForOrder(orderId: string, receiptId: string) {
    const r = await this.ds.manager.findOne(ProductionReceipt, { where: { id: receiptId, orderId } });
    if (!r) throw new NotFoundException('Recepción no encontrada para la orden');
    if (!r.lines.some((l) => l.lineType === ReceiptLineType.FINISHED_PRODUCT)) {
      throw new BusinessRuleException('NO_FINISHED_PRODUCT', 'La recepción no contiene producto terminado');
    }
    return r;
  }

  /** Control de calidad de una recepción (P11). */
  async qualityCheck(orderId: string, receiptId: string, dto: QualityCheckDto, user: AuthUser) {
    const order = await this.orders.findOrFail(orderId);
    await this.receiptForOrder(orderId, receiptId);
    if (dto.result === QualityResult.APPROVED && dto.checklist.some((c) => !c.ok)) {
      throw new BusinessRuleException('CHECKLIST_FAILED', 'No se puede aprobar la calidad con ítems no conformes en la lista de chequeo');
    }
    const qc = await this.ds.transaction(async (m) => {
      const saved = await m.save(QualityCheck, m.create(QualityCheck, {
        orderId, receiptId, result: dto.result, checklist: dto.checklist, notes: dto.notes ?? null, inspectorId: user.id,
      }));
      await m.update(FinishedGood, { receiptId }, { qualityStatus: dto.result });
      return saved;
    });
    if (dto.result === QualityResult.REJECTED) {
      await this.events.emitAsync(ALERT_RAISE, {
        type: AlertType.QUALITY_REJECTED, severity: AlertSeverity.CRITICAL,
        title: `Calidad rechazada en ${order.number}`, message: dto.notes ?? 'Control de calidad no conforme',
        entityType: 'ProductionOrder', entityId: orderId, workshopId: order.workshopId,
      } satisfies AlertRaiseEvent);
    }
    return qc;
  }

  /**
   * RF-044: verificación de ley. Conforme si valor ≥ objetivo − tolerancia. El
   * objetivo sale de la ficha con la que se creó la orden (RN-023) o del producto.
   */
  async purityVerification(orderId: string, receiptId: string, dto: PurityVerificationDto, user: AuthUser) {
    const order = await this.orders.findOrFail(orderId);
    await this.receiptForOrder(orderId, receiptId);
    const target = order.technicalSheet?.targetPurity ?? order.product.targetPurity;
    const tolerance = order.technicalSheet?.purityTolerance ?? order.product.purityTolerance ?? 0;
    if (target === null || target === undefined) {
      throw new BusinessRuleException('NO_PURITY_TARGET', 'El producto no tiene ley/pureza objetivo configurada (RF-043)');
    }
    const conforming = dto.obtainedValue >= target - tolerance - 1e-9;
    const pv = await this.ds.transaction(async (m) => {
      const saved = await m.save(PurityVerification, m.create(PurityVerification, {
        orderId, receiptId, productId: order.productId, method: dto.method, supportReference: dto.supportReference ?? null,
        supportMediaId: dto.supportMediaId ?? null, obtainedValue: dto.obtainedValue, targetValue: target, tolerance,
        conforming, notes: dto.notes ?? null, verifiedById: user.id, verifiedAt: dto.verifiedAt ? new Date(dto.verifiedAt) : new Date(),
      }));
      await m.update(FinishedGood, { receiptId }, {
        purityStatus: conforming ? PurityStatus.CONFORMING : PurityStatus.NON_CONFORMING,
        verifiedPurity: dto.obtainedValue,
      });
      return saved;
    });
    if (!conforming) {
      await this.events.emitAsync(ALERT_RAISE, {
        type: AlertType.PURITY_NON_CONFORMING, severity: AlertSeverity.CRITICAL,
        title: `Ley fuera de estándar en ${order.number}`,
        message: `Obtenido ${dto.obtainedValue} vs objetivo ${target} (tol. ${tolerance}) por ${dto.method}`,
        entityType: 'ProductionOrder', entityId: orderId, workshopId: order.workshopId,
      } satisfies AlertRaiseEvent);
    }
    return pv;
  }
}

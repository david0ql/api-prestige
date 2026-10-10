import { startOfDay, endOfDay, localDate } from '../../common/utils/dates';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { Between, DataSource, In, IsNull, Not } from 'typeorm';
import {
  AlertStatus,
  ApprovalStatus,
  CostType,
  DiscrepancyStatus,
  MediaKind,
  MediaPurpose,
  OperationStatus,
  OrderStatus,
  ReceiptLineType,
  RequestStatus,
  TransactionSource,
  TransactionStatus,
  TransactionType,
} from '../../common/enums/domain.enums';
import type { AuthUser } from '../../common/types/auth-user';
import { roundGrams, roundMoney, round } from '../../common/utils/numeric';
import { Alert } from '../alerts/entities/alert.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { auditWhere, AuditQueryDto } from '../audit/audit.controller';
import { TechnicalSheet } from '../catalog/entities/technical-sheet.entity';
import { CostEntry } from '../finance/entities/cost-entry.entity';
import { FinancialTransaction } from '../finance/entities/financial-transaction.entity';
import { InventoryService } from '../inventory/inventory.service';
import { Customer } from '../masters/entities/customer.entity';
import { Product } from '../masters/entities/product.entity';
import { Workshop } from '../masters/entities/workshop.entity';
import { MastersService } from '../masters/masters.service';
import { MediaFile } from '../media/entities/media-file.entity';
import { ConsumptionReport } from '../production/entities/consumption-report.entity';
import { Discrepancy } from '../production/entities/discrepancy.entity';
import { LaborCost } from '../production/entities/labor-cost.entity';
import { MaterialRequest } from '../production/entities/material-request.entity';
import { ProductionOrder } from '../production/entities/production-order.entity';
import { ProductionReceipt } from '../production/entities/production-receipt.entity';
import { PurityVerification } from '../production/entities/purity-verification.entity';
import { StageCompletion } from '../production/entities/stage-completion.entity';
import { STATUS_LABELS } from '../production/services/order-state.service';
import { CustomerMaterialContribution } from '../sales/entities/customer-material-contribution.entity';
import { CustomerPayment } from '../sales/entities/customer-payment.entity';
import { SaleDispatch } from '../sales/entities/sale-dispatch.entity';
import { CustomerOperation } from '../sales/entities/customer-operation.entity';
import { User } from '../users/entities/user.entity';
import { TabularReport } from './reports.types';

export interface ReportFilters {
  from?: string;
  to?: string;
  workshopId?: string;
  productId?: string;
  materialId?: string;
  customerId?: string;
}

const month = (d: Date | string) =>
  typeof d === 'string' ? d.slice(0, 7) : localDate(d).slice(0, 7);
const days = (a: Date, b: Date) => (b.getTime() - a.getTime()) / 86400_000;

/** Reportes e indicadores (sección 15, RF-029…033, RF-040, P02/P15/P16). */
@Injectable()
export class ReportsService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly inventory: InventoryService,
    private readonly masters: MastersService,
  ) {}

  private period(f: ReportFilters) {
    const now = new Date();
    const from = f.from?.slice(0, 10) ?? `${localDate(now).slice(0, 7)}-01`;
    const to = f.to?.slice(0, 10) ?? localDate(now);
    return {
      from,
      to,
      fromDate: startOfDay(from),
      toDate: endOfDay(to),
    };
  }

  readonly catalog: Record<
    string,
    { title: string; financial?: boolean; audit?: boolean }
  > = {
    'inventory-global': { title: 'Inventario global' },
    kardex: { title: 'Kardex de material' },
    'workshop-material': { title: 'Material por taller' },
    orders: { title: 'Órdenes de producción' },
    productivity: { title: 'Productividad mensual' },
    compliance: { title: 'Cumplimiento' },
    'consumption-vs-standard': { title: 'Consumo vs estándar' },
    losses: { title: 'Mermas y diferencias' },
    'production-costs': { title: 'Costos por producción', financial: true },
    profitability: { title: 'Rentabilidad', financial: true },
    customers: { title: 'Clientes y abonos', financial: true },
    audit: { title: 'Auditoría', audit: true },
    catalog: { title: 'Catálogo técnico de modelos' },
    'visual-traceability': { title: 'Trazabilidad visual' },
    'purity-control': { title: 'Control de ley/pureza' },
  };

  async run(
    key: string,
    f: ReportFilters & Record<string, unknown>,
    user: AuthUser,
  ): Promise<TabularReport> {
    switch (key) {
      case 'inventory-global':
        return this.inventoryGlobal(user);
      case 'kardex':
        return this.kardex(f);
      case 'workshop-material':
        return this.workshopMaterial(f);
      case 'orders':
        return this.ordersReport(f);
      case 'productivity':
        return this.productivity(f);
      case 'compliance':
        return this.compliance(f);
      case 'consumption-vs-standard':
        return this.consumptionVsStandard(f);
      case 'losses':
        return this.losses(f);
      case 'production-costs':
        return this.productionCosts(f);
      case 'profitability':
        return this.profitability(f);
      case 'customers':
        return this.customers(f);
      case 'audit':
        return this.audit(f as unknown as AuditQueryDto & ReportFilters);
      case 'catalog':
        return this.catalogReport();
      case 'visual-traceability':
        return this.visualTraceability(f);
      case 'purity-control':
        return this.purityControl(f);
      default:
        throw new BadRequestException('Reporte inexistente');
    }
  }

  // 1. Inventario global
  async inventoryGlobal(user: AuthUser): Promise<TabularReport> {
    const summary = await this.inventory.globalSummary(user);
    const rows = summary.map((s) => ({
      code: s.material.code,
      material: s.material.name,
      category: s.material.category?.name,
      purity: s.material.purity,
      office: s.office,
      committed: s.committed,
      available: s.available,
      workshops: s.workshops,
      transit: s.transit,
      other: s.other,
      total: s.total,
      minStock: s.minStock,
      belowMin: s.belowMin,
    }));
    return {
      key: 'inventory-global',
      title: 'Inventario global',
      description:
        'Material por tipo, pureza y ubicación: disponible, comprometido, en taller y en tránsito (RN-004).',
      columns: [
        { key: 'code', label: 'Código' },
        { key: 'material', label: 'Material' },
        { key: 'category', label: 'Categoría' },
        { key: 'purity', label: 'Ley', type: 'number' },
        { key: 'office', label: 'Oficina Madre', type: 'grams' },
        { key: 'committed', label: 'Comprometido', type: 'grams' },
        { key: 'available', label: 'Disponible', type: 'grams' },
        { key: 'workshops', label: 'En talleres', type: 'grams' },
        { key: 'transit', label: 'En tránsito', type: 'grams' },
        { key: 'other', label: 'Otras ubic.', type: 'grams' },
        { key: 'total', label: 'Total bajo control', type: 'grams' },
        { key: 'minStock', label: 'Mínimo', type: 'grams' },
        { key: 'belowMin', label: 'Bajo mínimo', type: 'boolean' },
      ],
      rows,
      summary: {
        totalGrams: roundGrams(rows.reduce((s, r) => s + r.total, 0)),
        inWorkshops: roundGrams(rows.reduce((s, r) => s + r.workshops, 0)),
      },
      charts: {
        byWorkshop: summary.flatMap((s) =>
          s.byWorkshop.map((w) => ({ material: s.material.name, ...w })),
        ),
      },
    };
  }

  // 2. Kardex
  async kardex(
    f: ReportFilters & { locationId?: unknown },
  ): Promise<TabularReport> {
    if (!f.materialId)
      throw new BadRequestException('Seleccione el material del kardex');
    const p = this.period(f);
    const k = await this.inventory.kardex({
      materialId: f.materialId,
      from: p.from,
      to: p.to,
      locationId: (f.locationId as string) || undefined,
    });
    return {
      key: 'kardex',
      title: `Kardex · ${k.material.name}`,
      filters: { from: p.from, to: p.to },
      columns: [
        { key: 'date', label: 'Fecha', type: 'datetime' },
        { key: 'number', label: 'Movimiento' },
        { key: 'type', label: 'Tipo' },
        { key: 'from', label: 'Origen' },
        { key: 'to', label: 'Destino' },
        { key: 'lot', label: 'Lote' },
        { key: 'inGrams', label: 'Entrada', type: 'grams' },
        { key: 'outGrams', label: 'Salida', type: 'grams' },
        { key: 'movedGrams', label: 'Gramos movidos', type: 'grams' },
        { key: 'balance', label: 'Saldo', type: 'grams' },
        { key: 'reference', label: 'Referencia' },
        { key: 'responsible', label: 'Responsable' },
        { key: 'status', label: 'Estado' },
      ],
      rows: k.lines,
      summary: { opening: k.opening, closing: k.closing },
    };
  }

  // 3. Material por taller
  async workshopMaterial(f: ReportFilters): Promise<TabularReport> {
    const workshops = await this.ds.manager.find(Workshop, {
      where: f.workshopId ? { id: f.workshopId } : {},
      order: { code: 'ASC' },
    });
    const rows: Record<string, unknown>[] = [];
    for (const w of workshops) {
      const c = await this.inventory.workshopCustody(w.id);
      for (const e of c.byOrder) {
        const order = e.productionOrderId
          ? await this.ds.manager.findOne(ProductionOrder, {
              where: { id: e.productionOrderId },
              loadEagerRelations: false,
            })
          : null;
        rows.push({
          workshop: `${w.code} · ${w.name}`,
          order: order?.number ?? 'Sin orden',
          orderStatus: order ? STATUS_LABELS[order.status] : '',
          material: e.material.name,
          grams: e.grams,
          since: e.since,
          daysInCustody: e.since ? Math.floor(days(e.since, new Date())) : null,
        });
      }
    }
    return {
      key: 'workshop-material',
      title: 'Material por taller',
      description:
        'Qué material tiene cada taller, desde cuándo y asociado a qué orden (inventario "fantasma").',
      columns: [
        { key: 'workshop', label: 'Taller' },
        { key: 'order', label: 'Orden' },
        { key: 'orderStatus', label: 'Estado orden' },
        { key: 'material', label: 'Material' },
        { key: 'grams', label: 'Gramos', type: 'grams' },
        { key: 'since', label: 'Desde', type: 'datetime' },
        { key: 'daysInCustody', label: 'Días en custodia', type: 'number' },
      ],
      rows,
      summary: {
        totalGrams: roundGrams(
          rows.reduce((s, r) => s + (r.grams as number), 0),
        ),
      },
    };
  }

  private async finishedByOrder(orderIds: string[]) {
    if (!orderIds.length)
      return new Map<string, { grams: number; units: number }>();
    const receipts = await this.ds.manager.find(ProductionReceipt, {
      where: { orderId: In(orderIds) },
    });
    const map = new Map<string, { grams: number; units: number }>();
    for (const r of receipts)
      for (const l of r.lines.filter(
        (x) => x.lineType === ReceiptLineType.FINISHED_PRODUCT,
      )) {
        const e = map.get(r.orderId) ?? { grams: 0, units: 0 };
        e.grams = roundGrams(e.grams + l.grams);
        e.units += l.units ?? 0;
        map.set(r.orderId, e);
      }
    return map;
  }

  // 4. Órdenes
  async ordersReport(f: ReportFilters): Promise<TabularReport> {
    const p = this.period(f);
    const orders = await this.ds.manager.find(ProductionOrder, {
      where: {
        createdAt: Between(p.fromDate, p.toDate),
        ...(f.workshopId ? { workshopId: f.workshopId } : {}),
        ...(f.productId ? { productId: f.productId } : {}),
      },
      order: { createdAt: 'DESC' },
    });
    const finished = await this.finishedByOrder(orders.map((o) => o.id));
    const discs = orders.length
      ? await this.ds.manager.find(Discrepancy, {
          where: { orderId: In(orders.map((o) => o.id)) },
        })
      : [];
    const today = localDate();
    const rows = orders.map((o) => {
      const fin = finished.get(o.id) ?? { grams: 0, units: 0 };
      return {
        number: o.number,
        status: STATUS_LABELS[o.status],
        workshop: o.workshop.name,
        product: o.product.name,
        variant: o.variant?.name ?? '',
        targetGrams: o.targetGrams,
        targetUnits: o.targetUnits,
        commitmentDate: o.commitmentDate,
        finishedGrams: fin.grams,
        progressPct:
          o.targetGrams > 0 ? round((fin.grams / o.targetGrams) * 100, 1) : 0,
        differencesGrams: roundGrams(
          discs
            .filter(
              (d) =>
                d.orderId === o.id && d.status !== DiscrepancyStatus.REJECTED,
            )
            .reduce((s, d) => s + d.grams, 0),
        ),
        overdue:
          ![OrderStatus.APPROVED_CLOSED, OrderStatus.CANCELLED].includes(
            o.status,
          ) &&
          !o.deliveredAt &&
          o.commitmentDate < today,
      };
    });
    return {
      key: 'orders',
      title: 'Órdenes de producción',
      filters: { from: p.from, to: p.to },
      columns: [
        { key: 'number', label: 'Orden' },
        { key: 'status', label: 'Estado' },
        { key: 'workshop', label: 'Taller' },
        { key: 'product', label: 'Producto' },
        { key: 'variant', label: 'Variante' },
        { key: 'targetGrams', label: 'Objetivo (g)', type: 'grams' },
        { key: 'targetUnits', label: 'Objetivo (u)', type: 'number' },
        { key: 'commitmentDate', label: 'Compromiso', type: 'date' },
        { key: 'finishedGrams', label: 'Terminado (g)', type: 'grams' },
        { key: 'progressPct', label: 'Avance', type: 'percent' },
        { key: 'differencesGrams', label: 'Diferencias (g)', type: 'grams' },
        { key: 'overdue', label: 'Retrasada', type: 'boolean' },
      ],
      rows,
      summary: {
        orders: rows.length,
        overdue: rows.filter((r) => r.overdue).length,
      },
    };
  }

  // 5. Productividad mensual (RF-031, CA-010)
  async productivity(f: ReportFilters): Promise<TabularReport> {
    const p = this.period(f);
    const receipts = await this.ds.manager.find(ProductionReceipt, {
      where: {
        createdAt: Between(p.fromDate, p.toDate),
        ...(f.workshopId ? { workshopId: f.workshopId } : {}),
      },
    });
    const orderIds = [...new Set(receipts.map((r) => r.orderId))];
    const orders = orderIds.length
      ? await this.ds.manager.find(ProductionOrder, {
          where: { id: In(orderIds) },
        })
      : [];
    const byKey = new Map<
      string,
      {
        month: string;
        workshop: string;
        product: string;
        grams: number;
        units: number;
        orders: Set<string>;
      }
    >();
    for (const r of receipts) {
      const o = orders.find((x) => x.id === r.orderId);
      if (!o || (f.productId && o.productId !== f.productId)) continue;
      for (const l of r.lines.filter(
        (x) => x.lineType === ReceiptLineType.FINISHED_PRODUCT,
      )) {
        const key = `${month(r.createdAt)}|${o.workshopId}|${o.productId}`;
        const e = byKey.get(key) ?? {
          month: month(r.createdAt),
          workshop: `${o.workshop.code} · ${o.workshop.name}`,
          product: o.product.name,
          grams: 0,
          units: 0,
          orders: new Set<string>(),
        };
        e.grams = roundGrams(e.grams + l.grams);
        e.units += l.units ?? 0;
        e.orders.add(o.id);
        byKey.set(key, e);
      }
    }
    // Indicadores de cumplimiento por taller en el período.
    const closed = await this.ds.manager.find(ProductionOrder, {
      where: {
        deliveredAt: Between(p.fromDate, p.toDate),
        ...(f.workshopId ? { workshopId: f.workshopId } : {}),
      },
    });
    const perWorkshop = new Map<
      string,
      { onTime: number; late: number; leadDays: number[] }
    >();
    for (const o of closed) {
      const e = perWorkshop.get(o.workshop.name) ?? {
        onTime: 0,
        late: 0,
        leadDays: [],
      };
      if (localDate(o.deliveredAt!) <= o.commitmentDate) e.onTime++;
      else e.late++;
      if (o.dispatchedAt) e.leadDays.push(days(o.dispatchedAt, o.deliveredAt!));
      perWorkshop.set(o.workshop.name, e);
    }
    const rows = [...byKey.values()]
      .map((e) => ({
        month: e.month,
        workshop: e.workshop,
        product: e.product,
        grams: e.grams,
        units: e.units,
        orders: e.orders.size,
      }))
      .sort(
        (a, b) =>
          a.month.localeCompare(b.month) ||
          a.workshop.localeCompare(b.workshop),
      );
    const workshopTotals = new Map<string, number>();
    for (const r of rows)
      workshopTotals.set(
        r.workshop,
        roundGrams((workshopTotals.get(r.workshop) ?? 0) + r.grams),
      );
    return {
      key: 'productivity',
      title: 'Productividad mensual por taller',
      filters: { from: p.from, to: p.to },
      description:
        'Gramos/unidades terminadas (recibidas en Oficina Madre) por taller, producto y período.',
      columns: [
        { key: 'month', label: 'Mes' },
        { key: 'workshop', label: 'Taller' },
        { key: 'product', label: 'Producto' },
        { key: 'grams', label: 'Gramos terminados', type: 'grams' },
        { key: 'units', label: 'Unidades', type: 'number' },
        { key: 'orders', label: 'Órdenes', type: 'number' },
      ],
      rows,
      summary: {
        totalGrams: roundGrams(rows.reduce((s, r) => s + r.grams, 0)),
        totalUnits: rows.reduce((s, r) => s + r.units, 0),
      },
      charts: {
        byWorkshop: [...workshopTotals.entries()].map(([workshop, grams]) => ({
          workshop,
          grams,
        })),
        compliance: [...perWorkshop.entries()].map(([workshop, e]) => ({
          workshop,
          onTime: e.onTime,
          late: e.late,
          onTimePct:
            e.onTime + e.late
              ? round((e.onTime / (e.onTime + e.late)) * 100, 1)
              : null,
          avgLeadDays: e.leadDays.length
            ? round(
                e.leadDays.reduce((s, d) => s + d, 0) / e.leadDays.length,
                1,
              )
            : null,
        })),
      },
    };
  }

  // 6. Cumplimiento (RF-032)
  async compliance(f: ReportFilters): Promise<TabularReport> {
    const p = this.period(f);
    const today = localDate();
    const orders = await this.ds.manager.find(ProductionOrder, {
      where: [
        {
          deliveredAt: Between(p.fromDate, p.toDate),
          ...(f.workshopId ? { workshopId: f.workshopId } : {}),
        },
        {
          commitmentDate: Between(p.from, p.to),
          deliveredAt: IsNull(),
          status: Not(In([OrderStatus.CANCELLED])),
          ...(f.workshopId ? { workshopId: f.workshopId } : {}),
        },
      ],
      order: { commitmentDate: 'ASC' },
    });
    const rows = orders.map((o) => {
      const real = o.deliveredAt ? localDate(o.deliveredAt) : null;
      const deviation = real
        ? Math.round(days(new Date(o.commitmentDate), new Date(real)))
        : o.commitmentDate < today
          ? Math.round(days(new Date(o.commitmentDate), new Date(today)))
          : null;
      return {
        number: o.number,
        workshop: o.workshop.name,
        product: o.product.name,
        commitmentDate: o.commitmentDate,
        deliveredAt: real,
        result: real
          ? real <= o.commitmentDate
            ? 'A tiempo'
            : 'Retrasada'
          : o.commitmentDate < today
            ? 'Vencida sin entregar'
            : 'En curso',
        deviationDays: deviation,
        leadTimeDays:
          o.dispatchedAt && o.deliveredAt
            ? round(days(o.dispatchedAt, o.deliveredAt), 1)
            : null,
      };
    });
    const delivered = rows.filter((r) => r.deliveredAt);
    const onTime = delivered.filter((r) => r.result === 'A tiempo').length;
    const leads = rows
      .map((r) => r.leadTimeDays)
      .filter((x): x is number => x !== null);
    return {
      key: 'compliance',
      title: 'Cumplimiento de compromisos',
      filters: { from: p.from, to: p.to },
      columns: [
        { key: 'number', label: 'Orden' },
        { key: 'workshop', label: 'Taller' },
        { key: 'product', label: 'Producto' },
        { key: 'commitmentDate', label: 'Fecha comprometida', type: 'date' },
        { key: 'deliveredAt', label: 'Fecha real', type: 'date' },
        { key: 'result', label: 'Resultado' },
        { key: 'deviationDays', label: 'Desviación (días)', type: 'number' },
        {
          key: 'leadTimeDays',
          label: 'Tiempo de ciclo (días)',
          type: 'number',
        },
      ],
      rows,
      summary: {
        delivered: delivered.length,
        onTime,
        late: delivered.length - onTime,
        onTimePct: delivered.length
          ? round((onTime / delivered.length) * 100, 1)
          : 0,
        avgLeadTimeDays: leads.length
          ? round(leads.reduce((s, x) => s + x, 0) / leads.length, 1)
          : 0,
        avgDeviationDays: delivered.length
          ? round(
              delivered.reduce((s, r) => s + (r.deviationDays ?? 0), 0) /
                delivered.length,
              1,
            )
          : 0,
      },
    };
  }

  // 7. Consumo vs estándar
  async consumptionVsStandard(f: ReportFilters): Promise<TabularReport> {
    const p = this.period(f);
    const orders = await this.ds.manager.find(ProductionOrder, {
      where: {
        createdAt: Between(p.fromDate, p.toDate),
        status: Not(In([OrderStatus.DRAFT, OrderStatus.CANCELLED])),
        ...(f.workshopId ? { workshopId: f.workshopId } : {}),
        ...(f.productId ? { productId: f.productId } : {}),
      },
      relations: { requirements: true },
    });
    const rows: Record<string, unknown>[] = [];
    for (const o of orders) {
      const cons = await this.ds.manager.find(ConsumptionReport, {
        where: { orderId: o.id, voided: false },
      });
      const materials = new Set([
        ...o.requirements.map((r) => r.materialId),
        ...cons.map((c) => c.materialId),
      ]);
      for (const mid of materials) {
        const req = o.requirements.find((r) => r.materialId === mid);
        const consumed = roundGrams(
          cons
            .filter((c) => c.materialId === mid)
            .reduce((s, c) => s + c.grams, 0),
        );
        const std = req?.requiredGrams ?? 0;
        const deviation = roundGrams(consumed - std);
        rows.push({
          order: o.number,
          workshop: o.workshop.name,
          product: o.product.name,
          material:
            req?.material.name ??
            cons.find((c) => c.materialId === mid)?.material.name,
          standard: std,
          consumed,
          deviation,
          deviationPct: std > 0 ? round((deviation / std) * 100, 2) : null,
          tolerancePct: req?.tolerancePct ?? null,
          outOfStandard:
            std > 0
              ? consumed > std * (1 + (req?.tolerancePct ?? 0) / 100)
              : consumed > 0,
        });
      }
    }
    return {
      key: 'consumption-vs-standard',
      title: 'Consumo vs estándar',
      filters: { from: p.from, to: p.to },
      columns: [
        { key: 'order', label: 'Orden' },
        { key: 'workshop', label: 'Taller' },
        { key: 'product', label: 'Producto' },
        { key: 'material', label: 'Material' },
        { key: 'standard', label: 'Estándar (g)', type: 'grams' },
        { key: 'consumed', label: 'Consumido (g)', type: 'grams' },
        { key: 'deviation', label: 'Desviación (g)', type: 'grams' },
        { key: 'deviationPct', label: 'Desviación', type: 'percent' },
        { key: 'tolerancePct', label: 'Tolerancia', type: 'percent' },
        { key: 'outOfStandard', label: 'Fuera de estándar', type: 'boolean' },
      ],
      rows,
      summary: { outOfStandard: rows.filter((r) => r.outOfStandard).length },
    };
  }

  // 8. Mermas y diferencias
  async losses(f: ReportFilters): Promise<TabularReport> {
    const p = this.period(f);
    const discs = await this.ds.manager.find(Discrepancy, {
      where: {
        createdAt: Between(p.fromDate, p.toDate),
        ...(f.workshopId ? { workshopId: f.workshopId } : {}),
      },
      order: { createdAt: 'ASC' },
    });
    const users = await this.userNames(discs.map((d) => d.approvedById));
    const workshops = await this.workshopNames(discs.map((d) => d.workshopId));
    const orders = await this.orderNumbers(discs.map((d) => d.orderId));
    const rows = discs.map((d) => ({
      number: d.number,
      date: d.createdAt,
      order: d.orderId ? orders.get(d.orderId) : '',
      workshop: d.workshopId ? workshops.get(d.workshopId) : '',
      type: d.type,
      material: d.material?.name ?? '(transformación)',
      grams: d.grams,
      percent: d.percent,
      withinTolerance: d.withinTolerance,
      reason: d.reason,
      justification: d.justification,
      status: d.status,
      approver: d.autoApproved
        ? 'Automática (tolerancia)'
        : d.approvedById
          ? users.get(d.approvedById)
          : '',
    }));
    const trend = new Map<string, number>();
    for (const d of discs.filter(
      (x) => x.status !== DiscrepancyStatus.REJECTED,
    ))
      trend.set(
        month(d.createdAt),
        roundGrams((trend.get(month(d.createdAt)) ?? 0) + d.grams),
      );
    return {
      key: 'losses',
      title: 'Mermas y diferencias',
      filters: { from: p.from, to: p.to },
      columns: [
        { key: 'number', label: 'Número' },
        { key: 'date', label: 'Fecha', type: 'datetime' },
        { key: 'order', label: 'Orden' },
        { key: 'workshop', label: 'Taller' },
        { key: 'type', label: 'Tipo' },
        { key: 'material', label: 'Material' },
        { key: 'grams', label: 'Gramos', type: 'grams' },
        { key: 'percent', label: '%', type: 'percent' },
        { key: 'withinTolerance', label: 'En tolerancia', type: 'boolean' },
        { key: 'reason', label: 'Motivo' },
        { key: 'justification', label: 'Justificación' },
        { key: 'status', label: 'Estado' },
        { key: 'approver', label: 'Aprobador' },
      ],
      rows,
      summary: {
        totalGrams: roundGrams(
          rows
            .filter((r) => r.status !== DiscrepancyStatus.REJECTED)
            .reduce((s, r) => s + r.grams, 0),
        ),
        pending: rows.filter((r) => r.status === DiscrepancyStatus.PENDING)
          .length,
      },
      charts: {
        trend: [...trend.entries()].map(([m, grams]) => ({ month: m, grams })),
      },
    };
  }

  // 9. Costos por producción
  async productionCosts(f: ReportFilters): Promise<TabularReport> {
    const p = this.period(f);
    const orders = await this.ds.manager.find(ProductionOrder, {
      where: {
        closedAt: Between(p.fromDate, p.toDate),
        status: OrderStatus.APPROVED_CLOSED,
        ...(f.workshopId ? { workshopId: f.workshopId } : {}),
        ...(f.productId ? { productId: f.productId } : {}),
      },
    });
    const ids = orders.map((o) => o.id);
    const costs = ids.length
      ? await this.ds.manager.find(CostEntry, { where: { orderId: In(ids) } })
      : [];
    const finished = await this.finishedByOrder(ids);
    const rows = orders.map((o) => {
      const c = costs.filter((x) => x.orderId === o.id);
      const material = roundMoney(
        c
          .filter((x) => x.type === CostType.MATERIAL)
          .reduce((s, x) => s + x.amount, 0),
      );
      const labor = roundMoney(
        c
          .filter((x) => x.type === CostType.LABOR)
          .reduce((s, x) => s + x.amount, 0),
      );
      const other = roundMoney(
        c
          .filter((x) => x.type === CostType.OTHER)
          .reduce((s, x) => s + x.amount, 0),
      );
      const total = roundMoney(material + labor + other);
      const fin = finished.get(o.id) ?? { grams: 0, units: 0 };
      return {
        number: o.number,
        closedAt: o.closedAt,
        workshop: o.workshop.name,
        product: o.product.name,
        finishedGrams: fin.grams,
        finishedUnits: fin.units,
        material,
        labor,
        other,
        total,
        costPerGram: fin.grams ? roundMoney(total / fin.grams) : 0,
        costPerUnit: fin.units ? roundMoney(total / fin.units) : 0,
      };
    });
    return {
      key: 'production-costs',
      title: 'Costos por producción',
      filters: { from: p.from, to: p.to },
      columns: [
        { key: 'number', label: 'Orden' },
        { key: 'closedAt', label: 'Cierre', type: 'datetime' },
        { key: 'workshop', label: 'Taller' },
        { key: 'product', label: 'Producto' },
        { key: 'finishedGrams', label: 'Terminado (g)', type: 'grams' },
        { key: 'finishedUnits', label: 'Unidades', type: 'number' },
        { key: 'material', label: 'Material', type: 'money' },
        { key: 'labor', label: 'Mano de obra', type: 'money' },
        { key: 'other', label: 'Otros', type: 'money' },
        { key: 'total', label: 'Costo total', type: 'money' },
        { key: 'costPerGram', label: 'Costo/gramo', type: 'money' },
        { key: 'costPerUnit', label: 'Costo/unidad', type: 'money' },
      ],
      rows,
      summary: {
        total: roundMoney(rows.reduce((s, r) => s + r.total, 0)),
        material: roundMoney(rows.reduce((s, r) => s + r.material, 0)),
        labor: roundMoney(rows.reduce((s, r) => s + r.labor, 0)),
      },
    };
  }

  // 10. Rentabilidad (RF-029/030, CA-011, P16)
  async profitability(
    f: ReportFilters & { groupBy?: unknown },
  ): Promise<TabularReport> {
    const p = this.period(f);
    const sales = await this.ds.manager.find(SaleDispatch, {
      where: {
        dispatchDate: Between(p.from, p.to),
        reversed: false,
        ...(f.customerId ? { customerId: f.customerId } : {}),
      },
    });
    const customers = await this.customerNames(sales.map((s) => s.customerId));
    const workshops = await this.workshopNames(
      sales.flatMap((s) => s.lines.map((l) => l.finishedGood.workshopId)),
    );
    const lines = sales
      .flatMap((s) => s.lines.map((l) => ({ s, l })))
      .filter(
        ({ l }) =>
          (!f.productId || l.finishedGood.productId === f.productId) &&
          (!f.workshopId || l.finishedGood.workshopId === f.workshopId),
      );
    const groupBy = (f.groupBy as string) || 'month';
    const keyOf = ({ s, l }: (typeof lines)[number]) =>
      groupBy === 'product'
        ? l.finishedGood.product.name
        : groupBy === 'customer'
          ? (customers.get(s.customerId) ?? '')
          : groupBy === 'workshop'
            ? (workshops.get(l.finishedGood.workshopId) ?? '')
            : month(s.dispatchDate);
    const map = new Map<
      string,
      {
        group: string;
        revenue: number;
        cogs: number;
        grams: number;
        units: number;
      }
    >();
    for (const x of lines) {
      const k = keyOf(x);
      const e = map.get(k) ?? {
        group: k,
        revenue: 0,
        cogs: 0,
        grams: 0,
        units: 0,
      };
      e.revenue = roundMoney(e.revenue + x.l.value);
      e.cogs = roundMoney(e.cogs + x.l.cost);
      e.grams = roundGrams(e.grams + x.l.grams);
      e.units += x.l.units;
      map.set(k, e);
    }
    const rows = [...map.values()]
      .map((e) => ({
        ...e,
        grossProfit: roundMoney(e.revenue - e.cogs),
        marginPct: e.revenue
          ? round(((e.revenue - e.cogs) / e.revenue) * 100, 2)
          : 0,
      }))
      .sort((a, b) => a.group.localeCompare(b.group));

    // Consolidado del período: ventas − material − mano de obra aprobada − gastos (CA-011).
    const revenue = roundMoney(lines.reduce((s, x) => s + x.l.value, 0));
    const cogs = roundMoney(lines.reduce((s, x) => s + x.l.cost, 0));
    const costEntries = await this.ds.manager.find(CostEntry, {
      where: {
        periodDate: Between(p.from, p.to),
        ...(f.workshopId ? { workshopId: f.workshopId } : {}),
      },
    });
    const materialCost = roundMoney(
      costEntries
        .filter((c) => c.type === CostType.MATERIAL)
        .reduce((s, c) => s + c.amount, 0),
    );
    const laborCost = roundMoney(
      costEntries
        .filter((c) => c.type === CostType.LABOR)
        .reduce((s, c) => s + c.amount, 0),
    );
    const expenses = await this.ds.manager.find(FinancialTransaction, {
      where: {
        transactionDate: Between(p.from, p.to),
        type: TransactionType.EXPENSE,
        status: TransactionStatus.POSTED,
        source: Not(TransactionSource.REVERSAL),
        category: { isOperatingExpense: true },
      },
    });
    const opex = roundMoney(expenses.reduce((s, e) => s + e.amount, 0));
    const grossProfit = roundMoney(revenue - cogs);
    // Serie mensual para gráfica ingresos vs costos.
    const monthly = new Map<
      string,
      { month: string; revenue: number; costs: number; expenses: number }
    >();
    const bump = (
      m: string,
      k: 'revenue' | 'costs' | 'expenses',
      v: number,
    ) => {
      const e = monthly.get(m) ?? {
        month: m,
        revenue: 0,
        costs: 0,
        expenses: 0,
      };
      e[k] = roundMoney(e[k] + v);
      monthly.set(m, e);
    };
    for (const x of lines) bump(month(x.s.dispatchDate), 'revenue', x.l.value);
    for (const c of costEntries) bump(month(c.periodDate), 'costs', c.amount);
    for (const e of expenses)
      bump(month(e.transactionDate), 'expenses', e.amount);
    return {
      key: 'profitability',
      title: 'Rentabilidad',
      filters: { from: p.from, to: p.to, groupBy },
      description:
        'Utilidad bruta por ventas (costo de lo vendido) y consolidado del período (ventas − material − mano de obra aprobada − gastos).',
      columns: [
        {
          key: 'group',
          label:
            groupBy === 'product'
              ? 'Producto'
              : groupBy === 'customer'
                ? 'Cliente'
                : groupBy === 'workshop'
                  ? 'Taller'
                  : 'Mes',
        },
        { key: 'revenue', label: 'Ventas', type: 'money' },
        { key: 'cogs', label: 'Costo de lo vendido', type: 'money' },
        { key: 'grossProfit', label: 'Utilidad bruta', type: 'money' },
        { key: 'marginPct', label: 'Margen', type: 'percent' },
        { key: 'grams', label: 'Gramos vendidos', type: 'grams' },
        { key: 'units', label: 'Unidades', type: 'number' },
      ],
      rows,
      summary: {
        revenue,
        cogs,
        grossProfit,
        operatingExpenses: opex,
        netProfitOnSales: roundMoney(grossProfit - opex),
        productionMaterialCost: materialCost,
        productionLaborCost: laborCost,
        consolidatedNet: roundMoney(revenue - materialCost - laborCost - opex),
      },
      charts: {
        monthly: [...monthly.values()].sort((a, b) =>
          a.month.localeCompare(b.month),
        ),
      },
    };
  }

  // 11. Clientes y abonos
  async customers(f: ReportFilters): Promise<TabularReport> {
    const customers = await this.ds.manager.find(Customer, {
      where: f.customerId ? { id: f.customerId } : {},
      order: { name: 'ASC' },
    });
    const rows: Record<string, unknown>[] = [];
    for (const c of customers) {
      const ops = await this.ds.manager.find(CustomerOperation, {
        where: { customerId: c.id, status: Not(OperationStatus.CANCELLED) },
      });
      const totalValue = roundMoney(ops.reduce((s, o) => s + o.totalValue, 0));
      const committed = roundGrams(
        ops.reduce((s, o) => s + o.committedMaterialFineGrams, 0),
      );
      const sales = roundMoney(
        (await this.ds.manager
          .getRepository(SaleDispatch)
          .sum('totalValue', { customerId: c.id, reversed: false })) ?? 0,
      );
      const paid = roundMoney(
        (await this.ds.manager.getRepository(CustomerPayment).sum('amount', {
          customerId: c.id,
          status: TransactionStatus.POSTED,
        })) ?? 0,
      );
      const fine = roundGrams(
        (await this.ds.manager
          .getRepository(CustomerMaterialContribution)
          .sum('fineGrams', {
            customerId: c.id,
            status: TransactionStatus.POSTED,
          })) ?? 0,
      );
      const gross = roundGrams(
        (await this.ds.manager
          .getRepository(CustomerMaterialContribution)
          .sum('grams', {
            customerId: c.id,
            status: TransactionStatus.POSTED,
          })) ?? 0,
      );
      const valuation = roundMoney(
        (
          await this.ds.manager.find(CustomerMaterialContribution, {
            where: { customerId: c.id, status: TransactionStatus.POSTED },
          })
        ).reduce((s, x) => s + (x.valuation ?? 0), 0),
      );
      if (!ops.length && !paid && !fine) continue;
      rows.push({
        customer: c.name,
        document: `${c.documentType} ${c.documentNumber}`,
        operations: ops.length,
        totalValue,
        sales,
        paid,
        moneyBalance: roundMoney(totalValue - paid),
        contributedGross: gross,
        contributedFine: fine,
        committedFine: committed,
        materialBalance: roundGrams(committed - fine),
        materialValuation: valuation,
      });
    }
    return {
      key: 'customers',
      title: 'Clientes y abonos',
      description:
        'Ventas, saldos, abonos de dinero y aportes de material (saldos separados, RN-016).',
      columns: [
        { key: 'customer', label: 'Cliente' },
        { key: 'document', label: 'Documento' },
        { key: 'operations', label: 'Operaciones', type: 'number' },
        { key: 'totalValue', label: 'Valor operaciones', type: 'money' },
        { key: 'sales', label: 'Despachado', type: 'money' },
        { key: 'paid', label: 'Abonos dinero', type: 'money' },
        { key: 'moneyBalance', label: 'Saldo dinero', type: 'money' },
        {
          key: 'contributedGross',
          label: 'Material aportado (g)',
          type: 'grams',
        },
        { key: 'contributedFine', label: 'Aportado fino (g)', type: 'grams' },
        { key: 'committedFine', label: 'Comprometido fino (g)', type: 'grams' },
        {
          key: 'materialBalance',
          label: 'Saldo material fino (g)',
          type: 'grams',
        },
        {
          key: 'materialValuation',
          label: 'Valoración material',
          type: 'money',
        },
      ],
      rows,
    };
  }

  // 12. Auditoría
  async audit(q: AuditQueryDto & ReportFilters): Promise<TabularReport> {
    const p = this.period(q);
    const where = auditWhere({ ...q, from: p.from, to: p.to } as AuditQueryDto);
    const logs = await this.ds.manager.find(AuditLog, {
      where,
      order: { createdAt: 'DESC' },
      take: 5000,
    });
    return {
      key: 'audit',
      title: 'Auditoría de movimientos críticos',
      filters: { from: p.from, to: p.to },
      columns: [
        { key: 'createdAt', label: 'Fecha', type: 'datetime' },
        { key: 'username', label: 'Usuario' },
        { key: 'action', label: 'Acción' },
        { key: 'entityType', label: 'Entidad' },
        { key: 'entityId', label: 'Id' },
        { key: 'description', label: 'Descripción' },
        { key: 'before', label: 'Antes' },
        { key: 'after', label: 'Después' },
        { key: 'ip', label: 'IP' },
      ],
      rows: logs.map((l) => ({
        ...l,
        before: l.before ? JSON.stringify(l.before) : '',
        after: l.after ? JSON.stringify(l.after) : '',
      })),
    };
  }

  // 13. Catálogo técnico
  async catalogReport(): Promise<TabularReport> {
    const products = await this.ds.manager.find(Product, {
      order: { name: 'ASC' },
    });
    const rows = [];
    for (const p of products) {
      const versions = await this.ds.manager.count(TechnicalSheet, {
        where: { productId: p.id },
      });
      const s = p.currentSheetVersion
        ? await this.ds.manager.findOne(TechnicalSheet, {
            where: { productId: p.id, versionNumber: p.currentSheetVersion },
          })
        : null;
      const photos = await this.ds.manager.count(MediaFile, {
        where: {
          productId: p.id,
          purpose: MediaPurpose.CATALOG,
          hidden: false,
        },
      });
      rows.push({
        code: p.code,
        product: p.name,
        family: p.family?.name,
        version: p.currentSheetVersion,
        versions,
        standardWeight: s?.standardWeight ?? null,
        diameterMm: s?.diameterMm ?? null,
        lengthMm: s?.lengthMm ?? null,
        measures: s?.measures ?? '',
        targetPurity: s?.targetPurity ?? p.targetPurity,
        purityTolerance: s?.purityTolerance ?? p.purityTolerance,
        variables: s ? JSON.stringify(s.variables) : '',
        photos,
      });
    }
    return {
      key: 'catalog',
      title: 'Catálogo técnico de modelos',
      columns: [
        { key: 'code', label: 'Código' },
        { key: 'product', label: 'Modelo' },
        { key: 'family', label: 'Familia' },
        { key: 'version', label: 'Versión vigente', type: 'number' },
        { key: 'versions', label: 'Versiones', type: 'number' },
        { key: 'standardWeight', label: 'Peso estándar (g)', type: 'grams' },
        { key: 'diameterMm', label: 'Diámetro (mm)', type: 'number' },
        { key: 'lengthMm', label: 'Largo (mm)', type: 'number' },
        { key: 'measures', label: 'Medidas' },
        { key: 'targetPurity', label: 'Ley objetivo', type: 'number' },
        { key: 'purityTolerance', label: 'Tolerancia', type: 'number' },
        { key: 'variables', label: 'Variables' },
        { key: 'photos', label: 'Fotos', type: 'number' },
      ],
      rows,
    };
  }

  // 14. Trazabilidad visual
  async visualTraceability(f: ReportFilters): Promise<TabularReport> {
    const p = this.period(f);
    const orders = await this.ds.manager.find(ProductionOrder, {
      where: {
        createdAt: Between(p.fromDate, p.toDate),
        status: Not(In([OrderStatus.DRAFT, OrderStatus.CANCELLED])),
        ...(f.workshopId ? { workshopId: f.workshopId } : {}),
      },
      order: { createdAt: 'DESC' },
    });
    const rows = [];
    for (const o of orders) {
      const [photos, videos, stagesDone, stages] = await Promise.all([
        this.ds.manager.count(MediaFile, {
          where: {
            productionOrderId: o.id,
            kind: MediaKind.PHOTO,
            hidden: false,
          },
        }),
        this.ds.manager.count(MediaFile, {
          where: {
            productionOrderId: o.id,
            kind: MediaKind.VIDEO,
            hidden: false,
          },
        }),
        this.ds.manager.count(StageCompletion, { where: { orderId: o.id } }),
        this.masters.stagesForProduct(o.product),
      ]);
      const mandatory = stages.filter((s) => s.mandatory).length;
      rows.push({
        number: o.number,
        status: STATUS_LABELS[o.status],
        workshop: o.workshop.name,
        product: o.product.name,
        photos,
        videos,
        stagesCompleted: stagesDone,
        mandatoryStages: mandatory,
        complete: stagesDone >= mandatory,
        orderId: o.id,
      });
    }
    return {
      key: 'visual-traceability',
      title: 'Trazabilidad visual',
      filters: { from: p.from, to: p.to },
      description:
        'Historial/mosaico por orden con fotografías y videos por etapa.',
      columns: [
        { key: 'number', label: 'Orden' },
        { key: 'status', label: 'Estado' },
        { key: 'workshop', label: 'Taller' },
        { key: 'product', label: 'Producto' },
        { key: 'photos', label: 'Fotos', type: 'number' },
        { key: 'videos', label: 'Videos', type: 'number' },
        { key: 'stagesCompleted', label: 'Etapas completas', type: 'number' },
        {
          key: 'mandatoryStages',
          label: 'Etapas obligatorias',
          type: 'number',
        },
        { key: 'complete', label: 'Historia completa', type: 'boolean' },
      ],
      rows,
    };
  }

  // 15. Control de ley/pureza
  async purityControl(f: ReportFilters): Promise<TabularReport> {
    const p = this.period(f);
    const list = await this.ds.manager.find(PurityVerification, {
      where: {
        verifiedAt: Between(p.fromDate, p.toDate),
        ...(f.productId ? { productId: f.productId } : {}),
      },
      order: { verifiedAt: 'DESC' },
    });
    const orders = list.length
      ? await this.ds.manager.find(ProductionOrder, {
          where: { id: In([...new Set(list.map((x) => x.orderId))]) },
        })
      : [];
    const receipts = list.length
      ? await this.ds.manager.find(ProductionReceipt, {
          where: { id: In([...new Set(list.map((x) => x.receiptId))]) },
        })
      : [];
    const users = await this.userNames(list.map((x) => x.verifiedById));
    const rows = list
      .map((v) => {
        const o = orders.find((x) => x.id === v.orderId);
        return {
          verifiedAt: v.verifiedAt,
          receipt: receipts.find((r) => r.id === v.receiptId)?.number,
          order: o?.number,
          product: o?.product.name,
          model: o?.technicalSheet ? `v${o.technicalSheet.versionNumber}` : '',
          workshop: o?.workshop.name,
          workshopId: o?.workshopId,
          method: v.method,
          obtained: v.obtainedValue,
          target: v.targetValue,
          tolerance: v.tolerance,
          conforming: v.conforming,
          responsible: users.get(v.verifiedById),
          support: v.supportReference,
        };
      })
      .filter((r) => !f.workshopId || r.workshopId === f.workshopId);
    return {
      key: 'purity-control',
      title: 'Control de ley/pureza',
      filters: { from: p.from, to: p.to },
      columns: [
        { key: 'verifiedAt', label: 'Fecha', type: 'datetime' },
        { key: 'receipt', label: 'Recepción' },
        { key: 'order', label: 'Orden' },
        { key: 'product', label: 'Producto' },
        { key: 'model', label: 'Ficha' },
        { key: 'workshop', label: 'Taller' },
        { key: 'method', label: 'Método' },
        { key: 'obtained', label: 'Obtenido', type: 'number' },
        { key: 'target', label: 'Objetivo', type: 'number' },
        { key: 'tolerance', label: 'Tolerancia', type: 'number' },
        { key: 'conforming', label: 'Conforme', type: 'boolean' },
        { key: 'responsible', label: 'Responsable' },
        { key: 'support', label: 'Soporte' },
      ],
      rows,
      summary: {
        verifications: rows.length,
        nonConforming: rows.filter((r) => !r.conforming).length,
      },
    };
  }

  // ---------------- Dashboard Oficina Madre (RF-033, P02) ----------------
  async officeDashboard(user: AuthUser) {
    const now = new Date();
    const to = localDate(now);
    const from = `${to.slice(0, 7)}-01`;
    const today = to;
    const em = this.ds.manager;
    const inv = await this.inventory.globalSummary(user);
    const openOrders = await em.find(ProductionOrder, {
      where: {
        status: Not(In([OrderStatus.APPROVED_CLOSED, OrderStatus.CANCELLED])),
      },
    });
    const inProduction = openOrders.filter((o) =>
      [
        OrderStatus.DISPATCHED,
        OrderStatus.ACCEPTED_BY_WORKSHOP,
        OrderStatus.IN_PRODUCTION,
        OrderStatus.PARTIAL,
        OrderStatus.FINISHED_BY_WORKSHOP,
      ].includes(o.status),
    );
    const overdue = openOrders.filter(
      (o) => o.commitmentDate < today && !o.deliveredAt,
    );
    const finishedMonth = await this.productivity({ from, to });
    const profit = await this.profitability({ from, to });
    const [ty, tm] = to.split('-').map(Number);
    const back = new Date(Date.UTC(ty, tm - 6, 1));
    const sixMonthsAgo = `${back.getUTCFullYear()}-${String(back.getUTCMonth() + 1).padStart(2, '0')}-01`;
    const trend = await this.profitability({ from: sixMonthsAgo, to });
    const [
      openAlerts,
      pendingDiscrepancies,
      pendingLabor,
      pendingRequests,
      recentAlerts,
    ] = await Promise.all([
      em.count(Alert, { where: { status: Not(AlertStatus.RESOLVED) } }),
      em.count(Discrepancy, { where: { status: DiscrepancyStatus.PENDING } }),
      em.count(LaborCost, { where: { status: ApprovalStatus.PROPOSED } }),
      em.count(MaterialRequest, { where: { status: RequestStatus.PENDING } }),
      em.find(Alert, {
        where: { status: Not(AlertStatus.RESOLVED) },
        order: { createdAt: 'DESC' },
        take: 6,
      }),
    ]);
    const byWorkshop = new Map<string, number>();
    for (const m of inv)
      for (const w of m.byWorkshop)
        byWorkshop.set(
          `${w.code}`,
          roundGrams((byWorkshop.get(w.code) ?? 0) + w.grams),
        );
    const summary = profit.summary ?? {};
    return {
      period: { from, to },
      kpis: {
        totalInventoryGrams: roundGrams(inv.reduce((s, m) => s + m.total, 0)),
        officeGrams: roundGrams(inv.reduce((s, m) => s + m.office, 0)),
        workshopsGrams: roundGrams(inv.reduce((s, m) => s + m.workshops, 0)),
        transitGrams: roundGrams(inv.reduce((s, m) => s + m.transit, 0)),
        ordersInProduction: inProduction.length,
        gramsInProduction: roundGrams(
          inProduction.reduce((s, o) => s + o.targetGrams, 0),
        ),
        finishedThisMonthGrams: finishedMonth.summary?.totalGrams ?? 0,
        overdueOrders: overdue.length,
        openAlerts,
        pendingApprovals:
          openOrders.filter((o) => o.status === OrderStatus.IN_REVIEW).length +
          pendingDiscrepancies +
          pendingLabor,
        pendingRequests,
        salesThisMonth: summary.revenue ?? 0,
        costsThisMonth: roundMoney(
          Number(summary.productionMaterialCost ?? 0) +
            Number(summary.productionLaborCost ?? 0) +
            Number(summary.operatingExpenses ?? 0),
        ),
        profitThisMonth: summary.consolidatedNet ?? 0,
      },
      charts: {
        materialByWorkshop: [...byWorkshop.entries()].map(
          ([workshop, grams]) => ({ workshop, grams }),
        ),
        productivityByWorkshop:
          (finishedMonth.charts?.byWorkshop as unknown[]) ?? [],
        monthlyProfitability: (trend.charts?.monthly as unknown[]) ?? [],
        ordersByStatus: Object.values(OrderStatus)
          .map((s) => ({
            status: s,
            label: STATUS_LABELS[s],
            count: openOrders.filter((o) => o.status === s).length,
          }))
          .filter((x) => x.count > 0),
      },
      inventory: inv.map((m) => ({
        material: m.material.name,
        code: m.material.code,
        office: m.office,
        workshops: m.workshops,
        transit: m.transit,
        total: m.total,
        belowMin: m.belowMin,
      })),
      overdue: overdue.slice(0, 8).map((o) => ({
        id: o.id,
        number: o.number,
        workshop: o.workshop.name,
        product: o.product.name,
        commitmentDate: o.commitmentDate,
        status: STATUS_LABELS[o.status],
      })),
      recentAlerts,
    };
  }

  // ---------------- helpers ----------------
  private async userNames(ids: (string | null)[]) {
    const unique = [...new Set(ids.filter((x): x is string => !!x))];
    if (!unique.length) return new Map<string, string>();
    const users = await this.ds.manager.find(User, {
      where: { id: In(unique) },
    });
    return new Map(users.map((u) => [u.id, u.fullName]));
  }
  private async workshopNames(ids: (string | null)[]) {
    const unique = [...new Set(ids.filter((x): x is string => !!x))];
    if (!unique.length) return new Map<string, string>();
    const ws = await this.ds.manager.find(Workshop, {
      where: { id: In(unique) },
    });
    return new Map(ws.map((w) => [w.id, `${w.code} · ${w.name}`]));
  }
  private async customerNames(ids: string[]) {
    const unique = [...new Set(ids)];
    if (!unique.length) return new Map<string, string>();
    const cs = await this.ds.manager.find(Customer, {
      where: { id: In(unique) },
    });
    return new Map(cs.map((c) => [c.id, c.name]));
  }
  private async orderNumbers(ids: (string | null)[]) {
    const unique = [...new Set(ids.filter((x): x is string => !!x))];
    if (!unique.length) return new Map<string, string>();
    const os = await this.ds.manager.find(ProductionOrder, {
      where: { id: In(unique) },
      loadEagerRelations: false,
    });
    return new Map(os.map((o) => [o.id, o.number]));
  }
}

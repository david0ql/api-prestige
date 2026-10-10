import { localDate } from '../../common/utils/dates';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  FindOptionsWhere,
  In,
  IsNull,
  LessThan,
  Not,
  Repository,
} from 'typeorm';
import { paginated, PaginationQueryDto } from '../../common/dto/pagination.dto';
import {
  AlertSeverity,
  AlertStatus,
  AlertType,
  DispatchStatus,
  LocationType,
  OrderStatus,
  RecordStatus,
} from '../../common/enums/domain.enums';
import type { AuthUser } from '../../common/types/auth-user';
import { InventoryBalance } from '../inventory/entities/inventory-balance.entity';
import { INVENTORY_CHANGED } from '../inventory/inventory.service';
import { Material } from '../masters/entities/material.entity';
import { ParametersService, PARAM } from '../masters/parameters.service';
import { MaterialDispatch } from '../production/entities/material-dispatch.entity';
import { ProductionOrder } from '../production/entities/production-order.entity';
import { ALERT_RAISE, ALERT_RESOLVE } from '../production/production.events';
import type {
  AlertRaiseEvent,
  AlertResolveEvent,
} from '../production/production.events';
import { Alert } from './entities/alert.entity';

export class AlertQueryDto extends PaginationQueryDto {
  status?: AlertStatus;
  type?: AlertType;
  severity?: AlertSeverity;
}

/** Alertas operativas (RF-039, P17): faltantes, mínimos, retrasos, consumos y diferencias. */
@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    private readonly ds: DataSource,
    @InjectRepository(Alert) private readonly alerts: Repository<Alert>,
    private readonly params: ParametersService,
  ) {}

  @OnEvent(ALERT_RAISE, { promisify: true })
  async raise(e: AlertRaiseEvent): Promise<Alert | null> {
    try {
      if (e.dedupKey) {
        const open = await this.alerts.findOne({
          where: { dedupKey: e.dedupKey, status: Not(AlertStatus.RESOLVED) },
        });
        if (open) {
          open.message = e.message;
          open.title = e.title;
          open.data = e.data ?? open.data;
          return this.alerts.save(open);
        }
      }
      return await this.alerts.save(
        this.alerts.create({
          type: e.type,
          severity: e.severity,
          title: e.title.slice(0, 200),
          message: e.message,
          entityType: e.entityType ?? null,
          entityId: e.entityId ?? null,
          workshopId: e.workshopId ?? null,
          dedupKey: e.dedupKey ?? null,
          data: e.data ?? null,
          status: AlertStatus.OPEN,
        }),
      );
    } catch (err) {
      this.logger.error(
        `No se pudo registrar alerta: ${(err as Error).message}`,
      );
      return null;
    }
  }

  @OnEvent(ALERT_RESOLVE, { async: true })
  async autoResolve(e: AlertResolveEvent) {
    await this.alerts.update(
      { dedupKey: e.dedupKey, status: Not(AlertStatus.RESOLVED) },
      {
        status: AlertStatus.RESOLVED,
        resolvedAt: new Date(),
        resolutionNotes: e.notes ?? 'Resuelta automáticamente',
      },
    );
  }

  @OnEvent(INVENTORY_CHANGED, { async: true })
  async onInventoryChanged(e: { materialId: string }) {
    await this.checkMinStock(e.materialId);
  }

  /** Mínimos de inventario en Oficina Madre. */
  async checkMinStock(materialId?: string) {
    const materials = await this.ds.manager.find(Material, {
      where: materialId ? { id: materialId } : { status: RecordStatus.ACTIVE },
    });
    for (const mat of materials.filter((x) => x.minStock > 0)) {
      const office =
        (await this.ds.manager.getRepository(InventoryBalance).sum('grams', {
          materialId: mat.id,
          location: { type: LocationType.MOTHER_OFFICE },
        })) ?? 0;
      const key = `MIN_STOCK:${mat.id}`;
      if (office < mat.minStock) {
        await this.raise({
          type: AlertType.MIN_STOCK,
          severity:
            office <= 0 ? AlertSeverity.CRITICAL : AlertSeverity.WARNING,
          title: `${mat.name} bajo el mínimo`,
          message: `Existencia en Oficina Madre ${Number(office).toFixed(2)} g; mínimo ${mat.minStock} g`,
          entityType: 'Material',
          entityId: mat.id,
          dedupKey: key,
          data: { stock: office, minStock: mat.minStock },
        });
      } else {
        await this.autoResolve({ dedupKey: key, notes: 'Inventario repuesto' });
      }
    }
  }

  /** Revisión periódica: retrasos y entregas sin confirmar. */
  @Cron(CronExpression.EVERY_30_MINUTES, { name: 'operational-alerts' })
  async runChecks() {
    const today = localDate();
    const warnDays = await this.params.get<number>(PARAM.DELAY_WARNING_DAYS, 2);
    const soon = new Date(Date.now() + warnDays * 86400_000)
      .toISOString()
      .slice(0, 10);
    const open = await this.ds.manager.find(ProductionOrder, {
      where: {
        status: Not(
          In([
            OrderStatus.APPROVED_CLOSED,
            OrderStatus.CANCELLED,
            OrderStatus.IN_REVIEW,
          ]),
        ),
        deliveredAt: IsNull(),
      },
    });
    for (const o of open) {
      const key = `DELAY:${o.id}`;
      if (o.commitmentDate < today) {
        await this.raise({
          type: AlertType.DELAY,
          severity: AlertSeverity.CRITICAL,
          title: `${o.number} retrasada`,
          message: `Compromiso ${o.commitmentDate} vencido · ${o.workshop.name} · ${o.product.name}`,
          entityType: 'ProductionOrder',
          entityId: o.id,
          workshopId: o.workshopId,
          dedupKey: key,
        });
      } else if (
        o.commitmentDate <= soon &&
        ![OrderStatus.FINISHED_BY_WORKSHOP].includes(o.status)
      ) {
        await this.raise({
          type: AlertType.DELAY,
          severity: AlertSeverity.WARNING,
          title: `${o.number} próxima a vencer`,
          message: `Compromiso ${o.commitmentDate} · ${o.workshop.name}`,
          entityType: 'ProductionOrder',
          entityId: o.id,
          workshopId: o.workshopId,
          dedupKey: key,
        });
      }
    }
    const hours = await this.params.get<number>(
      PARAM.PENDING_ACCEPTANCE_HOURS,
      24,
    );
    const pending = await this.ds.manager.find(MaterialDispatch, {
      where: {
        status: DispatchStatus.PENDING_ACCEPTANCE,
        createdAt: LessThan(new Date(Date.now() - hours * 3600_000)),
      },
    });
    for (const d of pending) {
      await this.raise({
        type: AlertType.PENDING_OPERATION,
        severity: AlertSeverity.WARNING,
        title: `Entrega ${d.number} sin confirmar`,
        message: `${d.workshop.name} no ha confirmado la recepción hace más de ${hours} h`,
        entityType: 'MaterialDispatch',
        entityId: d.id,
        workshopId: d.workshopId,
        dedupKey: `PENDING_ACCEPT:${d.id}`,
      });
    }
    // Las entregas ya respondidas resuelven su alerta.
    const responded = await this.alerts.find({
      where: {
        type: AlertType.PENDING_OPERATION,
        entityType: 'MaterialDispatch',
        status: Not(AlertStatus.RESOLVED),
      },
    });
    for (const a of responded) {
      const d = a.entityId
        ? await this.ds.manager.findOne(MaterialDispatch, {
            where: { id: a.entityId },
            loadEagerRelations: false,
          })
        : null;
      if (d && d.status !== DispatchStatus.PENDING_ACCEPTANCE)
        await this.autoResolve({
          dedupKey: a.dedupKey ?? '',
          notes: 'Entrega respondida',
        });
    }
    // Órdenes cerradas resuelven sus retrasos.
    const delays = await this.alerts.find({
      where: { type: AlertType.DELAY, status: Not(AlertStatus.RESOLVED) },
    });
    for (const a of delays) {
      const o = a.entityId
        ? await this.ds.manager.findOne(ProductionOrder, {
            where: { id: a.entityId },
            loadEagerRelations: false,
          })
        : null;
      if (
        o &&
        (o.deliveredAt ||
          [OrderStatus.APPROVED_CLOSED, OrderStatus.CANCELLED].includes(
            o.status,
          ))
      ) {
        await this.autoResolve({
          dedupKey: a.dedupKey ?? '',
          notes: 'Orden entregada/cerrada',
        });
      }
    }
    await this.checkMinStock();
    return { checkedOrders: open.length, pendingDispatches: pending.length };
  }

  async list(q: AlertQueryDto, user: AuthUser) {
    const where: FindOptionsWhere<Alert> = {};
    if (q.status) where.status = q.status;
    if (q.type) where.type = q.type;
    if (q.severity) where.severity = q.severity;
    // RN-014: el taller solo ve las alertas de su taller.
    if (user.workshopId) where.workshopId = user.workshopId;
    return paginated(
      await this.alerts.findAndCount({
        where,
        order: { createdAt: 'DESC' },
        skip: q.skip,
        take: q.pageSize,
      }),
      q,
    );
  }

  async counts(user: AuthUser) {
    const base: FindOptionsWhere<Alert> = { status: Not(AlertStatus.RESOLVED) };
    if (user.workshopId) base.workshopId = user.workshopId;
    const rows = await this.alerts.find({ where: base });
    const by = (k: 'severity' | 'type') =>
      rows.reduce<Record<string, number>>(
        (acc, r) => ({ ...acc, [String(r[k])]: (acc[String(r[k])] ?? 0) + 1 }),
        {},
      );
    return {
      open: rows.length,
      bySeverity: by('severity'),
      byType: by('type'),
    };
  }

  async setStatus(
    id: string,
    status: AlertStatus,
    user: AuthUser,
    notes?: string,
  ) {
    const a = await this.alerts.findOne({ where: { id } });
    if (!a || (user.workshopId && a.workshopId !== user.workshopId))
      throw new NotFoundException('Alerta no encontrada');
    a.status = status;
    if (status === AlertStatus.RESOLVED) {
      a.resolvedAt = new Date();
      a.resolvedById = user.id;
      a.resolutionNotes = notes ?? null;
    }
    return this.alerts.save(a);
  }
}

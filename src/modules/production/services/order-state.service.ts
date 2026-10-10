import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import {
  AuditAction,
  OrderStatus as S,
} from '../../../common/enums/domain.enums';
import type { AuthUser } from '../../../common/types/auth-user';
import { InvalidStateException } from '../../../common/utils/business-error';
import { AuditService } from '../../audit/audit.service';
import { OrderStatusHistory } from '../entities/order-status-history.entity';
import { ProductionOrder } from '../entities/production-order.entity';

/** Transiciones permitidas (sección 7.1). */
export const ORDER_TRANSITIONS: Record<S, S[]> = {
  [S.DRAFT]: [S.PENDING_MATERIALS, S.READY_FOR_DISPATCH, S.CANCELLED],
  [S.PENDING_MATERIALS]: [
    S.READY_FOR_DISPATCH,
    S.DISPATCHED,
    S.DRAFT,
    S.CANCELLED,
  ],
  [S.READY_FOR_DISPATCH]: [
    S.PENDING_MATERIALS,
    S.DISPATCHED,
    S.DRAFT,
    S.CANCELLED,
  ],
  [S.DISPATCHED]: [
    S.ACCEPTED_BY_WORKSHOP,
    S.PENDING_MATERIALS,
    S.READY_FOR_DISPATCH,
    S.CANCELLED,
  ],
  [S.ACCEPTED_BY_WORKSHOP]: [
    S.IN_PRODUCTION,
    S.PARTIAL,
    S.FINISHED_BY_WORKSHOP,
    S.CANCELLED,
  ],
  [S.IN_PRODUCTION]: [S.PARTIAL, S.FINISHED_BY_WORKSHOP, S.CANCELLED],
  [S.PARTIAL]: [S.FINISHED_BY_WORKSHOP, S.CANCELLED],
  [S.FINISHED_BY_WORKSHOP]: [S.IN_REVIEW, S.REJECTED_ADJUSTMENT],
  [S.IN_REVIEW]: [S.APPROVED_CLOSED, S.REJECTED_ADJUSTMENT],
  [S.REJECTED_ADJUSTMENT]: [
    S.FINISHED_BY_WORKSHOP,
    S.IN_REVIEW,
    S.IN_PRODUCTION,
    S.CANCELLED,
  ],
  [S.APPROVED_CLOSED]: [],
  [S.CANCELLED]: [],
};

export const STATUS_LABELS: Record<S, string> = {
  [S.DRAFT]: 'Borrador',
  [S.PENDING_MATERIALS]: 'Pendiente de materiales',
  [S.READY_FOR_DISPATCH]: 'Lista para despacho',
  [S.DISPATCHED]: 'Despachada',
  [S.ACCEPTED_BY_WORKSHOP]: 'Aceptada por taller',
  [S.IN_PRODUCTION]: 'En producción',
  [S.PARTIAL]: 'Parcial',
  [S.FINISHED_BY_WORKSHOP]: 'Terminada por taller',
  [S.IN_REVIEW]: 'En revisión Prestige Gold',
  [S.APPROVED_CLOSED]: 'Aprobada/Cerrada',
  [S.REJECTED_ADJUSTMENT]: 'Rechazada/Ajuste',
  [S.CANCELLED]: 'Cancelada',
};

/** Estados en los que el taller trabaja la orden (consumos, avances, solicitudes). */
export const WORKSHOP_ACTIVE_STATUSES = [
  S.ACCEPTED_BY_WORKSHOP,
  S.IN_PRODUCTION,
  S.PARTIAL,
  S.REJECTED_ADJUSTMENT,
];

/** Estados que admiten despachos adicionales de material. */
export const DISPATCHABLE_STATUSES = [
  S.PENDING_MATERIALS,
  S.READY_FOR_DISPATCH,
  S.DISPATCHED,
  S.ACCEPTED_BY_WORKSHOP,
  S.IN_PRODUCTION,
  S.PARTIAL,
  S.REJECTED_ADJUSTMENT,
];

@Injectable()
export class OrderStateService {
  constructor(private readonly audit: AuditService) {}

  assertStatus(order: ProductionOrder, allowed: S[], action: string) {
    if (!allowed.includes(order.status)) {
      throw new InvalidStateException(
        `No se puede ${action}: la orden ${order.number} está "${STATUS_LABELS[order.status]}"`,
        { status: order.status, allowed },
      );
    }
  }

  async transition(
    m: EntityManager,
    order: ProductionOrder,
    to: S,
    user: AuthUser,
    reason?: string,
  ) {
    if (order.status === to) return order;
    if (!ORDER_TRANSITIONS[order.status].includes(to)) {
      throw new InvalidStateException(
        `Transición no permitida: ${STATUS_LABELS[order.status]} → ${STATUS_LABELS[to]}`,
      );
    }
    const from = order.status;
    const now = new Date();
    const patch: Partial<ProductionOrder> = { status: to };
    if (to === S.DISPATCHED && !order.dispatchedAt) patch.dispatchedAt = now;
    if (to === S.ACCEPTED_BY_WORKSHOP && !order.acceptedAt)
      patch.acceptedAt = now;
    if (to === S.IN_PRODUCTION && !order.startedAt) patch.startedAt = now;
    if (to === S.FINISHED_BY_WORKSHOP) patch.finishedByWorkshopAt = now;
    if (to === S.APPROVED_CLOSED) {
      patch.closedAt = now;
      patch.approvedById = user.id;
    }
    if (to === S.REJECTED_ADJUSTMENT) patch.rejectionReason = reason ?? null;
    if (to === S.CANCELLED) patch.cancellationReason = reason ?? null;
    await m.update(
      ProductionOrder,
      { id: order.id },
      patch as QueryDeepPartialEntity<ProductionOrder>,
    );
    Object.assign(order, patch);
    await m.save(
      OrderStatusHistory,
      m.create(OrderStatusHistory, {
        orderId: order.id,
        fromStatus: from,
        toStatus: to,
        reason: reason ?? null,
        userId: user.id,
        userName: user.fullName,
      }),
    );
    await this.audit.log(
      {
        action: AuditAction.STATUS_CHANGE,
        entityType: 'ProductionOrder',
        entityId: order.id,
        before: { status: from },
        after: { status: to },
        description: `${order.number}: ${STATUS_LABELS[from]} → ${STATUS_LABELS[to]}${reason ? ` (${reason})` : ''}`,
      },
      m,
    );
    return order;
  }
}

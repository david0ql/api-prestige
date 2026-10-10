import { OrderStatus as S } from '../../../common/enums/domain.enums';
import { ORDER_TRANSITIONS, OrderStateService, STATUS_LABELS } from './order-state.service';
import { ProductionOrder } from '../entities/production-order.entity';
import { InvalidStateException } from '../../../common/utils/business-error';

describe('Máquina de estados de la orden (7.1)', () => {
  const audit = { log: jest.fn() };
  const svc = new OrderStateService(audit as never);
  const manager = { update: jest.fn(), save: jest.fn(), create: jest.fn((_e, v) => v) };
  const user = { id: 'u', fullName: 'Tester' } as never;

  it('todos los estados tienen etiqueta y los cerrados no tienen salida', () => {
    for (const s of Object.values(S)) expect(STATUS_LABELS[s]).toBeTruthy();
    expect(ORDER_TRANSITIONS[S.APPROVED_CLOSED]).toEqual([]);
    expect(ORDER_TRANSITIONS[S.CANCELLED]).toEqual([]);
  });

  it('solo se aprueba desde "En revisión"', () => {
    const from = Object.values(S).filter((s) => ORDER_TRANSITIONS[s].includes(S.APPROVED_CLOSED));
    expect(from).toEqual([S.IN_REVIEW]);
  });

  it('rechaza transiciones no permitidas y registra historial en las válidas', async () => {
    const order = { id: 'o', number: 'OP-1', status: S.DRAFT } as ProductionOrder;
    await expect(svc.transition(manager as never, order, S.APPROVED_CLOSED, user)).rejects.toBeInstanceOf(InvalidStateException);
    await svc.transition(manager as never, order, S.READY_FOR_DISPATCH, user, 'ok');
    expect(order.status).toBe(S.READY_FOR_DISPATCH);
    expect(manager.save).toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalled();
  });
});

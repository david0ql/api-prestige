import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, EntityManager, FindOptionsWhere, ILike, Not, Repository } from 'typeorm';
import { paginated } from '../../common/dto/pagination.dto';
import {
  AuditAction,
  CostType,
  TransactionSource,
  TransactionStatus,
  TransactionType,
} from '../../common/enums/domain.enums';
import type { AuthUser } from '../../common/types/auth-user';
import { BusinessRuleException } from '../../common/utils/business-error';
import { roundMoney } from '../../common/utils/numeric';
import { AuditService } from '../audit/audit.service';
import { FinanceCategory } from '../masters/entities/finance-category.entity';
import { PaymentMethod } from '../masters/entities/payment-method.entity';
import { Workshop } from '../masters/entities/workshop.entity';
import { SequenceService } from '../sequences/sequence.service';
import { ClosePeriodDto, CostQueryDto, CreateTransactionDto, PeriodQueryDto, TransactionQueryDto } from './dto/finance.dto';
import { CostEntry } from './entities/cost-entry.entity';
import { FinancialTransaction } from './entities/financial-transaction.entity';
import { PeriodClose } from './entities/period-close.entity';

export const SYSTEM_CATEGORY = {
  CUSTOMER_PAYMENT: 'ABONO_CLIENTE',
  WORKSHOP_PAYMENT: 'PAGO_TALLER',
  MATERIAL_PURCHASE: 'COMPRA_MATERIAL',
} as const;

const range = (from?: string, to?: string) => Between(from?.slice(0, 10) ?? '1900-01-01', to?.slice(0, 10) ?? '2999-12-31');

/** Caja / Finanzas (RF-028/029, RN-020, P14). */
@Injectable()
export class FinanceService {
  constructor(
    private readonly ds: DataSource,
    @InjectRepository(FinancialTransaction) private readonly tx: Repository<FinancialTransaction>,
    @InjectRepository(CostEntry) private readonly costs: Repository<CostEntry>,
    @InjectRepository(PeriodClose) private readonly closes: Repository<PeriodClose>,
    private readonly seq: SequenceService,
    private readonly audit: AuditService,
  ) {}

  /** Bloquea registros con fecha en un período ya cerrado. */
  async assertOpenPeriod(date: string, m?: EntityManager) {
    const period = date.slice(0, 7);
    const closed = await (m ?? this.ds.manager).exists(PeriodClose, { where: { period } });
    if (closed) throw new BusinessRuleException('PERIOD_CLOSED', `El período ${period} está cerrado: no admite movimientos financieros`);
  }

  /** Registra una transacción (usado también por abonos y pagos). */
  async record(
    m: EntityManager,
    data: Omit<CreateTransactionDto, 'categoryId'> & { categoryId?: string; categoryCode?: string; source?: TransactionSource; sourceId?: string },
    user: AuthUser,
  ): Promise<FinancialTransaction> {
    await this.assertOpenPeriod(data.transactionDate, m);
    const category = data.categoryId
      ? await m.findOne(FinanceCategory, { where: { id: data.categoryId } })
      : await m.findOne(FinanceCategory, { where: { code: data.categoryCode } });
    if (!category || !category.active) throw new BadRequestException('Categoría financiera inválida');
    if (category.type !== data.type) throw new BadRequestException('La categoría no corresponde al tipo de transacción');
    if (data.paymentMethodId && !(await m.exists(PaymentMethod, { where: { id: data.paymentMethodId, active: true } }))) {
      throw new BadRequestException('Medio de pago inválido');
    }
    if (category.code === SYSTEM_CATEGORY.WORKSHOP_PAYMENT && !data.workshopId) {
      throw new BadRequestException('El pago a taller requiere indicar el taller');
    }
    if (data.workshopId && !(await m.exists(Workshop, { where: { id: data.workshopId } }))) throw new BadRequestException('Taller inexistente');
    return m.save(FinancialTransaction, m.create(FinancialTransaction, {
      number: await this.seq.next(m, data.type === TransactionType.INCOME ? 'ING' : 'EGR'),
      type: data.type,
      categoryId: category.id,
      concept: data.concept,
      amount: roundMoney(data.amount),
      transactionDate: data.transactionDate.slice(0, 10),
      thirdPartyName: data.thirdPartyName ?? null,
      customerId: data.customerId ?? null,
      workshopId: data.workshopId ?? null,
      productionOrderId: data.productionOrderId ?? null,
      paymentMethodId: data.paymentMethodId ?? null,
      supportReference: data.supportReference ?? null,
      source: data.source ?? TransactionSource.MANUAL,
      sourceId: data.sourceId ?? null,
      notes: data.notes ?? null,
      responsibleId: user.id,
    }));
  }

  async create(dto: CreateTransactionDto, user: AuthUser) {
    const saved = await this.ds.transaction((m) =>
      this.record(m, { ...dto, source: dto.workshopId ? TransactionSource.WORKSHOP_PAYMENT : TransactionSource.MANUAL }, user),
    );
    return this.get(saved.id);
  }

  async get(id: string) {
    const t = await this.tx.findOne({ where: { id } });
    if (!t) throw new NotFoundException('Transacción no encontrada');
    return t;
  }

  /** RN-015: reverso auditable (la original queda REVERSADA y se crea la contrapartida). */
  async reverse(id: string, reason: string, user: AuthUser, m?: EntityManager) {
    const run = async (em: EntityManager) => {
      const t = await em.findOne(FinancialTransaction, { where: { id }, lock: { mode: 'pessimistic_write' }, loadEagerRelations: false });
      if (!t) throw new NotFoundException('Transacción no encontrada');
      if (t.status === TransactionStatus.REVERSED) throw new BusinessRuleException('ALREADY_REVERSED', 'La transacción ya fue reversada');
      if (t.source === TransactionSource.REVERSAL) throw new BusinessRuleException('IS_REVERSAL', 'Un reverso no puede reversarse');
      const today = new Date().toISOString().slice(0, 10);
      await this.assertOpenPeriod(today, em);
      await em.update(FinancialTransaction, { id }, { status: TransactionStatus.REVERSED });
      const rev = await em.save(FinancialTransaction, em.create(FinancialTransaction, {
        number: await this.seq.next(em, 'REV'),
        type: t.type === TransactionType.INCOME ? TransactionType.EXPENSE : TransactionType.INCOME,
        categoryId: t.categoryId,
        concept: `Reverso de ${t.number}: ${reason}`.slice(0, 200),
        amount: t.amount,
        transactionDate: today,
        thirdPartyName: t.thirdPartyName,
        customerId: t.customerId,
        workshopId: t.workshopId,
        paymentMethodId: t.paymentMethodId,
        supportReference: t.number,
        source: TransactionSource.REVERSAL,
        sourceId: t.id,
        status: TransactionStatus.POSTED,
        reversalOfId: t.id,
        notes: reason,
        responsibleId: user.id,
      }));
      await this.audit.log({ action: AuditAction.REVERSE, entityType: 'FinancialTransaction', entityId: id, description: `Reverso ${t.number}: ${reason}` }, em);
      return rev;
    };
    return m ? run(m) : this.ds.transaction(run);
  }

  async list(q: TransactionQueryDto) {
    const where: FindOptionsWhere<FinancialTransaction> = {};
    if (q.type) where.type = q.type;
    if (q.categoryId) where.categoryId = q.categoryId;
    if (q.workshopId) where.workshopId = q.workshopId;
    if (q.customerId) where.customerId = q.customerId;
    if (q.paymentMethodId) where.paymentMethodId = q.paymentMethodId;
    if (q.from || q.to) where.transactionDate = range(q.from, q.to);
    const final = q.search
      ? [{ ...where, concept: ILike(`%${q.search}%`) }, { ...where, number: ILike(`%${q.search}%`) }, { ...where, thirdPartyName: ILike(`%${q.search}%`) }]
      : where;
    return paginated(await this.tx.findAndCount({ where: final, order: { transactionDate: 'DESC', createdAt: 'DESC' }, skip: q.skip, take: q.pageSize }), q);
  }

  /** Transacciones efectivas: contabilizadas y que no son contrapartidas de reverso. */
  effectiveWhere(extra: FindOptionsWhere<FinancialTransaction> = {}): FindOptionsWhere<FinancialTransaction> {
    return { ...extra, status: TransactionStatus.POSTED, source: Not(TransactionSource.REVERSAL) };
  }

  /** Resumen de caja: ingresos, egresos y saldo; por categoría y por medio de pago. */
  async summary(q: PeriodQueryDto) {
    const rows = await this.tx.find({ where: this.effectiveWhere(q.from || q.to ? { transactionDate: range(q.from, q.to) } : {}) });
    const income = roundMoney(rows.filter((r) => r.type === TransactionType.INCOME).reduce((s, r) => s + r.amount, 0));
    const expense = roundMoney(rows.filter((r) => r.type === TransactionType.EXPENSE).reduce((s, r) => s + r.amount, 0));
    const group = (key: (r: FinancialTransaction) => string) => {
      const map = new Map<string, { key: string; income: number; expense: number }>();
      for (const r of rows) {
        const k = key(r);
        const e = map.get(k) ?? { key: k, income: 0, expense: 0 };
        if (r.type === TransactionType.INCOME) e.income = roundMoney(e.income + r.amount);
        else e.expense = roundMoney(e.expense + r.amount);
        map.set(k, e);
      }
      return [...map.values()];
    };
    return {
      income,
      expense,
      balance: roundMoney(income - expense),
      byCategory: group((r) => r.category.name),
      byPaymentMethod: group((r) => r.paymentMethod?.name ?? 'Sin medio'),
      count: rows.length,
    };
  }

  async listCosts(q: CostQueryDto) {
    const where: FindOptionsWhere<CostEntry> = {};
    if (q.type) where.type = q.type;
    if (q.workshopId) where.workshopId = q.workshopId;
    if (q.orderId) where.orderId = q.orderId;
    if (q.from || q.to) where.periodDate = range(q.from, q.to);
    return paginated(await this.costs.findAndCount({ where, order: { createdAt: 'DESC' }, skip: q.skip, take: q.pageSize }), q);
  }

  /** Cuentas por pagar a talleres: mano de obra aprobada − pagos realizados. */
  async workshopPayables() {
    const workshops = await this.ds.manager.find(Workshop, { order: { code: 'ASC' } });
    const out = [];
    for (const w of workshops) {
      const approved = (await this.costs.sum('amount', { workshopId: w.id, type: CostType.LABOR })) ?? 0;
      const payCategory = await this.ds.manager.findOne(FinanceCategory, { where: { code: SYSTEM_CATEGORY.WORKSHOP_PAYMENT } });
      const paid = payCategory ? ((await this.tx.sum('amount', this.effectiveWhere({ workshopId: w.id, categoryId: payCategory.id }))) ?? 0) : 0;
      out.push({ workshop: { id: w.id, code: w.code, name: w.name }, approvedLabor: roundMoney(approved), paid: roundMoney(paid), balance: roundMoney(approved - paid) });
    }
    return out;
  }

  listCloses() {
    return this.closes.find({ order: { period: 'DESC' } });
  }

  async closePeriod(dto: ClosePeriodDto, user: AuthUser) {
    if (await this.closes.exists({ where: { period: dto.period } })) throw new BusinessRuleException('PERIOD_CLOSED', 'El período ya está cerrado');
    const from = `${dto.period}-01`;
    const [y, mo] = dto.period.split('-').map(Number);
    const to = new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10);
    if (to >= new Date().toISOString().slice(0, 10)) throw new BusinessRuleException('PERIOD_NOT_ENDED', 'Solo se pueden cerrar períodos terminados');
    const s = await this.summary({ from, to });
    const material = (await this.costs.sum('amount', { type: CostType.MATERIAL, periodDate: range(from, to) })) ?? 0;
    const labor = (await this.costs.sum('amount', { type: CostType.LABOR, periodDate: range(from, to) })) ?? 0;
    const close = await this.closes.save(this.closes.create({
      period: dto.period,
      totals: { income: s.income, expense: s.expense, balance: s.balance, materialCost: roundMoney(material), laborCost: roundMoney(labor) },
      notes: dto.notes ?? null,
      closedById: user.id,
    }));
    await this.audit.log({ action: AuditAction.APPROVE, entityType: 'PeriodClose', entityId: close.id, description: `Cierre financiero ${dto.period}` });
    return close;
  }
}

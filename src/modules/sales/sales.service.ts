import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, FindOptionsWhere, ILike, Repository } from 'typeorm';
import { paginated } from '../../common/dto/pagination.dto';
import {
  AuditAction,
  ContributionTiming,
  FinishedGoodStatus,
  MovementType,
  OperationStatus,
  PurityStatus,
  QualityResult,
  RecordStatus,
  TransactionSource,
  TransactionStatus,
  TransactionType,
  WeighingPurpose,
} from '../../common/enums/domain.enums';
import type { AuthUser } from '../../common/types/auth-user';
import { BusinessRuleException } from '../../common/utils/business-error';
import {
  GRAM_EPSILON,
  roundGrams,
  roundMoney,
} from '../../common/utils/numeric';
import { AuditService } from '../audit/audit.service';
import { FinanceService, SYSTEM_CATEGORY } from '../finance/finance.service';
import { InventoryService } from '../inventory/inventory.service';
import { MastersService } from '../masters/masters.service';
import { FinishedGood } from '../production/entities/finished-good.entity';
import { ScaleService } from '../scale/scale.service';
import { SequenceService } from '../sequences/sequence.service';
import {
  CreateContributionDto,
  CreateOperationDto,
  CreatePaymentDto,
  CreateSaleDispatchDto,
  CustomerScopedQueryDto,
  OperationQueryDto,
  UpdateOperationDto,
} from './dto/sales.dto';
import { CustomerMaterialContribution } from './entities/customer-material-contribution.entity';
import { CustomerOperation } from './entities/customer-operation.entity';
import { CustomerPayment } from './entities/customer-payment.entity';
import { SaleDispatch } from './entities/sale-dispatch.entity';
import { SaleDispatchLine } from './entities/sale-dispatch-line.entity';

/**
 * Clientes, ventas y abonos (RF-025/026/027/045, RN-016/017/022, P13, CA-009/014).
 * Dinero y material viajan por entidades y saldos SEPARADOS.
 */
@Injectable()
export class SalesService {
  constructor(
    private readonly ds: DataSource,
    @InjectRepository(CustomerOperation)
    private readonly operations: Repository<CustomerOperation>,
    @InjectRepository(SaleDispatch)
    private readonly sales: Repository<SaleDispatch>,
    @InjectRepository(CustomerPayment)
    private readonly payments: Repository<CustomerPayment>,
    @InjectRepository(CustomerMaterialContribution)
    private readonly contributions: Repository<CustomerMaterialContribution>,
    private readonly masters: MastersService,
    private readonly inventory: InventoryService,
    private readonly scale: ScaleService,
    private readonly finance: FinanceService,
    private readonly seq: SequenceService,
    private readonly audit: AuditService,
  ) {}

  private async activeCustomer(id: string) {
    const c = await this.masters.getCustomer(id);
    if (c.status !== RecordStatus.ACTIVE)
      throw new BadRequestException('El cliente está inactivo');
    return c;
  }

  // ---------------- Operaciones ----------------
  async createOperation(dto: CreateOperationDto, user: AuthUser) {
    await this.activeCustomer(dto.customerId);
    return this.ds.transaction(async (m) =>
      m.save(
        CustomerOperation,
        m.create(CustomerOperation, {
          number: await this.seq.next(m, 'OPC'),
          customerId: dto.customerId,
          type: dto.type,
          description: dto.description,
          totalValue: roundMoney(dto.totalValue ?? 0),
          committedMaterialFineGrams: roundGrams(
            dto.committedMaterialFineGrams ?? 0,
          ),
          productionOrderId: dto.productionOrderId ?? null,
          dueDate: dto.dueDate?.slice(0, 10) ?? null,
          notes: dto.notes ?? null,
          createdById: user.id,
        }),
      ),
    );
  }

  async updateOperation(id: string, dto: UpdateOperationDto) {
    const op = await this.getOperationEntity(id);
    if (
      [OperationStatus.CLOSED, OperationStatus.CANCELLED].includes(op.status) &&
      dto.status !== OperationStatus.OPEN
    ) {
      throw new BusinessRuleException(
        'OPERATION_CLOSED',
        'La operación está cerrada',
      );
    }
    if (dto.status === OperationStatus.CANCELLED) {
      const paid = await this.paidAmount(id);
      const contributed = await this.contributedFine(id);
      const sold = await this.sales.exists({
        where: { operationId: id, reversed: false },
      });
      if (paid > 0 || contributed > 0 || sold) {
        throw new BusinessRuleException(
          'OPERATION_HAS_MOVEMENTS',
          'La operación tiene abonos, aportes o despachos: reverse primero',
        );
      }
    }
    Object.assign(op, {
      ...dto,
      dueDate: dto.dueDate?.slice(0, 10) ?? op.dueDate,
      totalValue:
        dto.totalValue !== undefined
          ? roundMoney(dto.totalValue)
          : op.totalValue,
    });
    delete (op as Partial<CustomerOperation>).customer;
    await this.operations.save(op);
    return this.getOperation(id);
  }

  private async getOperationEntity(id: string) {
    const op = await this.operations.findOne({ where: { id } });
    if (!op) throw new NotFoundException('Operación no encontrada');
    return op;
  }

  private async paidAmount(operationId: string) {
    return roundMoney(
      (await this.payments.sum('amount', {
        operationId,
        status: TransactionStatus.POSTED,
      })) ?? 0,
    );
  }

  private async contributedFine(operationId: string) {
    return roundGrams(
      (await this.contributions.sum('fineGrams', {
        operationId,
        status: TransactionStatus.POSTED,
      })) ?? 0,
    );
  }

  /** RF-045: saldos separados de dinero y material por operación. */
  async operationBalances(op: CustomerOperation) {
    const paid = await this.paidAmount(op.id);
    const contributedFine = await this.contributedFine(op.id);
    const contributedGross = roundGrams(
      (await this.contributions.sum('grams', {
        operationId: op.id,
        status: TransactionStatus.POSTED,
      })) ?? 0,
    );
    const valuation = roundMoney(
      (
        await this.contributions.find({
          where: { operationId: op.id, status: TransactionStatus.POSTED },
        })
      ).reduce((s, x) => s + (x.valuation ?? 0), 0),
    );
    const dispatchedValue = roundMoney(
      (await this.sales.sum('totalValue', {
        operationId: op.id,
        reversed: false,
      })) ?? 0,
    );
    return {
      money: {
        totalValue: op.totalValue,
        dispatchedValue,
        paid,
        balance: roundMoney(op.totalValue - paid),
      },
      material: {
        committedFineGrams: op.committedMaterialFineGrams,
        contributedGrossGrams: contributedGross,
        contributedFineGrams: contributedFine,
        balanceFineGrams: roundGrams(
          op.committedMaterialFineGrams - contributedFine,
        ),
        valuation,
      },
    };
  }

  async listOperations(q: OperationQueryDto) {
    const where: FindOptionsWhere<CustomerOperation> = {};
    if (q.customerId) where.customerId = q.customerId;
    if (q.status) where.status = q.status;
    const final = q.search
      ? [
          { ...where, number: ILike(`%${q.search}%`) },
          { ...where, description: ILike(`%${q.search}%`) },
          { ...where, customer: { name: ILike(`%${q.search}%`) } },
        ]
      : where;
    const [items, total] = await this.operations.findAndCount({
      where: final,
      order: { createdAt: 'DESC' },
      skip: q.skip,
      take: q.pageSize,
    });
    const withBalances = [];
    for (const op of items)
      withBalances.push({ ...op, balances: await this.operationBalances(op) });
    return paginated(
      [withBalances as unknown as CustomerOperation[], total],
      q,
    );
  }

  async getOperation(id: string) {
    const op = await this.getOperationEntity(id);
    const [payments, contributions, dispatches] = await Promise.all([
      this.payments.find({
        where: { operationId: id },
        order: { paymentDate: 'DESC' },
      }),
      this.contributions.find({
        where: { operationId: id },
        order: { contributionDate: 'DESC' },
      }),
      this.sales.find({
        where: { operationId: id },
        order: { dispatchDate: 'DESC' },
      }),
    ]);
    return {
      ...op,
      balances: await this.operationBalances(op),
      payments,
      contributions,
      dispatches,
    };
  }

  // ---------------- Despachos/ventas (RF-025, RN-022, CA-014) ----------------
  async createSale(dto: CreateSaleDispatchDto, user: AuthUser) {
    const op = await this.getOperationEntity(dto.operationId);
    if (
      ![
        OperationStatus.OPEN,
        OperationStatus.PARTIALLY_DISPATCHED,
        OperationStatus.DISPATCHED,
      ].includes(op.status)
    ) {
      throw new BusinessRuleException(
        'OPERATION_CLOSED',
        'La operación no admite despachos',
      );
    }
    await this.activeCustomer(op.customerId);
    const id = randomUUID();
    await this.ds.transaction(async (m) => {
      let total = 0;
      const lines: SaleDispatchLine[] = [];
      for (const l of dto.lines) {
        const g = await m.findOne(FinishedGood, {
          where: { id: l.finishedGoodId },
          lock: { mode: 'pessimistic_write' },
          loadEagerRelations: false,
        });
        if (!g) throw new BadRequestException('Producto terminado inexistente');
        const product = await this.masters.getProduct(g.productId);
        // RN-022 / CA-014: solo piezas liberadas por calidad y ley.
        const purityOk =
          g.purityStatus === PurityStatus.CONFORMING ||
          (!product.requiresPurityCheck &&
            g.purityStatus === PurityStatus.NOT_REQUIRED);
        if (
          g.status !== FinishedGoodStatus.AVAILABLE ||
          g.qualityStatus !== QualityResult.APPROVED ||
          !purityOk
        ) {
          throw new BusinessRuleException(
            'PRODUCT_NOT_RELEASED',
            `La pieza ${g.code} no puede despacharse: requiere control de calidad aprobado${product.requiresPurityCheck ? ' y ley/pureza conforme' : ''} (estado ${g.status}, calidad ${g.qualityStatus}, ley ${g.purityStatus})`,
          );
        }
        const units = l.units;
        let grams =
          l.grams ??
          (g.units > 0
            ? roundGrams((g.grams / g.units) * units)
            : g.availableGrams);
        if (l.weighingId) {
          const w = await this.scale.consume(
            m,
            l.weighingId,
            [WeighingPurpose.SALE],
            'SaleDispatch',
            id,
          );
          grams = w.currentNetGrams;
        }
        if (
          units > g.availableUnits ||
          grams > g.availableGrams + GRAM_EPSILON
        ) {
          throw new BusinessRuleException(
            'INSUFFICIENT_FINISHED',
            `La pieza ${g.code} solo tiene ${g.availableUnits} u / ${g.availableGrams} g disponibles`,
          );
        }
        const availableUnits = g.availableUnits - units;
        const availableGrams = roundGrams(g.availableGrams - grams);
        await m.update(
          FinishedGood,
          { id: g.id },
          {
            availableUnits,
            availableGrams,
            status:
              availableGrams <= GRAM_EPSILON
                ? FinishedGoodStatus.SOLD
                : FinishedGoodStatus.AVAILABLE,
          },
        );
        total += l.value;
        lines.push(
          m.create(SaleDispatchLine, {
            dispatchId: id,
            finishedGoodId: g.id,
            units,
            grams,
            value: roundMoney(l.value),
            cost: roundMoney(grams * (g.unitCostPerGram ?? 0)),
            weighingId: l.weighingId ?? null,
          }),
        );
      }
      await m.save(
        SaleDispatch,
        m.create(SaleDispatch, {
          id,
          number: await this.seq.next(m, 'VEN'),
          operationId: op.id,
          customerId: op.customerId,
          dispatchDate: dto.dispatchDate.slice(0, 10),
          totalValue: roundMoney(total),
          notes: dto.notes ?? null,
          responsibleId: user.id,
          lines: [],
        }),
      );
      await m.save(SaleDispatchLine, lines);
      const dispatched = roundMoney(
        (await m
          .getRepository(SaleDispatch)
          .sum('totalValue', { operationId: op.id, reversed: false })) ?? 0,
      );
      await m.update(
        CustomerOperation,
        { id: op.id },
        {
          totalValue: Math.max(op.totalValue, dispatched),
          status:
            dispatched + 0.005 >= op.totalValue
              ? OperationStatus.DISPATCHED
              : OperationStatus.PARTIALLY_DISPATCHED,
        },
      );
    });
    return this.sales.findOneOrFail({ where: { id } });
  }

  async reverseSale(id: string, reason: string) {
    await this.ds.transaction(async (m) => {
      const s = await m.findOne(SaleDispatch, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
        loadEagerRelations: false,
      });
      if (!s) throw new NotFoundException('Despacho no encontrado');
      if (s.reversed)
        throw new BusinessRuleException(
          'ALREADY_REVERSED',
          'El despacho ya fue reversado',
        );
      const lines = await m.find(SaleDispatchLine, {
        where: { dispatchId: id },
        loadEagerRelations: false,
      });
      for (const l of lines) {
        const g = await m.findOneOrFail(FinishedGood, {
          where: { id: l.finishedGoodId },
          lock: { mode: 'pessimistic_write' },
          loadEagerRelations: false,
        });
        await m.update(
          FinishedGood,
          { id: g.id },
          {
            availableUnits: g.availableUnits + l.units,
            availableGrams: roundGrams(g.availableGrams + l.grams),
            status: FinishedGoodStatus.AVAILABLE,
          },
        );
      }
      await m.update(
        SaleDispatch,
        { id },
        {
          reversed: true,
          notes: `${s.notes ?? ''} [REVERSADO: ${reason}]`.trim(),
        },
      );
      await this.audit.log(
        {
          action: AuditAction.REVERSE,
          entityType: 'SaleDispatch',
          entityId: id,
          description: reason,
        },
        m,
      );
    });
    return this.sales.findOneOrFail({ where: { id } });
  }

  listSales(q: CustomerScopedQueryDto) {
    const where: FindOptionsWhere<SaleDispatch> = {};
    if (q.customerId) where.customerId = q.customerId;
    if (q.operationId) where.operationId = q.operationId;
    return this.sales
      .findAndCount({
        where,
        order: { dispatchDate: 'DESC', createdAt: 'DESC' },
        skip: q.skip,
        take: q.pageSize,
      })
      .then((r) => paginated(r, q));
  }

  // ---------------- Abonos monetarios (RF-026) ----------------
  async createPayment(dto: CreatePaymentDto, user: AuthUser) {
    const customer = await this.activeCustomer(dto.customerId);
    if (dto.operationId) {
      const op = await this.getOperationEntity(dto.operationId);
      if (op.customerId !== dto.customerId)
        throw new BadRequestException('La operación no pertenece al cliente');
      if (op.status === OperationStatus.CANCELLED)
        throw new BusinessRuleException(
          'OPERATION_CLOSED',
          'La operación está cancelada',
        );
    }
    const id = randomUUID();
    await this.ds.transaction(async (m) => {
      const number = await this.seq.next(m, 'ABO');
      const tx = await this.finance.record(
        m,
        {
          type: TransactionType.INCOME,
          categoryCode: SYSTEM_CATEGORY.CUSTOMER_PAYMENT,
          concept: `Abono ${number} · ${customer.name}`,
          amount: dto.amount,
          transactionDate: dto.paymentDate,
          thirdPartyName: customer.name,
          customerId: customer.id,
          paymentMethodId: dto.paymentMethodId,
          supportReference: dto.reference,
          source: TransactionSource.CUSTOMER_PAYMENT,
          sourceId: id,
        },
        user,
      );
      await m.save(
        CustomerPayment,
        m.create(CustomerPayment, {
          id,
          number,
          customerId: dto.customerId,
          operationId: dto.operationId ?? null,
          amount: roundMoney(dto.amount),
          paymentMethodId: dto.paymentMethodId,
          paymentDate: dto.paymentDate.slice(0, 10),
          reference: dto.reference ?? null,
          notes: dto.notes ?? null,
          financialTransactionId: tx.id,
          receivedById: user.id,
        }),
      );
    });
    return this.payments.findOneOrFail({ where: { id } });
  }

  async reversePayment(id: string, reason: string, user: AuthUser) {
    await this.ds.transaction(async (m) => {
      const p = await m.findOne(CustomerPayment, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
        loadEagerRelations: false,
      });
      if (!p) throw new NotFoundException('Abono no encontrado');
      if (p.status === TransactionStatus.REVERSED)
        throw new BusinessRuleException(
          'ALREADY_REVERSED',
          'El abono ya fue reversado',
        );
      if (p.financialTransactionId)
        await this.finance.reverse(p.financialTransactionId, reason, user, m);
      await m.update(
        CustomerPayment,
        { id },
        { status: TransactionStatus.REVERSED },
      );
      await this.audit.log(
        {
          action: AuditAction.REVERSE,
          entityType: 'CustomerPayment',
          entityId: id,
          description: reason,
        },
        m,
      );
    });
    return this.payments.findOneOrFail({ where: { id } });
  }

  listPayments(q: CustomerScopedQueryDto) {
    const where: FindOptionsWhere<CustomerPayment> = {};
    if (q.customerId) where.customerId = q.customerId;
    if (q.operationId) where.operationId = q.operationId;
    return this.payments
      .findAndCount({
        where,
        order: { paymentDate: 'DESC', createdAt: 'DESC' },
        skip: q.skip,
        take: q.pageSize,
      })
      .then((r) => paginated(r, q));
  }

  // ---------------- Aportes de material (RF-027, RN-017, CA-009) ----------------
  async createContribution(dto: CreateContributionDto, user: AuthUser) {
    const customer = await this.activeCustomer(dto.customerId);
    const op = await this.getOperationEntity(dto.operationId);
    if (op.customerId !== dto.customerId)
      throw new BadRequestException('La operación no pertenece al cliente');
    if (op.status === OperationStatus.CANCELLED)
      throw new BusinessRuleException(
        'OPERATION_CLOSED',
        'La operación está cancelada',
      );
    const material = await this.masters.activeMaterial(dto.materialId);
    const office = await this.masters.motherOffice();
    const id = randomUUID();
    await this.ds.transaction(async (m) => {
      // El material del cliente SIEMPRE se pesa en Balanza Madre.
      const w = await this.scale.consume(
        m,
        dto.weighingId,
        [WeighingPurpose.CUSTOMER_MATERIAL],
        'CustomerMaterialContribution',
        id,
        material.id,
      );
      const purity = dto.verifiedPurity ?? dto.declaredPurity;
      const fine = roundGrams((w.currentNetGrams * purity) / 1000);
      const number = await this.seq.next(m, 'APM');
      const lot = await this.inventory.ensureLot(m, material, {
        code: `CLI-${number}`,
        purity,
        origin: dto.origin,
        customerId: customer.id,
      });
      const mv = await this.inventory.post(
        m,
        {
          type: MovementType.CUSTOMER_CONTRIBUTION,
          materialId: material.id,
          lotId: lot?.id ?? null,
          grams: w.currentNetGrams,
          toLocationId: office.id,
          customerId: customer.id,
          productionOrderId:
            dto.productionOrderId ?? op.productionOrderId ?? null,
          weighingId: w.id,
          sourceType: 'CUSTOMER_CONTRIBUTION',
          sourceId: id,
          reference: number,
          origin: dto.origin,
          purity,
          notes: `${dto.timing === ContributionTiming.BEFORE_FABRICATION ? 'Antes' : 'Después'} de fabricación · ${op.number}`,
        },
        user,
      );
      await m.save(
        CustomerMaterialContribution,
        m.create(CustomerMaterialContribution, {
          id,
          number,
          customerId: customer.id,
          operationId: op.id,
          materialId: material.id,
          grams: w.currentNetGrams,
          declaredPurity: dto.declaredPurity,
          verifiedPurity: dto.verifiedPurity ?? null,
          fineGrams: fine,
          timing: dto.timing,
          origin: dto.origin,
          contributionDate: dto.contributionDate.slice(0, 10),
          pricePerGram: dto.pricePerGram ?? null,
          valuation:
            dto.pricePerGram !== undefined
              ? roundMoney(fine * dto.pricePerGram)
              : null,
          productionOrderId:
            dto.productionOrderId ?? op.productionOrderId ?? null,
          weighingId: w.id,
          movementId: mv.id,
          lotId: lot?.id ?? null,
          notes: dto.notes ?? null,
          receivedById: user.id,
        }),
      );
    });
    return this.contributions.findOneOrFail({ where: { id } });
  }

  async reverseContribution(id: string, reason: string, user: AuthUser) {
    await this.ds.transaction(async (m) => {
      const c = await m.findOne(CustomerMaterialContribution, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
        loadEagerRelations: false,
      });
      if (!c) throw new NotFoundException('Aporte no encontrado');
      if (c.status === TransactionStatus.REVERSED)
        throw new BusinessRuleException(
          'ALREADY_REVERSED',
          'El aporte ya fue reversado',
        );
      const office = await this.masters.motherOffice();
      await this.inventory.post(
        m,
        {
          type: MovementType.REVERSAL,
          materialId: c.materialId,
          lotId: c.lotId,
          grams: c.grams,
          fromLocationId: office.id,
          customerId: c.customerId,
          sourceType: 'CUSTOMER_CONTRIBUTION',
          sourceId: c.id,
          reference: c.number,
          notes: reason,
          reversalOfId: c.movementId,
        },
        user,
      );
      await m.update(
        CustomerMaterialContribution,
        { id },
        { status: TransactionStatus.REVERSED },
      );
      await this.audit.log(
        {
          action: AuditAction.REVERSE,
          entityType: 'CustomerMaterialContribution',
          entityId: id,
          description: reason,
        },
        m,
      );
    });
    return this.contributions.findOneOrFail({ where: { id } });
  }

  listContributions(q: CustomerScopedQueryDto) {
    const where: FindOptionsWhere<CustomerMaterialContribution> = {};
    if (q.customerId) where.customerId = q.customerId;
    if (q.operationId) where.operationId = q.operationId;
    return this.contributions
      .findAndCount({
        where,
        order: { contributionDate: 'DESC', createdAt: 'DESC' },
        skip: q.skip,
        take: q.pageSize,
      })
      .then((r) => paginated(r, q));
  }

  /** P13 · Estado de cuenta del cliente con saldos de dinero y material separados. */
  async customerAccount(customerId: string) {
    const customer = await this.masters.getCustomer(customerId);
    const ops = await this.operations.find({
      where: { customerId },
      order: { createdAt: 'DESC' },
    });
    const operations = [];
    let moneyBalance = 0,
      totalValue = 0,
      paid = 0,
      committedFine = 0,
      contributedFine = 0,
      valuation = 0;
    for (const op of ops) {
      const b = await this.operationBalances(op);
      operations.push({ ...op, balances: b });
      if (op.status !== OperationStatus.CANCELLED) {
        totalValue += b.money.totalValue;
        paid += b.money.paid;
        moneyBalance += b.money.balance;
        committedFine += b.material.committedFineGrams;
        contributedFine += b.material.contributedFineGrams;
        valuation += b.material.valuation;
      }
    }
    const [payments, contributions, sales] = await Promise.all([
      this.payments.find({
        where: { customerId },
        order: { paymentDate: 'DESC' },
      }),
      this.contributions.find({
        where: { customerId },
        order: { contributionDate: 'DESC' },
      }),
      this.sales.find({
        where: { customerId },
        order: { dispatchDate: 'DESC' },
      }),
    ]);
    // Aportes sin operación no existen (validación), pero los pagos pueden ser a cuenta general.
    const unassignedPaid = roundMoney(
      payments
        .filter((p) => !p.operationId && p.status === TransactionStatus.POSTED)
        .reduce((s, p) => s + p.amount, 0),
    );
    return {
      customer,
      totals: {
        money: {
          totalValue: roundMoney(totalValue),
          paid: roundMoney(paid + unassignedPaid),
          balance: roundMoney(moneyBalance - unassignedPaid),
          unassignedPaid,
        },
        material: {
          committedFineGrams: roundGrams(committedFine),
          contributedFineGrams: roundGrams(contributedFine),
          balanceFineGrams: roundGrams(committedFine - contributedFine),
          valuation: roundMoney(valuation),
        },
      },
      operations,
      payments,
      contributions,
      sales,
    };
  }
}

import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import {
  TransactionSource,
  TransactionStatus,
  TransactionType,
} from '../../../common/enums/domain.enums';
import { moneyColumn } from '../../../common/utils/numeric';
import { FinanceCategory } from '../../masters/entities/finance-category.entity';
import { PaymentMethod } from '../../masters/entities/payment-method.entity';

/**
 * Ingreso/egreso (RF-028, RN-020): fecha, concepto, valor, tercero, medio,
 * responsable y soporte. Nunca se borra: se reversa (RN-015).
 */
@Entity('financial_transaction')
@Index(['transactionDate', 'type'])
export class FinancialTransaction extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 30 })
  number!: string;

  @Column({ type: 'enum', enum: TransactionType })
  type!: TransactionType;

  @ManyToOne(() => FinanceCategory, { nullable: false, eager: true })
  category!: FinanceCategory;

  @Column()
  categoryId!: string;

  @Column({ type: 'varchar', length: 200 })
  concept!: string;

  @Column(moneyColumn)
  amount!: number;

  @Column({ type: 'date' })
  transactionDate!: string;

  @Column({ type: 'varchar', length: 160, nullable: true })
  thirdPartyName!: string | null;

  @Column({ type: 'uuid', nullable: true })
  customerId!: string | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  workshopId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  productionOrderId!: string | null;

  @ManyToOne(() => PaymentMethod, { nullable: true, eager: true })
  paymentMethod!: PaymentMethod | null;

  @Column({ type: 'uuid', nullable: true })
  paymentMethodId!: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  supportReference!: string | null;

  @Column({
    type: 'enum',
    enum: TransactionSource,
    default: TransactionSource.MANUAL,
  })
  source!: TransactionSource;

  @Column({ type: 'uuid', nullable: true })
  sourceId!: string | null;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.POSTED,
  })
  status!: TransactionStatus;

  @Column({ type: 'uuid', nullable: true })
  reversalOfId!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column()
  responsibleId!: string;
}

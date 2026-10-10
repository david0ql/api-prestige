import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { TransactionStatus } from '../../../common/enums/domain.enums';
import { moneyColumn } from '../../../common/utils/numeric';
import { PaymentMethod } from '../../masters/entities/payment-method.entity';

/** Abono MONETARIO de cliente (RF-026). Tipo de movimiento independiente (RN-016). */
@Entity('customer_payment')
export class CustomerPayment extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 30 })
  number!: string;

  @Index()
  @Column()
  customerId!: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  operationId!: string | null;

  @Column(moneyColumn)
  amount!: number;

  @ManyToOne(() => PaymentMethod, { nullable: false, eager: true })
  paymentMethod!: PaymentMethod;

  @Column()
  paymentMethodId!: string;

  @Column({ type: 'date' })
  paymentDate!: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  reference!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.POSTED,
  })
  status!: TransactionStatus;

  @Column({ type: 'uuid', nullable: true })
  financialTransactionId!: string | null;

  @Column()
  receivedById!: string;
}

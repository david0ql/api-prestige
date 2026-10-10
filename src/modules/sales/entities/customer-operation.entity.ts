import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import {
  OperationStatus,
  OperationType,
} from '../../../common/enums/domain.enums';
import { gramsColumn, moneyColumn } from '../../../common/utils/numeric';
import { Customer } from '../../masters/entities/customer.entity';

/**
 * Operación/cuenta del cliente (venta o encargo). Mantiene SEPARADOS el saldo en
 * dinero (valor − abonos monetarios) y el saldo en material (compromiso − aportes)
 * (RF-045, RN-016).
 */
@Entity('customer_operation')
export class CustomerOperation extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 30 })
  number!: string;

  @ManyToOne(() => Customer, { nullable: false, eager: true })
  customer!: Customer;

  @Index()
  @Column()
  customerId!: string;

  @Column({ type: 'enum', enum: OperationType, default: OperationType.SALE })
  type!: OperationType;

  @Column({
    type: 'enum',
    enum: OperationStatus,
    default: OperationStatus.OPEN,
  })
  status!: OperationStatus;

  @Column({ type: 'varchar', length: 200 })
  description!: string;

  /** Valor total pactado de la operación (dinero). */
  @Column({ ...moneyColumn, default: 0 })
  totalValue!: number;

  /** Gramos finos de material que el cliente se compromete a aportar (opcional). */
  @Column({ ...gramsColumn, default: 0 })
  committedMaterialFineGrams!: number;

  /** Orden de producción ligada (encargo con fabricación). */
  @Column({ type: 'uuid', nullable: true })
  productionOrderId!: string | null;

  @Column({ type: 'date', nullable: true })
  dueDate!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column()
  createdById!: string;
}

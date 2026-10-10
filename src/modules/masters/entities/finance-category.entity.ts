import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { TransactionType } from '../../../common/enums/domain.enums';

/** Conceptos/categorías de ingresos y egresos. */
@Entity('finance_category')
export class FinanceCategory extends BaseEntity {
  @Column({ type: 'varchar', length: 30, unique: true })
  code!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'enum', enum: TransactionType })
  type!: TransactionType;

  /** Gasto operativo: entra a la utilidad neta en rentabilidad. */
  @Column({ default: false })
  isOperatingExpense!: boolean;

  @Column({ default: false })
  isSystem!: boolean;

  @Column({ default: true })
  active!: boolean;
}

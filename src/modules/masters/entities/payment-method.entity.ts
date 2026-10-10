import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

/** Medios de pago definidos (efectivo, transferencia, tarjeta...). */
@Entity('payment_method')
export class PaymentMethod extends BaseEntity {
  @Column({ type: 'varchar', length: 20, unique: true })
  code!: string;

  @Column({ type: 'varchar', length: 80 })
  name!: string;

  @Column({ default: true })
  active!: boolean;
}

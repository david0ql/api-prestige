import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { ReceiptType } from '../../../common/enums/domain.enums';
import { ReceiptLine } from './receipt-line.entity';

/**
 * Recepción en Oficina Madre (RF-019/020, P11): pesaje de retorno separado en
 * producto terminado, sobrante, no utilizado y devolución. Parcial o final.
 */
@Entity('production_receipt')
export class ProductionReceipt extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 30 })
  number!: string;

  @Index()
  @Column()
  orderId!: string;

  @Column()
  workshopId!: string;

  @Column({ type: 'enum', enum: ReceiptType })
  type!: ReceiptType;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  /** Comparación contra lo declarado por el taller (snapshot). */
  @Column({ type: 'jsonb', nullable: true })
  comparison!: Record<string, unknown> | null;

  @Column()
  receivedById!: string;

  @OneToMany(() => ReceiptLine, (l) => l.receipt, {
    cascade: ['insert'],
    eager: true,
  })
  lines!: ReceiptLine[];
}

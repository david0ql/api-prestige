import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { moneyColumn } from '../../../common/utils/numeric';
import { SaleDispatchLine } from './sale-dispatch-line.entity';

/**
 * Despacho/venta al cliente (RF-025). Solo se confirma si cada pieza tiene
 * calidad aprobada y ley validada cuando aplica (RN-022, CA-014).
 */
@Entity('sale_dispatch')
export class SaleDispatch extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 30 })
  number!: string;

  @Index()
  @Column()
  operationId!: string;

  @Index()
  @Column()
  customerId!: string;

  @Column({ type: 'date' })
  dispatchDate!: string;

  @Column(moneyColumn)
  totalValue!: number;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column()
  responsibleId!: string;

  @Column({ default: false })
  reversed!: boolean;

  @OneToMany(() => SaleDispatchLine, (l) => l.dispatch, {
    cascade: ['insert'],
    eager: true,
  })
  lines!: SaleDispatchLine[];
}

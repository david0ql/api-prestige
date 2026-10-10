import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { gramsColumn, moneyColumn } from '../../../common/utils/numeric';
import { FinishedGood } from '../../production/entities/finished-good.entity';
import { SaleDispatch } from './sale-dispatch.entity';

@Entity('sale_dispatch_line')
export class SaleDispatchLine {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => SaleDispatch, (d) => d.lines, { nullable: false, onDelete: 'CASCADE' })
  dispatch!: SaleDispatch;

  @Column()
  dispatchId!: string;

  @ManyToOne(() => FinishedGood, { nullable: false, eager: true })
  finishedGood!: FinishedGood;

  @Column()
  finishedGoodId!: string;

  @Column({ type: 'int', default: 0 })
  units!: number;

  @Column(gramsColumn)
  grams!: number;

  @Column(moneyColumn)
  value!: number;

  /** Costo de lo vendido (para rentabilidad por producto/taller/cliente). */
  @Column({ ...moneyColumn, default: 0 })
  cost!: number;

  @Column({ type: 'uuid', nullable: true })
  weighingId!: string | null;
}

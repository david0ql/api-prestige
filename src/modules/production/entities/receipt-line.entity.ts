import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ReceiptLineType } from '../../../common/enums/domain.enums';
import { gramsColumn } from '../../../common/utils/numeric';
import { Material } from '../../masters/entities/material.entity';
import { Weighing } from '../../scale/entities/weighing.entity';
import { ProductionReceipt } from './production-receipt.entity';

@Entity('receipt_line')
export class ReceiptLine {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => ProductionReceipt, (r) => r.lines, { nullable: false, onDelete: 'CASCADE' })
  receipt!: ProductionReceipt;

  @Column()
  receiptId!: string;

  @Column({ type: 'enum', enum: ReceiptLineType })
  lineType!: ReceiptLineType;

  /** Material (sobrante/no utilizado/devolución). Nulo para producto terminado. */
  @ManyToOne(() => Material, { nullable: true, eager: true })
  material!: Material | null;

  @Column({ type: 'uuid', nullable: true })
  materialId!: string | null;

  @Column({ type: 'int', nullable: true })
  units!: number | null;

  @Column(gramsColumn)
  grams!: number;

  @ManyToOne(() => Weighing, { nullable: true, eager: true })
  weighing!: Weighing | null;

  @Column({ type: 'uuid', nullable: true })
  weighingId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  movementId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  finishedGoodId!: string | null;
}

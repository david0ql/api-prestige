import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { CostType } from '../../../common/enums/domain.enums';
import { gramsColumn, moneyColumn } from '../../../common/utils/numeric';

/**
 * Costo de producción contabilizado (RF-024/029). Solo se crea al aprobar la orden
 * o la mano de obra: los costos de taller no impactan finanzas antes.
 */
@Entity('cost_entry')
@Index(['periodDate', 'type'])
export class CostEntry {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: CostType })
  type!: CostType;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  orderId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  productId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  workshopId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  materialId!: string | null;

  @Column({ ...gramsColumn, nullable: true })
  grams!: number | null;

  @Column(moneyColumn)
  amount!: number;

  @Column({ type: 'varchar', length: 200 })
  description!: string;

  @Column({ type: 'date' })
  periodDate!: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  sourceType!: string | null;

  @Column({ type: 'uuid', nullable: true })
  sourceId!: string | null;

  @Column()
  approvedById!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}

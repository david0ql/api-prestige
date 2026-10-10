import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { RequestStatus } from '../../../common/enums/domain.enums';
import { gramsColumn, numeric } from '../../../common/utils/numeric';
import { Material } from '../../masters/entities/material.entity';
import { ProductionOrder } from './production-order.entity';

/** Solicitud de material adicional del taller (RF-015) validada contra estándar (RF-016). */
@Entity('material_request')
export class MaterialRequest extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 30 })
  number!: string;

  @ManyToOne(() => ProductionOrder, { nullable: true, eager: true })
  order!: ProductionOrder | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  orderId!: string | null;

  @Index()
  @Column()
  workshopId!: string;

  @ManyToOne(() => Material, { nullable: false, eager: true })
  material!: Material;

  @Column()
  materialId!: string;

  @Column(gramsColumn)
  grams!: number;

  @Column({ type: 'text' })
  reason!: string;

  @Column({ type: 'enum', enum: RequestStatus, default: RequestStatus.PENDING })
  status!: RequestStatus;

  /** Esperado según estándar, ya entregado y desviación resultante. */
  @Column({ ...gramsColumn, nullable: true })
  expectedGrams!: number | null;

  @Column({ ...gramsColumn, nullable: true })
  alreadyDeliveredGrams!: number | null;

  @Column({ type: 'numeric', precision: 9, scale: 3, nullable: true, transformer: numeric })
  deviationPct!: number | null;

  @Column({ default: false })
  exceedsStandard!: boolean;

  @Column()
  requestedById!: string;

  @Column({ type: 'uuid', nullable: true })
  reviewedById!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  reviewedAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  reviewNotes!: string | null;

  @Column({ type: 'uuid', nullable: true })
  dispatchId!: string | null;
}

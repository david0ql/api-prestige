import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { ApprovalStatus, LaborBasis } from '../../../common/enums/domain.enums';
import { moneyColumn, numeric } from '../../../common/utils/numeric';

/**
 * Mano de obra (RF-018, RN-012): el taller PROPONE; solo Prestige Gold aprueba y
 * solo entonces impacta costos/contabilidad (RF-024).
 */
@Entity('labor_cost')
export class LaborCost extends BaseEntity {
  @Index()
  @Column()
  orderId!: string;

  @Index()
  @Column()
  workshopId!: string;

  @Column({ type: 'enum', enum: LaborBasis })
  basis!: LaborBasis;

  @Column(moneyColumn)
  rate!: number;

  @Column({ type: 'numeric', precision: 14, scale: 4, transformer: numeric })
  quantity!: number;

  @Column(moneyColumn)
  proposedValue!: number;

  @Column({ ...moneyColumn, nullable: true })
  approvedValue!: number | null;

  @Column({ type: 'enum', enum: ApprovalStatus, default: ApprovalStatus.PROPOSED })
  status!: ApprovalStatus;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column()
  proposedById!: string;

  @Column({ type: 'uuid', nullable: true })
  reviewedById!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  reviewedAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  reviewNotes!: string | null;
}

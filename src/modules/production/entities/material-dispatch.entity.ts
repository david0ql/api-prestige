import { Column, Entity, Index, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { DispatchStatus } from '../../../common/enums/domain.enums';
import { Workshop } from '../../masters/entities/workshop.entity';
import { User } from '../../users/entities/user.entity';
import { ProductionOrder } from './production-order.entity';
import { DispatchLine } from './dispatch-line.entity';
import { DigitalAcceptance } from './digital-acceptance.entity';

/**
 * Entrega/custodia a taller (RF-010, RN-005). Al despachar el material pasa a
 * TRÁNSITO; cuando el taller acepta (RF-011) pasa a su custodia (RN-004).
 */
@Entity('material_dispatch')
export class MaterialDispatch extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 30 })
  number!: string;

  @ManyToOne(() => ProductionOrder, { nullable: true, eager: true })
  order!: ProductionOrder | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  orderId!: string | null;

  @ManyToOne(() => Workshop, { nullable: false, eager: true })
  workshop!: Workshop;

  @Index()
  @Column()
  workshopId!: string;

  /** Motivo/propósito (obligatorio, RN-005). */
  @Column({ type: 'text' })
  purpose!: string;

  @Column({ type: 'enum', enum: DispatchStatus, default: DispatchStatus.PENDING_ACCEPTANCE })
  status!: DispatchStatus;

  @Column({ type: 'uuid', nullable: true })
  materialRequestId!: string | null;

  @ManyToOne(() => User, { nullable: false })
  responsible!: User;

  @Column()
  responsibleId!: string;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  respondedAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  workshopObservations!: string | null;

  @ManyToOne(() => DigitalAcceptance, { nullable: true, eager: true })
  acceptance!: DigitalAcceptance | null;

  @Column({ type: 'uuid', nullable: true })
  acceptanceId!: string | null;

  @OneToMany(() => DispatchLine, (l) => l.dispatch, { cascade: ['insert'], eager: true })
  lines!: DispatchLine[];
}

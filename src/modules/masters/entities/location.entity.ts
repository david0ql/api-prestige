import { Column, Entity, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { LocationType, RecordStatus } from '../../../common/enums/domain.enums';
import { Workshop } from './workshop.entity';
import { Customer } from './customer.entity';

/** Toda existencia pertenece a una ubicación lógica (sección 5). */
@Entity('location')
export class Location extends BaseEntity {
  @Column({ type: 'varchar', length: 30, unique: true })
  code!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'enum', enum: LocationType })
  type!: LocationType;

  @ManyToOne(() => Workshop, { nullable: true, eager: true })
  workshop!: Workshop | null;

  @Column({ type: 'uuid', nullable: true, unique: true })
  workshopId!: string | null;

  @ManyToOne(() => Customer, { nullable: true })
  customer!: Customer | null;

  @Column({ type: 'uuid', nullable: true })
  customerId!: string | null;

  @Column({ type: 'enum', enum: RecordStatus, default: RecordStatus.ACTIVE })
  status!: RecordStatus;
}

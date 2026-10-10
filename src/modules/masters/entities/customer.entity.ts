import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { RecordStatus } from '../../../common/enums/domain.enums';

/** Clientes (sección 5). Los saldos se calculan desde abonos/aportes/ventas. */
@Entity('customer')
@Index(['documentType', 'documentNumber'], { unique: true })
export class Customer extends BaseEntity {
  @Column({ type: 'varchar', length: 10, default: 'CC' })
  documentType!: string;

  @Column({ type: 'varchar', length: 30 })
  documentNumber!: string;

  @Column({ type: 'varchar', length: 160 })
  name!: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  email!: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  address!: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  city!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'enum', enum: RecordStatus, default: RecordStatus.ACTIVE })
  status!: RecordStatus;
}

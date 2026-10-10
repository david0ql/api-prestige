import { Column, Entity, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { RecordStatus } from '../../../common/enums/domain.enums';
import { ProductWorkshop } from './product-workshop.entity';

/** Talleres/proveedores (4.2). Códigos configurables, nunca "quemados". */
@Entity('workshop')
export class Workshop extends BaseEntity {
  @Column({ type: 'varchar', length: 20, unique: true })
  code!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  responsible!: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  email!: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  address!: string | null;

  /** Producción principal (texto descriptivo). */
  @Column({ type: 'text', nullable: true })
  mainProduction!: string | null;

  /** Condiciones comerciales/operativas pactadas. */
  @Column({ type: 'text', nullable: true })
  conditions!: string | null;

  @Column({ type: 'enum', enum: RecordStatus, default: RecordStatus.ACTIVE })
  status!: RecordStatus;

  @OneToMany(() => ProductWorkshop, (pw) => pw.workshop)
  products!: ProductWorkshop[];
}

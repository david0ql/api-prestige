import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { RecordStatus } from '../../../common/enums/domain.enums';

/** Categoría de material: metal precioso, aleación/liga, soldadura, piedra, intermedio... */
@Entity('material_category')
export class MaterialCategory extends BaseEntity {
  @Column({ type: 'varchar', length: 30, unique: true })
  code!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  /** Si es metal precioso, su peso entra al balance metalúrgico y a la merma. */
  @Column({ default: false })
  isPreciousMetal!: boolean;

  @Column({ type: 'enum', enum: RecordStatus, default: RecordStatus.ACTIVE })
  status!: RecordStatus;
}

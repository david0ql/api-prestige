import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { RecordStatus, UnitKind } from '../../../common/enums/domain.enums';
import { numeric } from '../../../common/utils/numeric';

/** Unidades (RN-002): el gramo es la base; las auxiliares declaran su factor. */
@Entity('unit')
export class Unit extends BaseEntity {
  @Column({ type: 'varchar', length: 12, unique: true })
  code!: string;

  @Column({ type: 'varchar', length: 60 })
  name!: string;

  @Column({ type: 'enum', enum: UnitKind, default: UnitKind.MASS })
  kind!: UnitKind;

  /** Para unidades de masa: cuántos gramos equivale 1 unidad (kg=1000, ozt=31.1035). */
  @Column({ type: 'numeric', precision: 16, scale: 6, default: 1, transformer: numeric })
  factorToGram!: number;

  @Column({ default: false })
  isBase!: boolean;

  @Column({ type: 'enum', enum: RecordStatus, default: RecordStatus.ACTIVE })
  status!: RecordStatus;
}

import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

/** Parámetros generales editables desde Administración (P18). */
@Entity('system_parameter')
export class SystemParameter extends BaseEntity {
  @Column({ type: 'varchar', length: 60, unique: true })
  key!: string;

  @Column({ type: 'jsonb' })
  value!: unknown;

  @Column({ type: 'varchar', length: 200 })
  description!: string;

  @Column({ type: 'varchar', length: 40, default: 'general' })
  groupName!: string;
}

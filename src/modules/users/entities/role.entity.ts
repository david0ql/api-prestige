import { Column, Entity, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { User } from './user.entity';

/** Rol configurable: agrupa permisos. Los roles de sistema no se pueden eliminar. */
@Entity('role')
export class Role extends BaseEntity {
  @Column({ type: 'varchar', length: 40, unique: true })
  code!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'text', array: true, default: '{}' })
  permissions!: string[];

  @Column({ default: false })
  isSystem!: boolean;

  /** Un rol de taller obliga a que el usuario tenga taller asociado (aislamiento). */
  @Column({ default: false })
  isWorkshopRole!: boolean;

  @Column({ default: true })
  active!: boolean;

  @OneToMany(() => User, (u) => u.role)
  users!: User[];
}

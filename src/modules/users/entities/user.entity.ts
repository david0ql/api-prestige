import { BeforeInsert, BeforeUpdate, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { Exclude } from 'class-transformer';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Role } from './role.entity';
import { Workshop } from '../../masters/entities/workshop.entity';

@Entity('app_user')
export class User extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 60 })
  username!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 160 })
  email!: string;

  @Column({ type: 'varchar', length: 160 })
  fullName!: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  phone!: string | null;

  @Exclude()
  @Column({ type: 'varchar', length: 255, select: false })
  passwordHash!: string;

  @ManyToOne(() => Role, (r) => r.users, { nullable: false, eager: true })
  @JoinColumn()
  role!: Role;

  @Column()
  roleId!: string;

  /** Taller asociado (solo usuarios de taller). Aísla toda su información. */
  @ManyToOne(() => Workshop, { nullable: true, eager: true })
  @JoinColumn()
  workshop!: Workshop | null;

  @Column({ type: 'uuid', nullable: true })
  workshopId!: string | null;

  @Column({ default: true })
  active!: boolean;

  @Column({ type: 'int', default: 0 })
  failedLoginAttempts!: number;

  @Column({ type: 'timestamptz', nullable: true })
  lockedUntil!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  passwordChangedAt!: Date | null;

  @Column({ default: false })
  mustChangePassword!: boolean;

  /** Usuario y correo se normalizan a minúsculas para login sin ambigüedad. */
  @BeforeInsert()
  @BeforeUpdate()
  normalize(): void {
    if (this.username) this.username = this.username.trim().toLowerCase();
    if (this.email) this.email = this.email.trim().toLowerCase();
  }
}

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

/**
 * Sesión de refresco con rotación. Solo se guarda el hash SHA-256 del token.
 * `family` agrupa la cadena de rotaciones: si se reusa un token ya rotado se
 * revoca toda la familia (detección de robo de token).
 */
@Entity('refresh_token')
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  user!: User;

  @Column()
  userId!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  tokenHash!: string;

  @Index()
  @Column({ type: 'uuid' })
  family!: string;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  rotatedAt!: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  userAgent!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}

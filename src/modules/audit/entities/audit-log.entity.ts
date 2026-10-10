import { Column, Entity, Index } from 'typeorm';
import { ImmutableEntity } from '../../../common/entities/base.entity';
import { AuditAction } from '../../../common/enums/domain.enums';

/**
 * Bitácora inmutable (RF-036, RNF-003): quién, cuándo, qué, desde dónde y el
 * antes/después del registro. No existe endpoint de edición ni borrado.
 */
@Entity('audit_log')
@Index(['entityType', 'entityId'])
export class AuditLog extends ImmutableEntity {
  @Column({ type: 'enum', enum: AuditAction })
  action!: AuditAction;

  @Index()
  @Column({ type: 'varchar', length: 80 })
  entityType!: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  entityId!: string | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  userId!: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  username!: string | null;

  @Column({ type: 'uuid', nullable: true })
  workshopId!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  before!: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  after!: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  userAgent!: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  path!: string | null;
}

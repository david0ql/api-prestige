import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { AlertSeverity, AlertStatus, AlertType } from '../../../common/enums/domain.enums';

/**
 * Alerta operativa (RF-039, P17). `dedupKey` evita duplicar la misma alerta
 * abierta (p. ej. mínimo de inventario de un material).
 */
@Entity('alert')
export class Alert extends BaseEntity {
  @Column({ type: 'enum', enum: AlertType })
  type!: AlertType;

  @Column({ type: 'enum', enum: AlertSeverity, default: AlertSeverity.WARNING })
  severity!: AlertSeverity;

  @Index()
  @Column({ type: 'enum', enum: AlertStatus, default: AlertStatus.OPEN })
  status!: AlertStatus;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'text' })
  message!: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  entityType!: string | null;

  @Column({ type: 'uuid', nullable: true })
  entityId!: string | null;

  /** Taller relacionado: los talleres solo ven sus propias alertas. */
  @Index()
  @Column({ type: 'uuid', nullable: true })
  workshopId!: string | null;

  @Index()
  @Column({ type: 'varchar', length: 160, nullable: true })
  dedupKey!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  data!: Record<string, unknown> | null;

  @Column({ type: 'uuid', nullable: true })
  resolvedById!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  resolutionNotes!: string | null;
}

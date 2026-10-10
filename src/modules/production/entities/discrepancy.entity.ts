import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { DiscrepancyStatus, DiscrepancyType } from '../../../common/enums/domain.enums';
import { gramsColumn, numeric } from '../../../common/utils/numeric';
import { Material } from '../../masters/entities/material.entity';

/**
 * Merma/diferencia (RF-022, RN-010): tipo, cantidad, motivo, responsable y
 * aprobación. Las que están dentro de tolerancia se registran igual (con
 * aprobación automática marcada) para no perder trazabilidad.
 */
@Entity('discrepancy')
export class Discrepancy extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 30 })
  number!: string;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  orderId!: string | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  workshopId!: string | null;

  @Column({ type: 'enum', enum: DiscrepancyType })
  type!: DiscrepancyType;

  @ManyToOne(() => Material, { nullable: true, eager: true })
  material!: Material | null;

  @Column({ type: 'uuid', nullable: true })
  materialId!: string | null;

  /** Positivo = faltante/pérdida; negativo = sobrante. */
  @Column(gramsColumn)
  grams!: number;

  /** Porcentaje sobre la base de referencia (entregado o consumido). */
  @Column({ type: 'numeric', precision: 9, scale: 3, nullable: true, transformer: numeric })
  percent!: number | null;

  @Column({ type: 'numeric', precision: 6, scale: 3, nullable: true, transformer: numeric })
  tolerancePct!: number | null;

  @Column({ default: false })
  withinTolerance!: boolean;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  @Column({ type: 'text', nullable: true })
  justification!: string | null;

  /** Responsable de la diferencia (taller o persona). */
  @Column({ type: 'varchar', length: 160, nullable: true })
  responsibleParty!: string | null;

  @Column({ type: 'enum', enum: DiscrepancyStatus, default: DiscrepancyStatus.PENDING })
  status!: DiscrepancyStatus;

  @Column({ type: 'varchar', length: 40, nullable: true })
  sourceType!: string | null;

  @Column({ type: 'uuid', nullable: true })
  sourceId!: string | null;

  @Column()
  registeredById!: string;

  @Column({ type: 'uuid', nullable: true })
  approvedById!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  approvedAt!: Date | null;

  @Column({ default: false })
  autoApproved!: boolean;

  @Column({ type: 'text', nullable: true })
  reviewNotes!: string | null;

  /** Movimiento de kardex generado al contabilizar la diferencia aprobada. */
  @Column({ type: 'uuid', nullable: true })
  movementId!: string | null;
}

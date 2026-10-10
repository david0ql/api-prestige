import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { WeighingPurpose, WeighingSource } from '../../../common/enums/domain.enums';
import { gramsColumn } from '../../../common/utils/numeric';
import { User } from '../../users/entities/user.entity';
import { Material } from '../../masters/entities/material.entity';

/**
 * Pesaje en Balanza Madre (RF-002/003, RN-019). Inmutable: el peso capturado no se
 * edita; cualquier corrección es un WeighingAdjustment auditado. `currentNet`
 * refleja el último valor vigente tras ajustes.
 */
@Entity('weighing')
export class Weighing {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 30 })
  number!: string;

  @Column({ type: 'enum', enum: WeighingPurpose })
  purpose!: WeighingPurpose;

  @Column({ type: 'enum', enum: WeighingSource })
  source!: WeighingSource;

  @ManyToOne(() => Material, { nullable: true })
  material!: Material | null;

  @Column({ type: 'uuid', nullable: true })
  materialId!: string | null;

  @Column(gramsColumn)
  grossGrams!: number;

  @Column({ ...gramsColumn, default: 0 })
  tareGrams!: number;

  /** Peso neto capturado originalmente (nunca cambia). */
  @Column(gramsColumn)
  netGrams!: number;

  /** Peso neto vigente (tras ajustes autorizados). */
  @Column(gramsColumn)
  currentNetGrams!: number;

  /** Lectura cruda enviada por la balanza (trama serial) para trazabilidad. */
  @Column({ type: 'text', nullable: true })
  rawReading!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  deviceInfo!: string | null;

  @Column({ default: true })
  stable!: boolean;

  /** Obligatorio cuando source = MANUAL (RF-003). */
  @Column({ type: 'text', nullable: true })
  manualReason!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  /** Documento que consumió el pesaje (entrada, despacho, recepción...). */
  @Column({ type: 'varchar', length: 40, nullable: true })
  usedByType!: string | null;

  @Column({ type: 'uuid', nullable: true })
  usedById!: string | null;

  @ManyToOne(() => User, { nullable: false })
  capturedBy!: User;

  @Column()
  capturedById!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  capturedAt!: Date;
}

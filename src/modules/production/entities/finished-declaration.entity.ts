import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { gramsColumn, numeric } from '../../../common/utils/numeric';

/**
 * Declaración de producto terminado del taller (RF-017, P10): unidades, gramos,
 * variables técnicas, sobrantes declarados y evidencias finales.
 */
@Entity('finished_declaration')
export class FinishedDeclaration {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column()
  orderId!: string;

  @Column()
  workshopId!: string;

  @Column({ type: 'int', nullable: true })
  units!: number | null;

  @Column(gramsColumn)
  grams!: number;

  /** Valores de variables técnicas del modelo (alimentan la ficha técnica). */
  @Column({ type: 'jsonb', default: {} })
  technicalValues!: Record<string, string | number | boolean>;

  @Column({ type: 'numeric', precision: 10, scale: 3, nullable: true, transformer: numeric })
  diameterMm!: number | null;

  @Column({ type: 'numeric', precision: 10, scale: 3, nullable: true, transformer: numeric })
  lengthMm!: number | null;

  @Column({ type: 'text', nullable: true })
  measures!: string | null;

  /** Sobrantes/devoluciones que el taller declara que enviará: [{materialId, grams, type}]. */
  @Column({ type: 'jsonb', default: [] })
  declaredLeftovers!: { materialId: string; grams: number; type: string }[];

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  /** false cuando una devolución a ajuste la deja sin efecto. */
  @Column({ default: true })
  current!: boolean;

  @Column()
  declaredById!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}

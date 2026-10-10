import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { gramsColumn, numeric } from '../../../common/utils/numeric';
import { ProductionStage } from '../../masters/entities/production-stage.entity';

/** Avance parcial reportado por el taller (RF-013), con evidencias por etapa. */
@Entity('progress_report')
export class ProgressReport {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column()
  orderId!: string;

  @Column()
  workshopId!: string;

  @ManyToOne(() => ProductionStage, { nullable: true, eager: true })
  stage!: ProductionStage | null;

  @Column({ type: 'uuid', nullable: true })
  stageId!: string | null;

  @Column({ ...gramsColumn, nullable: true })
  grams!: number | null;

  @Column({ type: 'int', nullable: true })
  units!: number | null;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true, transformer: numeric })
  percent!: number | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  /** Marca la etapa como completada (exige evidencia obligatoria). */
  @Column({ default: false })
  completesStage!: boolean;

  @Column()
  reportedById!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}

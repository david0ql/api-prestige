import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ProductionStage } from '../../masters/entities/production-stage.entity';

/** Etapa completada de una orden: solo se crea si la evidencia exigida existe. */
@Entity('stage_completion')
@Index(['orderId', 'stageId'], { unique: true })
export class StageCompletion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  orderId!: string;

  @ManyToOne(() => ProductionStage, { nullable: false, eager: true })
  stage!: ProductionStage;

  @Column()
  stageId!: string;

  @Column({ type: 'int', default: 0 })
  photoCount!: number;

  @Column({ type: 'int', default: 0 })
  videoCount!: number;

  @Column()
  completedById!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  completedAt!: Date;
}

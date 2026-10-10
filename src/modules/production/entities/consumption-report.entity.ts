import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { gramsColumn } from '../../../common/utils/numeric';
import { Material } from '../../masters/entities/material.entity';

/**
 * Consumo reportado por el taller (RF-012). Es una declaración: el movimiento de
 * consumo en el kardex se contabiliza al aprobar la orden (RN-009/012).
 */
@Entity('consumption_report')
export class ConsumptionReport {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column()
  orderId!: string;

  @Column()
  workshopId!: string;

  @ManyToOne(() => Material, { nullable: false, eager: true })
  material!: Material;

  @Column()
  materialId!: string;

  @Column(gramsColumn)
  grams!: number;

  @Column({ type: 'uuid', nullable: true })
  stageId!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  /** Anulado por el propio taller antes del cierre (con motivo). */
  @Column({ default: false })
  voided!: boolean;

  @Column({ type: 'text', nullable: true })
  voidReason!: string | null;

  @Column()
  reportedById!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}

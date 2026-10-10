import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { gramsColumn } from '../../../common/utils/numeric';
import { Material } from '../../masters/entities/material.entity';
import { MaterialLot } from '../../inventory/entities/material-lot.entity';
import { Weighing } from '../../scale/entities/weighing.entity';
import { MaterialDispatch } from './material-dispatch.entity';

@Entity('dispatch_line')
export class DispatchLine {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => MaterialDispatch, (d) => d.lines, { nullable: false, onDelete: 'CASCADE' })
  dispatch!: MaterialDispatch;

  @Column()
  dispatchId!: string;

  @ManyToOne(() => Material, { nullable: false, eager: true })
  material!: Material;

  @Column()
  materialId!: string;

  @ManyToOne(() => MaterialLot, { nullable: true, eager: true })
  lot!: MaterialLot | null;

  @Column({ type: 'uuid', nullable: true })
  lotId!: string | null;

  /** Peso despachado según Balanza Madre. */
  @Column(gramsColumn)
  grams!: number;

  @ManyToOne(() => Weighing, { nullable: true, eager: true })
  weighing!: Weighing | null;

  @Column({ type: 'uuid', nullable: true })
  weighingId!: string | null;

  /** Peso que el taller declara haber recibido al confirmar (RF-011). */
  @Column({ ...gramsColumn, nullable: true })
  receivedGrams!: number | null;

  @Column({ default: false })
  overrideApplied!: boolean;

  @Column({ type: 'uuid', nullable: true })
  movementId!: string | null;
}

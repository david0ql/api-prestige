import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { purityColumn } from '../../../common/utils/numeric';
import { Material } from '../../masters/entities/material.entity';
import { Customer } from '../../masters/entities/customer.entity';

/** Lote de material (cuando aplica): origen, pureza y, si viene de cliente, su dueño. */
@Entity('material_lot')
export class MaterialLot {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 40 })
  code!: string;

  @ManyToOne(() => Material, { nullable: false, eager: true })
  material!: Material;

  @Column()
  materialId!: string;

  @Column({ ...purityColumn, nullable: true })
  purity!: number | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  origin!: string | null;

  @ManyToOne(() => Customer, { nullable: true })
  customer!: Customer | null;

  @Column({ type: 'uuid', nullable: true })
  customerId!: string | null;

  /** Orden de producción que originó el lote (producto intermedio). */
  @Column({ type: 'uuid', nullable: true })
  productionOrderId!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}

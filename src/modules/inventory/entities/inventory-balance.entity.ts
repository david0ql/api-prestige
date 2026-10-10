import { Column, Entity, Index, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn, VersionColumn } from 'typeorm';
import { gramsColumn } from '../../../common/utils/numeric';
import { Material } from '../../masters/entities/material.entity';
import { Location } from '../../masters/entities/location.entity';
import { MaterialLot } from '../../inventory/entities/material-lot.entity';

/**
 * Saldo materializado por ubicación + material + lote. Se actualiza en la misma
 * transacción que el movimiento, con bloqueo pesimista, para validar RN-003 sin
 * condiciones de carrera y responder rápido (RNF-007). El kardex sigue siendo la
 * fuente de verdad y el saldo puede recalcularse desde él.
 */
@Entity('inventory_balance')
@Index(['locationId', 'materialId', 'lotKey'], { unique: true })
export class InventoryBalance {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Location, { nullable: false, eager: true })
  location!: Location;

  @Column()
  locationId!: string;

  @ManyToOne(() => Material, { nullable: false, eager: true })
  material!: Material;

  @Column()
  materialId!: string;

  @ManyToOne(() => MaterialLot, { nullable: true, eager: true })
  lot!: MaterialLot | null;

  @Column({ type: 'uuid', nullable: true })
  lotId!: string | null;

  /** lotId o 'NONE' (los índices únicos no consideran NULL iguales). */
  @Column({ type: 'varchar', length: 40, default: 'NONE' })
  lotKey!: string;

  @Column({ ...gramsColumn, default: 0 })
  grams!: number;

  @Column({ type: 'timestamptz', nullable: true })
  lastMovementAt!: Date | null;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @VersionColumn({ default: 1 })
  version!: number;
}

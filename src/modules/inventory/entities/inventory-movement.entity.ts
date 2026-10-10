import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { MovementStatus, MovementType } from '../../../common/enums/domain.enums';
import { gramsColumn, moneyColumn, purityColumn } from '../../../common/utils/numeric';
import { Material } from '../../masters/entities/material.entity';
import { Location } from '../../masters/entities/location.entity';
import { User } from '../../users/entities/user.entity';
import { MaterialLot } from './material-lot.entity';
import { Weighing } from '../../scale/entities/weighing.entity';

/**
 * Kardex inmutable de material (RN-001, RN-015, RNF-003/005). Todo movimiento físico
 * tiene aquí su equivalente: origen, destino, gramos, responsable y referencia.
 * Nunca se edita ni borra: se reversa con un movimiento REVERSAL.
 */
@Entity('inventory_movement')
@Index(['materialId', 'createdAt'])
export class InventoryMovement {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 30 })
  number!: string;

  @Column({ type: 'enum', enum: MovementType })
  type!: MovementType;

  @Column({ type: 'enum', enum: MovementStatus, default: MovementStatus.CONFIRMED })
  status!: MovementStatus;

  @ManyToOne(() => Material, { nullable: false, eager: true })
  material!: Material;

  @Column()
  materialId!: string;

  @ManyToOne(() => MaterialLot, { nullable: true, eager: true })
  lot!: MaterialLot | null;

  @Column({ type: 'uuid', nullable: true })
  lotId!: string | null;

  /** Siempre positivo; el sentido lo dan origen y destino. */
  @Column(gramsColumn)
  grams!: number;

  @Column({ ...purityColumn, nullable: true })
  purity!: number | null;

  @ManyToOne(() => Location, { nullable: true, eager: true })
  fromLocation!: Location | null;

  @Column({ type: 'uuid', nullable: true })
  fromLocationId!: string | null;

  @ManyToOne(() => Location, { nullable: true, eager: true })
  toLocation!: Location | null;

  @Column({ type: 'uuid', nullable: true })
  toLocationId!: string | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  productionOrderId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  customerId!: string | null;

  @ManyToOne(() => Weighing, { nullable: true })
  weighing!: Weighing | null;

  @Column({ type: 'uuid', nullable: true })
  weighingId!: string | null;

  /** Documento origen (DISPATCH, RECEIPT, ORDER_APPROVAL, ENTRY...). */
  @Column({ type: 'varchar', length: 40, nullable: true })
  sourceType!: string | null;

  @Column({ type: 'uuid', nullable: true })
  sourceId!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  reference!: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  origin!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  /** Costo unitario por gramo al momento del movimiento (valorización). */
  @Column({ ...moneyColumn, nullable: true })
  unitCost!: number | null;

  /** Si se despachó por encima de lo disponible con autorización excepcional (RN-003). */
  @Column({ default: false })
  overrideApplied!: boolean;

  @Column({ type: 'text', nullable: true })
  overrideReason!: string | null;

  @Column({ type: 'uuid', nullable: true })
  reversalOfId!: string | null;

  @ManyToOne(() => User, { nullable: false })
  responsible!: User;

  @Column()
  responsibleId!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}

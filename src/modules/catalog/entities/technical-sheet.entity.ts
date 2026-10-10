import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import {
  gramsColumn,
  numeric,
  purityColumn,
} from '../../../common/utils/numeric';
import { Product } from '../../masters/entities/product.entity';
import { User } from '../../users/entities/user.entity';

/**
 * Ficha técnica versionada por modelo (RF-042, RN-023). Cada cambio crea una
 * versión nueva e inmutable; las órdenes guardan la versión con la que se crearon,
 * así un cambio posterior nunca sobrescribe el histórico de órdenes cerradas.
 */
@Entity('technical_sheet')
@Index(['productId', 'versionNumber'], { unique: true })
export class TechnicalSheet {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Product, { nullable: false })
  product!: Product;

  @Column()
  productId!: string;

  @Column({ type: 'int' })
  versionNumber!: number;

  /** Peso estándar por unidad (g). */
  @Column({ ...gramsColumn, nullable: true })
  standardWeight!: number | null;

  @Column({ ...gramsColumn, nullable: true })
  weightTolerance!: number | null;

  /** Diámetro (mm). */
  @Column({
    type: 'numeric',
    precision: 10,
    scale: 3,
    nullable: true,
    transformer: numeric,
  })
  diameterMm!: number | null;

  /** Largo (mm/cm según medida). */
  @Column({
    type: 'numeric',
    precision: 10,
    scale: 3,
    nullable: true,
    transformer: numeric,
  })
  lengthMm!: number | null;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 3,
    nullable: true,
    transformer: numeric,
  })
  widthMm!: number | null;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 3,
    nullable: true,
    transformer: numeric,
  })
  thicknessMm!: number | null;

  /** Medidas adicionales en texto libre (talla, calibre...). */
  @Column({ type: 'text', nullable: true })
  measures!: string | null;

  @Column({ ...purityColumn, nullable: true })
  targetPurity!: number | null;

  @Column({ ...purityColumn, nullable: true })
  purityTolerance!: number | null;

  /** Valores de variables técnicas configurables: { CALIBRE: 1.2, CIERRE: 'Mosquetón' }. */
  @Column({ type: 'jsonb', default: {} })
  variables!: Record<string, string | number | boolean>;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'text', nullable: true })
  changeReason!: string | null;

  /** Orden de producción que originó esta versión (alimentación desde producción, CA-005). */
  @Column({ type: 'uuid', nullable: true })
  sourceOrderId!: string | null;

  @ManyToOne(() => User, { nullable: true })
  createdBy!: User | null;

  @Column({ type: 'uuid', nullable: true })
  createdById!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}

import { Column, Entity, JoinTable, ManyToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { ProductFamily } from './product-family.entity';

/**
 * Etapas de fabricación con evidencia obligatoria configurable (RN-013).
 * Sin familias asociadas = aplica a todos los productos.
 */
@Entity('production_stage')
export class ProductionStage extends BaseEntity {
  @Column({ type: 'varchar', length: 30, unique: true })
  code!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'int' })
  sequence!: number;

  /** La etapa debe completarse antes de declarar el producto terminado. */
  @Column({ default: true })
  mandatory!: boolean;

  @Column({ default: true })
  requiresPhoto!: boolean;

  @Column({ default: false })
  requiresVideo!: boolean;

  @Column({ type: 'int', default: 1 })
  minPhotos!: number;

  /** Etapa final (producto terminado): su evidencia se exige en la declaración. */
  @Column({ default: false })
  isFinal!: boolean;

  @Column({ default: true })
  active!: boolean;

  @ManyToMany(() => ProductFamily, { eager: true })
  @JoinTable({ name: 'production_stage_family' })
  families!: ProductFamily[];
}

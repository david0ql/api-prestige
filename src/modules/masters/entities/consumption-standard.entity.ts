import { Column, Entity, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { StandardBasis } from '../../../common/enums/domain.enums';
import { gramsColumn, numeric } from '../../../common/utils/numeric';
import { Product } from './product.entity';
import { ProductVariant } from './product-variant.entity';
import { Material } from './material.entity';

/**
 * Fórmula/estándar de consumo (RN-007): insumo requerido por producto/variante.
 * Ej. Escenario C: 0.28 g de hilo por gramo de producto (250 g → 70 g).
 */
@Entity('consumption_standard')
export class ConsumptionStandard extends BaseEntity {
  @ManyToOne(() => Product, (p) => p.standards, { nullable: false, onDelete: 'CASCADE' })
  product!: Product;

  @Column()
  productId!: string;

  /** Si se indica, aplica solo a esa variante (tiene prioridad sobre el general). */
  @ManyToOne(() => ProductVariant, { nullable: true, onDelete: 'CASCADE' })
  variant!: ProductVariant | null;

  @Column({ type: 'uuid', nullable: true })
  variantId!: string | null;

  @ManyToOne(() => Material, { nullable: false, eager: true })
  material!: Material;

  @Column()
  materialId!: string;

  @Column({ type: 'enum', enum: StandardBasis, default: StandardBasis.PER_GRAM })
  basis!: StandardBasis;

  /** Cantidad de insumo (g) por la base indicada. */
  @Column({ type: 'numeric', precision: 14, scale: 6, transformer: numeric })
  quantity!: number;

  /** Tamaño de lote en gramos (solo basis = PER_LOT). */
  @Column({ ...gramsColumn, nullable: true })
  lotSizeGrams!: number | null;

  /** Tolerancia (%) para alertas de consumo y solicitudes. */
  @Column({ type: 'numeric', precision: 6, scale: 3, default: 5, transformer: numeric })
  tolerancePct!: number;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ default: true })
  active!: boolean;
}

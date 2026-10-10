import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import {
  FinishedGoodStatus,
  PurityStatus,
  QualityResult,
} from '../../../common/enums/domain.enums';
import { gramsColumn, moneyColumn, purityColumn } from '../../../common/utils/numeric';
import { Product } from '../../masters/entities/product.entity';
import { ProductVariant } from '../../masters/entities/product-variant.entity';
import { Location } from '../../masters/entities/location.entity';

/**
 * Producto terminado recibido (inventario terminado). Queda en CUARENTENA hasta
 * que la orden se aprueba con calidad y ley liberadas; solo AVAILABLE puede
 * despacharse a cliente (RN-022, CA-014).
 */
@Entity('finished_good')
export class FinishedGood extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 30 })
  code!: string;

  @ManyToOne(() => Product, { nullable: false, eager: true })
  product!: Product;

  @Column()
  productId!: string;

  @ManyToOne(() => ProductVariant, { nullable: true, eager: true })
  variant!: ProductVariant | null;

  @Column({ type: 'uuid', nullable: true })
  variantId!: string | null;

  @Index()
  @Column()
  orderId!: string;

  @Column()
  workshopId!: string;

  @Column()
  receiptId!: string;

  @ManyToOne(() => Location, { nullable: false, eager: true })
  location!: Location;

  @Column()
  locationId!: string;

  @Column({ type: 'int', default: 0 })
  units!: number;

  @Column(gramsColumn)
  grams!: number;

  @Column({ type: 'int', default: 0 })
  availableUnits!: number;

  @Column(gramsColumn)
  availableGrams!: number;

  @Column({ type: 'enum', enum: FinishedGoodStatus, default: FinishedGoodStatus.QUARANTINE })
  status!: FinishedGoodStatus;

  @Column({ type: 'enum', enum: QualityResult, default: QualityResult.PENDING })
  qualityStatus!: QualityResult;

  @Column({ type: 'enum', enum: PurityStatus, default: PurityStatus.PENDING })
  purityStatus!: PurityStatus;

  @Column({ ...purityColumn, nullable: true })
  verifiedPurity!: number | null;

  /** Costo por gramo (material + mano de obra aprobada) calculado al cierre. */
  @Column({ ...moneyColumn, nullable: true })
  unitCostPerGram!: number | null;

  @Column({ ...moneyColumn, nullable: true })
  totalCost!: number | null;
}

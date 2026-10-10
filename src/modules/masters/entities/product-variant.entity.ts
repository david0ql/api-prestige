import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { RecordStatus } from '../../../common/enums/domain.enums';
import { gramsColumn } from '../../../common/utils/numeric';
import { Product } from './product.entity';

/** Variante de un modelo (talla, largo, calibre...). */
@Entity('product_variant')
@Index(['productId', 'code'], { unique: true })
export class ProductVariant extends BaseEntity {
  @ManyToOne(() => Product, (p) => p.variants, { nullable: false, onDelete: 'CASCADE' })
  product!: Product;

  @Column()
  productId!: string;

  @Column({ type: 'varchar', length: 30 })
  code!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ ...gramsColumn, nullable: true })
  standardWeight!: number | null;

  @Column({ type: 'jsonb', default: {} })
  attributes!: Record<string, string | number | boolean>;

  @Column({ type: 'enum', enum: RecordStatus, default: RecordStatus.ACTIVE })
  status!: RecordStatus;
}

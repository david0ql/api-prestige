import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Product } from './product.entity';
import { Workshop } from './workshop.entity';

/** Relación producto–taller: talleres habilitados por producto (validación crítica). */
@Entity('product_workshop')
@Index(['productId', 'workshopId'], { unique: true })
export class ProductWorkshop extends BaseEntity {
  @ManyToOne(() => Product, (p) => p.workshops, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  product!: Product;

  @Column()
  productId!: string;

  @ManyToOne(() => Workshop, (w) => w.products, {
    nullable: false,
    onDelete: 'CASCADE',
    eager: true,
  })
  workshop!: Workshop;

  @Column()
  workshopId!: string;

  @Column({ default: true })
  enabled!: boolean;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;
}

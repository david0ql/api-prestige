import { Column, Entity, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { LaborBasis } from '../../../common/enums/domain.enums';
import { moneyColumn } from '../../../common/utils/numeric';
import { Workshop } from './workshop.entity';
import { Product } from './product.entity';

/**
 * Tarifa de mano de obra (RF-018). Las tarifas definitivas se parametrizan después
 * (3.1); la estructura queda lista: taller, producto opcional, base y valor.
 */
@Entity('labor_rate')
export class LaborRate extends BaseEntity {
  @ManyToOne(() => Workshop, { nullable: false, eager: true })
  workshop!: Workshop;

  @Column()
  workshopId!: string;

  @ManyToOne(() => Product, { nullable: true, eager: true })
  product!: Product | null;

  @Column({ type: 'uuid', nullable: true })
  productId!: string | null;

  @Column({ type: 'enum', enum: LaborBasis, default: LaborBasis.GRAM })
  basis!: LaborBasis;

  @Column(moneyColumn)
  rate!: number;

  @Column({ type: 'date' })
  validFrom!: string;

  @Column({ type: 'date', nullable: true })
  validTo!: string | null;

  @Column({ default: true })
  active!: boolean;
}

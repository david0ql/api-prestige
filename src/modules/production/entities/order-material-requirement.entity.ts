import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { gramsColumn, numeric } from '../../../common/utils/numeric';
import { Material } from '../../masters/entities/material.entity';
import { ProductionOrder } from './production-order.entity';

/** Insumo requerido por la orden, calculado desde el estándar (RF-008). */
@Entity('order_material_requirement')
@Index(['orderId', 'materialId'], { unique: true })
export class OrderMaterialRequirement extends BaseEntity {
  @ManyToOne(() => ProductionOrder, (o) => o.requirements, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  order!: ProductionOrder;

  @Column()
  orderId!: string;

  @ManyToOne(() => Material, { nullable: false, eager: true })
  material!: Material;

  @Column()
  materialId!: string;

  @Column(gramsColumn)
  requiredGrams!: number;

  @Column({
    type: 'numeric',
    precision: 6,
    scale: 3,
    default: 5,
    transformer: numeric,
  })
  tolerancePct!: number;

  @Column({ type: 'uuid', nullable: true })
  standardId!: string | null;

  /** true si fue agregado/ajustado manualmente (no proviene del estándar). */
  @Column({ default: false })
  manual!: boolean;
}

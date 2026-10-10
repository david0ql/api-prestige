import { Column, Entity, Index, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { OrderPriority, OrderStatus } from '../../../common/enums/domain.enums';
import { gramsColumn } from '../../../common/utils/numeric';
import { Product } from '../../masters/entities/product.entity';
import { ProductVariant } from '../../masters/entities/product-variant.entity';
import { Workshop } from '../../masters/entities/workshop.entity';
import { User } from '../../users/entities/user.entity';
import { TechnicalSheet } from '../../catalog/entities/technical-sheet.entity';
import { OrderMaterialRequirement } from './order-material-requirement.entity';

/** Orden de producción (RF-007, RN-006) con la máquina de estados de la sección 7.1. */
@Entity('production_order')
export class ProductionOrder extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 30 })
  number!: string;

  @ManyToOne(() => Product, { nullable: false, eager: true })
  product!: Product;

  @Column()
  productId!: string;

  @ManyToOne(() => ProductVariant, { nullable: true, eager: true })
  variant!: ProductVariant | null;

  @Column({ type: 'uuid', nullable: true })
  variantId!: string | null;

  @ManyToOne(() => Workshop, { nullable: false, eager: true })
  workshop!: Workshop;

  @Index()
  @Column()
  workshopId!: string;

  @Column({ type: 'int', nullable: true })
  targetUnits!: number | null;

  @Column(gramsColumn)
  targetGrams!: number;

  @Column({ type: 'date' })
  commitmentDate!: string;

  @Index()
  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.DRAFT })
  status!: OrderStatus;

  @Column({ type: 'enum', enum: OrderPriority, default: OrderPriority.NORMAL })
  priority!: OrderPriority;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  /** Ficha técnica con la que se creó la orden (RN-023). */
  @ManyToOne(() => TechnicalSheet, { nullable: true, eager: true })
  technicalSheet!: TechnicalSheet | null;

  @Column({ type: 'uuid', nullable: true })
  technicalSheetId!: string | null;

  /** Operación de cliente relacionada (encargo con material aportado). */
  @Column({ type: 'uuid', nullable: true })
  customerOperationId!: string | null;

  /** Orden padre cuando se genera para fabricar un insumo faltante (Escenario C). */
  @Column({ type: 'uuid', nullable: true })
  parentOrderId!: string | null;

  @ManyToOne(() => User, { nullable: false })
  createdBy!: User;

  @Column()
  createdById!: string;

  @Column({ type: 'timestamptz', nullable: true })
  dispatchedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  acceptedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  finishedByWorkshopAt!: Date | null;

  /** Fecha real de entrega = recepción final en Oficina Madre (RF-032). */
  @Column({ type: 'timestamptz', nullable: true })
  deliveredAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  closedAt!: Date | null;

  @Column({ type: 'uuid', nullable: true })
  approvedById!: string | null;

  @Column({ type: 'text', nullable: true })
  rejectionReason!: string | null;

  @Column({ type: 'text', nullable: true })
  cancellationReason!: string | null;

  /** Foto de la conciliación al momento del cierre (inmutable tras aprobar). */
  @Column({ type: 'jsonb', nullable: true })
  reconciliationSnapshot!: Record<string, unknown> | null;

  @OneToMany(() => OrderMaterialRequirement, (r) => r.order, {
    cascade: ['insert', 'update'],
  })
  requirements!: OrderMaterialRequirement[];
}

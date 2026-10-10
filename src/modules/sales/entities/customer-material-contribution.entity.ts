import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { ContributionTiming, TransactionStatus } from '../../../common/enums/domain.enums';
import { gramsColumn, moneyColumn, purityColumn } from '../../../common/utils/numeric';
import { Material } from '../../masters/entities/material.entity';

/**
 * Abono/aporte de MATERIAL del cliente (RF-027, RN-017): pesado en Balanza Madre,
 * con material, ley, peso, fecha, origen, operación y momento (antes/después de la
 * fabricación). Trazabilidad separada del dinero; entra al inventario como lote
 * del cliente.
 */
@Entity('customer_material_contribution')
export class CustomerMaterialContribution extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 30 })
  number!: string;

  @Index()
  @Column()
  customerId!: string;

  @Index()
  @Column()
  operationId!: string;

  @ManyToOne(() => Material, { nullable: false, eager: true })
  material!: Material;

  @Column()
  materialId!: string;

  @Column(gramsColumn)
  grams!: number;

  @Column(purityColumn)
  declaredPurity!: number;

  @Column({ ...purityColumn, nullable: true })
  verifiedPurity!: number | null;

  /** Gramos finos = gramos × ley/1000 (equivalente en metal puro). */
  @Column(gramsColumn)
  fineGrams!: number;

  @Column({ type: 'enum', enum: ContributionTiming })
  timing!: ContributionTiming;

  @Column({ type: 'varchar', length: 200 })
  origin!: string;

  @Column({ type: 'date' })
  contributionDate!: string;

  /** Valoración informativa (precio por gramo fino), separada del saldo en dinero. */
  @Column({ ...moneyColumn, nullable: true })
  pricePerGram!: number | null;

  @Column({ ...moneyColumn, nullable: true })
  valuation!: number | null;

  @Column({ type: 'uuid', nullable: true })
  productionOrderId!: string | null;

  @Column()
  weighingId!: string;

  @Column({ type: 'uuid', nullable: true })
  movementId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  lotId!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'enum', enum: TransactionStatus, default: TransactionStatus.POSTED })
  status!: TransactionStatus;

  @Column()
  receivedById!: string;
}

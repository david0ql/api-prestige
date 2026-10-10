import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { InsufficiencyAction } from '../../../common/enums/domain.enums';
import { gramsColumn } from '../../../common/utils/numeric';

/**
 * Decisión ante insuficiencia (Escenario C): la orden conserva trazabilidad de la
 * acción tomada, quién la tomó y quién la autorizó.
 */
@Entity('order_decision')
export class OrderDecision {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column()
  orderId!: string;

  @Column({ type: 'enum', enum: InsufficiencyAction })
  action!: InsufficiencyAction;

  @Column({ type: 'uuid', nullable: true })
  materialId!: string | null;

  @Column({ ...gramsColumn, nullable: true })
  requiredGrams!: number | null;

  @Column({ ...gramsColumn, nullable: true })
  assignedGrams!: number | null;

  @Column({ ...gramsColumn, nullable: true })
  shortfallGrams!: number | null;

  @Column({ type: 'text' })
  justification!: string;

  @Column({ type: 'jsonb', nullable: true })
  details!: Record<string, unknown> | null;

  /** Orden generada para fabricar el faltante (REQUEST_FABRICATION). */
  @Column({ type: 'uuid', nullable: true })
  generatedOrderId!: string | null;

  @Column()
  decidedById!: string;

  @Column({ type: 'uuid', nullable: true })
  authorizedById!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}

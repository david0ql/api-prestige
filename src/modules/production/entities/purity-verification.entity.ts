import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PurityMethod } from '../../../common/enums/domain.enums';
import { purityColumn } from '../../../common/utils/numeric';

/**
 * Verificación de ley/pureza del producto terminado (RF-044): método, soporte,
 * responsable, fecha, valor obtenido y conformidad frente al estándar.
 * Conforme si valor ≥ objetivo − tolerancia (una ley mayor nunca desfavorece).
 */
@Entity('purity_verification')
export class PurityVerification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column()
  orderId!: string;

  @Index()
  @Column()
  receiptId!: string;

  @Column()
  productId!: string;

  @Column({ type: 'enum', enum: PurityMethod })
  method!: PurityMethod;

  @Column({ type: 'varchar', length: 160, nullable: true })
  supportReference!: string | null;

  @Column({ type: 'uuid', nullable: true })
  supportMediaId!: string | null;

  @Column(purityColumn)
  obtainedValue!: number;

  @Column(purityColumn)
  targetValue!: number;

  @Column(purityColumn)
  tolerance!: number;

  @Column()
  conforming!: boolean;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column()
  verifiedById!: string;

  @Column({ type: 'timestamptz' })
  verifiedAt!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}

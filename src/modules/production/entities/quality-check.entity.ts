import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { QualityResult } from '../../../common/enums/domain.enums';

/** Control de calidad de la recepción (P11, RN-022). */
@Entity('quality_check')
export class QualityCheck {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column()
  orderId!: string;

  @Index()
  @Column()
  receiptId!: string;

  @Column({ type: 'enum', enum: QualityResult })
  result!: QualityResult;

  /** Lista de chequeo: [{ item: 'Acabado', ok: true, note?: '' }]. */
  @Column({ type: 'jsonb', default: [] })
  checklist!: { item: string; ok: boolean; note?: string }[];

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column()
  inspectorId!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  checkedAt!: Date;
}

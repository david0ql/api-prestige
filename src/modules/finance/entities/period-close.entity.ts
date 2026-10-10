import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Cierre financiero mensual: bloquea registros en el período cerrado. */
@Entity('period_close')
export class PeriodClose {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Período YYYY-MM. */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 7 })
  period!: string;

  @Column({ type: 'jsonb' })
  totals!: Record<string, number>;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column()
  closedById!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  closedAt!: Date;
}

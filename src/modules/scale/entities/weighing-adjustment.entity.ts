import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { gramsColumn } from '../../../common/utils/numeric';
import { User } from '../../users/entities/user.entity';
import { Weighing } from './weighing.entity';

/** Ajuste trazable de un pesaje (RN-019): valor anterior, nuevo, motivo y quién. */
@Entity('weighing_adjustment')
export class WeighingAdjustment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Weighing, { nullable: false })
  weighing!: Weighing;

  @Column()
  weighingId!: string;

  @Column(gramsColumn)
  previousNetGrams!: number;

  @Column(gramsColumn)
  newNetGrams!: number;

  @Column({ type: 'text' })
  reason!: string;

  @ManyToOne(() => User, { nullable: false })
  adjustedBy!: User;

  @Column()
  adjustedById!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}

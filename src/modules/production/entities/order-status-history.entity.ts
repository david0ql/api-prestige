import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { OrderStatus } from '../../../common/enums/domain.enums';

/** Historial de estados de la orden (seguimiento P06 y trazabilidad). */
@Entity('order_status_history')
export class OrderStatusHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column()
  orderId!: string;

  @Column({ type: 'enum', enum: OrderStatus, nullable: true })
  fromStatus!: OrderStatus | null;

  @Column({ type: 'enum', enum: OrderStatus })
  toStatus!: OrderStatus;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  @Column()
  userId!: string;

  @Column({ type: 'varchar', length: 160 })
  userName!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}

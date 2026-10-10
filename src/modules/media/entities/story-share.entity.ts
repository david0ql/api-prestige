import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Enlace público de la historia visual de una orden/prenda (RF-041: "preparado para
 * uso posterior en experiencia de consumidor final"). Token aleatorio, revocable.
 */
@Entity('story_share')
export class StoryShare {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  token!: string;

  @Column()
  productionOrderId!: string;

  @Column({ type: 'varchar', length: 160, nullable: true })
  title!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @Column({ type: 'int', default: 0 })
  views!: number;

  @Column()
  createdById!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}

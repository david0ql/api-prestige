import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Firma/aceptación digital (RF-035): usuario, fecha, IP, dispositivo, nombre
 * tecleado, trazo de firma (imagen) y hash SHA-256 del contenido aceptado, para
 * demostrar que lo firmado no cambió después.
 */
@Entity('digital_acceptance')
@Index(['entityType', 'entityId'])
export class DigitalAcceptance {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 40 })
  entityType!: string;

  @Column()
  entityId!: string;

  @Column({ type: 'varchar', length: 30 })
  decision!: string;

  @Column()
  userId!: string;

  @Column({ type: 'varchar', length: 160 })
  signerName!: string;

  /** Imagen PNG (data URL) del trazo de firma, opcional. */
  @Column({ type: 'text', nullable: true })
  signatureImage!: string | null;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column({ type: 'varchar', length: 64 })
  payloadHash!: string;

  @Column({ type: 'text', nullable: true })
  observations!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  userAgent!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  signedAt!: Date;
}

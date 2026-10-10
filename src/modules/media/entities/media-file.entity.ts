import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { MediaKind, MediaPurpose } from '../../../common/enums/domain.enums';
import { User } from '../../users/entities/user.entity';

/**
 * Evidencia multimedia (RF-014, RF-041, RNF-009/011). Ligada a orden, producto,
 * taller, etapa y usuario. Nunca se borra físicamente; se oculta con trazabilidad
 * (RN-024).
 */
@Entity('media_file')
@Index(['productionOrderId', 'capturedAt'])
export class MediaFile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: MediaKind })
  kind!: MediaKind;

  @Column({ type: 'enum', enum: MediaPurpose })
  purpose!: MediaPurpose;

  @Column({ type: 'varchar', length: 255 })
  originalName!: string;

  @Column({ type: 'varchar', length: 120 })
  mimeType!: string;

  @Column({
    type: 'bigint',
    transformer: { to: (v: number) => v, from: (v: string) => Number(v) },
  })
  sizeBytes!: number;

  /** Hash SHA-256 del original: integridad y detección de duplicados. */
  @Column({ type: 'varchar', length: 64 })
  sha256!: string;

  /** Ruta relativa del original dentro del almacenamiento. */
  @Column({ type: 'varchar', length: 255 })
  storagePath!: string;

  /** Versión optimizada para web/móvil (fotos → webp). */
  @Column({ type: 'varchar', length: 255, nullable: true })
  webPath!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  thumbPath!: string | null;

  @Column({ type: 'int', nullable: true })
  width!: number | null;

  @Column({ type: 'int', nullable: true })
  height!: number | null;

  /** Fecha de captura (EXIF si existe, si no fecha de carga). */
  @Column({ type: 'timestamptz' })
  capturedAt!: Date;

  @Column({ type: 'text', nullable: true })
  caption!: string | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  productionOrderId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  productId!: string | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  workshopId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  stageId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  progressReportId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  finishedDeclarationId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  receiptId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  technicalSheetId!: string | null;

  /** Entidad genérica adicional (transacción financiera, aporte de cliente...). */
  @Column({ type: 'varchar', length: 40, nullable: true })
  relatedType!: string | null;

  @Column({ type: 'uuid', nullable: true })
  relatedId!: string | null;

  @Column({ default: false })
  hidden!: boolean;

  @Column({ type: 'text', nullable: true })
  hiddenReason!: string | null;

  @Column({ type: 'uuid', nullable: true })
  hiddenById!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  hiddenAt!: Date | null;

  /** Visible en la historia pública para el consumidor final. */
  @Column({ default: true })
  publicVisible!: boolean;

  @ManyToOne(() => User, { nullable: false })
  uploadedBy!: User;

  @Column()
  uploadedById!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  uploadedAt!: Date;
}

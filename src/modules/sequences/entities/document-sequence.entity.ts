import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Consecutivos legibles por tipo de documento y año (OP-2026-0001, DES-2026-0001...).
 * Se incrementan con bloqueo pesimista dentro de la transacción del documento.
 */
@Entity('document_sequence')
export class DocumentSequence {
  @PrimaryColumn({ length: 20 })
  prefix!: string;

  @PrimaryColumn({ type: 'int' })
  year!: number;

  @Column({ type: 'int', default: 0 })
  lastValue!: number;
}

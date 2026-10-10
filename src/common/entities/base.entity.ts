import {
  CreateDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';

/**
 * Base de todas las entidades: id uuid + marcas de tiempo con zona horaria.
 * `version` habilita bloqueo optimista (evita que dos usuarios pisen cambios).
 */
export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @VersionColumn({ default: 1 })
  version!: number;
}

/** Base para registros inmutables (movimientos, bitácora): sin updatedAt/version. */
export abstract class ImmutableEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

import { Column, Entity, JoinTable, ManyToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { VariableDataType } from '../../../common/enums/domain.enums';
import { ProductFamily } from './product-family.entity';

/**
 * Definición de variable técnica configurable (calibre, tipo de cierre, # piedras…)
 * usada por la ficha técnica y exigida al declarar producto terminado (RF-017/042).
 */
@Entity('technical_variable')
export class TechnicalVariable extends BaseEntity {
  @Column({ type: 'varchar', length: 40, unique: true })
  code!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'enum', enum: VariableDataType, default: VariableDataType.NUMBER })
  dataType!: VariableDataType;

  @Column({ type: 'varchar', length: 20, nullable: true })
  unit!: string | null;

  /** Opciones para dataType = SELECT. */
  @Column({ type: 'text', array: true, default: '{}' })
  options!: string[];

  /** Debe registrarse al declarar producto terminado. */
  @Column({ default: false })
  requiredOnFinish!: boolean;

  @Column({ default: true })
  active!: boolean;

  @ManyToMany(() => ProductFamily, { eager: true })
  @JoinTable({ name: 'technical_variable_family' })
  families!: ProductFamily[];
}

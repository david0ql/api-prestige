import { Column, Entity, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { RecordStatus } from '../../../common/enums/domain.enums';
import {
  gramsColumn,
  moneyColumn,
  purityColumn,
} from '../../../common/utils/numeric';
import { MaterialCategory } from './material-category.entity';
import { Unit } from './unit.entity';

/** Maestro de materiales (sección 5). Unidad operativa: gramo. */
@Entity('material')
export class Material extends BaseEntity {
  @Column({ type: 'varchar', length: 30, unique: true })
  code!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @ManyToOne(() => MaterialCategory, { nullable: false, eager: true })
  category!: MaterialCategory;

  @Column()
  categoryId!: string;

  /** Ley/pureza en milésimas (999 = oro fino, referencia operativa de 24K). RF-043. */
  @Column({ ...purityColumn, nullable: true })
  purity!: number | null;

  /** Quilataje informativo (24, 18, 10...). */
  @Column({ type: 'smallint', nullable: true })
  karat!: number | null;

  /** Tolerancia de pureza en milésimas para verificaciones. */
  @Column({ ...purityColumn, nullable: true })
  purityTolerance!: number | null;

  @ManyToOne(() => Unit, { nullable: false, eager: true })
  baseUnit!: Unit;

  @Column()
  baseUnitId!: string;

  /** Costo de referencia por gramo (moneda local) para costeo de producción. */
  @Column({ ...moneyColumn, default: 0 })
  referenceCost!: number;

  /** Mínimo de inventario en Oficina Madre (alerta RF-039). */
  @Column({ ...gramsColumn, default: 0 })
  minStock!: number;

  /** Producido internamente (p. ej. hilo): puede ser salida de una orden. */
  @Column({ default: false })
  isIntermediate!: boolean;

  /** Indica si se controla por lote (lote obligatorio en entradas). */
  @Column({ default: false })
  tracksLots!: boolean;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'enum', enum: RecordStatus, default: RecordStatus.ACTIVE })
  status!: RecordStatus;
}

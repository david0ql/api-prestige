import { Column, Entity, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { RecordStatus } from '../../../common/enums/domain.enums';
import { purityColumn, gramsColumn, numeric } from '../../../common/utils/numeric';
import { ProductFamily } from './product-family.entity';
import { Material } from './material.entity';
import { ProductVariant } from './product-variant.entity';
import { ProductWorkshop } from './product-workshop.entity';
import { ConsumptionStandard } from './consumption-standard.entity';

/**
 * Producto / modelo. Los datos técnicos (peso, diámetro, medidas, variables) viven
 * en la ficha técnica versionada (RN-023); aquí quedan los parámetros de control.
 */
@Entity('product')
export class Product extends BaseEntity {
  @Column({ type: 'varchar', length: 30, unique: true })
  code!: string;

  @Column({ type: 'varchar', length: 160 })
  name!: string;

  @ManyToOne(() => ProductFamily, { nullable: false, eager: true })
  family!: ProductFamily;

  @Column()
  familyId!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  /** Ley/pureza objetivo en milésimas (RF-043). */
  @Column({ ...purityColumn, nullable: true })
  targetPurity!: number | null;

  @Column({ ...purityColumn, nullable: true })
  purityTolerance!: number | null;

  /** Si true, la recepción exige verificación de ley conforme (RN-021). */
  @Column({ default: true })
  requiresPurityCheck!: boolean;

  /** Si true, la recepción exige control de calidad aprobado (RN-022). */
  @Column({ default: true })
  requiresQualityCheck!: boolean;

  /** Tolerancia de merma de proceso (%) para conciliación. */
  @Column({ type: 'numeric', precision: 6, scale: 3, default: 2, transformer: numeric })
  lossTolerancePct!: number;

  /** Peso estándar de referencia por unidad (resumen de la ficha vigente). */
  @Column({ ...gramsColumn, nullable: true })
  standardWeight!: number | null;

  /**
   * Producto intermedio: al aprobarse la orden, lo producido entra al inventario
   * como este material (Escenario B: hilo).
   */
  @ManyToOne(() => Material, { nullable: true, eager: true })
  outputMaterial!: Material | null;

  @Column({ type: 'uuid', nullable: true })
  outputMaterialId!: string | null;

  @Column({ type: 'int', default: 0 })
  currentSheetVersion!: number;

  @Column({ type: 'enum', enum: RecordStatus, default: RecordStatus.ACTIVE })
  status!: RecordStatus;

  @OneToMany(() => ProductVariant, (v) => v.product)
  variants!: ProductVariant[];

  @OneToMany(() => ProductWorkshop, (pw) => pw.product)
  workshops!: ProductWorkshop[];

  @OneToMany(() => ConsumptionStandard, (s) => s.product)
  standards!: ConsumptionStandard[];
}

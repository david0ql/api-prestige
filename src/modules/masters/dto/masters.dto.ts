import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import {
  LaborBasis,
  LocationType,
  RecordStatus,
  StandardBasis,
  TransactionType,
  UnitKind,
  VariableDataType,
} from '../../../common/enums/domain.enums';

const CODE = /^[A-Za-z0-9._-]{1,30}$/;
const CODE_MSG =
  'Código: 1-30 caracteres alfanuméricos, punto, guion o guion bajo';

export class MasterQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: RecordStatus })
  @IsOptional()
  @IsEnum(RecordStatus)
  status?: RecordStatus;
}

// ---------- Unidades ----------
export class CreateUnitDto {
  @ApiProperty() @Matches(/^[A-Za-z0-9]{1,12}$/) code!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(60) name!: string;
  @ApiProperty({ enum: UnitKind }) @IsEnum(UnitKind) kind!: UnitKind;
  @ApiProperty() @IsNumber() @IsPositive() factorToGram!: number;
  @ApiPropertyOptional({ enum: RecordStatus })
  @IsOptional()
  @IsEnum(RecordStatus)
  status?: RecordStatus;
}
export class UpdateUnitDto extends PartialType(CreateUnitDto) {}

// ---------- Categorías de material ----------
export class CreateMaterialCategoryDto {
  @ApiProperty() @Matches(CODE, { message: CODE_MSG }) code!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(100) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isPreciousMetal?: boolean;
  @ApiPropertyOptional({ enum: RecordStatus })
  @IsOptional()
  @IsEnum(RecordStatus)
  status?: RecordStatus;
}
export class UpdateMaterialCategoryDto extends PartialType(
  CreateMaterialCategoryDto,
) {}

// ---------- Materiales ----------
export class CreateMaterialDto {
  @ApiProperty({ example: 'AU24' })
  @Matches(CODE, { message: CODE_MSG })
  code!: string;
  @ApiProperty({ example: 'Oro 24K' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;
  @ApiProperty() @IsUUID() categoryId!: string;
  @ApiPropertyOptional({ example: 999, description: 'Ley en milésimas' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  purity?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(24) karat?:
    number | null;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  purityTolerance?: number | null;
  @ApiProperty() @IsUUID() baseUnitId!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  referenceCost?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) minStock?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isIntermediate?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() tracksLots?: boolean;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;
  @ApiPropertyOptional({ enum: RecordStatus })
  @IsOptional()
  @IsEnum(RecordStatus)
  status?: RecordStatus;
}
export class UpdateMaterialDto extends PartialType(CreateMaterialDto) {}

// ---------- Talleres ----------
export class CreateWorkshopDto {
  @ApiProperty({ example: 'TC' })
  @Matches(/^[A-Za-z0-9_-]{1,20}$/)
  code!: string;
  @ApiProperty({ example: 'Colmenares' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  responsible?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) phone?:
    string | null;
  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== '')
  @IsEmail()
  @MaxLength(160)
  email?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) address?:
    string | null;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  mainProduction?: string | null;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  conditions?: string | null;
  @ApiPropertyOptional({ type: [String], description: 'Productos autorizados' })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  productIds?: string[];
  @ApiPropertyOptional({ enum: RecordStatus })
  @IsOptional()
  @IsEnum(RecordStatus)
  status?: RecordStatus;
}
export class UpdateWorkshopDto extends PartialType(CreateWorkshopDto) {}

// ---------- Ubicaciones ----------
export class CreateLocationDto {
  @ApiProperty() @Matches(CODE, { message: CODE_MSG }) code!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(120) name!: string;
  @ApiProperty({
    enum: [LocationType.OTHER, LocationType.CUSTOMER, LocationType.TRANSIT],
  })
  @IsIn([LocationType.OTHER, LocationType.CUSTOMER, LocationType.TRANSIT])
  type!: LocationType;
  @ApiPropertyOptional() @IsOptional() @IsUUID() customerId?: string | null;
  @ApiPropertyOptional({ enum: RecordStatus })
  @IsOptional()
  @IsEnum(RecordStatus)
  status?: RecordStatus;
}
export class UpdateLocationDto extends PartialType(CreateLocationDto) {}

// ---------- Clientes ----------
export class CreateCustomerDto {
  @ApiProperty({ example: 'CC' })
  @IsIn(['CC', 'NIT', 'CE', 'PAS', 'TI', 'OTRO'])
  documentType!: string;
  @ApiProperty() @Matches(/^[A-Za-z0-9-]{3,30}$/) documentNumber!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(160) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) phone?:
    string | null;
  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== '')
  @IsEmail()
  email?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) address?:
    string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) city?:
    string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) notes?:
    string | null;
  @ApiPropertyOptional({ enum: RecordStatus })
  @IsOptional()
  @IsEnum(RecordStatus)
  status?: RecordStatus;
}
export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {}

// ---------- Familias ----------
export class CreateProductFamilyDto {
  @ApiProperty() @Matches(CODE, { message: CODE_MSG }) code!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(120) name!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;
  @ApiPropertyOptional({ enum: RecordStatus })
  @IsOptional()
  @IsEnum(RecordStatus)
  status?: RecordStatus;
}
export class UpdateProductFamilyDto extends PartialType(
  CreateProductFamilyDto,
) {}

// ---------- Productos ----------
export class CreateProductDto {
  @ApiProperty() @Matches(CODE, { message: CODE_MSG }) code!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(160) name!: string;
  @ApiProperty() @IsUUID() familyId!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string | null;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  targetPurity?: number | null;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  purityTolerance?: number | null;
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requiresPurityCheck?: boolean;
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requiresQualityCheck?: boolean;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  lossTolerancePct?: number;
  @ApiPropertyOptional() @IsOptional() @IsUUID() outputMaterialId?:
    string | null;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  workshopIds?: string[];
  @ApiPropertyOptional({ enum: RecordStatus })
  @IsOptional()
  @IsEnum(RecordStatus)
  status?: RecordStatus;
}
export class UpdateProductDto extends PartialType(CreateProductDto) {}

export class CreateVariantDto {
  @ApiProperty() @Matches(CODE, { message: CODE_MSG }) code!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(120) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) standardWeight?:
    number | null;
  @ApiPropertyOptional() @IsOptional() @IsObject() attributes?: Record<
    string,
    string | number | boolean
  >;
  @ApiPropertyOptional({ enum: RecordStatus })
  @IsOptional()
  @IsEnum(RecordStatus)
  status?: RecordStatus;
}
export class UpdateVariantDto extends PartialType(CreateVariantDto) {}

export class CreateStandardDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() variantId?: string | null;
  @ApiProperty() @IsUUID() materialId!: string;
  @ApiProperty({ enum: StandardBasis })
  @IsEnum(StandardBasis)
  basis!: StandardBasis;
  @ApiProperty({ example: 0.28 }) @IsNumber() @IsPositive() quantity!: number;
  @ApiPropertyOptional()
  @ValidateIf((o: CreateStandardDto) => o.basis === StandardBasis.PER_LOT)
  @IsNumber()
  @IsPositive()
  lotSizeGrams?: number | null;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  tolerancePct?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) notes?:
    string | null;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
}
export class UpdateStandardDto extends PartialType(CreateStandardDto) {}

// ---------- Tarifas de mano de obra ----------
export class CreateLaborRateDto {
  @ApiProperty() @IsUUID() workshopId!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() productId?: string | null;
  @ApiProperty({ enum: LaborBasis }) @IsEnum(LaborBasis) basis!: LaborBasis;
  @ApiProperty() @IsNumber() @Min(0) rate!: number;
  @ApiProperty() @IsDateString() validFrom!: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() validTo?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
}
export class UpdateLaborRateDto extends PartialType(CreateLaborRateDto) {}

// ---------- Etapas ----------
export class CreateStageDto {
  @ApiProperty() @Matches(CODE, { message: CODE_MSG }) code!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(120) name!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;
  @ApiProperty() @IsInt() @Min(1) sequence!: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() mandatory?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() requiresPhoto?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() requiresVideo?: boolean;
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  minPhotos?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isFinal?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  familyIds?: string[];
}
export class UpdateStageDto extends PartialType(CreateStageDto) {}

// ---------- Variables técnicas ----------
export class CreateVariableDto {
  @ApiProperty()
  @Matches(/^[A-Z0-9_]{1,40}$/, {
    message: 'Código en MAYÚSCULAS_CON_GUION_BAJO',
  })
  code!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(120) name!: string;
  @ApiProperty({ enum: VariableDataType })
  @IsEnum(VariableDataType)
  dataType!: VariableDataType;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) unit?:
    string | null;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  options?: string[];
  @ApiPropertyOptional() @IsOptional() @IsBoolean() requiredOnFinish?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  familyIds?: string[];
}
export class UpdateVariableDto extends PartialType(CreateVariableDto) {}

// ---------- Medios de pago / categorías financieras ----------
export class CreatePaymentMethodDto {
  @ApiProperty() @Matches(/^[A-Z0-9_]{1,20}$/) code!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(80) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
}
export class UpdatePaymentMethodDto extends PartialType(
  CreatePaymentMethodDto,
) {}

export class CreateFinanceCategoryDto {
  @ApiProperty() @Matches(/^[A-Z0-9_]{1,30}$/) code!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(120) name!: string;
  @ApiProperty({ enum: TransactionType })
  @IsEnum(TransactionType)
  type!: TransactionType;
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isOperatingExpense?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
}
export class UpdateFinanceCategoryDto extends PartialType(
  CreateFinanceCategoryDto,
) {}

// ---------- Parámetros ----------
export class UpdateParameterDto {
  @ApiProperty({ description: 'Valor JSON del parámetro' })
  @IsNotEmpty()
  value!: unknown;
}

export class BulkStandardsDto {
  @ApiProperty({ type: [CreateStandardDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateStandardDto)
  items!: CreateStandardDto[];
}

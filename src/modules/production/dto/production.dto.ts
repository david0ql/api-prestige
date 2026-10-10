import {
  ApiProperty,
  ApiPropertyOptional,
  PartialType,
  PickType,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
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
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import {
  ApprovalStatus,
  DiscrepancyStatus,
  DiscrepancyType,
  DispatchStatus,
  InsufficiencyAction,
  LaborBasis,
  OrderPriority,
  OrderStatus,
  PurityMethod,
  QualityResult,
  ReceiptLineType,
  ReceiptType,
  RequestStatus,
} from '../../../common/enums/domain.enums';

// ---------------- Órdenes ----------------
export class RequirementInputDto {
  @ApiProperty() @IsUUID() materialId!: string;
  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  requiredGrams!: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  tolerancePct?: number;
}

export class CreateOrderDto {
  @ApiProperty() @IsUUID() productId!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() variantId?: string | null;
  @ApiProperty() @IsUUID() workshopId!: string;
  @ApiPropertyOptional({ description: 'Unidades objetivo' })
  @IsOptional()
  @IsInt()
  @Min(1)
  targetUnits?: number | null;
  @ApiProperty({ example: 250, description: 'Peso objetivo en gramos' })
  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  targetGrams!: number;
  @ApiProperty({ example: '2026-10-30' })
  @IsDateString()
  commitmentDate!: string;
  @ApiPropertyOptional({ enum: OrderPriority })
  @IsOptional()
  @IsEnum(OrderPriority)
  priority?: OrderPriority;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) notes?:
    string | null;
  @ApiPropertyOptional() @IsOptional() @IsUUID() customerOperationId?:
    string | null;
  @ApiPropertyOptional({
    type: [RequirementInputDto],
    description: 'Insumos manuales adicionales o que reemplazan al estándar',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RequirementInputDto)
  extraRequirements?: RequirementInputDto[];
}

export class UpdateOrderDto extends PartialType(CreateOrderDto) {}

export class OrderQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: OrderStatus, isArray: true })
  @IsOptional()
  @IsEnum(OrderStatus, { each: true })
  status?: OrderStatus | OrderStatus[];
  @ApiPropertyOptional() @IsOptional() @IsUUID() workshopId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() productId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['true', 'false'])
  overdue?: string;
  @ApiPropertyOptional() @IsOptional() @IsIn(['true', 'false']) open?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() from?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() to?: string;
}

export class ReasonDto {
  @ApiProperty() @IsString() @MinLength(5) @MaxLength(1000) reason!: string;
}

export class ModifyTargetDto {
  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  targetGrams!: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) targetUnits?:
    number | null;
  @ApiProperty() @IsString() @MinLength(5) @MaxLength(1000) reason!: string;
}

// ---------------- Despachos ----------------
export class DispatchLineDto {
  @ApiProperty() @IsUUID() materialId!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() lotId?: string | null;
  @ApiProperty({ description: 'Pesaje de salida en Balanza Madre' })
  @IsUUID()
  weighingId!: string;
}

export class InsufficiencyDecisionDto {
  @ApiProperty({
    enum: [
      InsufficiencyAction.DISPATCH_PARTIAL,
      InsufficiencyAction.REQUEST_FABRICATION,
      InsufficiencyAction.MODIFY_ORDER,
    ],
  })
  @IsIn([
    InsufficiencyAction.DISPATCH_PARTIAL,
    InsufficiencyAction.REQUEST_FABRICATION,
    InsufficiencyAction.MODIFY_ORDER,
  ])
  action!: InsufficiencyAction;
  @ApiProperty()
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  justification!: string;
  @ApiPropertyOptional({
    description:
      'Taller para fabricar el insumo faltante (REQUEST_FABRICATION)',
  })
  @IsOptional()
  @IsUUID()
  fabricationWorkshopId?: string;
}

export class CreateDispatchDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() orderId?: string | null;
  @ApiPropertyOptional({ description: 'Obligatorio si no hay orden' })
  @ValidateIf((o: CreateDispatchDto) => !o.orderId)
  @IsUUID()
  workshopId?: string;
  @ApiProperty({ description: 'Motivo/propósito (RN-005)' })
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  purpose!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() materialRequestId?:
    string | null;
  @ApiProperty({ type: [DispatchLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DispatchLineDto)
  lines!: DispatchLineDto[];
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) notes?:
    string | null;
  @ApiPropertyOptional({ type: InsufficiencyDecisionDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => InsufficiencyDecisionDto)
  insufficiencyDecision?: InsufficiencyDecisionDto;
  @ApiPropertyOptional({
    description:
      'RN-003: motivo de autorización excepcional para despachar sin stock',
  })
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  overrideReason?: string;
}

export class PreviewDispatchLineDto {
  @ApiProperty() @IsUUID() materialId!: string;
  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  grams!: number;
}

export class PreviewDispatchDto {
  @ApiProperty() @IsUUID() orderId!: string;
  @ApiProperty({ type: [PreviewDispatchLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PreviewDispatchLineDto)
  lines!: PreviewDispatchLineDto[];
}

export class AcceptanceLineDto {
  @ApiProperty() @IsUUID() lineId!: string;
  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  receivedGrams!: number;
}

export class RespondDispatchDto {
  @ApiProperty({ enum: ['ACCEPT', 'REJECT'] })
  @IsIn(['ACCEPT', 'REJECT'])
  decision!: 'ACCEPT' | 'REJECT';
  @ApiPropertyOptional({ type: [AcceptanceLineDto] })
  @ValidateIf((o: RespondDispatchDto) => o.decision === 'ACCEPT')
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AcceptanceLineDto)
  lines?: AcceptanceLineDto[];
  @ApiProperty({ description: 'Nombre del firmante (firma digital)' })
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  signerName!: string;
  @ApiPropertyOptional({ description: 'Trazo de firma PNG en data URL' })
  @IsOptional()
  @IsString()
  @MaxLength(400_000)
  @Matches(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/, {
    message: 'Firma inválida',
  })
  signatureImage?: string;
  @ApiPropertyOptional()
  @ValidateIf((o: RespondDispatchDto) => o.decision === 'REJECT')
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  observations?: string;
  @ApiProperty({ description: 'Acepta el compromiso de producción (RF-011)' })
  @IsBoolean()
  acceptCommitment!: boolean;
}

export class DispatchQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() orderId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() workshopId?: string;
  @ApiPropertyOptional({ enum: DispatchStatus })
  @IsOptional()
  @IsEnum(DispatchStatus)
  status?: DispatchStatus;
}

// ---------------- Portal de taller ----------------
export class ConsumptionDto {
  @ApiProperty() @IsUUID() materialId!: string;
  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  grams!: number;
  @ApiPropertyOptional() @IsOptional() @IsUUID() stageId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class ConsumptionBatchDto {
  @ApiProperty({ type: [ConsumptionDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ConsumptionDto)
  items!: ConsumptionDto[];
}

export class ProgressDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() stageId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  grams?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) units?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  percent?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
  @ApiPropertyOptional({
    description: 'Marcar la etapa como completada (exige evidencia)',
  })
  @IsOptional()
  @IsBoolean()
  completesStage?: boolean;
}

export class CreateMaterialRequestDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() orderId?: string;
  @ApiProperty() @IsUUID() materialId!: string;
  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  grams!: number;
  @ApiProperty() @IsString() @MinLength(5) @MaxLength(1000) reason!: string;
}

export class ReviewRequestDto {
  @ApiProperty({ enum: ['APPROVE', 'REJECT'] })
  @IsIn(['APPROVE', 'REJECT'])
  decision!: 'APPROVE' | 'REJECT';
  @ApiPropertyOptional()
  @ValidateIf((o: ReviewRequestDto) => o.decision === 'REJECT')
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  notes?: string;
}

export class RequestQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: RequestStatus })
  @IsOptional()
  @IsEnum(RequestStatus)
  status?: RequestStatus;
  @ApiPropertyOptional() @IsOptional() @IsUUID() orderId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() workshopId?: string;
}

export class LeftoverDto {
  @ApiProperty() @IsUUID() materialId!: string;
  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  grams!: number;
  @ApiProperty({
    enum: [
      ReceiptLineType.LEFTOVER,
      ReceiptLineType.UNUSED,
      ReceiptLineType.RETURN,
    ],
  })
  @IsIn([
    ReceiptLineType.LEFTOVER,
    ReceiptLineType.UNUSED,
    ReceiptLineType.RETURN,
  ])
  type!: ReceiptLineType;
}

export class LaborProposalDto {
  @ApiProperty({ enum: LaborBasis }) @IsEnum(LaborBasis) basis!: LaborBasis;
  @ApiPropertyOptional({
    description: 'Si se omite se usa la tarifa vigente del taller/producto',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  rate?: number;
  @ApiProperty() @IsNumber() @IsPositive() quantity!: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class FinishedDeclarationDto {
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) units?: number;
  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  grams!: number;
  @ApiPropertyOptional() @IsOptional() @IsObject() technicalValues?: Record<
    string,
    string | number | boolean
  >;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) diameterMm?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) lengthMm?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  measures?: string;
  @ApiPropertyOptional({ type: [LeftoverDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LeftoverDto)
  leftovers?: LeftoverDto[];
  @ApiPropertyOptional({ type: LaborProposalDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LaborProposalDto)
  labor?: LaborProposalDto;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

// ---------------- Recepción ----------------
export class ReceiptLineDto {
  @ApiProperty({ enum: ReceiptLineType })
  @IsEnum(ReceiptLineType)
  lineType!: ReceiptLineType;
  @ApiPropertyOptional({
    description: 'Obligatorio para sobrante/no utilizado/devolución',
  })
  @ValidateIf(
    (o: ReceiptLineDto) => o.lineType !== ReceiptLineType.FINISHED_PRODUCT,
  )
  @IsUUID()
  materialId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() lotId?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) units?: number;
  @ApiProperty({ description: 'Pesaje de recepción (Balanza Madre)' })
  @IsUUID()
  weighingId!: string;
}

export class CreateReceiptDto {
  @ApiProperty({ enum: ReceiptType }) @IsEnum(ReceiptType) type!: ReceiptType;
  @ApiProperty({ type: [ReceiptLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReceiptLineDto)
  lines!: ReceiptLineDto[];
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
  @ApiPropertyOptional({
    description: 'Confirmar advertencias de plausibilidad',
  })
  @IsOptional()
  @IsBoolean()
  acknowledgeWarnings?: boolean;
}

export class ChecklistItemDto {
  @ApiProperty() @IsString() @MaxLength(120) item!: string;
  @ApiProperty() @IsBoolean() ok!: boolean;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class QualityCheckDto {
  @ApiProperty({ enum: [QualityResult.APPROVED, QualityResult.REJECTED] })
  @IsIn([QualityResult.APPROVED, QualityResult.REJECTED])
  result!: QualityResult;
  @ApiProperty({ type: [ChecklistItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChecklistItemDto)
  checklist!: ChecklistItemDto[];
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class PurityVerificationDto {
  @ApiProperty({ enum: PurityMethod })
  @IsEnum(PurityMethod)
  method!: PurityMethod;
  @ApiProperty({ example: 999.2, description: 'Valor obtenido en milésimas' })
  @IsNumber()
  @Min(0)
  @Max(1000)
  obtainedValue!: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  supportReference?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() supportMediaId?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() verifiedAt?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

// ---------------- Conciliación / diferencias / aprobación ----------------
export class CreateDiscrepancyDto {
  @ApiProperty({ enum: DiscrepancyType })
  @IsEnum(DiscrepancyType)
  type!: DiscrepancyType;
  @ApiPropertyOptional() @IsOptional() @IsUUID() materialId?: string;
  @ApiProperty({ description: 'Positivo = faltante; negativo = sobrante' })
  @IsNumber({ maxDecimalPlaces: 4 })
  grams!: number;
  @ApiProperty() @IsString() @MinLength(5) @MaxLength(1000) reason!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  responsibleParty?: string;
}

export class JustifyDiscrepancyDto {
  @ApiProperty()
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  justification!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  responsibleParty?: string;
}

export class ReviewDiscrepancyDto {
  @ApiProperty({
    enum: [DiscrepancyStatus.APPROVED, DiscrepancyStatus.REJECTED],
  })
  @IsIn([DiscrepancyStatus.APPROVED, DiscrepancyStatus.REJECTED])
  decision!: DiscrepancyStatus;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class DiscrepancyQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: DiscrepancyStatus })
  @IsOptional()
  @IsEnum(DiscrepancyStatus)
  status?: DiscrepancyStatus;
  @ApiPropertyOptional({ enum: DiscrepancyType })
  @IsOptional()
  @IsEnum(DiscrepancyType)
  type?: DiscrepancyType;
  @ApiPropertyOptional() @IsOptional() @IsUUID() orderId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() workshopId?: string;
}

export class LaborDecisionDto {
  @ApiProperty({ enum: ['APPROVE', 'REJECT'] })
  @IsIn(['APPROVE', 'REJECT'])
  decision!: 'APPROVE' | 'REJECT';
  @ApiPropertyOptional({
    description: 'Valor aprobado (por defecto el propuesto)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  approvedValue?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class ApproveOrderDto {
  @ApiPropertyOptional({ type: LaborDecisionDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LaborDecisionDto)
  labor?: LaborDecisionDto;
  @ApiPropertyOptional({
    description:
      'Crear nueva versión de ficha técnica con los datos de esta orden',
  })
  @IsOptional()
  @IsBoolean()
  updateTechnicalSheet?: boolean;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class LaborQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ApprovalStatus })
  @IsOptional()
  @IsEnum(ApprovalStatus)
  status?: ApprovalStatus;
  @ApiPropertyOptional() @IsOptional() @IsUUID() workshopId?: string;
}

export class FinishedGoodQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() productId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() orderId?: string;
}

export class ReceiveForReviewDto extends PickType(ApproveOrderDto, [
  'notes',
] as const) {}

import { ApiProperty, ApiPropertyOptional, PartialType, OmitType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { ContributionTiming, OperationStatus, OperationType } from '../../../common/enums/domain.enums';

export class CreateOperationDto {
  @ApiProperty() @IsUUID() customerId!: string;
  @ApiProperty({ enum: OperationType }) @IsEnum(OperationType) type!: OperationType;
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(200) description!: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) totalValue?: number;
  @ApiPropertyOptional({ description: 'Gramos finos que el cliente aportará' }) @IsOptional() @IsNumber() @Min(0) committedMaterialFineGrams?: number;
  @ApiPropertyOptional() @IsOptional() @IsUUID() productionOrderId?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dueDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class UpdateOperationDto extends PartialType(OmitType(CreateOperationDto, ['customerId'] as const)) {
  @ApiPropertyOptional({ enum: [OperationStatus.CLOSED, OperationStatus.CANCELLED, OperationStatus.OPEN] })
  @IsOptional() @IsEnum(OperationStatus) status?: OperationStatus;
}

export class OperationQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() customerId?: string;
  @ApiPropertyOptional({ enum: OperationStatus }) @IsOptional() @IsEnum(OperationStatus) status?: OperationStatus;
}

export class SaleLineDto {
  @ApiProperty() @IsUUID() finishedGoodId!: string;
  @ApiProperty() @IsInt() @Min(0) units!: number;
  @ApiPropertyOptional({ description: 'Gramos; por defecto proporcional a las unidades' }) @IsOptional() @IsNumber({ maxDecimalPlaces: 4 }) @IsPositive() grams?: number;
  @ApiProperty() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) value!: number;
  @ApiPropertyOptional({ description: 'Pesaje de salida' }) @IsOptional() @IsUUID() weighingId?: string;
}

export class CreateSaleDispatchDto {
  @ApiProperty() @IsUUID() operationId!: string;
  @ApiProperty() @IsDateString() dispatchDate!: string;
  @ApiProperty({ type: [SaleLineDto] }) @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => SaleLineDto) lines!: SaleLineDto[];
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class CreatePaymentDto {
  @ApiProperty() @IsUUID() customerId!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() operationId?: string;
  @ApiProperty() @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive() amount!: number;
  @ApiProperty() @IsUUID() paymentMethodId!: string;
  @ApiProperty() @IsDateString() paymentDate!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) reference?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class CreateContributionDto {
  @ApiProperty() @IsUUID() customerId!: string;
  @ApiProperty({ description: 'Operación asociada (obligatoria)' }) @IsUUID() operationId!: string;
  @ApiProperty() @IsUUID() materialId!: string;
  @ApiProperty({ description: 'Pesaje en Balanza Madre (CUSTOMER_MATERIAL)' }) @IsUUID() weighingId!: string;
  @ApiProperty({ example: 750, description: 'Ley declarada (milésimas)' }) @IsNumber() @Min(1) @Max(1000) declaredPurity!: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(1) @Max(1000) verifiedPurity?: number;
  @ApiProperty({ enum: ContributionTiming }) @IsEnum(ContributionTiming) timing!: ContributionTiming;
  @ApiProperty({ example: 'Joyas usadas del cliente' }) @IsString() @MinLength(3) @MaxLength(200) origin!: string;
  @ApiProperty() @IsDateString() contributionDate!: string;
  @ApiPropertyOptional({ description: 'Precio por gramo fino para valoración' }) @IsOptional() @IsNumber() @Min(0) pricePerGram?: number;
  @ApiPropertyOptional() @IsOptional() @IsUUID() productionOrderId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class ReverseDto {
  @ApiProperty() @IsString() @MinLength(5) @MaxLength(500) reason!: string;
}

export class CustomerScopedQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() customerId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() operationId?: string;
}

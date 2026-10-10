import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { LocationType, MovementType } from '../../../common/enums/domain.enums';

/** RF-001 / P03: entrada de material pesada en Balanza Madre. */
export class RegisterEntryDto {
  @ApiProperty() @IsUUID() materialId!: string;
  @ApiProperty({ description: 'Pesaje de entrada (Balanza Madre)' }) @IsUUID() weighingId!: string;
  @ApiProperty({ example: 'Compra proveedor Metales SAS' }) @IsString() @MinLength(2) @MaxLength(160) origin!: string;
  @ApiPropertyOptional({ example: 'FAC-1234' }) @IsOptional() @IsString() @MaxLength(120) reference?: string;
  @ApiPropertyOptional({ description: 'Ley en milésimas (si difiere del maestro)' }) @IsOptional() @IsNumber() @Min(0) @Max(1000) purity?: number;
  @ApiPropertyOptional({ description: 'Código de lote (se crea si no existe)' }) @IsOptional() @IsString() @MaxLength(40) lotCode?: string;
  @ApiPropertyOptional({ description: 'Costo por gramo de esta entrada' }) @IsOptional() @IsNumber() @Min(0) unitCost?: number;
  @ApiPropertyOptional({ description: 'RF-004: asociar a orden de producción' }) @IsOptional() @IsUUID() productionOrderId?: string;
  @ApiPropertyOptional({ description: 'RF-004: asociar a cliente' }) @IsOptional() @IsUUID() customerId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

export class TransferDto {
  @ApiProperty() @IsUUID() materialId!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() lotId?: string;
  @ApiProperty() @IsUUID() fromLocationId!: string;
  @ApiProperty() @IsUUID() toLocationId!: string;
  @ApiProperty() @IsNumber({ maxDecimalPlaces: 4 }) @IsPositive() grams!: number;
  @ApiPropertyOptional() @IsOptional() @IsUUID() weighingId?: string;
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(500) reason!: string;
}

export class AdjustmentDto {
  @ApiProperty() @IsUUID() materialId!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() lotId?: string;
  @ApiProperty() @IsUUID() locationId!: string;
  @ApiProperty({ enum: ['IN', 'OUT'] }) @IsIn(['IN', 'OUT']) direction!: 'IN' | 'OUT';
  @ApiProperty() @IsNumber({ maxDecimalPlaces: 4 }) @IsPositive() grams!: number;
  @ApiPropertyOptional() @IsOptional() @IsUUID() weighingId?: string;
  @ApiProperty() @IsString() @MinLength(5) @MaxLength(500) reason!: string;
}

export class ReverseDto {
  @ApiProperty() @IsString() @MinLength(5) @MaxLength(500) reason!: string;
}

export class BalanceQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() materialId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() locationId?: string;
  @ApiPropertyOptional({ enum: LocationType }) @IsOptional() @IsEnum(LocationType) locationType?: LocationType;
  @ApiPropertyOptional() @IsOptional() @IsUUID() workshopId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() categoryId?: string;
}

export class MovementQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() materialId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() locationId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() productionOrderId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() workshopId?: string;
  @ApiPropertyOptional({ enum: MovementType }) @IsOptional() @IsEnum(MovementType) type?: MovementType;
  @ApiPropertyOptional() @IsOptional() @IsDateString() from?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() to?: string;
}

export class KardexQueryDto {
  @ApiProperty() @IsUUID() materialId!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() locationId?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() from?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() to?: string;
}

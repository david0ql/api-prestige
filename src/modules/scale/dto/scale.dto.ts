import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import {
  WeighingPurpose,
  WeighingSource,
} from '../../../common/enums/domain.enums';

export class CaptureWeighingDto {
  @ApiProperty({ enum: WeighingPurpose })
  @IsEnum(WeighingPurpose)
  purpose!: WeighingPurpose;

  @ApiProperty({ enum: WeighingSource })
  @IsEnum(WeighingSource)
  source!: WeighingSource;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  materialId?: string;

  @ApiProperty({ example: 1000.25, description: 'Peso bruto en gramos' })
  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive({ message: 'El peso debe ser mayor que cero' })
  @Max(10_000_000)
  grossGrams!: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  tareGrams?: number;

  @ApiPropertyOptional({
    description:
      'Trama cruda leída de la balanza (obligatoria si source=SCALE)',
  })
  @ValidateIf((o: CaptureWeighingDto) => o.source === WeighingSource.SCALE)
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  rawReading?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceInfo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  stable?: boolean;

  @ApiPropertyOptional({ description: 'Obligatorio si source=MANUAL (RF-003)' })
  @ValidateIf((o: CaptureWeighingDto) => o.source === WeighingSource.MANUAL)
  @IsString()
  @MinLength(5, {
    message: 'Indique el motivo de la captura manual (mínimo 5 caracteres)',
  })
  @MaxLength(500)
  manualReason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class AdjustWeighingDto {
  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  newNetGrams!: number;

  @ApiProperty()
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason!: string;
}

export class WeighingQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: WeighingPurpose })
  @IsOptional()
  @IsEnum(WeighingPurpose)
  purpose?: WeighingPurpose;

  @ApiPropertyOptional({ enum: WeighingSource })
  @IsOptional()
  @IsEnum(WeighingSource)
  source?: WeighingSource;

  @ApiPropertyOptional({
    description: 'true = solo pesajes aún no usados en un documento',
  })
  @IsOptional()
  @IsString()
  unused?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { MediaKind, MediaPurpose } from '../../../common/enums/domain.enums';

/** Campos multipart que acompañan al archivo. */
export class UploadMediaDto {
  @ApiProperty({ enum: MediaPurpose })
  @IsEnum(MediaPurpose)
  purpose!: MediaPurpose;

  @ApiPropertyOptional() @IsOptional() @IsUUID() productionOrderId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() stageId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() productId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() progressReportId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() finishedDeclarationId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() receiptId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() technicalSheetId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  relatedType?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() relatedId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  caption?: string;
  @ApiPropertyOptional({
    description: 'Fecha de captura reportada por el dispositivo',
  })
  @IsOptional()
  @IsDateString()
  capturedAt?: string;
}

export class HideMediaDto {
  @ApiProperty() @IsString() @MinLength(5) @MaxLength(500) reason!: string;
}

export class MediaVisibilityDto {
  @ApiProperty() @IsBoolean() publicVisible!: boolean;
}

export class MediaQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() productionOrderId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() productId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() stageId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() technicalSheetId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  relatedType?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() relatedId?: string;
  @ApiPropertyOptional({ enum: MediaKind })
  @IsOptional()
  @IsEnum(MediaKind)
  kind?: MediaKind;
  @ApiPropertyOptional({ enum: MediaPurpose })
  @IsOptional()
  @IsEnum(MediaPurpose)
  purpose?: MediaPurpose;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeHidden?: boolean;
}

export class ContentQueryDto {
  @ApiPropertyOptional({ enum: ['original', 'web', 'thumb'] })
  @IsOptional()
  @IsString()
  variant?: 'original' | 'web' | 'thumb';
  @ApiProperty() @IsString() exp!: string;
  @ApiProperty() @IsString() sig!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() download?: string;
}

export class CreateShareDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() expiresAt?: string;
}

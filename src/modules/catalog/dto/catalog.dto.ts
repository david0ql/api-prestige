import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsObject, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateSheetDto {
  @ApiPropertyOptional({ description: 'Peso estándar por unidad (g)' }) @IsOptional() @IsNumber() @Min(0) standardWeight?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) weightTolerance?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) diameterMm?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) lengthMm?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) widthMm?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) thicknessMm?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) measures?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(1000) targetPurity?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(1000) purityTolerance?: number | null;
  @ApiPropertyOptional({ example: { CALIBRE: 1.2, CIERRE: 'Mosquetón' } }) @IsOptional() @IsObject() variables?: Record<string, string | number | boolean>;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) notes?: string | null;
  @ApiProperty({ example: 'Versión inicial' }) @IsString() @MinLength(3) @MaxLength(500) changeReason!: string;
}

export class SheetFromOrderDto {
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(500) changeReason!: string;
}

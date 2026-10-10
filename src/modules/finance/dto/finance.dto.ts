import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { CostType, TransactionType } from '../../../common/enums/domain.enums';

export class CreateTransactionDto {
  @ApiProperty({ enum: TransactionType })
  @IsEnum(TransactionType)
  type!: TransactionType;
  @ApiProperty() @IsUUID() categoryId!: string;
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(200) concept!: string;
  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount!: number;
  @ApiProperty() @IsDateString() transactionDate!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  thirdPartyName?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() customerId?: string;
  @ApiPropertyOptional({ description: 'Pagos a talleres' })
  @IsOptional()
  @IsUUID()
  workshopId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() productionOrderId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() paymentMethodId?: string;
  @ApiPropertyOptional({ description: 'Soporte/referencia (RN-020)' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  supportReference?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class ReverseTransactionDto {
  @ApiProperty() @IsString() @MinLength(5) @MaxLength(500) reason!: string;
}

export class TransactionQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: TransactionType })
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;
  @ApiPropertyOptional() @IsOptional() @IsUUID() categoryId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() workshopId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() customerId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() paymentMethodId?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() from?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() to?: string;
}

export class CostQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: CostType })
  @IsOptional()
  @IsEnum(CostType)
  type?: CostType;
  @ApiPropertyOptional() @IsOptional() @IsUUID() workshopId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() orderId?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() from?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() to?: string;
}

export class PeriodQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsDateString() from?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() to?: string;
}

export class ClosePeriodDto {
  @ApiProperty({ example: '2026-09' })
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  period!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

import { startOfDay, endOfDay } from '../../common/utils/dates';
import { Controller, Get, Query } from '@nestjs/common';
import { ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Between, FindOptionsWhere, ILike, Repository } from 'typeorm';
import { PaginationQueryDto, paginated } from '../../common/dto/pagination.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuditAction } from '../../common/enums/domain.enums';
import { Permission } from '../../common/enums/permission.enum';
import { AuditLog } from './entities/audit-log.entity';

export class AuditQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: AuditAction })
  @IsOptional()
  @IsEnum(AuditAction)
  action?: AuditAction;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  entityType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  entityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;
}

export function auditWhere(
  q: AuditQueryDto,
): FindOptionsWhere<AuditLog> | FindOptionsWhere<AuditLog>[] {
  const where: FindOptionsWhere<AuditLog> = {};
  if (q.action) where.action = q.action;
  if (q.entityType) where.entityType = q.entityType;
  if (q.entityId) where.entityId = q.entityId;
  if (q.userId) where.userId = q.userId;
  if (q.from || q.to) {
    where.createdAt = Between(
      q.from ? startOfDay(q.from) : new Date(0),
      q.to ? endOfDay(q.to) : new Date(),
    );
  }
  if (q.search) {
    return [
      { ...where, username: ILike(`%${q.search}%`) },
      { ...where, description: ILike(`%${q.search}%`) },
    ];
  }
  return where;
}

/** Consulta de la bitácora (RF-036, reporte de auditoría). Solo lectura. */
@ApiTags('Auditoría')
@Controller('audit')
export class AuditController {
  constructor(
    @InjectRepository(AuditLog) private readonly repo: Repository<AuditLog>,
  ) {}

  @Get()
  @RequirePermissions(Permission.AUDIT_READ)
  async list(@Query() q: AuditQueryDto) {
    return paginated(
      await this.repo.findAndCount({
        where: auditWhere(q),
        order: { createdAt: 'DESC' },
        skip: q.skip,
        take: q.pageSize,
      }),
      q,
    );
  }
}

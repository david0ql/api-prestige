import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { AlertSeverity, AlertStatus, AlertType } from '../../common/enums/domain.enums';
import { Permission as P } from '../../common/enums/permission.enum';
import type { AuthUser } from '../../common/types/auth-user';
import { AlertsService } from './alerts.service';

class AlertListQuery extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: AlertStatus }) @IsOptional() @IsEnum(AlertStatus) status?: AlertStatus;
  @ApiPropertyOptional({ enum: AlertType }) @IsOptional() @IsEnum(AlertType) type?: AlertType;
  @ApiPropertyOptional({ enum: AlertSeverity }) @IsOptional() @IsEnum(AlertSeverity) severity?: AlertSeverity;
}

class ResolveDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

@ApiTags('Alertas')
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get()
  @RequirePermissions(P.ALERTS_READ)
  list(@Query() q: AlertListQuery, @CurrentUser() user: AuthUser) {
    return this.alerts.list(q, user);
  }

  @Get('counts')
  @RequirePermissions(P.ALERTS_READ)
  counts(@CurrentUser() user: AuthUser) {
    return this.alerts.counts(user);
  }

  @Post('run-checks')
  @RequirePermissions(P.ALERTS_MANAGE)
  run() {
    return this.alerts.runChecks();
  }

  @Post(':id/acknowledge')
  @RequirePermissions(P.ALERTS_READ)
  ack(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.alerts.setStatus(id, AlertStatus.ACKNOWLEDGED, user);
  }

  @Post(':id/resolve')
  @RequirePermissions(P.ALERTS_MANAGE)
  resolve(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ResolveDto, @CurrentUser() user: AuthUser) {
    return this.alerts.setStatus(id, AlertStatus.RESOLVED, user, dto.notes);
  }
}

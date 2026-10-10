import { Controller, ForbiddenException, Get, Param, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuditAction } from '../../common/enums/domain.enums';
import { Permission as P } from '../../common/enums/permission.enum';
import type { AuthUser } from '../../common/types/auth-user';
import { AuditService } from '../audit/audit.service';
import { ReportExportService } from './report-export.service';
import { ReportsService } from './reports.service';

class ReportQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsDateString() from?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() to?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() workshopId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() productId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() materialId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() customerId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() locationId?: string;
  @ApiPropertyOptional({ enum: ['month', 'product', 'customer', 'workshop'] }) @IsOptional() @IsIn(['month', 'product', 'customer', 'workshop']) groupBy?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) entityType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) action?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() userId?: string;
  @ApiPropertyOptional({ enum: ['xlsx', 'csv'] }) @IsOptional() @IsIn(['xlsx', 'csv']) format?: 'xlsx' | 'csv';
}

@ApiTags('Reportes e indicadores')
@Controller()
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly exporter: ReportExportService,
    private readonly audit: AuditService,
  ) {}

  private authorize(key: string, user: AuthUser) {
    const meta = this.reports.catalog[key];
    if (!meta) return;
    if (meta.financial && !user.permissions.includes(P.REPORTS_FINANCIAL)) throw new ForbiddenException('Reporte financiero: permiso requerido');
    if (meta.audit && !user.permissions.includes(P.AUDIT_READ)) throw new ForbiddenException('Reporte de auditoría: permiso requerido');
  }

  @Get('dashboard/office')
  @RequirePermissions(P.DASHBOARD_OFFICE)
  @ApiOperation({ summary: 'P02 / RF-033 · Dashboard Oficina Madre' })
  async dashboard(@CurrentUser() user: AuthUser) {
    const data = await this.reports.officeDashboard(user);
    // Sin permiso financiero no se exponen ventas/costos/utilidad.
    if (!user.permissions.includes(P.REPORTS_FINANCIAL)) {
      data.kpis.salesThisMonth = null as never;
      data.kpis.costsThisMonth = null as never;
      data.kpis.profitThisMonth = null as never;
      data.charts.monthlyProfitability = [];
    }
    return data;
  }

  @Get('reports')
  @RequirePermissions(P.REPORTS_READ)
  list(@CurrentUser() user: AuthUser) {
    return Object.entries(this.reports.catalog)
      .filter(([, m]) => (!m.financial || user.permissions.includes(P.REPORTS_FINANCIAL)) && (!m.audit || user.permissions.includes(P.AUDIT_READ)))
      .map(([key, m]) => ({ key, ...m }));
  }

  @Get('reports/:key')
  @RequirePermissions(P.REPORTS_READ)
  run(@Param('key') key: string, @Query() q: ReportQueryDto, @CurrentUser() user: AuthUser) {
    this.authorize(key, user);
    return this.reports.run(key, { ...q }, user);
  }

  @Get('reports/:key/export')
  @RequirePermissions(P.REPORTS_READ, P.REPORTS_EXPORT)
  @ApiOperation({ summary: 'RF-040 · Exportar reporte a Excel (.xlsx) o CSV' })
  async export(@Param('key') key: string, @Query() q: ReportQueryDto, @CurrentUser() user: AuthUser, @Res() res: Response) {
    this.authorize(key, user);
    const report = await this.reports.run(key, { ...q }, user);
    const format = q.format ?? 'xlsx';
    const filename = `prestige-${key}-${new Date().toISOString().slice(0, 10)}.${format}`;
    await this.audit.log({ action: AuditAction.EXPORT, entityType: 'Report', entityId: null, description: `Exportación ${key} (${format})` });
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    if (format === 'csv') {
      res.type('text/csv; charset=utf-8').send(this.exporter.toCsv(report));
    } else {
      res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').send(await this.exporter.toXlsx(report));
    }
  }
}

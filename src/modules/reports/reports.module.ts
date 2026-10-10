import { Module } from '@nestjs/common';
import { ReportExportService } from './report-export.service';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({ controllers: [ReportsController], providers: [ReportsService, ReportExportService], exports: [ReportsService] })
export class ReportsModule {}

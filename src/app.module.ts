import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClsModule } from 'nestjs-cls';
import type { Request } from 'express';
import configuration, { AppConfig } from './config/configuration';
import { validateEnv } from './config/env.validation';
import { buildTypeOrmOptions } from './database/typeorm.options';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { AuditModule } from './modules/audit/audit.module';
import { AuditAccessInterceptor } from './modules/audit/audit-access.interceptor';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/jwt-auth.guard';
import { HealthModule } from './modules/health/health.module';
import { SetupModule } from './modules/setup/setup.module';
import { MailModule } from './modules/mail/mail.module';
import { SequencesModule } from './modules/sequences/sequences.module';
import { UsersModule } from './modules/users/users.module';
import { MastersModule } from './modules/masters/masters.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { ScaleModule } from './modules/scale/scale.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { MediaModule } from './modules/media/media.module';
import { ProductionModule } from './modules/production/production.module';
import { SalesModule } from './modules/sales/sales.module';
import { FinanceModule } from './modules/finance/finance.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { ReportsModule } from './modules/reports/reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
      cache: true,
    }),
    // Contexto por request (usuario, IP) para auditoría transversal.
    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: true,
        setup: (cls, req: Request) => {
          cls.set('ip', req.ip);
          cls.set('userAgent', req.headers['user-agent']);
          cls.set('path', `${req.method} ${req.originalUrl}`);
        },
      },
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) =>
        buildTypeOrmOptions(config.get('database', { infer: true })),
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => [
        {
          ttl: config.get('throttle', { infer: true }).ttlSec * 1000,
          limit: config.get('throttle', { infer: true }).limit,
        },
      ],
    }),
    EventEmitterModule.forRoot({ wildcard: false }),
    ScheduleModule.forRoot(),
    MailModule,
    SequencesModule,
    AuditModule,
    AuthModule,
    UsersModule,
    MastersModule,
    CatalogModule,
    ScaleModule,
    InventoryModule,
    MediaModule,
    ProductionModule,
    SalesModule,
    FinanceModule,
    AlertsModule,
    ReportsModule,
    HealthModule,
    SetupModule,
  ],
  providers: [
    // Orden: rate limit → autenticación → autorización por permisos.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditAccessInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}

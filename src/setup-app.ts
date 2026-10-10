import { ClassSerializerInterceptor, INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

/**
 * Configuración HTTP compartida entre main.ts y las pruebas e2e (así las pruebas
 * ejercitan exactamente la misma seguridad que producción).
 */
export function setupApp(app: INestApplication): void {
  const config = app.get(ConfigService);
  const isProd = config.get<string>('nodeEnv') === 'production';
  const express = app as NestExpressApplication;

  if (config.get<boolean>('security.trustProxy')) express.set('trust proxy', 1);
  express.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: { 'img-src': ["'self'", 'data:'], 'media-src': ["'self'"] },
      },
      crossOriginResourcePolicy: { policy: 'same-site' },
      referrerPolicy: { policy: 'no-referrer' },
      hsts: isProd ? { maxAge: 15_552_000, includeSubDomains: true } : false,
    }),
  );
  app.use(cookieParser());
  app.enableCors({
    origin: config.get<string[]>('corsOrigin'),
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Disposition'],
    maxAge: 600,
  });
  app.setGlobalPrefix(config.get<string>('apiPrefix', 'api'));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  // Respeta @Exclude() (p. ej. passwordHash nunca sale en respuestas).
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
  app.enableShutdownHooks();
}

import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { setupApp } from './setup-app';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: false,
  });
  setupApp(app);
  // RNF-006: cierre ordenado (SIGTERM) — termina peticiones en curso y libera el pool de la BD.
  app.enableShutdownHooks();
  const config = app.get(ConfigService);

  if (config.get<boolean>('security.swaggerEnabled')) {
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Prestige Gold API')
        .setDescription(
          'Sistema Integral de Control de Materiales, Talleres, Producción y Finanzas (Especificación v1.1)',
        )
        .setVersion('1.1')
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('docs', app, doc, { jsonDocumentUrl: 'docs/json' });
  }

  const port = config.get<number>('port', 3300);
  await app.listen(port);
  new Logger('Bootstrap').log(
    `API en http://localhost:${port}/${config.get('apiPrefix')} · docs en /docs`,
  );
}

void bootstrap();

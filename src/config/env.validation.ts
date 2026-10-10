import { plainToInstance } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
  validateSync,
} from 'class-validator';

/** Variables obligatorias. Si alguna falta o es débil, la API no arranca. */
class EnvVars {
  @IsOptional()
  @IsIn(['development', 'production', 'test'])
  NODE_ENV?: string;

  @IsString()
  DATABASE_HOST!: string;

  @IsOptional()
  @IsInt()
  DATABASE_PORT?: number;

  @IsString()
  DATABASE_USER!: string;

  @IsString()
  DATABASE_PASSWORD!: string;

  @IsString()
  @MinLength(32, { message: 'JWT_ACCESS_SECRET debe tener al menos 32 caracteres' })
  JWT_ACCESS_SECRET!: string;

  @IsString()
  @MinLength(32, { message: 'MEDIA_SIGNING_SECRET debe tener al menos 32 caracteres' })
  MEDIA_SIGNING_SECRET!: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const parsed = plainToInstance(EnvVars, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(parsed, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(
      'Configuración inválida: ' +
        errors.map((e) => Object.values(e.constraints ?? {}).join(', ')).join('; '),
    );
  }
  return config;
}

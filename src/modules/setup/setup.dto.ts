import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class SeedDto {
  @ApiPropertyOptional({
    description:
      'Incluir datos de demostración (4 talleres, órdenes, ventas). Solo fuera de producción o con SETUP_ALLOW_DEMO=true.',
  })
  @IsOptional()
  @IsBoolean()
  demo?: boolean;
}

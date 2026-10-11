import { Body, Controller, Get, Headers, HttpCode, Post } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { SeedDto } from './setup.dto';
import { SetupService } from './setup.service';

@ApiTags('Instalación')
@Controller('setup')
export class SetupController {
  constructor(private readonly setup: SetupService) {}

  @Public()
  @Get('status')
  @ApiOperation({
    summary: '¿La base ya tiene datos? ¿Está habilitada la carga inicial?',
  })
  status() {
    return this.setup.status();
  }

  @Public()
  @Post('seed')
  @HttpCode(201)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiHeader({
    name: 'X-Setup-Token',
    required: true,
    description: 'Valor de SETUP_TOKEN',
  })
  @ApiOperation({
    summary:
      'Carga inicial (roles, maestros, administrador). Solo si la base está vacía; si ya hay datos responde 409.',
  })
  seed(
    @Headers('x-setup-token') token: string | undefined,
    @Body() dto: SeedDto,
  ) {
    return this.setup.seed(token, dto.demo ?? false);
  }
}

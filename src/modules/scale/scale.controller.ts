import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireAnyPermission, RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission as P } from '../../common/enums/permission.enum';
import type { AuthUser } from '../../common/types/auth-user';
import { ParametersService, PARAM } from '../masters/parameters.service';
import { AdjustWeighingDto, CaptureWeighingDto, WeighingQueryDto } from './dto/scale.dto';
import { ScaleService } from './scale.service';

@ApiTags('Balanza Madre')
@Controller('weighings')
export class ScaleController {
  constructor(
    private readonly scale: ScaleService,
    private readonly params: ParametersService,
  ) {}

  @Get('config')
  @RequirePermissions(P.SCALE_WEIGH)
  @ApiOperation({ summary: 'Configuración de la balanza (Web Serial: baudios, paridad…)' })
  config() {
    return this.params.get(PARAM.SCALE_CONFIG, { baudRate: 9600, dataBits: 8, stopBits: 1, parity: 'none' });
  }

  @Post()
  @RequirePermissions(P.SCALE_WEIGH)
  @ApiOperation({ summary: 'RF-002/003 · Capturar pesaje (balanza o manual autorizado)' })
  capture(@Body() dto: CaptureWeighingDto, @CurrentUser() user: AuthUser) {
    return this.scale.capture(dto, user);
  }

  @Get()
  @RequireAnyPermission(P.SCALE_WEIGH, P.INVENTORY_READ)
  list(@Query() q: WeighingQueryDto) {
    return this.scale.list(q);
  }

  @Get(':id')
  @RequireAnyPermission(P.SCALE_WEIGH, P.INVENTORY_READ)
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.scale.get(id);
  }

  @Post(':id/adjust')
  @RequirePermissions(P.SCALE_ADJUST)
  @ApiOperation({ summary: 'RN-019 · Ajuste trazable de pesaje no utilizado' })
  adjust(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AdjustWeighingDto, @CurrentUser() user: AuthUser) {
    return this.scale.adjust(id, dto, user);
  }
}

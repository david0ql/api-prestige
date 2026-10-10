import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { Permission as P } from '../../common/enums/permission.enum';
import type { AuthUser } from '../../common/types/auth-user';
import { CatalogService } from './catalog.service';
import { CreateSheetDto, SheetFromOrderDto } from './dto/catalog.dto';

@ApiTags('Catálogo técnico')
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('products')
  @RequirePermissions(P.CATALOG_READ)
  @ApiOperation({ summary: 'P19 · Catálogo técnico de modelos' })
  list(@Query() q: PaginationQueryDto) {
    return this.catalog.list(q.search);
  }

  @Get('products/:id')
  @RequirePermissions(P.CATALOG_READ)
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.detail(id);
  }

  @Post('products/:id/sheets')
  @RequirePermissions(P.CATALOG_MANAGE)
  @ApiOperation({ summary: 'RF-042 / RN-023 · Nueva versión de ficha técnica' })
  createVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateSheetDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.catalog.createVersion(id, dto, user);
  }

  @Post('products/:id/sheets/from-order/:orderId')
  @RequirePermissions(P.CATALOG_MANAGE)
  @ApiOperation({
    summary: 'CA-005 · Alimentar ficha técnica desde orden terminada',
  })
  fromOrder(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: SheetFromOrderDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.catalog.createFromOrder(id, orderId, dto.changeReason, user);
  }

  @Get('sheets/:id')
  @RequirePermissions(P.CATALOG_READ)
  sheet(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.getSheet(id);
  }
}

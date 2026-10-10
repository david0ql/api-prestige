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
import { AuditAccess } from '../../common/decorators/audit-access.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission as P } from '../../common/enums/permission.enum';
import type { AuthUser } from '../../common/types/auth-user';
import {
  ClosePeriodDto,
  CostQueryDto,
  CreateTransactionDto,
  PeriodQueryDto,
  ReverseTransactionDto,
  TransactionQueryDto,
} from './dto/finance.dto';
import { FinanceService } from './finance.service';

@ApiTags('Caja / Finanzas')
@Controller('finance')
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Post('transactions')
  @RequirePermissions(P.FINANCE_MANAGE)
  @ApiOperation({ summary: 'RF-028 · Registrar ingreso/egreso con soporte' })
  create(@Body() dto: CreateTransactionDto, @CurrentUser() user: AuthUser) {
    return this.finance.create(dto, user);
  }

  @Get('transactions')
  @RequirePermissions(P.FINANCE_READ)
  @AuditAccess('FinancialTransaction')
  list(@Query() q: TransactionQueryDto) {
    return this.finance.list(q);
  }

  @Get('transactions/:id')
  @RequirePermissions(P.FINANCE_READ)
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.finance.get(id);
  }

  @Post('transactions/:id/reverse')
  @RequirePermissions(P.FINANCE_MANAGE, P.REVERSALS_AUTHORIZE)
  reverse(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReverseTransactionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.finance.reverse(id, dto.reason, user);
  }

  @Get('summary')
  @RequirePermissions(P.FINANCE_READ)
  summary(@Query() q: PeriodQueryDto) {
    return this.finance.summary(q);
  }

  @Get('costs')
  @RequirePermissions(P.FINANCE_READ)
  costs(@Query() q: CostQueryDto) {
    return this.finance.listCosts(q);
  }

  @Get('workshop-payables')
  @RequirePermissions(P.FINANCE_READ)
  @ApiOperation({
    summary: 'Pagos a talleres: mano de obra aprobada vs pagada',
  })
  payables() {
    return this.finance.workshopPayables();
  }

  @Get('period-closes')
  @RequirePermissions(P.FINANCE_READ)
  closes() {
    return this.finance.listCloses();
  }

  @Post('period-closes')
  @RequirePermissions(P.FINANCE_CLOSE)
  close(@Body() dto: ClosePeriodDto, @CurrentUser() user: AuthUser) {
    return this.finance.closePeriod(dto, user);
  }
}

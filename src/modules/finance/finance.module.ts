import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CostEntry } from './entities/cost-entry.entity';
import { FinancialTransaction } from './entities/financial-transaction.entity';
import { PeriodClose } from './entities/period-close.entity';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([FinancialTransaction, CostEntry, PeriodClose]),
  ],
  controllers: [FinanceController],
  providers: [FinanceService],
  exports: [FinanceService],
})
export class FinanceModule {}

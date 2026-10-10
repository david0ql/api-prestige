import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinishedGood } from '../production/entities/finished-good.entity';
import { CustomerMaterialContribution } from './entities/customer-material-contribution.entity';
import { CustomerOperation } from './entities/customer-operation.entity';
import { CustomerPayment } from './entities/customer-payment.entity';
import { SaleDispatch } from './entities/sale-dispatch.entity';
import { SaleDispatchLine } from './entities/sale-dispatch-line.entity';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([CustomerOperation, SaleDispatch, SaleDispatchLine, CustomerPayment, CustomerMaterialContribution, FinishedGood])],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}

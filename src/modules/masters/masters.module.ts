import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConsumptionStandard } from './entities/consumption-standard.entity';
import { Customer } from './entities/customer.entity';
import { FinanceCategory } from './entities/finance-category.entity';
import { LaborRate } from './entities/labor-rate.entity';
import { Location } from './entities/location.entity';
import { Material } from './entities/material.entity';
import { MaterialCategory } from './entities/material-category.entity';
import { PaymentMethod } from './entities/payment-method.entity';
import { Product } from './entities/product.entity';
import { ProductFamily } from './entities/product-family.entity';
import { ProductVariant } from './entities/product-variant.entity';
import { ProductWorkshop } from './entities/product-workshop.entity';
import { ProductionStage } from './entities/production-stage.entity';
import { SystemParameter } from './entities/system-parameter.entity';
import { TechnicalVariable } from './entities/technical-variable.entity';
import { Unit } from './entities/unit.entity';
import { Workshop } from './entities/workshop.entity';
import { MastersController } from './masters.controller';
import { MastersService } from './masters.service';
import { ParametersService } from './parameters.service';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Unit,
      MaterialCategory,
      Material,
      Workshop,
      Location,
      Customer,
      ProductFamily,
      Product,
      ProductVariant,
      ProductWorkshop,
      ConsumptionStandard,
      LaborRate,
      ProductionStage,
      TechnicalVariable,
      SystemParameter,
      PaymentMethod,
      FinanceCategory,
    ]),
  ],
  controllers: [MastersController],
  providers: [MastersService, ParametersService],
  exports: [MastersService, ParametersService, TypeOrmModule],
})
export class MastersModule {}

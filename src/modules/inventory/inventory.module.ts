import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderMaterialRequirement } from '../production/entities/order-material-requirement.entity';
import { Location } from '../masters/entities/location.entity';
import { InventoryBalance } from './entities/inventory-balance.entity';
import { InventoryMovement } from './entities/inventory-movement.entity';
import { MaterialLot } from './entities/material-lot.entity';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([InventoryMovement, InventoryBalance, MaterialLot, Location, OrderMaterialRequirement])],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}

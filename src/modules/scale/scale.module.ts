import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WeighingAdjustment } from './entities/weighing-adjustment.entity';
import { Weighing } from './entities/weighing.entity';
import { ScaleController } from './scale.controller';
import { ScaleService } from './scale.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Weighing, WeighingAdjustment])],
  controllers: [ScaleController],
  providers: [ScaleService],
  exports: [ScaleService],
})
export class ScaleModule {}

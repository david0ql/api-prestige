import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MediaFile } from '../media/entities/media-file.entity';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { TechnicalSheet } from './entities/technical-sheet.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([TechnicalSheet, MediaFile])],
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}

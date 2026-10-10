import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductionStage } from '../masters/entities/production-stage.entity';
import { ProductionOrder } from '../production/entities/production-order.entity';
import { MediaFile } from './entities/media-file.entity';
import { StoryShare } from './entities/story-share.entity';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { MediaStorageService } from './media-storage.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([MediaFile, StoryShare, ProductionOrder, ProductionStage])],
  controllers: [MediaController],
  providers: [MediaService, MediaStorageService],
  exports: [MediaService, MediaStorageService],
})
export class MediaModule {}

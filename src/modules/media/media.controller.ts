import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadCleanupInterceptor } from './upload-cleanup.interceptor';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { diskStorage } from 'multer';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../../common/decorators/permissions.decorator';
import { Permission as P } from '../../common/enums/permission.enum';
import type { AuthUser } from '../../common/types/auth-user';
import configuration from '../../config/configuration';
import {
  ContentQueryDto,
  CreateShareDto,
  HideMediaDto,
  MediaQueryDto,
  MediaVisibilityDto,
  UploadMediaDto,
} from './dto/media.dto';
import { MediaService } from './media.service';
import { MediaStorageService } from './media-storage.service';

const cfg = configuration();

@ApiTags('Evidencias multimedia')
@Controller()
export class MediaController {
  constructor(
    private readonly media: MediaService,
    private readonly storage: MediaStorageService,
  ) {}

  @Post('media')
  @RequirePermissions(P.MEDIA_UPLOAD)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({
    summary: 'RF-014 · Cargar foto/video/documento de evidencia',
  })
  @UseInterceptors(
    FileInterceptor('file', {
      // A disco (no memoria): los videos pueden pesar cientos de MB.
      storage: diskStorage({
        // Se asegura el directorio en cada carga (resiste limpiezas del almacenamiento en caliente).
        destination: (_req, _file, cb) => {
          const dir = resolve(cfg.media.storageDir, 'tmp');
          mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (_req, _file, cb) => cb(null, randomUUID()),
      }),
      limits: {
        fileSize:
          Math.max(cfg.media.maxVideoMb, cfg.media.maxPhotoMb) * 1024 * 1024,
        files: 1,
        fields: 20,
      },
    }),
    UploadCleanupInterceptor,
  )
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadMediaDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.media.upload(file, dto, user);
  }

  @Get('media')
  @RequireAnyPermission(P.MEDIA_READ, P.CATALOG_READ)
  list(@Query() q: MediaQueryDto, @CurrentUser() user: AuthUser) {
    return this.media.list(q, user);
  }

  @Get('media/:id')
  @RequireAnyPermission(P.MEDIA_READ, P.CATALOG_READ)
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.media.get(id, user);
  }

  /**
   * Contenido binario con URL firmada (HMAC + expiración). Público a nivel JWT
   * porque <img>/<video> no envían Authorization; la firma es la autorización.
   * res.sendFile soporta Range → los videos se pueden adelantar/reproducir en móvil.
   */
  @Public()
  @SkipThrottle()
  @Get('media/:id/content')
  async content(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() q: ContentQueryDto,
    @Res() res: Response,
  ) {
    const variant = q.variant ?? 'original';
    if (!this.storage.verify(id, variant, q.exp, q.sig))
      throw new ForbiddenException('Enlace inválido o vencido');
    const file = await this.media.resolveContent(id, variant);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; img-src 'self'; media-src 'self'",
    );
    if (q.download === '1') res.attachment(file.name);
    res.type(file.mime);
    res.sendFile(file.path, { acceptRanges: true, dotfiles: 'deny' });
  }

  @Post('media/:id/hide')
  @RequireAnyPermission(P.MEDIA_MODERATE, P.WORKSHOP_PORTAL)
  @ApiOperation({ summary: 'RN-024 · Ocultar evidencia (nunca se elimina)' })
  hide(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: HideMediaDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.media.hide(id, dto.reason, user);
  }

  @Post('media/:id/unhide')
  @RequirePermissions(P.MEDIA_MODERATE)
  unhide(@Param('id', ParseUUIDPipe) id: string) {
    return this.media.unhide(id);
  }

  @Patch('media/:id/visibility')
  @RequirePermissions(P.MEDIA_MODERATE)
  visibility(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MediaVisibilityDto,
  ) {
    return this.media.setPublic(id, dto.publicVisible);
  }

  @Get('orders/:id/story')
  @RequireAnyPermission(P.MEDIA_READ, P.ORDERS_READ)
  @ApiOperation({
    summary: 'RF-041 / P20 · Historia visual (mosaico) de la orden por etapas',
  })
  story(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.media.story(id, user);
  }

  @Post('orders/:id/story/shares')
  @RequirePermissions(P.MEDIA_MODERATE)
  @ApiOperation({
    summary: 'Crear enlace público de la historia (consumidor final)',
  })
  share(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateShareDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.media.createShare(id, dto, user);
  }

  @Get('orders/:id/story/shares')
  @RequirePermissions(P.MEDIA_MODERATE)
  shares(@Param('id', ParseUUIDPipe) id: string) {
    return this.media.listShares(id);
  }

  @Delete('story-shares/:shareId')
  @HttpCode(204)
  @RequirePermissions(P.MEDIA_MODERATE)
  revoke(@Param('shareId', ParseUUIDPipe) id: string) {
    return this.media.revokeShare(id);
  }

  @Public()
  @Get('public/stories/:token')
  @ApiOperation({
    summary: 'Historia pública de la prenda (sin datos internos)',
  })
  publicStory(@Param('token') token: string) {
    return this.media.publicStory(token);
  }
}

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { unlink } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { DataSource, FindOptionsWhere, In, IsNull, Repository } from 'typeorm';
import { paginated } from '../../common/dto/pagination.dto';
import {
  AuditAction,
  MediaKind,
  MediaPurpose,
  OrderStatus,
} from '../../common/enums/domain.enums';
import { Permission } from '../../common/enums/permission.enum';
import type { AuthUser } from '../../common/types/auth-user';
import { BusinessRuleException } from '../../common/utils/business-error';
import { assertWorkshopAccess } from '../../common/utils/scope';
import { AuditService } from '../audit/audit.service';
import { MastersService } from '../masters/masters.service';
import { ProductionStage } from '../masters/entities/production-stage.entity';
import { ProductionOrder } from '../production/entities/production-order.entity';
import { CreateShareDto, MediaQueryDto, UploadMediaDto } from './dto/media.dto';
import { MediaFile } from './entities/media-file.entity';
import { StoryShare } from './entities/story-share.entity';
import { MediaStorageService } from './media-storage.service';

// file-type@16 es CommonJS y detecta el tipo REAL por la firma binaria (magic bytes).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const FileType = require('file-type') as {
  fromFile: (p: string) => Promise<{ ext: string; mime: string } | undefined>;
};

const PHOTO_MIMES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/avif',
];
const VIDEO_MIMES = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-m4v',
  'video/3gpp',
];
const DOC_MIMES = ['application/pdf'];

export const CLOSED_ORDER_STATUSES = [
  OrderStatus.APPROVED_CLOSED,
  OrderStatus.CANCELLED,
];

@Injectable()
export class MediaService {
  private readonly prefix: string;
  private readonly maxPhoto: number;
  private readonly maxVideo: number;

  constructor(
    private readonly ds: DataSource,
    @InjectRepository(MediaFile) private readonly media: Repository<MediaFile>,
    @InjectRepository(StoryShare)
    private readonly shares: Repository<StoryShare>,
    @InjectRepository(ProductionOrder)
    private readonly orders: Repository<ProductionOrder>,
    @InjectRepository(ProductionStage)
    private readonly stages: Repository<ProductionStage>,
    private readonly storage: MediaStorageService,
    private readonly audit: AuditService,
    private readonly masters: MastersService,
    config: ConfigService,
  ) {
    this.prefix = config.get<string>('apiPrefix', 'api');
    this.maxPhoto = config.get<number>('media.maxPhotoMb', 25) * 1024 * 1024;
    this.maxVideo = config.get<number>('media.maxVideoMb', 300) * 1024 * 1024;
  }

  /** Respuesta con URLs firmadas temporales. */
  toDto(m: MediaFile) {
    const has = (p: string | null) => !!p;
    return {
      ...m,
      urls: {
        original: this.storage.signedUrl(this.prefix, m.id, 'original'),
        web: has(m.webPath)
          ? this.storage.signedUrl(this.prefix, m.id, 'web')
          : this.storage.signedUrl(this.prefix, m.id, 'original'),
        thumb: has(m.thumbPath)
          ? this.storage.signedUrl(this.prefix, m.id, 'thumb')
          : null,
      },
    };
  }

  async upload(
    file: Express.Multer.File | undefined,
    dto: UploadMediaDto,
    user: AuthUser,
  ) {
    if (!file) throw new BadRequestException('Debe adjuntar un archivo');
    const tmp = file.path;
    try {
      const detected = await FileType.fromFile(tmp);
      if (!detected)
        throw new BadRequestException('Tipo de archivo no reconocido');
      const kind = PHOTO_MIMES.includes(detected.mime)
        ? MediaKind.PHOTO
        : VIDEO_MIMES.includes(detected.mime)
          ? MediaKind.VIDEO
          : DOC_MIMES.includes(detected.mime)
            ? MediaKind.DOCUMENT
            : null;
      if (!kind)
        throw new BadRequestException(
          `Formato no permitido (${detected.mime}). Use JPG/PNG/WEBP/HEIC, MP4/MOV/WEBM o PDF`,
        );
      if (kind === MediaKind.PHOTO && file.size > this.maxPhoto)
        throw new BadRequestException('La foto supera el tamaño máximo');
      if (kind === MediaKind.VIDEO && file.size > this.maxVideo)
        throw new BadRequestException('El video supera el tamaño máximo');
      if (kind === MediaKind.DOCUMENT && file.size > this.maxPhoto)
        throw new BadRequestException('El documento supera el tamaño máximo');

      // Contexto: orden/etapa/producto y aislamiento por taller.
      let workshopId: string | null = null;
      let productId: string | null = dto.productId ?? null;
      if (dto.productionOrderId) {
        const order = await this.orders.findOne({
          where: { id: dto.productionOrderId },
        });
        if (!order) throw new BadRequestException('Orden inexistente');
        assertWorkshopAccess(user, order.workshopId);
        if (user.workshopId && CLOSED_ORDER_STATUSES.includes(order.status)) {
          throw new BusinessRuleException(
            'ORDER_CLOSED',
            'La orden está cerrada: no admite nuevas evidencias del taller',
          );
        }
        workshopId = order.workshopId;
        productId = order.productId;
      } else if (user.workshopId) {
        throw new BadRequestException(
          'Las evidencias del taller deben asociarse a una orden',
        );
      }
      if (
        dto.stageId &&
        !(await this.stages.exists({ where: { id: dto.stageId } }))
      ) {
        throw new BadRequestException('Etapa inexistente');
      }
      if (
        [
          MediaPurpose.STAGE,
          MediaPurpose.PROGRESS,
          MediaPurpose.FINISHED,
        ].includes(dto.purpose) &&
        !dto.productionOrderId
      ) {
        throw new BadRequestException(
          'Las evidencias de proceso requieren orden de producción',
        );
      }

      const sha256 = await this.storage.sha256(tmp);
      const rel = await this.storage.persist(tmp, detected.ext);
      const derived =
        kind === MediaKind.PHOTO
          ? await this.storage.derivePhoto(rel)
          : { webPath: null, thumbPath: null, width: null, height: null };
      const capturedAt = dto.capturedAt ? new Date(dto.capturedAt) : new Date();
      const entity = this.media.create({
        kind,
        purpose: dto.purpose,
        originalName: file.originalname
          .slice(0, 255)
          .replace(/[^\w.\- ()áéíóúñÁÉÍÓÚÑ]/g, '_'),
        mimeType: detected.mime,
        sizeBytes: file.size,
        sha256,
        storagePath: rel,
        webPath: derived.webPath,
        thumbPath: derived.thumbPath,
        width: derived.width,
        height: derived.height,
        capturedAt: capturedAt > new Date() ? new Date() : capturedAt,
        caption: dto.caption ?? null,
        productionOrderId: dto.productionOrderId ?? null,
        productId,
        workshopId,
        stageId: dto.stageId ?? null,
        progressReportId: dto.progressReportId ?? null,
        finishedDeclarationId: dto.finishedDeclarationId ?? null,
        receiptId: dto.receiptId ?? null,
        technicalSheetId: dto.technicalSheetId ?? null,
        relatedType: dto.relatedType ?? null,
        relatedId: dto.relatedId ?? null,
        uploadedById: user.id,
      });
      return this.toDto(await this.media.save(entity));
    } finally {
      await unlink(tmp).catch(() => undefined);
    }
  }

  async list(q: MediaQueryDto, user: AuthUser) {
    const where: FindOptionsWhere<MediaFile> = {};
    if (q.productionOrderId) where.productionOrderId = q.productionOrderId;
    if (q.productId) where.productId = q.productId;
    if (q.stageId) where.stageId = q.stageId;
    if (q.technicalSheetId) where.technicalSheetId = q.technicalSheetId;
    if (q.relatedType) where.relatedType = q.relatedType;
    if (q.relatedId) where.relatedId = q.relatedId;
    if (q.kind) where.kind = q.kind;
    if (q.purpose) where.purpose = q.purpose;
    if (user.workshopId) where.workshopId = user.workshopId;
    if (
      !q.includeHidden ||
      !user.permissions.includes(Permission.MEDIA_MODERATE)
    )
      where.hidden = false;
    const [items, total] = await this.media.findAndCount({
      where,
      relations: { uploadedBy: true },
      order: { capturedAt: 'ASC' },
      skip: q.skip,
      take: q.pageSize,
    });
    return paginated(
      [items.map((m) => this.toDto(m)) as unknown as MediaFile[], total],
      q,
    );
  }

  async get(id: string, user: AuthUser) {
    const m = await this.media.findOne({
      where: { id },
      relations: { uploadedBy: true },
    });
    if (!m) throw new NotFoundException('Evidencia no encontrada');
    if (user.workshopId && m.workshopId !== user.workshopId)
      throw new NotFoundException('Evidencia no encontrada');
    return this.toDto(m);
  }

  /** Para el endpoint público firmado: ruta del archivo según variante. */
  async resolveContent(id: string, variant: string) {
    const m = await this.media.findOne({ where: { id } });
    if (!m) throw new NotFoundException();
    const rel =
      variant === 'thumb'
        ? (m.thumbPath ?? m.storagePath)
        : variant === 'web'
          ? (m.webPath ?? m.storagePath)
          : m.storagePath;
    const mime = rel === m.storagePath ? m.mimeType : 'image/webp';
    return { path: this.storage.abs(rel), mime, name: m.originalName };
  }

  /**
   * RN-024: ocultar nunca borra. El taller solo puede ocultar SUS evidencias de
   * órdenes abiertas; con la orden cerrada solo un moderador, con motivo.
   */
  async hide(id: string, reason: string, user: AuthUser) {
    const m = await this.media.findOne({ where: { id } });
    if (!m) throw new NotFoundException('Evidencia no encontrada');
    const isModerator = user.permissions.includes(Permission.MEDIA_MODERATE);
    if (!isModerator) {
      if (
        !user.workshopId ||
        m.workshopId !== user.workshopId ||
        m.uploadedById !== user.id
      ) {
        throw new ForbiddenException('No puede ocultar esta evidencia');
      }
      if (m.productionOrderId) {
        const order = await this.orders.findOneOrFail({
          where: { id: m.productionOrderId },
        });
        if (
          CLOSED_ORDER_STATUSES.includes(order.status) ||
          order.status === OrderStatus.IN_REVIEW
        ) {
          throw new BusinessRuleException(
            'ORDER_CLOSED',
            'La orden está en revisión o cerrada: la evidencia no puede ocultarse por el taller',
          );
        }
      }
    }
    m.hidden = true;
    m.hiddenReason = reason;
    m.hiddenById = user.id;
    m.hiddenAt = new Date();
    await this.media.save(m);
    await this.audit.log({
      action: AuditAction.HIDE,
      entityType: 'MediaFile',
      entityId: id,
      description: reason,
    });
    return this.toDto(m);
  }

  async unhide(id: string) {
    const m = await this.media.findOne({ where: { id } });
    if (!m) throw new NotFoundException('Evidencia no encontrada');
    m.hidden = false;
    await this.media.save(m);
    return this.toDto(m);
  }

  async setPublic(id: string, publicVisible: boolean) {
    const m = await this.media.findOne({ where: { id } });
    if (!m) throw new NotFoundException('Evidencia no encontrada');
    m.publicVisible = publicVisible;
    return this.toDto(await this.media.save(m));
  }

  /** Cuenta evidencias visibles por etapa de una orden (para validar etapas obligatorias). */
  async countByStage(orderId: string, stageId: string) {
    const base = { productionOrderId: orderId, stageId, hidden: false };
    const [photos, videos] = await Promise.all([
      this.media.count({ where: { ...base, kind: MediaKind.PHOTO } }),
      this.media.count({ where: { ...base, kind: MediaKind.VIDEO } }),
    ]);
    return { photos, videos };
  }

  /**
   * RF-041 / P20 / CA-016: historia visual de la orden, ordenada cronológicamente y
   * agrupada por etapa de fabricación.
   */
  async story(orderId: string, user: AuthUser | null, onlyPublic = false) {
    const order = await this.orders.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Orden no encontrada');
    if (user) assertWorkshopAccess(user, order.workshopId);
    const where: FindOptionsWhere<MediaFile> = {
      productionOrderId: orderId,
      hidden: false,
    };
    if (onlyPublic) where.publicVisible = true;
    const files = await this.media.find({
      where: { ...where, kind: In([MediaKind.PHOTO, MediaKind.VIDEO]) },
      relations: onlyPublic ? {} : { uploadedBy: true },
      order: { capturedAt: 'ASC', uploadedAt: 'ASC' },
    });
    const stages = await this.masters.stagesForProduct(order.product);
    const groups = stages.map((s) => ({
      stage: {
        id: s.id,
        code: s.code,
        name: s.name,
        sequence: s.sequence,
        mandatory: s.mandatory,
        requiresPhoto: s.requiresPhoto,
        requiresVideo: s.requiresVideo,
        isFinal: s.isFinal,
      },
      items: files
        .filter((f) => f.stageId === s.id)
        .map((f) => this.toPublic(f, onlyPublic)),
    }));
    const unstaged = files.filter(
      (f) => !f.stageId || !stages.some((s) => s.id === f.stageId),
    );
    if (unstaged.length) {
      groups.push({
        stage: {
          id: 'OTHER',
          code: 'OTROS',
          name: 'Otras evidencias',
          sequence: 999,
          mandatory: false,
          requiresPhoto: false,
          requiresVideo: false,
          isFinal: false,
        },
        items: unstaged.map((f) => this.toPublic(f, onlyPublic)),
      });
    }
    return {
      order: {
        id: order.id,
        number: order.number,
        status: order.status,
        product: {
          id: order.product.id,
          code: order.product.code,
          name: order.product.name,
          family: order.product.family?.name,
        },
        variant: order.variant
          ? { id: order.variant.id, name: order.variant.name }
          : null,
        workshop: onlyPublic
          ? undefined
          : {
              id: order.workshop.id,
              code: order.workshop.code,
              name: order.workshop.name,
            },
        createdAt: order.createdAt,
        closedAt: order.closedAt,
      },
      timeline: files.map((f) => this.toPublic(f, onlyPublic)),
      groups,
      totals: {
        photos: files.filter((f) => f.kind === MediaKind.PHOTO).length,
        videos: files.filter((f) => f.kind === MediaKind.VIDEO).length,
      },
    };
  }

  private toPublic(f: MediaFile, onlyPublic: boolean) {
    const dto = this.toDto(f);
    if (!onlyPublic) return dto;
    return {
      id: f.id,
      kind: f.kind,
      caption: f.caption,
      capturedAt: f.capturedAt,
      stageId: f.stageId,
      urls: dto.urls,
      width: f.width,
      height: f.height,
    };
  }

  // -------- Enlaces públicos para consumidor final --------
  async createShare(orderId: string, dto: CreateShareDto, user: AuthUser) {
    const order = await this.orders.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Orden no encontrada');
    const share = await this.shares.save(
      this.shares.create({
        token: randomBytes(24).toString('base64url'),
        productionOrderId: orderId,
        title: dto.title ?? `${order.product.name}`,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        createdById: user.id,
      }),
    );
    return share;
  }

  listShares(orderId: string) {
    return this.shares.find({
      where: { productionOrderId: orderId, revokedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
  }

  async revokeShare(id: string) {
    await this.shares.update({ id }, { revokedAt: new Date() });
  }

  async publicStory(token: string) {
    const share = await this.shares.findOne({
      where: { token, revokedAt: IsNull() },
    });
    if (!share || (share.expiresAt && share.expiresAt < new Date()))
      throw new NotFoundException('Historia no disponible');
    await this.shares.increment({ id: share.id }, 'views', 1);
    const story = await this.story(share.productionOrderId, null, true);
    return { title: share.title, ...story };
  }

  /** Requiere al menos una evidencia antes de cerrar etapas (usado por producción). */
  ensureStageEvidence(
    stage: ProductionStage,
    counts: { photos: number; videos: number },
  ) {
    const missing: string[] = [];
    if (stage.requiresPhoto && counts.photos < Math.max(1, stage.minPhotos)) {
      missing.push(`${Math.max(1, stage.minPhotos)} foto(s)`);
    }
    if (stage.requiresVideo && counts.videos < 1) missing.push('1 video');
    if (missing.length) {
      throw new BusinessRuleException(
        'STAGE_EVIDENCE_REQUIRED',
        `La etapa "${stage.name}" exige evidencia visual: falta ${missing.join(' y ')}`,
        { stageId: stage.id, missing, counts },
      );
    }
  }

  /** Ruta del archivo para compatibilidad con el DataSource (no usado externamente). */
  get dataSource() {
    return this.ds;
  }
}

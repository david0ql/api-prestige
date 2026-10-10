import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import {
  MediaPurpose,
  ReceiptLineType,
  VariableDataType,
} from '../../common/enums/domain.enums';
import type { AuthUser } from '../../common/types/auth-user';
import { BusinessRuleException } from '../../common/utils/business-error';
import { asText, roundGrams } from '../../common/utils/numeric';
import { Product } from '../masters/entities/product.entity';
import { TechnicalVariable } from '../masters/entities/technical-variable.entity';
import { MastersService } from '../masters/masters.service';
import { MediaFile } from '../media/entities/media-file.entity';
import { MediaService } from '../media/media.service';
import { FinishedDeclaration } from '../production/entities/finished-declaration.entity';
import { ProductionOrder } from '../production/entities/production-order.entity';
import { ProductionReceipt } from '../production/entities/production-receipt.entity';
import { CreateSheetDto } from './dto/catalog.dto';
import { TechnicalSheet } from './entities/technical-sheet.entity';

/** Catálogo técnico por modelo con fichas versionadas (RF-042, RN-023, CA-015). */
@Injectable()
export class CatalogService {
  constructor(
    private readonly ds: DataSource,
    @InjectRepository(TechnicalSheet)
    private readonly sheets: Repository<TechnicalSheet>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(MediaFile) private readonly media: Repository<MediaFile>,
    private readonly masters: MastersService,
    private readonly mediaService: MediaService,
  ) {}

  /** Valida que las variables existan, apliquen al producto y tengan el tipo correcto. */
  validateVariables(
    values: Record<string, unknown>,
    defs: TechnicalVariable[],
    requireOnFinish = false,
  ): Record<string, string | number | boolean> {
    const byCode = new Map(defs.map((d) => [d.code, d]));
    const out: Record<string, string | number | boolean> = {};
    for (const [code, raw] of Object.entries(values ?? {})) {
      const def = byCode.get(code);
      if (!def)
        throw new BadRequestException(
          `La variable ${code} no está definida para este modelo`,
        );
      if (raw === null || raw === undefined || raw === '') continue;
      switch (def.dataType) {
        case VariableDataType.NUMBER: {
          const n = Number(raw);
          if (!Number.isFinite(n))
            throw new BadRequestException(`${def.name} debe ser numérico`);
          out[code] = n;
          break;
        }
        case VariableDataType.BOOLEAN:
          out[code] = raw === true || raw === 'true';
          break;
        case VariableDataType.SELECT:
          if (!def.options.includes(asText(raw)))
            throw new BadRequestException(`${def.name}: opción no válida`);
          out[code] = asText(raw);
          break;
        default:
          out[code] = asText(raw).slice(0, 500);
      }
    }
    if (requireOnFinish) {
      const missing = defs.filter(
        (d) =>
          d.requiredOnFinish &&
          (out[d.code] === undefined || out[d.code] === ''),
      );
      if (missing.length) {
        throw new BusinessRuleException(
          'TECHNICAL_VARIABLES_REQUIRED',
          `Faltan variables técnicas requeridas: ${missing.map((d) => d.name).join(', ')}`,
          { missing: missing.map((d) => d.code) },
        );
      }
    }
    return out;
  }

  async list(search?: string) {
    const products = await this.products.find({
      relations: { variants: true, workshops: true },
      order: { name: 'ASC' },
    });
    const filtered = search
      ? products.filter((p) =>
          `${p.code} ${p.name} ${p.family?.name}`
            .toLowerCase()
            .includes(search.toLowerCase()),
        )
      : products;
    const result = [];
    for (const p of filtered) {
      const current = p.currentSheetVersion
        ? await this.sheets.findOne({
            where: { productId: p.id, versionNumber: p.currentSheetVersion },
          })
        : null;
      const cover = await this.media.findOne({
        where: {
          productId: p.id,
          purpose: MediaPurpose.CATALOG,
          hidden: false,
        },
        order: { uploadedAt: 'DESC' },
      });
      result.push({
        ...p,
        currentSheet: current,
        cover: cover ? this.mediaService.toDto(cover) : null,
      });
    }
    return result;
  }

  async detail(productId: string) {
    const product = await this.masters.getProduct(productId);
    const versions = await this.sheets.find({
      where: { productId },
      relations: { createdBy: true },
      order: { versionNumber: 'DESC' },
    });
    const photos = await this.media.find({
      where: { productId, purpose: MediaPurpose.CATALOG, hidden: false },
      order: { uploadedAt: 'DESC' },
    });
    const variables = await this.masters.variablesForProduct(product);
    return {
      product,
      currentSheet:
        versions.find((v) => v.versionNumber === product.currentSheetVersion) ??
        null,
      versions,
      photos: photos.map((p) => this.mediaService.toDto(p)),
      variables,
    };
  }

  getSheet(id: string) {
    return this.sheets.findOneOrFail({
      where: { id },
      relations: { createdBy: true },
    });
  }

  /** RN-023: cada cambio crea una versión nueva; nunca se edita una existente. */
  async createVersion(
    productId: string,
    dto: CreateSheetDto,
    user: AuthUser,
    sourceOrderId?: string | null,
    m?: EntityManager,
  ) {
    const run = async (em: EntityManager) => {
      const product = await em.findOne(Product, {
        where: { id: productId },
        lock: { mode: 'pessimistic_write' },
        loadEagerRelations: false,
      });
      if (!product) throw new NotFoundException('Producto no encontrado');
      const full = await this.masters.getProduct(productId);
      const defs = await this.masters.variablesForProduct(full);
      const variables = this.validateVariables(dto.variables ?? {}, defs);
      const versionNumber = product.currentSheetVersion + 1;
      const sheet = await em.save(
        TechnicalSheet,
        em.create(TechnicalSheet, {
          productId,
          versionNumber,
          standardWeight: dto.standardWeight ?? null,
          weightTolerance: dto.weightTolerance ?? null,
          diameterMm: dto.diameterMm ?? null,
          lengthMm: dto.lengthMm ?? null,
          widthMm: dto.widthMm ?? null,
          thicknessMm: dto.thicknessMm ?? null,
          measures: dto.measures ?? null,
          targetPurity: dto.targetPurity ?? product.targetPurity,
          purityTolerance: dto.purityTolerance ?? product.purityTolerance,
          variables,
          notes: dto.notes ?? null,
          changeReason: dto.changeReason,
          sourceOrderId: sourceOrderId ?? null,
          createdById: user.id,
        }),
      );
      // Resumen vigente en el producto (las órdenes ya creadas conservan su versión).
      await em.update(
        Product,
        { id: productId },
        {
          currentSheetVersion: versionNumber,
          standardWeight: sheet.standardWeight,
          ...(dto.targetPurity !== undefined && dto.targetPurity !== null
            ? { targetPurity: dto.targetPurity }
            : {}),
          ...(dto.purityTolerance !== undefined && dto.purityTolerance !== null
            ? { purityTolerance: dto.purityTolerance }
            : {}),
        },
      );
      return sheet;
    };
    return m ? run(m) : this.ds.transaction(run);
  }

  /**
   * CA-005: alimentar/actualizar la ficha técnica desde una orden terminada usando
   * las variables declaradas por el taller y el peso real recibido.
   */
  async createFromOrder(
    productId: string,
    orderId: string,
    changeReason: string,
    user: AuthUser,
  ) {
    const order = await this.ds
      .getRepository(ProductionOrder)
      .findOne({ where: { id: orderId } });
    if (!order || order.productId !== productId)
      throw new BadRequestException('La orden no corresponde al producto');
    const decl = await this.ds.getRepository(FinishedDeclaration).findOne({
      where: { orderId, current: true },
      order: { createdAt: 'DESC' },
    });
    if (!decl)
      throw new BusinessRuleException(
        'NO_FINISHED_DECLARATION',
        'La orden no tiene declaración de producto terminado',
      );
    const receipts = await this.ds
      .getRepository(ProductionReceipt)
      .find({ where: { orderId } });
    let units = 0;
    let grams = 0;
    for (const r of receipts)
      for (const l of r.lines)
        if (l.lineType === ReceiptLineType.FINISHED_PRODUCT) {
          units += l.units ?? 0;
          grams += l.grams;
        }
    const baseUnits = units || decl.units || 0;
    const baseGrams = grams || decl.grams;
    const previous = order.product.currentSheetVersion
      ? await this.sheets.findOne({
          where: {
            productId,
            versionNumber: order.product.currentSheetVersion,
          },
        })
      : null;
    return this.createVersion(
      productId,
      {
        standardWeight:
          baseUnits > 0
            ? roundGrams(baseGrams / baseUnits)
            : (previous?.standardWeight ?? null),
        weightTolerance: previous?.weightTolerance ?? null,
        diameterMm: decl.diameterMm ?? previous?.diameterMm ?? null,
        lengthMm: decl.lengthMm ?? previous?.lengthMm ?? null,
        widthMm: previous?.widthMm ?? null,
        thicknessMm: previous?.thicknessMm ?? null,
        measures: decl.measures ?? previous?.measures ?? null,
        targetPurity: previous?.targetPurity ?? order.product.targetPurity,
        purityTolerance:
          previous?.purityTolerance ?? order.product.purityTolerance,
        variables: { ...(previous?.variables ?? {}), ...decl.technicalValues },
        notes: previous?.notes ?? null,
        changeReason: `${changeReason} (desde orden ${order.number})`,
      },
      user,
      orderId,
    );
  }
}

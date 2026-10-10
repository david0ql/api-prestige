import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, EntityManager, FindOptionsWhere, ILike, IsNull, Repository } from 'typeorm';
import { paginated } from '../../common/dto/pagination.dto';
import { AuditAction, WeighingPurpose, WeighingSource } from '../../common/enums/domain.enums';
import { Permission } from '../../common/enums/permission.enum';
import type { AuthUser } from '../../common/types/auth-user';
import { BusinessRuleException } from '../../common/utils/business-error';
import { roundGrams } from '../../common/utils/numeric';
import { AuditService } from '../audit/audit.service';
import { MastersService } from '../masters/masters.service';
import { SequenceService } from '../sequences/sequence.service';
import { AdjustWeighingDto, CaptureWeighingDto, WeighingQueryDto } from './dto/scale.dto';
import { WeighingAdjustment } from './entities/weighing-adjustment.entity';
import { Weighing } from './entities/weighing.entity';
import { parseScaleReading } from './scale.util';

/** Balanza Madre (RF-002, RF-003, RN-019). */
@Injectable()
export class ScaleService {
  constructor(
    private readonly ds: DataSource,
    @InjectRepository(Weighing) private readonly weighings: Repository<Weighing>,
    @InjectRepository(WeighingAdjustment) private readonly adjustments: Repository<WeighingAdjustment>,
    private readonly seq: SequenceService,
    private readonly audit: AuditService,
    private readonly masters: MastersService,
  ) {}

  async capture(dto: CaptureWeighingDto, user: AuthUser): Promise<Weighing> {
    const tare = dto.tareGrams ?? 0;
    const net = roundGrams(dto.grossGrams - tare);
    if (net <= 0) throw new BusinessRuleException('WEIGHT_NOT_POSITIVE', 'El peso neto debe ser mayor que cero');
    if (dto.materialId) await this.masters.activeMaterial(dto.materialId);

    let stable = dto.stable ?? true;
    if (dto.source === WeighingSource.MANUAL) {
      if (!user.permissions.includes(Permission.SCALE_MANUAL)) {
        throw new ForbiddenException('Su rol no está autorizado para captura manual de peso');
      }
    } else {
      // RN-019: el peso enviado debe coincidir con la trama cruda de la balanza.
      const parsed = parseScaleReading(dto.rawReading ?? '');
      if (!parsed) throw new BusinessRuleException('SCALE_READING_INVALID', 'No se pudo interpretar la lectura de la balanza');
      if (Math.abs(roundGrams(parsed.grams) - roundGrams(dto.grossGrams)) > 0.0001) {
        throw new BusinessRuleException(
          'SCALE_READING_MISMATCH',
          'El peso capturado no coincide con la lectura de la balanza: no se permite alterarlo',
        );
      }
      if (!parsed.stable) throw new BusinessRuleException('SCALE_UNSTABLE', 'La lectura de la balanza no es estable');
      stable = parsed.stable;
    }

    return this.ds.transaction(async (m) => {
      const w = m.create(Weighing, {
        number: await this.seq.next(m, 'PES'),
        purpose: dto.purpose,
        source: dto.source,
        materialId: dto.materialId ?? null,
        grossGrams: roundGrams(dto.grossGrams),
        tareGrams: roundGrams(tare),
        netGrams: net,
        currentNetGrams: net,
        rawReading: dto.rawReading ?? null,
        deviceInfo: dto.deviceInfo ?? null,
        stable,
        manualReason: dto.source === WeighingSource.MANUAL ? (dto.manualReason ?? null) : null,
        notes: dto.notes ?? null,
        capturedById: user.id,
      });
      const saved = await m.save(Weighing, w);
      if (dto.source === WeighingSource.MANUAL) {
        await this.audit.log(
          {
            action: AuditAction.OVERRIDE,
            entityType: 'Weighing',
            entityId: saved.id,
            after: { netGrams: net, manualReason: dto.manualReason },
            description: `Captura MANUAL de peso (${net} g): ${dto.manualReason}`,
          },
          m,
        );
      }
      return saved;
    });
  }

  async list(q: WeighingQueryDto) {
    const where: FindOptionsWhere<Weighing> = {};
    if (q.purpose) where.purpose = q.purpose;
    if (q.source) where.source = q.source;
    if (q.unused === 'true') where.usedById = IsNull();
    if (q.from || q.to) {
      where.capturedAt = Between(
        q.from ? new Date(q.from) : new Date(0),
        q.to ? new Date(`${q.to.slice(0, 10)}T23:59:59.999Z`) : new Date(),
      );
    }
    const finalWhere = q.search ? [{ ...where, number: ILike(`%${q.search}%`) }, { ...where, notes: ILike(`%${q.search}%`) }] : where;
    return paginated(
      await this.weighings.findAndCount({
        where: finalWhere,
        relations: { capturedBy: true, material: true },
        order: { capturedAt: 'DESC' },
        skip: q.skip,
        take: q.pageSize,
      }),
      q,
    );
  }

  async get(id: string) {
    const w = await this.weighings.findOne({ where: { id }, relations: { capturedBy: true, material: true } });
    if (!w) throw new NotFoundException('Pesaje no encontrado');
    const adjustments = await this.adjustments.find({
      where: { weighingId: id },
      relations: { adjustedBy: true },
      order: { createdAt: 'ASC' },
    });
    return { ...w, adjustments };
  }

  /** RN-019: el ajuste no edita el pesaje, deja rastro con valor previo, nuevo y motivo. */
  async adjust(id: string, dto: AdjustWeighingDto, user: AuthUser) {
    return this.ds.transaction(async (m) => {
      const w = await m.findOne(Weighing, { where: { id }, lock: { mode: 'pessimistic_write' }, loadEagerRelations: false });
      if (!w) throw new NotFoundException('Pesaje no encontrado');
      if (w.usedById) {
        throw new BusinessRuleException(
          'WEIGHING_ALREADY_USED',
          'El pesaje ya fue utilizado en un documento; corrija mediante reverso del documento',
        );
      }
      const previous = w.currentNetGrams;
      const next = roundGrams(dto.newNetGrams);
      await m.save(
        WeighingAdjustment,
        m.create(WeighingAdjustment, {
          weighingId: id,
          previousNetGrams: previous,
          newNetGrams: next,
          reason: dto.reason,
          adjustedById: user.id,
        }),
      );
      w.currentNetGrams = next;
      await m.save(Weighing, w);
      await this.audit.log(
        {
          action: AuditAction.OVERRIDE,
          entityType: 'Weighing',
          entityId: id,
          before: { currentNetGrams: previous },
          after: { currentNetGrams: next },
          description: `Ajuste de pesaje: ${dto.reason}`,
        },
        m,
      );
      return w;
    });
  }

  /**
   * Usa un pesaje en un documento (entrada, despacho, recepción…) dentro de la
   * transacción del documento. Un pesaje solo puede usarse una vez.
   */
  async consume(
    m: EntityManager,
    weighingId: string,
    purposes: WeighingPurpose[],
    usedByType: string,
    usedById: string,
    materialId?: string | null,
  ): Promise<Weighing> {
    const w = await m.findOne(Weighing, { where: { id: weighingId }, lock: { mode: 'pessimistic_write' }, loadEagerRelations: false });
    if (!w) throw new BadRequestException('Pesaje inexistente');
    if (w.usedById) throw new BusinessRuleException('WEIGHING_ALREADY_USED', `El pesaje ${w.number} ya fue utilizado`);
    if (!purposes.includes(w.purpose)) {
      throw new BusinessRuleException('WEIGHING_PURPOSE', `El pesaje ${w.number} no corresponde a esta operación`);
    }
    if (materialId && w.materialId && w.materialId !== materialId) {
      throw new BusinessRuleException('WEIGHING_MATERIAL', `El pesaje ${w.number} es de otro material`);
    }
    w.usedByType = usedByType;
    w.usedById = usedById;
    await m.save(Weighing, w);
    return w;
  }
}

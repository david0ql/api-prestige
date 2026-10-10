import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemParameter } from './entities/system-parameter.entity';

/** Claves de parámetros conocidos (se siembran con valores por defecto). */
export const PARAM = {
  COMPANY_NAME: 'company.name',
  CURRENCY: 'company.currency',
  DEFAULT_LOSS_TOLERANCE_PCT: 'production.defaultLossTolerancePct',
  CUSTODY_TOLERANCE_GRAMS: 'production.custodyToleranceGrams',
  RECEPTION_TOLERANCE_PCT: 'production.receptionTolerancePct',
  PENDING_ACCEPTANCE_HOURS: 'alerts.pendingAcceptanceHours',
  DELAY_WARNING_DAYS: 'alerts.delayWarningDays',
  QUALITY_CHECKLIST: 'quality.checklist',
  GOLD_FINE_REFERENCE: 'purity.goldFineReference',
  SCALE_CONFIG: 'scale.config',
} as const;

@Injectable()
export class ParametersService {
  constructor(
    @InjectRepository(SystemParameter)
    private readonly repo: Repository<SystemParameter>,
  ) {}

  list() {
    return this.repo.find({ order: { groupName: 'ASC', key: 'ASC' } });
  }

  async get<T>(key: string, fallback: T): Promise<T> {
    const p = await this.repo.findOne({ where: { key } });
    return p ? (p.value as T) : fallback;
  }

  async update(key: string, value: unknown) {
    const p = await this.repo.findOne({ where: { key } });
    if (!p) throw new NotFoundException('Parámetro no encontrado');
    p.value = value;
    return this.repo.save(p);
  }
}

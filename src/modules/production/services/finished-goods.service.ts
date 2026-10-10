import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, In, Repository } from 'typeorm';
import { paginated } from '../../../common/dto/pagination.dto';
import { FinishedGoodStatus } from '../../../common/enums/domain.enums';
import { FinishedGoodQueryDto } from '../dto/production.dto';
import { FinishedGood } from '../entities/finished-good.entity';

/** Inventario de producto terminado (disponible para despacho/venta). */
@Injectable()
export class FinishedGoodsService {
  constructor(
    @InjectRepository(FinishedGood)
    private readonly repo: Repository<FinishedGood>,
  ) {}

  async list(q: FinishedGoodQueryDto) {
    const where: FindOptionsWhere<FinishedGood> = {};
    if (q.status) {
      const statuses = q.status
        .split(',')
        .filter((s) =>
          Object.values(FinishedGoodStatus).includes(s as FinishedGoodStatus),
        );
      where.status = In(statuses);
    }
    if (q.productId) where.productId = q.productId;
    if (q.orderId) where.orderId = q.orderId;
    const final = q.search
      ? [
          { ...where, code: ILike(`%${q.search}%`) },
          { ...where, product: { name: ILike(`%${q.search}%`) } },
        ]
      : where;
    return paginated(
      await this.repo.findAndCount({
        where: final,
        order: { createdAt: 'DESC' },
        skip: q.skip,
        take: q.pageSize,
      }),
      q,
    );
  }

  async get(id: string) {
    const g = await this.repo.findOne({ where: { id } });
    if (!g) throw new NotFoundException('Producto terminado no encontrado');
    return g;
  }
}

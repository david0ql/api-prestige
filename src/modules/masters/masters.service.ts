import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  FindOptionsWhere,
  ILike,
  In,
  IsNull,
  ObjectLiteral,
  Repository,
} from 'typeorm';
import { paginated } from '../../common/dto/pagination.dto';
import { LocationType, RecordStatus } from '../../common/enums/domain.enums';
import { ConsumptionStandard } from './entities/consumption-standard.entity';
import { Customer } from './entities/customer.entity';
import { FinanceCategory } from './entities/finance-category.entity';
import { LaborRate } from './entities/labor-rate.entity';
import { Location } from './entities/location.entity';
import { Material } from './entities/material.entity';
import { MaterialCategory } from './entities/material-category.entity';
import { PaymentMethod } from './entities/payment-method.entity';
import { Product } from './entities/product.entity';
import { ProductFamily } from './entities/product-family.entity';
import { ProductVariant } from './entities/product-variant.entity';
import { ProductWorkshop } from './entities/product-workshop.entity';
import { ProductionStage } from './entities/production-stage.entity';
import { TechnicalVariable } from './entities/technical-variable.entity';
import { Unit } from './entities/unit.entity';
import { Workshop } from './entities/workshop.entity';
import {
  CreateCustomerDto,
  CreateFinanceCategoryDto,
  CreateLaborRateDto,
  CreateLocationDto,
  CreateMaterialCategoryDto,
  CreateMaterialDto,
  CreatePaymentMethodDto,
  CreateProductDto,
  CreateProductFamilyDto,
  CreateStageDto,
  CreateStandardDto,
  CreateUnitDto,
  CreateVariableDto,
  CreateVariantDto,
  CreateWorkshopDto,
  MasterQueryDto,
  UpdateCustomerDto,
  UpdateFinanceCategoryDto,
  UpdateLaborRateDto,
  UpdateLocationDto,
  UpdateMaterialCategoryDto,
  UpdateMaterialDto,
  UpdatePaymentMethodDto,
  UpdateProductDto,
  UpdateProductFamilyDto,
  UpdateStageDto,
  UpdateStandardDto,
  UpdateUnitDto,
  UpdateVariableDto,
  UpdateVariantDto,
  UpdateWorkshopDto,
} from './dto/masters.dto';

export const MOTHER_OFFICE_CODE = 'OFICINA-MADRE';
export const TRANSIT_CODE = 'TRANSITO';
export const workshopLocationCode = (code: string) =>
  `TALLER-${code.toUpperCase()}`;

/**
 * Maestros y parametrización (RF-037/038, RN-018): todo se crea desde
 * administración sin tocar código.
 */
@Injectable()
export class MastersService {
  constructor(
    private readonly ds: DataSource,
    @InjectRepository(Unit) private readonly units: Repository<Unit>,
    @InjectRepository(MaterialCategory)
    private readonly categories: Repository<MaterialCategory>,
    @InjectRepository(Material)
    private readonly materials: Repository<Material>,
    @InjectRepository(Workshop)
    private readonly workshops: Repository<Workshop>,
    @InjectRepository(Location)
    private readonly locations: Repository<Location>,
    @InjectRepository(Customer)
    private readonly customers: Repository<Customer>,
    @InjectRepository(ProductFamily)
    private readonly families: Repository<ProductFamily>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(ProductVariant)
    private readonly variants: Repository<ProductVariant>,
    @InjectRepository(ProductWorkshop)
    private readonly productWorkshops: Repository<ProductWorkshop>,
    @InjectRepository(ConsumptionStandard)
    private readonly standards: Repository<ConsumptionStandard>,
    @InjectRepository(LaborRate)
    private readonly laborRates: Repository<LaborRate>,
    @InjectRepository(ProductionStage)
    private readonly stages: Repository<ProductionStage>,
    @InjectRepository(TechnicalVariable)
    private readonly variables: Repository<TechnicalVariable>,
    @InjectRepository(PaymentMethod)
    private readonly paymentMethods: Repository<PaymentMethod>,
    @InjectRepository(FinanceCategory)
    private readonly financeCategories: Repository<FinanceCategory>,
  ) {}

  // ---------- helpers genéricos ----------
  private async findOr404<T extends ObjectLiteral>(
    repo: Repository<T>,
    id: string,
    label: string,
  ): Promise<T> {
    const e = await repo.findOne({
      where: { id } as unknown as FindOptionsWhere<T>,
    });
    if (!e) throw new NotFoundException(`${label} no encontrado`);
    return e;
  }

  private async ensureUnique<T extends ObjectLiteral>(
    repo: Repository<T>,
    where: FindOptionsWhere<T>,
    exceptId?: string,
  ) {
    const found = await repo.findOne({ where });
    if (found && (found as unknown as { id: string }).id !== exceptId) {
      throw new ConflictException('Ya existe un registro con ese código');
    }
  }

  private searchable<T>(
    q: MasterQueryDto,
    fields: (keyof T)[],
    extra: FindOptionsWhere<T> = {},
  ) {
    const base = { ...extra };
    if (q.status) (base as Record<string, unknown>).status = q.status;
    if (!q.search) return base;
    return fields.map(
      (f) => ({ ...base, [f]: ILike(`%${q.search}%`) }) as FindOptionsWhere<T>,
    );
  }

  /** Valida que una entidad referida exista y esté activa (validación crítica). */
  async activeMaterial(id: string): Promise<Material> {
    const m = await this.materials.findOne({ where: { id } });
    if (!m) throw new BadRequestException('Material inexistente');
    if (m.status !== RecordStatus.ACTIVE)
      throw new BadRequestException(`El material ${m.name} está inactivo`);
    return m;
  }

  // ---------- Unidades ----------
  listUnits() {
    return this.units.find({ order: { kind: 'ASC', code: 'ASC' } });
  }
  async createUnit(dto: CreateUnitDto) {
    await this.ensureUnique(this.units, { code: dto.code });
    return this.units.save(this.units.create(dto));
  }
  async updateUnit(id: string, dto: UpdateUnitDto) {
    const u = await this.findOr404(this.units, id, 'Unidad');
    if (u.isBase && dto.factorToGram !== undefined && dto.factorToGram !== 1) {
      throw new BadRequestException(
        'El gramo es la unidad base: su factor es 1',
      );
    }
    if (dto.code) await this.ensureUnique(this.units, { code: dto.code }, id);
    return this.units.save(Object.assign(u, dto));
  }

  // ---------- Categorías ----------
  listCategories() {
    return this.categories.find({ order: { name: 'ASC' } });
  }
  async createCategory(dto: CreateMaterialCategoryDto) {
    await this.ensureUnique(this.categories, { code: dto.code });
    return this.categories.save(this.categories.create(dto));
  }
  async updateCategory(id: string, dto: UpdateMaterialCategoryDto) {
    const c = await this.findOr404(this.categories, id, 'Categoría');
    if (dto.code)
      await this.ensureUnique(this.categories, { code: dto.code }, id);
    return this.categories.save(Object.assign(c, dto));
  }

  // ---------- Materiales ----------
  async listMaterials(q: MasterQueryDto) {
    return paginated(
      await this.materials.findAndCount({
        where: this.searchable<Material>(q, ['code', 'name']),
        order: { name: 'ASC' },
        skip: q.skip,
        take: q.pageSize,
      }),
      q,
    );
  }
  getMaterial(id: string) {
    return this.findOr404(this.materials, id, 'Material');
  }
  async createMaterial(dto: CreateMaterialDto) {
    await this.ensureUnique(this.materials, { code: dto.code });
    await this.findOr404(this.categories, dto.categoryId, 'Categoría');
    await this.findOr404(this.units, dto.baseUnitId, 'Unidad');
    const saved = await this.materials.save(this.materials.create(dto));
    return this.getMaterial(saved.id);
  }
  async updateMaterial(id: string, dto: UpdateMaterialDto) {
    const m = await this.getMaterial(id);
    if (dto.code)
      await this.ensureUnique(this.materials, { code: dto.code }, id);
    if (dto.categoryId)
      await this.findOr404(this.categories, dto.categoryId, 'Categoría');
    if (dto.baseUnitId)
      await this.findOr404(this.units, dto.baseUnitId, 'Unidad');
    Object.assign(m, dto);
    if (dto.categoryId) delete (m as Partial<Material>).category;
    if (dto.baseUnitId) delete (m as Partial<Material>).baseUnit;
    await this.materials.save(m);
    return this.getMaterial(id);
  }

  // ---------- Talleres ----------
  async listWorkshops(q: MasterQueryDto) {
    return paginated(
      await this.workshops.findAndCount({
        where: this.searchable<Workshop>(q, ['code', 'name', 'responsible']),
        relations: { products: { product: true } },
        order: { code: 'ASC' },
        skip: q.skip,
        take: q.pageSize,
      }),
      q,
    );
  }
  async getWorkshop(id: string) {
    const w = await this.workshops.findOne({
      where: { id },
      relations: { products: { product: true } },
    });
    if (!w) throw new NotFoundException('Taller no encontrado');
    return w;
  }

  /** CA-012 / RN-018: crear taller = taller + ubicación de custodia + productos autorizados. */
  async createWorkshop(dto: CreateWorkshopDto) {
    const code = dto.code.toUpperCase();
    await this.ensureUnique(this.workshops, { code });
    const id = await this.ds.transaction(async (m) => {
      const { productIds, ...data } = dto;
      const w = await m.save(Workshop, m.create(Workshop, { ...data, code }));
      await m.save(
        Location,
        m.create(Location, {
          code: workshopLocationCode(code),
          name: `Custodia taller ${w.name}`,
          type: LocationType.WORKSHOP,
          workshopId: w.id,
        }),
      );
      if (productIds?.length)
        await this.syncWorkshopProducts(
          m.getRepository(ProductWorkshop),
          w.id,
          productIds,
        );
      return w.id;
    });
    return this.getWorkshop(id);
  }

  async updateWorkshop(id: string, dto: UpdateWorkshopDto) {
    const w = await this.getWorkshop(id);
    const code = dto.code?.toUpperCase();
    if (code) await this.ensureUnique(this.workshops, { code }, id);
    await this.ds.transaction(async (m) => {
      const { productIds, ...data } = dto;
      const updated = Object.assign(w, data, code ? { code } : {});
      delete (updated as Partial<Workshop>).products;
      await m.save(Workshop, updated);
      const loc = await m.findOne(Location, { where: { workshopId: id } });
      if (loc) {
        loc.code = workshopLocationCode(updated.code);
        loc.name = `Custodia taller ${updated.name}`;
        loc.status = updated.status;
        await m.save(Location, loc);
      }
      if (productIds)
        await this.syncWorkshopProducts(
          m.getRepository(ProductWorkshop),
          id,
          productIds,
        );
    });
    return this.getWorkshop(id);
  }

  private async syncWorkshopProducts(
    repo: Repository<ProductWorkshop>,
    workshopId: string,
    productIds: string[],
  ) {
    const existing = await repo.find({ where: { workshopId } });
    const keep = new Set(productIds);
    for (const pw of existing) {
      const enabled = keep.has(pw.productId);
      if (pw.enabled !== enabled) await repo.save({ ...pw, enabled });
      keep.delete(pw.productId);
    }
    if (keep.size) {
      const valid = await this.products.find({ where: { id: In([...keep]) } });
      if (valid.length !== keep.size)
        throw new BadRequestException('Algún producto no existe');
      await repo.save(
        [...keep].map((productId) =>
          repo.create({ workshopId, productId, enabled: true }),
        ),
      );
    }
  }

  // ---------- Ubicaciones ----------
  listLocations() {
    return this.locations.find({ order: { type: 'ASC', code: 'ASC' } });
  }
  async createLocation(dto: CreateLocationDto) {
    await this.ensureUnique(this.locations, { code: dto.code });
    return this.locations.save(this.locations.create(dto));
  }
  async updateLocation(id: string, dto: UpdateLocationDto) {
    const l = await this.findOr404(this.locations, id, 'Ubicación');
    if (
      [LocationType.MOTHER_OFFICE, LocationType.WORKSHOP].includes(l.type) &&
      dto.type &&
      dto.type !== l.type
    ) {
      throw new BadRequestException(
        'No se puede cambiar el tipo de una ubicación de sistema',
      );
    }
    if (dto.code)
      await this.ensureUnique(this.locations, { code: dto.code }, id);
    return this.locations.save(Object.assign(l, dto));
  }
  async motherOffice(): Promise<Location> {
    const l = await this.locations.findOne({
      where: { type: LocationType.MOTHER_OFFICE },
    });
    if (!l) throw new NotFoundException('No existe la ubicación Oficina Madre');
    return l;
  }
  async transit(): Promise<Location> {
    const l = await this.locations.findOne({ where: { code: TRANSIT_CODE } });
    if (!l) throw new NotFoundException('No existe la ubicación de tránsito');
    return l;
  }
  async workshopLocation(workshopId: string): Promise<Location> {
    const l = await this.locations.findOne({ where: { workshopId } });
    if (!l)
      throw new NotFoundException('El taller no tiene ubicación de custodia');
    return l;
  }

  // ---------- Clientes ----------
  async listCustomers(q: MasterQueryDto) {
    return paginated(
      await this.customers.findAndCount({
        where: this.searchable<Customer>(q, [
          'name',
          'documentNumber',
          'email',
          'phone',
        ]),
        order: { name: 'ASC' },
        skip: q.skip,
        take: q.pageSize,
      }),
      q,
    );
  }
  getCustomer(id: string) {
    return this.findOr404(this.customers, id, 'Cliente');
  }
  async createCustomer(dto: CreateCustomerDto) {
    await this.ensureUnique(this.customers, {
      documentType: dto.documentType,
      documentNumber: dto.documentNumber,
    });
    return this.customers.save(this.customers.create(dto));
  }
  async updateCustomer(id: string, dto: UpdateCustomerDto) {
    const c = await this.getCustomer(id);
    if (dto.documentNumber || dto.documentType) {
      await this.ensureUnique(
        this.customers,
        {
          documentType: dto.documentType ?? c.documentType,
          documentNumber: dto.documentNumber ?? c.documentNumber,
        },
        id,
      );
    }
    return this.customers.save(Object.assign(c, dto));
  }

  // ---------- Familias ----------
  listFamilies() {
    return this.families.find({ order: { name: 'ASC' } });
  }
  async createFamily(dto: CreateProductFamilyDto) {
    await this.ensureUnique(this.families, { code: dto.code });
    return this.families.save(this.families.create(dto));
  }
  async updateFamily(id: string, dto: UpdateProductFamilyDto) {
    const f = await this.findOr404(this.families, id, 'Familia');
    if (dto.code)
      await this.ensureUnique(this.families, { code: dto.code }, id);
    return this.families.save(Object.assign(f, dto));
  }

  // ---------- Productos ----------
  async listProducts(
    q: MasterQueryDto & { familyId?: string; workshopId?: string },
  ) {
    const extra: FindOptionsWhere<Product> = {};
    if (q.familyId) extra.familyId = q.familyId;
    if (q.workshopId)
      extra.workshops = { workshopId: q.workshopId, enabled: true };
    return paginated(
      await this.products.findAndCount({
        where: this.searchable<Product>(q, ['code', 'name'], extra),
        relations: { workshops: true, variants: true },
        order: { name: 'ASC' },
        skip: q.skip,
        take: q.pageSize,
      }),
      q,
    );
  }
  async getProduct(id: string) {
    const p = await this.products.findOne({
      where: { id },
      relations: {
        variants: true,
        workshops: true,
        standards: { variant: true },
      },
    });
    if (!p) throw new NotFoundException('Producto no encontrado');
    return p;
  }
  async createProduct(dto: CreateProductDto) {
    await this.ensureUnique(this.products, { code: dto.code });
    await this.findOr404(this.families, dto.familyId, 'Familia');
    if (dto.outputMaterialId) await this.activeMaterial(dto.outputMaterialId);
    const id = await this.ds.transaction(async (m) => {
      const { workshopIds, ...data } = dto;
      const p = await m.save(Product, m.create(Product, data));
      if (workshopIds?.length)
        await this.syncProductWorkshops(
          m.getRepository(ProductWorkshop),
          p.id,
          workshopIds,
        );
      return p.id;
    });
    return this.getProduct(id);
  }
  async updateProduct(id: string, dto: UpdateProductDto) {
    const p = await this.getProduct(id);
    if (dto.code)
      await this.ensureUnique(this.products, { code: dto.code }, id);
    if (dto.familyId)
      await this.findOr404(this.families, dto.familyId, 'Familia');
    if (dto.outputMaterialId) await this.activeMaterial(dto.outputMaterialId);
    await this.ds.transaction(async (m) => {
      const { workshopIds, ...data } = dto;
      const {
        variants: _v,
        workshops: _w,
        standards: _s,
        family: _f,
        outputMaterial: _o,
        ...plain
      } = p;
      void _v;
      void _w;
      void _s;
      void _f;
      void _o;
      await m.save(Product, { ...plain, ...data });
      if (workshopIds)
        await this.syncProductWorkshops(
          m.getRepository(ProductWorkshop),
          id,
          workshopIds,
        );
    });
    return this.getProduct(id);
  }
  private async syncProductWorkshops(
    repo: Repository<ProductWorkshop>,
    productId: string,
    workshopIds: string[],
  ) {
    const existing = await repo.find({ where: { productId } });
    const keep = new Set(workshopIds);
    for (const pw of existing) {
      const enabled = keep.has(pw.workshopId);
      if (pw.enabled !== enabled) await repo.save({ ...pw, enabled });
      keep.delete(pw.workshopId);
    }
    if (keep.size) {
      const valid = await this.workshops.count({
        where: { id: In([...keep]) },
      });
      if (valid !== keep.size)
        throw new BadRequestException('Algún taller no existe');
      await repo.save(
        [...keep].map((workshopId) =>
          repo.create({ productId, workshopId, enabled: true }),
        ),
      );
    }
  }

  /** Validación crítica: taller habilitado para el producto asignado. */
  async assertWorkshopEnabled(productId: string, workshopId: string) {
    const ok = await this.productWorkshops.exists({
      where: { productId, workshopId, enabled: true },
    });
    if (!ok)
      throw new BadRequestException(
        'El taller no está habilitado para fabricar este producto',
      );
  }

  async createVariant(productId: string, dto: CreateVariantDto) {
    await this.findOr404(this.products, productId, 'Producto');
    await this.ensureUnique(this.variants, { productId, code: dto.code });
    return this.variants.save(this.variants.create({ ...dto, productId }));
  }
  async updateVariant(productId: string, id: string, dto: UpdateVariantDto) {
    const v = await this.variants.findOne({ where: { id, productId } });
    if (!v) throw new NotFoundException('Variante no encontrada');
    if (dto.code)
      await this.ensureUnique(this.variants, { productId, code: dto.code }, id);
    return this.variants.save(Object.assign(v, dto));
  }

  // ---------- Estándares de consumo ----------
  listStandards(productId: string) {
    return this.standards.find({
      where: { productId },
      relations: { variant: true },
      order: { createdAt: 'ASC' },
    });
  }
  async createStandard(productId: string, dto: CreateStandardDto) {
    await this.findOr404(this.products, productId, 'Producto');
    await this.activeMaterial(dto.materialId);
    if (
      dto.variantId &&
      !(await this.variants.exists({ where: { id: dto.variantId, productId } }))
    ) {
      throw new BadRequestException('La variante no pertenece al producto');
    }
    const dup = await this.standards.exists({
      where: {
        productId,
        materialId: dto.materialId,
        variantId: dto.variantId ? dto.variantId : IsNull(),
        active: true,
      },
    });
    if (dup)
      throw new ConflictException(
        'Ya existe un estándar activo para ese material/variante',
      );
    return this.standards.save(this.standards.create({ ...dto, productId }));
  }
  async updateStandard(productId: string, id: string, dto: UpdateStandardDto) {
    const s = await this.standards.findOne({ where: { id, productId } });
    if (!s) throw new NotFoundException('Estándar no encontrado');
    if (dto.materialId) await this.activeMaterial(dto.materialId);
    Object.assign(s, dto);
    if (dto.materialId) delete (s as Partial<ConsumptionStandard>).material;
    return this.standards.save(s);
  }

  // ---------- Tarifas ----------
  listLaborRates(workshopId?: string) {
    return this.laborRates.find({
      where: workshopId ? { workshopId } : {},
      order: { validFrom: 'DESC' },
    });
  }
  async createLaborRate(dto: CreateLaborRateDto) {
    await this.findOr404(this.workshops, dto.workshopId, 'Taller');
    if (dto.productId)
      await this.findOr404(this.products, dto.productId, 'Producto');
    return this.laborRates.save(this.laborRates.create(dto));
  }
  async updateLaborRate(id: string, dto: UpdateLaborRateDto) {
    const r = await this.findOr404(this.laborRates, id, 'Tarifa');
    Object.assign(r, dto);
    if (dto.workshopId) delete (r as Partial<LaborRate>).workshop;
    if (dto.productId !== undefined) delete (r as Partial<LaborRate>).product;
    return this.laborRates.save(r);
  }

  // ---------- Etapas ----------
  listStages() {
    return this.stages.find({ order: { sequence: 'ASC' } });
  }
  async createStage(dto: CreateStageDto) {
    await this.ensureUnique(this.stages, { code: dto.code });
    const { familyIds, ...data } = dto;
    const families = familyIds?.length
      ? await this.families.findBy({ id: In(familyIds) })
      : [];
    return this.stages.save(this.stages.create({ ...data, families }));
  }
  async updateStage(id: string, dto: UpdateStageDto) {
    const s = await this.findOr404(this.stages, id, 'Etapa');
    if (dto.code) await this.ensureUnique(this.stages, { code: dto.code }, id);
    const { familyIds, ...data } = dto;
    Object.assign(s, data);
    if (familyIds)
      s.families = familyIds.length
        ? await this.families.findBy({ id: In(familyIds) })
        : [];
    return this.stages.save(s);
  }
  /** Etapas aplicables a un producto (por familia; sin familias = todas). */
  async stagesForProduct(product: Product): Promise<ProductionStage[]> {
    const all = await this.stages.find({
      where: { active: true },
      order: { sequence: 'ASC' },
    });
    return all.filter(
      (s) =>
        s.families.length === 0 ||
        s.families.some((f) => f.id === product.familyId),
    );
  }

  // ---------- Variables técnicas ----------
  listVariables() {
    return this.variables.find({ order: { name: 'ASC' } });
  }
  async createVariable(dto: CreateVariableDto) {
    await this.ensureUnique(this.variables, { code: dto.code });
    const { familyIds, ...data } = dto;
    const families = familyIds?.length
      ? await this.families.findBy({ id: In(familyIds) })
      : [];
    return this.variables.save(this.variables.create({ ...data, families }));
  }
  async updateVariable(id: string, dto: UpdateVariableDto) {
    const v = await this.findOr404(this.variables, id, 'Variable');
    if (dto.code)
      await this.ensureUnique(this.variables, { code: dto.code }, id);
    const { familyIds, ...data } = dto;
    Object.assign(v, data);
    if (familyIds)
      v.families = familyIds.length
        ? await this.families.findBy({ id: In(familyIds) })
        : [];
    return this.variables.save(v);
  }
  async variablesForProduct(product: Product): Promise<TechnicalVariable[]> {
    const all = await this.variables.find({
      where: { active: true },
      order: { name: 'ASC' },
    });
    return all.filter(
      (v) =>
        v.families.length === 0 ||
        v.families.some((f) => f.id === product.familyId),
    );
  }

  // ---------- Medios de pago / categorías financieras ----------
  listPaymentMethods() {
    return this.paymentMethods.find({ order: { name: 'ASC' } });
  }
  async createPaymentMethod(dto: CreatePaymentMethodDto) {
    await this.ensureUnique(this.paymentMethods, { code: dto.code });
    return this.paymentMethods.save(this.paymentMethods.create(dto));
  }
  async updatePaymentMethod(id: string, dto: UpdatePaymentMethodDto) {
    const p = await this.findOr404(this.paymentMethods, id, 'Medio de pago');
    if (dto.code)
      await this.ensureUnique(this.paymentMethods, { code: dto.code }, id);
    return this.paymentMethods.save(Object.assign(p, dto));
  }
  listFinanceCategories() {
    return this.financeCategories.find({ order: { type: 'ASC', name: 'ASC' } });
  }
  async createFinanceCategory(dto: CreateFinanceCategoryDto) {
    await this.ensureUnique(this.financeCategories, { code: dto.code });
    return this.financeCategories.save(this.financeCategories.create(dto));
  }
  async updateFinanceCategory(id: string, dto: UpdateFinanceCategoryDto) {
    const c = await this.findOr404(this.financeCategories, id, 'Categoría');
    if (c.isSystem && (dto.code || dto.type)) {
      throw new BadRequestException(
        'No se puede cambiar código/tipo de una categoría de sistema',
      );
    }
    if (dto.code)
      await this.ensureUnique(this.financeCategories, { code: dto.code }, id);
    return this.financeCategories.save(Object.assign(c, dto));
  }
}

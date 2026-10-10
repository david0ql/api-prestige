import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';
import { paginated } from '../../common/dto/pagination.dto';
import { AuditAction } from '../../common/enums/domain.enums';
import { Permission, PERMISSION_LABELS, ALL_PERMISSIONS } from '../../common/enums/permission.enum';
import { AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
import { AuthUserService } from '../auth/auth-user.service';
import { Workshop } from '../masters/entities/workshop.entity';
import { CreateRoleDto, CreateUserDto, UpdateRoleDto, UpdateUserDto, UserQueryDto } from './dto/user.dto';
import { Role } from './entities/role.entity';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Role) private readonly roles: Repository<Role>,
    @InjectRepository(Workshop) private readonly workshops: Repository<Workshop>,
    private readonly auth: AuthService,
    private readonly authUsers: AuthUserService,
    private readonly audit: AuditService,
  ) {}

  async list(q: UserQueryDto) {
    const base: FindOptionsWhere<User> = {};
    if (q.roleId) base.roleId = q.roleId;
    if (q.workshopId) base.workshopId = q.workshopId;
    const where = q.search
      ? [
          { ...base, fullName: ILike(`%${q.search}%`) },
          { ...base, username: ILike(`%${q.search}%`) },
          { ...base, email: ILike(`%${q.search}%`) },
        ]
      : base;
    return paginated(
      await this.users.findAndCount({ where, order: { fullName: 'ASC' }, skip: q.skip, take: q.pageSize }),
      q,
    );
  }

  async get(id: string) {
    const u = await this.users.findOne({ where: { id } });
    if (!u) throw new NotFoundException('Usuario no encontrado');
    return u;
  }

  /** Un rol de taller exige taller; un rol de oficina no puede tener taller (segregación). */
  private async validateRoleWorkshop(roleId: string, workshopId: string | null | undefined) {
    const role = await this.roles.findOne({ where: { id: roleId } });
    if (!role || !role.active) throw new BadRequestException('Rol inválido o inactivo');
    if (role.isWorkshopRole && !workshopId) {
      throw new BadRequestException('Un usuario con rol de taller debe tener un taller asociado');
    }
    if (!role.isWorkshopRole && workshopId) {
      throw new BadRequestException('Solo los roles de taller pueden tener taller asociado');
    }
    if (workshopId && !(await this.workshops.exists({ where: { id: workshopId } }))) {
      throw new BadRequestException('Taller inexistente');
    }
    return role;
  }

  async create(dto: CreateUserDto) {
    await this.validateRoleWorkshop(dto.roleId, dto.workshopId);
    const exists = await this.users.exists({
      where: [{ username: dto.username.toLowerCase() }, { email: dto.email.toLowerCase() }],
    });
    if (exists) throw new ConflictException('Ya existe un usuario con ese usuario o correo');
    const user = this.users.create({
      username: dto.username,
      email: dto.email,
      fullName: dto.fullName,
      phone: dto.phone ?? null,
      roleId: dto.roleId,
      workshopId: dto.workshopId ?? null,
      passwordHash: await AuthService.hashPassword(dto.password),
      mustChangePassword: dto.mustChangePassword ?? true,
    });
    const saved = await this.users.save(user);
    return this.get(saved.id);
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.get(id);
    const roleId = dto.roleId ?? user.roleId;
    const workshopId = dto.workshopId !== undefined ? dto.workshopId : user.workshopId;
    await this.validateRoleWorkshop(roleId, workshopId);
    Object.assign(user, { ...dto, roleId, workshopId });
    // Relaciones eager se reasignan por id.
    delete (user as Partial<User>).role;
    delete (user as Partial<User>).workshop;
    await this.users.save(user);
    if (dto.active === false || dto.roleId || dto.workshopId !== undefined) {
      await this.auth.revokeAllSessions(id);
    }
    this.authUsers.invalidateUser(id);
    return this.get(id);
  }

  async resetPassword(id: string, password: string) {
    await this.get(id);
    await this.users.update(id, {
      passwordHash: await AuthService.hashPassword(password),
      mustChangePassword: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
    });
    await this.auth.revokeAllSessions(id);
    await this.audit.log({
      action: AuditAction.PASSWORD_RESET,
      entityType: 'User',
      entityId: id,
      description: 'Contraseña restablecida por administrador',
    });
  }

  async unlock(id: string) {
    await this.get(id);
    await this.users.update(id, { failedLoginAttempts: 0, lockedUntil: null });
  }

  // ---------- Roles ----------
  listRoles() {
    return this.roles.find({ order: { isSystem: 'DESC', name: 'ASC' } });
  }

  permissionCatalog() {
    return ALL_PERMISSIONS.map((code) => ({ code, label: PERMISSION_LABELS[code as Permission] }));
  }

  async createRole(dto: CreateRoleDto) {
    if (await this.roles.exists({ where: { code: dto.code } })) {
      throw new ConflictException('Ya existe un rol con ese código');
    }
    this.assertWorkshopRolePermissions(dto.isWorkshopRole ?? false, dto.permissions);
    return this.roles.save(this.roles.create({ ...dto, isSystem: false }));
  }

  async updateRole(id: string, dto: UpdateRoleDto) {
    const role = await this.roles.findOne({ where: { id } });
    if (!role) throw new NotFoundException('Rol no encontrado');
    if (role.isSystem && dto.isWorkshopRole !== undefined && dto.isWorkshopRole !== role.isWorkshopRole) {
      throw new BadRequestException('No se puede cambiar el tipo de un rol de sistema');
    }
    if (role.code === 'ADMIN' && dto.permissions && !dto.permissions.includes(Permission.ROLES_MANAGE)) {
      throw new BadRequestException('El rol administrador debe conservar la administración de roles');
    }
    const next = { ...role, ...dto };
    this.assertWorkshopRolePermissions(next.isWorkshopRole, next.permissions);
    Object.assign(role, dto);
    await this.roles.save(role);
    this.authUsers.invalidateAll();
    return role;
  }

  /**
   * Segregación de funciones (RN-009): un rol de taller nunca puede aprobar
   * producción, costos ni ver finanzas globales.
   */
  private assertWorkshopRolePermissions(isWorkshopRole: boolean, permissions: string[]) {
    if (!isWorkshopRole) return;
    const forbidden = [
      Permission.ORDERS_APPROVE, Permission.LABOR_APPROVE, Permission.DISCREPANCIES_APPROVE,
      Permission.FINANCE_READ, Permission.FINANCE_MANAGE, Permission.FINANCE_CLOSE,
      Permission.REPORTS_FINANCIAL, Permission.DASHBOARD_OFFICE, Permission.INVENTORY_READ,
      Permission.USERS_MANAGE, Permission.ROLES_MANAGE, Permission.AUDIT_READ,
      Permission.CUSTOMERS_READ, Permission.REPORTS_READ,
    ];
    const bad = permissions.filter((p) => forbidden.includes(p as Permission));
    if (bad.length) {
      throw new BadRequestException(`Un rol de taller no puede tener: ${bad.join(', ')}`);
    }
  }
}

import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/permission.enum';
import {
  AdminResetPasswordDto,
  CreateRoleDto,
  CreateUserDto,
  UpdateRoleDto,
  UpdateUserDto,
  UserQueryDto,
} from './dto/user.dto';
import { UsersService } from './users.service';

@ApiTags('Usuarios y roles')
@Controller()
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get('users')
  @RequirePermissions(Permission.USERS_MANAGE)
  list(@Query() q: UserQueryDto) {
    return this.service.list(q);
  }

  @Get('users/:id')
  @RequirePermissions(Permission.USERS_MANAGE)
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.get(id);
  }

  @Post('users')
  @RequirePermissions(Permission.USERS_MANAGE)
  create(@Body() dto: CreateUserDto) {
    return this.service.create(dto);
  }

  @Patch('users/:id')
  @RequirePermissions(Permission.USERS_MANAGE)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) {
    return this.service.update(id, dto);
  }

  @Post('users/:id/reset-password')
  @HttpCode(204)
  @RequirePermissions(Permission.USERS_MANAGE)
  reset(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminResetPasswordDto,
  ) {
    return this.service.resetPassword(id, dto.password);
  }

  @Post('users/:id/unlock')
  @HttpCode(204)
  @RequirePermissions(Permission.USERS_MANAGE)
  unlock(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.unlock(id);
  }

  @Get('roles')
  @RequirePermissions(Permission.USERS_MANAGE)
  roles() {
    return this.service.listRoles();
  }

  @Get('roles/permissions')
  @RequirePermissions(Permission.ROLES_MANAGE)
  permissions() {
    return this.service.permissionCatalog();
  }

  @Post('roles')
  @RequirePermissions(Permission.ROLES_MANAGE)
  createRole(@Body() dto: CreateRoleDto) {
    return this.service.createRole(dto);
  }

  @Patch('roles/:id')
  @RequirePermissions(Permission.ROLES_MANAGE)
  updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.service.updateRole(id, dto);
  }
}

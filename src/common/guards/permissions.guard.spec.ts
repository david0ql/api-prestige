import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';

const ctx = (user: unknown) =>
  ({
    getHandler: () => null,
    getClass: () => null,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as never;

describe('PermissionsGuard', () => {
  const reflector = new Reflector();
  const guard = new PermissionsGuard(reflector);

  it('permite cuando el usuario tiene todos los permisos', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockImplementation((key) =>
        key === 'permissions' ? ['a', 'b'] : undefined,
      );
    expect(guard.canActivate(ctx({ permissions: ['a', 'b', 'c'] }))).toBe(true);
  });

  it('niega cuando falta un permiso', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockImplementation((key) =>
        key === 'permissions' ? ['a', 'z'] : undefined,
      );
    expect(() => guard.canActivate(ctx({ permissions: ['a'] }))).toThrow(
      ForbiddenException,
    );
  });

  it('modo "alguno de"', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockImplementation((key) =>
        key === 'anyPermission' ? ['x', 'y'] : undefined,
      );
    expect(guard.canActivate(ctx({ permissions: ['y'] }))).toBe(true);
    expect(() => guard.canActivate(ctx({ permissions: ['q'] }))).toThrow(
      ForbiddenException,
    );
  });
});

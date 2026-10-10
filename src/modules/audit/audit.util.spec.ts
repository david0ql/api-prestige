import { sanitizeForAudit } from './audit.util';

describe('sanitizeForAudit', () => {
  it('elimina secretos y reduce relaciones a referencias', () => {
    const out = sanitizeForAudit({
      id: '1',
      passwordHash: 'x',
      name: 'A',
      role: { id: 'r', code: 'ADMIN' },
      at: new Date('2026-01-01T00:00:00Z'),
      tags: ['a'],
    })!;
    expect(out.passwordHash).toBeUndefined();
    expect(out.roleRef).toBe('ADMIN');
    expect(out.at).toBe('2026-01-01T00:00:00.000Z');
    expect(out.tags).toEqual(['a']);
  });
});

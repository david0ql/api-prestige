import { mtSicsError, parseScaleReading } from './scale.util';

describe('parseScaleReading (RF-002)', () => {
  it.each([
    ['ST,GS,+  1000.25 g', 1000.25, true],
    ['+0001000.25 g', 1000.25, true],
    ['N    +1000.250 g', 1000.25, true],
    ['US,NT,  12.5 kg', 12500, false],
    ['ST,GS,  5 ct', 1, true],
    ['  250,5 g', 250.5, true],
    ['S S      100.00 g', 100, true],
    ['S D      100.07 g', 100.07, false],
    ['ST,GS,+   10.000 dwt', 15.5517384, true],
    ['+  154.3236 gn', 10, true],
  ])('%s → %d g', (raw, grams, stable) => {
    const r = parseScaleReading(raw)!;
    expect(r.grams).toBeCloseTo(grams, 4);
    expect(r.stable).toBe(stable);
  });

  it('devuelve null si no hay número', () => {
    expect(parseScaleReading('ERROR')).toBeNull();
  });
});

describe('Mettler Toledo MT-SICS (balanza de la Oficina Madre)', () => {
  it.each([
    ['S S      12.3456 g', 12.3456, true],
    ['S D      12.3400 g', 12.34, false],
    ['S S       1.2345 kg', 1234.5, true],
    ['S S       5.0000 ct', 1, true],
  ])('%s → %d g', (raw, grams, stable) => {
    const r = parseScaleReading(raw)!;
    expect(r.grams).toBeCloseTo(grams, 4);
    expect(r.stable).toBe(stable);
    expect(mtSicsError(raw)).toBeNull();
  });

  it.each([
    ['S +', 'OVERLOAD'],
    ['S -', 'UNDERLOAD'],
    ['S I', 'BUSY'],
    ['ES', 'SYNTAX'],
    ['ET', 'TRANSMISSION'],
    ['EL', 'LOGICAL'],
  ])('%s → estado %s sin peso', (raw, status) => {
    expect(mtSicsError(raw)).toBe(status);
    expect(parseScaleReading(raw)).toBeNull();
  });
});

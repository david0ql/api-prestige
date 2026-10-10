import { parseScaleReading } from './scale.util';

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

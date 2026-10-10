import { ReportExportService } from './report-export.service';

describe('ReportExportService (RF-040)', () => {
  const svc = new ReportExportService();
  const report = {
    key: 't',
    title: 'Prueba',
    columns: [
      { key: 'name', label: 'Nombre' },
      { key: 'grams', label: 'Gramos', type: 'grams' as const },
      { key: 'ok', label: 'OK', type: 'boolean' as const },
    ],
    rows: [
      { name: '=HYPERLINK("http://x")', grams: 1.5, ok: true },
      { name: 'Oro, 24K', grams: 2, ok: false },
    ],
    summary: { total: 3.5 },
  };

  it('CSV neutraliza inyección de fórmulas y escapa separadores', () => {
    const csv = svc.toCsv(report);
    expect(csv).toContain(`"'=HYPERLINK(""http://x"")"`);
    expect(csv).toContain('"Oro, 24K"');
    expect(csv).toContain('Sí');
  });

  it('genera un XLSX válido (zip)', async () => {
    const buf = await svc.toXlsx(report);
    expect(buf.subarray(0, 2).toString()).toBe('PK');
  });
});

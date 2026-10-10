import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { TabularReport } from './reports.types';

const GOLD = 'FFB8913A';
const INK = 'FF1A1712';

/** RF-040: exportación a formatos de oficina (Excel .xlsx y CSV). */
@Injectable()
export class ReportExportService {
  async toXlsx(report: TabularReport): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Prestige Gold';
    wb.created = new Date();
    const ws = wb.addWorksheet(report.title.slice(0, 31), { views: [{ state: 'frozen', ySplit: 4 }] });
    ws.mergeCells(1, 1, 1, Math.max(report.columns.length, 1));
    const title = ws.getCell(1, 1);
    title.value = `PRESTIGE GOLD · ${report.title}`;
    title.font = { bold: true, size: 14, color: { argb: GOLD } };
    title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INK } };
    ws.getRow(1).height = 24;
    const filterText = report.filters ? Object.entries(report.filters).map(([k, v]) => `${k}: ${String(v)}`).join('   ') : '';
    ws.getCell(2, 1).value = `${report.description ?? ''} ${filterText}`.trim();
    ws.getCell(2, 1).font = { italic: true, color: { argb: 'FF6B6255' } };
    const header = ws.getRow(4);
    report.columns.forEach((c, i) => {
      const cell = header.getCell(i + 1);
      cell.value = c.label;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GOLD } };
      cell.alignment = { vertical: 'middle' };
    });
    report.rows.forEach((r, ri) => {
      const row = ws.getRow(5 + ri);
      report.columns.forEach((c, ci) => {
        const v = r[c.key];
        const cell = row.getCell(ci + 1);
        if (v === null || v === undefined) cell.value = '';
        else if (c.type === 'boolean') cell.value = v ? 'Sí' : 'No';
        else if (c.type === 'date' || c.type === 'datetime') cell.value = v instanceof Date ? v : new Date(String(v));
        else if (['grams', 'money', 'number', 'percent'].includes(c.type ?? '')) cell.value = Number(v);
        else cell.value = String(v);
        if (c.type === 'grams') cell.numFmt = '#,##0.0000" g"';
        if (c.type === 'money') cell.numFmt = '"$"#,##0.00';
        if (c.type === 'percent') cell.numFmt = '0.00"%"';
        if (c.type === 'date') cell.numFmt = 'yyyy-mm-dd';
        if (c.type === 'datetime') cell.numFmt = 'yyyy-mm-dd hh:mm';
      });
    });
    report.columns.forEach((c, i) => {
      ws.getColumn(i + 1).width = Math.min(48, Math.max(12, c.label.length + 4));
    });
    ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: report.columns.length } };
    if (report.summary) {
      const s = wb.addWorksheet('Resumen');
      s.addRow(['Indicador', 'Valor']).font = { bold: true };
      for (const [k, v] of Object.entries(report.summary)) s.addRow([k, v]);
      s.getColumn(1).width = 32;
      s.getColumn(2).width = 20;
    }
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  toCsv(report: TabularReport): string {
    const esc = (v: unknown) => {
      if (v === null || v === undefined) return '';
      const s = v instanceof Date ? v.toISOString() : typeof v === 'boolean' ? (v ? 'Sí' : 'No') : String(v);
      // Neutraliza inyección de fórmulas en Excel (=, +, -, @).
      const safe = /^[=+\-@]/.test(s) && Number.isNaN(Number(s)) ? `'${s}` : s;
      return /[",\n;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
    };
    const lines = [report.columns.map((c) => esc(c.label)).join(',')];
    for (const r of report.rows) lines.push(report.columns.map((c) => esc(r[c.key])).join(','));
    return '﻿' + lines.join('\n');
  }
}

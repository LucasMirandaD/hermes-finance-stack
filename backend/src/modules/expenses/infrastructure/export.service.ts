import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export type ExportFormat = 'csv' | 'json';

export interface ExportExpenseRow {
  date: string;
  type: 'EXPENSE' | 'INSTALLMENT';
  merchantName: string;
  description: string;
  amount: number;
  currency: string;
  category: string;
  scope: string;
  isFixed: boolean;
  paymentMethod: string;
  bank: string;
  paidBy: string;
  installmentInfo: string;
  status: string;
}

export interface ExportResult {
  filePath: string;
  fileName: string;
  mediaTag: string;
  format: ExportFormat;
  rowCount: number;
  totalAmount: number;
  preview: string;
}

function escapeCsvCell(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);
  private readonly exportsDir: string;

  constructor(private readonly configService?: ConfigService) {
    this.exportsDir =
      this.configService?.get<string>('EXPORTS_DIR') ||
      process.env.EXPORTS_DIR ||
      '/opt/data/exports';
  }

  buildCsv(rows: ExportExpenseRow[]): string {
    const header = [
      'fecha',
      'tipo',
      'comercio',
      'descripcion',
      'monto',
      'moneda',
      'categoria',
      'alcance',
      'gasto_fijo',
      'medio_pago',
      'banco',
      'titular_pagador',
      'cuota',
      'estado',
    ].join(',');

    const lines = rows.map((row) =>
      [
        row.date,
        row.type,
        row.merchantName,
        row.description,
        row.amount.toFixed(2),
        row.currency,
        row.category,
        row.scope,
        row.isFixed ? 'SI' : 'NO',
        row.paymentMethod,
        row.bank,
        row.paidBy,
        row.installmentInfo,
        row.status,
      ]
        .map(escapeCsvCell)
        .join(','),
    );

    return `\uFEFF${[header, ...lines].join('\n')}\n`;
  }

  async exportToFile(
    rows: ExportExpenseRow[],
    format: ExportFormat,
    periodTag: string,
    outputDirOverride?: string,
  ): Promise<ExportResult> {
    const targetDir = outputDirOverride || this.exportsDir;
    await fs.mkdir(targetDir, { recursive: true });

    const safeTag = (periodTag || 'all')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-');
    const fileName = `expenses-${safeTag}-${Date.now()}.${format}`;
    const filePath = path.join(targetDir, fileName);

    const totalAmount =
      Math.round(rows.reduce((sum, r) => sum + Number(r.amount || 0), 0) * 100) / 100;

    const content =
      format === 'json'
        ? JSON.stringify(
            {
              exportedAt: new Date().toISOString(),
              periodTag,
              rowCount: rows.length,
              totalAmount,
              items: rows,
            },
            null,
            2,
          )
        : this.buildCsv(rows);

    await fs.writeFile(filePath, content, 'utf8');
    this.logger.log(`Exported ${rows.length} rows (${format}) to ${filePath}`);

    return {
      filePath,
      fileName,
      mediaTag: `MEDIA:${filePath}`,
      format,
      rowCount: rows.length,
      totalAmount,
      preview: content.slice(0, 600),
    };
  }
}

import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { ExportService } from './export.service';

describe('ExportService', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    for (const dir of tempDirs) {
      await fs.rm(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  it('should export CSV with UTF-8 BOM and proper escaping', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hermes-export-test-'));
    tempDirs.push(tmpDir);

    const exportService = new ExportService();
    const res = await exportService.exportToFile(
      [
        {
          date: '2026-11-10',
          type: 'EXPENSE',
          merchantName: 'Coto "Centro", S.A.',
          description: 'Compra semanal',
          amount: 45200.5,
          currency: 'ARS',
          category: 'SUPERMERCADO',
          scope: 'SHARED',
          isFixed: false,
          paymentMethod: 'CREDIT_CARD',
          bank: 'Galicia',
          paidBy: 'Alice',
          installmentInfo: '',
          status: 'PAID',
        },
      ],
      'csv',
      '2026-11',
      tmpDir,
    );

    expect(res.format).toBe('csv');
    expect(res.rowCount).toBe(1);
    expect(res.mediaTag).toBe(`MEDIA:${res.filePath}`);

    const content = await fs.readFile(res.filePath, 'utf8');
    expect(content.startsWith('\uFEFFfecha,tipo,comercio')).toBe(true);
    expect(content).toContain('"Coto ""Centro"", S.A."');
    expect(content).toContain('45200.50');
  });

  it('should export valid JSON file', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hermes-export-json-'));
    tempDirs.push(tmpDir);

    const exportService = new ExportService();
    const res = await exportService.exportToFile([], 'json', '2026-11', tmpDir);

    const parsed = JSON.parse(await fs.readFile(res.filePath, 'utf8'));
    expect(parsed.rowCount).toBe(0);
    expect(parsed.items).toEqual([]);
  });
});

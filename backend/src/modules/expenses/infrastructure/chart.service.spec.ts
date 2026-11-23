import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { ChartService } from './chart.service';

describe('ChartService', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    for (const dir of tempDirs) {
      await fs.rm(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  it('should render valid PNG images for donut and bar charts', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hermes-chart-test-'));
    tempDirs.push(tmpDir);

    const chartService = new ChartService();

    const donut = await chartService.renderChartPng(
      {
        chartType: 'by_category',
        title: 'Gastos por Categoría — Noviembre 2026',
        subtitle: 'Total pagado: $150.000',
        totalAmount: 150000,
        periodTag: '2026-11',
        items: [
          { label: 'SUPERMERCADO', value: 90000, percentage: 60 },
          { label: 'IMPUESTOS_Y_SERVICIOS', value: 60000, percentage: 40 },
        ],
      },
      tmpDir,
    );

    expect(donut.mediaTag).toBe(`MEDIA:${donut.filePath}`);
    const bytes = await fs.readFile(donut.filePath);
    // PNG magic bytes: 89 50 4E 47
    expect(bytes[0]).toBe(0x89);
    expect(bytes[1]).toBe(0x50);
    expect(bytes[2]).toBe(0x4e);
    expect(bytes[3]).toBe(0x47);
    expect(bytes.byteLength).toBeGreaterThan(2048);

    const trend = await chartService.renderChartPng(
      {
        chartType: 'monthly_trend',
        title: 'Evolución Mensual',
        totalAmount: 250000,
        periodTag: '2026',
        items: [
          { label: '2026-10', value: 100000 },
          { label: '2026-11', value: 150000 },
        ],
      },
      tmpDir,
    );
    const trendBytes = await fs.readFile(trend.filePath);
    expect(trendBytes[0]).toBe(0x89);
    expect(trendBytes.byteLength).toBeGreaterThan(2048);
  });
});

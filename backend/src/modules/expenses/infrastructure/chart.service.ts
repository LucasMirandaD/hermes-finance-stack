import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { initWasm, Resvg } from '@resvg/resvg-wasm';

export type ChartType =
  | 'by_category'
  | 'monthly_trend'
  | 'top_expenses'
  | 'fixed_vs_variable'
  | 'by_holder';

export interface ChartDataItem {
  label: string;
  value: number;
  percentage?: number;
  hint?: string;
}

export interface RenderChartInput {
  chartType: ChartType;
  title: string;
  subtitle?: string;
  currency?: string;
  totalAmount: number;
  items: ChartDataItem[];
  periodTag?: string;
}

export interface RenderChartResult {
  filePath: string;
  fileName: string;
  mediaTag: string;
  chartType: ChartType;
  title: string;
  totalAmount: number;
  itemsCount: number;
}

const PALETTE = [
  '#38bdf8',
  '#34d399',
  '#a78bfa',
  '#fbbf24',
  '#fb7185',
  '#22d3ee',
  '#f97316',
  '#c084fc',
  '#94a3b8',
];

const FONT_SEARCH_DIRS = [
  '/usr/share/fonts/ttf-dejavu',
  '/usr/share/fonts/truetype/dejavu',
];

let wasmInitPromise: Promise<void> | null = null;
let cachedFontBuffers: Uint8Array[] | null = null;

function escapeXml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function truncateText(text: string, maxLen: number): string {
  const clean = text.trim();
  return clean.length > maxLen ? `${clean.slice(0, maxLen - 1)}…` : clean;
}

function formatMoney(amount: number, currency = 'ARS'): string {
  const rounded = Math.round(amount * 100) / 100;
  const formatted = new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: rounded % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(rounded);
  return currency && currency !== 'ARS' ? `${currency} ${formatted}` : `$ ${formatted}`;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeDonutArc(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startAngle: number,
  endAngle: number,
): string {
  const sweep = Math.min(endAngle - startAngle, 359.99);
  const adjustedEnd = startAngle + sweep;
  const largeArc = sweep > 180 ? 1 : 0;

  const p1 = polarToCartesian(cx, cy, outerR, startAngle);
  const p2 = polarToCartesian(cx, cy, outerR, adjustedEnd);
  const p3 = polarToCartesian(cx, cy, innerR, adjustedEnd);
  const p4 = polarToCartesian(cx, cy, innerR, startAngle);

  return [
    `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
    `L ${p3.x.toFixed(2)} ${p3.y.toFixed(2)}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${p4.x.toFixed(2)} ${p4.y.toFixed(2)}`,
    'Z',
  ].join(' ');
}

@Injectable()
export class ChartService {
  private readonly logger = new Logger(ChartService.name);
  private readonly chartsDir: string;

  constructor(private readonly configService?: ConfigService) {
    this.chartsDir =
      this.configService?.get<string>('CHARTS_DIR') ||
      process.env.CHARTS_DIR ||
      '/opt/data/charts';
  }

  private async ensureWasmAndFonts(): Promise<Uint8Array[]> {
    if (!wasmInitPromise) {
      wasmInitPromise = (async () => {
        const pkgDir = path.dirname(require.resolve('@resvg/resvg-wasm'));
        const wasmBuffer = await fs.readFile(path.join(pkgDir, 'index_bg.wasm'));
        await initWasm(wasmBuffer);
      })().catch((err) => {
        wasmInitPromise = null;
        throw err;
      });
    }
    await wasmInitPromise;

    if (!cachedFontBuffers) {
      const buffers: Uint8Array[] = [];
      for (const dir of FONT_SEARCH_DIRS) {
        for (const fontName of ['DejaVuSans.ttf', 'DejaVuSans-Bold.ttf']) {
          try {
            const buf = await fs.readFile(path.join(dir, fontName));
            buffers.push(buf);
          } catch {
            // Try next candidate path
          }
        }
        if (buffers.length > 0) break;
      }
      cachedFontBuffers = buffers;
    }

    return cachedFontBuffers;
  }

  private buildHeaderSvg(title: string, subtitle?: string): string {
    return `
      <rect x="0" y="0" width="800" height="480" rx="20" fill="#0f172a"/>
      <rect x="16" y="16" width="768" height="448" rx="16" fill="#111827" stroke="#1e293b" stroke-width="1.5"/>
      <text x="42" y="56" font-family="DejaVu Sans" font-size="22" font-weight="bold" fill="#f8fafc">${escapeXml(truncateText(title, 54))}</text>
      ${
        subtitle
          ? `<text x="42" y="82" font-family="DejaVu Sans" font-size="13" fill="#94a3b8">${escapeXml(truncateText(subtitle, 78))}</text>`
          : ''
      }
      <line x1="42" y1="98" x2="758" y2="98" stroke="#1e293b" stroke-width="1"/>
    `;
  }

  private buildDonutSvg(input: RenderChartInput): string {
    const positiveItems = input.items.filter((i) => i.value > 0);
    if (positiveItems.length === 0) {
      return this.buildEmptySvg(input);
    }

    const maxSlices = 7;
    let displayItems = [...positiveItems];
    if (displayItems.length > maxSlices) {
      const top = displayItems.slice(0, maxSlices);
      const restSum = displayItems.slice(maxSlices).reduce((s, i) => s + i.value, 0);
      const totalAll = displayItems.reduce((s, i) => s + i.value, 0);
      top.push({
        label: 'Otros',
        value: restSum,
        percentage: totalAll > 0 ? Math.round((restSum / totalAll) * 1000) / 10 : 0,
      });
      displayItems = top;
    }

    const total = displayItems.reduce((s, i) => s + i.value, 0) || 1;
    const cx = 205;
    const cy = 278;
    const outerR = 122;
    const innerR = 72;

    let currentAngle = 0;
    const paths: string[] = [];
    const legends: string[] = [];

    displayItems.forEach((item, idx) => {
      const color = PALETTE[idx % PALETTE.length];
      const pct = item.percentage ?? Math.round((item.value / total) * 1000) / 10;
      const angle = (item.value / total) * 360;
      if (angle > 0.2) {
        paths.push(
          `<path d="${describeDonutArc(cx, cy, outerR, innerR, currentAngle, currentAngle + angle)}" fill="${color}"/>`,
        );
      }
      currentAngle += angle;

      const ly = 148 + idx * 38;
      const label = truncateText(item.label, 24);
      const amountStr = formatMoney(item.value, input.currency);
      legends.push(`
        <circle cx="372" cy="${ly - 5}" r="6" fill="${color}"/>
        <text x="388" y="${ly}" font-family="DejaVu Sans" font-size="13" font-weight="bold" fill="#e2e8f0">${escapeXml(label)}</text>
        <text x="748" y="${ly}" text-anchor="end" font-family="DejaVu Sans" font-size="13" fill="#f8fafc">${escapeXml(amountStr)} (${pct.toFixed(1)}%)</text>
        <line x1="372" y1="${ly + 12}" x2="748" y2="${ly + 12}" stroke="#1e293b" stroke-width="0.8"/>
      `);
    });

    const centerTotal = formatMoney(input.totalAmount || total, input.currency);
    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="800" height="480" viewBox="0 0 800 480">
        ${this.buildHeaderSvg(input.title, input.subtitle)}
        ${paths.join('\n')}
        <text x="${cx}" y="${cy - 8}" text-anchor="middle" font-family="DejaVu Sans" font-size="12" fill="#94a3b8">Total</text>
        <text x="${cx}" y="${cy + 14}" text-anchor="middle" font-family="DejaVu Sans" font-size="15" font-weight="bold" fill="#f8fafc">${escapeXml(centerTotal)}</text>
        ${legends.join('\n')}
      </svg>
    `;
  }

  private buildVerticalBarsSvg(input: RenderChartInput): string {
    const items = input.items.slice(0, 12);
    if (items.length === 0 || items.every((i) => i.value <= 0)) {
      return this.buildEmptySvg(input);
    }

    const chartLeft = 72;
    const chartRight = 748;
    const chartTop = 140;
    const chartBottom = 400;
    const chartHeight = chartBottom - chartTop;
    const chartWidth = chartRight - chartLeft;
    const maxVal = Math.max(...items.map((i) => i.value), 1);

    const gridLines: string[] = [];
    for (let step = 0; step <= 4; step++) {
      const y = chartBottom - (chartHeight * step) / 4;
      const tickVal = Math.round((maxVal * step) / 4);
      gridLines.push(`
        <line x1="${chartLeft}" y1="${y.toFixed(1)}" x2="${chartRight}" y2="${y.toFixed(1)}" stroke="#1e293b" stroke-width="1"/>
        <text x="${chartLeft - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-family="DejaVu Sans" font-size="10" fill="#64748b">${escapeXml(formatMoney(tickVal, input.currency))}</text>
      `);
    }

    const slotWidth = chartWidth / items.length;
    const barWidth = Math.min(48, Math.max(18, slotWidth * 0.6));
    const bars = items
      .map((item, idx) => {
        const barH = Math.max(4, (item.value / maxVal) * chartHeight);
        const x = chartLeft + idx * slotWidth + (slotWidth - barWidth) / 2;
        const y = chartBottom - barH;
        const color = PALETTE[idx % PALETTE.length];
        const shortVal =
          item.value >= 1_000_000
            ? `${(item.value / 1_000_000).toFixed(1)}M`
            : item.value >= 1_000
              ? `${Math.round(item.value / 1_000)}k`
              : `${Math.round(item.value)}`;
        return `
          <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${barH.toFixed(1)}" rx="6" fill="${color}"/>
          <text x="${(x + barWidth / 2).toFixed(1)}" y="${(y - 8).toFixed(1)}" text-anchor="middle" font-family="DejaVu Sans" font-size="11" font-weight="bold" fill="#e2e8f0">${escapeXml(shortVal)}</text>
          <text x="${(x + barWidth / 2).toFixed(1)}" y="${chartBottom + 22}" text-anchor="middle" font-family="DejaVu Sans" font-size="11" fill="#94a3b8">${escapeXml(truncateText(item.label, 10))}</text>
        `;
      })
      .join('\n');

    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="800" height="480" viewBox="0 0 800 480">
        ${this.buildHeaderSvg(input.title, input.subtitle)}
        ${gridLines.join('\n')}
        ${bars}
      </svg>
    `;
  }

  private buildHorizontalBarsSvg(input: RenderChartInput): string {
    const items = input.items.filter((i) => i.value > 0).slice(0, 8);
    if (items.length === 0) {
      return this.buildEmptySvg(input);
    }

    const maxVal = Math.max(...items.map((i) => i.value), 1);
    const barLeft = 240;
    const barMaxWidth = 370;

    const rows = items
      .map((item, idx) => {
        const y = 136 + idx * 40;
        const width = Math.max(8, (item.value / maxVal) * barMaxWidth);
        const color = PALETTE[idx % PALETTE.length];
        const amountText = formatMoney(item.value, input.currency);
        const suffix = item.percentage !== undefined ? ` (${item.percentage.toFixed(1)}%)` : '';
        return `
          <text x="42" y="${y + 17}" font-family="DejaVu Sans" font-size="13" fill="#e2e8f0">${escapeXml(truncateText(item.label, 24))}</text>
          <rect x="${barLeft}" y="${y + 3}" width="${barMaxWidth}" height="20" rx="6" fill="#1e293b"/>
          <rect x="${barLeft}" y="${y + 3}" width="${width.toFixed(1)}" height="20" rx="6" fill="${color}"/>
          <text x="${barLeft + barMaxWidth + 12}" y="${y + 17}" font-family="DejaVu Sans" font-size="12" font-weight="bold" fill="#f8fafc">${escapeXml(amountText + suffix)}</text>
        `;
      })
      .join('\n');

    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="800" height="480" viewBox="0 0 800 480">
        ${this.buildHeaderSvg(input.title, input.subtitle)}
        ${rows}
      </svg>
    `;
  }

  private buildEmptySvg(input: RenderChartInput): string {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="800" height="480" viewBox="0 0 800 480">
        ${this.buildHeaderSvg(input.title, input.subtitle)}
        <text x="400" y="265" text-anchor="middle" font-family="DejaVu Sans" font-size="16" fill="#94a3b8">Sin gastos registrados para el período seleccionado</text>
      </svg>
    `;
  }

  private buildSvg(input: RenderChartInput): string {
    switch (input.chartType) {
      case 'by_category':
      case 'fixed_vs_variable':
        return this.buildDonutSvg(input);
      case 'monthly_trend':
        return this.buildVerticalBarsSvg(input);
      case 'top_expenses':
      case 'by_holder':
      default:
        return this.buildHorizontalBarsSvg(input);
    }
  }

  async renderChartPng(
    input: RenderChartInput,
    outputDirOverride?: string,
  ): Promise<RenderChartResult> {
    const targetDir = outputDirOverride || this.chartsDir;
    await fs.mkdir(targetDir, { recursive: true });

    const fontBuffers = await this.ensureWasmAndFonts();
    const svg = this.buildSvg(input);

    const resvg = new Resvg(svg, {
      fitTo: { mode: 'width', value: 800 },
      font:
        fontBuffers.length > 0
          ? {
              fontBuffers,
              defaultFontFamily: 'DejaVu Sans',
              sansSerifFamily: 'DejaVu Sans',
            }
          : {
              loadSystemFonts: true,
              defaultFontFamily: 'DejaVu Sans',
            },
    });

    const rendered = resvg.render();
    const pngBytes = rendered.asPng();
    rendered.free();
    resvg.free();

    const safeTag = (input.periodTag || 'current')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-');
    const fileName = `chart-${input.chartType}-${safeTag}-${Date.now()}.png`;
    const filePath = path.join(targetDir, fileName);

    await fs.writeFile(filePath, pngBytes);
    this.logger.log(`Generated PNG chart: ${filePath} (${pngBytes.byteLength} bytes)`);

    return {
      filePath,
      fileName,
      mediaTag: `MEDIA:${filePath}`,
      chartType: input.chartType,
      title: input.title,
      totalAmount: Math.round(input.totalAmount * 100) / 100,
      itemsCount: input.items.length,
    };
  }
}

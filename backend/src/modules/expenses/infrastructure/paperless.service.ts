import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { IExpensesRepository } from '../data/repositories/i-expenses.repository';

const ALLOWED_MEDIA_ROOTS = ['/opt/data', '/hermes-data'];

@Injectable()
export class PaperlessService {
  private readonly logger = new Logger(PaperlessService.name);
  private readonly baseUrl: string;
  private readonly apiToken: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly expensesRepo: IExpensesRepository,
  ) {
    this.baseUrl = (
      this.configService.get<string>('PAPERLESS_BASE_URL') || 'http://paperless:8000'
    ).replace(/\/+$/, '');
    this.apiToken = (this.configService.get<string>('PAPERLESS_API_TOKEN') || '').trim();
  }

  private resolveSafeMediaPath(filePath: string): string {
    const resolved = path.resolve(filePath);
    const isAllowed = ALLOWED_MEDIA_ROOTS.some(
      (root) => resolved === root || resolved.startsWith(`${root}${path.sep}`),
    );
    if (!isAllowed) {
      throw new Error(`Unsafe or disallowed file path for Paperless upload: ${filePath}`);
    }
    return resolved;
  }

  private inferMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    if (ext === '.pdf') return 'application/pdf';
    if (ext === '.png') return 'image/png';
    if (ext === '.webp') return 'image/webp';
    return 'image/jpeg';
  }

  /**
   * Fires an asynchronous Paperless upload & links the resulting paperlessDocumentId
   * back to the Expense record once indexing finishes, avoiding response latency.
   */
  archiveExpenseDocumentAsync(expenseId: string, filePath: string, title?: string): void {
    if (!this.apiToken || !filePath) return;

    void (async () => {
      try {
        const result = await this.uploadAndPoll(filePath, title, false);
        if (result.documentId) {
          await this.expensesRepo.updateExpensePaperlessId(expenseId, result.documentId);
          this.logger.log(
            `Linked Paperless doc #${result.documentId} to expense ${expenseId}`,
          );
        }
      } catch (err: any) {
        this.logger.warn(
          `Async Paperless archival failed for expense ${expenseId}: ${err?.message || err}`,
        );
      }
    })();
  }

  /**
   * Synchronously uploads a scanned PDF/image and waits for Paperless OCR text.
   * Only intended as a fallback when direct PDF extraction yields insufficient text.
   */
  async extractScannedPdfOcr(
    filePath: string,
    title?: string,
  ): Promise<{ documentId: number | null; ocrText: string }> {
    return this.uploadAndPoll(filePath, title, true);
  }

  private async uploadAndPoll(
    filePath: string,
    title?: string,
    fetchOcrContent: boolean = true,
  ): Promise<{ documentId: number | null; ocrText: string }> {
    if (!this.apiToken) {
      this.logger.warn('PAPERLESS_API_TOKEN not set; skipping Paperless upload.');
      return { documentId: null, ocrText: '' };
    }

    const safePath = this.resolveSafeMediaPath(filePath);
    const buffer = await fs.readFile(safePath);
    const filename = path.basename(safePath);
    const mimeType = this.inferMimeType(filename);

    const form = new FormData();
    form.append('document', new Blob([buffer], { type: mimeType }), filename);
    form.append('title', title || filename);
    form.append('tags', '6'); // Tag 'Hermes' (id 6)

    const headers = { Authorization: `Token ${this.apiToken}` };
    const postRes = await fetch(`${this.baseUrl}/api/documents/post_document/`, {
      method: 'POST',
      headers,
      body: form,
    });

    if (!postRes.ok) {
      const errText = await postRes.text();
      throw new Error(`Paperless upload HTTP ${postRes.status}: ${errText}`);
    }

    const taskId = (await postRes.text()).replace(/^"|"$/g, '').trim();
    this.logger.log(`Uploaded ${filename} to Paperless (task ${taskId})`);

    let documentId: number | null = null;
    for (let attempt = 0; attempt < 25; attempt++) {
      await new Promise((r) => setTimeout(r, 1500));
      const taskRes = await fetch(
        `${this.baseUrl}/api/tasks/?task_id=${encodeURIComponent(taskId)}`,
        { headers },
      );
      if (!taskRes.ok) continue;

      const tasks = (await taskRes.json()) as Array<{
        status?: string;
        related_document?: number;
      }>;
      if (tasks?.length > 0) {
        if (tasks[0].status === 'SUCCESS') {
          documentId = tasks[0].related_document ?? null;
          break;
        }
        if (tasks[0].status === 'FAILURE') {
          throw new Error(`Paperless task ${taskId} failed`);
        }
      }
    }

    let ocrText = '';
    if (documentId && fetchOcrContent) {
      const docRes = await fetch(`${this.baseUrl}/api/documents/${documentId}/`, {
        headers,
      });
      if (docRes.ok) {
        const docJson = (await docRes.json()) as { content?: string };
        ocrText = docJson.content || '';
      }
    }

    return { documentId, ocrText };
  }
}

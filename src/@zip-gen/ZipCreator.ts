import * as archiver from 'archiver';
import * as fs from 'fs';
import { Readable } from 'stream';

export class ZipCreator {
  private maxSize: number;
  private currentSize: number;
  private currentArchive: archiver.Archiver | null;
  private archiveIndex: number;

  constructor(maxSize: number = 40 * 1024 * 1024) {
    // Default max size: 40MB
    this.maxSize = maxSize;
    this.currentSize = 0;
    this.currentArchive = null;
    this.archiveIndex = 0;
  }

  private async appendToArchive(id: string, pdfStream: NodeJS.ReadWriteStream): Promise<void> {
    let chunks: Buffer[] = [];
    pdfStream.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
      this.currentSize += chunk.length;
    });

    return new Promise((resolve, reject) => {
      pdfStream.on('end', () => {
        const completePdfFile = Buffer.concat(chunks);
        if (this.currentSize >= this.maxSize) {
          this.finalizeArchive(); // Finalize and save the current archive
          this.createNewArchive(); // Create a new archive for the next files
        }
        this.currentArchive?.append(completePdfFile, { name: `${id}.pdf` });
        resolve();
      });
      pdfStream.on('error', reject);
    });
  }

  private createNewArchive(): void {
    this.currentArchive = archiver('zip', { zlib: { level: 9 } });
    this.currentSize = 0;
    this.archiveIndex++;
    const output = fs.createWriteStream(`archive_${this.archiveIndex}.zip`);
    this.currentArchive.pipe(output);
  }

  private finalizeArchive(): void {
    if (this.currentArchive) {
      this.currentArchive.finalize();
      this.currentArchive = null;
    }
  }

  public async createZipFile(
    relatoriosIds: string[],
    pdfStream: NodeJS.ReadWriteStream,
  ): Promise<void> {
    this.createNewArchive(); // Initialize the first archive
    for (const id of relatoriosIds) {
      await this.appendToArchive(id, pdfStream);
    }
    this.finalizeArchive(); // Finalize the last archive
  }
}

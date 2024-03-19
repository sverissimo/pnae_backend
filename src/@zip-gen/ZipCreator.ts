import * as archiver from 'archiver';
import * as fs from 'fs';
import * as path from 'path';
import { RelatorioModel } from 'src/@domain/relatorio/relatorio-model';

export type zipFileInput = {
  [municipio: string]: {
    relatorios: RelatorioModel[];
  };
};

interface CreateRelatorioStream {
  (relatorioId: string, relatorio: RelatorioModel): Promise<{
    filename: string;
    pdfStream: NodeJS.ReadableStream;
  }>;
}

export class ZipCreator {
  private municipio: string;
  private relatorios: RelatorioModel[];
  private currentArchive: archiver.Archiver | null | undefined;
  private createRelatorioStream: CreateRelatorioStream;
  private tempZipFiles: string[] = [];

  private output: fs.WriteStream;

  private readonly maxSize = 40 * 1024 * 1024;
  private currentSize = 0;
  private archiveIndex = 0;

  constructor(
    municipio: string,
    relatorios: RelatorioModel[],
    createRelatorioStream: CreateRelatorioStream,
  ) {
    this.municipio = municipio;
    this.relatorios = relatorios;
    this.createRelatorioStream = createRelatorioStream;
  }

  private async createAndAppendPDF(
    filename: string,
    pdfStream: NodeJS.ReadableStream,
  ): Promise<void> {
    if (this.currentArchive === undefined) {
      this.createNewArchive();
    }

    let chunks = [];
    pdfStream.on('data', (chunk) => {
      chunks.push(chunk);
      this.currentSize += chunk.length;
    });

    await new Promise<void>((resolve, reject) => {
      pdfStream.on('end', async () => {
        const completePdfFile = Buffer.concat(chunks);
        if (this.currentSize >= this.maxSize) {
          await this.finalizeArchive();
          this.createNewArchive();
          this.currentSize = chunks.reduce(
            (acc, chunk) => acc + chunk.length,
            0,
          );
        }
        // console.log(filename);
        // console.log('########## currentSize: ', this.currentSize);
        this.currentArchive?.append(completePdfFile, {
          name: `${filename}`,
        });
        resolve();
      });
      pdfStream.on('error', reject);
    });
  }

  private createNewArchive() {
    this.currentArchive = archiver('zip', { zlib: { level: 9 } });
    this.currentSize = 0;
    this.archiveIndex++;
    const filePath = `${this.municipio} ${this.archiveIndex}.zip`;
    this.tempZipFiles.push(filePath);
    this.output = fs.createWriteStream(filePath);
    this.currentArchive.pipe(this.output);
  }

  private async finalizeArchive() {
    await new Promise<void>((resolve, reject) => {
      this.currentArchive!.on('error', reject);
      this.output.on('finish', resolve);
      this.currentArchive!.finalize();
    });
    this.currentArchive = null;
  }

  public async generateZipFiles(): Promise<string[]> {
    for (const relatorio of this.relatorios) {
      const { pdfStream, filename } = await this.createRelatorioStream(
        relatorio.id,
        relatorio,
      );
      await this.createAndAppendPDF(filename, pdfStream);
    }

    await this.finalizeArchive();
    return this.tempZipFiles;
  }

  public static async generateFinalZip(filePaths: string[]): Promise<string> {
    const zipPath = process.env.ZIP_FILES_PATH;
    const parentOutput = fs.createWriteStream(`${zipPath}/final.zip`);
    const parentArchive = archiver('zip', { zlib: { level: 9 } });

    parentArchive.pipe(parentOutput);

    for (const tempZipPath of filePaths) {
      parentArchive.append(fs.createReadStream(tempZipPath), {
        name: path.basename(tempZipPath),
      });
    }
    await new Promise<void>((resolve, reject) => {
      parentArchive!.on('error', reject);
      parentOutput.on('finish', resolve);
      parentArchive.finalize();
    });

    try {
      filePaths.forEach((tempZipPath) => fs.unlinkSync(tempZipPath));
    } catch (error) {
      console.info('🚀 - ZipCreator - generateNestedZip - error:', error);
    }

    return 'final.zip created.';
  }
}

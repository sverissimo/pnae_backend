import * as archiver from 'archiver';
import * as os from 'os';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import { RelatorioModel } from 'src/@domain/relatorio/relatorio-model';
import { ZipCreatorOptions } from './types/temp-zip-part';

type MunicipioBucket = { municipio: string; relatorios: RelatorioModel[] };
let i = 0;
export class ZipCreator {
  private region: string;
  private readonly maxSize: number;
  private readonly tmpRootDir: string;

  constructor(region: string, private opts?: ZipCreatorOptions) {
    this.region = region || 'regional_nao_encontrada';
    this.maxSize = opts?.maxSizeBytes ?? 40 * 1024 * 1024;
    this.tmpRootDir = opts?.tmpRootDir ?? path.join(os.tmpdir(), 'pnae-zips');
  }

  private async ensureTmpDir() {
    await fsp.mkdir(this.tmpRootDir, { recursive: true });
  }

  private sanitizeRegionName(s: string): string {
    return (s ?? '')
      .normalize('NFKC')
      .replace(/[\/\\:*?"<>|]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private createNewArchive(
    partIndex: number,
    regionZipPaths: string[],
  ): { archive: archiver.Archiver; output: fs.WriteStream } {
    const regionName = this.sanitizeRegionName(this.region);
    const fileName = `${regionName}_${partIndex}.zip`; // always suffix here
    const filePath = path.join(this.tmpRootDir, fileName);

    const output = fs.createWriteStream(filePath);
    const archive = archiver('zip', { zlib: { level: 0 } });

    archive.on('warning', (e) => console.warn('[ZipCreator] warn:', e));
    archive.on('error', (e) => {
      throw e;
    });
    archive.pipe(output);

    regionZipPaths.push(filePath);
    return { archive, output };
  }

  private async finalizeArchive(
    archive: archiver.Archiver | null,
    output: fs.WriteStream | null,
  ): Promise<void> {
    if (!archive || !output) return;
    await new Promise<void>((resolve, reject) => {
      output.once('finish', resolve);
      archive.once('error', reject);
      archive.finalize();
    });
  }

  public async generateRegionZipParts(
    municipios: MunicipioBucket[],
    createRelatorioStream: (
      relatorio: RelatorioModel,
    ) => Promise<{ filename: string; filePath: string }>,
  ): Promise<string[]> {
    await this.ensureTmpDir();

    const regionZipPaths: string[] = [];
    let archive: archiver.Archiver | null = null;
    let output: fs.WriteStream | null = null;
    let partIndex = 0;
    let currentSize = 0;

    // 1) Flatten all relatorios for this region (stable order by municipio)
    const items = [...municipios]
      .sort((a, b) => a.municipio.localeCompare(b.municipio))
      .flatMap(({ municipio, relatorios }) =>
        relatorios.map((relatorio) => ({ municipio, relatorio })),
      );

    console.log(items.length, 'relatórios to process');

    // 2) Generate PDFs CONCURRENTLY (bounded by the limiter wrapped in createRelatorioStream)
    const results = await Promise.all(
      items.map(async ({ municipio, relatorio }) => {
        try {
          i++;
          console.log('[ZipCreator] Generating PDF #', i);
          const { filename, filePath } = await createRelatorioStream(relatorio);
          const { size } = await fsp.stat(filePath);
          return { filename, filePath, size };
        } catch (err) {
          console.error(
            `[ZipCreator] Failed PDF for relatório ${relatorio.id} (${this.region} / ${municipio}):`,
            err,
          );
          return null;
        }
      }),
    );

    const files = results.filter(
      (x): x is { filename: string; filePath: string; size: number } => !!x,
    );

    // 3) Append SEQUENTIALLY while respecting 40MB split
    for (const { filename, filePath, size } of files) {
      if (!archive) {
        partIndex += 1;
        ({ archive, output } = this.createNewArchive(
          partIndex,
          regionZipPaths,
        ));
        currentSize = 0;
      }

      if (currentSize > 0 && currentSize + size > this.maxSize) {
        await this.finalizeArchive(archive, output);
        partIndex += 1;
        ({ archive, output } = this.createNewArchive(
          partIndex,
          regionZipPaths,
        ));
        currentSize = 0;
      }

      archive.append(fs.createReadStream(filePath), { name: filename });
      currentSize += size;
    }

    await this.finalizeArchive(archive, output);

    await this.cleanupTempFiles(files);
    const finalRegionPaths = await this.mightRenameSinglePart(regionZipPaths);
    return finalRegionPaths;
  }

  private async cleanupTempFiles(files: { filePath: string }[]) {
    for (const f of files) {
      try {
        await fsp.unlink(f.filePath);
      } catch {
        console.warn(`[ZipCreator] Could not cleanup temp file: ${f.filePath}`);
      }
    }
  }

  private async mightRenameSinglePart(
    regionZipPaths: string[],
  ): Promise<string[]> {
    if (regionZipPaths.length === 1) {
      const oldPath = regionZipPaths[0];
      const newPath = path.join(
        path.dirname(oldPath),
        `${this.sanitizeRegionName(this.region)}.zip`,
      );
      await fsp.rename(oldPath, newPath);
      return [newPath];
    }
    return regionZipPaths;
  }

  /**
   * Packs all region-part zip files into a single final zip (root level),
   * then deletes the temporary part files.
   */
  public static async generateFinalZip(filePaths: string[]): Promise<string> {
    if (!filePaths.length) throw new Error('Nenhum arquivo para compactar.');

    const zipPathRoot =
      process.env.ZIP_FILES_PATH || path.resolve(process.cwd(), 'zips');
    await fsp.mkdir(zipPathRoot, { recursive: true });

    const stamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '')
      .replace('T', '_')
      .slice(0, 15);
    const finalZipPath = path.join(zipPathRoot, `relatorios_${stamp}.zip`);

    const output = fs.createWriteStream(finalZipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('warning', (e) => console.warn('[ZipCreator:final] warn:', e));
    archive.on('error', (e) => {
      throw e;
    });
    archive.pipe(output);

    for (const p of filePaths) {
      archive.append(fs.createReadStream(p), { name: path.basename(p) });
    }

    await new Promise<void>((resolve, reject) => {
      output.once('finish', resolve);
      archive.once('error', reject);
      archive.finalize();
    });

    // cleanup temp region parts
    for (const p of filePaths) {
      try {
        await fsp.unlink(p);
      } catch (err) {
        console.info('[ZipCreator] Temp cleanup error:', err);
      }
    }

    return finalZipPath;
  }
}

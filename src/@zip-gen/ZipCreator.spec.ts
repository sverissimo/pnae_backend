import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { ZipCreator } from './ZipCreator';

describe('ZipCreator', () => {
  let tmpDir: string;
  const originalZipPath = process.env.ZIP_FILES_PATH;

  beforeEach(async () => {
    tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'zip-creator-test-'));
    process.env.ZIP_FILES_PATH = tmpDir;
  });

  afterEach(async () => {
    if (originalZipPath === undefined) {
      delete process.env.ZIP_FILES_PATH;
    } else {
      process.env.ZIP_FILES_PATH = originalZipPath;
    }
    await fsp.rm(tmpDir, { recursive: true, force: true });
  });

  it('generates region zip parts from generic items and removes temp PDF files', async () => {
    const pdfA = await writeTempFile('a.pdf', 'A');
    const pdfB = await writeTempFile('b.pdf', 'B');
    const creator = new ZipCreator('SRE Sul', {
      tmpRootDir: path.join(tmpDir, 'parts'),
    });

    const paths = await creator.generateRegionZipParts(
      [{ municipio: 'Lavras', items: [{ id: '1' }, { id: '2' }] }],
      async (item) => ({
        filename: `relatorio_${item.id}.pdf`,
        filePath: item.id === '1' ? pdfA : pdfB,
      }),
      (item) => item.id,
    );

    expect(paths).toHaveLength(1);
    expect(path.basename(paths[0])).toBe('SRE Sul.zip');
    await expect(fsp.access(paths[0], fs.constants.R_OK)).resolves.toBeUndefined();
    await expect(fsp.access(pdfA)).rejects.toBeTruthy();
    await expect(fsp.access(pdfB)).rejects.toBeTruthy();
  });

  it('packs final zip using an explicit filename and deletes region parts', async () => {
    const partA = await writeTempFile('SRE_A.zip', 'A');
    const partB = await writeTempFile('SRE_B.zip', 'B');

    const finalPath = await ZipCreator.generateFinalZip({
      filePaths: [partA, partB],
      finalZipName: 'relatorios_atendimentos_2026-07-03_153000.zip',
    });

    expect(finalPath).toBe(
      path.join(tmpDir, 'relatorios_atendimentos_2026-07-03_153000.zip'),
    );
    await expect(fsp.access(finalPath, fs.constants.R_OK)).resolves.toBeUndefined();
    await expect(fsp.access(partA)).rejects.toBeTruthy();
    await expect(fsp.access(partB)).rejects.toBeTruthy();
  });

  async function writeTempFile(name: string, content: string): Promise<string> {
    const filePath = path.join(tmpDir, name);
    await fsp.writeFile(filePath, content);
    return filePath;
  }
});

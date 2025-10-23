import { join } from 'path';
import { FileService } from './file.service';

jest.mock('fast-glob', () => ({
  glob: jest.fn(), // async API
  globSync: jest.fn(), // sync API (optional)
}));

const fg = require('fast-glob');

jest.mock('graphql-request', () => ({
  gql: (literals: TemplateStringsArray) => literals[0],
  GraphQLClient: jest.fn().mockImplementation(() => ({
    request: jest.fn(),
  })),
}));

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
}));

import { existsSync } from 'fs';

describe('FileService class tests', () => {
  let service: FileService;
  let prisma: any;
  let produtorService: any;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = {
      pictureFile: {
        findMany: jest.fn(),
        deleteMany: jest.fn(),
      },
    };
    produtorService = { getUnidadeEmpresa: jest.fn() };

    service = new FileService(prisma, produtorService);

    // stub internals we don’t want to hit in unit tests
    (service as any).save = jest.fn().mockResolvedValue(undefined);
    (service as any).deleteFile = jest.fn().mockResolvedValue(undefined);
    (service as any).getFolderPath = jest.fn().mockResolvedValue('/uploads');
    // (service as any).findManyById = jest.fn();

    if (jest.isMockFunction((service as any).removeOutdatedFiles)) {
      (service as any).removeOutdatedFiles.mockRestore();
    }
  });

  describe('FileService.save', () => {
    // Access the fs promise mocks from the existing jest.mock('fs', ...) in this file
    // eslint-disable-next-line @typescript-eslint/no-var-requires

    const fsPromises = require('fs/promises');

    let mkdirSpy: jest.SpyInstance;
    let writeFileSpy: jest.SpyInstance;
    let loggerMock: { error: jest.Mock };

    const actualSave = FileService.prototype.save;

    const relatorio = { id: 'relatorio_id_01', contratoId: 1 } as any;
    const mkFile = (name: string, buffer: Buffer = Buffer.from('x')) =>
      ({ originalname: name, size: 10, mimetype: 'image/jpeg', buffer }) as any;

    beforeEach(() => {
      jest.clearAllMocks();

      // use real save implementation for this block
      service.save = actualSave.bind(service);

      loggerMock = { error: jest.fn() };
      (service as any).logger = loggerMock;

      mkdirSpy = jest
        .spyOn(fsPromises, 'mkdir')
        .mockResolvedValue(undefined as unknown as void);
      writeFileSpy = jest
        .spyOn(fsPromises, 'writeFile')
        .mockResolvedValue(undefined as unknown as void);

      // save() dependencies
      jest.spyOn(service as any, 'getFolderPath').mockResolvedValue('/uploads');
      jest
        .spyOn(service as any, 'createFileMetadata')
        .mockImplementation((file: any, relId: string) => ({
          id: file.originalname.split('.')[0],
          fileName: file.originalname,
          size: Number(file.size ?? 0),
          mimeType: file.mimetype ?? '',
          description:
            file.fieldname === 'foto'
              ? 'FOTO_RELATORIO'
              : 'ASSINATURA_PRODUTOR',
          relatorioId: relId,
        }));
      jest
        .spyOn(service as any, 'saveMetadata')
        .mockResolvedValue({ id: 'computedId' });

      // Default: folder exists, target file does not exist
      (existsSync as jest.Mock).mockImplementation((p: string) => {
        // If it's exactly the folder, say it exists; if it's a file path, say it doesn't
        return p === '/uploads';
      });
    });

    afterEach(() => {
      mkdirSpy.mockRestore();
      writeFileSpy.mockRestore();
    });

    it('creates the upload folder if not present and writes the file', async () => {
      // Folder does NOT exist; file does NOT exist
      (existsSync as jest.Mock).mockReturnValue(false);

      const files = { foto: [mkFile('a.jpg')] };
      await service.save(files as any, relatorio);

      expect(service.getFolderPath).toHaveBeenCalledWith(relatorio);
      expect(mkdirSpy).toHaveBeenCalledWith('/uploads', {
        recursive: true,
      });
      expect((service as any).createFileMetadata).toHaveBeenCalledWith(
        files.foto[0],
        'relatorio_id_01',
      );
      expect((service as any).saveMetadata).toHaveBeenCalled();
      expect((service as any).saveMetadata).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'a',
          fileName: 'a.jpg',
          size: 10,
          mimeType: 'image/jpeg',
          description: 'ASSINATURA_PRODUTOR',
          relatorioId: 'relatorio_id_01',
        }),
      );
      expect(writeFileSpy).toHaveBeenCalledWith(
        '/uploads/computedId',
        expect.any(Buffer),
        expect.objectContaining({ flag: 'wx' }),
      );
    });

    it('writes file when metadata duplicate but file missing on disk', async () => {
      jest
        .spyOn(service as any, 'saveMetadata')
        .mockResolvedValue({ id: 'dupId', __duplicate: true });

      // Folder exists, but target file missing
      (existsSync as jest.Mock).mockImplementation(
        (p: string) => p === '/uploads',
      );

      const files = { foto: [mkFile('dup.jpg')] };
      await service.save(files as any, relatorio);

      expect(writeFileSpy).toHaveBeenCalledWith(
        '/uploads/dupId',
        expect.any(Buffer),
        expect.objectContaining({ flag: 'wx' }),
      );
      expect(loggerMock.error).not.toHaveBeenCalled();
    });

    it('skips writing when saveMetadata signals duplicate and file exists on disk', async () => {
      jest
        .spyOn(service as any, 'saveMetadata')
        .mockResolvedValue({ id: 'dupId', __duplicate: true });

      (existsSync as jest.Mock).mockImplementation(
        (p: string) => p === '/uploads' || p === '/uploads/dupId',
      );

      const files = { foto: [mkFile('dup.jpg')] };
      await service.save(files as any, relatorio);

      expect(writeFileSpy).not.toHaveBeenCalled();
      expect(loggerMock.error).toHaveBeenCalledWith(
        'FileService.save - file already in FS/DB, skipping write',
        expect.objectContaining({
          id: 'dupId',
          relatorioId: 'relatorio_id_01',
        }),
      );
    });

    it('skips writing if target file already exists on disk', async () => {
      // Folder exists AND the file path exists -> skip write
      (existsSync as jest.Mock).mockImplementation((p: string) => {
        if (p === '/uploads') return true;
        if (p === '/uploads/computedId') return true;
        return false;
      });

      writeFileSpy.mockRejectedValueOnce(
        Object.assign(new Error('exists'), { code: 'EEXIST' }),
      );

      const files = { assinatura: [mkFile('sig.jpg')] };
      await service.save(files as any, relatorio);
      expect((service as any).createFileMetadata).toHaveBeenCalledWith(
        files.assinatura[0],
        'relatorio_id_01',
      );

      expect((service as any).saveMetadata).toHaveBeenCalled();
      expect((service as any).saveMetadata).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'sig',
          fileName: 'sig.jpg',
          size: 10,
          mimeType: 'image/jpeg',
          description: 'ASSINATURA_PRODUTOR',
          relatorioId: 'relatorio_id_01',
        }),
      );

      expect(writeFileSpy).toHaveBeenCalledTimes(1);
      expect(loggerMock.error).toHaveBeenCalledWith(
        'FileService.save - File already exists, skipping write',
        expect.objectContaining({ targetPath: '/uploads/computedId' }),
      );
    });

    it('continues processing the next file if one file errors (per-file try/catch)', async () => {
      // First file: saveMetadata throws -> should log & continue to second file
      const err = new Error('db-create-failed');
      (service as any).saveMetadata
        .mockRejectedValueOnce(err)
        .mockResolvedValueOnce({ id: 'okId' });
      const files = { foto: [mkFile('bad.jpg'), mkFile('ok.jpg')] };

      await service.save(files as any, relatorio);

      // First failed, but second still written
      expect(writeFileSpy).toHaveBeenCalledTimes(1);
      expect(writeFileSpy).toHaveBeenCalledWith(
        '/uploads/okId',
        expect.any(Buffer),
        expect.objectContaining({ flag: 'wx' }),
      );
      expect(loggerMock.error).toHaveBeenCalledWith(
        'FileService.save - ERROR persisting file',
        expect.objectContaining({
          fileName: 'bad.jpg',
          id: 'bad',
          relatorioId: 'relatorio_id_01',
        }),
      );
    });

    it('ignores empty/null buckets gracefully', async () => {
      const files = { foto: [], assinatura: null } as any;

      await service.save(files, relatorio);

      expect((service as any).createFileMetadata).not.toHaveBeenCalled();
      expect((service as any).saveMetadata).not.toHaveBeenCalled();
      expect(writeFileSpy).not.toHaveBeenCalled();
    });

    it('warns and skips when file buffer is missing', async () => {
      // Simulate missing buffer
      const fileWithoutBuffer: any = {
        originalname: 'nobuf.jpg',
        size: 5,
        mimetype: 'image/jpeg',
      };
      (service as any).saveMetadata.mockResolvedValue({ id: 'nobuf' });

      const files = { foto: [fileWithoutBuffer] };
      await service.save(files as any, relatorio);

      expect(writeFileSpy).not.toHaveBeenCalled();
      expect(loggerMock.error).toHaveBeenCalledWith(
        'FileService.save - Missing file buffer, skipping',
        expect.objectContaining({ id: 'nobuf' }),
      );
    });
  });

  describe('FileService.update', () => {
    let service: FileService;
    let prisma: any;
    let produtorService: any;

    let saveSpy: jest.SpyInstance;
    let removeOutdatedSpy: jest.SpyInstance;
    let getFolderPathSpy: jest.SpyInstance;

    const relatorio = { id: 'R1', contratoId: 1 } as any;

    const createFile = (fieldname: string, originalname: string): any => ({
      fieldname,
      originalname,
      mimetype: 'image/jpeg',
      buffer: Buffer.from('data'),
    });

    beforeEach(() => {
      jest.clearAllMocks();

      prisma = {
        pictureFile: {
          create: jest.fn(),
          findMany: jest.fn(),
          deleteMany: jest.fn(),
        },
      };

      produtorService = { getUnidadeEmpresa: jest.fn() };
      service = new FileService(prisma, produtorService);
      saveSpy = jest.spyOn(service as any, 'save').mockResolvedValue(undefined);

      removeOutdatedSpy = jest
        .spyOn(service as any, 'removeOutdatedFiles')
        .mockResolvedValue(undefined);

      getFolderPathSpy = jest
        .spyOn(service as any, 'getFolderPath')
        .mockResolvedValue('/uploads');

      prisma.pictureFile.findMany.mockResolvedValue([]);
      (existsSync as jest.Mock).mockImplementation((p: string) => false);

      (existsSync as jest.Mock).mockReset();
    });

    afterEach(() => {
      saveSpy.mockRestore();
      removeOutdatedSpy.mockRestore();
      getFolderPathSpy.mockRestore();
      (existsSync as jest.Mock).mockReset();
    });

    it('returns early when files is undefined', async () => {
      await expect(
        service.update(undefined as any, relatorio),
      ).resolves.toBeUndefined();
      expect(prisma.pictureFile.findMany).not.toHaveBeenCalled();
      expect(saveSpy).not.toHaveBeenCalled();
      expect(removeOutdatedSpy).not.toHaveBeenCalled();
    });

    it('returns early when files object is empty', async () => {
      await expect(
        service.update({} as any, relatorio),
      ).resolves.toBeUndefined();
      expect(prisma.pictureFile.findMany).not.toHaveBeenCalled();
      expect(saveSpy).not.toHaveBeenCalled();
      expect(removeOutdatedSpy).not.toHaveBeenCalled();
    });

    it('returns early when input files collapse to an empty array', async () => {
      await expect(
        service.update({ foto: [null as any, undefined as any] }, relatorio),
      ).resolves.toBeUndefined();
      expect(prisma.pictureFile.findMany).not.toHaveBeenCalled();
    });

    it('skips save and remove when everything matches both FS and DB', async () => {
      const files = { foto: [createFile('foto', 'imgA.jpg')] } as any;

      (existsSync as jest.Mock).mockImplementation((path: string) =>
        path.endsWith('imgA') ? true : false,
      );

      prisma.pictureFile.findMany.mockResolvedValueOnce([
        { id: 'imgA', description: 'FOTO_RELATORIO' },
      ]);

      await service.update(files, relatorio);

      expect(saveSpy).not.toHaveBeenCalled();
      expect(removeOutdatedSpy).not.toHaveBeenCalled();
    });

    it('saves files that exist in DB but are missing on disk', async () => {
      const files = { foto: [createFile('foto', 'missing.jpg')] } as any;

      (existsSync as jest.Mock).mockImplementation((path: string) =>
        path.endsWith('missing') ? false : true,
      );

      prisma.pictureFile.findMany.mockResolvedValueOnce([
        { id: 'missing', description: 'FOTO_RELATORIO' },
      ]);

      await service.update(files, relatorio);

      expect(saveSpy).toHaveBeenCalledTimes(1);
      expect(saveSpy).toHaveBeenCalledWith(
        expect.objectContaining({ foto: [files.foto[0]] }),
        relatorio,
      );
      expect(removeOutdatedSpy).not.toHaveBeenCalled();
    });

    it('saves files that are missing in the database even if present on disk', async () => {
      const files = { foto: [createFile('foto', 'dbMissing.jpg')] } as any;

      (existsSync as jest.Mock).mockReturnValue(true);
      prisma.pictureFile.findMany.mockResolvedValueOnce([]);

      await service.update(files, relatorio);

      expect(saveSpy).toHaveBeenCalledWith(
        expect.objectContaining({ foto: [files.foto[0]] }),
        relatorio,
      );
      expect(removeOutdatedSpy).not.toHaveBeenCalled();
    });

    it('saves replacements and removes outdated DB rows when ids change', async () => {
      const files = {
        assinatura: [createFile('assinatura', 'sigNEW.jpg')],
      } as any;

      (existsSync as jest.Mock).mockReturnValue(true);

      prisma.pictureFile.findMany.mockResolvedValueOnce([
        { id: 'sigOLD', description: 'ASSINATURA_PRODUTOR' },
      ]);

      await service.update(files, relatorio);

      expect(saveSpy).toHaveBeenCalledWith(
        expect.objectContaining({ assinatura: [files.assinatura[0]] }),
        relatorio,
      );
      expect(removeOutdatedSpy).toHaveBeenCalledWith(
        [{ id: 'sigOLD', description: 'ASSINATURA_PRODUTOR' }],
        '/uploads',
      );
    });

    it('deduplicates ids across buckets and performs both save and remove', async () => {
      const files = {
        foto: [createFile('foto', 'disk-miss.jpg')],
        assinatura: [createFile('assinatura', 'sigNEW.jpg')],
      } as any;

      (existsSync as jest.Mock).mockImplementation((path: string) =>
        path.endsWith('disk-miss') ? false : true,
      );

      prisma.pictureFile.findMany.mockResolvedValueOnce([
        { id: 'disk-miss', description: 'FOTO_RELATORIO' },
        { id: 'sigOLD', description: 'ASSINATURA_PRODUTOR' },
      ]);

      await service.update(files, relatorio);

      expect(saveSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          foto: [files.foto[0]],
          assinatura: [files.assinatura[0]],
        }),
        relatorio,
      );
      expect(removeOutdatedSpy).toHaveBeenCalledWith(
        [{ id: 'sigOLD', description: 'ASSINATURA_PRODUTOR' }],
        '/uploads',
      );
    });

    it('forwards only the files that need replacement within a bucket', async () => {
      const files = {
        foto: [
          createFile('foto', 'keep.jpg'),
          createFile('foto', 'update.jpg'),
        ],
      } as any;

      (existsSync as jest.Mock).mockImplementation((path: string) => {
        if (path.endsWith('keep')) return true;
        if (path.endsWith('update')) return false;
        return true;
      });

      prisma.pictureFile.findMany.mockResolvedValueOnce([
        { id: 'keep', description: 'FOTO_RELATORIO' },
      ]);

      await service.update(files, relatorio);

      expect(saveSpy).toHaveBeenCalledTimes(1);
      const payload = saveSpy.mock.calls[0][0];
      expect(payload.foto).toHaveLength(1);
      expect(payload.foto?.[0].originalname).toBe('update.jpg');
      expect(removeOutdatedSpy).toHaveBeenCalledWith(
        [{ id: 'keep', description: 'FOTO_RELATORIO' }],
        '/uploads',
      );
    });

    it('does not remove outdated files when uploadFolder resolves to null', async () => {
      getFolderPathSpy.mockResolvedValueOnce(null);

      const files = {
        assinatura: [createFile('assinatura', 'sigNEW.jpg')],
      } as any;

      prisma.pictureFile.findMany.mockResolvedValueOnce([
        { id: 'sigOLD', description: 'ASSINATURA_PRODUTOR' },
      ]);

      await service.update(files, relatorio);

      expect(saveSpy).toHaveBeenCalled();
      expect(removeOutdatedSpy).not.toHaveBeenCalled();
    });

    it('calls findManyById with every input id', async () => {
      const files = {
        foto: [createFile('foto', 'a.jpg')],
        assinatura: [createFile('assinatura', 'b.jpg')],
      } as any;

      (existsSync as jest.Mock).mockReturnValue(true);

      await service.update(files, relatorio);

      expect(prisma.pictureFile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { relatorioId: 'R1' },
        }),
      );
    });
  });

  // ---------- removeOutdatedFiles ----------
  describe('removeOutdatedFiles', () => {
    const uploadFolder = '/uploads';

    beforeEach(() => {
      if (jest.isMockFunction((service as any).removeOutdatedFiles)) {
        (service as any).removeOutdatedFiles.mockRestore();
      }
    });

    it('returns early if outdatedOnDB is empty', async () => {
      await expect(
        (service as any).removeOutdatedFiles([], uploadFolder),
      ).resolves.toBeUndefined();
      expect(prisma.pictureFile.deleteMany).not.toHaveBeenCalled();
      expect((service as any).deleteFile).not.toHaveBeenCalled();
    });

    it('deletes DB rows and deletes disk files that exist', async () => {
      (existsSync as jest.Mock).mockImplementation((p: string) =>
        p.endsWith('/old1') ? true : p.endsWith('/old2') ? true : false,
      );

      await (service as any).removeOutdatedFiles(
        [{ id: 'old1' }, { id: 'old2' }],
        uploadFolder,
      );

      expect(prisma.pictureFile.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['old1', 'old2'] } },
      });

      expect((service as any).deleteFile).toHaveBeenCalledTimes(2);
      expect((service as any).deleteFile).toHaveBeenCalledWith(
        join(uploadFolder, 'old1'),
      );
      expect((service as any).deleteFile).toHaveBeenCalledWith(
        join(uploadFolder, 'old2'),
      );
    });

    it('skips disk deletes if uploadFolder is falsy', async () => {
      (existsSync as jest.Mock).mockReturnValue(true); // would exist
      await (service as any).removeOutdatedFiles([{ id: 'old1' }], null);

      expect(prisma.pictureFile.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['old1'] } },
      });
      expect((service as any).deleteFile).not.toHaveBeenCalled();
    });

    it('skips disk deletes if none of the files exist', async () => {
      (existsSync as jest.Mock).mockReturnValue(false);
      await (service as any).removeOutdatedFiles(
        [{ id: 'old1' }],
        uploadFolder,
      );

      expect(prisma.pictureFile.deleteMany).toHaveBeenCalled();
      expect((service as any).deleteFile).not.toHaveBeenCalled();
    });

    it('logs warning and does not throw on errors', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      prisma.pictureFile.deleteMany.mockRejectedValue(new Error('db fail'));

      await (service as any).removeOutdatedFiles(
        [{ id: 'old1' }],
        uploadFolder,
      );

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[files/update] Failed to delete old file'),
        expect.any(Error),
      );

      warnSpy.mockRestore();
    });
  });

  describe('FileService.findMissingFilesInFS', () => {
    const fgMock = fg.glob as jest.Mock;
    const OLD_ENV = process.env;

    beforeEach(() => {
      process.env = { ...OLD_ENV, FILES_FOLDER: '/data' };
      fgMock.mockReset();
      fgMock.mockResolvedValue([]); // safe default so the call registers

      (service as any).findManyById = jest.fn().mockResolvedValue([]);
    });

    afterEach(() => {
      process.env = OLD_ENV;
    });

    it('returns [] when FILES_FOLDER is missing', async () => {
      delete process.env.FILES_FOLDER;

      (service as any).findManyById.mockResolvedValue([{ id: 'a' }]);

      const result = await (service as any).findMissingFiles(['a']);
      expect(result).toEqual([]);
      expect(fgMock).not.toHaveBeenCalled();
    });

    it('returns [] when fileIds is undefined or empty', async () => {
      (service as any).findManyById.mockResolvedValue([]);
      expect(await (service as any).findMissingFiles(undefined)).toEqual([]);
      expect(fgMock).not.toHaveBeenCalled();

      // empty
      expect(await service.findMissingFiles([])).toEqual([]);
      expect(fgMock).not.toHaveBeenCalled();
    });

    it('de-dupes ids and filters falsy before globbing', async () => {
      (service as any).findManyById.mockResolvedValue([{ id: 'a' }]);
      fgMock.mockResolvedValue([
        '/data/contrato_2/UE/CPF/a', // only "a" exists
      ]);

      const result = await (service as any).findMissingFiles([
        'a',
        'a',
        '',
        null as any,
        'a',
      ]);

      // fast-glob called once with patterns array
      expect(fgMock).toHaveBeenCalledTimes(1);
      const patternsArg = fgMock.mock.calls[0][0] as string | string[];
      const patterns = Array.isArray(patternsArg) ? patternsArg : [patternsArg];

      // should only have "a" pattern once
      const countA = patterns.filter((p) => p.endsWith('/a')).length;
      expect(countA).toBe(1);

      // "a" exists -> no missing
      expect(result).toEqual([]);
    });

    it('returns all unique ids if glob throws (conservative fallback)', async () => {
      (service as any).findManyById.mockResolvedValue([]);

      fgMock.mockRejectedValue(new Error('glob fail'));

      const result = await (service as any).findMissingFiles(['x', 'y', 'x']);
      // all unique → ['x','y']
      expect(result.sort()).toEqual(['x', 'y']);
    });

    it('returns only the ids not found by glob (partial hit)', async () => {
      (service as any).findManyById.mockResolvedValue([
        { id: 'a' },
        { id: 'b' },
        { id: 'c' },
      ]);
      fgMock.mockResolvedValue([
        '/data/contrato_2/UE1/CPF1/b',
        '/data/contrato_2/UE2/CPF2/c',
      ]);

      const result = await service.findMissingFiles(['a', 'b', 'c']);
      expect(fgMock).toHaveBeenCalledTimes(1);
      expect(result).toEqual(['a']);
    });

    it('respects contratoId param when building patterns', async () => {
      (service as any).findManyById.mockResolvedValue([
        { id: 'file1' },
        { id: 'file2' },
      ]);
      fgMock.mockResolvedValue([]); // none found; we only care about the patterns built

      await service.findMissingFiles(['file1', 'file2'], 7);

      expect(fgMock).toHaveBeenCalledTimes(1);
      const patternsArg = fgMock.mock.calls[0][0] as string | string[];
      const patterns = Array.isArray(patternsArg) ? patternsArg : [patternsArg];

      // every pattern should include contrato_7
      expect(patterns.length).toBeGreaterThan(0);
      patterns.forEach((p) => {
        expect(p).toContain('contrato_7');
      });
    });

    it('maps foundPaths basenames back to ids correctly', async () => {
      (service as any).findManyById.mockResolvedValue([
        { id: 'pic-123' },
        { id: 'sig-999' },
        { id: 'ghost-777' },
      ]);
      fgMock.mockResolvedValue([
        '/data/contrato_2/UE1/CPF1/pic-123',
        '/data/contrato_2/UE2/CPF2/sig-999',
      ]);

      const result = await service.findMissingFiles([
        'pic-123',
        'sig-999',
        'ghost-777',
      ]);
      expect(fgMock).toHaveBeenCalledTimes(1);
      expect(result).toEqual(['ghost-777']);
    });

    it('flags ids missing in the database even if present on disk', async () => {
      (service as any).findManyById.mockResolvedValue([]);
      fgMock.mockResolvedValue(['/data/contrato_2/UE/CPF/db-only']);

      const result = await service.findMissingFiles(['db-only']);

      expect(result).toEqual(['db-only']);
    });

    it('merges filesystem and database misses without duplicates', async () => {
      (service as any).findManyById.mockResolvedValue([{ id: 'fs-only' }]);
      fgMock.mockResolvedValue(['/data/contrato_2/UE/CPF/db-only']);

      const result = await service.findMissingFiles(['fs-only', 'db-only']);

      expect(new Set(result)).toEqual(new Set(['fs-only', 'db-only']));
    });

    it('handles non-string ids gracefully (filters out)', async () => {
      (service as any).findManyById.mockResolvedValue([{ id: 'ok' }]);
      fgMock.mockResolvedValue([]);
      const result = await (service as any).findMissingFiles([
        'ok',
        42,
        false,
        null,
        undefined,
      ]);
      // only 'ok' is valid and wasn’t found
      expect(result).toEqual(['ok']);
    });
  });
});

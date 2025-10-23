import { basename, join, parse } from 'path';
import { promises as fs, existsSync, createReadStream } from 'fs';
import * as fg from 'fast-glob';
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { FilesInputDto } from './files-input.dto';
import { Readable } from 'stream';
import { ProdutorService } from 'src/modules/produtor/produtor.service';
import { RelatorioModel } from 'src/@domain/relatorio/relatorio-model';

import { UpdateRelatorioDto } from 'src/modules/relatorios/dto/update-relatorio.dto';
import { isDuplicateError } from 'src/prisma/errors/is-duplicate-error';
import { type PictureDescription } from './types/picture-description.type';
import { WinstonLoggerService } from '../logging/winston-logger.service';

@Injectable()
export class FileService {
  constructor(
    private prismaService: PrismaService,
    private produtorService: ProdutorService,
    private readonly logger?: WinstonLoggerService,
  ) {}

  async getFileStream(
    fileUUIDName: string,
    callback: (err: Error | null, stream?: Readable) => void,
  ): Promise<any> {
    const relatorio = await this.prismaService.relatorio.findFirst({
      where: {
        OR: [{ pictureURI: fileUUIDName }, { assinaturaURI: fileUUIDName }],
      },
      select: { produtorId: true, contratoId: true },
    });

    const { produtorId, contratoId } = relatorio;
    const folder = await this.getFolderPath({
      produtorId: String(produtorId),
      contratoId,
    });

    const filePath = join(folder, fileUUIDName);
    const stream = createReadStream(filePath);

    stream.on('error', (error) => {
      console.error(`Stream error: ${error.message}`);
      callback(new Error(error.message));
    });

    stream.on('open', () => {
      console.log('🚀 ~ file: file.service.ts:22 - #### stream ok.');
      callback(null, stream);
    });
  }

  async save(files: FilesInputDto, relatorio: Partial<RelatorioModel>) {
    const uploadFolder = await this.prepareUploadFolder(relatorio);

    for (const key in files) {
      const bucket = files[key];
      if (!bucket || bucket.length === 0) continue;

      for (const file of bucket) {
        if (!file) continue;
        try {
          const fileMetadata = this.createFileMetadata(file, relatorio.id);
          const result = await this.saveMetadata(fileMetadata);

          if (!result) {
            this.logger.error(
              'FileService.save - Unable to save file in DB',
              fileMetadata,
            );
            continue;
          }

          if (!file.buffer) {
            this.logger.error(
              'FileService.save - Missing file buffer, skipping',
              fileMetadata,
            );
            continue;
          }

          const targetPath = join(uploadFolder, result.id);
          const isDuplicate = result.__duplicate === true;

          if (isDuplicate && existsSync(targetPath)) {
            this.logger.error(
              'FileService.save - file already in FS/DB, skipping write',
              { id: result.id, relatorioId: relatorio.id },
            );
            continue;
          }
          try {
            await fs.writeFile(targetPath, file.buffer as Uint8Array | string, {
              flag: 'wx',
            });
          } catch (err: any) {
            if (err?.code === 'EEXIST') {
              this.logger.error(
                'FileService.save - File already exists, skipping write',
                { targetPath },
              );
              continue;
            }
            throw err; // handled by outer catch to keep loop going
          }
        } catch (err: any) {
          this.logger.error('FileService.save - ERROR persisting file', {
            id: file?.originalname?.split('.')[0],
            fileName: file?.originalname,
            description: this.getDesc(file),
            relatorioId: relatorio.id,
            error: err?.message || String(err),
            stack: err?.stack,
          });
        }
      }
    }
  }

  private async prepareUploadFolder(
    relatorio: Partial<RelatorioModel>,
  ): Promise<string> {
    const uploadFolder = await this.getFolderPath(relatorio);

    if (!uploadFolder) {
      this.logger.error(
        'FileService.prepareUploadFolder - uploadFolder not resolved',
        {
          relatorioId: relatorio?.id,
        },
      );
      throw new Error('Upload folder not available');
    }

    if (!existsSync(uploadFolder)) {
      await fs.mkdir(uploadFolder, { recursive: true });
    }

    return uploadFolder;
  }

  findManyById(ids: string[]) {
    return this.prismaService.pictureFile.findMany({
      where: { id: { in: ids } },
    });
  }

  async update(files: FilesInputDto, relatorio: UpdateRelatorioDto) {
    if (!files || Object.keys(files).length === 0) return;

    const inputFiles = Object.values(files)
      .flat()
      .filter(Boolean)
      .map((f) => ({
        ...f,
        id: f.originalname.split('.')[0],
        description: this.getDesc(f),
      }));
    if (inputFiles?.length === 0) return;

    const uploadFolder = await this.getFolderPath(relatorio);
    const missingOnDisk = this.getMissingOnDisk(inputFiles, uploadFolder);

    // const filesInDB = await this.findManyById(inputFiles.map((f) => f.id));
    const filesInDB = await this.prismaService.pictureFile.findMany({
      where: { relatorioId: relatorio.id },
    });

    const { outdatedOnDB, missingOnDB, replacementsFromClient } =
      this.computeDbDiffs(inputFiles, filesInDB);

    const fileIdsToSave = Array.from(
      new Set<string>([
        ...missingOnDisk.map((f) => f.id),
        ...missingOnDB.map((f) => f.id),
        ...replacementsFromClient,
      ]),
    );

    const hasAddsOrReplacements = fileIdsToSave.length > 0;
    const hasDeletions = outdatedOnDB.length > 0;

    if (!hasAddsOrReplacements && !hasDeletions) return;

    const idsSet = new Set(fileIdsToSave);
    const filesForUpdate = this.buildFilesForUpdate(idsSet, files);

    if (hasAddsOrReplacements) {
      await this.save(filesForUpdate, relatorio);
    }

    if (hasDeletions && uploadFolder) {
      await this.removeOutdatedFiles(outdatedOnDB, uploadFolder);
    }
  }

  private buildFilesForUpdate(
    idsSet: Set<string>,
    files: FilesInputDto,
  ): FilesInputDto {
    const filesForUpdate: FilesInputDto = {};

    for (const [bucket, arr] of Object.entries(files)) {
      const filtered = (arr || []).filter((file) => {
        const id = parse(file?.originalname || '')?.name;
        return id && idsSet.has(id);
      });

      if (filtered.length) {
        filesForUpdate[bucket as keyof FilesInputDto] =
          filtered as Express.Multer.File[];
      }
    }

    return filesForUpdate;
  }

  private getMissingOnDisk(
    inputFiles: Array<Express.Multer.File & { id: string }>,
    uploadFolder?: string,
  ) {
    if (!uploadFolder) return inputFiles;
    return inputFiles.filter(
      (file) => !existsSync(join(uploadFolder as string, file.id)),
    );
  }

  private computeDbDiffs(
    inputFiles: Array<
      Express.Multer.File & { id: string; description: string }
    >,
    filesInDB: Array<{ id: string; description: string }>,
  ) {
    const outdatedOnDB = filesInDB.filter((dbFile) =>
      inputFiles.some(
        (f) => f.description === dbFile.description && f.id !== dbFile.id,
      ),
    );

    const missingOnDB = inputFiles.filter(
      (f) =>
        !filesInDB.some(
          (db) => db.id === f.id && db.description === f.description,
        ),
    );

    const replacementsFromClient = inputFiles
      .filter((f) =>
        outdatedOnDB.some(
          (db) => db.description === f.description && db.id !== f.id,
        ),
      )
      .map((f) => f.id);

    return { outdatedOnDB, missingOnDB, replacementsFromClient };
  }

  private getDesc = (f: Express.Multer.File) =>
    f.fieldname === 'foto'
      ? 'FOTO_RELATORIO'
      : f.fieldname === 'assinatura'
        ? 'ASSINATURA_PRODUTOR'
        : f.fieldname;

  private async removeOutdatedFiles(
    outdatedOnDB: { id: string }[],
    uploadFolder: string,
  ) {
    try {
      if (!outdatedOnDB || !outdatedOnDB.length) return;

      await this.prismaService.pictureFile.deleteMany({
        where: { id: { in: outdatedOnDB.map((f) => f.id) } },
      });

      if (!uploadFolder) return;

      const outdatedOnDisk = outdatedOnDB
        .map((dbFile) => dbFile.id)
        .filter((id) => existsSync(join(uploadFolder as string, id)));

      if (outdatedOnDisk.length === 0) return;

      await Promise.all(
        outdatedOnDisk.map((id) => this.deleteFile(join(uploadFolder, id))),
      );
    } catch (error) {
      console.warn(
        `[files/update] Failed to delete old file ${error.message}`,
        error,
      );
    }
  }

  async remove(fileIds: string | string[]) {
    if (!fileIds) {
      throw new Error('Id and filesFolder needed.');
    }
    if (typeof fileIds === 'string') {
      fileIds = fileIds.split(',');
    }

    await this.prismaService.pictureFile.deleteMany({
      where: { id: { in: fileIds } },
    });
    for (const id of fileIds) {
      const rel = await this.prismaService.relatorio.findFirst({
        where: {
          OR: [
            { pictureURI: { in: fileIds } },
            { assinaturaURI: { in: fileIds } },
          ],
        },
        select: {
          produtorId: true,
          contratoId: true,
          pictureURI: true,
          assinaturaURI: true,
        },
      });

      const { produtorId, contratoId } = rel;
      const filesFolder = await this.getFolderPath({
        produtorId: String(produtorId),
        contratoId,
      });
      const filePath = join(filesFolder, id);
      await this.deleteFile(filePath);
    }
    return true;
  }

  async getFolderPath(relatorio: Partial<RelatorioModel>) {
    const { produtorId, contratoId } = relatorio;
    const { nr_cpf_cnpj, id_und_empresa } =
      await this.produtorService.getUnidadeEmpresa(produtorId);

    const baseFolder = process.env.FILES_FOLDER;
    const folderName = join(
      baseFolder,
      `contrato_${contratoId}`,
      id_und_empresa,
      nr_cpf_cnpj,
    );
    return folderName;
  }

  private createFileMetadata(file: Express.Multer.File, relatorioId: string) {
    if (!relatorioId) {
      throw new Error('[files/createFileMetadata] relatorioId é obrigatório.');
    }
    const fileMetadata = {
      id: parse(file.originalname).name,
      fileName: file.originalname,
      size: Number(file.size),
      mimeType: file.mimetype,
      description: this.getDesc(file) as PictureDescription,
      relatorioId: relatorioId,
    };

    return fileMetadata;
  }

  private async saveMetadata(file: {
    id: string;
    fileName: string;
    size: number;
    mimeType: string;
    description: PictureDescription;
    relatorioId: string;
  }): Promise<{ id: string; __duplicate?: true } | null> {
    const { relatorioId, ...data } = file;
    try {
      const created = await this.prismaService.pictureFile.create({
        data: { ...data, relatorio: { connect: { id: relatorioId } } },
      });
      return { id: created.id };
    } catch (e: any) {
      if (isDuplicateError(e)) {
        console.log('File already exists in DB, skipping create', {
          relatorioId,
          id: file.id,
        });
        return { id: file.id, __duplicate: true };
      }
      this.logger?.error?.('[files/saveMetadata] Unexpected error on create', {
        relatorioId,
        id: file.id,
        error: e?.message,
        stack: e?.stack,
      });
      throw e;
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    if (existsSync(filePath)) {
      await fs.rm(filePath);
    }
  }

  async findMissingFiles(fileIds: string[], contratoId = 2): Promise<string[]> {
    if (!Array.isArray(fileIds) || fileIds.length === 0) return [];
    const uniqueIds = this.getUniqueFileIds(fileIds);
    if (uniqueIds.length === 0) return [];

    const [missingInFS, missingInDB] = await Promise.all([
      this.findMissingFilesInFS(uniqueIds, contratoId),
      this.findMissingFilesInDB(uniqueIds),
    ]);

    const allMissing = new Set<string>([...missingInFS, ...missingInDB]);
    console.log(
      '@@@ allMissing :',
      uniqueIds.filter((id) => allMissing.has(id)),
    );

    return uniqueIds.filter((id) => allMissing.has(id));
  }

  private async findMissingFilesInDB(fileIds: string[]): Promise<string[]> {
    const filesInDB = await this.findManyById(fileIds);
    const foundIds = new Set(filesInDB.map((f) => f.id));
    console.log(
      '@@@ missingDB:',
      fileIds.filter((f) => !foundIds.has(f)),
    );
    return fileIds.filter((fid) => !foundIds.has(fid));
  }

  private async findMissingFilesInFS(
    fileIds: string[],
    contratoId = 2,
  ): Promise<string[]> {
    const baseFolder = process.env.FILES_FOLDER;
    if (
      !baseFolder ||
      !Array.isArray(fileIds) ||
      fileIds.length === 0 ||
      !fileIds[0]
    ) {
      return [];
    }

    const patterns = fileIds
      .filter((id) => id && id.length > 0)
      .map((fileId) =>
        join(baseFolder, `contrato_${contratoId}`, '**', fileId),
      );

    let foundPaths: string[] = [];
    try {
      foundPaths = await fg.glob(patterns, { onlyFiles: true, absolute: true });
    } catch (err: any) {
      this.logger?.error?.('[files/findMissingFilesInFS] glob failed', {
        error: err,
      });
      return fileIds; // conservative fallback: treat all as missing if scan failed
    }

    const foundIds = new Set(foundPaths.map((p) => basename(p)));
    console.log(
      '@@@ missingFS:',
      fileIds.filter((f) => !foundIds.has(f)),
    );
    return fileIds.filter((fid) => !foundIds.has(fid));
  }

  private getUniqueFileIds(fileIds: string[]): string[] {
    return Array.from(
      new Set(
        fileIds.filter(
          (x): x is string => typeof x === 'string' && x.length > 0,
        ),
      ),
    );
  }
}

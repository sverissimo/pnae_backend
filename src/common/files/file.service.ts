import { Injectable } from '@nestjs/common';
import { join } from 'path';
import { promises as fs, existsSync, createReadStream } from 'fs';
import { PrismaService } from 'src/prisma/prisma.service';
import { FilesInputDto } from './files-input.dto';
import { Readable } from 'stream';
import { ProdutorService } from 'src/modules/produtor/produtor.service';
import { RelatorioModel } from 'src/@domain/relatorio/relatorio-model';
import { Relatorio } from 'src/modules/relatorios/entities/relatorio.entity';
import { UpdateRelatorioDto } from 'src/modules/relatorios/dto/update-relatorio.dto';
import { isDuplicateError } from 'src/prisma/errors/is-duplicate-error';
import { type PictureDescription } from './types/picture-description.type';

@Injectable()
export class FileService {
  constructor(
    private prismaService: PrismaService,
    private produtorService: ProdutorService,
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
    const uploadFolder = await this.getFolderPath(relatorio);
    const folderExists = existsSync(uploadFolder);
    if (!folderExists) {
      await fs.mkdir(uploadFolder, { recursive: true });
    }

    for (const key in files) {
      if (!files[key]) continue;

      for (const file of files[key]) {
        const fileMetadata = this.createFileMetadata(file, relatorio.id);
        const result = await this.saveMetadata(fileMetadata);

        if (!result || result.__duplicate === true) {
          console.warn(
            `[files/save] Duplicate metadata detected for id=${fileMetadata.id} (relatorioId=${fileMetadata.relatorioId}, desc=${fileMetadata.description}). Skipping FS write.`,
          );
          continue;
        }

        const targetPath = join(uploadFolder, result.id);
        if (existsSync(targetPath)) {
          console.warn(
            `[files/save] File already exists at ${targetPath}. Skipping write.`,
          );
          continue;
        }

        await fs.writeFile(targetPath, file.buffer as Uint8Array | string);
      }
    }
  }

  async update(files: FilesInputDto, relatorio: UpdateRelatorioDto) {
    const { id: relatorioId } = relatorio;
    const existingFiles = await this.prismaService.pictureFile.findMany({
      where: { relatorioId },
    });

    const { changedFiles } = await this.getModifiedFiles(files, existingFiles);
    if (!changedFiles.length) {
      return;
    }

    await this.save(files, relatorio);
    await this.removeOutdatedFiles({ files, relatorio, existingFiles });
  }

  private async removeOutdatedFiles(removeFilesProps: {
    files: FilesInputDto;
    relatorio: UpdateRelatorioDto;
    existingFiles: { id: string; description: PictureDescription }[];
  }) {
    const { files, relatorio, existingFiles } = removeFilesProps;
    if (!existingFiles.length) return;

    const fieldToDescription: Record<string, PictureDescription> = {
      foto: 'FOTO_RELATORIO',
      assinatura: 'ASSINATURA_PRODUTOR',
    };

    const fileIdsToDelete = Object.entries(fieldToDescription)
      .filter(([field]) => files?.[field]?.[0])
      .map(
        ([, description]) =>
          existingFiles.find((f) => f.description === description)?.id,
      )
      .filter((id): id is string => Boolean(id));

    if (!fileIdsToDelete.length) return;

    try {
      await this.prismaService.pictureFile.deleteMany({
        where: { id: { in: fileIdsToDelete } },
      });
    } catch (err) {
      console.error('[files/update] Failed to delete pictureFile rows:', err);
      return;
    }

    const uploadFolder = await this.getFolderPath(relatorio);
    await Promise.all(
      fileIdsToDelete.map(async (fileId) => {
        try {
          await this.deleteFile(join(uploadFolder, fileId));
        } catch (err) {
          console.warn(
            `[files/update] Failed to delete file ${fileId} from disk:`,
            err,
          );
        }
      }),
    );
  }

  private async getModifiedFiles(files: FilesInputDto, existingFiles: any[]) {
    const incoming = Object.values(files).flat() as Express.Multer.File[];

    const changedFiles = incoming.filter(
      (file) =>
        !existingFiles.some(
          (o) =>
            o.id === file.originalname.split('.')[0] &&
            o.description ===
              (file.fieldname === 'foto'
                ? 'FOTO_RELATORIO'
                : 'ASSINATURA_PRODUTOR'),
        ),
    );

    return { changedFiles };
  }

  async remove(fileIds: string | string[], relatorio?: Partial<Relatorio>) {
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
      const rel =
        relatorio ||
        (await this.prismaService.relatorio.findFirst({
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
        }));

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
    const fileMetadata = {
      id: file.originalname.split('.')[0],
      fileName: file.originalname,
      size: Number(file.size),
      mimeType: file.mimetype,
      description:
        file.fieldname === 'foto'
          ? ('FOTO_RELATORIO' as PictureDescription)
          : ('ASSINATURA_PRODUTOR' as PictureDescription),
      relatorioId: relatorioId,
    };
    // console.log('🚀 ~ file: file.service.ts:67 ~ FileService :', fileMetadata);
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
        data: {
          ...data,
          relatorio: { connect: { id: relatorioId } },
        },
      });
      return { id: created.id };
    } catch (e: any) {
      if (isDuplicateError(e)) {
        return { id: file.id, __duplicate: true };
      }

      console.error('[files/saveMetadata] Unexpected error on create:', e);
      throw e;
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    if (existsSync(filePath)) {
      await fs.rm(filePath);
    }
  }
}

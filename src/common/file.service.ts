import { Injectable } from '@nestjs/common';
import { join } from 'path';
import { promises as fs, existsSync, ReadStream, createReadStream } from 'fs';
import { PrismaService } from 'src/prisma/prisma.service';
import { FilesInputDto } from './files-input.dto';

@Injectable()
export class FileService {
  constructor(private prismaService: PrismaService) {}

  async getFileStream(fileUUIDName: string, filesFolder: string): Promise<ReadStream> {
    const filePath = join(filesFolder, fileUUIDName);
    if (existsSync(filePath)) {
      return createReadStream(filePath);
    } else {
      throw new Error('File not found');
    }
  }

  async save(files: FilesInputDto, relatorioId: string) {
    const uploadFolder = join(__dirname, '../..', '', 'data/files');
    const folderExists = existsSync(uploadFolder);
    if (!folderExists) {
      await fs.mkdir(uploadFolder);
    }

    for (const key in files) {
      if (files[key]) {
        for (const file of files[key]) {
          const fileMetadata = this.createFileMetadata(file, relatorioId);
          const { id: fileId } = await this.saveMetadata(fileMetadata);
          await fs.writeFile(`${uploadFolder}/${fileId}`, file.buffer);
        }
      }
    }
  }

  async remove(fileIds: string | string[], filesFolder: string) {
    console.log('🚀 ~ file: file.service.ts:49 ~ FileService ~ remove ~ fileIds:', {
      fileIds,
      filesFolder,
    });
    if (!fileIds || !filesFolder) {
      throw new Error('Id and filesFolder needed.');
    }
    if (typeof fileIds === 'string') {
      fileIds = fileIds.split(',');
    }

    await this.prismaService.pictureFile.deleteMany({ where: { id: { in: fileIds } } });
    for (const id of fileIds) {
      const filePath = join(filesFolder, id);
      await this.deleteFile(filePath);
    }
    return true;
  }

  private createFileMetadata(file: Express.Multer.File, relatorioId: string) {
    const fileMetadata = {
      id: file.originalname.split('.')[0],
      fileName: file.originalname,
      size: Number(file.size),
      mimeType: file.mimetype,
      description: file.fieldname === 'foto' ? 'FOTO_RELATORIO' : 'ASSINATURA_PRODUTOR',
      relatorioId: relatorioId,
    };
    console.log(
      '🚀 ~ file: file.service.ts:67 ~ FileService ~ createFileMetadata ~ fileMetadata:',
      fileMetadata,
    );
    return fileMetadata;
  }

  private async saveMetadata(file) {
    const fileId = await this.prismaService.pictureFile.create({ data: file });
    return fileId;
  }

  async deleteFile(filePath: string): Promise<void> {
    if (existsSync(filePath)) {
      await fs.rm(filePath);
    }
  }
}

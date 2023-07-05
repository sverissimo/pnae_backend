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

  async save(files: FilesInputDto, visitaId: number) {
    const uploadFolder = join(__dirname, '../../..', '', 'data/files');
    const folderExists = existsSync(uploadFolder);
    if (!folderExists) {
      await fs.mkdir(uploadFolder);
    }

    for (const key in files) {
      if (files[key]) {
        for (const file of files[key]) {
          const fileMetadata = this.createFileMetadata(file, visitaId);
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
    return;
  }

  private createFileMetadata(file: Express.Multer.File, visitaId: number | string) {
    const fileMetadata = {
      fileName: file.originalname,
      size: Number(file.size),
      mimeType: file.mimetype,
      description: file.fieldname === 'fotos' ? 'FOTO_VISITA' : 'ASSINATURA_PROPRIETARIO',
      visitaId: Number(visitaId),
    };
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

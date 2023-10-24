import { Injectable } from '@nestjs/common';
import { join } from 'path';
import { promises as fs, existsSync, createReadStream } from 'fs';
import { PrismaService } from 'src/prisma/prisma.service';
import { FilesInputDto } from './files-input.dto';
import { Readable } from 'stream';

@Injectable()
export class FileService {
  constructor(private prismaService: PrismaService) {}

  async getFileStream(
    fileUUIDName: string,
    filesFolder: string,
    callback: (err: Error | null, stream?: Readable) => void,
  ): Promise<any> {
    const filePath = join(filesFolder, fileUUIDName);
    const stream = createReadStream(filePath);

    stream.on('error', (error) => {
      console.error(`Stream error: ${error.message}`);
      callback(new Error(error.message));
    });

    stream.on('open', () => {
      console.log('🚀 ~ file: file.service.ts:22 - #### stream ok.');
      callback(null, stream);
    });

    // return new Promise((resolve, reject) => {
    //   try {
    //     const stream = createReadStream(filePath);
    //     stream.on('error', (error) => {
    //       stream.destroy();
    //       console.error(`Stream error: ${error.message}`);
    //       reject(new Error(error.message));
    //     });
    //     console.log('🚀 ~ file: file.service.ts:22 - #### stream ok.');
    //     resolve(stream);
    //   } catch (error) {
    //     reject(error);
    //   }
    // });
  }

  async save(files: FilesInputDto, relatorioId: string) {
    // const uploadFolder = join(__dirname, '../..', '', 'data/files');
    const uploadFolder = process.env.FILES_FOLDER;
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

  async update(files: FilesInputDto, relatorioId: string) {
    const oldFiles = await this.prismaService.pictureFile.findMany({ where: { relatorioId } });
    await this.save(files, relatorioId);
    if (oldFiles.length) {
      const fileIdsToDelete = oldFiles
        .filter((file) => {
          return (
            (file.description === 'FOTO_RELATORIO' && !!files['foto']) ||
            (file.description === 'ASSINATURA_PRODUTOR' && !!files['assinatura'])
          );
        })
        .map((file) => file.id);
      await this.remove(fileIdsToDelete, join(__dirname, '../..', '', 'data/files'));
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
    // console.log('🚀 ~ file: file.service.ts:67 ~ FileService :', fileMetadata);
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

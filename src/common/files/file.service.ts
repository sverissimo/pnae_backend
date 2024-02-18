import { Injectable } from '@nestjs/common';
import { join } from 'path';
import { promises as fs, existsSync, createReadStream } from 'fs';
import { PrismaService } from 'src/prisma/prisma.service';
import { FilesInputDto } from './files-input.dto';
import { Readable } from 'stream';
import { ProdutorService } from 'src/modules/produtor/produtor.service';
import { RelatorioModel } from 'src/@domain/relatorio/relatorio-model';
import { Relatorio } from 'src/modules/relatorios/entities/relatorio.entity';

@Injectable()
export class FileService {
  constructor(private prismaService: PrismaService, private produtorService: ProdutorService) {}

  async getFileStream(
    fileUUIDName: string,
    callback: (err: Error | null, stream?: Readable) => void,
  ): Promise<any> {
    const relatorio = await this.prismaService.relatorio.findFirst({
      where: { OR: [{ pictureURI: fileUUIDName }, { assinaturaURI: fileUUIDName }] },
      select: { produtorId: true, contratoId: true },
    });

    const { produtorId, contratoId } = relatorio;
    const folder = await this.getFolderPath({ produtorId: String(produtorId), contratoId });

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
      if (files[key]) {
        for (const file of files[key]) {
          const fileMetadata = this.createFileMetadata(file, relatorio.id);
          const { id: fileId } = await this.saveMetadata(fileMetadata);
          await fs.writeFile(`${uploadFolder}/${fileId}`, file.buffer);
        }
      }
    }
    return uploadFolder;
  }

  async update(files: FilesInputDto, relatorio: RelatorioModel) {
    const { id: relatorioId } = relatorio;
    const oldFiles = await this.prismaService.pictureFile.findMany({ where: { relatorioId } });
    const uploadFolder = await this.save(files, relatorio);

    if (oldFiles.length) {
      const fileIdsToDelete = oldFiles
        .filter((file) => {
          return (
            (file.description === 'FOTO_RELATORIO' && !!files['foto']) ||
            (file.description === 'ASSINATURA_PRODUTOR' && !!files['assinatura'])
          );
        })
        .map((file) => file.id);
      await this.prismaService.pictureFile.deleteMany({ where: { id: { in: fileIdsToDelete } } });
      await Promise.all(
        fileIdsToDelete.map((fileId) => this.deleteFile(join(uploadFolder, fileId))),
      );
    }
  }

  async remove(fileIds: string | string[], relatorio?: Partial<Relatorio>) {
    if (!fileIds) {
      throw new Error('Id and filesFolder needed.');
    }
    if (typeof fileIds === 'string') {
      fileIds = fileIds.split(',');
    }

    await this.prismaService.pictureFile.deleteMany({ where: { id: { in: fileIds } } });
    for (const id of fileIds) {
      const rel =
        relatorio ||
        (await this.prismaService.relatorio.findFirst({
          where: { OR: [{ pictureURI: { in: fileIds } }, { assinaturaURI: { in: fileIds } }] },
          select: { produtorId: true, contratoId: true, pictureURI: true, assinaturaURI: true },
        }));

      const { produtorId, contratoId } = rel;
      const filesFolder = await this.getFolderPath({ produtorId: String(produtorId), contratoId });
      const filePath = join(filesFolder, id);
      await this.deleteFile(filePath);
    }
    return true;
  }

  async getFolderPath(relatorio: Partial<RelatorioModel>) {
    const { produtorId, contratoId } = relatorio;
    const { nr_cpf_cnpj, id_und_empresa } = await this.produtorService.getUnidadeEmpresa(
      produtorId,
    );

    const baseFolder = process.env.FILES_FOLDER;
    const folderName = join(baseFolder, `contrato_${contratoId}`, id_und_empresa, nr_cpf_cnpj);
    return folderName;
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

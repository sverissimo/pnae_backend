import { Controller, Delete, Get, Param, Res } from '@nestjs/common';
import { FileService } from './file.service';
import { Response } from 'express';
import { join } from 'path';

@Controller('files')
export class FileController {
  constructor(private fileService: FileService) {
    this.fileService = fileService;
  }

  @Get(':fileId')
  async download(@Param('fileId') fileId: string, @Res() res: Response) {
    const subFolder = process.env.FILES_FOLDER;

    this.fileService.getFileStream(fileId, subFolder, (err, fileStream) => {
      if (err) {
        console.error('🚀: file.controller.ts:19:', err);
        return res.status(404).send('Arquivo não encontrado no servidor.');
      }

      res.setHeader('Content-Type', 'image/png');
      fileStream!.pipe(res);
    });
  }

  @Delete(':fileId')
  async deleteFile(@Param('fileId') fileId: string, @Res() res: Response) {
    try {
      const filesFolder = process.env.FILES_FOLDER;
      const filePath = join(filesFolder, fileId);
      await this.fileService.deleteFile(filePath);
      //await this.fileService.remove(fileId, subFolder);
      res.status(204).end();
    } catch (error) {
      res.status(404).send(error.message);
    }
  }
}

import { Controller, Delete, Get, Param, Res } from '@nestjs/common';
import { FileService } from './file.service';
import { Response } from 'express';
import { join } from 'path';

@Controller('files')
export class FileController {
  constructor(private fileService: FileService) {}

  @Get(':fileId')
  async download(@Param('fileId') fileId: string, @Res() res: Response) {
    this.fileService.getFileStream(fileId, (err, fileStream) => {
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
      await this.fileService.remove(fileId);
      res.status(204).end();
    } catch (error) {
      res.status(404).send(error.message);
    }
  }
}

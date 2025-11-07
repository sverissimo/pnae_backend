import { Controller, Delete, Get, Param, Res } from '@nestjs/common';
import { FileService } from './file.service';
import { Response } from 'express';

@Controller('files')
export class FileController {
  constructor(private fileService: FileService) {}

  @Get(':fileId')
  async download(@Param('fileId') fileId: string, @Res() res: Response) {
    this.fileService
      .getFileStream(fileId, (err, fileStream) => {
        if (err) {
          console.error('🚀: file.controller.ts:19:', err);
          if (!res.headersSent) {
            return res.status(404).send('Arquivo não encontrado no servidor.');
          }
          return;
        }

        res.setHeader('Content-Type', 'image/png');
        // Handle stream errors during piping without trying to re-send headers
        fileStream!.on('error', (e) => {
          if (!res.headersSent) {
            res.status(500).end();
          } else {
            res.destroy(e as any);
          }
        });
        fileStream!.pipe(res);
        return;
      })
      .catch((error) => {
        console.log('🚀 - FileController - download - error:', error);
        if (!res.headersSent) {
          return res
            .status(500)
            .send(
              error?.message ||
                JSON.stringify(error) ||
                'Erro ao processar o download do arquivo.',
            );
        }
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

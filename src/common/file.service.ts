import { Injectable } from '@nestjs/common';
import { join } from 'path';
import { promises as fs } from 'fs';

@Injectable()
export class FileService {
  async save(files: { fotos: any; assinatura: any }, visitaId: number) {
    console.log(
      '🚀 ~ file: file.service.ts:8 ~ FileService ~ save ~ visitaId:',
      visitaId,
    );
    const uploadFolder = join(__dirname, '../..', 'src/visitas', 'uploads');

    for (const field of files.fotos) {
      await fs.writeFile(`${uploadFolder}/${field.originalname}`, field.buffer);
    }
    for (const field of files.assinatura) {
      await fs.writeFile(`${uploadFolder}/${field.originalname}`, field.buffer);
    }

    return [1, 2];
  }
}

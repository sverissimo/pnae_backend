import { join } from 'path';
import * as fs from 'fs/promises';
import { Worker } from 'worker_threads';
import { RelatorioPDF } from 'src/modules/relatorios/entities/relatorio-pdf.entity';

export const pdfGen = async (relatorio: RelatorioPDF) => {
  const { produtor, pictureURI, assinaturaURI } = relatorio;

  console.log('🚀 ~ file: pdf-gen.ts:10 ~ pdfGen ~ relatorio:', relatorio);
  const imageFolder = join(__dirname, '../..', 'data/files');

  const pictureBuffer = await fs.readFile(`${imageFolder}/${pictureURI}`);
  const assinaturaBuffer = await fs.readFile(`${imageFolder}/${assinaturaURI}`);

  const worker = new Worker('./pdf-worker.js', {
    workerData: {
      relatorio,
      produtor,
      pictureBase64Image: pictureBuffer.toString('base64'),
      assinaturaBase64Image: assinaturaBuffer.toString('base64'),
    },
  });

  worker.on('message', (pdfBuffer) => {
    // Do something with the PDF buffer
    console.log('Received PDF buffer:', pdfBuffer);
  });

  worker.on('error', (error) => {
    console.error(error);
  });

  worker.on('exit', (code) => {
    console.log(`Worker stopped with exit code ${code}`);
  });
};

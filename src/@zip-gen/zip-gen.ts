import * as archiver from 'archiver';

export const writeDataToStream = async (
  archive: archiver.Archiver,
  pdfStream: NodeJS.ReadWriteStream,
  fileName: string,
) => {
  await new Promise<void>((resolve, reject) => {
    const chunks = [];
    pdfStream.on('data', (chunk) => chunks.push(chunk));
    pdfStream.on('end', () => {
      const completePdfFile = Buffer.concat(chunks);
      archive.append(completePdfFile, { name: fileName });
      resolve();
    });
    pdfStream.on('error', reject);
  });
};

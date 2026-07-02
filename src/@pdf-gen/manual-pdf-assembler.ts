import { PDFDocument, PDFImage } from '@cantoo/pdf-lib';

// sharp ships ESM-shaped typings but a plain `module.exports = sharp` CJS runtime; without
// esModuleInterop only a typed require() is both compile- and runtime-correct here.
const sharp = require('sharp') as typeof import('sharp').default;

export type ManualPdfArquivo = {
  idArquivo: string;
  buffer: Buffer;
  contentType: string;
};

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const PAGE_MARGIN = 36;

// Combined manual-relatório PDF: perfil cover pages, then every relatório PDF's pages, then one
// page per proof photo — both groups already ordered lowest `idArquivo` first by the caller.
export async function assembleManualPdf({
  coverPdf,
  relatorioPdfs,
  fotos,
}: {
  coverPdf: Buffer;
  relatorioPdfs: ManualPdfArquivo[];
  fotos: ManualPdfArquivo[];
}): Promise<Buffer> {
  const combined = await PDFDocument.load(coverPdf);

  for (const relatorioPdf of relatorioPdfs) {
    try {
      const source = await PDFDocument.load(relatorioPdf.buffer, {
        ignoreEncryption: true,
      });
      const pages = await combined.copyPages(source, source.getPageIndices());
      pages.forEach((page) => combined.addPage(page));
    } catch (error) {
      throw arquivoError(relatorioPdf, 'PDF', error);
    }
  }

  for (const foto of fotos) {
    try {
      addImagePage(combined, await embedFoto(combined, foto));
    } catch (error) {
      throw arquivoError(foto, 'imagem', error);
    }
  }

  return Buffer.from(await combined.save());
}

// The sharp re-encode applies EXIF auto-orientation and normalizes GIF to PNG — the two cases
// pdf-lib cannot embed correctly on its own.
async function embedFoto(
  doc: PDFDocument,
  foto: ManualPdfArquivo,
): Promise<PDFImage> {
  if (foto.contentType === 'image/jpeg') {
    return doc.embedJpg(await sharp(foto.buffer).rotate().jpeg().toBuffer());
  }
  return doc.embedPng(await sharp(foto.buffer).rotate().png().toBuffer());
}

function addImagePage(doc: PDFDocument, image: PDFImage): void {
  const page = doc.addPage([A4_WIDTH, A4_HEIGHT]);
  const scale = Math.min(
    (A4_WIDTH - PAGE_MARGIN * 2) / image.width,
    (A4_HEIGHT - PAGE_MARGIN * 2) / image.height,
    1,
  );
  const width = image.width * scale;
  const height = image.height * scale;
  page.drawImage(image, {
    x: (A4_WIDTH - width) / 2,
    y: (A4_HEIGHT - height) / 2,
    width,
    height,
  });
}

function arquivoError(
  arquivo: ManualPdfArquivo,
  kind: 'PDF' | 'imagem',
  error: unknown,
): Error {
  const message = error instanceof Error ? error.message : String(error);
  return new Error(
    `Falha ao montar o PDF do relatório manual: arquivo ${arquivo.idArquivo} (${kind}, ${arquivo.contentType}) — ${message}`,
  );
}

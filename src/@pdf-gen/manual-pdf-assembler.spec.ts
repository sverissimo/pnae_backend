import { PDFDocument } from '@cantoo/pdf-lib';
import { assembleManualPdf } from './manual-pdf-assembler';

const sharp = require('sharp') as typeof import('sharp').default;

describe('assembleManualPdf', () => {
  const createPdf = async (pages: number): Promise<Buffer> => {
    const doc = await PDFDocument.create();
    for (let i = 0; i < pages; i++) {
      doc.addPage([200, 100]);
    }
    return Buffer.from(await doc.save());
  };

  const createImage = (format: 'jpeg' | 'png' | 'gif'): Promise<Buffer> =>
    sharp({
      create: {
        width: 8,
        height: 4,
        channels: 3,
        background: { r: 200, g: 30, b: 30 },
      },
    })
      [format]()
      .toBuffer();

  it('appends every relatório PDF page and one A4 page per proof photo after the cover', async () => {
    const [coverPdf, relatorioPdf, jpeg, png, gif] = await Promise.all([
      createPdf(1),
      createPdf(2),
      createImage('jpeg'),
      createImage('png'),
      createImage('gif'),
    ]);

    const result = await assembleManualPdf({
      coverPdf,
      relatorioPdfs: [
        { idArquivo: '3', buffer: relatorioPdf, contentType: 'application/pdf' },
      ],
      fotos: [
        { idArquivo: '5', buffer: jpeg, contentType: 'image/jpeg' },
        { idArquivo: '9', buffer: png, contentType: 'image/png' },
        { idArquivo: '11', buffer: gif, contentType: 'image/gif' },
      ],
    });

    const combined = await PDFDocument.load(result);
    expect(combined.getPageCount()).toBe(6);

    // Photo pages are A4 portrait regardless of the source image dimensions.
    const lastPage = combined.getPage(5);
    expect(Math.round(lastPage.getWidth())).toBe(595);
    expect(Math.round(lastPage.getHeight())).toBe(842);
  });

  it('returns just the cover when there are no files', async () => {
    const coverPdf = await createPdf(2);

    const result = await assembleManualPdf({
      coverPdf,
      relatorioPdfs: [],
      fotos: [],
    });

    const combined = await PDFDocument.load(result);
    expect(combined.getPageCount()).toBe(2);
  });

  it('fails with the offending idArquivo when a relatório PDF cannot be parsed', async () => {
    const coverPdf = await createPdf(1);

    await expect(
      assembleManualPdf({
        coverPdf,
        relatorioPdfs: [
          {
            idArquivo: '77',
            buffer: Buffer.from('not a pdf'),
            contentType: 'application/pdf',
          },
        ],
        fotos: [],
      }),
    ).rejects.toThrow(/arquivo 77 \(PDF, application\/pdf\)/);
  });

  it('fails with the offending idArquivo when a foto cannot be decoded', async () => {
    const coverPdf = await createPdf(1);

    await expect(
      assembleManualPdf({
        coverPdf,
        relatorioPdfs: [],
        fotos: [
          {
            idArquivo: '88',
            buffer: Buffer.from('not an image'),
            contentType: 'image/jpeg',
          },
        ],
      }),
    ).rejects.toThrow(/arquivo 88 \(imagem, image\/jpeg\)/);
  });
});

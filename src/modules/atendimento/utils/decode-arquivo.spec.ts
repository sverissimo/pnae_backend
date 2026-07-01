import { decodeArquivo } from './decode-arquivo';

describe('decodeArquivo', () => {
  it('decodes raw base64 and sniffs a PDF payload', () => {
    const pdf = Buffer.from('%PDF-1.7\nfake pdf bytes');
    const { buffer, contentType } = decodeArquivo(
      pdf.toString('base64'),
      'relatorio',
    );

    expect(buffer.equals(pdf)).toBe(true);
    expect(contentType).toBe('application/pdf');
  });

  it('sniffs JPEG bytes for a foto', () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const { buffer, contentType } = decodeArquivo(
      jpeg.toString('base64'),
      'foto',
    );

    expect(buffer.equals(jpeg)).toBe(true);
    expect(contentType).toBe('image/jpeg');
  });

  it('sniffs PNG bytes even when fileType default would be jpeg', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const { contentType } = decodeArquivo(png.toString('base64'), 'foto');

    expect(contentType).toBe('image/png');
  });

  it('strips a base64 data URI prefix and uses its mime as fallback', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const dataUri = `data:image/png;base64,${png.toString('base64')}`;
    const { buffer, contentType } = decodeArquivo(dataUri, 'foto');

    expect(buffer.equals(png)).toBe(true);
    expect(contentType).toBe('image/png');
  });

  it('decodes a postgres \\x hex bytea dump', () => {
    const pdf = Buffer.from('%PDF-hexdump');
    const { buffer, contentType } = decodeArquivo(
      '\\x' + pdf.toString('hex'),
      'relatorio',
    );

    expect(buffer.equals(pdf)).toBe(true);
    expect(contentType).toBe('application/pdf');
  });

  it('falls back to the fileType default when bytes are unrecognized', () => {
    const bytes = Buffer.from('not a known file signature');
    const { contentType } = decodeArquivo(bytes.toString('base64'), 'foto');

    expect(contentType).toBe('image/jpeg');
  });
});

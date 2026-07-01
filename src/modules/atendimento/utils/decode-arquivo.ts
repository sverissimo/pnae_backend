import { FileType } from '../dto/get-arquivos.dto';

export interface DecodedArquivo {
  buffer: Buffer;
  contentType: string;
}

const DEFAULT_CONTENT_TYPE: Record<FileType, string> = {
  relatorio: 'application/pdf',
  foto: 'image/jpeg',
};

// The gateway stores the file in a text column that actually holds the binary
// payload, and we don't have a guaranteed encoding. Cover the formats such a
// column realistically produces (data URI, `\x` hex bytea dump, or raw base64),
// then sniff magic bytes so the Content-Type is right even when the requested
// fileType can't tell us the concrete format (a "foto" may be JPEG or PNG).
export function decodeArquivo(
  arquivo: string,
  fileType: FileType,
): DecodedArquivo {
  const { buffer, mimeFromPrefix } = toBuffer(arquivo);
  const contentType =
    sniffContentType(buffer) ??
    mimeFromPrefix ??
    DEFAULT_CONTENT_TYPE[fileType] ??
    'application/octet-stream';

  return { buffer, contentType };
}

function toBuffer(arquivo: string): {
  buffer: Buffer;
  mimeFromPrefix?: string;
} {
  const trimmed = arquivo.trim();

  const dataUri = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/.exec(trimmed);
  if (dataUri) {
    const [, mime, isBase64, payload] = dataUri;
    const buffer = isBase64
      ? Buffer.from(payload, 'base64')
      : Buffer.from(decodeURIComponent(payload), 'utf8');
    return { buffer, mimeFromPrefix: mime || undefined };
  }

  if (/^\\x[0-9a-fA-F]*$/.test(trimmed)) {
    return { buffer: Buffer.from(trimmed.slice(2), 'hex') };
  }

  return { buffer: Buffer.from(trimmed, 'base64') };
}

function sniffContentType(buffer: Buffer): string | undefined {
  if (buffer.length >= 4 && buffer.toString('ascii', 0, 4) === '%PDF') {
    return 'application/pdf';
  }
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'image/png';
  }
  return undefined;
}

import { readFile } from 'fs/promises';
import { FileResolver } from './file-resolver';
import { RelatorioPDF } from 'src/modules/relatorios/entities/relatorio-pdf.entity';

export interface ResolveParams {
  relatorio: RelatorioPDF;
  logoEmaterPath: string;
}

export class Base64ImageService {
  public static async resolve({ relatorio, logoEmaterPath }: ResolveParams) {
    const { produtor, contratoId, pictureURI, assinaturaURI } = relatorio;
    const [pictureBase64Image, assinaturaBase64Image, logoBase64Image] =
      await Promise.all([
        pictureURI
          ? FileResolver.findFileBase64(produtor, contratoId, pictureURI)
          : Promise.resolve(''),
        assinaturaURI
          ? FileResolver.findFileBase64(produtor, contratoId, assinaturaURI)
          : Promise.resolve(''),
        Base64ImageService.readLogo(logoEmaterPath),
      ]);

    return { pictureBase64Image, assinaturaBase64Image, logoBase64Image };
  }

  private static async readLogo(logoEmaterPath: string): Promise<string> {
    try {
      return await readFile(logoEmaterPath, 'base64');
    } catch {
      return '';
    }
  }
}

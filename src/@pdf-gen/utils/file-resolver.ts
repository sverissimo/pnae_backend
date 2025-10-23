import { join } from 'path';
import { access, constants, readdir, readFile } from 'fs/promises';
import { ProdutorPDFInput } from 'src/modules/relatorios/entities/relatorio-pdf.entity';

export class FileResolver {
  public static async findFilePath(
    produtor: ProdutorPDFInput,
    contratoId: number,
    fileName: string,
  ): Promise<string> {
    const { cpfProdutor, id_und_empresa } = produtor;
    const dataFolder =
      process.env.NODE_ENV === 'development'
        ? '/home/node/data'
        : process.env.FILES_FOLDER!;

    const contractFolder = join(dataFolder, `contrato_${contratoId}`);
    const cpfFolder = cpfProdutor.replace(/\D/g, '');

    // 1) direct path
    const direct = join(contractFolder, id_und_empresa, cpfFolder, fileName);
    if (await this.exists(direct)) return direct;

    // 2) workaround for undefined contract folder
    const undefinedContractFolder = join(dataFolder, 'contrato_undefined');
    const workaround = join(
      undefinedContractFolder,
      id_und_empresa,
      cpfFolder,
      fileName,
    );
    if (await this.exists(workaround)) return workaround;

    // 3) scan one level deep
    const entries = await readdir(contractFolder, {
      withFileTypes: true,
    }).catch(() => []);
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const candidate = join(contractFolder, e.name, cpfFolder, fileName);
      if (await this.exists(candidate)) return candidate;
    }

    return '';
  }

  public static async findFileBase64(
    produtor: ProdutorPDFInput,
    contratoId: number,
    fileName: string,
  ): Promise<string> {
    const path = await this.findFilePath(produtor, contratoId, fileName);
    return path ? readFile(path, 'base64') : '';
  }

  private static async exists(path: string): Promise<boolean> {
    try {
      await access(path, constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }
}

import { join } from 'path';
import { writeFile } from 'node:fs/promises';
import * as wkhtmltopdf from 'wkhtmltopdf';
import * as ejs from 'ejs';
import { formatDate } from 'src/utils/formatDate';
import { Base64ImageService } from './utils/ base64-image.service';
import { CreatePdfInput } from './types/create-pdf-input';

export class PdfGenerator {
  private static readonly templatesDir = join(__dirname, 'templates');
  private static readonly ematerLogoPath = join(
    __dirname,
    '../..',
    'assets',
    'emater_logo.jpg',
  );

  public static async generatePdf(
    pdfInputData: CreatePdfInput,
  ): Promise<NodeJS.ReadableStream> {
    try {
      const base64Images = await Base64ImageService.resolve({
        relatorio: pdfInputData.relatorio,
        logoEmaterPath: this.ematerLogoPath,
      });

      const { headerHtml, mainHtml, footerHtml } =
        await this.createHtmlTemplates(pdfInputData, base64Images);

      const { headerFilePath, footerFilePath } =
        await this.writeHeaderAndFooter(headerHtml, footerHtml);

      return wkhtmltopdf(mainHtml, {
        pageSize: 'A4',
        orientation: 'Portrait',
        enableLocalFileAccess: true,
        marginTop: '2.5cm',
        marginBottom: '1.5cm',
        marginRight: '1cm',
        marginLeft: '1cm',
        headerHtml: headerFilePath,
        footerHtml: footerFilePath,
        headerSpacing: 2.7,
        footerSpacing: 0.8,
      });
    } catch (error) {
      console.log('🚀 - PdfGenerator - error:', error);
      throw new Error(`Failed to generate PDF: ${error.message}`);
    }
  }

  private static async createHtmlTemplates(
    pdfInputData: CreatePdfInput,
    base64Images,
  ): Promise<{ headerHtml: string; mainHtml: string; footerHtml: string }> {
    const {
      perfilPDFModel,
      relatorio,
      dados_producao_agro_industria,
      dados_producao_in_natura,
    } = pdfInputData;

    const { pictureBase64Image, assinaturaBase64Image, logoBase64Image } =
      base64Images;

    const { numeroRelatorio, produtor, createdAt } = relatorio;
    const data = formatDate(createdAt);

    const [headerHtml, mainHtml, footerHtml] = await Promise.all([
      ejs.renderFile(`${this.templatesDir}/header.ejs`, {
        logoBase64Image: `data:image/jpeg;base64,${logoBase64Image} `,
      }),
      ejs.renderFile(`${this.templatesDir}/main.ejs`, {
        relatorio: { ...relatorio, data },
        produtor,
        perfil: perfilPDFModel,
        gruposProdutosNatura:
          dados_producao_in_natura.at_prf_see_grupos_produtos,
        gruposProdutosIndustriais:
          dados_producao_agro_industria.at_prf_see_grupos_produtos,
        assinaturaBase64Image: `data:image/jpeg;base64,${assinaturaBase64Image} `,
        pictureBase64Image: `data:image/jpeg;base64,${pictureBase64Image} `,
      }),
      ejs.renderFile(`${this.templatesDir}/footer.ejs`, {
        numeroRelatorio,
        data,
        produtor,
      }),
    ]);

    return { headerHtml, mainHtml, footerHtml };
  }

  private static async writeHeaderAndFooter(
    headerHtml: string,
    footerHtml: string,
  ): Promise<{ headerFilePath: string; footerFilePath: string }> {
    const headerFilePath = `${this.templatesDir}/header.html`;
    const footerFilePath = `${this.templatesDir}/footer.html`;

    await Promise.all([
      writeFile(headerFilePath, headerHtml),
      writeFile(footerFilePath, footerHtml),
    ]);

    return { headerFilePath, footerFilePath };
  }
}

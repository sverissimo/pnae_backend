import { unlink } from 'fs';
import { join } from 'path';
import { readFile, writeFile } from 'node:fs/promises';
import { PassThrough } from 'stream';
import * as wkhtmltopdf from 'wkhtmltopdf';
import * as ejs from 'ejs';
import { RelatorioPDF } from 'src/relatorios/entities/relatorio-pdf.entity';
import { PerfilPDFModel } from 'src/perfil/types/perfil-pdf-model';
import { Produto } from 'src/perfil/entities/produto.entity';
import { formatDate } from 'src/utils/formatDate';

type CreatePdfInput = {
  relatorio: RelatorioPDF;
  perfilPDFModel: PerfilPDFModel;
  dados_producao_in_natura: any;
  dados_producao_agro_industria: any;
};

export const pdfGen = async (pdfInputData: CreatePdfInput) => {
  const { perfilPDFModel, relatorio, dados_producao_agro_industria, dados_producao_in_natura } =
    pdfInputData;
  const { numeroRelatorio, produtor, pictureURI, assinaturaURI } = relatorio;
  const data = formatDate(relatorio.createdAt);
  const produto = new Produto();

  const gruposProdutosNatura = dados_producao_in_natura.at_prf_see_grupos_produtos
    ? dados_producao_in_natura.at_prf_see_grupos_produtos.map((group) =>
        produto.productGroupToDTO(group),
      )
    : null;

  const gruposProdutosIndustriais = dados_producao_agro_industria.at_prf_see_grupos_produtos
    ? dados_producao_agro_industria.at_prf_see_grupos_produtos.map((group) =>
        produto.productGroupToDTO(group),
      )
    : null;

  const imageFolder = join(__dirname, '../..', 'data/files');
  const headerImageFolder = join(__dirname, '../..', 'data');
  const templateFolder = join('/home/node/app/src/@pdf-gen', 'templates');

  let pictureBase64Image = '';
  let assinaturaBase64Image = '';

  if (pictureURI) {
    const pictureBuffer = await readFile(`${imageFolder}/${pictureURI}`, 'base64');
    pictureBase64Image = pictureBuffer.toString();
  }

  if (assinaturaURI) {
    const assinaturaBuffer = await readFile(`${imageFolder}/${assinaturaURI}`);
    assinaturaBase64Image = assinaturaBuffer.toString('base64');
  }
  const logoBase64Image = (
    await readFile(`${headerImageFolder}/emater_logo.jpg`, 'base64')
  ).toString();

  const htmlWithPicture = await ejs.renderFile(`${templateFolder}/main.ejs`, {
    relatorio: { ...relatorio, data },
    produtor,
    perfil: perfilPDFModel,
    gruposProdutosNatura,
    gruposProdutosIndustriais,
    assinaturaBase64Image: `data:image/jpeg;base64,${assinaturaBase64Image} `,
    pictureBase64Image: `data:image/jpeg;base64,${pictureBase64Image} `,
  });

  const headerHtml = await ejs.renderFile(`${templateFolder}/header.ejs`, {
    logoBase64Image: `data:image/jpeg;base64,${logoBase64Image} `,
  });
  const footerHtml = await ejs.renderFile(`${templateFolder}/footer.ejs`, {
    numeroRelatorio,
    data,
    produtor,
  });

  const headerFilePath = `${templateFolder}/header.html`;
  const footerFilePath = `${templateFolder}/footer.html`;
  await writeFile(headerFilePath, headerHtml);
  await writeFile(footerFilePath, footerHtml);

  const pdfStream = new Promise((resolve, reject) => {
    wkhtmltopdf(
      htmlWithPicture,
      {
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
      },
      (err, stream) => {
        unlink(headerFilePath, () => {});
        unlink(footerFilePath, () => {});
        if (err) {
          console.log('🚀 ~ file: pdf-gen.ts:77 ~ pdfGen ~ err:', err);
          reject(err);
          return false;
        }

        const passThroughStream = new PassThrough();
        stream.pipe(passThroughStream);

        console.log('...done');
        resolve(passThroughStream);
        return true;
      },
    );
  });

  return (await pdfStream) as PassThrough;
};

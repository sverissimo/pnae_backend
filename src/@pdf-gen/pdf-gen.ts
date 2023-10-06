import { ReadStream, createReadStream, unlink } from 'fs';
import { join } from 'path';
import { readFile, writeFile } from 'node:fs/promises';
import { PassThrough, Stream } from 'stream';
import * as wkhtmltopdf from 'wkhtmltopdf';
import * as ejs from 'ejs';
import { RelatorioPDF } from 'src/relatorios/entities/relatorio-pdf.entity';
import { PerfilPDFModel } from 'src/perfil/types/perfil-pdf-model';
import { formatDate } from 'src/utils/formatDate';

type CreatePdfInput = {
  perfilPDFModel: PerfilPDFModel;
  relatorio: RelatorioPDF;
  nome_propriedade: string;
  dados_producao_in_natura: any;
  dados_producao_agro_industria: any;
};

export const pdfGen = async (pdfInputData: CreatePdfInput) => {
  const { perfilPDFModel, relatorio, dados_producao_agro_industria, dados_producao_in_natura } =
    pdfInputData;
  const { numeroRelatorio, produtor, pictureURI, assinaturaURI } = relatorio;
  const data = formatDate(relatorio.createdAt);

  const headerImageFolder = join(__dirname, '../..', 'assets');
  const imagesFolder = join(__dirname, '../..', 'data/files');
  const templatesFolder = join(__dirname, 'templates');

  const [pictureBuffer, assinaturaBuffer, logoBuffer] = await Promise.allSettled([
    pictureURI ? readFile(`${imagesFolder}/${pictureURI}`, 'base64') : Promise.resolve(''),
    assinaturaURI ? readFile(`${imagesFolder}/${assinaturaURI}`, 'base64') : Promise.resolve(''),
    readFile(`${headerImageFolder}/emater_logo.jpg`, 'base64'),
  ]);

  const pictureBase64Image =
    pictureBuffer.status === 'fulfilled' ? pictureBuffer.value.toString() : '';
  const assinaturaBase64Image =
    assinaturaBuffer.status === 'fulfilled' ? assinaturaBuffer.value.toString() : '';
  const logoBase64Image = logoBuffer.status === 'fulfilled' ? logoBuffer.value.toString() : '';

  const [headerHtml, htmlWithPicture, footerHtml] = await Promise.all([
    ejs.renderFile(`${templatesFolder}/header.ejs`, {
      logoBase64Image: `data:image/jpeg;base64,${logoBase64Image} `,
    }),
    ejs.renderFile(`${templatesFolder}/main.ejs`, {
      relatorio: { ...relatorio, data },
      produtor,
      perfil: perfilPDFModel,
      gruposProdutosNatura: dados_producao_in_natura.at_prf_see_grupos_produtos,
      gruposProdutosIndustriais: dados_producao_agro_industria.at_prf_see_grupos_produtos,
      assinaturaBase64Image: `data:image/jpeg;base64,${assinaturaBase64Image} `,
      pictureBase64Image: `data:image/jpeg;base64,${pictureBase64Image} `,
    }),
    ejs.renderFile(`${templatesFolder}/footer.ejs`, {
      numeroRelatorio,
      data,
      produtor,
    }),
  ]);
  await writeFile(`${templatesFolder}/tsting.html`, htmlWithPicture);

  const headerFilePath = `${templatesFolder}/header.html`;
  const footerFilePath = `${templatesFolder}/footer.html`;

  await Promise.all([writeFile(headerFilePath, headerHtml), writeFile(footerFilePath, footerHtml)]);

  const pdfStream = wkhtmltopdf(htmlWithPicture, {
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
  return pdfStream;

  // const pdfStream = new Promise((resolve, reject) => {
  //   wkhtmltopdf(
  //     htmlWithPicture,
  //     {
  //       pageSize: 'A4',
  //       orientation: 'Portrait',
  //       enableLocalFileAccess: true,
  //       marginTop: '2.5cm',
  //       marginBottom: '1.5cm',
  //       marginRight: '1cm',
  //       marginLeft: '1cm',
  //       headerHtml: headerFilePath,
  //       footerHtml: footerFilePath,
  //       headerSpacing: 2.7,
  //       footerSpacing: 0.8,
  //     },
  //     (err, stream) => {
  //       console.log('🚀 ~ file: pdf-gen.ts:88 ~ CHECK IF CALLBACK IS BEING CALLED');
  //       unlink(headerFilePath, () => {});
  //       unlink(footerFilePath, () => {});
  //       if (err) {
  //         console.log('🚀 ~ file: pdf-gen.ts:77 ~ pdfGen ~ err:', err);
  //         reject(err);
  //         return false;
  //       }

  //       const passThroughStream = new PassThrough();
  //       stream.pipe(passThroughStream);

  //       stream.on('error', (err) => {
  //         console.log('Stream Error:', err);
  //         reject(err);
  //       });

  //       passThroughStream.on('error', (err) => {
  //         console.log('PassThrough Stream Error:', err);
  //         reject(err);
  //       });

  //       console.log('...done');
  //       resolve(passThroughStream);
  //       return true;
  //     },
  //   );
  // });

  // return (await pdfStream) as PassThrough;
};

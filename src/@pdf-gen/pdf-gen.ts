//import * as fs from 'fs';
import { join } from 'path';
import { readFile, writeFile } from 'node:fs/promises';
import { PassThrough } from 'stream';
import puppeteer from 'puppeteer';
import * as ejs from 'ejs';
import { RelatorioPDF } from 'src/relatorios/entities/relatorio-pdf.entity';
import { PerfilPDFModel } from 'src/perfil/types/perfil-pdf-model';
import { Produto } from 'src/perfil/entities/produto.entity';
import { formatDate } from 'src/utils/formatDate';
import { footer, header } from './layouts';

type CreatePdfInput = {
  relatorio: RelatorioPDF;
  perfilPDFModel: PerfilPDFModel;
  dados_producao_in_natura: any;
  dados_producao_agro_industria: any;
};
export const pdfGen = async (pdfInputData: CreatePdfInput) => {
  const { perfilPDFModel, relatorio, dados_producao_agro_industria, dados_producao_in_natura } =
    pdfInputData;
  const { produtor, pictureURI, assinaturaURI } = relatorio;

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

  relatorio.data = formatDate(relatorio.createdAt);

  const htmlWithPicture = await ejs.renderFile(`/home/node/app/src/@pdf-gen/template.ejs`, {
    relatorio: { ...relatorio },
    produtor,
    perfil: perfilPDFModel,
    gruposProdutosNatura,
    gruposProdutosIndustriais,
    assinaturaBase64Image: `data:image/jpeg;base64,${assinaturaBase64Image} `,
    pictureBase64Image: `data:image/jpeg;base64,${pictureBase64Image} `,
  });

  const browser = await puppeteer.launch({
    executablePath: puppeteer.executablePath(),
    headless: 'new',
    args: ['--disable-gpu', '--disable-dev-shm-usage', '--disable-setuid-sandbox', '--no-sandbox'],
  });

  const page = await browser.newPage();
  await page.setContent(htmlWithPicture, { waitUntil: 'domcontentloaded' });
  await page.emulateMediaType('screen');
  await writeFile('result.html', htmlWithPicture);

  const pdfBuffer = await page.pdf({
    path: 'result5.pdf',
    margin: { top: '130px', right: '50px', bottom: '80px', left: '50px' },
    printBackground: true,
    format: 'A4',
    headerTemplate: header,
    footerTemplate: footer(relatorio),
    displayHeaderFooter: true,
  });

  console.log('...done');
  await page.close();
  await browser.close();

  const pdfStream = new PassThrough();
  pdfStream.end(pdfBuffer);

  return pdfStream;
};

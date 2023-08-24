//import * as fs from 'fs';
import { join } from 'path';
import puppeteer from 'puppeteer';
import * as ejs from 'ejs';
import { RelatorioPDF } from 'src/relatorios/entities/relatorio-pdf.entity';
import { footer, header } from './layouts';
import { formatDate } from 'src/utils/formatDate';
import { readFile, writeFile } from 'node:fs/promises';

export const pdfGen = async (relatorio: RelatorioPDF) => {
  const { produtor, pictureURI, assinaturaURI } = relatorio;

  const browser = await puppeteer.launch({
    executablePath: puppeteer.executablePath(),
    headless: 'new',
    args: ['--disable-gpu', '--disable-dev-shm-usage', '--disable-setuid-sandbox', '--no-sandbox'],
  });

  const page = await browser.newPage();

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
    ...relatorio,
    produtor,
    assinaturaBase64Image: `data:image/jpeg;base64,${assinaturaBase64Image} `,
    pictureBase64Image: `data:image/jpeg;base64,${pictureBase64Image} `,
  });

  await page.setContent(htmlWithPicture, { waitUntil: 'domcontentloaded' });
  await page.emulateMediaType('screen');
  await writeFile('result.html', htmlWithPicture);

  await page.pdf({
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
};

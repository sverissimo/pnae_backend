import { join } from 'path';
import puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as ejs from 'ejs';
import { Relatorio } from 'src/relatorios/entities/relatorio.entity';
import { footer, header } from './layouts';

export const pdfGen = async (relatorio: Relatorio) => {
  const { pictureURI, assinaturaURI } = relatorio;
  console.log('🚀 ~ file: pdf-gen.ts:8 ~ pdfGen ~ relatorio:', relatorio);

  const imageFolder = join(__dirname, '../..', 'data/files');

  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: 'new',
    args: ['--disable-gpu', '--disable-dev-shm-usage', '--disable-setuid-sandbox', '--no-sandbox'],
  });

  const page = await browser.newPage();
  const pictureBase64Image = fs.readFileSync(`${imageFolder}/${pictureURI}`).toString('base64');
  const assinaturaBase64Image = fs
    .readFileSync(`${imageFolder}/${assinaturaURI}`)
    .toString('base64');
  const assunto = 'wtv';
  const htmlWithPicture = await ejs.renderFile(`/home/node/app/src/@pdf-gen/template.ejs`, {
    assunto,
    assinaturaBase64Image: `data:image/jpeg;base64,${assinaturaBase64Image} `,
    pictureBase64Image: `data:image/jpeg;base64,${pictureBase64Image} `,
  });

  await page.setContent(htmlWithPicture, { waitUntil: 'domcontentloaded' });
  await page.emulateMediaType('screen');
  fs.writeFileSync('result.html', htmlWithPicture);

  await page.pdf({
    path: 'result5.pdf',
    margin: { top: '130px', right: '50px', bottom: '80px', left: '50px' },
    printBackground: true,
    format: 'A4',
    headerTemplate: header,
    footerTemplate: footer,
    displayHeaderFooter: true,
  });

  console.log('...done');
  await browser.close();
};

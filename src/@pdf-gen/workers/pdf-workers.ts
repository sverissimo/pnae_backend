// ## TODO:Implementar worker para gerar pdf

// import { Produtor } from '@prisma/client';
// import ejs from 'ejs';
// import puppeteer from 'puppeteer';
// import { RelatorioPDF } from 'src/relatorios/entities/relatorio-pdf.entity';
// import { formatDate } from 'src/utils/formatDate';
// import { header, footer } from '../layouts';

// interface WorkerData {
//   relatorio: RelatorioPDF;
//   produtor: Produtor;
//   pictureBase64Image: string;
//   assinaturaBase64Image: string;
// }

// const generatePDF = async (data: WorkerData) => {
//   const { relatorio, produtor, pictureBase64Image, assinaturaBase64Image } = data;

//   const browser = await puppeteer.launch({
//     executablePath: puppeteer.executablePath(),
//     headless: 'new',
//     args: ['--disable-gpu', '--disable-dev-shm-usage', '--disable-setuid-sandbox', '--no-sandbox'],
//   });

//   const page = await browser.newPage();

//   const htmlWithPicture = await ejs.renderFile(`/home/node/app/src/@pdf-gen/template.ejs`, {
//     ...relatorio,
//     produtor,
//     data: formatDate(relatorio.createdAt),
//     assinaturaBase64Image: `data:image/jpeg;base64,${assinaturaBase64Image} `,
//     pictureBase64Image: `data:image/jpeg;base64,${pictureBase64Image} `,
//   });

//   await page.setContent(htmlWithPicture, { waitUntil: 'domcontentloaded' });
//   await page.emulateMediaType('screen');

//   const pdfBuffer = await page.pdf({
//     margin: { top: '130px', right: '50px', bottom: '80px', left: '50px' },
//     printBackground: true,
//     format: 'A4',
//     headerTemplate: header('INSERT_IMAGE_BASE64'),
//     footerTemplate: footer(relatorio),
//     displayHeaderFooter: true,
//   });

//   console.log('...done');
//   await browser.close();

//   return pdfBuffer;
// };

// // Listen for messages from the main thread
// process.on('message', async (data: WorkerData) => {
//   try {
//     const pdfBuffer = await generatePDF(data);
//     // Send the PDF buffer back to the main thread
//     process.send(pdfBuffer);
//   } catch (error) {
//     console.error(error);
//   }
// });

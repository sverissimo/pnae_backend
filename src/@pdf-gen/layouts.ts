import * as fs from 'fs';
import { join } from 'path';

//const logoFolder = join(__dirname, '../..', 'data/files');
const logoBase64Image = fs.readFileSync(`${__dirname}/emater_logo.png`).toString('base64');

export const header = `
<header style="display: flex;
  font-size: 11px;
  align-items: center;
  justify-content: center;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  width: 100%;"
>
  <div style="display: flex;
   align-items: center;
   width: 90%;
   border-bottom: 1px solid #ddd;
   ">
    <img
      src="data:image/png;base64,${logoBase64Image}"
      alt=""
      style="
      margin-right: 10px;
      max-width: 120px;
      max-height: 70px;"
    />
    <h4 style="
      flex: 7;
      align-self: center;
      line-height: 16px;"
    >
      PNAE MOBILE
      <br />
      RELATÓRIO DE ASSISTÊNCIA TÉCNICA AO AGRICULTOR FAMILIAR
      <br />
      CONTRATO Nº 9385527/2023 - EMATER-MG e SEE
    </h4>
  </div>
</header>
`;

export const footer = `
<footer style="display: flex; flex-direction: column;  align-items:center; margin-top: 20px; width: 100%">
  <div style="display: flex;
    padding-right: 20px;
    width: 90%;
    border-top: 1px solid #999;"
  >
    <p style="font-size: 10px">Relatorio nº X, Proprietario, Data</p>
  </div>
</footer>`;

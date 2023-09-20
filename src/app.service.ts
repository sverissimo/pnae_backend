import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return `
    <h1>PNAE Mobile APP Backend</h1>
    <p>Consulte documentação do REST API (OpenAPI3).</p>
    `;
  }
}

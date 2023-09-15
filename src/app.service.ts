import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return '<h1>Backend PNAE Mobile APP</h1><p>Consulte documentação no padrão OpenAPI3 disponível.</p>';
  }
}

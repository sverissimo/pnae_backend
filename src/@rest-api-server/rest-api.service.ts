import { Injectable } from '@nestjs/common';

@Injectable()
export class RestAPI {
  url: string = process.env.GRAPHQL_SERVER_URL;

  async getPerfilOptions() {
    try {
      const result = await fetch(`${this.url}/api/getPerfilOptions`);
      const data = await result.json();
      return data;
    } catch (error) {
      console.error('🚀 ~ file: perfil-api.service.ts:69 ~ PerfilGraphQLAPI:', error);
    }
  }
}

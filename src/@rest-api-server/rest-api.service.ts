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
      console.log('🚀 ~ file: rest-api.service.ts:13 ~ RestAPI ~ getPerfilOptions ~ error:', error);
    }
  }
  //### TODO: Implement this
  async getReadOnlyRelatorios(ids: string[]) {
    try {
      if (!ids || ids.length === 0) return [];
      const result = await fetch(`${this.url}/api/getReadOnlyRelatorios/${ids}`);
      const data = await result.json();
      return data;
    } catch (error) {
      console.log(
        '🚀 ~ file: rest-api.service.ts:23 ~ RestAPI ~ getReadOnlyRelatorios ~ error:',
        error,
      );
    }
  }
}

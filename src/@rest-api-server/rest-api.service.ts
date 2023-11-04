import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RestAPI {
  url: string;
  token: string;
  constructor(private configService: ConfigService) {
    this.token = this.configService.get('token');
    this.url = this.configService.get('url');
    1;
  }
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
      const result = await fetch(`${this.url}/api/getReadOnlyRelatorios/${ids}`, {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });
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

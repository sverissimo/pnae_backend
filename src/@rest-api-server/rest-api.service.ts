import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { correctValoresPnaeOrder } from './utils/correctValoresPnaeOrder';

@Injectable()
export class RestAPI {
  url: string;
  token: string;
  headers: Record<string, string>;

  constructor(private configService: ConfigService) {
    this.token = this.configService.get('token');
    this.url = this.configService.get('url');
    this.headers = {
      Authorization: `Bearer ${this.token}`,
    };
  }

  async getPerfilOptions() {
    try {
      const result = await fetch(`${this.url}/api/getPerfilOptions`, {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });

      const data = (await result.json()) as Record<string, any>;
      data?.ValorPnae && correctValoresPnaeOrder(data);

      return data;
    } catch (error) {
      console.log(
        '🚀 ~ file: rest-api.service.ts:13 ~ RestAPI ~ getPerfilOptions ~ error:',
        error,
      );
    }
  }

  async getPerfilOptionsRaw() {
    try {
      const result = await fetch(`${this.url}/api/getPerfilOptionsRaw`, {
        ...this.headers,
      });
      const data = await result.json();
      return data;
    } catch (error) {
      console.log(
        '🚀 ~ file: rest-api.service.ts:23 ~ RestAPI ~ getPerfilOptions ~ error:',
        error,
      );
      throw error;
    }
  }

  async getGruposProdutos() {
    try {
      const result = await fetch(`${this.url}/api/getGruposProdutos`, {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });
      const data = await result.json();
      return data;
    } catch (error) {
      console.log(
        '🚀 ~ rest-api.service.ts:39 ~ RestAPI ~ getGruposProdutos ~ error:',
        error,
      );
    }
  }

  async getContractInfo() {
    try {
      const result = await fetch(`${this.url}/api/getContractInfo`, {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });

      const data = await result.json();
      return data;
    } catch (error) {
      console.log(
        '🚀 ~ file: rest-api.service.ts:57 ~ RestAPI ~ getPerfilOptions ~ error:',
        error,
      );
    }
  }

  //### TODO: Implement this
  async getReadOnlyRelatorios(ids: string[]) {
    try {
      if (!ids || ids.length === 0) return [];
      const result = await fetch(
        `${this.url}/api/getReadOnlyRelatorios/${ids}`,
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
          },
        },
      );
      const data = await result.json();
      return data;
    } catch (error) {
      console.log(
        '🚀 ~ file: rest-api.service.ts:23 ~ RestAPI ~ getReadOnlyRelatorios ~ error:',
        error,
      );
    }
  }

  async getAtendimentosWithoutDataSEI() {
    try {
      const result = await fetch(
        `${this.url}/api/getAtendimentosWithoutDataSEI`,
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
          },
        },
      );
      const data = await result.json();
      return data;
    } catch (error) {
      console.log(
        '🚀 ~ file: rest-api.service.ts:23 ~ RestAPI ~ getAtendimentosWithoutDataSEI ~ error:',
        error,
      );
    }
  }
}

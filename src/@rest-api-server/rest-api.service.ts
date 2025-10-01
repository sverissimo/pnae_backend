import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { correctValoresPnaeOrder } from './utils/correctValoresPnaeOrder';
import { UpdateTemasAndVisitaAtendimentoDTO } from 'src/modules/atendimento/dto/update-temas-and-visita-atendimento.dto';
import { PerfilOptionDTO } from 'src/modules/perfil/types/perfil-option.dto';
import { PerfilOptions } from 'src/modules/perfil/types/perfil.options';

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

  private async get<T>(url: string): Promise<T | null> {
    try {
      const response = await fetch(url, { headers: this.headers });

      if (!response.ok) {
        console.warn(
          `[RestAPI] Non-OK response: ${response.status} for ${url}`,
        );
        return null;
      }

      const text = await response.text();
      if (!text) return null;

      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        console.warn(`[RestAPI] Invalid JSON response from ${url}:`, text);
        return null;
      }

      return parsed as T;
    } catch (err) {
      console.error(`[RestAPI] Fetch failed for ${url}:`, err);
    }
  }

  async getPerfilOptions() {
    const data: PerfilOptions = await this.get(
      `${this.url}/api/getPerfilOptions`,
    );

    if (data?.ValorPnae) correctValoresPnaeOrder(data);
    return data;
  }

  getPerfilOptionsRaw() {
    return (
      this.get<PerfilOptionDTO[]>(`${this.url}/api/getPerfilOptionsRaw`) || []
    );
  }

  getGruposProdutos() {
    return this.get(`${this.url}/api/getGruposProdutos`);
  }

  getContractInfo() {
    return this.get(`${this.url}/api/getContractInfo`);
  }

  getRegionaisEmater() {
    return this.get(`${this.url}/api/getRegionaisEmater`);
  }

  async getReadOnlyRelatorios(ids: string[]): Promise<string[]> {
    if (!ids || ids.length === 0) return [];

    const paramIds = ids.map(encodeURIComponent).join(',');
    const result = await this.get<string[]>(
      `${this.url}/api/getReadOnlyRelatorios/${paramIds}`,
    );

    return result || [];
  }

  getTemasAtendimento() {
    return this.get(`${this.url}/api/getTemasAtendimento`);
  }

  getReplacedAtendimentos() {
    return this.get(`${this.url}/api/getReplacedAtendimentos`);
  }

  async updateTemasAndVisitaAtendimento({
    atendimentoId,
    temasAtendimento,
    numeroVisita,
  }: Partial<UpdateTemasAndVisitaAtendimentoDTO>): Promise<void> {
    try {
      const result = await fetch(
        `${this.url}/api/updateTemasAndVisitaAtendimento/${atendimentoId}`,
        {
          method: 'PATCH',
          headers: {
            ...this.headers,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ temasAtendimento, numeroVisita }),
        },
      );
      console.log('🚀 - RestAPI - result:', result);
      return;
    } catch (error) {
      console.log(
        '🚀 ~ file: rest-api.service.ts:23 ~ RestAPI ~ updateTemasAtendimento ~ error:',
        error,
      );
    }
  }
}

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

  private async post(url: string, body: any) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...this.headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const payload = await response.text();

      if (!response.ok) {
        // if (payload) console.warn(`[RestAPI] notOkResponse obj: ${payload}`);
        return null;
      }

      if (!payload) return null;

      try {
        return JSON.parse(payload);
      } catch (parseError) {
        console.warn(`[RestAPI] Invalid JSON from ${url}`, parseError);
        return payload;
      }
    } catch (error) {
      console.error(`[RestAPI] POST ${url} failed:`, error);
      return null;
    }
  }

  async login({
    matricula,
    password,
  }: {
    matricula: string;
    password: string;
  }) {
    if (!matricula || !password) return null;

    const data = await this.post(`${this.url}/api/login`, {
      matricula_usuario: matricula,
      password,
    });

    return data;
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

  getReplacedAtendimentos() {
    return this.get(`${this.url}/api/getReplacedAtendimentos`);
  }

  async aprovarAtendimento(atendimentoId: string): Promise<void> {
    await this.patchAtendimentoValidacao('aprovarAtendimento', atendimentoId);
  }

  async criarPendenciaAtendimento(atendimentoId: string): Promise<void> {
    await this.patchAtendimentoValidacao(
      'criarPendenciaAtendimento',
      atendimentoId,
    );
  }

  // One private caller — the two routes are exact inverses, same as the gateway
  // collapsing them into a single setValidacaoStatus repo method. Unlike
  // updateTemasAndVisitaAtendimento (a fire-and-forget side-sync), this is the
  // coordenador's primary action, so failures must surface to the controller.
  private async patchAtendimentoValidacao(
    route: 'aprovarAtendimento' | 'criarPendenciaAtendimento',
    atendimentoId: string,
  ): Promise<void> {
    const res = await fetch(`${this.url}/api/${route}/${atendimentoId}`, {
      method: 'PATCH',
      headers: this.headers,
    });
    if (!res.ok) {
      const error = new Error(
        `[RestAPI] ${route}/${atendimentoId} failed: ${res.status}`,
      );
      (error as Error & { status: number }).status = res.status;
      throw error;
    }
  }

  async updateTemasAndVisitaAtendimento({
    atendimentoId,
    temasAtendimento,
    numeroVisita,
  }: Partial<UpdateTemasAndVisitaAtendimentoDTO>): Promise<void> {
    try {
      await fetch(
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

      return;
    } catch (error) {
      console.log(
        '🚀 ~ file: rest-api.service.ts:23 ~ RestAPI ~ updateTemasAtendimento ~ error:',
        error,
      );
    }
  }
}

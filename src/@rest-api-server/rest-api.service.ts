import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { correctValoresPnaeOrder } from './utils/correctValoresPnaeOrder';
import { UpdateTemasAndVisitaAtendimentoDTO } from 'src/modules/atendimento/dto/update-temas-and-visita-atendimento.dto';
import {
  ArquivoAtendimentoDTO,
  GetArquivosQueryDTO,
} from 'src/modules/atendimento/dto/get-arquivos.dto';
import { PerfilOptionDTO } from 'src/modules/perfil/types/perfil-option.dto';
import { PerfilOptions } from 'src/modules/perfil/types/perfil.options';
import { MunicipioEmater } from './types/municipio-emater';

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

  getMunicipiosEmater() {
    return this.get<MunicipioEmater[]>(`${this.url}/api/getMunicipiosEmater`);
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

  // PNAE-supported MIME set only: the relatório artifact is always PDF and the proof-of-visit is
  // always an image. DOCX/TIFF are absent for PNAE and the ~3 stray `application/msword` rows are
  // treated as bad data — never fetched here (the assembled-PDF endpoint rejects them instead).
  // We probe one MIME at a time in a fixed order; the gateway (`GET /api/getArquivos`) returns the
  // lowest-`idArquivo` active file for that exact `tipo_arquivo` and a `{ arquivo: null }` miss, so
  // selection is deterministic and a miss simply advances to the next MIME.
  getArquivos({
    atendimentoId,
    fileType,
  }: GetArquivosQueryDTO): Promise<{
    arquivo: string;
    contentType?: string;
  } | null> {
    const gatewayFileTypes =
      fileType === 'relatorio'
        ? ['application/pdf']
        : ['image/jpeg', 'image/png', 'image/gif'];

    return this.getArquivoByTipo(atendimentoId, gatewayFileTypes);
  }

  // All active files of the atendimento (metadata + raw binary), lowest `idArquivo` first —
  // feeds the combined manual-PDF assembly, which embeds every relatório PDF and proof photo.
  // `null` means the gateway call itself failed; an atendimento without files is `{ arquivos: [] }`.
  getArquivosAtendimento(
    atendimentoId: string,
  ): Promise<{ arquivos: ArquivoAtendimentoDTO[] } | null> {
    const params = new URLSearchParams({ atendimentoId });
    return this.get(
      `${this.url}/api/getArquivosAtendimento?${params.toString()}`,
    );
  }

  private async getArquivoByTipo(
    atendimentoId: string,
    gatewayFileTypes: string[],
  ): Promise<{ arquivo: string; contentType?: string } | null> {
    for (const gatewayFileType of gatewayFileTypes) {
      const params = new URLSearchParams({
        atendimentoId,
      });
      const result = await this.get<{ arquivo: string }>(
        `${this.url}/api/getArquivos?${params.toString()}&fileType=${gatewayFileType}`,
      );
      if (result?.arquivo) return { ...result, contentType: gatewayFileType };
    }
    return null;
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

  async aprovarSei(atendimentoId: string): Promise<void> {
    await this.patchAtendimentoValidacao('aprovarSei', atendimentoId);
  }

  async removerAprovacaoSei(atendimentoId: string): Promise<void> {
    await this.patchAtendimentoValidacao('removerAprovacaoSei', atendimentoId);
  }

  // Shared by all four atendimento PATCH-status callers. Unlike the fire-and-forget
  // updateTemasAndVisitaAtendimento, these are primary actions, so failures throw.
  private async patchAtendimentoValidacao(
    route:
      | 'aprovarAtendimento'
      | 'criarPendenciaAtendimento'
      | 'aprovarSei'
      | 'removerAprovacaoSei',
    atendimentoId: string,
  ): Promise<void> {
    const res = await fetch(`${this.url}/api/${route}/${atendimentoId}`, {
      method: 'PATCH',
      headers: this.headers,
    });
    if (!res.ok) {
      // Surface the gateway's { error } body (no "[RestAPI]" prefix) so the 400 reason
      // reaches the UI via PlainTextExceptionFilter as a clean message, not just a status.
      const body = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      const reason = body?.error ?? `${route}/${atendimentoId} failed`;
      const error = new Error(reason) as Error & { status: number };
      error.status = res.status;
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

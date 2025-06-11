import * as fs from 'fs';

import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { FileService } from 'src/common/files/file.service';
import { UsuarioGraphQLAPI } from 'src/@graphQL-server/usuario-api.service';
import { ProdutorGraphQLAPI } from 'src/@graphQL-server/produtor-api.service';
import { formatCPF, unformatCPF } from 'src/utils/formatCPF';
import { Perfil } from 'src/@domain/perfil/perfil.entity';
import { PerfilModel } from 'src/@domain/perfil/perfil.model';
import { RestAPI } from 'src/@rest-api-server/rest-api.service';
import { Relatorio } from 'src/@domain/relatorio/relatorio';
import { RelatorioDto } from './dto/relatorio.dto';
import { RelatorioModel } from 'src/@domain/relatorio/relatorio-model';
import { Usuario } from '../usuario/entity/usuario-model';
import { AtendimentoService } from '../atendimento/atendimento.service';
import { pdfGen } from 'src/@pdf-gen/pdf-gen';
import { ZipCreator } from 'src/@zip-gen/ZipCreator';
import { ProdutorService } from '../produtor/produtor.service';
import { formatReverseDate } from 'src/utils';
import { Atendimento } from '../atendimento/entities/atendimento.entity';
import { UpdateRelatorioDto } from './dto/update-relatorio.dto';

type queryObject = { ids?: string[]; produtorIds?: string[] };

@Injectable()
export class RelatorioService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly usuarioApi: UsuarioGraphQLAPI,
    private readonly produtorApi: ProdutorGraphQLAPI,
    private readonly produtorService: ProdutorService,
    private readonly atendimentoService: AtendimentoService,
    private readonly fileService: FileService,
    private readonly restAPI: RestAPI,
  ) {}

  async create(relatorioInput: RelatorioModel) {
    try {
      const relatorioDto = new Relatorio(relatorioInput).toDto();
      const createdRelatorio = await this.prismaService.relatorio.create({
        data: relatorioDto,
      });

      return createdRelatorio;
    } catch (error) {
      if (error.code === 'P2002' && error.meta?.target?.includes('id')) {
        throw new Error('Relatório com este ID já existe');
      }
      throw error;
    }
  }

  async createMany(relatorios: RelatorioModel[]) {
    const data = relatorios.map((r) => new Relatorio(r).toDto());
    await this.prismaService.relatorio.createMany({ data });
    return 'Relatórios criados com sucesso';
  }

  async findOne(id: string) {
    const relatorio = await this.prismaService.relatorio.findUnique({
      where: { id: id },
    });

    if (!relatorio) {
      throw new NotFoundException('Nenhum relatório encontrado');
    }
    return relatorio;
  }

  async findManyById(ids: string[]) {
    const relatorios = await this.prismaService.relatorio.findMany({
      where: { id: { in: ids } },
    });
    const relatoriosWithPermissions = (
      await this.updateRelatoriosPermissions(relatorios)
    ).map(Relatorio.toModel);
    return relatoriosWithPermissions;
  }

  async findMany(input: queryObject | string | string[]) {
    let query = {};

    if (typeof input === 'string') {
      query = { produtorId: { in: [BigInt(input)] } };
    } else if (Array.isArray(input)) {
      query = { produtorId: { in: input.map((id) => BigInt(id)) } };
    } else if (input.ids || input.produtorIds) {
      const produtorIds = input.produtorIds.map((id) => BigInt(id));
      query = {
        OR: [{ id: { in: input.ids } }, { produtorId: { in: produtorIds } }],
      };
    }
    const relatorios = await this.prismaService.relatorio.findMany({
      where: query,
    });

    const relatoriosWithPermissions = (
      await this.updateRelatoriosPermissions(relatorios)
    ).map(Relatorio.toModel);
    return relatoriosWithPermissions;
  }

  async findAll() {
    const relatorios = await this.prismaService.relatorio.findMany({
      take: 500,
      orderBy: { createdAt: 'desc' },
    });
    return relatorios.map(Relatorio.toModel);
  }

  async update(updateInput: UpdateRelatorioDto) {
    console.log('🚀 - RelatorioService - update - update:', updateInput);
    // const { id, atendimentoId, numeroRelatorio, temas_atendimento } = update;

    const { id, atendimentoId, temas_atendimento, ...update } = updateInput;
    const { readOnly } = await this.findOne(id);
    if (readOnly) {
      throw new UnauthorizedException(
        'Não é possível alterar relatório, pois já foi validado pela gerência.',
      );
    }

    // ************ ITEM 134 (Rel é sub de outro) FOI REMOVIDO DO BANCO. ************
    // const newAtendimentoId = await this.atendimentoService.updateIfNecessary(
    //   atendimentoId,
    //   String(numeroRelatorio),
    // );
    // *****************************************************************************
    //INSTEAD:
    console.log(
      '🚀 - RelatorioService - update - temas_atendimento:',
      temas_atendimento,
    );
    if (temas_atendimento && temas_atendimento.length > 0) {
      const temasDTO = Atendimento.temasAtendimentoListToDTO(temas_atendimento);
      await this.atendimentoService.updateTemasAtendimento(
        atendimentoId,
        temasDTO,
      );
    }

    const data = Relatorio.updateFieldsToDTO({
      ...update,
      // atendimentoId: newAtendimentoId, // Wont change anymore cause no 134
    });

    await this.prismaService.relatorio.update({
      where: { id },
      data,
    });

    // return newAtendimentoId;
  }

  async remove(id: string) {
    const relatorio = await this.findOne(id);
    if (relatorio.readOnly) {
      throw new UnauthorizedException(
        'Não é possível remover relatório, pois já foi validado pela gerência.',
      );
    }

    const atendimentoId = relatorio?.atendimentoId?.toString();
    if (atendimentoId) {
      await this.atendimentoService.logicRemove(atendimentoId);
    }

    await this.removeFiles(relatorio);
    await this.prismaService.relatorio.delete({ where: { id } });
    return `Relatorio ${id} removed.`;
  }

  async getReadOnly(relatorios: RelatorioDto[]) {
    try {
      const ids = relatorios.map((r) => r.id);
      const readOnly = await this.restAPI.getReadOnlyRelatorios(ids);
      return readOnly;
    } catch (error) {
      console.log(
        '🚀 ~ file: relatorios.service.ts:100 ~ RelatorioService ~ getReadOnly ~ error:',
        error,
      );
    }
  }

  async updateRelatoriosPermissions(relatorios: RelatorioDto[]) {
    const readOnlyIds = await this.getReadOnly(relatorios);
    const editableIds = relatorios
      .filter((r) => !readOnlyIds.includes(r.id))
      .map((r) => r.id);
    const editableUpdates = { ids: editableIds, update: { readOnly: false } };
    const readOnlyUpdates = { ids: readOnlyIds, update: { readOnly: true } };

    await Promise.all([
      this.updateMany(editableUpdates),
      this.updateMany(readOnlyUpdates),
    ]);
    const response = relatorios.map((r) => ({
      ...r,
      readOnly: readOnlyIds.includes(r.id),
    }));
    return response;
  }

  async createPDFInput(relatorioId: string, relatorioInput?: RelatorioModel) {
    const relatorio = relatorioInput || (await this.findOne(relatorioId));
    if (!relatorio) {
      throw new NotFoundException('Relatório não encontrado');
    }

    try {
      const { outroExtensionista, contratoId: relatorioContratoId } = relatorio;

      const tecnicoId = relatorio.tecnicoId.toString();
      const tecnicoIds = outroExtensionista
        ? tecnicoId + ',' + outroExtensionista
        : tecnicoId;
      const { usuarios } = (await this.usuarioApi.getUsuarios({
        ids: tecnicoIds,
      })) as {
        usuarios: Usuario[];
      };
      const usuario = usuarios.find((u) => u.id_usuario == relatorio.tecnicoId);
      let outrosExtensionistas: Usuario[] | undefined;

      if (outroExtensionista) {
        outrosExtensionistas = usuarios
          .filter((u) => u.id_usuario != relatorio.tecnicoId)
          .map((e) => ({
            ...e,
            matricula_usuario: e.digito_matricula
              ? e.matricula_usuario + '-' + e.digito_matricula
              : e.matricula_usuario,
          }));
      }

      const produtor = await this.produtorApi.getProdutorById(
        relatorio.produtorId.toString(),
      );
      const { perfis, propriedades } = produtor;

      if (!propriedades || !propriedades.length) {
        throw new NotFoundException(
          `Nenhuma propriedade encontrada para o produtor ${produtor.nm_pessoa}`,
        );
      }
      if (!perfis || !perfis.length) {
        throw new NotFoundException(
          `Nenhum Perfil encontrado para o produtor ${produtor.nm_pessoa}`,
        );
      }

      const perfil = perfis.find(
        (p: PerfilModel) =>
          p.id_contrato === (relatorioContratoId || 1) &&
          p.tipo_perfil === 'ENTRADA',
      ) as PerfilModel;

      const perfilDTO = new Perfil(perfil).toDTO();
      const { dados_producao_in_natura, dados_producao_agro_industria } =
        perfilDTO || {};

      const nome_propriedade = propriedades
        .map((p) => p.nome_propriedade)
        .join(', ');

      const perfilPDFModel = new Perfil().toPDFModel({
        ...perfil,
        nome_propriedade,
      });

      const { municipio } = propriedades[0];
      const matricula = usuario.digito_matricula
        ? usuario.matricula_usuario + '-' + usuario.digito_matricula
        : usuario.matricula_usuario;

      return {
        relatorio: {
          ...relatorio,
          produtor: {
            nomeProdutor: produtor.nm_pessoa,
            cpfProdutor: formatCPF(produtor.nr_cpf_cnpj),
            caf: produtor.caf || produtor.dap,
            id_und_empresa: produtor.id_und_empresa,
          },
          nomeTecnico: usuario.nome_usuario,
          matricula,
          municipio: municipio.nm_municipio,
          outrosExtensionistas,
        },
        nome_propriedade,
        dados_producao_in_natura,
        dados_producao_agro_industria,
        perfilPDFModel,
      };
    } catch (error) {
      // console.error('🚀 ~ file: relatorios.service.ts:244 ~ createPDF:', error);
      console.log(error);
      throw new InternalServerErrorException(error.message); // or throw new InternalServerErrorException(error.message);
    }
  }

  async createZipFile() {
    const unsentRelatorios = await this.getUnsentRelatorios();

    if (!unsentRelatorios.length) {
      return 'Não há nenhum relatório para ser enviado para a SEE.';
    }

    const relatoriosPorMunicipio = await this.getRelatoriosPorMunicipio(
      unsentRelatorios,
    );

    const allZipFilePaths = await this.createZipFilesForAllMunicipios(
      relatoriosPorMunicipio,
    );

    const result = await ZipCreator.generateFinalZip(allZipFilePaths);

    const idsToRegisterDataSEI = unsentRelatorios.map((r) => r.atendimentoId);
    await this.atendimentoService.saveIdsToFile(idsToRegisterDataSEI);

    return result;
  }

  async downloadRelatorioZip() {
    try {
      await this.atendimentoService.registerDataSEI();
    } catch (error) {
      console.log(
        '🚀 - RelatorioService - downloadRelatorioZip - error:',
        error,
      );
    }
    const zipPath = process.env.ZIP_FILES_PATH;
    const zipStream = fs.createReadStream(`${zipPath}/final.zip`);
    return zipStream;
  }

  private async getRelatoriosPorMunicipio(relatorios: RelatorioModel[]) {
    const uniqueProdutoresIds = [
      ...new Set(relatorios.map((r) => r.produtorId)),
    ];

    const produtores = (await this.produtorService.findManyById(
      uniqueProdutoresIds,
    )) as any[];

    produtores.sort((a, b) => {
      const primary = a.municipio.localeCompare(b.municipio);
      if (primary !== 0) return primary;
      return a.nm_pessoa.localeCompare(b.nm_pessoa);
    });

    const relatoriosPorMunicipio: any[] = produtores.reduce((acc, p) => {
      if (acc[p.municipio]) {
        acc[p.municipio].push(
          ...relatorios.filter((r) => r.produtorId === p.id_pessoa_demeter),
        );
      } else {
        acc[p.municipio] = relatorios.filter(
          (r) => r.produtorId === p.id_pessoa_demeter,
        );
      }
      return acc;
    }, {});

    return relatoriosPorMunicipio;
  }

  private async createZipFilesForAllMunicipios(relatoriosGroupedByMunicipio) {
    const allZipFilePaths = [];

    for (const municipio in relatoriosGroupedByMunicipio) {
      const relatoriosForMunicipio = relatoriosGroupedByMunicipio[municipio];
      const zipCreator = new ZipCreator(
        municipio,
        relatoriosForMunicipio,
        this.createPDFStream.bind(this),
      );

      const zipFilePathsForMunicipio = await zipCreator.generateZipFiles();
      allZipFilePaths.push(...zipFilePathsForMunicipio);
    }

    return allZipFilePaths;
  }

  private async getUnsentRelatorios(): Promise<RelatorioModel[]> {
    const atendimentosSemDataSEI: Partial<Atendimento>[] =
      await this.atendimentoService.getAtendimentosWithoutDataSEI();

    if (!atendimentosSemDataSEI.length) return [] as any;

    console.log('🚀RelatorioService idsSemSEI:', atendimentosSemDataSEI.length);

    const atendimentoIds = atendimentosSemDataSEI.map((a) =>
      BigInt(a.id_at_atendimento),
    );

    const relatorios = (
      await this.prismaService.relatorio.findMany({
        where: {
          atendimentoId: { in: atendimentoIds },
        },
      })
    ).map(Relatorio.toModel);

    return relatorios;
  }

  async createPDFStream(relatorioId: string, relatorioInput?: RelatorioModel) {
    const {
      relatorio,
      perfilPDFModel,
      nome_propriedade,
      dados_producao_agro_industria,
      dados_producao_in_natura,
    } = await this.createPDFInput(relatorioId, relatorioInput);

    const pdfStream = await pdfGen({
      relatorio,
      perfilPDFModel,
      nome_propriedade,
      dados_producao_agro_industria,
      dados_producao_in_natura,
    });

    const { municipio, atendimentoId, createdAt } = relatorio;
    const { nomeProdutor, cpfProdutor } = relatorio.produtor;
    const unformattedCPF = unformatCPF(cpfProdutor);
    const date = formatReverseDate(new Date(createdAt));
    const filename = `2.3_${municipio}_${nomeProdutor}_${date}_${atendimentoId}_${unformattedCPF}_final.pdf`;
    return { filename, pdfStream };
  }

  private async removeFiles(relatorio: RelatorioDto) {
    const { pictureURI, assinaturaURI } = relatorio;
    const fileIds = [pictureURI, assinaturaURI].filter((f) => !!f);
    if (fileIds.length > 0) {
      await this.fileService.remove(fileIds, relatorio);
    }
  }

  private async updateMany({
    ids,
    update,
  }: {
    ids: string[];
    update: Partial<RelatorioDto>;
  }) {
    const updated = await this.prismaService.relatorio.updateMany({
      where: { id: { in: ids } },
      data: update,
    });
    return updated;
  }
}

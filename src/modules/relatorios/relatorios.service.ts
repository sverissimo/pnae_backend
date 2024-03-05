import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as archiver from 'archiver';
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
import { writeDataToStream } from 'src/@zip-gen/zip-gen';
import { ZipCreator } from 'src/@zip-gen/ZipCreator';
import { ProdutorService } from '../produtor/produtor.service';

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
    const relatoriosWithPermissions = (await this.updateRelatoriosPermissions(relatorios)).map(
      Relatorio.toModel,
    );
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
      query = { OR: [{ id: { in: input.ids } }, { produtorId: { in: produtorIds } }] };
    }
    const relatorios = await this.prismaService.relatorio.findMany({
      where: query,
    });

    const relatoriosWithPermissions = (await this.updateRelatoriosPermissions(relatorios)).map(
      Relatorio.toModel,
    );
    return relatoriosWithPermissions;
  }

  async findAll() {
    const relatorios = await this.prismaService.relatorio.findMany({
      include: {
        files: true,
      },
    });
    return relatorios;
  }

  async update(update: RelatorioModel) {
    console.log('🚀 - RelatorioService - update - update:', update);

    const { id, atendimentoId, numeroRelatorio } = update;
    const { readOnly } = await this.findOne(id);
    if (readOnly) {
      throw new UnauthorizedException(
        'Não é possível alterar relatório, pois já foi validado pela gerência.',
      );
    }

    const newAtendimentoId = await this.atendimentoService.updateIfNecessary(
      atendimentoId,
      String(numeroRelatorio),
    );
    console.log('🚀 - RelatorioService - update - newAtendimentoId:', newAtendimentoId);

    const data = Relatorio.updateFieldsToDTO({ ...update, atendimentoId: newAtendimentoId });
    await this.prismaService.relatorio.update({
      where: { id },
      data,
    });

    return newAtendimentoId;
  }

  async remove(id: string) {
    const relatorio = await this.findOne(id);
    if (relatorio.readOnly) {
      throw new UnauthorizedException(
        'Não é possível remover relatório, pois já foi validado pela gerência.',
      );
    }

    const atendimentoId = relatorio?.atendimentoId?.toString();
    atendimentoId && (await this.atendimentoService.logicRemove(atendimentoId));

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
    const editableIds = relatorios.filter((r) => !readOnlyIds.includes(r.id)).map((r) => r.id);
    const editableUpdates = { ids: editableIds, update: { readOnly: false } };
    const readOnlyUpdates = { ids: readOnlyIds, update: { readOnly: true } };

    await Promise.all([this.updateMany(editableUpdates), this.updateMany(readOnlyUpdates)]);
    const response = relatorios.map((r) => ({ ...r, readOnly: readOnlyIds.includes(r.id) }));
    return response;
  }

  async createPDFInput(relatorioId: string) {
    const relatorio = await this.findOne(relatorioId);
    if (!relatorio) {
      throw new NotFoundException('Relatório não encontrado');
    }

    try {
      const { outroExtensionista, contratoId: relatorioContratoId } = relatorio;

      const tecnicoId = relatorio.tecnicoId.toString();
      const tecnicoIds = outroExtensionista ? tecnicoId + ',' + outroExtensionista : tecnicoId;
      const { usuarios } = (await this.usuarioApi.getUsuarios({ ids: tecnicoIds })) as {
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

      const produtor = await this.produtorApi.getProdutorById(relatorio.produtorId.toString());
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
          p.id_contrato === (relatorioContratoId || 1) && p.tipo_perfil === 'ENTRADA',
      ) as PerfilModel;

      const perfilDTO = new Perfil(perfil).toDTO();

      const { municipio } = propriedades[0];
      const nome_propriedade = propriedades.map((p) => p.nome_propriedade).join(', ');
      const { dados_producao_in_natura, dados_producao_agro_industria } = perfilDTO;
      const matricula = usuario.digito_matricula
        ? usuario.matricula_usuario + '-' + usuario.digito_matricula
        : usuario.matricula_usuario;
      const perfilPDFModel = new Perfil().toPDFModel({ ...perfil, nome_propriedade });
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

  async createNestedZipFiles(relatoriosIds: string[]) {}

  async createZipFile(relatoriosIds: string[]) {
    const archive = archiver('zip', {
      zlib: { level: 9 },
    });

    // const relatorios = await this.findManyById(relatoriosIds);

    const produtores = await this.findManyById(relatoriosIds);
    // const municipios = produtores.map((p) => p.municipio);

    for (const id of relatoriosIds) {
      await this.createPDFStream(id, archive);
    }
    return archive;
  }

  async createPDFStream(relatorioId: string, archive: archiver.Archiver) {
    const {
      relatorio,
      perfilPDFModel,
      nome_propriedade,
      dados_producao_agro_industria,
      dados_producao_in_natura,
    } = await this.createPDFInput(relatorioId);

    const pdfStream = await pdfGen({
      relatorio,
      perfilPDFModel,
      nome_propriedade,
      dados_producao_agro_industria,
      dados_producao_in_natura,
    });

    const { numeroRelatorio, municipio } = relatorio;
    const { nomeProdutor, cpfProdutor } = relatorio.produtor;
    const unformattedCPF = unformatCPF(cpfProdutor);
    const filename = `2.3_${municipio}_${nomeProdutor}_${unformattedCPF}_${numeroRelatorio}_final.pdf`;
    // const zipCreator = new ZipCreator();
    // await zipCreator.createZipFile(relatorioId, pdfStream);
    await writeDataToStream(archive, pdfStream, filename);
    return { filename, pdfStream };
  }

  private async removeFiles(relatorio: RelatorioDto) {
    const { pictureURI, assinaturaURI } = relatorio;
    const fileIds = [pictureURI, assinaturaURI].filter((f) => !!f);
    if (fileIds.length > 0) {
      await this.fileService.remove(fileIds, relatorio);
    }
  }

  private async updateMany({ ids, update }: { ids: string[]; update: Partial<RelatorioDto> }) {
    const updated = await this.prismaService.relatorio.updateMany({
      where: { id: { in: ids } },
      data: update,
    });
    return updated;
  }
}

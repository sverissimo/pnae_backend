import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Relatorio, Usuario } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { FileService } from 'src/common/file.service';
import { UsuarioGraphQLAPI } from 'src/@graphQL-server/usuario-api.service';
import { ProdutorGraphQLAPI } from 'src/@graphQL-server/produtor-api.service';
import { formatCPF } from 'src/utils/formatCPF';
import { CreateRelatorioDto } from './dto/create-relatorio.dto';
import { UpdateRelatorioDto } from './dto/update-relatorio.dto';
import { Perfil } from 'src/perfil/entities/perfil.entity';
import { PerfilModel } from 'src/perfil/entities/perfil.model';
import { RestAPI } from 'src/@rest-api-server/rest-api.service';

@Injectable()
export class RelatorioService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly usuarioApi: UsuarioGraphQLAPI,
    private readonly produtorApi: ProdutorGraphQLAPI,
    private readonly fileService: FileService,
    private readonly restAPI: RestAPI,
  ) {}

  async create(createRelatorioDto: CreateRelatorioDto): Promise<Relatorio> {
    const { produtorId, tecnicoId, numeroRelatorio, ...relatorioInput } = createRelatorioDto;
    try {
      const relatorio = await this.prismaService.relatorio.create({
        data: {
          ...relatorioInput,
          produtorId: BigInt(produtorId),
          tecnicoId: BigInt(tecnicoId),
          numeroRelatorio: +numeroRelatorio,
        },
      });

      return relatorio;
    } catch (error) {
      if (error.code === 'P2002' && error.meta?.target?.includes('id')) {
        throw new Error('Relatório com este ID já existe');
      }
      throw error;
    }
  }

  async findAll() {
    const relatorios = await this.prismaService.relatorio.findMany({
      include: {
        files: true,
      },
    });
    return relatorios;
  }

  async findMany(produtorId: number) {
    const relatorios = await this.prismaService.relatorio.findMany({ where: { produtorId } });
    const relatoriosWithPermissions = await this.updateRelatoriosPermissions(relatorios);
    return relatoriosWithPermissions;
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

  async update(update: UpdateRelatorioDto) {
    const { id, numeroRelatorio, produtorId, tecnicoId, updatedAt } = update;
    const { readOnly } = await this.findOne(id);
    if (readOnly) {
      throw new UnauthorizedException(
        'Não é possível alterar relatório, pois já foi validado pela gerência.',
      );
    }

    if (numeroRelatorio) update.numeroRelatorio = +numeroRelatorio;
    if (produtorId) update.produtorId = BigInt(produtorId);
    if (tecnicoId) update.tecnicoId = BigInt(tecnicoId);

    const data = {
      ...update,
      updatedAt: new Date(updatedAt.slice(0, 10) + ' ' + updatedAt.slice(11, 19)),
    };

    const updated = await this.prismaService.relatorio.update({
      where: { id },
      data,
    });
    return updated;
  }

  async remove(id: string) {
    const relatorio = await this.findOne(id);
    if (relatorio.readOnly) {
      throw new UnauthorizedException(
        'Não é possível remover relatório, pois já foi validado pela gerência.',
      );
    }
    const { pictureURI, assinaturaURI } = relatorio;
    const fileIds = [pictureURI, assinaturaURI].filter((f) => !!f);
    if (fileIds.length > 0) {
      await this.fileService.remove(fileIds, process.env.FILES_FOLDER);
    }
    await this.prismaService.relatorio.delete({ where: { id } });
    return `Relatorio ${id} removed.`;
  }

  async getReadOnly(relatorios: Relatorio[]) {
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

  async updateRelatoriosPermissions(relatorios: Relatorio[]) {
    const readOnlyIds = await this.getReadOnly(relatorios);
    const editableIds = relatorios.filter((r) => !readOnlyIds.includes(r.id)).map((r) => r.id);
    const editableUpdates = { ids: editableIds, update: { readOnly: false } };
    const readOnlyUpdates = { ids: readOnlyIds, update: { readOnly: true } };

    await Promise.all([this.updateMany(editableUpdates), this.updateMany(readOnlyUpdates)]);
    const response = relatorios.map((r) => ({ ...r, readOnly: readOnlyIds.includes(r.id) }));
    return response;
  }

  private async updateMany({ ids, update }: { ids: string[]; update: Partial<Relatorio> }) {
    const updated = await this.prismaService.relatorio.updateMany({
      where: { id: { in: ids } },
      data: update,
    });
    return updated;
  }

  async createPDFInput(relatorioId: string) {
    try {
      const relatorio = await this.findOne(relatorioId);
      const { outroExtensionista } = relatorio;

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
            matricula_usuario: e.matricula_usuario + '-' + e.digito_matricula,
          }));
      }

      const produtor = await this.produtorApi.getProdutorById(relatorio.produtorId.toString());
      const { perfis, propriedades } = produtor;

      const perfil = perfis[0] as PerfilModel;
      const perfilDTO = new Perfil(perfil).toDTO();

      const { municipio } = propriedades[0];
      const nome_propriedade = propriedades.map((p) => p.nome_propriedade).join(', ');
      const { dados_producao_in_natura, dados_producao_agro_industria } = perfilDTO;

      const perfilPDFModel = new Perfil().toPDFModel({ ...perfil, nome_propriedade });
      return {
        relatorio: {
          ...relatorio,
          produtor: {
            nomeProdutor: produtor.nm_pessoa,
            cpfProdutor: formatCPF(produtor.nr_cpf_cnpj),
            caf: produtor.caf || produtor.dap,
          },
          nomeTecnico: usuario.nome_usuario,
          matricula: usuario.matricula_usuario + '-' + usuario.digito_matricula,
          municipio: municipio.nm_municipio,
          outrosExtensionistas,
        },
        nome_propriedade,
        dados_producao_in_natura,
        dados_producao_agro_industria,
        perfilPDFModel,
      };
    } catch (error) {
      console.error('🚀 ~ file: relatorios.service.ts:114 ~ createPDF:', error);
      throw new InternalServerErrorException(error.message); // or throw new InternalServerErrorException(error.message);
    }
  }
}

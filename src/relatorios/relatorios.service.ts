import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
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

@Injectable()
export class RelatorioService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly usuarioApi: UsuarioGraphQLAPI,
    private readonly produtorApi: ProdutorGraphQLAPI,
    private readonly fileService: FileService,
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
          /* produtor: {
            connect: {
              id: BigInt(produtorId),
            },
          }, */
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
    return relatorios;
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

    if (numeroRelatorio) update.numeroRelatorio = +numeroRelatorio;
    if (produtorId) update.produtorId = BigInt(produtorId);
    if (tecnicoId) update.tecnicoId = BigInt(tecnicoId);

    console.log('🚀 relatorios.service.ts:71: ', update);
    const updated = await this.prismaService.relatorio.update({
      where: { id },
      data: {
        ...update,
        updatedAt: new Date(updatedAt.slice(0, 10) + ' ' + updatedAt.slice(11, 19)),
      },
    });
    return updated;
  }

  async remove(id: string) {
    const relatorio = await this.findOne(id);
    const { pictureURI, assinaturaURI } = relatorio;
    const fileIds = [pictureURI, assinaturaURI].filter((f) => !!f);
    if (fileIds.length > 0) {
      await this.fileService.remove(fileIds, process.env.FILES_FOLDER);
    }
    await this.prismaService.relatorio.delete({ where: { id } });
    return `Relatorio ${id} removed.`;
  }

  async createPDFInput(relatorioId: string) {
    try {
      const relatorio = await this.findOne(relatorioId);
      const { outroExtensionista } = relatorio;
      const tecnicoIds = relatorio.tecnicoId.toString() + ',' + outroExtensionista;
      const { usuarios } = (await this.usuarioApi.getUsuarios({ ids: tecnicoIds })) as {
        usuarios: Usuario[];
      };
      const usuario = usuarios.find((u) => u.id_usuario == relatorio.tecnicoId);
      const outrosExtensionistas = usuarios.filter((u) => u.id_usuario != relatorio.tecnicoId);

      const produtor = await this.produtorApi.getProdutorById(relatorio.produtorId.toString());
      const { perfis } = produtor;
      const perfil = perfis[0] as PerfilModel;
      const { dados_producao_in_natura, dados_producao_agro_industria } = perfil;

      const perfilPDFModel = new Perfil().toPDFModel(perfil);
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
          outrosExtensionistas,
        },
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

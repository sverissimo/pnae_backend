import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Relatorio } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { FileService } from 'src/common/file.service';
import { pdfGen } from 'src/@pdf-gen/pdf-gen';
import { UsuarioGraphQLAPI } from 'src/@graphQL-server/usuario-api.service';
import { ProdutorGraphQLAPI } from 'src/@graphQL-server/produtor-api.service';
import { formatCPF } from 'src/utils/formatCPF';
import { CreateRelatorioDto } from './dto/create-relatorio.dto';

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
          tecnicoId: BigInt(tecnicoId),
          numeroRelatorio: +numeroRelatorio,
          produtor: {
            connect: {
              id: BigInt(produtorId),
            },
          },
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

  async update(update: any) {
    // const demeterUpdate = await this.graphQLAPI.updateRelatorio(update);
    // console.log('🚀 relatorios.service.ts:63 ~ RelatorioService ~ demeterUpdate:', demeterUpdate);
    const updated = await this.prismaService.relatorio.update({
      where: { id: update.id },
      data: update,
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

  async createPDF(relatorioId: string) {
    try {
      const relatorio = await this.findOne(relatorioId);
      const usuario = await this.usuarioApi.getUsuario('' + relatorio.tecnicoId);
      const produtor = await this.produtorApi.getProdutorById(relatorio.produtorId.toString());

      await pdfGen({
        ...relatorio,
        produtor: {
          nomeProdutor: produtor.nm_pessoa,
          cpfProdutor: formatCPF(produtor.nr_cpf_cnpj),
          caf: produtor.caf || produtor.dap,
        },
        nomeTecnico: usuario.nome_usuario,
        matricula: usuario.matricula_usuario + '-' + usuario.digito_matricula,
      });
      return relatorio;
    } catch (error) {
      console.error('🚀 ~ file: relatorios.service.ts:114 ~ createPDF:', error);
      throw new InternalServerErrorException(error.message); // or throw new InternalServerErrorException(error.message);
    }
  }
}

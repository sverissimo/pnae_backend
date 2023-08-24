import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma, Relatorio } from '@prisma/client';
import { pdfGen } from 'src/@pdf-gen/pdf-gen';
import { UsuarioGraphQLAPI } from 'src/@graphQL-server/usuario-api.service';
import { ProdutorGraphQLAPI } from 'src/@graphQL-server/produtor-api.service';
import { UpdateRelatorioDto } from './dto/update-relatorio.dto';
import { formatCPF } from 'src/utils/formatCPF';

@Injectable()
export class RelatorioService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly usuarioApi: UsuarioGraphQLAPI,
    private readonly produtorApi: ProdutorGraphQLAPI,
  ) {}

  async create(
    createRelatorioDto: Prisma.RelatorioCreateInput & { produtorId: any },
  ): Promise<Relatorio> {
    const relatorio = await this.prismaService.relatorio.create({
      data: {
        //produtorId: createRelatorioDto.produtorId,
        tecnicoId: createRelatorioDto.tecnicoId,
        numeroRelatorio: +createRelatorioDto.numeroRelatorio,
        assunto: createRelatorioDto.assunto,
        orientacao: createRelatorioDto.orientacao,
        produtor: {
          connect: {
            id: BigInt(createRelatorioDto.produtorId),
          },
        },
      },
    });

    return relatorio;
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

  async findOne(id: number) {
    const relatorio = await this.prismaService.relatorio.findUnique({
      where: { id: id },
    });
    if (!relatorio) {
      throw new NotFoundException('Nenhum relatório encontrado');
    }

    return relatorio;
  }

  async update(update: UpdateRelatorioDto) {
    // const demeterUpdate = await this.graphQLAPI.updateRelatorio(update);
    // console.log('🚀 relatorios.service.ts:63 ~ RelatorioService ~ demeterUpdate:', demeterUpdate);
    const updated = await this.prismaService.relatorio.update({
      where: { id: update.id },
      data: update,
    });
    return updated;
  }

  async remove(id: number) {
    /* TODO: Implementar isso depois
    const { files } = relatorio;
      if (files && files.length > 0) {
        const fileIds = files.map((f) => f.id);
        await this.fileService.remove(fileIds, process.env.FILES_FOLDER);
      } */
    await this.prismaService.relatorio.delete({ where: { id } });
    return `Relatorio ${id} removed.`;
  }

  async createPDF(relatorioId: number) {
    try {
      const relatorio = await this.findOne(+relatorioId);
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
